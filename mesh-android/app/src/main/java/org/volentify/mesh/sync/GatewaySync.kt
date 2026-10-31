package org.volentify.mesh.sync

import android.content.Context
import android.os.BatteryManager
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import org.volentify.mesh.data.DeliveryStatus
import org.volentify.mesh.data.Envelope
import org.volentify.mesh.data.MeshDatabase
import org.volentify.mesh.data.Settings
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Gateway outbox sync (FR-08, AT-06…AT-08). Any phone with internet uploads everything it holds —
 * its own reports and those relayed to it — in batches of up to 100. Records are only marked
 * server-confirmed after a 200 acknowledgement; network or 5xx failures retry with exponential backoff.
 */
object GatewaySync {
    private const val ONE_SHOT = "gateway-sync-now"
    private const val PERIODIC = "gateway-sync-periodic"
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedulePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<GatewaySyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(online)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    /** Runs as soon as the phone is online (immediately if it already is). */
    fun requestSoon(context: Context) {
        val request = OneTimeWorkRequestBuilder<GatewaySyncWorker>()
            .setConstraints(online)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(ONE_SHOT, ExistingWorkPolicy.KEEP, request)
    }
}

class GatewaySyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    private val http = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build()
    private val json = "application/json".toMediaType()

    override suspend fun doWork(): Result {
        val settings = Settings(applicationContext)
        val dao = MeshDatabase.get(applicationContext).dao()
        dao.purgeConfirmedBefore(System.currentTimeMillis() - TimeUnit.HOURS.toMillis(72))
        refreshIncidents(settings)

        val token = settings.gatewayToken ?: return Result.success().also {
            settings.lastSyncMessage = "Add a gateway token in Settings to upload reports"
        }
        var batchSize = 100
        while (true) {
            val batch = dao.outbox(batchSize)
            if (batch.isEmpty()) break
            val ids = batch.map { it.eventId }
            dao.setStatus(ids, DeliveryStatus.SYNCING)
            val body = JSONObject().apply {
                put("gateway_node_id", settings.nodeId)
                batteryPercent()?.let { put("gateway_battery", it) }
                put("events", JSONArray().apply { batch.forEach { put(Envelope.toJson(it)) } })
            }
            val request = Request.Builder()
                .url("${settings.serverUrl}/api/mesh/ingest")
                .header("Authorization", "Bearer $token")
                .post(body.toString().toRequestBody(json))
                .build()
            try {
                http.newCall(request).execute().use { resp ->
                    val text = resp.body?.string().orEmpty()
                    when {
                        resp.isSuccessful -> {
                            val ack = JSONObject(text)
                            dao.confirm(ids, ack.optString("gateway_ack_id", "ack"), System.currentTimeMillis())
                            settings.lastSyncAt = System.currentTimeMillis()
                            settings.lastSyncMessage = "Uploaded ${ack.optInt("accepted_count")} new, " +
                                "${ack.optInt("duplicate_count")} already on the server" +
                                if (ack.optString("persistence") == "volatile") " (server is in demo mode)" else ""
                        }
                        resp.code == 401 -> {
                            dao.setStatus(ids, DeliveryStatus.QUEUED)
                            settings.lastSyncMessage = "Gateway token expired — get a new one from your Volentify dashboard"
                            return Result.success()
                        }
                        resp.code == 422 && ids.size > 1 -> {
                            // Isolate the invalid report by retrying one at a time.
                            dao.setStatus(ids, DeliveryStatus.QUEUED)
                            batchSize = 1
                        }
                        resp.code == 422 -> {
                            dao.fail(ids, text.take(200))
                            settings.lastSyncMessage = "Server rejected a report as invalid"
                        }
                        else -> {
                            dao.setStatus(ids, DeliveryStatus.QUEUED)
                            settings.lastSyncMessage = "Server unavailable (${resp.code}); retrying"
                            return Result.retry()
                        }
                    }
                }
            } catch (e: IOException) {
                dao.resetSyncing()
                settings.lastSyncMessage = "No connection to the server; will retry"
                return Result.retry()
            }
        }
        return Result.success()
    }

    private fun refreshIncidents(settings: Settings) {
        try {
            val request = Request.Builder().url("${settings.serverUrl}/api/mesh/incidents").build()
            http.newCall(request).execute().use { resp ->
                if (resp.isSuccessful) settings.incidentsJson = resp.body?.string()
            }
        } catch (_: IOException) {
        }
    }

    private fun batteryPercent(): Int? {
        val bm = applicationContext.getSystemService(BatteryManager::class.java) ?: return null
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).takeIf { it in 0..100 }
    }
}
