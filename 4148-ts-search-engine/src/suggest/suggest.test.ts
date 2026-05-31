import { Trie, NGramSuggestion, Suggester } from '../suggest/suggest';

describe('Suggest Tests', () => {
  describe('Trie', () => {
    let trie: Trie;

    beforeEach(() => {
      trie = new Trie();
    });

    it('should insert words', () => {
      trie.insert('hello', 5);
      const results = trie.searchPrefix('he', 10);
      expect(results).toContain('hello');
    });

    it('should search by prefix', () => {
      trie.insert('apple', 10);
      trie.insert('app', 5);
      trie.insert('application', 8);
      trie.insert('banana', 3);

      const results = trie.searchPrefix('app', 10);
      expect(results).toContain('apple');
      expect(results).toContain('app');
      expect(results).toContain('application');
      expect(results).not.toContain('banana');
    });

    it('should limit results', () => {
      trie.insert('a1', 1);
      trie.insert('a2', 2);
      trie.insert('a3', 3);
      trie.insert('a4', 4);
      trie.insert('a5', 5);

      const results = trie.searchPrefix('a', 3);
      expect(results.length).toBe(3);
    });

    it('should return empty array for non-existent prefix', () => {
      trie.insert('hello', 1);
      const results = trie.searchPrefix('xyz', 10);
      expect(results).toEqual([]);
    });

    it('should serialize and deserialize', () => {
      trie.insert('hello', 5);
      trie.insert('world', 3);

      const serialized = trie.serialize();
      const newTrie = new Trie();
      newTrie.deserialize(serialized);

      expect(newTrie.searchPrefix('hel', 10)).toContain('hello');
      expect(newTrie.searchPrefix('wor', 10)).toContain('world');
    });
  });

  describe('NGramSuggestion', () => {
    let ngram: NGramSuggestion;

    beforeEach(() => {
      ngram = new NGramSuggestion(2);
    });

    it('should index terms', () => {
      ngram.indexTerm('hello', 5);
      const results = ngram.suggest('hell', 10);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should suggest similar terms', () => {
      ngram.indexTerm('machine', 10);
      ngram.indexTerm('learning', 8);
      ngram.indexTerm('machinery', 5);

      const results = ngram.suggest('machin', 10);
      expect(results).toContain('machine');
    });

    it('should limit results', () => {
      ngram.indexTerm('test1', 1);
      ngram.indexTerm('test2', 2);
      ngram.indexTerm('test3', 3);
      ngram.indexTerm('test4', 4);
      ngram.indexTerm('test5', 5);

      const results = ngram.suggest('test', 3);
      expect(results.length).toBe(3);
    });
  });

  describe('Suggester', () => {
    let suggester: Suggester;

    beforeEach(() => {
      suggester = new Suggester({ useTrie: true, useNGram: true });
    });

    it('should index terms', () => {
      suggester.indexTerms([
        { term: 'machine learning', frequency: 10 },
        { term: 'machine vision', frequency: 8 },
        { term: 'deep learning', frequency: 15 },
      ]);

      const results = suggester.suggest('machine', 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return scored suggestions', () => {
      suggester.indexTerms([
        { term: 'apple', frequency: 10 },
        { term: 'application', frequency: 8 },
        { term: 'banana', frequency: 5 },
      ]);

      const results = suggester.suggest('app', 5);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.suggestion).toBeDefined();
        expect(r.score).toBeGreaterThan(0);
      });
    });

    it('should sort suggestions by score', () => {
      suggester.indexTerms([
        { term: 'apple', frequency: 10 },
        { term: 'app', frequency: 20 },
        { term: 'application', frequency: 5 },
      ]);

      const results = suggester.suggest('app', 10);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it('should work with only trie', () => {
      const trieSuggester = new Suggester({ useTrie: true, useNGram: false });
      trieSuggester.indexTerms([{ term: 'hello', frequency: 5 }]);
      const results = trieSuggester.suggest('hel', 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should work with only ngram', () => {
      const ngramSuggester = new Suggester({ useTrie: false, useNGram: true });
      ngramSuggester.indexTerms([{ term: 'hello', frequency: 5 }]);
      const results = ngramSuggester.suggest('hell', 5);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
