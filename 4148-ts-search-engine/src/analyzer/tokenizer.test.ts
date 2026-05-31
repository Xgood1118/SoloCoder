jest.mock('stemmer', () => ({
  stemmer: (word: string) => word.toLowerCase(),
}));

import { EnglishTokenizer, ChineseTokenizer, MixedTokenizer } from '../analyzer/tokenizer';

describe('Tokenizer Tests', () => {
  describe('EnglishTokenizer', () => {
    let tokenizer: EnglishTokenizer;

    beforeEach(() => {
      tokenizer = new EnglishTokenizer();
    });

    it('should tokenize simple text', () => {
      const tokens = tokenizer.tokenize('The quick brown fox jumps over the lazy dog');
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].term).toBe('quick');
    });

    it('should lowercase all terms', () => {
      const tokens = tokenizer.tokenize('HELLO WORLD');
      expect(tokens.every(t => t.term === t.term.toLowerCase())).toBe(true);
    });

    it('should stem words', () => {
      const tokens = tokenizer.tokenize('running runs ran');
      expect(tokens.some(t => t.term === 'run')).toBe(true);
    });

    it('should filter stop words', () => {
      const tokens = tokenizer.tokenize('the is a an and or but in on at');
      expect(tokens.length).toBe(0);
    });

    it('should track positions correctly', () => {
      const tokens = tokenizer.tokenize('hello world test');
      expect(tokens[0].position).toBe(0);
      expect(tokens[1].position).toBe(1);
      expect(tokens[2].position).toBe(2);
    });

    it('should add and remove stop words', () => {
      tokenizer.addStopWord('customstop');
      let tokens = tokenizer.tokenize('customstop hello');
      expect(tokens.length).toBe(1);
      expect(tokens[0].term).toBe('hello');

      tokenizer.removeStopWord('customstop');
      tokens = tokenizer.tokenize('customstop hello');
      expect(tokens.length).toBe(2);
    });
  });

  describe('ChineseTokenizer', () => {
    let tokenizer: ChineseTokenizer;

    beforeEach(() => {
      tokenizer = new ChineseTokenizer();
    });

    it('should use bigram fallback for Chinese text', () => {
      const tokens = tokenizer.tokenize('机器学习');
      expect(tokens.length).toBeGreaterThan(0);
      const terms = tokens.map(t => t.term);
      expect(terms).toContain('机器');
      expect(terms).toContain('器学');
      expect(terms).toContain('学习');
    });

    it('should handle mixed Chinese and English text', () => {
      const tokens = tokenizer.tokenize('机器学习 AI 人工智能');
      const terms = tokens.map(t => t.term);
      expect(terms).toContain('ai');
    });

    it('should track offsets correctly', () => {
      const tokens = tokenizer.tokenize('机器学习');
      expect(tokens[0].startOffset).toBe(0);
      expect(tokens[0].endOffset).toBe(2);
    });

    it('should support adding custom words', () => {
      tokenizer.addWord('深度学习');
      const tokens = tokenizer.tokenize('深度学习');
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('MixedTokenizer', () => {
    let tokenizer: MixedTokenizer;

    beforeEach(() => {
      tokenizer = new MixedTokenizer();
    });

    it('should handle mixed Chinese and English text', () => {
      const tokens = tokenizer.tokenize('机器学习 is great');
      const terms = tokens.map(t => t.term);
      expect(terms.some(t => t.includes('机器'))).toBe(true);
      expect(terms).toContain('great');
    });

    it('should maintain global position order', () => {
      const tokens = tokenizer.tokenize('机器学习 AI');
      for (let i = 1; i < tokens.length; i++) {
        expect(tokens[i].position).toBeGreaterThan(tokens[i - 1].position);
      }
    });
  });
});
