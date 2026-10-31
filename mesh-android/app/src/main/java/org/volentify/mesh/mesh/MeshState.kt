package org.volentify.mesh.mesh

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Live relay status for the UI. */
object MeshState {
    data class Snapshot(
        val running: Boolean = false,
        val peersNearby: Int = 0,
        val lastExchangeAt: Long = 0,
        val received: Int = 0,
        val sent: Int = 0,
        val error: String? = null,
    )

    private val state = MutableStateFlow(Snapshot())
    val snapshot: StateFlow<Snapshot> = state.asStateFlow()

    fun update(transform: (Snapshot) -> Snapshot) {
        state.value = transform(state.value)
    }
}
