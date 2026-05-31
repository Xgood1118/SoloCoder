export enum FieldType {
  TEXT = 'TEXT',
  KEYWORD = 'KEYWORD',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  BOOLEAN = 'BOOLEAN',
}

export interface FieldConfig {
  name: string;
  type: FieldType;
  weight?: number;
  indexed?: boolean;
  stored?: boolean;
  analyzer?: string;
}

export interface Document {
  id: string;
  fields: Record<string, any>;
  timestamp: number;
  version: number;
}

export interface Token {
  term: string;
  position: number;
  startOffset: number;
  endOffset: number;
}

export interface Posting {
  docId: string;
  termFreq: number;
  positions: number[];
  fieldOffsets: Map<string, number[]>;
}

export interface PostingsList {
  term: string;
  docFreq: number;
  postings: Posting[];
}

export enum QueryType {
  TERM = 'TERM',
  PHRASE = 'PHRASE',
  BOOLEAN = 'BOOLEAN',
  FUZZY = 'FUZZY',
  RANGE = 'RANGE',
  MULTI_FIELD = 'MULTI_FIELD',
  WILDCARD = 'WILDCARD',
  MATCH_ALL = 'MATCH_ALL',
}

export interface Query {
  type: QueryType;
  boost?: number;
}

export interface TermQuery extends Query {
  type: QueryType.TERM;
  field: string;
  term: string;
}

export interface PhraseQuery extends Query {
  type: QueryType.PHRASE;
  field: string;
  terms: string[];
}

export interface BooleanQuery extends Query {
  type: QueryType.BOOLEAN;
  operator: 'AND' | 'OR' | 'NOT';
  queries: Query[];
}

export interface FuzzyQuery extends Query {
  type: QueryType.FUZZY;
  field: string;
  term: string;
  maxEdits?: number;
  prefixLength?: number;
}

export interface RangeQuery extends Query {
  type: QueryType.RANGE;
  field: string;
  gt?: number | string;
  gte?: number | string;
  lt?: number | string;
  lte?: number | string;
}

export interface MultiFieldQuery extends Query {
  type: QueryType.MULTI_FIELD;
  query: string;
  fields: string[];
  fieldWeights: Record<string, number>;
}

export interface WildcardQuery extends Query {
  type: QueryType.WILDCARD;
  field: string;
  pattern: string;
}

export interface MatchAllQuery extends Query {
  type: QueryType.MATCH_ALL;
}

export type SortOrder = 'asc' | 'desc';

export interface SortSpec {
  field: string;
  order: SortOrder;
}

export interface Pagination {
  from: number;
  size: number;
  maxDepth?: number;
}

export interface SearchResult {
  docId: string;
  score: number;
  document: Document | null;
  highlights: Record<string, string[]>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  from: number;
  size: number;
  took: number;
  maxScore: number;
}

export interface IndexStats {
  docCount: number;
  termCount: number;
  indexSize: number;
  lastUpdated: number;
}

export interface HighlightSpec {
  fields: string[];
  preTag?: string;
  postTag?: string;
  fragmentSize?: number;
}

export interface SearchRequest {
  query: Query | string;
  pagination?: Pagination;
  sort?: SortSpec[];
  highlight?: HighlightSpec;
}
