import * as sensitiveWordRepo from '../repositories/sensitive-word.repository.js';
import type { SensitiveWord, SensitiveFilterResult } from '../../shared/types.js';

export function filterText(text: string): SensitiveFilterResult {
  const allWords = sensitiveWordRepo.findAll();

  const highMatches = allWords.filter(w => w.level === 'high' && text.includes(w.word));
  if (highMatches.length > 0) {
    return { filtered: true, text, level: 'high', matchedWords: highMatches };
  }

  const mediumMatches = allWords.filter(w => w.level === 'medium' && text.includes(w.word));
  if (mediumMatches.length > 0) {
    let replacedText = text;
    for (const w of mediumMatches) {
      replacedText = replacedText.split(w.word).join('***');
    }
    return { filtered: true, text: replacedText, level: 'medium', matchedWords: mediumMatches };
  }

  const lowMatches = allWords.filter(w => w.level === 'low' && text.includes(w.word));
  if (lowMatches.length > 0) {
    return { filtered: false, text, level: 'low', matchedWords: lowMatches };
  }

  return { filtered: false, text, level: null, matchedWords: [] };
}

export function addSensitiveWord(
  word: string,
  level: SensitiveWord['level'],
  category: string
): SensitiveWord {
  return sensitiveWordRepo.create(word, level, category);
}

export function updateSensitiveWord(
  id: string,
  word?: string,
  level?: SensitiveWord['level'],
  category?: string
): SensitiveWord | null {
  return sensitiveWordRepo.update(id, word, level, category);
}

export function deleteSensitiveWord(id: string): boolean {
  return sensitiveWordRepo.remove(id);
}

export function getSensitiveWords(): SensitiveWord[] {
  return sensitiveWordRepo.findAll();
}

export function batchImport(
  words: Array<{ word: string; level: SensitiveWord['level']; category: string }>
): { count: number } {
  const count = sensitiveWordRepo.batchCreate(words);
  return { count };
}
