package org.volentify.mesh.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface MeshDao {
    /** Returns -1 when the eventId already exists — the stable deduplication rule (FR-06). */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(event: MeshEvent): Long

    @Query("SELECT * FROM mesh_events ORDER BY observedAt DESC")
    fun observeAll(): Flow<List<MeshEvent>>

    @Query("SELECT COUNT(*) FROM mesh_events WHERE status != 'SERVER_CONFIRMED' AND status != 'FAILED'")
    fun observePendingCount(): Flow<Int>

    @Query("SELECT * FROM mesh_events WHERE ttl > 0 AND status != 'FAILED' ORDER BY CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, observedAt DESC LIMIT :limit")
    suspend fun relayable(limit: Int): List<MeshEvent>

    @Query("SELECT * FROM mesh_events WHERE status IN ('QUEUED', 'RELAYED', 'SYNCING') ORDER BY observedAt ASC LIMIT :limit")
    suspend fun outbox(limit: Int): List<MeshEvent>

    @Query("UPDATE mesh_events SET status = :status WHERE eventId IN (:ids)")
    suspend fun setStatus(ids: List<String>, status: DeliveryStatus)

    @Query("UPDATE mesh_events SET status = 'SERVER_CONFIRMED', serverAckId = :ackId, confirmedAt = :now WHERE eventId IN (:ids)")
    suspend fun confirm(ids: List<String>, ackId: String, now: Long)

    @Query("UPDATE mesh_events SET status = 'FAILED', failureReason = :reason WHERE eventId IN (:ids)")
    suspend fun fail(ids: List<String>, reason: String)

    @Query("UPDATE mesh_events SET relayCount = relayCount + 1, lastRelayAt = :now, status = CASE WHEN status = 'QUEUED' THEN 'RELAYED' ELSE status END WHERE eventId = :id")
    suspend fun markRelayed(id: String, now: Long)

    /** Unsent reports return to the queue after an interrupted upload. */
    @Query("UPDATE mesh_events SET status = 'QUEUED' WHERE status = 'SYNCING'")
    suspend fun resetSyncing()

    /** OD-04: keep confirmed events on the device for 72 hours after sync. */
    @Query("DELETE FROM mesh_events WHERE status = 'SERVER_CONFIRMED' AND confirmedAt < :cutoff")
    suspend fun purgeConfirmedBefore(cutoff: Long): Int
}
