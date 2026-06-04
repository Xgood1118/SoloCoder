import fs from 'fs';
import path from 'path';
import { Category, Tag, Template, Article, ArticleVersion, Approval, OperationLog } from '../types';

export interface Database {
  categories: Category[];
  tags: Tag[];
  templates: Template[];
  articles: Article[];
  article_versions: ArticleVersion[];
  approvals: Approval[];
  operation_logs: OperationLog[];
}

const dataDir = path.join(__dirname, '../../../data');
const dbPath = path.join(dataDir, 'db.json');

const initialData: Database = {
  categories: [],
  tags: [],
  templates: [],
  articles: [],
  article_versions: [],
  approvals: [],
  operation_logs: [],
};

let dbInstance: Database | null = null;

function loadDb(): Database {
  if (dbInstance) return dbInstance;
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf-8');
      dbInstance = JSON.parse(data);
    } catch (e) {
      dbInstance = { ...initialData };
    }
  } else {
    dbInstance = { ...initialData };
    saveDb();
  }
  
  return dbInstance!;
}

function saveDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify(dbInstance, null, 2));
}

export function getDb(): Database {
  return loadDb();
}

export function persist() {
  saveDb();
}

export default getDb;
