<template>
  <div class="order-create">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><Plus /></el-icon>
          <span>代客下单</span>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用户ID" prop="userId">
              <el-input v-model="form.userId" placeholder="请输入用户ID" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="代客理由" prop="createReason">
              <el-select v-model="form.createReason" placeholder="请选择代客理由">
                <el-option label="客户电话下单" value="客户电话下单" />
                <el-option label="客户线下下单" value="客户线下下单" />
                <el-option label="补单" value="补单" />
                <el-option label="其他原因" value="其他原因" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">商品信息</el-divider>

        <div class="product-list">
          <div
            v-for="(item, index) in form.items"
            :key="index"
            class="product-item"
          >
            <div class="product-index">{{ index + 1 }}</div>
            <div class="product-fields">
              <el-row :gutter="12">
                <el-col :span="5">
                  <el-form-item :prop="'items.' + index + '.skuId'" :rules="{ required: true, message: '请输入SKU ID' }">
                    <el-input v-model="item.skuId" placeholder="SKU ID" />
                  </el-form-item>
                </el-col>
                <el-col :span="5">
                  <el-form-item :prop="'items.' + index + '.skuName'" :rules="{ required: true, message: '请输入SKU名称' }">
                    <el-input v-model="item.skuName" placeholder="SKU名称" />
                  </el-form-item>
                </el-col>
                <el-col :span="5">
                  <el-form-item :prop="'items.' + index + '.productTitle'" :rules="{ required: true, message: '请输入商品标题' }">
                    <el-input v-model="item.productTitle" placeholder="商品标题" />
                  </el-form-item>
                </el-col>
                <el-col :span="3">
                  <el-form-item :prop="'items.' + index + '.unitPrice'" :rules="[{ required: true, message: '请输入单价' }]">
                    <el-input v-model="item.unitPrice" placeholder="单价(元)">
                      <template #append>元</template>
                    </el-input>
                  </el-form-item>
                </el-col>
                <el-col :span="3">
                  <el-form-item :prop="'items.' + index + '.quantity'" :rules="[{ required: true, message: '请输入数量', type: 'number', min: 1 }]">
                    <el-input-number v-model="item.quantity" :min="1" :max="999" style="width: 100%;" />
                  </el-form-item>
                </el-col>
                <el-col :span="2">
                  <el-form-item label=" ">
                    <el-button type="danger" icon="Delete" circle @click="removeItem(index)" />
                  </el-form-item>
                </el-col>
              </el-row>
            </div>
          </div>
        </div>

        <el-button type="primary" plain @click="addItem" style="margin-bottom: 20px;">
          <el-icon><Plus /></el-icon> 添加商品
        </el-button>

        <el-divider content-position="left">收货地址</el-divider>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="收货人" prop="address.name">
              <el-input v-model="form.address.name" placeholder="请输入收货人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="联系电话" prop="address.phone">
              <el-input v-model="form.address.phone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="省" prop="address.province">
              <el-input v-model="form.address.province" placeholder="省份" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="市" prop="address.city">
              <el-input v-model="form.address.city" placeholder="城市" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="区/县" prop="address.district">
              <el-input v-model="form.address.district" placeholder="区/县" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="详细地址" prop="address.detail">
              <el-input v-model="form.address.detail" placeholder="详细地址" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">订单备注</el-divider>

        <el-form-item label="订单备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="选填，可填写订单备注信息"
          />
        </el-form-item>

        <el-divider />

        <div class="amount-summary">
          <div class="summary-item">
            <span class="label">商品总额：</span>
            <span class="value">¥{{ totalAmount }}</span>
          </div>
          <div class="summary-item discount">
            <span class="label">优惠金额（满100减5）：</span>
            <span class="value">-¥{{ discountAmount }}</span>
          </div>
          <div class="summary-item total">
            <span class="label">实付金额：</span>
            <span class="value">¥{{ paidAmount }}</span>
          </div>
        </div>

        <div class="form-actions">
          <el-button @click="goBack">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            提交订单
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createOrder } from '../api/order'
import { fenToYuan, yuanToFen } from '../utils/order'

const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  userId: '',
  createReason: '客户电话下单',
  items: [
    {
      skuId: 'SKU001',
      skuName: '红色S码',
      productTitle: '时尚休闲T恤',
      unitPrice: '99.00',
      quantity: 1
    }
  ],
  address: {
    name: '张三',
    phone: '13800138000',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    detail: '科技园路123号'
  },
  remark: ''
})

const rules = {
  userId: [
    { required: true, message: '请输入用户ID', trigger: 'blur' }
  ],
  createReason: [
    { required: true, message: '请选择代客理由', trigger: 'change' }
  ]
}

const totalFen = computed(() => {
  return form.items.reduce((sum, item) => {
    const unit = yuanToFen(item.unitPrice)
    return sum + unit * (item.quantity || 0)
  }, 0)
})

const discountFen = computed(() => {
  const threshold = 10000
  const discount = 500
  if (totalFen.value >= threshold) {
    return Math.min(discount, totalFen.value)
  }
  return 0
})

const totalAmount = computed(() => fenToYuan(totalFen.value))
const discountAmount = computed(() => fenToYuan(discountFen.value))
const paidAmount = computed(() => {
  const paid = Math.max(0, totalFen.value - discountFen.value)
  return fenToYuan(paid)
})

const addItem = () => {
  form.items.push({
    skuId: '',
    skuName: '',
    productTitle: '',
    unitPrice: '0.00',
    quantity: 1
  })
}

const removeItem = (index) => {
  if (form.items.length <= 1) {
    ElMessage.warning('至少保留一个商品')
    return
  }
  form.items.splice(index, 1)
}

const goBack = () => {
  router.push('/orders')
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch (e) {
    ElMessage.warning('请填写完整的订单信息')
    return
  }

  if (form.items.length === 0) {
    ElMessage.warning('请添加至少一个商品')
    return
  }

  submitting.value = true
  try {
    const orderData = {
      userId: form.userId,
      createReason: form.createReason,
      items: form.items.map(item => ({
        skuId: item.skuId,
        skuName: item.skuName,
        productTitle: item.productTitle,
        unitPrice: item.unitPrice
      })),
      address: { ...form.address },
      remark: form.remark,
      operatorId: 'admin',
      operatorName: '管理员'
    }

    const order = await createOrder(orderData)
    ElMessage.success('订单创建成功')
    router.push(`/orders/${order.id}`)
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.order-create {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.card-header .el-icon {
  color: #409EFF;
}

.product-list {
  margin-bottom: 16px;
}

.product-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 12px;
}

.product-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #409EFF;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.product-fields {
  flex: 1;
}

.amount-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 6px;
}

.summary-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.summary-item .label {
  color: #606266;
  font-size: 14px;
}

.summary-item .value {
  color: #303133;
  font-size: 14px;
  font-weight: 500;
  min-width: 100px;
  text-align: right;
}

.summary-item.discount .value {
  color: #67c23a;
}

.summary-item.total {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.summary-item.total .label {
  font-size: 16px;
  font-weight: 600;
}

.summary-item.total .value {
  font-size: 22px;
  font-weight: 700;
  color: #f56c6c;
}

.form-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 30px;
}

.form-actions .el-button {
  padding: 12px 40px;
  font-size: 15px;
}
</style>
