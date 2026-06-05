import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, runSql } from '../database.js';
import type { SensitiveWord } from '../../shared/types.js';

export function findAll(): SensitiveWord[] {
  return queryAll<SensitiveWord>(
    'SELECT id, word, level, category, created_at FROM sensitive_words ORDER BY created_at DESC'
  );
}

export function findById(id: string): SensitiveWord | null {
  return queryOne<SensitiveWord>(
    'SELECT id, word, level, category, created_at FROM sensitive_words WHERE id = ?',
    [id]
  );
}

export function create(word: string, level: SensitiveWord['level'], category: string): SensitiveWord {
  const id = uuidv4();
  const now = new Date().toISOString();
  runSql(
    'INSERT INTO sensitive_words (id, word, level, category, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, word, level, category, now]
  );
  return { id, word, level, category, createdAt: now };
}

export function update(
  id: string,
  word?: string,
  level?: SensitiveWord['level'],
  category?: string
): SensitiveWord | null {
  const existing = findById(id);
  if (!existing) return null;
  const newWord = word ?? existing.word;
  const newLevel = level ?? existing.level;
  const newCategory = category ?? existing.category;
  runSql(
    'UPDATE sensitive_words SET word = ?, level = ?, category = ? WHERE id = ?',
    [newWord, newLevel, newCategory, id]
  );
  return { ...existing, word: newWord, level: newLevel, category: newCategory };
}

export function remove(id: string): boolean {
  return runSql('DELETE FROM sensitive_words WHERE id = ?', [id]) > 0;
}

export function batchCreate(words: Array<{ word: string; level: SensitiveWord['level']; category: string }>): number {
  let count = 0;
  for (const w of words) {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      runSql(
        'INSERT INTO sensitive_words (id, word, level, category, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, w.word, w.level, w.category, now]
      );
      count++;
    } catch {
      // skip duplicates or constraint violations
    }
  }
  return count;
}
