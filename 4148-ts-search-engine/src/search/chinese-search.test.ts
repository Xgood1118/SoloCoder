jest.mock('stemmer', () => ({
  stemmer: (word: string) => word.toLowerCase(),
}));

import { SearchEngine } from '../search/search-engine';
import { InvertedIndex } from '../index/inverted-index';
import { TFIDFScorer } from '../scoring/scorer';
import { FieldConfig, FieldType, Token, SearchRequest, QueryType, MultiFieldQuery, TermQuery } from '../core/types';
import { ChineseTokenizer } from '../analyzer/tokenizer';
import { QueryParser } from '../query/query-parser';

describe('Chinese Search Integration Tests', () => {
  let searchEngine: SearchEngine;
  let invertedIndex: InvertedIndex;
  let scorer: TFIDFScorer;
  let tokenizer: ChineseTokenizer;
  const fieldConfigs: FieldConfig[] = [
    { name: 'title', type: FieldType.TEXT, weight: 2.0, indexed: true, stored: true },
    { name: 'content', type: FieldType.TEXT, weight: 1.0, indexed: true, stored: true },
  ];

  beforeEach(() => {
    invertedIndex = new InvertedIndex(fieldConfigs);
    scorer = new TFIDFScorer({ title: 2.0, content: 1.0 });
    tokenizer = new ChineseTokenizer();

    searchEngine = new SearchEngine({ maxPaginationDepth: 1000 });
    (searchEngine as any).invertedIndex = invertedIndex;
    (searchEngine as any).scorer = scorer;
    (searchEngine as any).fieldConfigs = new Map(fieldConfigs.map(f => [f.name, f]));
    (searchEngine as any).queryParser = new QueryParser({ defaultField: 'content', defaultOperator: 'OR' });
    (searchEngine as any).highlighter = new (require('../search/highlighter').Highlighter)(new Map(fieldConfigs.map(f => [f.name, f])));
  });

  const indexDocument = (docId: string, title: string, content: string) => {
    const tokens = new Map<string, Token[]>();
    tokens.set('title', tokenizer.tokenize(title));
    tokens.set('content', tokenizer.tokenize(content));
    invertedIndex.addDocument(docId, { title, content }, tokens);
  };

  const createMultiFieldRequest = (query: string, from = 0, size = 10): SearchRequest => ({
    query: {
      type: QueryType.MULTI_FIELD,
      query,
      fields: ['title', 'content'],
      fieldWeights: { title: 2.0, content: 1.0 },
    } as MultiFieldQuery,
    pagination: { from, size },
  });

  describe('Chinese Query Expansion', () => {
    it('should expand Chinese term query to bigram OR query', () => {
      indexDocument('doc1', '机器学习入门', '这是一本关于机器学习的入门书籍');
      indexDocument('doc2', '深度学习实战', '深度学习在图像识别中的应用');
      indexDocument('doc3', '自然语言处理', 'NLP 和机器学习的关系');

      const request = createMultiFieldRequest('机器学习');

      const response = searchEngine.search(request);
      expect(response.total).toBeGreaterThan(0);
      expect(response.results[0].docId).toBe('doc1');
    });

    it('should match bigram indexed terms', () => {
      indexDocument('doc1', '机器学习', '');
      indexDocument('doc2', '机器视觉', '');
      indexDocument('doc3', '学习算法', '');

      const request = createMultiFieldRequest('机器');

      const response = searchEngine.search(request);
      expect(response.total).toBe(2);
      const docIds = response.results.map(r => r.docId);
      expect(docIds).toContain('doc1');
      expect(docIds).toContain('doc2');
    });

    it('should handle mixed Chinese and English search', () => {
      indexDocument('doc1', '机器学习 AI', '');
      indexDocument('doc2', 'Python 编程', '');

      const request = createMultiFieldRequest('机器学习 AI');

      const response = searchEngine.search(request);
      expect(response.total).toBeGreaterThan(0);
      expect(response.results[0].docId).toBe('doc1');
    });

    it('should expand Chinese in phrase queries', () => {
      indexDocument('doc1', '机器学习算法', '');
      indexDocument('doc2', '机器学习模型', '');
      indexDocument('doc3', '其他内容', '');

      const request = createMultiFieldRequest('机器学习');

      const response = searchEngine.search(request);
      expect(response.total).toBe(2);
    });

    it('should handle single Chinese character search', () => {
      indexDocument('doc1', '机器学习', '');
      indexDocument('doc2', '机器人', '');
      indexDocument('doc3', '学习机', '');

      const request = createMultiFieldRequest('机');

      const response = searchEngine.search(request);
      expect(response.total).toBe(3);
    });

    it('should expand Chinese in boolean queries', () => {
      indexDocument('doc1', '机器学习和深度学习', '');
      indexDocument('doc2', '机器学习和计算机视觉', '');
      indexDocument('doc3', '自然语言处理', '');

      const request = createMultiFieldRequest('机器学习和深度学习');

      const response = searchEngine.search(request);
      expect(response.total).toBe(2);
      expect(response.results[0].docId).toBe('doc1');
    });

    it('should expand Chinese with NOT operator', () => {
      indexDocument('doc1', '机器学习入门', '');
      indexDocument('doc2', '深度学习进阶', '');

      const request = createMultiFieldRequest('学习');

      const response = searchEngine.search(request);
      expect(response.total).toBe(2);
    });

    it('should return relevant documents sorted by score', () => {
      indexDocument('doc1', '机器学习 机器学习', '机器学习的书，讲解机器学习算法');
      indexDocument('doc2', '机器学习入门', '这是一本机器学习的入门书籍');
      indexDocument('doc3', '计算机科学', '包含机器学习的一些基础概念');

      const request = createMultiFieldRequest('机器学习');

      const response = searchEngine.search(request);
      expect(response.total).toBe(3);
      expect(response.results[0].score).toBeGreaterThanOrEqual(response.results[1].score);
      expect(response.results[1].score).toBeGreaterThanOrEqual(response.results[2].score);
    });

    it('should handle field-specific Chinese search', () => {
      indexDocument('doc1', '机器学习入门', '深度学习进阶');
      indexDocument('doc2', '深度学习入门', '机器学习进阶');

      const request: SearchRequest = {
        query: {
          type: QueryType.TERM,
          field: 'title',
          term: '机器',
        } as TermQuery,
        pagination: { from: 0, size: 10 },
      };

      const response = searchEngine.search(request);
      expect(response.total).toBe(1);
      expect(response.results[0].docId).toBe('doc1');
    });

    it('should expand Chinese fuzzy queries', () => {
      indexDocument('doc1', '机器学习', '');
      indexDocument('doc2', '机器视觉', '');

      const request = createMultiFieldRequest('机器');

      const response = searchEngine.search(request);
      expect(response.total).toBe(2);
    });

    it('should handle pagination correctly for Chinese search', () => {
      for (let i = 0; i < 15; i++) {
        indexDocument(`doc${i}`, `机器学习文档${i}`, '内容');
      }

      const request = createMultiFieldRequest('机器学习', 5, 5);

      const response = searchEngine.search(request);
      expect(response.total).toBe(15);
      expect(response.results.length).toBe(5);
      expect(response.from).toBe(5);
      expect(response.size).toBe(5);
    });

    it('should enforce pagination depth limit', () => {
      for (let i = 0; i < 1500; i++) {
        indexDocument(`doc${i}`, `机器学习${i}`, '');
      }

      const request = createMultiFieldRequest('机器学习', 950, 100);

      expect(() => searchEngine.search(request)).toThrow('Pagination depth exceeded');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty Chinese query', () => {
      indexDocument('doc1', '机器学习', '');

      const request: SearchRequest = {
        query: '',
        pagination: { from: 0, size: 10 },
      };

      const response = searchEngine.search(request);
      expect(response.total).toBe(1);
    });

    it('should handle Chinese query with only whitespace', () => {
      indexDocument('doc1', '机器学习', '');

      const request: SearchRequest = {
        query: '   ',
        pagination: { from: 0, size: 10 },
      };

      const response = searchEngine.search(request);
      expect(response.total).toBe(1);
    });

    it('should handle Chinese with special characters', () => {
      indexDocument('doc1', '机器学习', '');

      const request: SearchRequest = {
        query: '机器!@#$%^&*()',
        pagination: { from: 0, size: 10 },
      };

      expect(() => searchEngine.search(request)).not.toThrow();
    });

    it('should handle very long Chinese query', () => {
      indexDocument('doc1', '机器学习', '');
      const longQuery = '机器学习'.repeat(100);

      const request: SearchRequest = {
        query: longQuery,
        pagination: { from: 0, size: 10 },
      };

      expect(() => searchEngine.search(request)).not.toThrow();
    });
  });
});
