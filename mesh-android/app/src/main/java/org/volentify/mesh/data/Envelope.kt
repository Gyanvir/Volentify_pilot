package org.volentify.mesh.data

import org.json.JSONObject
import java.time.Instant
import java.util.UUID

/**
 * Wire format exchanged between phones and uploaded to POST /api/mesh/ingest.
 * Validation mirrors the server (FR-05) so invalid packets are dropped before relay.
 */
object Envelope {
    const val MAX_PAYLOAD_BYTES = 4096
    const val MAX_TTL = 5

    fun toJson(e: MeshEvent): JSONObject = JSONObject().apply {
        put("event_id", e.eventId)
        put("origin_node_id", e.originNodeId)
        put("disaster_id", e.disasterId ?: JSONObject.NULL)
        put("type", e.type.name)
        put("priority", e.priority.name)
        put("payload", JSONObject(e.payloadJson))
        put("lat", e.lat ?: JSONObject.NULL)
        put("lng", e.lng ?: JSONObject.NULL)
        put("observed_at", Instant.ofEpochMilli(e.observedAt).toString())
        put("hop_count", e.hopCount)
        put("ttl", e.ttl)
    }

    /** Parses a relayed envelope, applying one hop: hopCount + 1, ttl - 1. Returns null when invalid. */
    fun receive(raw: String, now: Long): MeshEvent? = try {
        val o = JSONObject(raw)
        val payload = o.getJSONObject("payload")
        val ttl = o.getInt("ttl")
        val hop = o.getInt("hop_count")
        val lat = if (o.isNull("lat")) null else o.getDouble("lat")
        val lng = if (o.isNull("lng")) null else o.getDouble("lng")
        val valid = payload.toString().toByteArray().size <= MAX_PAYLOAD_BYTES &&
            ttl in 1..MAX_TTL && hop >= 0 &&
            (lat == null) == (lng == null) &&
            (lat == null || (lat in -90.0..90.0 && lng!! in -180.0..180.0)) &&
            isUuid(o.getString("event_id")) && isUuid(o.getString("origin_node_id"))
        if (!valid) null else MeshEvent(
            eventId = o.getString("event_id"),
            originNodeId = o.getString("origin_node_id"),
            disasterId = if (o.isNull("disaster_id")) null else o.getString("disaster_id"),
            type = EventType.valueOf(o.getString("type")),
            priority = Priority.valueOf(o.getString("priority")),
            payloadJson = payload.toString(),
            lat = lat, lng = lng,
            observedAt = Instant.parse(o.getString("observed_at")).toEpochMilli(),
            hopCount = hop + 1,
            ttl = ttl - 1,
            status = DeliveryStatus.QUEUED,
            createdHere = false,
            receivedAt = now,
        )
    } catch (e: Exception) {
        null
    }

    fun newEvent(
        originNodeId: String, type: EventType, priority: Priority, payload: JSONObject,
        lat: Double?, lng: Double?, disasterId: String?, now: Long,
    ): MeshEvent {
        require(payload.toString().toByteArray().size <= MAX_PAYLOAD_BYTES) { "Report details are too long" }
        return MeshEvent(
            eventId = UUID.randomUUID().toString(), originNodeId = originNodeId, disasterId = disasterId,
            type = type, priority = priority, payloadJson = payload.toString(), lat = lat, lng = lng,
            observedAt = now, hopCount = 0, ttl = MAX_TTL, status = DeliveryStatus.QUEUED, createdHere = true,
            receivedAt = now,
        )
    }

    private fun isUuid(s: String) = try { UUID.fromString(s); s.length == 36 } catch (e: IllegalArgumentException) { false }
}
