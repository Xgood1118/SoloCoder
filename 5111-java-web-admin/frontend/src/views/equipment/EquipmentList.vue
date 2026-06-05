<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">设备管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        新增设备
      </el-button>
    </div>

    <el-card class="search-form">
      <el-form :model="searchForm" inline @submit.prevent>
        <el-form-item label="设备编号">
          <el-input v-model="searchForm.equipmentCode" placeholder="请输入编号" clearable />
        </el-form-item>
        <el-form-item label="设备名称">
          <el-input v-model="searchForm.equipmentName" placeholder="请输入名称" clearable />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-input v-model="searchForm.equipmentType" placeholder="请输入类型" clearable />
        </el-form-item>
        <el-form-item label="绑定会议室">
          <el-select v-model="searchForm.roomId" placeholder="请选择" clearable filterable>
            <el-option
              v-for="room in roomStore.roomList"
              :key="room.id"
              :label="room.roomName"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="仅未绑定">
          <el-switch v-model="searchForm.unboundOnly" />
        </el-form-item>
        <el-form-item label="锁定状态">
          <el-select v-model="searchForm.locked" placeholder="请选择" clearable>
            <el-option :value="true" label="已锁定" />
            <el-option :value="false" label="未锁定" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option :value="1" label="正常" />
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
        <el-table-column prop="equipmentCode" label="设备编号" width="120" />
        <el-table-column prop="equipmentName" label="设备名称" width="140" />
        <el-table-column prop="equipmentType" label="设备类型" width="120" />
        <el-table-column label="绑定会议室" width="140">
          <template #default="{ row }">
            {{ row.roomName || '未绑定' }}
          </template>
        </el-table-column>
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
        <el-table-column label="操作" width="280" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.locked"
              type="warning"
              link
              size="small"
              @click="handleForceUnlock(row)"
            >
              <el-icon><Unlock /></el-icon>
              强制解锁
            </el-button>
            <el-button
              v-if="!row.roomId && !row.locked"
              type="success"
              link
              size="small"
              @click="handleBind(row)"
            >
              <el-icon><Link /></el-icon>
              绑定
            </el-button>
            <el-button
              v-if="row.roomId && !row.locked"
              type="info"
              link
              size="small"
              @click="handleUnbind(row)"
            >
              <el-icon><Close /></el-icon>
              解绑
            </el-button>
            <el-button type="primary" link size="small" @click="handleEdit(row)" :disabled="row.locked">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)" :disabled="row.locked">
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
      width="500px"
      destroy-on-close
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="设备编号" prop="equipmentCode">
          <el-input v-model="form.equipmentCode" :disabled="isEdit" placeholder="请输入设备编号" />
        </el-form-item>
        <el-form-item label="设备名称" prop="equipmentName">
          <el-input v-model="form.equipmentName" placeholder="请输入设备名称" />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select v-model="form.equipmentType" placeholder="请选择设备类型" clearable>
            <el-option label="投影仪" value="投影仪" />
            <el-option label="音响" value="音响" />
            <el-option label="麦克风" value="麦克风" />
            <el-option label="白板" value="白板" />
            <el-option label="视频会议" value="视频会议" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="绑定会议室">
          <el-select v-model="form.roomId" placeholder="请选择会议室" clearable filterable>
            <el-option
              v-for="room in roomStore.roomList"
              :key="room.id"
              :label="room.roomName"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">正常</el-radio>
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

    <el-dialog v-model="bindDialogVisible" title="绑定会议室" width="400px">
      <el-form label-width="100px">
        <el-form-item label="当前设备">
          <span>{{ bindForm.equipmentName }} ({{ bindForm.equipmentCode }})</span>
        </el-form-item>
        <el-form-item label="选择会议室" prop="roomId">
          <el-select
            v-model="bindForm.roomId"
            placeholder="请选择会议室"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="room in roomStore.roomList"
              :key="room.id"
              :label="room.roomName"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBindSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMeetingRoomStore } from '@/stores/meetingRoom'
import { formatStatus, formatLockStatus } from '@/utils/format'
import {
  getEquipmentList,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  bindEquipmentToRoom,
  unbindEquipment,
  forceUnlockEquipment
} from '@/api/equipment'

const roomStore = useMeetingRoomStore()

const loading = ref(false)
const dialogVisible = ref(false)
const bindDialogVisible = ref(false)
const formRef = ref(null)
const isEdit = ref(false)

const searchForm = reactive({
  equipmentCode: '',
  equipmentName: '',
  equipmentType: '',
  roomId: null,
  unboundOnly: false,
  locked: null,
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
  equipmentCode: '',
  equipmentName: '',
  equipmentType: '',
  roomId: null,
  status: 1,
  description: ''
})

const bindForm = reactive({
  id: null,
  equipmentCode: '',
  equipmentName: '',
  roomId: null
})

const formRules = {
  equipmentCode: [{ required: true, message: '请输入设备编号', trigger: 'blur' }],
  equipmentName: [{ required: true, message: '请输入设备名称', trigger: 'blur' }]
}

const dialogTitle = computed(() => isEdit.value ? '编辑设备' : '新增设备')

async function loadData() {
  loading.value = true
  try {
    const data = await getEquipmentList(searchForm)
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
  searchForm.equipmentType = ''
  searchForm.roomId = null
  searchForm.unboundOnly = false
  searchForm.locked = null
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
    equipmentCode: '',
    equipmentName: '',
    equipmentType: '',
    roomId: null,
    status: 1,
    description: ''
  })
  dialogVisible.value = true
}

function handleEdit(row) {
  isEdit.value = true
  Object.assign(form, row)
  dialogVisible.value = true
}

async function handleBind(row) {
  Object.assign(bindForm, row)
  bindForm.roomId = null
  bindDialogVisible.value = true
}

async function handleBindSubmit() {
  if (!bindForm.roomId) {
    ElMessage.warning('请选择会议室')
    return
  }
  try {
    await bindEquipmentToRoom(bindForm.id, bindForm.roomId)
    ElMessage.success('绑定成功')
    bindDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('绑定失败:', error)
  }
}

async function handleUnbind(row) {
  try {
    await ElMessageBox.confirm(`确定要解绑设备"${row.equipmentName}"吗？`, '解绑确认', {
      type: 'warning'
    })
    await unbindEquipment(row.id)
    ElMessage.success('解绑成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('解绑失败:', error)
    }
  }
}

async function handleForceUnlock(row) {
  try {
    await ElMessageBox.confirm(`确定要强制解锁设备"${row.equipmentName}"吗？`, '强制解锁确认', {
      type: 'warning'
    })
    await forceUnlockEquipment(row.id, '管理员')
    ElMessage.success('解锁成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('解锁失败:', error)
    }
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除设备"${row.equipmentName}"吗？`, '删除确认', {
      type: 'warning'
    })
    await deleteEquipment(row.id)
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
  try {
    if (isEdit.value) {
      await updateEquipment(form.id, form)
      ElMessage.success('更新成功')
    } else {
      await createEquipment(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('提交失败:', error)
  }
}

onMounted(() => {
  roomStore.loadRooms()
  loadData()
})
</script>
