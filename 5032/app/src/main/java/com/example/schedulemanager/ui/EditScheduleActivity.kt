package com.example.schedulemanager.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.ArrayAdapter
import android.widget.CheckBox
import android.widget.Spinner
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import com.example.schedulemanager.R
import com.example.schedulemanager.data.RepeatType
import com.example.schedulemanager.data.Schedule
import com.example.schedulemanager.databinding.ActivityEditScheduleBinding
import com.example.schedulemanager.databinding.ItemReminderBinding
import com.example.schedulemanager.util.DateTimeUtils
import java.util.Calendar

class EditScheduleActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_SCHEDULE_ID = "schedule_id"
    }

    private lateinit var binding: ActivityEditScheduleBinding
    private lateinit var viewModel: ScheduleViewModel

    private var scheduleId: Long? = null
    private val calendar = Calendar.getInstance()
    private val reminderTimes = mutableListOf<Long>()
    private val selectedDays = mutableListOf<Int>()

    private val reminderOptions = listOf(
        5 * 60 * 1000L to "5分钟前",
        15 * 60 * 1000L to "15分钟前",
        30 * 60 * 1000L to "30分钟前",
        60 * 60 * 1000L to "1小时前",
        24 * 60 * 60 * 1000L to "1天前"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityEditScheduleBinding.inflate(layoutInflater)
        setContentView(binding.root)

        viewModel = ViewModelProvider(
            this,
            ScheduleViewModelFactory(application)
        )[ScheduleViewModel::class.java]

        scheduleId = intent.getLongExtra(EXTRA_SCHEDULE_ID, -1).takeIf { it != -1L }

        setupUI()
        setupListeners()

        scheduleId?.let { id ->
            viewModel.getScheduleById(id) { schedule ->
                schedule?.let { populateSchedule(it) }
            }
        }
    }

    private fun setupUI() {
        title = if (scheduleId == null) {
            getString(R.string.add_schedule)
        } else {
            getString(R.string.edit_schedule)
        }

        updateDateTimeButtons()

        val repeatAdapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            listOf("不重复", "每天", "每周", "每月")
        )
        binding.spinnerRepeat.adapter = repeatAdapter

        val dayOfMonthAdapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            (1..31).toList()
        )
        binding.spinnerDayOfMonth.adapter = dayOfMonthAdapter

        setupWeeklyCheckboxes()
    }

    private fun setupWeeklyCheckboxes() {
        val days = listOf(
            Calendar.SUNDAY to "日",
            Calendar.MONDAY to "一",
            Calendar.TUESDAY to "二",
            Calendar.WEDNESDAY to "三",
            Calendar.THURSDAY to "四",
            Calendar.FRIDAY to "五",
            Calendar.SATURDAY to "六"
        )

        for ((dayValue, dayText) in days) {
            val checkBox = CheckBox(this).apply {
                text = dayText
                setOnCheckedChangeListener { _, isChecked ->
                    if (isChecked) {
                        selectedDays.add(dayValue)
                    } else {
                        selectedDays.remove(dayValue)
                    }
                }
            }
            binding.gridDays.addView(checkBox)
        }
    }

    private fun setupListeners() {
        binding.btnDate.setOnClickListener {
            DatePickerDialog(
                this,
                { _, year, month, dayOfMonth ->
                    calendar.set(year, month, dayOfMonth)
                    updateDateTimeButtons()
                },
                calendar.get(Calendar.YEAR),
                calendar.get(Calendar.MONTH),
                calendar.get(Calendar.DAY_OF_MONTH)
            ).show()
        }

        binding.btnTime.setOnClickListener {
            TimePickerDialog(
                this,
                { _, hourOfDay, minute ->
                    calendar.set(Calendar.HOUR_OF_DAY, hourOfDay)
                    calendar.set(Calendar.MINUTE, minute)
                    updateDateTimeButtons()
                },
                calendar.get(Calendar.HOUR_OF_DAY),
                calendar.get(Calendar.MINUTE),
                true
            ).show()
        }

        binding.spinnerRepeat.onItemSelectedListener =
            object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p0: android.widget.AdapterView<*>?, p1: android.view.View?, position: Int, p3: Long) {
                    updateRepeatOptions(position)
                }

                override fun onNothingSelected(p0: android.widget.AdapterView<*>?) {}
            }

        binding.btnAddReminder.setOnClickListener {
            addReminderView()
        }

        binding.btnCancel.setOnClickListener {
            finish()
        }

        binding.btnSave.setOnClickListener {
            saveSchedule()
        }
    }

    private fun updateDateTimeButtons() {
        binding.btnDate.text = DateTimeUtils.formatDate(calendar.timeInMillis)
        binding.btnTime.text = DateTimeUtils.formatTime(calendar.timeInMillis)
    }

    private fun updateRepeatOptions(position: Int) {
        binding.llWeeklyDays.visibility =
            if (position == 2) android.view.View.VISIBLE else android.view.View.GONE
        binding.llMonthlyDay.visibility =
            if (position == 3) android.view.View.VISIBLE else android.view.View.GONE
    }

    private fun addReminderView() {
        val reminderBinding = ItemReminderBinding.inflate(
            LayoutInflater.from(this),
            binding.llRemindersContainer,
            false
        )

        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            reminderOptions.map { it.second }
        )
        reminderBinding.spinnerReminderTime.adapter = adapter

        reminderBinding.btnRemoveReminder.setOnClickListener {
            binding.llRemindersContainer.removeView(reminderBinding.root)
        }

        binding.llRemindersContainer.addView(reminderBinding.root)
    }

    private fun populateSchedule(schedule: Schedule) {
        binding.etTitle.setText(schedule.title)
        binding.etLocation.setText(schedule.location)
        binding.etDescription.setText(schedule.description)

        calendar.timeInMillis = schedule.dateTime
        updateDateTimeButtons()

        val repeatPosition = when (schedule.repeatType) {
            RepeatType.NONE -> 0
            RepeatType.DAILY -> 1
            RepeatType.WEEKLY -> 2
            RepeatType.MONTHLY -> 3
        }
        binding.spinnerRepeat.setSelection(repeatPosition)

        if (schedule.repeatType == RepeatType.WEEKLY) {
            schedule.repeatDaysOfWeek.forEach { day ->
                selectedDays.add(day)
                for (i in 0 until binding.gridDays.childCount) {
                    val checkBox = binding.gridDays.getChildAt(i) as CheckBox
                    if (checkBox.text == getDayText(day)) {
                        checkBox.isChecked = true
                    }
                }
            }
        }

        if (schedule.repeatType == RepeatType.MONTHLY) {
            binding.spinnerDayOfMonth.setSelection(schedule.repeatDayOfMonth - 1)
        }

        schedule.reminderTimes.forEach { time ->
            addReminderView()
            val childCount = binding.llRemindersContainer.childCount
            if (childCount > 0) {
                val lastView = binding.llRemindersContainer.getChildAt(childCount - 1)
                val spinner = lastView.findViewById<Spinner>(R.id.spinner_reminder_time)
                val position = reminderOptions.indexOfFirst { it.first == time }
                if (position >= 0) {
                    spinner.setSelection(position)
                }
            }
        }

        binding.cbNotification.isChecked = schedule.remindWithNotification
        binding.cbVibrate.isChecked = schedule.remindWithVibration
        binding.cbSound.isChecked = schedule.remindWithSound
    }

    private fun getDayText(day: Int): String {
        return when (day) {
            Calendar.SUNDAY -> "日"
            Calendar.MONDAY -> "一"
            Calendar.TUESDAY -> "二"
            Calendar.WEDNESDAY -> "三"
            Calendar.THURSDAY -> "四"
            Calendar.FRIDAY -> "五"
            Calendar.SATURDAY -> "六"
            else -> ""
        }
    }

    private fun saveSchedule() {
        val title = binding.etTitle.text.toString().trim()
        if (title.isEmpty()) {
            Toast.makeText(this, "请输入标题", Toast.LENGTH_SHORT).show()
            return
        }

        reminderTimes.clear()
        for (i in 0 until binding.llRemindersContainer.childCount) {
            val view = binding.llRemindersContainer.getChildAt(i)
            val spinner = view.findViewById<Spinner>(R.id.spinner_reminder_time)
            val position = spinner.selectedItemPosition
            reminderTimes.add(reminderOptions[position].first)
        }

        val repeatType = when (binding.spinnerRepeat.selectedItemPosition) {
            0 -> RepeatType.NONE
            1 -> RepeatType.DAILY
            2 -> RepeatType.WEEKLY
            3 -> RepeatType.MONTHLY
            else -> RepeatType.NONE
        }

        val schedule = Schedule(
            id = scheduleId ?: 0,
            title = title,
            description = binding.etDescription.text.toString().trim(),
            location = binding.etLocation.text.toString().trim(),
            dateTime = calendar.timeInMillis,
            repeatType = repeatType,
            repeatDaysOfWeek = selectedDays.toList(),
            repeatDayOfMonth = binding.spinnerDayOfMonth.selectedItemPosition + 1,
            reminderTimes = reminderTimes.toList(),
            remindWithNotification = binding.cbNotification.isChecked,
            remindWithVibration = binding.cbVibrate.isChecked,
            remindWithSound = binding.cbSound.isChecked
        )

        if (scheduleId == null) {
            viewModel.insert(schedule)
        } else {
            viewModel.update(schedule)
        }

        finish()
    }
}
