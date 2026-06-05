<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">报表统计</div>
    </div>

    <el-card shadow="never" style="margin-bottom: 20px">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="快捷日期">
          <el-radio-group v-model="quickDate" @change="handleQuickDate">
            <el-radio-button value="today">今日</el-radio-button>
            <el-radio-button value="week">本周</el-radio-button>
            <el-radio-button value="month">本月</el-radio-button>
            <el-radio-button value="custom">自定义</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker
            v-model="filterForm.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker
            v-model="filterForm.endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadStats" :loading="loading">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="card-grid">
      <div class="stat-card">
        <div class="label">总处理文件数</div>
        <div class="value">{{ stats.total }}</div>
      </div>
      <div class="stat-card success">
        <div class="label">成功数</div>
        <div class="value">{{ stats.success }}</div>
      </div>
      <div class="stat-card failed">
        <div class="label">失败数</div>
        <div class="value">{{ stats.failed }}</div>
      </div>
      <div class="stat-card skipped">
        <div class="label">跳过(去重)</div>
        <div class="value">{{ stats.skipped }}</div>
      </div>
      <div class="stat-card processing">
        <div class="label">重试中</div>
        <div class="value">{{ stats.retrying }}</div>
      </div>
      <div class="stat-card">
        <div class="label">平均耗时</div>
        <div class="value">{{ stats.averageDuration }}ms</div>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="never" style="margin-bottom: 20px">
          <template #header>
            <span>处理结果分布</span>
          </template>
          <div style="height: 300px">
            <v-chart class="chart" :option="pieOption" autoresize />
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" style="margin-bottom: 20px">
          <template #header>
            <span>规则处理统计</span>
          </template>
          <div style="height: 300px">
            <v-chart class="chart" :option="barOption" autoresize />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>导出报表</span>
          <div class="export-actions">
            <el-button
              type="primary"
              :icon="Download"
              :loading="exporting"
              @click="handleExport('csv')"
            >
              导出 CSV
            </el-button>
            <el-button
              type="success"
              :icon="Download"
              :loading="exporting"
              @click="handleExport('excel')"
            >
              导出 Excel
            </el-button>
          </div>
        </div>
      </template>
      <el-alert
        type="info"
        show-icon
        :closable="false"
      >
        报表包含统计汇总、规则统计、失败详情和全部记录四个工作表（Excel）或一个完整表格（CSV）。
      </el-alert>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>失败文件详情</span>
      </template>
      <el-table :data="stats.failedRecords || []" size="small" max-height="300">
        <el-table-column prop="file_name" label="文件名" />
        <el-table-column prop="reason" label="失败原因" show-overflow-tooltip />
        <el-table-column prop="created_at" label="处理时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!stats.failedRecords?.length" class="empty-state">
        <p>暂无失败记录</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { recordsAPI, reportAPI } from '../api';
import { ElMessage } from 'element-plus';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components';
import { Download } from '@element-plus/icons-vue';

use([
  CanvasRenderer,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

const loading = ref(false);
const exporting = ref(false);
const quickDate = ref('today');
const stats = ref({
  total: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  retrying: 0,
  averageDuration: 0,
  totalDuration: 0,
  ruleStats: {},
  failedRecords: [],
});
const filterForm = reactive({
  startDate: '',
  endDate: '',
});

const pieOption = computed(() => {
  const data = [
    { value: stats.value.success, name: '成功', itemStyle: { color: '#67c23a' } },
    { value: stats.value.failed, name: '失败', itemStyle: { color: '#f56c6c' } },
    { value: stats.value.skipped, name: '跳过', itemStyle: { color: '#909399' } },
    { value: stats.value.retrying, name: '重试中', itemStyle: { color: '#e6a23c' } },
  ].filter((d) => d.value > 0);

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: '18', fontWeight: 'bold' },
        },
        labelLine: { show: false },
        data,
      },
    ],
  };
});

const barOption = computed(() => {
  const ruleNames = Object.keys(stats.value.ruleStats || {});
  const ruleData = stats.value.ruleStats || {};

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['成功', '失败', '跳过'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ruleNames.length > 0 ? ruleNames : ['暂无数据'],
      axisLabel: { rotate: 30, interval: 0 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '成功',
        type: 'bar',
        data: ruleNames.length > 0 ? ruleNames.map((r) => ruleData[r].success) : [0],
        itemStyle: { color: '#67c23a' },
      },
      {
        name: '失败',
        type: 'bar',
        data: ruleNames.length > 0 ? ruleNames.map((r) => ruleData[r].failed) : [0],
        itemStyle: { color: '#f56c6c' },
      },
      {
        name: '跳过',
        type: 'bar',
        data: ruleNames.length > 0 ? ruleNames.map((r) => ruleData[r].skipped) : [0],
        itemStyle: { color: '#909399' },
      },
    ],
  };
});

function handleQuickDate(val) {
  const now = new Date();
  const format = (d) => d.toISOString().split('T')[0];

  if (val === 'today') {
    filterForm.startDate = format(now);
    filterForm.endDate = format(now);
  } else if (val === 'week') {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    filterForm.startDate = format(weekStart);
    filterForm.endDate = format(now);
  } else if (val === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    filterForm.startDate = format(monthStart);
    filterForm.endDate = format(now);
  }
}

async function loadStats() {
  loading.value = true;
  try {
    const params = {};
    if (filterForm.startDate) params.startDate = filterForm.startDate;
    if (filterForm.endDate) params.endDate = filterForm.endDate;

    const res = await recordsAPI.stats(params);
    if (res.success) {
      stats.value = res.data;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  } finally {
    loading.value = false;
  }
}

async function handleExport(format) {
  exporting.value = true;
  try {
    const params = { format };
    if (filterForm.startDate) params.startDate = filterForm.startDate;
    if (filterForm.endDate) params.endDate = filterForm.endDate;

    const blob = await reportAPI.download(params);
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    ElMessage.success('导出成功');
  } catch (err) {
    ElMessage.error('导出失败');
  } finally {
    exporting.value = false;
  }
}

function formatTime(time) {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
}

onMounted(() => {
  handleQuickDate('today');
  loadStats();
});
</script>

<style scoped>
.filter-form {
  margin-bottom: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.export-actions {
  display: flex;
  gap: 10px;
}

.chart {
  width: 100%;
  height: 100%;
}
</style>
