const express = require('express');
const fs = require('fs');
const { db } = require('./database');
const { directoryWatcher } = require('./directory-watcher');
const { processingQueue } = require('./processing-queue');
const { getRecords, getStats, generateCSV, generateExcel } = require('./report-generator');

const router = express.Router();

router.get('/directories', async (req, res) => {
  const dirs = await directoryWatcher.getDirectories();
  res.json({ success: true, data: dirs });
});

router.post('/directories', express.json(), async (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.json({ success: false, error: 'Path is required' });
  }
  const result = await directoryWatcher.addDirectory(path);
  res.json(result);
});

router.delete('/directories/:id', async (req, res) => {
  const result = await directoryWatcher.removeDirectory(parseInt(req.params.id, 10));
  res.json(result);
});

router.post('/directories/:id/scan', async (req, res) => {
  const dir = await db.get('SELECT * FROM directories WHERE id = ?', parseInt(req.params.id, 10));
  if (dir) {
    const result = directoryWatcher.scanExistingFiles(dir.path);
    res.json(result);
  } else {
    res.json({ success: false, error: 'Directory not found' });
  }
});

router.get('/rules', async (req, res) => {
  const rules = await db.all('SELECT * FROM rules ORDER BY id');
  const relation = await db.get('SELECT relation FROM rule_relation WHERE id = 1');
  res.json({ success: true, data: { rules, relation: relation.relation } });
});

router.post('/rules', express.json(), async (req, res) => {
  const { name, file_pattern, min_size, max_size, start_time, end_time } = req.body;
  if (!name || !file_pattern) {
    return res.json({ success: false, error: 'Name and file pattern are required' });
  }
  const result = await db.run(`
    INSERT INTO rules (name, file_pattern, min_size, max_size, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `, name, file_pattern, min_size || 0, max_size || null, start_time || null, end_time || null);
  res.json({ success: true, data: { id: result.lastID } });
});

router.put('/rules/:id', express.json(), async (req, res) => {
  const { name, file_pattern, min_size, max_size, start_time, end_time, enabled } = req.body;
  const existing = await db.get('SELECT * FROM rules WHERE id = ?', parseInt(req.params.id, 10));
  if (!existing) {
    return res.json({ success: false, error: 'Rule not found' });
  }
  const result = await db.run(`
    UPDATE rules SET
      name = COALESCE(?, name),
      file_pattern = COALESCE(?, file_pattern),
      min_size = COALESCE(?, min_size),
      max_size = ?,
      start_time = ?,
      end_time = ?,
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `, name, file_pattern, min_size, max_size || null, start_time || null, end_time || null, enabled, parseInt(req.params.id, 10));
  res.json({ success: true, data: { changes: result.changes } });
});

router.delete('/rules/:id', async (req, res) => {
  const result = await db.run('DELETE FROM rules WHERE id = ?', parseInt(req.params.id, 10));
  res.json({ success: true, data: { changes: result.changes } });
});

router.post('/rules/relation', express.json(), async (req, res) => {
  const { relation } = req.body;
  if (!['all', 'any'].includes(relation)) {
    return res.json({ success: false, error: 'Invalid relation' });
  }
  await db.run('UPDATE rule_relation SET relation = ? WHERE id = 1', relation);
  res.json({ success: true });
});

router.get('/queue', async (req, res) => {
  const info = processingQueue.getQueueInfo();
  const retryItems = await db.all('SELECT * FROM retry_queue ORDER BY next_retry_at');
  res.json({ success: true, data: { ...info, retryItems } });
});

router.post('/queue/pause', (req, res) => {
  processingQueue.pause();
  res.json({ success: true });
});

router.post('/queue/resume', (req, res) => {
  processingQueue.resume();
  res.json({ success: true });
});

router.get('/records', async (req, res) => {
  const { startDate, endDate, fileName, result } = req.query;
  const records = await getRecords(startDate, endDate, fileName, result);
  res.json({ success: true, data: records });
});

router.get('/stats', async (req, res) => {
  const { startDate, endDate } = req.query;
  const stats = await getStats(startDate, endDate);
  res.json({ success: true, data: stats });
});

router.get('/report/download', async (req, res) => {
  const { startDate, endDate, format } = req.query;
  try {
    const result = format === 'excel'
      ? await generateExcel(startDate, endDate)
      : await generateCSV(startDate, endDate);
    const filePath = result.filePath;
    const fileName = format === 'excel' ? 'report.xlsx' : 'report.csv';
    const mimeType = format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', mimeType);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('end', () => {
      fs.unlink(filePath, () => {});
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get('/settings', async (req, res) => {
  const settings = await db.all('SELECT * FROM app_settings');
  const result = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  res.json({ success: true, data: result });
});

router.post('/settings', express.json(), async (req, res) => {
  const settings = req.body;
  try {
    await db.run('BEGIN TRANSACTION');
    for (const [key, value] of Object.entries(settings)) {
      await db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', key, String(value));
    }
    await db.run('COMMIT');
    await processingQueue.loadSettings();
    res.json({ success: true });
  } catch (err) {
    await db.run('ROLLBACK');
    res.json({ success: false, error: err.message });
  }
});

router.get('/deduplication', async (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const offset = (page - 1) * pageSize;
  const items = await db.all(
    'SELECT * FROM deduplication ORDER BY created_at DESC LIMIT ? OFFSET ?',
    parseInt(pageSize, 10),
    parseInt(offset, 10)
  );
  const totalRow = await db.get('SELECT COUNT(*) as count FROM deduplication');
  res.json({ success: true, data: { items, total: totalRow.count } });
});

module.exports = router;
