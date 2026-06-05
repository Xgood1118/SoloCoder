const { MongoClient } = require('mongodb');

function createClient(connectionConfig) {
  const url = connectionConfig.url || `mongodb://${connectionConfig.host}:${connectionConfig.port}`;
  const client = new MongoClient(url);
  return client.connect().then(() => client);
}

async function query(client, collectionName, queryObj, options, database) {
  const db = client.db(database || undefined);
  const collection = db.collection(collectionName);
  return collection.find(queryObj, options).toArray();
}

async function validateConnection(connectionConfig) {
  const url = connectionConfig.url || `mongodb://${connectionConfig.host}:${connectionConfig.port}`;
  const client = new MongoClient(url);
  try {
    await client.connect();
    await client.db(connectionConfig.database).command({ ping: 1 });
    return { valid: true };
  } catch (err) {
    const errorMsg = err.message || err.code || err.errno || String(err);
    return { valid: false, error: errorMsg };
  } finally {
    try {
      await client.close();
    } catch (e) {
      // ignore close errors
    }
  }
}

async function closeClient(client) {
  await client.close();
}

module.exports = { createClient, query, validateConnection, closeClient };
