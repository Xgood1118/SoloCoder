<template>
  <div class="dashboard">
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #409eff">
              <el-icon><OfficeBuilding /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.roomCount }}</div>
              <div class="stat-label">会议室总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #67c23a">
              <el-icon><Cpu /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.equipmentCount }}</div>
              <div class="stat-label">设备总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e6a23c">
              <el-icon><Calendar /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.todayReservationCount }}</div>
              <div class="stat-label">今日预定</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #f56c6c">
              <el-icon><Lock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.lockedEquipmentCount }}</div>
              <div class="stat-label">锁定设备</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>本周预定统计</span>
            </div>
          </template>
          <div ref="chartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最新预定记录</span>
              <el-button type="primary" link @click="$router.push('/reservations')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentReservations" size="small">
            <el-table-column prop="roomName" label="会议室" width="120" />
            <el-table-column prop="meetingTopic" label="会议主题" />
            <el-table-column prop="reserverName" label="预定人" width="100" />
            <el-table-column label="时间" width="200">
              <template #default="{ row }">
                {{ formatTimeRange(row.startTime, row.endTime) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="formatReservationStatus(row.status).type" size="small">
                  {{ formatReservationStatus(row.status).text }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'
import { formatTimeRange, formatReservationStatus } from '@/utils/format'
import { getMeetingRoomList } from '@/api/meetingRoom'
import { getEquipmentList } from '@/api/equipment'
import { getReservationList } from '@/api/reservation'

const chartRef = ref(null)
let chartInstance = null

const stats = ref({
  roomCount: 0,
  equipmentCount: 0,
  todayReservationCount: 0,
  lockedEquipmentCount: 0
})

const recentReservations = ref([])

function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: [12, 15, 8, 20, 18, 5, 3],
      type: 'bar',
      itemStyle: {
        color: '#409eff'
      }
    }]
  }
  chartInstance.setOption(option)
}

async function loadStats() {
  try {
    const [roomData, equipmentData, reservationData] = await Promise.all([
      getMeetingRoomList({ pageNum: 1, pageSize: 1 }),
      getEquipmentList({ pageNum: 1, pageSize: 1 }),
      getReservationList({ pageNum: 1, pageSize: 5, status: 1 })
    ])
    stats.value.roomCount = roomData.total
    stats.value.equipmentCount = equipmentData.total
    recentReservations.value = reservationData.records || []
    const lockedData = await getEquipmentList({ locked: true, pageNum: 1, pageSize: 1 })
    stats.value.lockedEquipmentCount = lockedData.total
    const todayData = await getReservationList({ pageNum: 1, pageSize: 1 })
    stats.value.todayReservationCount = todayData.total
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

onMounted(() => {
  initChart()
  loadStats()
})
</script>

<style scoped lang="scss">
.dashboard {
  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;

      .stat-icon {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 28px;
      }

      .stat-info {
        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: #303133;
        }

        .stat-label {
          font-size: 14px;
          color: #909399;
          margin-top: 4px;
        }
      }
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
