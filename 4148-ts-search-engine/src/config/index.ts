export interface SearchEngineConfig {
  maxPaginationDepth: number;
  defaultField: string;
  defaultOperator: 'AND' | 'OR';
  cacheCapacity: number;
  cacheTTL: number;
  maxHistoryItems: number;
  maxHotWords: number;
  numShards: number;
  numReplicas: number;
  suggestLimit: number;
  correctLimit: number;
  highlightPreTag: string;
  highlightPostTag: string;
  fragmentSize: number;
  port: number;
  host: string;
  dataDir: string;
  useFileStorage: boolean;
  enableCache: boolean;
  enableSuggest: boolean;
  enableSpellCheck: boolean;
  enableHistory: boolean;
}

export const DEFAULT_CONFIG: SearchEngineConfig = {
  maxPaginationDepth: 1000,
  defaultField: 'content',
  defaultOperator: 'AND',
  cacheCapacity: 10000,
  cacheTTL: 300000,
  maxHistoryItems: 10000,
  maxHotWords: 1000,
  numShards: 1,
  numReplicas: 0,
  suggestLimit: 10,
  correctLimit: 5,
  highlightPreTag: '<em>',
  highlightPostTag: '</em>',
  fragmentSize: 100,
  port: 3000,
  host: '0.0.0.0',
  dataDir: './data',
  useFileStorage: false,
  enableCache: true,
  enableSuggest: true,
  enableSpellCheck: true,
  enableHistory: true,
};

export function createConfig(overrides?: Partial<SearchEngineConfig>): SearchEngineConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}
