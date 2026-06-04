package com.example.schedulemanager.data

import androidx.room.TypeConverter

class Converters {
    @TypeConverter
    fun fromRepeatType(value: RepeatType): String = value.name

    @TypeConverter
    fun toRepeatType(value: String): RepeatType = RepeatType.valueOf(value)

    @TypeConverter
    fun fromLongList(value: List<Long>): String = value.joinToString(",")

    @TypeConverter
    fun toLongList(value: String): List<Long> {
        if (value.isEmpty()) return emptyList()
        return value.split(",").mapNotNull { it.toLongOrNull() }
    }

    @TypeConverter
    fun fromIntList(value: List<Int>): String = value.joinToString(",")

    @TypeConverter
    fun toIntList(value: String): List<Int> {
        if (value.isEmpty()) return emptyList()
        return value.split(",").mapNotNull { it.toIntOrNull() }
    }
}
