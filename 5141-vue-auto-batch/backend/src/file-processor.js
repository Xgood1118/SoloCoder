const fs = require('fs');
const path = require('path');
const { calculateMD5 } = require('./md5-util');
const { db } = require('./database');

async function getProcessingSteps() {
  const result = await db.get('SELECT value FROM app_settings WHERE key = ?', 'processing_steps');
  return result ? JSON.parse(result.value) : [];
}

async function getTargetDirectory() {
  const result = await db.get('SELECT value FROM app_settings WHERE key = ?', 'target_directory');
  return result?.value || '';
}

function applyFilters(content, filters) {
  let result = content;
  for (const filter of filters) {
    if (filter.type === 'regex') {
      const regex = new RegExp(filter.pattern, filter.flags || 'g');
      result = result.replace(regex, filter.replacement || '');
    } else if (filter.type === 'grep') {
      const lines = result.split('\n');
      result = lines.filter((line) => line.includes(filter.pattern)).join('\n');
    } else if (filter.type === 'trim') {
      result = result.trim();
    }
  }
  return result;
}

async function processFileWorker(filePath, fileStats) {
  const startTime = Date.now();
  const fileName = path.basename(filePath);
  const fileSize = fileStats.size;

  let md5;
  try {
    md5 = await calculateMD5(filePath);
  } catch (err) {
    return {
      result: 'failed',
      reason: `MD5 calculation failed: ${err.message}`,
      duration: Date.now() - startTime,
    };
  }

  const dedupCheck = await db.get('SELECT id FROM deduplication WHERE md5 = ?', md5);
  if (dedupCheck) {
    return {
      result: 'skipped',
      reason: 'Duplicate file (same MD5)',
      md5,
      duration: Date.now() - startTime,
    };
  }

  const steps = await getProcessingSteps();
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return {
      result: 'failed',
      reason: `Failed to read file: ${err.message}`,
      md5,
      duration: Date.now() - startTime,
    };
  }

  const filters = steps.filter((s) => s.type === 'filter' || s.type === 'transform');
  if (filters.length > 0) {
    content = applyFilters(content, filters);
  }

  const targetDir = await getTargetDirectory();
  if (targetDir) {
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const targetPath = path.join(targetDir, fileName);
      fs.writeFileSync(targetPath, content, 'utf8');
    } catch (err) {
      return {
        result: 'failed',
        reason: `Failed to write target file: ${err.message}`,
        md5,
        duration: Date.now() - startTime,
      };
    }
  }

  try {
    await db.run(
      'INSERT INTO deduplication (md5, file_path) VALUES (?, ?)',
      md5, filePath
    );
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return {
        result: 'skipped',
        reason: 'Duplicate file (concurrent insertion)',
        md5,
        duration: Date.now() - startTime,
      };
    }
    return {
      result: 'failed',
      reason: `Deduplication insert failed: ${err.message}`,
      md5,
      duration: Date.now() - startTime,
    };
  }

  return {
    result: 'success',
    reason: null,
    md5,
    duration: Date.now() - startTime,
  };
}

module.exports = { processFileWorker };
