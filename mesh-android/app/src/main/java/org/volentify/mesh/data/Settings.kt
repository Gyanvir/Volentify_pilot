package org.volentify.mesh.data

import android.content.Context
import org.volentify.mesh.BuildConfig
import java.util.UUID

/** Node identity and gateway configuration. The node id is a random UUID, never a hardware MAC (FR-01). */
class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("volentify_mesh", Context.MODE_PRIVATE)

    val nodeId: String
        get() = prefs.getString(KEY_NODE, null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString(KEY_NODE, it).apply()
        }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER, null) ?: BuildConfig.DEFAULT_SERVER_URL
        set(v) = prefs.edit().putString(KEY_SERVER, v.trim().trimEnd('/')).apply()

    /** Short-lived gateway token issued from the Volentify dashboard (OD-01). Never bundled in the APK. */
    var gatewayToken: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(v) = prefs.edit().putString(KEY_TOKEN, v?.trim()?.takeIf { it.isNotEmpty() }).apply()

    var meshEnabled: Boolean
        get() = prefs.getBoolean(KEY_MESH, true)
        set(v) = prefs.edit().putBoolean(KEY_MESH, v).apply()

    /** OD-05: shift reported coordinates by up to ±500 m. */
    var maskLocation: Boolean
        get() = prefs.getBoolean(KEY_MASK, false)
        set(v) = prefs.edit().putBoolean(KEY_MASK, v).apply()

    var lastSyncAt: Long
        get() = prefs.getLong(KEY_SYNC, 0)
        set(v) = prefs.edit().putLong(KEY_SYNC, v).apply()

    var lastSyncMessage: String?
        get() = prefs.getString(KEY_SYNC_MSG, null)
        set(v) = prefs.edit().putString(KEY_SYNC_MSG, v).apply()

    /** Cached incidents from GET /api/mesh/incidents for offline report linking. */
    var incidentsJson: String?
        get() = prefs.getString(KEY_INCIDENTS, null)
        set(v) = prefs.edit().putString(KEY_INCIDENTS, v).apply()

    private companion object {
        const val KEY_NODE = "node_id"
        const val KEY_SERVER = "server_url"
        const val KEY_TOKEN = "gateway_token"
        const val KEY_MESH = "mesh_enabled"
        const val KEY_MASK = "mask_location"
        const val KEY_SYNC = "last_sync_at"
        const val KEY_SYNC_MSG = "last_sync_message"
        const val KEY_INCIDENTS = "incidents_json"
    }
}
