import { InvertedIndex } from '../index/inverted-index';
import { FieldConfig, FieldType, Token } from '../core/types';

describe('InvertedIndex Tests', () => {
  let index: InvertedIndex;
  const fieldConfigs: FieldConfig[] = [
    { name: 'title', type: FieldType.TEXT, weight: 2.0, indexed: true, stored: true },
    { name: 'content', type: FieldType.TEXT, weight: 1.0, indexed: true, stored: true },
  ];

  beforeEach(() => {
    index = new InvertedIndex(fieldConfigs);
  });

  it('should create an empty index', () => {
    expect(index.getDocCount()).toBe(0);
    const stats = index.getStats();
    expect(stats.docCount).toBe(0);
  });

  it('should add a document with tokens', () => {
    const tokens = new Map<string, Token[]>();
    tokens.set('title', [
      { term: 'hello', position: 0, startOffset: 0, endOffset: 5 },
      { term: 'world', position: 1, startOffset: 6, endOffset: 11 },
    ]);

    const fields = {
      title: 'hello world',
      content: 'test content',
    };

    index.addDocument('doc1', fields, tokens);
    expect(index.getDocCount()).toBe(1);
    expect(index.getDocument('doc1')).toBeDefined();
  });

  it('should retrieve postings for a term', () => {
    const tokens = new Map<string, Token[]>();
    tokens.set('content', [
      { term: 'hello', position: 0, startOffset: 0, endOffset: 5 },
    ]);

    index.addDocument('doc1', { content: 'hello' }, tokens);
    const postings = index.getPostings('content', 'hello');

    expect(postings).toBeDefined();
    expect(postings?.docFreq).toBe(1);
    expect(postings?.postings.length).toBe(1);
  });

  it('should remove a document', () => {
    const tokens = new Map<string, Token[]>();
    tokens.set('content', [
      { term: 'hello', position: 0, startOffset: 0, endOffset: 5 },
    ]);

    index.addDocument('doc1', { content: 'hello' }, tokens);
    expect(index.getDocCount()).toBe(1);

    const result = index.removeDocument('doc1');
    expect(result).toBe(true);
    expect(index.getDocCount()).toBe(0);
    expect(index.getDocument('doc1')).toBeNull();
  });

  it('should return false when removing non-existent document', () => {
    const result = index.removeDocument('nonexistent');
    expect(result).toBe(false);
  });

  it('should track term frequency', () => {
    const tokens = new Map<string, Token[]>();
    tokens.set('content', [
      { term: 'hello', position: 0, startOffset: 0, endOffset: 5 },
      { term: 'hello', position: 1, startOffset: 6, endOffset: 11 },
      { term: 'world', position: 2, startOffset: 12, endOffset: 17 },
    ]);

    index.addDocument('doc1', { content: 'hello hello world' }, tokens);

    const tf = index.getTermFrequency('content', 'hello', 'doc1');
    expect(tf).toBe(2);
  });

  it('should track document frequency', () => {
    const tokens1 = new Map<string, Token[]>();
    tokens1.set('content', [{ term: 'hello', position: 0, startOffset: 0, endOffset: 5 }]);
    index.addDocument('doc1', { content: 'hello' }, tokens1);

    const tokens2 = new Map<string, Token[]>();
    tokens2.set('content', [{ term: 'hello', position: 0, startOffset: 0, endOffset: 5 }]);
    index.addDocument('doc2', { content: 'hello' }, tokens2);

    const df = index.getDocFrequency('content', 'hello');
    expect(df).toBe(2);
  });

  it('should get all terms for a field', () => {
    const tokens = new Map<string, Token[]>();
    tokens.set('content', [
      { term: 'hello', position: 0, startOffset: 0, endOffset: 5 },
      { term: 'world', position: 1, startOffset: 6, endOffset: 11 },
    ]);

    index.addDocument('doc1', { content: 'hello world' }, tokens);
    const terms = index.getAllTerms('content');

    expect(terms).toContain('hello');
    expect(terms).toContain('world');
  });

  it('should clear the index', () => {
    const tokens = new Map<string, Token[]>();
    tokens.set('content', [{ term: 'hello', position: 0, startOffset: 0, endOffset: 5 }]);

    index.addDocument('doc1', { content: 'hello' }, tokens);
    expect(index.getDocCount()).toBe(1);

    index.clear();
    expect(index.getDocCount()).toBe(0);
  });

  it('should serialize and deserialize', () => {
    const tokens = new Map<string, Token[]>();
    tokens.set('content', [{ term: 'hello', position: 0, startOffset: 0, endOffset: 5 }]);

    index.addDocument('doc1', { content: 'hello' }, tokens);
    const serialized = index.serialize();

    const newIndex = new InvertedIndex(fieldConfigs);
    newIndex.deserialize(serialized);

    expect(newIndex.getDocCount()).toBe(1);
    expect(newIndex.getDocument('doc1')).toBeDefined();
  });
});
