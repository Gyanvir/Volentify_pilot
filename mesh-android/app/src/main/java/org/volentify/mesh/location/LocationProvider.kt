package org.volentify.mesh.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.volentify.mesh.mesh.MeshPermissions
import kotlin.coroutines.resume
import kotlin.math.cos
import kotlin.random.Random

/** Best-effort GPS fix. Returns null without permission or signal — reports still save (AT-05). */
object LocationProvider {
    private const val FRESH_MS = 10 * 60 * 1000L

    @SuppressLint("MissingPermission")
    suspend fun current(context: Context, mask: Boolean): Pair<Double, Double>? {
        if (!MeshPermissions.locationGranted(context)) return null
        val lm = context.getSystemService(LocationManager::class.java) ?: return null
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).filter { lm.isProviderEnabled(it) }
        val recent = providers.mapNotNull { lm.getLastKnownLocation(it) }
            .filter { System.currentTimeMillis() - it.time < FRESH_MS }
            .minByOrNull { it.accuracy }
        val fix = recent ?: providers.firstOrNull()?.let { provider ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                withTimeoutOrNull(15_000) {
                    suspendCancellableCoroutine<Location?> { cont ->
                        val signal = CancellationSignal()
                        cont.invokeOnCancellation { signal.cancel() }
                        lm.getCurrentLocation(provider, signal, context.mainExecutor) { cont.resume(it) }
                    }
                }
            } else {
                providers.mapNotNull { lm.getLastKnownLocation(it) }.maxByOrNull { it.time }
            }
        } ?: return null
        return if (mask) jitter(fix.latitude, fix.longitude) else fix.latitude to fix.longitude
    }

    /** OD-05: uniform offset of up to ±500 m on each axis. */
    fun jitter(lat: Double, lng: Double, meters: Double = 500.0): Pair<Double, Double> {
        val dLat = (Random.nextDouble(-1.0, 1.0) * meters) / 111_320.0
        val dLng = (Random.nextDouble(-1.0, 1.0) * meters) / (111_320.0 * cos(Math.toRadians(lat)).coerceAtLeast(0.01))
        return (lat + dLat) to (lng + dLng)
    }
}
