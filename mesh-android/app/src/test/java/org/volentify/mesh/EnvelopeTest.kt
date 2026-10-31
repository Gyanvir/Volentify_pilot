package org.volentify.mesh

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.volentify.mesh.data.DeliveryStatus
import org.volentify.mesh.data.Envelope
import org.volentify.mesh.data.EventType
import org.volentify.mesh.data.Priority
import java.util.UUID

class EnvelopeTest {
    private val node = UUID.randomUUID().toString()

    private fun created(lat: Double? = 19.81, lng: Double? = 85.83) = Envelope.newEvent(
        node, EventType.MEDICAL_EMERGENCY, Priority.CRITICAL, JSONObject(mapOf("count" to 2)), lat, lng, "dis_remal_puri", 1_700_000_000_000,
    )

    @Test fun relayAppliesOneHop() {
        val sent = created()
        val got = Envelope.receive(Envelope.toJson(sent).toString(), now = 1)
        assertNotNull(got)
        assertEquals(sent.eventId, got!!.eventId)
        assertEquals(1, got.hopCount)
        assertEquals(Envelope.MAX_TTL - 1, got.ttl)
        assertEquals(DeliveryStatus.QUEUED, got.status)
        assertFalse(got.createdHere)
        assertEquals(sent.observedAt, got.observedAt)
    }

    @Test fun exhaustedTtlIsDropped() {
        val json = Envelope.toJson(created()).put("ttl", 0)
        assertNull(Envelope.receive(json.toString(), 1))
    }

    @Test fun nullGpsSurvives() {
        val got = Envelope.receive(Envelope.toJson(created(null, null)).toString(), 1)
        assertNotNull(got)
        assertNull(got!!.lat)
    }

    @Test fun invalidPacketsAreRejected() {
        val base = Envelope.toJson(created())
        assertNull(Envelope.receive(JSONObject(base.toString()).put("type", "ALIEN").toString(), 1))
        assertNull(Envelope.receive(JSONObject(base.toString()).put("lat", 120.0).toString(), 1))
        assertNull(Envelope.receive(JSONObject(base.toString()).put("event_id", "not-a-uuid").toString(), 1))
        assertNull(Envelope.receive(JSONObject(base.toString()).put("payload", JSONObject().put("x", "y".repeat(5000))).toString(), 1))
        assertNull(Envelope.receive("garbage", 1))
    }
}
