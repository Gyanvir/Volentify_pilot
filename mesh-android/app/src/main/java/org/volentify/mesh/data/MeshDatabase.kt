package org.volentify.mesh.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters

class Converters {
    @TypeConverter fun type(v: EventType): String = v.name
    @TypeConverter fun type(v: String): EventType = EventType.valueOf(v)
    @TypeConverter fun priority(v: Priority): String = v.name
    @TypeConverter fun priority(v: String): Priority = Priority.valueOf(v)
    @TypeConverter fun status(v: DeliveryStatus): String = v.name
    @TypeConverter fun status(v: String): DeliveryStatus = DeliveryStatus.valueOf(v)
}

/** SQLite via Room: survives process death and reboots (FR-03, AT-02). */
@Database(entities = [MeshEvent::class], version = 1, exportSchema = false)
@TypeConverters(Converters::class)
abstract class MeshDatabase : RoomDatabase() {
    abstract fun dao(): MeshDao

    companion object {
        @Volatile private var instance: MeshDatabase? = null

        fun get(context: Context): MeshDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, MeshDatabase::class.java, "volentify-mesh.db")
                .build().also { instance = it }
        }
    }
}
