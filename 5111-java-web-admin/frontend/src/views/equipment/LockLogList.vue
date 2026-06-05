<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">设备锁定日志</h2>
    </div>

    <el-card class="search-form">
      <el-form :model="searchForm" inline @submit.prevent>
        <el-form-item label="设备编号">
          <el-input v-model="searchForm.equipmentCode" placeholder="请输入编号" clearable />
        </el-form-item>
        <el-form-item label="设备名称">
          <el-input v-model="searchForm.equipmentName" placeholder="请输入名称" clearable />
        </el-form-item>
        <el-form-item label="锁定类型">
          <el-select v-model="searchForm.lockType" placeholder="请选择" clearable>
            <el-option value="LOCK" label="锁定" />
            <el-option value="UNLOCK" label="解锁" />
            <el-option value="FORCE_UNLOCK" label="强制解锁" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="searchForm.operator" placeholder="请输入操作人" clearable />
        </el-form-item>
        <el-form-item label="操作时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-container">
      <el-table :data="tableData.records" border stripe v-loading="loading">
        <el-table-column prop="equipmentCode" label="设备编号" width="120" />
        <el-table-column prop="equipmentName" label="设备名称" width="140" />
        <el-table-column label="锁定类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="formatLockType(row.lockType).type" size="small">
              {{ formatLockType(row.lockType).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="锁定时间范围" width="300">
          <template #default="{ row }">
            {{ formatTimeRange(row.startTime, row.endTime) || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="operatorIp" label="操作IP" width="130" />
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="mt-20"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="tableData.total"
        :current-page="searchForm.pageNum"
        :page-size="searchForm.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { formatLockType, formatDateTime, formatTimeRange } from '@/utils/format'
import { getLockLogList } from '@/api/lockLog'

const loading = ref(false)

const searchForm = reactive({
  equipmentCode: '',
  equipmentName: '',
  lockType: '',
  operator: '',
  startTime: null,
  endTime: null,
  pageNum: 1,
  pageSize: 10
})

const dateRange = ref([])

const tableData = reactive({
  total: 0,
  records: []
})

async function loadData() {
  loading.value = true
  try {
    const params = { ...searchForm }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startTime = dateRange.value[0]
      params.endTime = dateRange.value[1]
    }
    const data = await getLockLogList(params)
    tableData.total = data.total
    tableData.records = data.records
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  searchForm.pageNum = 1
  loadData()
}

function handleReset() {
  searchForm.equipmentCode = ''
  searchForm.equipmentName = ''
  searchForm.lockType = ''
  searchForm.operator = ''
  searchForm.startTime = null
  searchForm.endTime = null
  searchForm.pageNum = 1
  dateRange.value = []
  loadData()
}

function handleSizeChange(size) {
  searchForm.pageSize = size
  loadData()
}

function handlePageChange(page) {
  searchForm.pageNum = page
  loadData()
}

loadData()
</script>
