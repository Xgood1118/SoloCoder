import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, runSql } from '../database.js';
import type { KnowledgeDoc, KnowledgeChunk } from '../../shared/types.js';

interface DocRow {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  indexed: number;
}

function toDoc(row: DocRow): KnowledgeDoc {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? '',
    category: row.category,
    createdAt: row.createdAt,
    indexed: row.indexed === 1,
  };
}

export function createDoc(title: string, content: string, category: string): KnowledgeDoc {
  const id = uuidv4();
  const now = new Date().toISOString();
  runSql(
    'INSERT INTO knowledge_docs (id, title, content, category, created_at, indexed) VALUES (?, ?, ?, ?, ?, ?)',
    [id, title, content, category, now, 0]
  );
  return { id, title, content, category, createdAt: now, indexed: false };
}

export function findAllDocs(): KnowledgeDoc[] {
  const rows = queryAll<DocRow>(
    'SELECT id, title, content, category, created_at, indexed FROM knowledge_docs ORDER BY created_at DESC'
  );
  return rows.map(toDoc);
}

export function findDocById(id: string): KnowledgeDoc | null {
  const row = queryOne<DocRow>(
    'SELECT id, title, content, category, created_at, indexed FROM knowledge_docs WHERE id = ?',
    [id]
  );
  return row ? toDoc(row) : null;
}

export function deleteDoc(id: string): boolean {
  runSql('DELETE FROM knowledge_chunks WHERE doc_id = ?', [id]);
  return runSql('DELETE FROM knowledge_docs WHERE id = ?', [id]) > 0;
}

export function markDocIndexed(id: string): void {
  runSql('UPDATE knowledge_docs SET indexed = 1 WHERE id = ?', [id]);
}

export function createChunk(docId: string, content: string, keywords: string): KnowledgeChunk {
  const id = uuidv4();
  const now = new Date().toISOString();
  runSql(
    'INSERT INTO knowledge_chunks (id, doc_id, content, keywords, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, docId, content, keywords, now]
  );
  return { id, docId, content, keywords, createdAt: now };
}

export function searchChunksByKeywords(keywords: string[]): Array<{ content: string; keywords: string; docId: string }> {
  if (keywords.length === 0) return [];
  const conditions = keywords.map(() => 'keywords LIKE ?').join(' OR ');
  const params = keywords.map(k => `%${k}%`);
  return queryAll<{ content: string; keywords: string; docId: string }>(
    `SELECT content, keywords, doc_id FROM knowledge_chunks WHERE ${conditions}`,
    params
  );
}
