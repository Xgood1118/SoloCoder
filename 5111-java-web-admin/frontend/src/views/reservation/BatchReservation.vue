<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">批量预定</h2>
      <el-button @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
    </div>

    <el-card class="form-container">
      <h3 class="mb-20">第一步：设置公共条件</h3>
      <el-form :model="commonForm" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="预定时间" required>
              <el-date-picker
                v-model="commonForm.timeRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm:ss"
                :shortcuts="timeShortcuts"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="重复周期">
              <el-select v-model="commonForm.repeatType" placeholder="选择重复方式" style="width: 100%">
                <el-option value="none" label="不重复" />
                <el-option value="daily" label="每天" />
                <el-option value="weekly" label="每周" />
                <el-option value="workday" label="工作日" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20" v-if="commonForm.repeatType !== 'none'">
          <el-col :span="12">
            <el-form-item label="结束日期">
              <el-date-picker
                v-model="commonForm.endDate"
                type="date"
                placeholder="选择结束日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="选择会议室" required>
          <el-select
            v-model="commonForm.roomIds"
            multiple
            filterable
            placeholder="请选择多个会议室"
            style="width: 100%"
          >
            <el-option
              v-for="room in roomStore.roomList"
              :key="room.id"
              :label="`${room.roomName} (${room.roomNumber} - 容纳${room.capacity}人)`"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预定人" required>
          <el-input v-model="commonForm.reserverName" placeholder="请输入预定人姓名" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="generateReservations">
            <el-icon><Plus /></el-icon>
            生成预定列表
          </el-button>
          <el-button @click="clearAll">
            <el-icon><Delete /></el-icon>
            清空
          </el-button>
        </el-form-item>
      </el-form>

      <el-divider />

      <h3 class="mb-20">第二步：确认预定列表</h3>
      <div v-if="reservationList.length === 0" class="empty-tip">
        <el-empty description="请先设置公共条件并生成预定列表" />
      </div>
      <div v-else>
        <el-alert
          :title="`共生成 ${reservationList.length} 条预定记录，确认无误后点击提交`"
          type="info"
          show-icon
          class="mb-20"
        />
        <el-table :data="reservationList" border stripe>
          <el-table-column label="序号" type="index" width="60" align="center" />
          <el-table-column label="会议室" width="140">
            <template #default="{ row }">
              {{ getRoomName(row.roomId) }}
            </template>
          </el-table-column>
          <el-table-column label="预定时间" width="300">
            <template #default="{ row }">
              {{ formatTimeRange(row.startTime, row.endTime) }}
            </template>
          </el-table-column>
          <el-table-column label="预定人" width="100">
            <template #default="{ row }">
              <el-input v-model="row.reserverName" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="会议主题">
            <template #default="{ row }">
              <el-input v-model="row.meetingTopic" size="small" placeholder="请输入会议主题" />
            </template>
          </el-table-column>
          <el-table-column label="参会人数" width="120" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.participants" size="small" :min="1" :max="500" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button type="danger" link size="small" @click="removeItem($index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="mt-20 text-right">
          <el-button type="success" :loading="submitting" @click="handleBatchSubmit">
            <el-icon><Check /></el-icon>
            提交批量预定
          </el-button>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="resultDialogVisible"
      title="批量预定结果"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-alert
        :title="`成功 ${batchResult.successCount} 条，失败 ${batchResult.failCount} 条，总计 ${batchResult.totalCount} 条`"
        :type="batchResult.failCount > 0 ? 'warning' : 'success'"
        show-icon
        class="mb-20"
      />
      <div v-if="batchResult.failCount > 0">
        <h4 class="mb-20">失败详情：</h4>
        <el-table :data="batchResult.failItems" border stripe size="small">
          <el-table-column label="序号" width="80">
            <template #default="{ row }">
              第 {{ row.index + 1 }} 条
            </template>
          </el-table-column>
          <el-table-column label="会议室" width="140">
            <template #default="{ row }">
              {{ getRoomName(row.reservation.roomId) }}
            </template>
          </el-table-column>
          <el-table-column label="预定时间" width="300">
            <template #default="{ row }">
              {{ formatTimeRange(row.reservation.startTime, row.reservation.endTime) }}
            </template>
          </el-table-column>
          <el-table-column label="错误原因" prop="errorMessage" />
        </el-table>
      </div>
      <template #footer>
        <el-button type="primary" @click="resultDialogVisible = false; $router.push('/reservations')">
          查看预定列表
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { useMeetingRoomStore } from '@/stores/meetingRoom'
import { formatTimeRange } from '@/utils/format'
import { batchCreateReservation } from '@/api/reservation'

const router = useRouter()
const roomStore = useMeetingRoomStore()

const submitting = ref(false)
const resultDialogVisible = ref(false)

const commonForm = reactive({
  timeRange: [],
  repeatType: 'none',
  endDate: null,
  roomIds: [],
  reserverName: ''
})

const reservationList = ref([])
const batchResult = ref({
  totalCount: 0,
  successCount: 0,
  failCount: 0,
  successReservations: [],
  failItems: []
})

const timeShortcuts = [
  {
    text: '每天上午9:00-10:00',
    value: () => {
      const start = new Date()
      start.setHours(9, 0, 0, 0)
      const end = new Date()
      end.setHours(10, 0, 0, 0)
      return [start, end]
    }
  },
  {
    text: '每天下午14:00-15:00',
    value: () => {
      const start = new Date()
      start.setHours(14, 0, 0, 0)
      const end = new Date()
      end.setHours(15, 0, 0, 0)
      return [start, end]
    }
  }
]

function getRoomName(roomId) {
  const room = roomStore.getRoomById(roomId)
  return room ? room.roomName : '未知'
}

function generateReservations() {
  if (!commonForm.timeRange || commonForm.timeRange.length !== 2) {
    ElMessage.warning('请选择预定时间')
    return
  }
  if (commonForm.roomIds.length === 0) {
    ElMessage.warning('请选择会议室')
    return
  }
  if (!commonForm.reserverName) {
    ElMessage.warning('请输入预定人姓名')
    return
  }

  const startTime = commonForm.timeRange[0]
  const endTime = commonForm.timeRange[1]
  const dates = generateDateList()

  const list = []
  for (const date of dates) {
    for (const roomId of commonForm.roomIds) {
      list.push({
        roomId,
        startTime: dayjs(date).hour(dayjs(startTime).hour()).minute(dayjs(startTime).minute()).second(0).format('YYYY-MM-DD HH:mm:ss'),
        endTime: dayjs(date).hour(dayjs(endTime).hour()).minute(dayjs(endTime).minute()).second(0).format('YYYY-MM-DD HH:mm:ss'),
        reserverName: commonForm.reserverName,
        reserverPhone: '',
        meetingTopic: '',
        participants: 1
      })
    }
  }

  if (list.length === 0) {
    ElMessage.warning('没有生成任何预定，请检查条件')
    return
  }

  reservationList.value = list
  ElMessage.success(`成功生成 ${list.length} 条预定记录`)
}

function generateDateList() {
  const dates = []
  const startDate = dayjs(commonForm.timeRange[0]).startOf('day')

  if (commonForm.repeatType === 'none') {
    dates.push(startDate.toDate())
    return dates
  }

  if (!commonForm.endDate) {
    ElMessage.warning('请选择结束日期')
    return dates
  }

  const endDate = dayjs(commonForm.endDate).startOf('day')
  let current = startDate

  while (current.isBefore(endDate) || current.isSame(endDate)) {
    const dayOfWeek = current.day()

    if (commonForm.repeatType === 'daily') {
      dates.push(current.toDate())
    } else if (commonForm.repeatType === 'weekly') {
      if (dayOfWeek === startDate.day()) {
        dates.push(current.toDate())
      }
    } else if (commonForm.repeatType === 'workday') {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(current.toDate())
      }
    }

    current = current.add(1, 'day')
  }

  return dates
}

function removeItem(index) {
  reservationList.value.splice(index, 1)
}

function clearAll() {
  commonForm.timeRange = []
  commonForm.repeatType = 'none'
  commonForm.endDate = null
  commonForm.roomIds = []
  commonForm.reserverName = ''
  reservationList.value = []
}

async function handleBatchSubmit() {
  if (reservationList.value.length === 0) {
    ElMessage.warning('没有预定记录可提交')
    return
  }

  const invalid = reservationList.value.some(r => !r.reserverName)
  if (invalid) {
    ElMessage.warning('请填写所有预定记录的预定人姓名')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要提交 ${reservationList.value.length} 条预定记录吗？`,
      '提交确认',
      { type: 'warning' }
    )
  } catch {
    return
  }

  submitting.value = true
  try {
    const data = await batchCreateReservation({
      reservations: reservationList.value,
      operator: commonForm.reserverName
    })
    batchResult.value = data
    resultDialogVisible.value = true

    if (data.failCount === 0) {
      ElMessage.success('批量预定全部成功')
    } else {
      ElMessage.warning(`批量预定部分成功，失败 ${data.failCount} 条`)
    }
  } catch (error) {
    console.error('批量预定失败:', error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  roomStore.loadRooms()
})
</script>

<style scoped lang="scss">
.empty-tip {
  padding: 40px 0;
}
</style>
