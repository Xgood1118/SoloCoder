<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">会议室管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        新增会议室
      </el-button>
    </div>

    <el-card class="search-form">
      <el-form :model="searchForm" inline @submit.prevent>
        <el-form-item label="会议室编号">
          <el-input v-model="searchForm.roomNumber" placeholder="请输入编号" clearable />
        </el-form-item>
        <el-form-item label="会议室名称">
          <el-input v-model="searchForm.roomName" placeholder="请输入名称" clearable />
        </el-form-item>
        <el-form-item label="位置">
          <el-input v-model="searchForm.location" placeholder="请输入位置" clearable />
        </el-form-item>
        <el-form-item label="周末开放">
          <el-select v-model="searchForm.weekendAvailable" placeholder="请选择" clearable>
            <el-option :value="true" label="是" />
            <el-option :value="false" label="否" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option :value="1" label="启用" />
            <el-option :value="0" label="停用" />
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
        <el-table-column prop="roomNumber" label="会议室编号" width="120" />
        <el-table-column prop="roomName" label="会议室名称" width="140" />
        <el-table-column prop="capacity" label="容纳人数" width="100" align="center" />
        <el-table-column prop="location" label="位置" min-width="150" />
        <el-table-column label="开放时间" width="180">
          <template #default="{ row }">
            {{ row.openTime ? row.openTime.substring(0, 5) : '-' }} ~ {{ row.closeTime ? row.closeTime.substring(0, 5) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="周末开放" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.weekendAvailable ? 'success' : 'info'" size="small">
              {{ formatWeekendAvailable(row.weekendAvailable) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="formatStatus(row.status).type" size="small">
              {{ formatStatus(row.status).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewEquipment(row)">
              <el-icon><Cpu /></el-icon>
              设备
            </el-button>
            <el-button type="primary" link size="small" @click="handleEdit(row)">
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
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      destroy-on-close
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="会议室编号" prop="roomNumber">
          <el-input v-model="form.roomNumber" :disabled="isEdit" placeholder="请输入会议室编号" />
        </el-form-item>
        <el-form-item label="会议室名称" prop="roomName">
          <el-input v-model="form.roomName" placeholder="请输入会议室名称" />
        </el-form-item>
        <el-form-item label="容纳人数" prop="capacity">
          <el-input-number v-model="form.capacity" :min="1" :max="500" />
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="form.location" placeholder="请输入位置" />
        </el-form-item>
        <el-form-item label="开放时间">
          <el-time-picker
            v-model="timeRange"
            range
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="HH:mm"
            value-format="HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="周末开放" prop="weekendAvailable">
          <el-switch v-model="form.weekendAvailable" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="equipmentDialogVisible"
      title="会议室设备"
      width="700px"
    >
      <div v-if="currentRoom">
        <p class="mb-20">
          <strong>会议室：</strong>{{ currentRoom.roomName }} ({{ currentRoom.roomNumber }})
        </p>
        <el-table :data="equipmentList" border stripe v-loading="equipmentLoading">
          <el-table-column prop="equipmentCode" label="设备编号" width="120" />
          <el-table-column prop="equipmentName" label="设备名称" width="140" />
          <el-table-column prop="equipmentType" label="设备类型" width="120" />
          <el-table-column label="锁定状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="formatLockStatus(row.locked).type" size="small">
                {{ formatLockStatus(row.locked).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="formatStatus(row.status).type" size="small">
                {{ formatStatus(row.status).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="150" />
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatWeekendAvailable, formatStatus, formatLockStatus } from '@/utils/format'
import {
  getMeetingRoomList,
  createMeetingRoom,
  updateMeetingRoom,
  deleteMeetingRoom
} from '@/api/meetingRoom'
import { getEquipmentByRoomId } from '@/api/equipment'

const router = useRouter()
const loading = ref(false)
const dialogVisible = ref(false)
const equipmentDialogVisible = ref(false)
const equipmentLoading = ref(false)
const formRef = ref(null)
const isEdit = ref(false)
const currentRoom = ref(null)
const equipmentList = ref([])

const searchForm = reactive({
  roomNumber: '',
  roomName: '',
  location: '',
  weekendAvailable: null,
  status: null,
  pageNum: 1,
  pageSize: 10
})

const tableData = reactive({
  total: 0,
  records: []
})

const form = reactive({
  id: null,
  roomNumber: '',
  roomName: '',
  capacity: 10,
  location: '',
  openTime: null,
  closeTime: null,
  weekendAvailable: false,
  status: 1,
  description: ''
})

const timeRange = ref([])

const formRules = {
  roomNumber: [{ required: true, message: '请输入会议室编号', trigger: 'blur' }],
  roomName: [{ required: true, message: '请输入会议室名称', trigger: 'blur' }],
  capacity: [{ required: true, message: '请输入容纳人数', trigger: 'blur' }]
}

const dialogTitle = computed(() => isEdit.value ? '编辑会议室' : '新增会议室')

async function loadData() {
  loading.value = true
  try {
    const data = await getMeetingRoomList(searchForm)
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
  searchForm.roomNumber = ''
  searchForm.roomName = ''
  searchForm.location = ''
  searchForm.weekendAvailable = null
  searchForm.status = null
  searchForm.pageNum = 1
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

function handleAdd() {
  isEdit.value = false
  Object.assign(form, {
    id: null,
    roomNumber: '',
    roomName: '',
    capacity: 10,
    location: '',
    openTime: null,
    closeTime: null,
    weekendAvailable: false,
    status: 1,
    description: ''
  })
  timeRange.value = []
  dialogVisible.value = true
}

function handleEdit(row) {
  isEdit.value = true
  Object.assign(form, row)
  if (form.openTime && form.closeTime) {
    timeRange.value = [form.openTime, form.closeTime]
  } else {
    timeRange.value = []
  }
  dialogVisible.value = true
}

async function handleViewEquipment(row) {
  currentRoom.value = row
  equipmentDialogVisible.value = true
  equipmentLoading.value = true
  try {
    equipmentList.value = await getEquipmentByRoomId(row.id)
  } finally {
    equipmentLoading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除会议室"${row.roomName}"吗？`, '删除确认', {
      type: 'warning'
    })
    await deleteMeetingRoom(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  if (timeRange.value && timeRange.value.length === 2) {
    form.openTime = timeRange.value[0]
    form.closeTime = timeRange.value[1]
  }
  try {
    if (isEdit.value) {
      await updateMeetingRoom(form.id, form)
      ElMessage.success('更新成功')
    } else {
      await createMeetingRoom(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('提交失败:', error)
  }
}

onMounted(() => {
  loadData()
})
</script>
