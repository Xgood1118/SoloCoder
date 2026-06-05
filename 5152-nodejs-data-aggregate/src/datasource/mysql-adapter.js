const mysql = require('mysql2/promise');

function createPool(connectionConfig) {
  return mysql.createPool({
    host: connectionConfig.host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    user: connectionConfig.user,
    password: connectionConfig.password,
    connectionLimit: connectionConfig.connectionLimit || 5
  });
}

async function query(pool, sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function validateConnection(connectionConfig) {
  const pool = createPool(connectionConfig);
  try {
    await pool.query('SELECT 1');
    return { valid: true };
  } catch (err) {
    const errorMsg = err.message || err.code || err.errno || String(err);
    return { valid: false, error: errorMsg };
  } finally {
    try {
      await pool.end();
    } catch (e) {
      // ignore close errors
    }
  }
}

async function closePool(pool) {
  await pool.end();
}

module.exports = { createPool, query, validateConnection, closePool };
