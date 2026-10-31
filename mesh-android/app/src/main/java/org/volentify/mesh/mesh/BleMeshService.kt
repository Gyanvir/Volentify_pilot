package org.volentify.mesh.mesh

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.ParcelUuid
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import org.volentify.mesh.MainActivity
import org.volentify.mesh.R
import org.volentify.mesh.data.Envelope
import org.volentify.mesh.data.MeshDatabase
import org.volentify.mesh.sync.GatewaySync
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Store-and-forward relay over Bluetooth LE (PRD §2–3).
 *
 * Every phone is both a GATT server (accepts envelopes into its inbox characteristic) and a client
 * (scans for peers advertising the Volentify service and writes its relayable envelopes to them).
 * Received envelopes are validated, deduplicated by eventId in Room, stored with hop+1 / ttl−1, and
 * relayed onward while ttl > 0. Nothing is lost if the process dies: the outbox lives in SQLite.
 */
@SuppressLint("MissingPermission") // every entry point checks MeshPermissions.bluetoothGranted first
class BleMeshService : LifecycleService() {

    companion object {
        val SERVICE_UUID: UUID = UUID.fromString("7f3c0001-6a1e-4c2b-9b8e-5d1f0c7a9e10")
        val INBOX_UUID: UUID = UUID.fromString("7f3c0002-6a1e-4c2b-9b8e-5d1f0c7a9e10")
        private const val CHANNEL = "mesh_relay"
        private const val NOTIFICATION_ID = 1001
        private const val PEER_COOLDOWN_MS = 45_000L
        private const val SESSION_TIMEOUT_MS = 25_000L
        private const val MAX_EVENTS_PER_SESSION = 30
        private const val PEER_SEEN_WINDOW_MS = 60_000L

        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, BleMeshService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BleMeshService::class.java))
        }
    }

    private val dao by lazy { MeshDatabase.get(this).dao() }
    private val adapter: BluetoothAdapter? by lazy { getSystemService(BluetoothManager::class.java)?.adapter }
    private var gattServer: BluetoothGattServer? = null
    private val reassembler = Framing.Reassembler()
    private val lastContact = ConcurrentHashMap<String, Long>()
    private val lastSeen = ConcurrentHashMap<String, Long>()
    private val sentTo = ConcurrentHashMap<String, MutableSet<String>>()
    private val sessionLock = Mutex()
    private val messageIds = AtomicInteger((System.nanoTime() and 0x7FFF).toInt())

    override fun onCreate() {
        super.onCreate()
        startInForeground()
        if (!MeshPermissions.bluetoothGranted(this) || adapter?.isEnabled != true) {
            MeshState.update { it.copy(running = false, error = "Turn on Bluetooth and allow nearby devices") }
            stopSelf()
            return
        }
        openServer()
        advertise()
        scan()
        MeshState.update { it.copy(running = true, error = null) }
        lifecycleScope.launch {
            while (true) {
                delay(15_000)
                val now = System.currentTimeMillis()
                lastSeen.entries.removeAll { now - it.value > PEER_SEEN_WINDOW_MS }
                MeshState.update { it.copy(peersNearby = lastSeen.size) }
            }
        }
    }

    override fun onDestroy() {
        try {
            adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
            adapter?.bluetoothLeScanner?.stopScan(scanCallback)
            gattServer?.close()
        } catch (_: SecurityException) {
        }
        MeshState.update { it.copy(running = false, peersNearby = 0) }
        super.onDestroy()
    }

    // ─── Foreground notification ───────────────────────────────────────────

    private fun startInForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Mesh relay", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Keeps relaying field reports to nearby phones"
        })
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_mesh)
            .setContentTitle("Volentify Mesh is relaying")
            .setContentText("Field reports are shared with nearby phones over Bluetooth")
            .setContentIntent(open)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    // ─── GATT server: the inbox other phones write into ────────────────────

    private fun openServer() {
        val manager = getSystemService(BluetoothManager::class.java) ?: return
        gattServer = manager.openGattServer(this, serverCallback)?.also { server ->
            val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
            service.addCharacteristic(BluetoothGattCharacteristic(
                INBOX_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE,
            ))
            server.addService(service)
        }
    }

    private val serverCallback = object : BluetoothGattServerCallback() {
        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray?,
        ) {
            if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
            if (characteristic.uuid != INBOX_UUID || value == null) return
            val message = reassembler.accept(device.address, value, System.currentTimeMillis()) ?: return
            lifecycleScope.launch(Dispatchers.IO) { ingest(String(message, Charsets.UTF_8)) }
        }
    }

    private suspend fun ingest(raw: String) {
        val now = System.currentTimeMillis()
        val event = Envelope.receive(raw, now) ?: return // invalid or exhausted TTL: dropped (FR-05, FR-07)
        if (dao.insert(event) != -1L) {
            MeshState.update { it.copy(received = it.received + 1, lastExchangeAt = now) }
            GatewaySync.requestSoon(this)
        }
    }

    // ─── Advertising & scanning ─────────────────────────────────────────────

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartFailure(errorCode: Int) {
            MeshState.update { it.copy(error = "This phone can't advertise over Bluetooth (code $errorCode); it can still send") }
        }
    }

    private fun advertise() {
        val advertiser = adapter?.bluetoothLeAdvertiser ?: return
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(true)
            .build()
        val data = AdvertiseData.Builder()
            .addServiceUuid(ParcelUuid(SERVICE_UUID))
            .setIncludeDeviceName(false)
            .build()
        advertiser.startAdvertising(settings, data, advertiseCallback)
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val address = result.device.address
            val now = System.currentTimeMillis()
            lastSeen[address] = now
            if (now - (lastContact[address] ?: 0) < PEER_COOLDOWN_MS) return
            lastContact[address] = now
            lifecycleScope.launch(Dispatchers.IO) { exchange(result.device) }
        }

        override fun onScanFailed(errorCode: Int) {
            MeshState.update { it.copy(error = "Bluetooth scan failed (code $errorCode)") }
        }
    }

    private fun scan() {
        val scanner = adapter?.bluetoothLeScanner ?: return
        val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE_UUID)).build()
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_BALANCED).build()
        scanner.startScan(listOf(filter), settings, scanCallback)
    }

    // ─── Client session: push relayable envelopes to one peer ──────────────

    private suspend fun exchange(device: BluetoothDevice) = sessionLock.withLock {
        val already = sentTo.getOrPut(device.address) { mutableSetOf() }
        val batch = dao.relayable(MAX_EVENTS_PER_SESSION).filter { it.eventId !in already }
        if (batch.isEmpty()) return@withLock
        val session = GattSession(device)
        val delivered = withTimeoutOrNull(SESSION_TIMEOUT_MS) { session.run(batch.map { it.eventId to Envelope.toJson(it).toString() }) }
        session.close()
        val now = System.currentTimeMillis()
        delivered?.forEach { id ->
            already += id
            dao.markRelayed(id, now)
        }
        if (!delivered.isNullOrEmpty()) {
            MeshState.update { it.copy(sent = it.sent + delivered.size, lastExchangeAt = now) }
        }
    }

    /** One connection: connect → MTU → discover → write every frame sequentially. */
    private inner class GattSession(private val device: BluetoothDevice) {
        private var gatt: BluetoothGatt? = null
        private var ready = CompletableDeferred<BluetoothGattCharacteristic?>()
        private var writeDone = CompletableDeferred<Boolean>()
        private var mtu = 23

        private val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                    if (!g.requestMtu(517)) g.discoverServices()
                } else {
                    ready.complete(null)
                    writeDone.complete(false)
                }
            }

            override fun onMtuChanged(g: BluetoothGatt, newMtu: Int, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) mtu = newMtu
                g.discoverServices()
            }

            override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                ready.complete(g.getService(SERVICE_UUID)?.getCharacteristic(INBOX_UUID))
            }

            override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
                writeDone.complete(status == BluetoothGatt.GATT_SUCCESS)
            }
        }

        suspend fun run(envelopes: List<Pair<String, String>>): List<String> {
            gatt = device.connectGatt(this@BleMeshService, false, callback, BluetoothDevice.TRANSPORT_LE)
            val inbox = ready.await() ?: return emptyList()
            val delivered = mutableListOf<String>()
            for ((id, json) in envelopes) {
                val frames = Framing.split(json.toByteArray(Charsets.UTF_8), messageIds.incrementAndGet() and 0xFFFF, mtu)
                var ok = true
                for (frame in frames) {
                    writeDone = CompletableDeferred()
                    if (!write(inbox, frame) || !writeDone.await()) {
                        ok = false
                        break
                    }
                }
                if (!ok) break
                delivered += id
            }
            return delivered
        }

        @Suppress("DEPRECATION")
        private fun write(c: BluetoothGattCharacteristic, value: ByteArray): Boolean {
            val g = gatt ?: return false
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                g.writeCharacteristic(c, value, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothGatt.GATT_SUCCESS
            } else {
                c.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                c.value = value
                g.writeCharacteristic(c)
            }
        }

        fun close() {
            try {
                gatt?.disconnect()
                gatt?.close()
            } catch (_: SecurityException) {
            }
            gatt = null
        }
    }
}
