import * as fs from 'fs/promises';
import * as path from 'path';
import { InvertedIndex } from '../index/inverted-index';
import { Suggester, Trie, NGramSuggestion } from '../suggest/suggest';
import { PinyinSpellChecker } from '../correction/spell-checker';
import { SearchHistory } from '../history/search-history';
import { MetricsRegistry } from '../monitor/metrics';

export interface IStorage {
  save(path: string, data: object): Promise<void>;
  load(path: string): Promise<object | null>;
  delete(path: string): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
}

export class FileStorage implements IStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || './data';
  }

  private getFullPath(filePath: string): string {
    const fullPath = path.join(this.baseDir, filePath);
    if (!fullPath.endsWith('.json')) {
      return fullPath + '.json';
    }
    return fullPath;
  }

  async save(filePath: string, data: object): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(fullPath, jsonData, 'utf-8');
  }

  async load(filePath: string): Promise<object | null> {
    const fullPath = this.getFullPath(filePath);
    try {
      const data = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(data);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async delete(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (err: any) {
        if (err.code === 'ENOENT') {
          return false;
        }
        throw err;
      }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const searchDir = prefix ? path.join(this.baseDir, prefix) : this.baseDir;
    try {
      await fs.access(searchDir);
    } catch {
      return [];
    }
    const files = await fs.readdir(searchDir, { recursive: true });
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const relative = prefix ? path.join(prefix, f) : f;
        return relative.replace(/\\/g, '/').replace(/\.json$/, '');
      });
  }
}

export class MemoryStorage implements IStorage {
  private data: Map<string, object> = new Map();

  async save(path: string, data: object): Promise<void> {
    this.data.set(path, data);
    return Promise.resolve();
  }

  async load(path: string): Promise<object | null> {
    return Promise.resolve(this.data.get(path) || null);
  }

  async delete(path: string): Promise<boolean> {
    return Promise.resolve(this.data.delete(path));
  }

  async exists(path: string): Promise<boolean> {
    return Promise.resolve(this.data.has(path));
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    if (prefix) {
      return Promise.resolve(keys.filter(k => k.startsWith(prefix)));
    }
    return Promise.resolve(keys);
  }
}

export class IndexPersistence {
  private storage: IStorage;
  private name: string;

  constructor(storage: IStorage, name?: string) {
    this.storage = storage;
    this.name = name || 'default';
  }

  private getIndexPath(): string {
    return `index/${this.name}/inverted-index`;
  }

  private getSuggestionsPath(): string {
    return `index/${this.name}/suggestions`;
  }

  private getHotWordsPath(): string {
    return `index/${this.name}/hotwords`;
  }

  private getSpellCheckerPath(): string {
    return `index/${this.name}/spellchecker`;
  }

  private getHistoryPath(): string {
    return `index/${this.name}/history`;
  }

  private getMetricsPath(): string {
    return `index/${this.name}/metrics`;
  }

  async saveIndex(invertedIndex: InvertedIndex): Promise<void> {
    const data = invertedIndex.serialize();
    await this.storage.save(this.getIndexPath(), data);
  }

  async loadIndex(): Promise<InvertedIndex | null> {
    const data = await this.storage.load(this.getIndexPath());
    if (!data) return null;
    const fieldConfigs = (data as any).fieldConfigs || [];
    const index = new InvertedIndex(fieldConfigs);
    index.deserialize(data);
    return index;
  }

  async saveSuggestions(suggester: Suggester): Promise<void> {
    const trieData = (suggester as any).trie.serialize();
    const nGram = (suggester as any).nGram;
    const nGramData = {
      n: nGram.n,
      index: Array.from(nGram.index.entries() as Iterable<[string, any]>).map(([gram, entries]) => ({
        gram,
        entries,
      })),
      termFrequencies: Array.from(nGram.termFrequencies.entries()),
    };
    const data = {
      useTrie: (suggester as any).useTrie,
      useNGram: (suggester as any).useNGram,
      trie: trieData,
      nGram: nGramData,
    };
    await this.storage.save(this.getSuggestionsPath(), data);
  }

  async loadSuggestions(): Promise<Suggester | null> {
    const data = await this.storage.load(this.getSuggestionsPath());
    if (!data) return null;
    const suggesterData = data as any;
    const suggester = new Suggester({
      useTrie: suggesterData.useTrie,
      useNGram: suggesterData.useNGram,
    });
    if (suggesterData.trie) {
      (suggester as any).trie = new Trie();
      (suggester as any).trie.deserialize(suggesterData.trie);
    }
    if (suggesterData.nGram) {
      const nGram = new NGramSuggestion(suggesterData.nGram.n);
      (nGram as any).index = new Map(
        suggesterData.nGram.index.map((item: any) => [item.gram, item.entries])
      );
      (nGram as any).termFrequencies = new Map(suggesterData.nGram.termFrequencies);
      (suggester as any).nGram = nGram;
    }
    return suggester;
  }

  async saveHotWords(hotWords: Array<{query: string, count: number, lastSearched: number}>): Promise<void> {
    await this.storage.save(this.getHotWordsPath(), hotWords);
  }

  async loadHotWords(): Promise<Array<{query: string, count: number, lastSearched: number}> | null> {
    const data = await this.storage.load(this.getHotWordsPath());
    if (!data) return null;
    return data as Array<{query: string, count: number, lastSearched: number}>;
  }

  async saveSpellChecker(spellChecker: PinyinSpellChecker): Promise<void> {
    const data = {
      dictionary: Array.from((spellChecker as any).dictionary),
      frequency: Array.from((spellChecker as any).frequency.entries()),
      pinyinToTerms: Array.from((spellChecker as any).pinyinToTerms.entries()),
      initialsToTerms: Array.from((spellChecker as any).initialsToTerms.entries()),
      termToPinyin: Array.from((spellChecker as any).termToPinyin.entries()),
      termToInitials: Array.from((spellChecker as any).termToInitials.entries()),
    };
    await this.storage.save(this.getSpellCheckerPath(), data);
  }

  async loadSpellChecker(spellChecker: PinyinSpellChecker): Promise<void> {
    const data = await this.storage.load(this.getSpellCheckerPath());
    if (data) {
      const scData = data as any;
      (spellChecker as any).dictionary = new Set(scData.dictionary || []);
      (spellChecker as any).frequency = new Map(scData.frequency || []);
      (spellChecker as any).pinyinToTerms = new Map(scData.pinyinToTerms || []);
      (spellChecker as any).initialsToTerms = new Map(scData.initialsToTerms || []);
      (spellChecker as any).termToPinyin = new Map(scData.termToPinyin || []);
      (spellChecker as any).termToInitials = new Map(scData.termToInitials || []);
    }
  }

  async saveHistory(history: SearchHistory): Promise<void> {
    const data = {
      history: (history as any).history,
      hotWords: Array.from((history as any).hotWords.entries()),
    };
    await this.storage.save(this.getHistoryPath(), data);
  }

  async loadHistory(history: SearchHistory): Promise<void> {
    const data = await this.storage.load(this.getHistoryPath());
    if (data) {
      const hData = data as any;
      (history as any).history = hData.history || [];
      (history as any).hotWords = new Map(hData.hotWords || []);
    }
  }

  async saveMetrics(metrics: MetricsRegistry): Promise<void> {
    const data = metrics.getAllMetrics();
    await this.storage.save(this.getMetricsPath(), data);
  }

  async saveAll(
    index: InvertedIndex,
    suggester: Suggester,
    spellChecker: PinyinSpellChecker,
    history: SearchHistory,
    metrics: MetricsRegistry
  ): Promise<void> {
    await Promise.all([
      this.saveIndex(index),
      this.saveSuggestions(suggester),
      this.saveSpellChecker(spellChecker),
      this.saveHistory(history),
      this.saveMetrics(metrics),
    ]);
  }

  async loadAll(
    index: InvertedIndex,
    suggester: Suggester,
    spellChecker: PinyinSpellChecker,
    history: SearchHistory
  ): Promise<void> {
    const [loadedIndex, loadedSuggester] = await Promise.all([
      this.loadIndex(),
      this.loadSuggestions(),
      this.loadSpellChecker(spellChecker),
      this.loadHistory(history),
    ]);
    if (loadedIndex) {
      const data = loadedIndex.serialize();
      index.deserialize(data);
      const fieldConfigs = (index as any).fieldConfigs;
      (index as any).fieldConfigs = fieldConfigs;
    }
    if (loadedSuggester) {
      (suggester as any).useTrie = (loadedSuggester as any).useTrie;
      (suggester as any).useNGram = (loadedSuggester as any).useNGram;
      (suggester as any).trie = (loadedSuggester as any).trie;
      (suggester as any).nGram = (loadedSuggester as any).nGram;
    }
  }
}
