import { editDistance } from '../scoring/utils';

const SIMPLE_PINYIN_MAP: Record<string, string> = {
  '机': 'ji', '器': 'qi', '学': 'xue', '习': 'xi',
  '人': 'ren', '工': 'gong', '智': 'zhi', '能': 'neng',
  '算': 'suan', '法': 'fa', '数': 'shu', '据': 'ju',
  '搜': 'sou', '索': 'suo', '引': 'yin', '擎': 'qing',
  '语': 'yu', '言': 'yan', '处': 'chu', '理': 'li',
  '模': 'mo', '型': 'xing', '训': 'xun', '练': 'lian',
  '测': 'ce', '试': 'shi', '结': 'jie', '果': 'guo',
  '文': 'wen', '档': 'dang', '查': 'cha', '找': 'zhao',
  '分': 'fen', '析': 'xi', '系': 'xi', '统': 'tong',
  '开': 'kai', '发': 'fa', '设': 'she', '计': 'ji',
};

export class PinyinConverter {
  private pinyinModule: any = null;
  private initialized = false;

  private async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const mod = await import('pinyin-pro' as string) as any;
      this.pinyinModule = mod.default || mod;
    } catch (e) {
      this.pinyinModule = null;
    }
    this.initialized = true;
  }

  async toPinyin(text: string): Promise<string> {
    await this.init();
    if (this.pinyinModule) {
      const result = this.pinyinModule(text, {
        toneType: 'none',
        type: 'string',
      });
      return result.replace(/\s+/g, '');
    }
    return text.split('').map(char => SIMPLE_PINYIN_MAP[char] || char).join('');
  }

  async toPinyinInitials(text: string): Promise<string> {
    await this.init();
    if (this.pinyinModule) {
      const result = this.pinyinModule(text, {
        toneType: 'none',
        pattern: 'first',
        type: 'string',
      });
      return result.replace(/\s+/g, '');
    }
    return text.split('').map(char => {
      const py = SIMPLE_PINYIN_MAP[char];
      return py ? py[0] : char;
    }).join('');
  }
}

interface SpellCheckerOptions {
  maxEdits?: number;
}

export class SpellChecker {
  protected dictionary: Set<string>;
  protected frequency: Map<string, number>;
  protected maxEdits: number;

  constructor(dictionary?: Set<string>, options?: SpellCheckerOptions) {
    this.dictionary = dictionary || new Set();
    this.frequency = new Map();
    this.maxEdits = options?.maxEdits ?? 2;
    this.dictionary.forEach(word => {
      this.frequency.set(word, 1);
    });
  }

  addWord(word: string): void {
    const lowerWord = word.toLowerCase();
    this.dictionary.add(lowerWord);
    this.frequency.set(lowerWord, (this.frequency.get(lowerWord) || 0) + 1);
  }

  addWords(words: string[]): void {
    words.forEach(word => this.addWord(word));
  }

  isCorrect(word: string): boolean {
    return this.dictionary.has(word.toLowerCase());
  }

  private getMaxEditsForQuery(query: string): number {
    return query.length <= 4 ? 1 : this.maxEdits;
  }

  private scoreCandidate(candidate: string, distance: number): number {
    const freq = this.frequency.get(candidate) || 1;
    return (1 / (distance + 1)) * Math.log(freq + 1);
  }

  suggest(query: string, limit: number = 5): string[] {
    const lowerQuery = query.toLowerCase();
    if (this.dictionary.has(lowerQuery)) {
      return [query];
    }

    const maxEdits = this.getMaxEditsForQuery(lowerQuery);
    const candidates: Array<{ word: string; distance: number; score: number }> = [];

    for (const word of this.dictionary) {
      const dist = editDistance(lowerQuery, word);
      if (dist <= maxEdits) {
        const score = this.scoreCandidate(word, dist);
        candidates.push({ word, distance: dist, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, limit).map(c => c.word);
  }

  correct(query: string): string | null {
    const suggestions = this.suggest(query, 1);
    return suggestions.length > 0 ? suggestions[0] : null;
  }
}

export class PinyinSpellChecker extends SpellChecker {
  private pinyinConverter: PinyinConverter;
  private pinyinToTerms: Map<string, string[]>;
  private initialsToTerms: Map<string, string[]>;
  private termToPinyin: Map<string, string>;
  private termToInitials: Map<string, string>;

  constructor(dictionary?: Set<string>, options?: SpellCheckerOptions) {
    super(dictionary, options);
    this.pinyinConverter = new PinyinConverter();
    this.pinyinToTerms = new Map();
    this.initialsToTerms = new Map();
    this.termToPinyin = new Map();
    this.termToInitials = new Map();
  }

  addPinyinMapping(term: string, pinyin: string): void {
    const lowerTerm = term.toLowerCase();
    const lowerPinyin = pinyin.toLowerCase();
    this.termToPinyin.set(lowerTerm, lowerPinyin);

    if (!this.pinyinToTerms.has(lowerPinyin)) {
      this.pinyinToTerms.set(lowerPinyin, []);
    }
    const terms = this.pinyinToTerms.get(lowerPinyin)!;
    if (!terms.includes(lowerTerm)) {
      terms.push(lowerTerm);
    }

    const initials = lowerPinyin.split(/\s+/).map(s => s[0]).join('');
    this.termToInitials.set(lowerTerm, initials);

    if (!this.initialsToTerms.has(initials)) {
      this.initialsToTerms.set(initials, []);
    }
    const initialTerms = this.initialsToTerms.get(initials)!;
    if (!initialTerms.includes(lowerTerm)) {
      initialTerms.push(lowerTerm);
    }

    this.addWord(term);
  }

  async addChineseTerm(term: string): Promise<void> {
    const pinyin = await this.pinyinConverter.toPinyin(term);
    this.addPinyinMapping(term, pinyin);
  }

  searchByPinyin(pinyinQuery: string): string[] {
    const lowerQuery = pinyinQuery.toLowerCase();
    const results: string[] = [];

    for (const [pinyin, terms] of this.pinyinToTerms) {
      if (pinyin.includes(lowerQuery) || lowerQuery.includes(pinyin)) {
        results.push(...terms);
      }
    }

    return [...new Set(results)];
  }

  async correctChinese(query: string): Promise<string | null> {
    const queryPinyin = await this.pinyinConverter.toPinyin(query);
    const queryInitials = await this.pinyinConverter.toPinyinInitials(query);

    let bestMatch: string | null = null;
    let bestScore = -Infinity;

    for (const [term, pinyin] of this.termToPinyin) {
      const initials = this.termToInitials.get(term) || '';
      const pinyinDist = editDistance(queryPinyin, pinyin);
      const initialsDist = editDistance(queryInitials, initials);
      const charDist = editDistance(query, term);

      const score =
        (1 / (pinyinDist + 1)) * 2 +
        (1 / (initialsDist + 1)) * 1.5 +
        (1 / (charDist + 1)) * 1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = term;
      }
    }

    return bestMatch;
  }

  async pinyinFuzzySearch(query: string, limit: number = 5): Promise<string[]> {
    const lowerQuery = query.toLowerCase();
    const results: Array<{ term: string; score: number }> = [];

    const isPinyin = /^[a-z]+$/.test(lowerQuery);

    for (const [term, pinyin] of this.termToPinyin) {
      const initials = this.termToInitials.get(term) || '';
      let score = 0;

      if (isPinyin) {
        if (pinyin === lowerQuery) {
          score = 10;
        } else if (initials === lowerQuery) {
          score = 8;
        } else if (pinyin.startsWith(lowerQuery)) {
          score = 6;
        } else if (initials.startsWith(lowerQuery)) {
          score = 5;
        } else if (pinyin.includes(lowerQuery)) {
          score = 4;
        } else if (initials.includes(lowerQuery)) {
          score = 3;
        } else {
          const pyDist = editDistance(lowerQuery, pinyin);
          const initDist = editDistance(lowerQuery, initials);
          const maxLen = Math.max(lowerQuery.length, pinyin.length, initials.length);
          score = Math.max(
            (1 - pyDist / maxLen) * 2,
            (1 - initDist / maxLen) * 2
          );
        }
      } else {
        const charDist = editDistance(lowerQuery, term);
        score = 1 / (charDist + 1);
      }

      if (score > 0) {
        const freq = this.frequency.get(term) || 1;
        score *= Math.log(freq + 1);
        results.push({ term, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(r => r.term);
  }
}
