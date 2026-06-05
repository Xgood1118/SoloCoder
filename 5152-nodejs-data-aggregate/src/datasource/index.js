const mysqlAdapter = require('./mysql-adapter');
const postgresqlAdapter = require('./postgresql-adapter');
const mongodbAdapter = require('./mongodb-adapter');
const restAdapter = require('./rest-adapter');

const adapters = {
  mysql: mysqlAdapter,
  postgresql: postgresqlAdapter,
  mongodb: mongodbAdapter,
  rest_api: restAdapter
};

function getAdapter(type) {
  const adapter = adapters[type];
  if (!adapter) {
    throw new Error(`Unknown datasource type: ${type}`);
  }
  return adapter;
}

async function validateDatasourceConnection(type, connectionConfig) {
  const adapter = getAdapter(type);
  return adapter.validateConnection(connectionConfig);
}

module.exports = { getAdapter, validateDatasourceConnection };
