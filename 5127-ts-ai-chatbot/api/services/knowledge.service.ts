import * as knowledgeRepo from '../repositories/knowledge.repository.js';
import type { KnowledgeDoc } from '../../shared/types.js';

const CHUNK_SIZE = 200;

function tokenize(text: string): string[] {
  return text
    .replace(/[，。！？、；：""''【】（）《》\s,.!?;:'"()\[\]{}<>]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function extractKeywords(text: string): string[] {
  const tokens = tokenize(text);
  return [...new Set(tokens)];
}

export function searchKnowledge(
  query: string,
  topK: number = 3
): Array<{ content: string; score: number; docId: string }> {
  const queryKeywords = tokenize(query);
  if (queryKeywords.length === 0) return [];

  const chunks = knowledgeRepo.searchChunksByKeywords(queryKeywords);

  const scored = chunks.map(chunk => {
    const chunkKeywords = chunk.keywords.split(',').map(k => k.trim()).filter(Boolean);
    const overlapCount = queryKeywords.filter(qk =>
      chunkKeywords.some(ck => ck.includes(qk) || qk.includes(ck))
    ).length;
    return {
      content: chunk.content,
      score: overlapCount,
      docId: chunk.docId,
    };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function addKnowledgeDoc(
  title: string,
  content: string,
  category: string
): KnowledgeDoc {
  const doc = knowledgeRepo.createDoc(title, content, category);

  const chunks: string[] = [];
  let remaining = content;
  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }
    let splitPos = remaining.lastIndexOf('。', CHUNK_SIZE);
    if (splitPos === -1 || splitPos < CHUNK_SIZE * 0.3) {
      splitPos = remaining.lastIndexOf('，', CHUNK_SIZE);
    }
    if (splitPos === -1 || splitPos < CHUNK_SIZE * 0.3) {
      splitPos = remaining.lastIndexOf('\n', CHUNK_SIZE);
    }
    if (splitPos === -1 || splitPos < CHUNK_SIZE * 0.3) {
      splitPos = CHUNK_SIZE;
    }
    chunks.push(remaining.slice(0, splitPos + 1).trim());
    remaining = remaining.slice(splitPos + 1).trim();
  }

  for (const chunk of chunks) {
    if (!chunk) continue;
    const keywords = extractKeywords(chunk).join(',');
    knowledgeRepo.createChunk(doc.id, chunk, keywords);
  }

  knowledgeRepo.markDocIndexed(doc.id);

  return { ...doc, indexed: true };
}

export function deleteKnowledgeDoc(id: string): boolean {
  return knowledgeRepo.deleteDoc(id);
}

export function getKnowledgeDocs(): KnowledgeDoc[] {
  return knowledgeRepo.findAllDocs();
}
