const { db } = require('./database');
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const os = require('os');

async function getRecords(startDate, endDate, fileName, result) {
  let query = 'SELECT * FROM processing_records WHERE 1=1';
  const params = [];

  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate + ' 23:59:59');
  }
  if (fileName) {
    query += ' AND file_name LIKE ?';
    params.push(`%${fileName}%`);
  }
  if (result) {
    query += ' AND result = ?';
    params.push(result);
  }

  query += ' ORDER BY created_at DESC LIMIT 1000';

  return await db.all(query, ...params);
}

async function getStats(startDate, endDate) {
  const records = await getRecords(startDate, endDate, null, null);

  const total = records.length;
  const success = records.filter((r) => r.result === 'success').length;
  const failed = records.filter((r) => r.result === 'failed').length;
  const skipped = records.filter((r) => r.result === 'skipped').length;
  const retrying = records.filter((r) => r.result === 'retrying').length;
  const totalDuration = records.reduce((sum, r) => sum + (r.duration_ms || 0), 0);

  const ruleStats = {};
  for (const r of records) {
    const key = r.rule_name || 'unknown';
    if (!ruleStats[key]) {
      ruleStats[key] = { total: 0, success: 0, failed: 0, skipped: 0 };
    }
    ruleStats[key].total++;
    if (r.result === 'success') ruleStats[key].success++;
    else if (r.result === 'failed') ruleStats[key].failed++;
    else if (r.result === 'skipped') ruleStats[key].skipped++;
  }

  return {
    total,
    success,
    failed,
    skipped,
    retrying,
    totalDuration,
    averageDuration: total > 0 ? Math.round(totalDuration / total) : 0,
    ruleStats,
    failedRecords: records.filter((r) => r.result === 'failed').map((r) => ({
      file_name: r.file_name,
      reason: r.reason,
      created_at: r.created_at,
    })),
  };
}

async function generateCSV(startDate, endDate) {
  const stats = await getStats(startDate, endDate);
  const records = await getRecords(startDate, endDate, null, null);

  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `report_${Date.now()}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'file_name', title: '文件名' },
      { id: 'file_size', title: '文件大小(字节)' },
      { id: 'result', title: '处理结果' },
      { id: 'reason', title: '失败原因' },
      { id: 'duration_ms', title: '耗时(毫秒)' },
      { id: 'rule_name', title: '匹配规则' },
      { id: 'retry_count', title: '重试次数' },
      { id: 'md5', title: 'MD5哈希' },
      { id: 'created_at', title: '处理时间' },
    ],
  });

  await csvWriter.writeRecords(records);

  return {
    filePath,
    summary: stats,
  };
}

async function generateExcel(startDate, endDate) {
  const stats = await getStats(startDate, endDate);
  const records = await getRecords(startDate, endDate, null, null);

  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `report_${Date.now()}.xlsx`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Log Batch Processor';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('统计汇总');
  summarySheet.columns = [
    { header: '指标', key: 'metric', width: 30 },
    { header: '数值', key: 'value', width: 30 },
  ];

  summarySheet.addRow({ metric: '总处理文件数', value: stats.total });
  summarySheet.addRow({ metric: '成功数', value: stats.success });
  summarySheet.addRow({ metric: '失败数', value: stats.failed });
  summarySheet.addRow({ metric: '跳过数(去重)', value: stats.skipped });
  summarySheet.addRow({ metric: '重试中', value: stats.retrying });
  summarySheet.addRow({ metric: '总耗时(毫秒)', value: stats.totalDuration });
  summarySheet.addRow({ metric: '平均耗时(毫秒)', value: stats.averageDuration });

  const ruleSheet = workbook.addWorksheet('规则统计');
  ruleSheet.columns = [
    { header: '规则名称', key: 'rule', width: 30 },
    { header: '总处理', key: 'total', width: 15 },
    { header: '成功', key: 'success', width: 15 },
    { header: '失败', key: 'failed', width: 15 },
    { header: '跳过', key: 'skipped', width: 15 },
  ];

  for (const [rule, data] of Object.entries(stats.ruleStats)) {
    ruleSheet.addRow({
      rule,
      total: data.total,
      success: data.success,
      failed: data.failed,
      skipped: data.skipped,
    });
  }

  const failuresSheet = workbook.addWorksheet('失败详情');
  failuresSheet.columns = [
    { header: '文件名', key: 'file_name', width: 40 },
    { header: '失败原因', key: 'reason', width: 60 },
    { header: '处理时间', key: 'created_at', width: 25 },
  ];

  for (const rec of stats.failedRecords) {
    failuresSheet.addRow(rec);
  }

  const detailsSheet = workbook.addWorksheet('全部记录');
  detailsSheet.columns = [
    { header: '文件名', key: 'file_name', width: 40 },
    { header: '文件大小', key: 'file_size', width: 15 },
    { header: '结果', key: 'result', width: 12 },
    { header: '原因', key: 'reason', width: 40 },
    { header: '耗时(ms)', key: 'duration_ms', width: 12 },
    { header: '规则', key: 'rule_name', width: 25 },
    { header: '重试次数', key: 'retry_count', width: 12 },
    { header: 'MD5', key: 'md5', width: 35 },
    { header: '处理时间', key: 'created_at', width: 25 },
  ];

  for (const rec of records) {
    detailsSheet.addRow(rec);
  }

  await workbook.xlsx.writeFile(filePath);

  return {
    filePath,
    summary: stats,
  };
}

module.exports = {
  getRecords,
  getStats,
  generateCSV,
  generateExcel,
};
