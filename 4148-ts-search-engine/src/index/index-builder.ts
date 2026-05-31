import { Document, FieldConfig, Token } from '../core/types';
import { InvertedIndex } from './inverted-index';
import { AnalyzerRegistry } from '../analyzer/analyzer';

export interface DataSource {
  fetchDocuments(since?: number): Promise<Document[]>;
  fetchDocumentById(id: string): Promise<Document | null>;
  count(): Promise<number>;
}

export class IndexBuilder {
  private invertedIndex: InvertedIndex;
  private analyzerRegistry: AnalyzerRegistry;
  private fieldConfigs: Map<string, FieldConfig>;
  private documentVersions: Map<string, number>;
  private lastBuildTime: number;

  constructor(fieldConfigs: FieldConfig[], analyzerRegistry: AnalyzerRegistry) {
    this.invertedIndex = new InvertedIndex(fieldConfigs);
    this.analyzerRegistry = analyzerRegistry;
    this.fieldConfigs = new Map();
    for (const config of fieldConfigs) {
      this.fieldConfigs.set(config.name, config);
    }
    this.documentVersions = new Map();
    this.lastBuildTime = 0;
  }

  getIndex(): InvertedIndex {
    return this.invertedIndex;
  }

  buildFull(documents: Document[]): void {
    this.invertedIndex.clear();
    this.documentVersions.clear();
    for (const doc of documents) {
      this.addDocument(doc);
    }
    this.lastBuildTime = Date.now();
  }

  buildIncremental(documents: Document[]): void {
    for (const doc of documents) {
      const storedVersion = this.documentVersions.get(doc.id);
      if (storedVersion === undefined) {
        this.addDocument(doc);
      } else if (doc.version > storedVersion) {
        this.updateDocument(doc);
      }
    }
    this.lastBuildTime = Date.now();
  }

  addDocument(doc: Document): void {
    const tokens = this.analyzeDocument(doc);
    this.invertedIndex.addDocument(doc.id, doc.fields, tokens);
    this.documentVersions.set(doc.id, doc.version);
  }

  removeDocument(docId: string): boolean {
    const result = this.invertedIndex.removeDocument(docId);
    if (result) {
      this.documentVersions.delete(docId);
    }
    return result;
  }

  updateDocument(doc: Document): void {
    if (this.documentVersions.has(doc.id)) {
      this.invertedIndex.removeDocument(doc.id);
    }
    this.addDocument(doc);
  }

  async buildFromDataSource(dataSource: DataSource, incremental?: boolean): Promise<number> {
    let documents: Document[];
    if (incremental) {
      documents = await dataSource.fetchDocuments(this.lastBuildTime);
    } else {
      documents = await dataSource.fetchDocuments();
    }

    if (incremental) {
      this.buildIncremental(documents);
    } else {
      this.buildFull(documents);
    }

    return documents.length;
  }

  private analyzeDocument(doc: Document): Map<string, Token[]> {
    const result = new Map<string, Token[]>();
    for (const [fieldName, config] of this.fieldConfigs) {
      if (config.indexed === false) continue;
      const value = doc.fields[fieldName];
      if (value === undefined || value === null) continue;
      const analyzerName = config.analyzer || 'default';
      const analyzer = this.analyzerRegistry.get(analyzerName);
      const tokens = analyzer.analyze(String(value), fieldName);
      result.set(fieldName, tokens);
    }
    return result;
  }

  getLastBuildTime(): number {
    return this.lastBuildTime;
  }

  getDocumentCount(): number {
    return this.invertedIndex.getDocCount();
  }

  hasDocument(docId: string): boolean {
    return this.documentVersions.has(docId);
  }
}
