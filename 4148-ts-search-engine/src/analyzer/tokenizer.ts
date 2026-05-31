import { Token } from '../core/types';
// @ts-ignore
import { stemmer } from 'stemmer';

export interface ITokenizer {
  tokenize(text: string): Token[];
}

export class ChineseTokenizer implements ITokenizer {
  private segmentit: any = null;
  private segmentitLoaded = false;
  private segmentitLoadFailed = false;
  private customDictPath: string | null = null;
  private customWords: string[] = [];

  private async loadSegmentit(): Promise<any> {
    if (this.segmentitLoaded) return this.segmentit;
    if (this.segmentitLoadFailed) return null;
    try {
      // @ts-ignore
      const mod = await import('segmentit');
      let segmentit = mod.default || mod;
      if (segmentit.default) {
        segmentit = segmentit.default;
      }
      if (typeof segmentit.loadDict === 'function') {
        if (this.customDictPath) {
          segmentit.loadDict(this.customDictPath);
        } else {
          segmentit.loadDict();
        }
      }
      if (typeof segmentit.useDefaultConfig === 'function') {
        segmentit.useDefaultConfig();
      }
      for (const word of this.customWords) {
        if (typeof segmentit.addWord === 'function') {
          segmentit.addWord(word);
        }
      }
      this.segmentit = segmentit;
      this.segmentitLoaded = true;
      return this.segmentit;
    } catch {
      this.segmentitLoadFailed = true;
      return null;
    }
  }

  private simpleSegment(text: string): string[] {
    const results: string[] = [];
    let buffer = '';
    let chineseBuffer = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(char)) {
        if (buffer) {
          results.push(buffer);
          buffer = '';
        }
        chineseBuffer += char;
      } else if (/[a-zA-Z0-9]/.test(char)) {
        if (chineseBuffer) {
          this.addChineseBigrams(chineseBuffer, results);
          chineseBuffer = '';
        }
        buffer += char;
      } else {
        if (buffer) {
          results.push(buffer);
          buffer = '';
        }
        if (chineseBuffer) {
          this.addChineseBigrams(chineseBuffer, results);
          chineseBuffer = '';
        }
      }
    }
    
    if (buffer) {
      results.push(buffer);
    }
    if (chineseBuffer) {
      this.addChineseBigrams(chineseBuffer, results);
    }
    
    return results;
  }

  private addChineseBigrams(text: string, results: string[]): void {
    if (text.length === 1) {
      results.push(text);
      return;
    }
    for (let i = 0; i < text.length - 1; i++) {
      results.push(text.substring(i, i + 2));
    }
    if (text.length <= 2) {
      return;
    }
    for (let i = 0; i < text.length; i++) {
      results.push(text[i]);
    }
  }

  tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let position = 0;

    if (this.segmentitLoaded && this.segmentit) {
      let words: string[] = [];
      try {
        const result = this.segmentit(text);
        if (Array.isArray(result)) {
          words = result.map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && item.word) return item.word;
            return String(item);
          });
        }
      } catch {
        words = this.simpleSegment(text);
      }
      let offset = 0;
      for (const word of words) {
        if (word && word.trim()) {
          const startOffset = text.indexOf(word, offset);
          const actualStart = startOffset >= 0 ? startOffset : offset;
          tokens.push({
            term: word.trim(),
            position,
            startOffset: actualStart,
            endOffset: actualStart + word.length,
          });
          position++;
          offset = actualStart + word.length;
        }
      }
    } else {
      this.loadSegmentit();
      const words = this.simpleSegment(text);
      let offset = 0;
      for (const word of words) {
        if (word) {
          const startOffset = text.indexOf(word, offset);
          const actualStart = startOffset >= 0 ? startOffset : offset;
          tokens.push({
            term: word,
            position,
            startOffset: actualStart,
            endOffset: actualStart + word.length,
          });
          position++;
          offset = actualStart + word.length;
        }
      }
    }

    return tokens;
  }

  setDictPath(path: string): void {
    this.customDictPath = path;
    this.segmentitLoaded = false;
    this.segmentitLoadFailed = false;
    this.segmentit = null;
  }

  addWord(word: string): void {
    this.customWords.push(word);
    if (this.segmentitLoaded && this.segmentit) {
      try {
        if (typeof this.segmentit.addWord === 'function') {
          this.segmentit.addWord(word);
        }
      } catch {}
    }
  }
}

const DEFAULT_STOP_WORDS = new Set([
  'the', 'is', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'by', 'from', 'as', 'it', 'that', 'this',
  'which', 'be', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'not', 'no', 'if', 'then', 'than', 'so', 'too', 'very', 'just', 'about',
  'up', 'out', 'into', 'over', 'after',
]);

export class EnglishTokenizer implements ITokenizer {
  private stopWords: Set<string>;

  constructor(stopWords?: Set<string>) {
    this.stopWords = stopWords ?? new Set(DEFAULT_STOP_WORDS);
  }

  tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    const lower = text.toLowerCase();
    const regex = /[a-z0-9]+/g;
    let match: RegExpExecArray | null;
    let position = 0;

    while ((match = regex.exec(lower)) !== null) {
      const word = match[0];
      if (this.stopWords.has(word)) continue;
      const stemmed = stemmer(word);
      tokens.push({
        term: stemmed,
        position,
        startOffset: match.index,
        endOffset: match.index + word.length,
      });
      position++;
    }

    return tokens;
  }

  addStopWord(word: string): void {
    this.stopWords.add(word.toLowerCase());
  }

  removeStopWord(word: string): void {
    this.stopWords.delete(word.toLowerCase());
  }
}

export class MixedTokenizer implements ITokenizer {
  private chineseTokenizer: ChineseTokenizer;
  private englishTokenizer: EnglishTokenizer;

  constructor(
    chineseTokenizer?: ChineseTokenizer,
    englishTokenizer?: EnglishTokenizer,
  ) {
    this.chineseTokenizer = chineseTokenizer ?? new ChineseTokenizer();
    this.englishTokenizer = englishTokenizer ?? new EnglishTokenizer();
  }

  tokenize(text: string): Token[] {
    const segments: { type: 'chinese' | 'english' | 'other'; text: string; startOffset: number }[] = [];
    let i = 0;
    while (i < text.length) {
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text[i])) {
        let start = i;
        while (i < text.length && /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text[i])) {
          i++;
        }
        segments.push({ type: 'chinese', text: text.slice(start, i), startOffset: start });
      } else if (/[a-zA-Z0-9]/.test(text[i])) {
        let start = i;
        while (i < text.length && /[a-zA-Z0-9]/.test(text[i])) {
          i++;
        }
        segments.push({ type: 'english', text: text.slice(start, i), startOffset: start });
      } else {
        i++;
      }
    }

    const allTokens: Token[] = [];
    let position = 0;

    for (const seg of segments) {
      let tokens: Token[];
      if (seg.type === 'chinese') {
        tokens = this.chineseTokenizer.tokenize(seg.text);
      } else {
        tokens = this.englishTokenizer.tokenize(seg.text);
      }

      for (const token of tokens) {
        allTokens.push({
          term: token.term,
          position,
          startOffset: token.startOffset + seg.startOffset,
          endOffset: token.endOffset + seg.startOffset,
        });
        position++;
      }
    }

    return allTokens;
  }
}
