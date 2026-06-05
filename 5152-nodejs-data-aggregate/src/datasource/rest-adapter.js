const axios = require('axios');

function createClient(connectionConfig) {
  const config = {
    baseURL: connectionConfig.baseUrl,
    headers: connectionConfig.headers || {},
    timeout: connectionConfig.timeout || 5000
  };

  if (connectionConfig.auth) {
    config.auth = {
      username: connectionConfig.auth.username,
      password: connectionConfig.auth.password
    };
  }

  return axios.create(config);
}

async function query(clientConfig, path, params) {
  const client = typeof clientConfig.request === 'function'
    ? clientConfig
    : createClient(clientConfig);

  const response = await client.get(path, { params });
  return response.data;
}

async function validateConnection(connectionConfig) {
  try {
    const client = createClient(connectionConfig);
    await client.get('/');
    return { valid: true };
  } catch (err) {
    if (err.response) {
      return { valid: true };
    }
    const errorMsg = err.message || err.code || String(err);
    return { valid: false, error: errorMsg };
  }
}

module.exports = { createClient, query, validateConnection };
