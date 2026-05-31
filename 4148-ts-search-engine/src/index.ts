import { SearchEngineFacade } from './search-engine-facade';
import { FieldConfig, FieldType } from './core/types';
import { DEFAULT_CONFIG } from './config';

export * from './core/types';
export * from './analyzer/tokenizer';
export * from './analyzer/analyzer';
export * from './index/inverted-index';
export * from './index/index-builder';
export * from './query/query-parser';
export * from './scoring/scorer';
export * from './scoring/utils';
export * from './search/highlighter';
export * from './search/search-engine';
export * from './suggest/suggest';
export * from './correction/spell-checker';
export * from './cache/lru-cache';
export * from './cache/search-cache';
export * from './history/search-history';
export * from './monitor/metrics';
export * from './distributed/index-shard';
export * from './storage/storage';
export * from './api/server';
export * from './config';
export { SearchEngineFacade };

export async function createSearchEngine(
  fieldConfigs: FieldConfig[],
  configOverrides?: Partial<typeof DEFAULT_CONFIG>,
): Promise<SearchEngineFacade> {
  const facade = new SearchEngineFacade(fieldConfigs, configOverrides);
  return facade;
}

export const defaultFieldConfigs: FieldConfig[] = [
  { name: 'id', type: FieldType.KEYWORD, indexed: false, stored: true },
  { name: 'title', type: FieldType.TEXT, weight: 2.0, indexed: true, stored: true, analyzer: 'default' },
  { name: 'content', type: FieldType.TEXT, weight: 1.0, indexed: true, stored: true, analyzer: 'default' },
  { name: 'author', type: FieldType.TEXT, weight: 1.5, indexed: true, stored: true, analyzer: 'default' },
  { name: 'createdAt', type: FieldType.DATE, indexed: true, stored: true },
  { name: 'updatedAt', type: FieldType.DATE, indexed: true, stored: true },
];
