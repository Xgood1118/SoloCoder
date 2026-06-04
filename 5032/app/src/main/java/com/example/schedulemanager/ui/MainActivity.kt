package com.example.schedulemanager.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.schedulemanager.R
import com.example.schedulemanager.databinding.ActivityMainBinding
import com.google.android.material.floatingactionbutton.FloatingActionButton

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var viewModel: ScheduleViewModel
    private lateinit var adapter: ScheduleAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)

        viewModel = ViewModelProvider(
            this,
            ScheduleViewModelFactory(application)
        )[ScheduleViewModel::class.java]

        setupRecyclerView()
        setupFab()

        viewModel.allSchedules.observe(this) { schedules ->
            adapter.submitList(schedules)
            updateEmptyView(schedules.isEmpty())
        }

        requestNotificationPermission()
        viewModel.checkAndRescheduleOverdue()
    }

    private fun setupRecyclerView() {
        adapter = ScheduleAdapter(
            onEditClick = { schedule ->
                val intent = Intent(this, EditScheduleActivity::class.java)
                intent.putExtra(EditScheduleActivity.EXTRA_SCHEDULE_ID, schedule.id)
                startActivity(intent)
            },
            onDeleteClick = { schedule ->
                viewModel.delete(schedule)
            },
            onCompleteChange = { schedule, isChecked ->
                if (isChecked) {
                    viewModel.markAsCompleted(schedule)
                }
            }
        )

        binding.contentMain.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = this@MainActivity.adapter
        }
    }

    private fun setupFab() {
        binding.fabAdd.setOnClickListener {
            val intent = Intent(this, EditScheduleActivity::class.java)
            startActivity(intent)
        }
    }

    private fun updateEmptyView(isEmpty: Boolean) {
        binding.contentMain.tvEmpty.visibility = if (isEmpty) {
            TextView.VISIBLE
        } else {
            TextView.GONE
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
    }
}
