import { QueryParser } from '../query/query-parser';

describe('QueryParser Tests', () => {
  let parser: QueryParser;

  beforeEach(() => {
    parser = new QueryParser();
  });

  describe('Basic Queries', () => {
    it('should parse empty query as MatchAllQuery', () => {
      const query = parser.parse('');
      expect(query.type).toBe('match_all');
    });

    it('should parse single term as TermQuery', () => {
      const query = parser.parse('hello');
      expect(query.type).toBe('term');
    });

    it('should parse multiple terms as BooleanQuery with implicit AND', () => {
      const query = parser.parse('hello world');
      expect(query.type).toBe('boolean');
    });
  });

  describe('Phrase Queries', () => {
    it('should parse quoted text as PhraseQuery', () => {
      const query = parser.parse('"machine learning"');
      expect(query.type).toBe('phrase');
    });
  });

  describe('Boolean Operators', () => {
    it('should parse AND operator', () => {
      const query = parser.parse('python AND javascript');
      expect(query.type).toBe('boolean');
    });

    it('should parse OR operator', () => {
      const query = parser.parse('python OR javascript');
      expect(query.type).toBe('boolean');
    });

    it('should parse NOT operator', () => {
      const query = parser.parse('python NOT javascript');
      expect(query.type).toBe('boolean');
    });
  });

  describe('Prefix Operators', () => {
    it('should parse + as required term', () => {
      const query = parser.parse('+python javascript');
      expect(query.type).toBe('boolean');
    });

    it('should parse - as excluded term', () => {
      const query = parser.parse('python -javascript');
      expect(query.type).toBe('boolean');
    });
  });

  describe('Field-specific Queries', () => {
    it('should parse field:term syntax', () => {
      const query = parser.parse('title:python');
      expect(query.type).toBe('term');
    });
  });

  describe('Range Queries', () => {
    it('should parse inclusive range with brackets', () => {
      const query = parser.parse('price:[10 TO 100]');
      expect(query.type).toBe('range');
    });

    it('should parse exclusive range with braces', () => {
      const query = parser.parse('price:{10 TO 100}');
      expect(query.type).toBe('range');
    });
  });

  describe('Fuzzy Queries', () => {
    it('should parse fuzzy query with tilde', () => {
      const query = parser.parse('python~2');
      expect(query.type).toBe('fuzzy');
    });

    it('should parse fuzzy query with default max edits', () => {
      const query = parser.parse('python~');
      expect(query.type).toBe('fuzzy');
    });
  });

  describe('Wildcard Queries', () => {
    it('should parse wildcard with asterisk', () => {
      const query = parser.parse('py*');
      expect(query.type).toBe('wildcard');
    });

    it('should parse wildcard with question mark', () => {
      const query = parser.parse('pyth?n');
      expect(query.type).toBe('wildcard');
    });
  });

  describe('Parentheses', () => {
    it('should parse nested queries with parentheses', () => {
      const query = parser.parse('(python OR java) AND web');
      expect(query.type).toBe('boolean');
    });
  });

  describe('Match All Query', () => {
    it('should parse *:* as MatchAllQuery', () => {
      const query = parser.parse('*:*');
      expect(query.type).toBe('match_all');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long queries', () => {
      const longQuery = 'a'.repeat(1500);
      expect(() => parser.parse(longQuery)).not.toThrow();
    });

    it('should handle special characters', () => {
      expect(() => parser.parse('hello!@#$%^&*()')).not.toThrow();
    });

    it('should handle escaped quotes', () => {
      expect(() => parser.parse('say \\"hello\\"')).not.toThrow();
    });
  });
});
