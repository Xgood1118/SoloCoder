<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">预定管理</h2>
      <div>
        <el-button type="success" @click="$router.push('/reservations/batch')">
          <el-icon><Tickets /></el-icon>
          批量预定
        </el-button>
        <el-button type="primary" @click="$router.push('/reservations/create')">
          <el-icon><Plus /></el-icon>
          新增预定
        </el-button>
      </div>
    </div>

    <el-card class="search-form">
      <el-form :model="searchForm" inline @submit.prevent>
        <el-form-item label="会议室">
          <el-select v-model="searchForm.roomId" placeholder="请选择" clearable filterable>
            <el-option
              v-for="room in roomStore.roomList"
              :key="room.id"
              :label="room.roomName"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预定人">
          <el-input v-model="searchForm.reserverName" placeholder="请输入预定人" clearable />
        </el-form-item>
        <el-form-item label="会议主题">
          <el-input v-model="searchForm.meetingTopic" placeholder="请输入主题" clearable />
        </el-form-item>
        <el-form-item label="预定时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option :value="0" label="待确认" />
            <el-option :value="1" label="已确认" />
            <el-option :value="2" label="已取消" />
            <el-option :value="3" label="已完成" />
          </el-select>
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
        <el-table-column prop="roomName" label="会议室" width="120" />
        <el-table-column prop="meetingTopic" label="会议主题" min-width="150" />
        <el-table-column label="预定时间" width="300">
          <template #default="{ row }">
            {{ formatTimeRange(row.startTime, row.endTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="reserverName" label="预定人" width="100" />
        <el-table-column prop="reserverPhone" label="联系电话" width="130" />
        <el-table-column prop="participants" label="参会人数" width="100" align="center" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="formatReservationStatus(row.status).type" size="small">
              {{ formatReservationStatus(row.status).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 1"
              type="warning"
              link
              size="small"
              @click="handleCancel(row)"
            >
              <el-icon><Close /></el-icon>
              取消
            </el-button>
            <el-button
              v-if="row.status === 1"
              type="primary"
              link
              size="small"
              @click="handleEdit(row)"
            >
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
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

    <el-dialog
      v-model="editDialogVisible"
      title="编辑预定"
      width="600px"
      destroy-on-close
    >
      <el-form :model="editForm" :rules="formRules" ref="editFormRef" label-width="100px">
        <el-form-item label="会议室" prop="roomId">
          <el-select v-model="editForm.roomId" placeholder="请选择会议室" filterable style="width: 100%">
            <el-option
              v-for="room in roomStore.roomList"
              :key="room.id"
              :label="room.roomName"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预定时间" prop="timeRange">
          <el-date-picker
            v-model="editForm.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="预定人" prop="reserverName">
          <el-input v-model="editForm.reserverName" placeholder="请输入预定人姓名" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="editForm.reserverPhone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="会议主题">
          <el-input v-model="editForm.meetingTopic" placeholder="请输入会议主题" />
        </el-form-item>
        <el-form-item label="参会人数">
          <el-input-number v-model="editForm.participants" :min="1" :max="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMeetingRoomStore } from '@/stores/meetingRoom'
import { formatTimeRange, formatReservationStatus } from '@/utils/format'
import {
  getReservationList,
  updateReservation,
  deleteReservation,
  cancelReservation,
  checkConflict
} from '@/api/reservation'

const router = useRouter()
const roomStore = useMeetingRoomStore()

const loading = ref(false)
const editDialogVisible = ref(false)
const editFormRef = ref(null)

const searchForm = reactive({
  roomId: null,
  reserverName: '',
  meetingTopic: '',
  startTime: null,
  endTime: null,
  status: null,
  pageNum: 1,
  pageSize: 10
})

const dateRange = ref([])

const tableData = reactive({
  total: 0,
  records: []
})

const editForm = reactive({
  id: null,
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

async function loadData() {
  loading.value = true
  try {
    const params = { ...searchForm }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startTime = dateRange.value[0]
      params.endTime = dateRange.value[1]
    }
    const data = await getReservationList(params)
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
  searchForm.roomId = null
  searchForm.reserverName = ''
  searchForm.meetingTopic = ''
  searchForm.startTime = null
  searchForm.endTime = null
  searchForm.status = null
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

function handleEdit(row) {
  Object.assign(editForm, {
    id: row.id,
    roomId: row.roomId,
    timeRange: [row.startTime, row.endTime],
    reserverName: row.reserverName,
    reserverPhone: row.reserverPhone,
    meetingTopic: row.meetingTopic,
    participants: row.participants || 1
  })
  editDialogVisible.value = true
}

async function handleEditSubmit() {
  if (!editFormRef.value) return
  await editFormRef.value.validate()
  const submitData = {
    id: editForm.id,
    roomId: editForm.roomId,
    startTime: editForm.timeRange[0],
    endTime: editForm.timeRange[1],
    reserverName: editForm.reserverName,
    reserverPhone: editForm.reserverPhone,
    meetingTopic: editForm.meetingTopic,
    participants: editForm.participants
  }
  try {
    await updateReservation(editForm.id, submitData)
    ElMessage.success('更新成功')
    editDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('更新失败:', error)
  }
}

async function handleCancel(row) {
  try {
    await ElMessageBox.confirm(`确定要取消预定"${row.meetingTopic}"吗？`, '取消确认', {
      type: 'warning'
    })
    await cancelReservation(row.id, '管理员')
    ElMessage.success('取消成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消失败:', error)
    }
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除预定"${row.meetingTopic}"吗？删除后设备将自动解锁。`, '删除确认', {
      type: 'warning'
    })
    await deleteReservation(row.id, '管理员')
    ElMessage.success('删除成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

onMounted(() => {
  roomStore.loadRooms()
  loadData()
})
</script>
