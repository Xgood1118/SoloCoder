import {
  Query,
  SearchRequest,
  SearchResponse,
  Pagination,
  SortSpec,
  FieldConfig,
  HighlightSpec,
  SearchResult,
  Document,
  QueryType,
  TermQuery,
  PhraseQuery,
  BooleanQuery,
  FuzzyQuery,
  WildcardQuery,
  MultiFieldQuery,
  FieldType,
} from '../core/types';
import { InvertedIndex } from '../index/inverted-index';
import { QueryParser } from '../query/query-parser';
import { IScorer } from '../scoring/scorer';
import { Highlighter } from './highlighter';

export class SearchEngine {
  private invertedIndex: InvertedIndex;
  private queryParser: QueryParser;
  private scorer: IScorer;
  private highlighter: Highlighter;
  private fieldConfigs: Map<string, FieldConfig>;
  private maxPaginationDepth: number;

  constructor(options?: { maxPaginationDepth?: number }) {
    this.invertedIndex = new InvertedIndex([]);
    this.queryParser = new QueryParser();
    this.scorer = {
      score: () => new Map(),
    };
    this.fieldConfigs = new Map();
    this.highlighter = new Highlighter(this.fieldConfigs);
    this.maxPaginationDepth = options?.maxPaginationDepth ?? 10000;
  }

  search(request: SearchRequest): SearchResponse {
    const startTime = Date.now();

    const pagination: Pagination = request.pagination ?? { from: 0, size: 10 };
    const sortSpecs: SortSpec[] = request.sort ?? [];
    const highlightSpec: HighlightSpec = request.highlight ?? { fields: [] };

    let query: Query;
    if (typeof request.query === 'string') {
      query = this.queryParser.parse(request.query);
    } else {
      query = request.query;
    }

    const expandedQuery = this.expandChineseQuery(query);
    const scoredDocs = this.scorer.score(expandedQuery, this.invertedIndex);

    return this.buildSearchResults(
      scoredDocs,
      expandedQuery,
      sortSpecs,
      pagination,
      highlightSpec,
      startTime
    );
  }

  private expandChineseQuery(query: Query): Query {
    switch (query.type) {
      case QueryType.TERM: {
        const q = query as TermQuery;
        if (this.hasChineseCharacters(q.term)) {
          const bigrams = this.segmentChineseBigram(q.term);
          if (bigrams.length === 1) {
            return query;
          }
          const isDefaultField = !q.field || q.field === '_all' || q.field === this.queryParser.getDefaultField();
          const targetFields = this.getTargetFields(isDefaultField ? '_all' : q.field);
          if (targetFields.length === 1) {
            const field = targetFields[0];
            const termQueries: TermQuery[] = bigrams.map((term) => ({
              type: QueryType.TERM,
              field,
              term,
              boost: q.boost,
            }));
            return {
              type: QueryType.BOOLEAN,
              operator: 'OR',
              queries: termQueries,
              boost: q.boost,
            } as BooleanQuery;
          } else {
            const fieldQueries: BooleanQuery[] = targetFields.map((field) => {
              const fieldConfig = this.fieldConfigs.get(field);
              const fieldWeight = fieldConfig?.weight ?? 1.0;
              const termQueries: TermQuery[] = bigrams.map((term) => ({
                type: QueryType.TERM,
                field,
                term,
                boost: (q.boost ?? 1.0) * fieldWeight,
              }));
              return {
                type: QueryType.BOOLEAN,
                operator: 'OR',
                queries: termQueries,
                boost: fieldWeight,
              } as BooleanQuery;
            });
            return {
              type: QueryType.BOOLEAN,
              operator: 'OR',
              queries: fieldQueries,
              boost: q.boost,
            } as BooleanQuery;
          }
        }
        return query;
      }
      case QueryType.PHRASE: {
        const q = query as PhraseQuery;
        const expandedTerms: string[] = [];
        for (const term of q.terms) {
          if (this.hasChineseCharacters(term)) {
            expandedTerms.push(...this.segmentChineseBigram(term));
          } else {
            expandedTerms.push(term);
          }
        }
        return {
          ...q,
          terms: expandedTerms,
        } as PhraseQuery;
      }
      case QueryType.BOOLEAN: {
        const q = query as BooleanQuery;
        return {
          ...q,
          queries: q.queries.map((sub) => this.expandChineseQuery(sub)),
        } as BooleanQuery;
      }
      case QueryType.FUZZY: {
        const q = query as FuzzyQuery;
        if (this.hasChineseCharacters(q.term)) {
          const bigrams = this.segmentChineseBigram(q.term);
          if (bigrams.length === 1) {
            return query;
          }
          const isDefaultField = !q.field || q.field === '_all' || q.field === this.queryParser.getDefaultField();
          const targetFields = this.getTargetFields(isDefaultField ? '_all' : q.field);
          const allQueries: TermQuery[] = [];
          for (const field of targetFields) {
            const fieldConfig = this.fieldConfigs.get(field);
            const fieldWeight = fieldConfig?.weight ?? 1.0;
            for (const term of bigrams) {
              allQueries.push({
                type: QueryType.TERM,
                field,
                term,
                boost: (q.boost ?? 1.0) * fieldWeight,
              } as TermQuery);
            }
          }
          return {
            type: QueryType.BOOLEAN,
            operator: 'OR',
            queries: allQueries,
            boost: q.boost,
          } as BooleanQuery;
        }
        return query;
      }
      case QueryType.MULTI_FIELD: {
        const q = query as MultiFieldQuery;
        if (!this.hasChineseCharacters(q.query)) {
          return query;
        }
        const boolQueries: BooleanQuery[] = q.fields.map((field) => {
          const bigrams = this.segmentChineseBigram(q.query);
          const termQueries: TermQuery[] = bigrams.map((term) => ({
            type: QueryType.TERM,
            field,
            term,
            boost: (q.fieldWeights?.[field] ?? 1.0) * (q.boost ?? 1.0),
          }));
          return {
            type: QueryType.BOOLEAN,
            operator: 'OR',
            queries: termQueries,
          } as BooleanQuery;
        });
        return {
          type: QueryType.BOOLEAN,
          operator: 'OR',
          queries: boolQueries,
          boost: q.boost,
        } as BooleanQuery;
      }
      default:
        return query;
    }
  }

  private getTargetFields(field: string | undefined): string[] {
    if (field && field !== '_all' && this.fieldConfigs.has(field)) {
      return [field];
    }
    const indexedFields: string[] = [];
    for (const [name, config] of this.fieldConfigs.entries()) {
      if (config.indexed && config.type === FieldType.TEXT) {
        indexedFields.push(name);
      }
    }
    if (indexedFields.length === 0) {
      for (const [name] of this.fieldConfigs.entries()) {
        indexedFields.push(name);
      }
    }
    return indexedFields.length > 0 ? indexedFields : ['content'];
  }

  private hasChineseCharacters(text: string): boolean {
    return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
  }

  private segmentChineseBigram(text: string): string[] {
    const results: string[] = [];
    let buffer = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(char)) {
        buffer += char;
      } else {
        if (buffer) {
          this.addChineseBigrams(buffer, results);
          buffer = '';
        }
      }
    }

    if (buffer) {
      this.addChineseBigrams(buffer, results);
    }

    if (results.length === 0 && buffer.length === 0) {
      results.push(text);
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
    for (let i = 0; i < text.length; i++) {
      results.push(text[i]);
    }
  }

  private applyCustomSort(results: SearchResult[], sortSpecs: SortSpec[]): SearchResult[] {
    if (sortSpecs.length === 0) {
      return results.sort((a, b) => b.score - a.score);
    }

    return results.sort((a, b) => {
      for (const spec of sortSpecs) {
        const aValue = a.document?.fields[spec.field];
        const bValue = b.document?.fields[spec.field];

        if (aValue === undefined && bValue === undefined) continue;
        if (aValue === undefined) return spec.order === 'asc' ? 1 : -1;
        if (bValue === undefined) return spec.order === 'asc' ? -1 : 1;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          const diff = aValue - bValue;
          if (diff !== 0) return spec.order === 'asc' ? diff : -diff;
        } else {
          const aStr = String(aValue);
          const bStr = String(bValue);
          const cmp = aStr.localeCompare(bStr);
          if (cmp !== 0) return spec.order === 'asc' ? cmp : -cmp;
        }
      }
      return b.score - a.score;
    });
  }

  private applyPagination(results: SearchResult[], pagination: Pagination): SearchResult[] {
    const { from, size } = pagination;
    if (from + size > this.maxPaginationDepth) {
      throw new Error('Pagination depth exceeded. Use cursor instead.');
    }
    return results.slice(from, from + size);
  }

  private applyHighlighting(
    query: Query,
    results: SearchResult[],
    highlightSpec: HighlightSpec
  ): void {
    if (highlightSpec.fields.length === 0 || results.length === 0) {
      return;
    }

    const queryTerms = this.extractQueryTerms(query);

    for (const result of results) {
      if (!result.document) continue;

      result.highlights = {};

      for (const fieldName of highlightSpec.fields) {
        const fieldValue = result.document.fields[fieldName];
        if (fieldValue === undefined || fieldValue === null) continue;

        const fieldStr = String(fieldValue);
        const fragments = this.highlighter.highlight(
          result.docId,
          fieldName,
          fieldStr,
          queryTerms,
          highlightSpec
        );

        if (fragments.length > 0) {
          result.highlights[fieldName] = fragments;
        }
      }
    }
  }

  private extractQueryTerms(query: Query): Set<string> {
    const terms = new Set<string>();
    this.collectQueryTerms(query, terms);
    return terms;
  }

  private collectQueryTerms(query: Query, terms: Set<string>): void {
    switch (query.type) {
      case QueryType.TERM: {
        const q = query as TermQuery;
        terms.add(q.term);
        break;
      }
      case QueryType.PHRASE: {
        const q = query as PhraseQuery;
        for (const term of q.terms) {
          terms.add(term);
        }
        break;
      }
      case QueryType.BOOLEAN: {
        const q = query as BooleanQuery;
        for (const subQuery of q.queries) {
          this.collectQueryTerms(subQuery, terms);
        }
        break;
      }
      case QueryType.FUZZY: {
        const q = query as FuzzyQuery;
        terms.add(q.term);
        break;
      }
      case QueryType.WILDCARD: {
        const q = query as WildcardQuery;
        const clean = q.pattern.replace(/[*?]/g, '');
        if (clean.length > 0) {
          terms.add(clean);
        }
        break;
      }
      case QueryType.MULTI_FIELD: {
        const q = query as MultiFieldQuery;
        const words = q.query.split(/\s+/).filter((w) => w.length > 0);
        for (const word of words) {
          terms.add(word);
        }
        break;
      }
    }
  }

  private buildSearchResults(
    scoredDocs: Map<string, number>,
    query: Query,
    sortSpecs: SortSpec[],
    pagination: Pagination,
    highlightSpec: HighlightSpec,
    startTime: number
  ): SearchResponse {
    const results: SearchResult[] = [];
    let maxScore = 0;

    for (const [docId, score] of scoredDocs) {
      const storedFields = this.invertedIndex.getDocument(docId);
      const document: Document | null = storedFields
        ? {
            id: docId,
            fields: storedFields,
            timestamp: 0,
            version: 0,
          }
        : null;

      results.push({
        docId,
        score,
        document,
        highlights: {},
      });

      if (score > maxScore) {
        maxScore = score;
      }
    }

    const sortedResults = this.applyCustomSort(results, sortSpecs);
    const total = sortedResults.length;
    const paginatedResults = this.applyPagination(sortedResults, pagination);
    this.applyHighlighting(query, paginatedResults, highlightSpec);

    const took = Date.now() - startTime;

    return {
      results: paginatedResults,
      total,
      from: pagination.from,
      size: pagination.size,
      took,
      maxScore,
    };
  }
}
