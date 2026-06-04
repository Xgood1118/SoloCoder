package com.example.schedulemanager.data

import kotlinx.coroutines.flow.Flow

class ScheduleRepository(private val scheduleDao: ScheduleDao) {
    val allSchedules: Flow<List<Schedule>> = scheduleDao.getAllSchedules()
    val activeSchedules: Flow<List<Schedule>> = scheduleDao.getActiveSchedules()

    suspend fun getScheduleById(id: Long): Schedule? = scheduleDao.getScheduleById(id)

    suspend fun getSchedulesBetween(fromTime: Long, toTime: Long): List<Schedule> =
        scheduleDao.getSchedulesBetween(fromTime, toTime)

    suspend fun getOverdueSchedules(currentTime: Long): List<Schedule> =
        scheduleDao.getOverdueSchedules(currentTime)

    suspend fun insert(schedule: Schedule): Long = scheduleDao.insertSchedule(schedule)

    suspend fun update(schedule: Schedule) = scheduleDao.updateSchedule(schedule)

    suspend fun delete(schedule: Schedule) = scheduleDao.deleteSchedule(schedule)

    suspend fun deleteRepeatingInstances(originalId: Long) =
        scheduleDao.deleteRepeatingInstances(originalId)
}
