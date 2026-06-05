<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">创建预定</h2>
      <el-button @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
    </div>

    <el-card class="form-container">
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="120px">
        <el-form-item label="选择会议室" prop="roomId">
          <el-select
            v-model="form.roomId"
            placeholder="请选择会议室"
            filterable
            style="width: 100%"
            @change="onRoomChange"
          >
            <el-option
              v-for="room in roomStore.roomList"
              :key="room.id"
              :label="`${room.roomName} (${room.roomNumber} - 容纳${room.capacity}人)`"
              :value="room.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="选择时间" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm:ss"
            :shortcuts="timeShortcuts"
            style="width: 100%"
            @change="onTimeChange"
          />
        </el-form-item>

        <el-form-item label="查询可用">
          <el-button type="success" @click="checkAvailableRooms" :disabled="!canCheckAvailable">
            <el-icon><Search /></el-icon>
            查询可用会议室
          </el-button>
        </el-form-item>

        <div v-if="availableRooms.length > 0" class="mb-20">
          <h4 class="mb-20">可用会议室列表：</h4>
          <el-row :gutter="20">
            <el-col :span="8" v-for="room in availableRooms" :key="room.id">
              <el-card class="room-card" :class="{ 'is-selected': form.roomId === room.id }">
                <div class="room-info">
                  <div class="room-name">{{ room.roomName }}</div>
                  <div class="room-number">{{ room.roomNumber }}</div>
                  <div class="room-detail">容纳: {{ room.capacity }}人 | {{ room.location }}</div>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  @click="selectRoom(room)"
                  :disabled="form.roomId === room.id"
                >
                  {{ form.roomId === room.id ? '已选择' : '选择' }}
                </el-button>
              </el-card>
            </el-col>
          </el-row>
        </div>

        <el-form-item v-if="selectedRoomEquipment.length > 0" label="包含设备">
          <el-tag
            v-for="equip in selectedRoomEquipment"
            :key="equip.id"
            class="status-tag"
            type="info"
          >
            {{ equip.equipmentName }}
          </el-tag>
          <div class="tip-text">
            <el-icon><InfoFilled /></el-icon>
            预定成功后，以上设备将自动锁定至会议结束
          </div>
        </el-form-item>

        <el-form-item v-if="conflictResult && conflictResult.conflict" label-width="0">
          <el-alert
            :title="'预定冲突：' + conflictResult.message"
            type="error"
            show-icon
          >
            <div v-for="(r, index) in conflictResult.conflictingReservations" :key="index">
              <p>
                <strong>冲突预定 {{ index + 1 }}:</strong>
                {{ r.roomName }} - {{ r.meetingTopic }}
                ({{ formatTimeRange(r.startTime, r.endTime) }})
                预定人: {{ r.reserverName }}
              </p>
            </div>
          </el-alert>
        </el-form-item>

        <el-form-item label="预定人姓名" prop="reserverName">
          <el-input v-model="form.reserverName" placeholder="请输入预定人姓名" />
        </el-form-item>

        <el-form-item label="联系电话">
          <el-input v-model="form.reserverPhone" placeholder="请输入联系电话" />
        </el-form-item>

        <el-form-item label="会议主题">
          <el-input v-model="form.meetingTopic" placeholder="请输入会议主题" />
        </el-form-item>

        <el-form-item label="参会人数">
          <el-input-number v-model="form.participants" :min="1" :max="500" />
        </el-form-item>

        <el-form-item label-width="0">
          <el-button type="primary" @click="checkConflictBeforeSubmit">
            <el-icon><Warning /></el-icon>
            检测冲突
          </el-button>
          <el-button type="success" @click="handleSubmit" :disabled="conflictResult?.conflict">
            <el-icon><Check /></el-icon>
            提交预定
          </el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMeetingRoomStore } from '@/stores/meetingRoom'
import { formatTimeRange } from '@/utils/format'
import { getAvailableRoomsWithFilter } from '@/api/meetingRoom'
import { checkConflict, createReservation } from '@/api/reservation'
import { getEquipmentByRoomId } from '@/api/equipment'

const router = useRouter()
const roomStore = useMeetingRoomStore()
const formRef = ref(null)

const form = reactive({
  roomId: null,
  timeRange: [],
  reserverName: '',
  reserverPhone: '',
  meetingTopic: '',
  participants: 1
})

const formRules = {
  roomId: [{ required: true, message: '请选择会议室', trigger: 'change' }],
  timeRange: [{ required: true, message: '请选择预定时间', trigger: 'change' }],
  reserverName: [{ required: true, message: '请输入预定人姓名', trigger: 'blur' }]
}

const availableRooms = ref([])
const selectedRoomEquipment = ref([])
const conflictResult = ref(null)

const timeShortcuts = [
  {
    text: '今天上午',
    value: () => {
      const start = new Date()
      start.setHours(9, 0, 0, 0)
      const end = new Date()
      end.setHours(12, 0, 0, 0)
      return [start, end]
    }
  },
  {
    text: '今天下午',
    value: () => {
      const start = new Date()
      start.setHours(14, 0, 0, 0)
      const end = new Date()
      end.setHours(18, 0, 0, 0)
      return [start, end]
    }
  },
  {
    text: '明天全天',
    value: () => {
      const start = new Date()
      start.setDate(start.getDate() + 1)
      start.setHours(9, 0, 0, 0)
      const end = new Date()
      end.setDate(end.getDate() + 1)
      end.setHours(18, 0, 0, 0)
      return [start, end]
    }
  }
]

const canCheckAvailable = computed(() => {
  return form.timeRange && form.timeRange.length === 2
})

async function checkAvailableRooms() {
  if (!canCheckAvailable.value) {
    ElMessage.warning('请先选择时间范围')
    return
  }
  try {
    const data = await getAvailableRoomsWithFilter({
      startTime: form.timeRange[0],
      endTime: form.timeRange[1]
    })
    availableRooms.value = data
    if (data.length === 0) {
      ElMessage.warning('该时间段没有可用的会议室')
    } else {
      ElMessage.success(`找到 ${data.length} 个可用会议室`)
    }
  } catch (error) {
    console.error('查询可用会议室失败:', error)
  }
}

function selectRoom(room) {
  form.roomId = room.id
  onRoomChange(room.id)
}

async function onRoomChange(roomId) {
  conflictResult.value = null
  if (roomId) {
    try {
      selectedRoomEquipment.value = await getEquipmentByRoomId(roomId)
    } catch (error) {
      console.error('获取会议室设备失败:', error)
      selectedRoomEquipment.value = []
    }
  } else {
    selectedRoomEquipment.value = []
  }
}

function onTimeChange() {
  conflictResult.value = null
  if (form.roomId) {
    checkAvailableRooms()
  }
}

async function checkConflictBeforeSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    const data = await checkConflict({
      roomId: form.roomId,
      startTime: form.timeRange[0],
      endTime: form.timeRange[1]
    })
    conflictResult.value = data
    if (data.conflict) {
      ElMessage.error('存在预定冲突，请重新选择时间或会议室')
    } else {
      ElMessage.success('该时间段可用，可以提交预定')
    }
  } catch (error) {
    console.error('冲突检测失败:', error)
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  if (conflictResult.value?.conflict) {
    ElMessage.error('存在预定冲突，无法提交')
    return
  }
  if (!conflictResult.value) {
    await checkConflictBeforeSubmit()
    if (conflictResult.value?.conflict) {
      return
    }
  }
  const submitData = {
    roomId: form.roomId,
    startTime: form.timeRange[0],
    endTime: form.timeRange[1],
    reserverName: form.reserverName,
    reserverPhone: form.reserverPhone,
    meetingTopic: form.meetingTopic,
    participants: form.participants
  }
  try {
    await createReservation(submitData)
    ElMessage.success('预定成功，关联设备已自动锁定')
    router.push('/reservations')
  } catch (error) {
    console.error('提交预定失败:', error)
  }
}

onMounted(() => {
  roomStore.loadRooms()
})
</script>

<style scoped lang="scss">
.room-card {
  margin-bottom: 20px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.is-selected {
    border: 2px solid #409eff;

    :deep(.el-card__body) {
      background-color: #ecf5ff;
    }
  }

  .room-info {
    margin-bottom: 12px;

    .room-name {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 4px;
    }

    .room-number {
      font-size: 13px;
      color: #909399;
      margin-bottom: 4px;
    }

    .room-detail {
      font-size: 12px;
      color: #606266;
    }
  }
}

.tip-text {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
