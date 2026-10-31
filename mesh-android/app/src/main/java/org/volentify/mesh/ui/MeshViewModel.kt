package org.volentify.mesh.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import org.volentify.mesh.data.Envelope
import org.volentify.mesh.data.EventType
import org.volentify.mesh.data.MeshDatabase
import org.volentify.mesh.data.MeshEvent
import org.volentify.mesh.data.Priority
import org.volentify.mesh.data.Settings
import org.volentify.mesh.location.LocationProvider
import org.volentify.mesh.mesh.BleMeshService
import org.volentify.mesh.sync.GatewaySync

data class Incident(val id: String, val title: String, val category: String)

const val MAX_MESSAGE = 500

class MeshViewModel(app: Application) : AndroidViewModel(app) {
    val settings = Settings(app)
    private val dao = MeshDatabase.get(app).dao()

    val events: StateFlow<List<MeshEvent>> = dao.observeAll().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val pending: StateFlow<Int> = dao.observePendingCount().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    /** Broadcast messages: situation updates carrying a text "message" payload. */
    val messages: StateFlow<List<MeshEvent>> = dao.observeAll()
        .map { all -> all.filter { it.type == EventType.DISASTER_STATUS && it.payloadJson.contains("\"message\"") } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun sendMessage(text: String, priority: Priority) {
        val body = text.trim().take(MAX_MESSAGE)
        if (body.isEmpty()) return
        createReport(
            EventType.DISASTER_STATUS, priority,
            mapOf("message" to body, "from" to settings.displayName), disasterId = null,
        ) {}
    }

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()
    fun clearMessage() { _message.value = null }

    fun incidents(): List<Incident> = try {
        val arr = JSONArray(settings.incidentsJson ?: "[]")
        (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Incident(o.getString("disaster_id"), o.getString("title"), o.getString("category"))
        }
    } catch (e: Exception) {
        emptyList()
    }

    fun createReport(type: EventType, priority: Priority, details: Map<String, Any>, disasterId: String?, onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                val coords = LocationProvider.current(getApplication(), settings.maskLocation)
                val event = Envelope.newEvent(
                    originNodeId = settings.nodeId, type = type, priority = priority,
                    payload = JSONObject(details), lat = coords?.first, lng = coords?.second,
                    disasterId = disasterId, now = System.currentTimeMillis(),
                )
                dao.insert(event)
                GatewaySync.requestSoon(getApplication())
                _message.value = if (coords == null) "Saved locally without GPS — it will relay to nearby phones"
                else "Saved locally — it will relay to nearby phones and sync when online"
                onDone()
            } catch (e: IllegalArgumentException) {
                _message.value = e.message
            }
        }
    }

    fun setMesh(enabled: Boolean) {
        settings.meshEnabled = enabled
        if (enabled) BleMeshService.start(getApplication()) else BleMeshService.stop(getApplication())
    }

    fun syncNow() {
        GatewaySync.requestSoon(getApplication())
        _message.value = "Sync requested — it runs as soon as the phone is online"
    }
}
