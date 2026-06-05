import { openDB, IDBPDatabase } from 'idb';
import { HistoryItem } from '../types';

const DB_NAME = 'api-debug-tool';
const DB_VERSION = 1;
const HISTORY_STORE = 'history';

let db: IDBPDatabase | null = null;

async function getDB() {
  if (!db) {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('url', 'url');
          store.createIndex('method', 'method');
        }
      },
    });
  }
  return db;
}

export async function addHistory(item: HistoryItem): Promise<void> {
  const db = await getDB();
  await db.put(HISTORY_STORE, item);
}

export async function getHistory(limit: number = 100): Promise<HistoryItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex(HISTORY_STORE, 'timestamp');
  return items.reverse().slice(0, limit);
}

export async function deleteHistory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(HISTORY_STORE, id);
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear(HISTORY_STORE);
}

export async function searchHistory(query: string): Promise<HistoryItem[]> {
  const allHistory = await getHistory();
  const lowerQuery = query.toLowerCase();
  return allHistory.filter(
    (item) =>
      item.url.toLowerCase().includes(lowerQuery) ||
      item.method.toLowerCase().includes(lowerQuery)
  );
}
