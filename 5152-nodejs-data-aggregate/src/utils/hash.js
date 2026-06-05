const crypto = require('crypto');

function hashQuery(queryString, datasourceIds) {
  const sortedIds = [...datasourceIds].sort().join(',');
  const raw = `${queryString}||${sortedIds}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { hashQuery };
