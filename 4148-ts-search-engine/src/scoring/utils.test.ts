import { editDistance, globMatch, computeBM25 } from '../scoring/utils';

describe('Scoring Utils Tests', () => {
  describe('editDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(editDistance('hello', 'hello')).toBe(0);
    });

    it('should return correct distance for insertions', () => {
      expect(editDistance('hello', 'helloo')).toBe(1);
    });

    it('should return correct distance for deletions', () => {
      expect(editDistance('hello', 'hllo')).toBe(1);
    });

    it('should return correct distance for substitutions', () => {
      expect(editDistance('hello', 'hallo')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(editDistance('', 'hello')).toBe(5);
      expect(editDistance('hello', '')).toBe(5);
      expect(editDistance('', '')).toBe(0);
    });

    it('should handle completely different strings', () => {
      expect(editDistance('abc', 'xyz')).toBe(3);
    });
  });

  describe('globMatch', () => {
    it('should match exact strings without wildcards', () => {
      expect(globMatch('hello', 'hello')).toBe(true);
      expect(globMatch('hello', 'world')).toBe(false);
    });

    it('should match asterisk wildcard', () => {
      expect(globMatch('he*', 'hello')).toBe(true);
      expect(globMatch('*llo', 'hello')).toBe(true);
      expect(globMatch('h*o', 'hello')).toBe(true);
      expect(globMatch('*', 'anything')).toBe(true);
    });

    it('should match question mark wildcard', () => {
      expect(globMatch('he?lo', 'hello')).toBe(true);
      expect(globMatch('h?ll?', 'hello')).toBe(true);
      expect(globMatch('he?lo', 'helo')).toBe(false);
    });

    it('should match combined wildcards', () => {
      expect(globMatch('h*l?', 'hello')).toBe(true);
      expect(globMatch('*?*', 'a')).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(globMatch('', '')).toBe(true);
      expect(globMatch('', 'a')).toBe(false);
      expect(globMatch('*', '')).toBe(true);
    });
  });

  describe('computeBM25', () => {
    it('should return positive score for matching term', () => {
      const score = computeBM25(5, 10, 100, 50, 60);
      expect(score).toBeGreaterThan(0);
    });

    it('should return higher score for higher term frequency', () => {
      const score1 = computeBM25(1, 10, 100, 50, 50);
      const score2 = computeBM25(5, 10, 100, 50, 50);
      expect(score2).toBeGreaterThan(score1);
    });

    it('should return higher score for lower document frequency', () => {
      const score1 = computeBM25(5, 50, 100, 50, 50);
      const score2 = computeBM25(5, 10, 100, 50, 50);
      expect(score2).toBeGreaterThan(score1);
    });

    it('should handle field length normalization', () => {
      const score1 = computeBM25(5, 10, 100, 50, 30);
      const score2 = computeBM25(5, 10, 100, 50, 70);
      expect(score1).toBeGreaterThan(score2);
    });

    it('should use custom k1 and b parameters', () => {
      const defaultScore = computeBM25(5, 10, 100, 50, 50);
      const customScore = computeBM25(5, 10, 100, 50, 50, 2.0, 0.5);
      expect(customScore).not.toBe(defaultScore);
    });
  });
});
