package com.example.schedulemanager.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ScheduleDao {
    @Query("SELECT * FROM schedules ORDER BY dateTime ASC")
    fun getAllSchedules(): Flow<List<Schedule>>

    @Query("SELECT * FROM schedules WHERE id = :id")
    suspend fun getScheduleById(id: Long): Schedule?

    @Query("SELECT * FROM schedules WHERE dateTime > :fromTime AND dateTime <= :toTime ORDER BY dateTime ASC")
    suspend fun getSchedulesBetween(fromTime: Long, toTime: Long): List<Schedule>

    @Query("SELECT * FROM schedules WHERE isCompleted = 0 AND isRepeatEnded = 0 ORDER BY dateTime ASC")
    fun getActiveSchedules(): Flow<List<Schedule>>

    @Query("SELECT * FROM schedules WHERE isCompleted = 0 AND dateTime <= :currentTime ORDER BY dateTime ASC")
    suspend fun getOverdueSchedules(currentTime: Long): List<Schedule>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSchedule(schedule: Schedule): Long

    @Update
    suspend fun updateSchedule(schedule: Schedule)

    @Delete
    suspend fun deleteSchedule(schedule: Schedule)

    @Query("DELETE FROM schedules WHERE originalScheduleId = :originalId")
    suspend fun deleteRepeatingInstances(originalId: Long)
}
