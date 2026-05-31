jest.mock('stemmer', () => ({
  stemmer: (word: string) => word.toLowerCase(),
}));

import { SearchEngine } from '../search/search-engine';
import { InvertedIndex } from '../index/inverted-index';
import { TFIDFScorer } from '../scoring/scorer';
import { FieldConfig, FieldType, Token, SearchRequest, QueryType, MultiFieldQuery, TermQuery } from '../core/types';
import { ChineseTokenizer } from '../analyzer/tokenizer';
import { QueryParser } from '../query/query-parser';

describe('Chinese Search End-to-End Tests', () => {
  let searchEngine: SearchEngine;
  let invertedIndex: InvertedIndex;
  let scorer: TFIDFScorer;
  let tokenizer: ChineseTokenizer;
  let queryParser: QueryParser;
  const fieldConfigs: FieldConfig[] = [
    { name: 'title', type: FieldType.TEXT, weight: 2.0, indexed: true, stored: true },
    { name: 'content', type: FieldType.TEXT, weight: 1.0, indexed: true, stored: true },
  ];

  beforeEach(() => {
    invertedIndex = new InvertedIndex(fieldConfigs);
    scorer = new TFIDFScorer({ title: 2.0, content: 1.0 });
    tokenizer = new ChineseTokenizer();
    queryParser = new QueryParser({ defaultField: 'content', defaultOperator: 'OR' });

    searchEngine = new SearchEngine({ maxPaginationDepth: 1000 });
    (searchEngine as any).invertedIndex = invertedIndex;
    (searchEngine as any).scorer = scorer;
    (searchEngine as any).fieldConfigs = new Map(fieldConfigs.map(f => [f.name, f]));
    (searchEngine as any).queryParser = queryParser;
    (searchEngine as any).highlighter = new (require('../search/highlighter').Highlighter)(new Map(fieldConfigs.map(f => [f.name, f])));
  });

  const indexDocument = (docId: string, title: string, content: string) => {
    const tokens = new Map<string, Token[]>();
    tokens.set('title', tokenizer.tokenize(title));
    tokens.set('content', tokenizer.tokenize(content));
    invertedIndex.addDocument(docId, { title, content }, tokens);
  };

  describe('QueryParser string input', () => {
    it('should expand Chinese string query via SearchEngine', () => {
      indexDocument('doc1', '机器学习入门', '');
      indexDocument('doc2', '深度学习进阶', '');

      const request: SearchRequest = {
        query: '机器学习',
        pagination: { from: 0, size: 10 },
      };

      const response = searchEngine.search(request);
      expect(response.total).toBeGreaterThan(0);
      expect(response.results[0].docId).toBe('doc1');
    });

    it('should expand Chinese with explicit content field', () => {
      indexDocument('doc1', '', '机器学习入门书籍');
      indexDocument('doc2', '', '深度学习框架');

      const request: any = {
        query: {
          type: QueryType.TERM,
          field: 'content',
          term: '机器',
        },
        pagination: { from: 0, size: 10 },
      };

      const response = searchEngine.search(request);
      expect(response.total).toBe(1);
      expect(response.results[0].docId).toBe('doc1');
    });

    it('should handle multi-field Chinese query', () => {
      indexDocument('doc1', '机器学习', '');
      indexDocument('doc2', '', '机器学习教程');

      const request: any = {
        query: {
          type: QueryType.MULTI_FIELD,
          query: '机器学习',
          fields: ['title', 'content'],
          fieldWeights: { title: 2.0, content: 1.0 },
        },
        pagination: { from: 0, size: 10 },
      };

      const response = searchEngine.search(request);
      expect(response.total).toBe(2);
    });

    it('should return correct score for more relevant documents', () => {
      indexDocument('doc1', '机器学习 机器学习', '机器学习算法');
      indexDocument('doc2', '其他主题', '不相关内容');
      indexDocument('doc3', '机器学习入门', '');

      const request: SearchRequest = {
        query: '机器学习',
        pagination: { from: 0, size: 10 },
      };

      const response = searchEngine.search(request);
      expect(response.total).toBe(2);
      expect(response.results[0].docId).toBe('doc1');
      expect(response.results[1].docId).toBe('doc3');
      expect(response.results[0].score).toBeGreaterThan(response.results[1].score);
    });

    it('should verify index has bigram terms', () => {
      indexDocument('doc1', '机器学习', '');
      
      const terms = invertedIndex.getAllTerms('title');
      expect(terms).toContain('机器');
      expect(terms).toContain('器学');
      expect(terms).toContain('学习');
      expect(terms).toContain('机');
      expect(terms).toContain('器');
      expect(terms).toContain('学');
      expect(terms).toContain('习');
    });

    it('should verify query expansion generates correct terms', () => {
      indexDocument('doc1', '机器学习', '');

      const expandFn = (searchEngine as any).expandChineseQuery.bind(searchEngine);
      const segmentFn = (searchEngine as any).segmentChineseBigram.bind(searchEngine);
      
      const bigrams = segmentFn('机器学习');
      expect(bigrams).toContain('机器');
      expect(bigrams).toContain('器学');
      expect(bigrams).toContain('学习');
      expect(bigrams).toContain('机');
      expect(bigrams).toContain('器');
      expect(bigrams).toContain('学');
      expect(bigrams).toContain('习');
    });

    it('should verify each bigram term matches', () => {
      indexDocument('doc1', '机器学习', '');

      const testTerm = (term: string) => {
        const request: any = {
          query: {
            type: QueryType.TERM,
            field: 'title',
            term,
          },
          pagination: { from: 0, size: 10 },
        };
        const response = searchEngine.search(request);
        return response.total;
      };

      expect(testTerm('机器')).toBe(1);
      expect(testTerm('器学')).toBe(1);
      expect(testTerm('学习')).toBe(1);
    });
  });
});
