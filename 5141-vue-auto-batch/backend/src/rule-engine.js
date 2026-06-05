const mm = require('micromatch');
const { db } = require('./database');

function parseTime(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function checkRule(rule, filePath, fileStats) {
  const fileName = require('path').basename(filePath);

  if (rule.file_pattern && !mm.isMatch(fileName, rule.file_pattern)) {
    return false;
  }

  if (rule.min_size && rule.min_size > 0 && fileStats.size < rule.min_size) {
    return false;
  }

  if (rule.max_size && rule.max_size > 0 && fileStats.size > rule.max_size) {
    return false;
  }

  const fileTime = new Date(fileStats.mtime);
  const startTime = parseTime(rule.start_time);
  const endTime = parseTime(rule.end_time);

  if (startTime) {
    const fileStart = new Date(fileTime);
    fileStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    if (fileTime < fileStart) return false;
  }

  if (endTime) {
    const fileEnd = new Date(fileTime);
    fileEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    if (fileTime > fileEnd) return false;
  }

  return true;
}

async function matchFile(filePath, fileStats) {
  const rules = await db.all('SELECT * FROM rules WHERE enabled = 1');
  const relation = await db.get('SELECT relation FROM rule_relation WHERE id = 1');

  if (rules.length === 0) {
    return { matched: true, ruleName: 'default' };
  }

  const matchedRules = rules.filter((rule) => checkRule(rule, filePath, fileStats));

  if (relation.relation === 'all') {
    const allMatched = matchedRules.length === rules.length;
    return {
      matched: allMatched,
      ruleName: allMatched ? rules.map((r) => r.name).join(', ') : null,
    };
  } else {
    return {
      matched: matchedRules.length > 0,
      ruleName: matchedRules.length > 0 ? matchedRules.map((r) => r.name).join(', ') : null,
    };
  }
}

module.exports = { matchFile, checkRule };
