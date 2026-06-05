<template>
  <div class="create-application">
    <h2 class="page-title">新建采购申请</h2>
    <el-card>
      <el-form :model="form" label-width="100px" style="max-width: 800px;">
        <el-form-item label="申请标题" required>
          <el-input v-model="form.title" placeholder="请输入申请标题" />
        </el-form-item>
        <el-form-item label="申请类型">
          <el-select v-model="form.application_type" placeholder="请选择申请类型">
            <el-option label="办公用品" value="office" />
            <el-option label="设备采购" value="equipment" />
            <el-option label="服务采购" value="service" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请说明">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入申请说明"
          />
        </el-form-item>
        <el-form-item label="采购明细">
          <el-table :data="form.items" border style="width: 100%;">
            <el-table-column prop="item_name" label="物品名称" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.item_name" size="small" placeholder="物品名称" />
              </template>
            </el-table-column>
            <el-table-column prop="specification" label="规格型号">
              <template #default="{ row }">
                <el-input v-model="row.specification" size="small" placeholder="规格型号" />
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="100">
              <template #default="{ row }">
                <el-input-number v-model="row.quantity" size="small" :min="1" style="width: 80px;" />
              </template>
            </el-table-column>
            <el-table-column prop="unit_price" label="单价" width="120">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.unit_price"
                  size="small"
                  :min="0"
                  :precision="2"
                  style="width: 100px;"
                />
              </template>
            </el-table-column>
            <el-table-column prop="total_price" label="小计" width="120">
              <template #default="{ row }">
                ¥{{ (row.quantity * row.unit_price).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ $index }">
                <el-button type="danger" link size="small" @click="removeItem($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button type="primary" link style="margin-top: 10px;" @click="addItem">
            <el-icon><Plus /></el-icon>
            添加物品
          </el-button>
        </el-form-item>
        <el-form-item label="合计金额">
          <span class="total-amount">¥{{ totalAmount.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="loading">提交申请</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { createApplication } from '@/api/application'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const form = ref({
  title: '',
  application_type: '',
  description: '',
  items: [
    {
      item_name: '',
      specification: '',
      quantity: 1,
      unit_price: 0
    }
  ]
})

const totalAmount = computed(() => {
  return form.value.items.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.unit_price || 0)
  }, 0)
})

function addItem() {
  form.value.items.push({
    item_name: '',
    specification: '',
    quantity: 1,
    unit_price: 0
  })
}

function removeItem(index) {
  if (form.value.items.length > 1) {
    form.value.items.splice(index, 1)
  } else {
    ElMessage.warning('至少需要保留一条记录')
  }
}

async function handleSubmit() {
  if (!form.value.title) {
    ElMessage.warning('请输入申请标题')
    return
  }

  const hasEmptyItem = form.value.items.some(item => !item.item_name)
  if (!hasEmptyItem) {
    ElMessage.warning('请填写采购明细')
    return
  }

  loading.value = true
  try {
    await createApplication(form.value)
    ElMessage.success('申请提交成功')
    router.push('/applications')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 20px;
}

.total-amount {
  font-size: 24px;
  font-weight: bold;
  color: #f56c6c;
}
</style>
