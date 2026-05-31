import { Posting, PostingsList, Token, FieldConfig, IndexStats } from '../core/types';

export class InvertedIndex {
  private index: Map<string, Map<string, PostingsList>>;
  private docStore: Map<string, Map<string, any>>;
  private docCount: number;
  private fieldConfigs: Map<string, FieldConfig>;
  private avgFieldLengths: Map<string, number>;
  private docFieldLengths: Map<string, Map<string, number>>;

  constructor(fieldConfigs: FieldConfig[]) {
    this.index = new Map();
    this.docStore = new Map();
    this.docCount = 0;
    this.fieldConfigs = new Map();
    this.avgFieldLengths = new Map();
    this.docFieldLengths = new Map();
    for (const config of fieldConfigs) {
      this.fieldConfigs.set(config.name, config);
    }
  }

  addDocument(docId: string, fields: Record<string, any>, tokens: Map<string, Token[]>): void {
    this.docCount++;

    const storedFields = new Map<string, any>();
    for (const config of this.fieldConfigs.values()) {
      if (config.stored && fields[config.name] !== undefined) {
        storedFields.set(config.name, fields[config.name]);
      }
    }
    this.docStore.set(docId, storedFields);

    const docLengths = new Map<string, number>();

    for (const [fieldName, fieldTokens] of tokens) {
      const config = this.fieldConfigs.get(fieldName);
      if (!config || config.indexed === false) continue;

      const fieldLength = fieldTokens.length;
      docLengths.set(fieldName, fieldLength);

      const termGroups = new Map<string, Token[]>();
      for (const token of fieldTokens) {
        if (!termGroups.has(token.term)) {
          termGroups.set(token.term, []);
        }
        termGroups.get(token.term)!.push(token);
      }

      let fieldIndex = this.index.get(fieldName);
      if (!fieldIndex) {
        fieldIndex = new Map();
        this.index.set(fieldName, fieldIndex);
      }

      for (const [term, termTokens] of termGroups) {
        let postingsList = fieldIndex.get(term);
        if (!postingsList) {
          postingsList = { term, docFreq: 0, postings: [] };
          fieldIndex.set(term, postingsList);
        }

        const positions = termTokens.map(t => t.position);
        const startOffsets = termTokens.map(t => t.startOffset);

        const posting: Posting = {
          docId,
          termFreq: termTokens.length,
          positions,
          fieldOffsets: new Map([[fieldName, startOffsets]]),
        };

        postingsList.postings.push(posting);
        postingsList.docFreq++;
      }

      const prevAvg = this.avgFieldLengths.get(fieldName) || 0;
      const prevCount = this.docCount - 1;
      this.avgFieldLengths.set(fieldName, (prevAvg * prevCount + fieldLength) / this.docCount);
    }

    this.docFieldLengths.set(docId, docLengths);
  }

  removeDocument(docId: string): boolean {
    const docLengths = this.docFieldLengths.get(docId);
    if (!docLengths) return false;

    this.docStore.delete(docId);
    this.docFieldLengths.delete(docId);

    for (const [fieldName, fieldLength] of docLengths) {
      const fieldIndex = this.index.get(fieldName);
      if (!fieldIndex) continue;

      const termsToRemove: string[] = [];

      for (const [term, postingsList] of fieldIndex) {
        const idx = postingsList.postings.findIndex(p => p.docId === docId);
        if (idx !== -1) {
          postingsList.postings.splice(idx, 1);
          postingsList.docFreq--;
          if (postingsList.postings.length === 0) {
            termsToRemove.push(term);
          }
        }
      }

      for (const term of termsToRemove) {
        fieldIndex.delete(term);
      }

      if (fieldIndex.size === 0) {
        this.index.delete(fieldName);
      }

      if (this.docCount > 1) {
        const prevAvg = this.avgFieldLengths.get(fieldName) || 0;
        this.avgFieldLengths.set(fieldName, (prevAvg * this.docCount - fieldLength) / (this.docCount - 1));
      } else {
        this.avgFieldLengths.delete(fieldName);
      }
    }

    this.docCount--;
    return true;
  }

  getPostings(fieldName: string, term: string): PostingsList | null {
    const fieldIndex = this.index.get(fieldName);
    if (!fieldIndex) return null;
    return fieldIndex.get(term) || null;
  }

  getDocument(docId: string): Record<string, any> | null {
    const storedFields = this.docStore.get(docId);
    if (!storedFields) return null;
    const result: Record<string, any> = {};
    for (const [key, value] of storedFields) {
      result[key] = value;
    }
    return result;
  }

  getDocCount(): number {
    return this.docCount;
  }

  getDocFrequency(fieldName: string, term: string): number {
    const postingsList = this.getPostings(fieldName, term);
    return postingsList ? postingsList.docFreq : 0;
  }

  getTermFrequency(fieldName: string, term: string, docId: string): number {
    const postingsList = this.getPostings(fieldName, term);
    if (!postingsList) return 0;
    const posting = postingsList.postings.find(p => p.docId === docId);
    return posting ? posting.termFreq : 0;
  }

  getAvgFieldLength(fieldName: string): number {
    return this.avgFieldLengths.get(fieldName) || 0;
  }

  getDocFieldLength(docId: string, fieldName: string): number {
    const docLengths = this.docFieldLengths.get(docId);
    if (!docLengths) return 0;
    return docLengths.get(fieldName) || 0;
  }

  getAllTerms(fieldName: string): string[] {
    const fieldIndex = this.index.get(fieldName);
    if (!fieldIndex) return [];
    return Array.from(fieldIndex.keys());
  }

  getStats(): IndexStats {
    let termCount = 0;
    let indexSize = 0;

    for (const fieldIndex of this.index.values()) {
      termCount += fieldIndex.size;
      for (const postingsList of fieldIndex.values()) {
        indexSize += postingsList.postings.length;
      }
    }

    return {
      docCount: this.docCount,
      termCount,
      indexSize,
      lastUpdated: Date.now(),
    };
  }

  clear(): void {
    this.index.clear();
    this.docStore.clear();
    this.docFieldLengths.clear();
    this.avgFieldLengths.clear();
    this.docCount = 0;
  }

  serialize(): object {
    const indexData: Record<string, Record<string, any>> = {};
    for (const [fieldName, fieldIndex] of this.index) {
      indexData[fieldName] = {};
      for (const [term, postingsList] of fieldIndex) {
        indexData[fieldName][term] = {
          term: postingsList.term,
          docFreq: postingsList.docFreq,
          postings: postingsList.postings.map(p => ({
            docId: p.docId,
            termFreq: p.termFreq,
            positions: p.positions,
            fieldOffsets: Array.from(p.fieldOffsets.entries()),
          })),
        };
      }
    }

    const docStoreData: Record<string, Record<string, any>> = {};
    for (const [docId, fields] of this.docStore) {
      docStoreData[docId] = Object.fromEntries(fields);
    }

    const fieldConfigsData = Array.from(this.fieldConfigs.values());

    const avgFieldLengthsData = Object.fromEntries(this.avgFieldLengths);

    const docFieldLengthsData: Record<string, Record<string, number>> = {};
    for (const [docId, lengths] of this.docFieldLengths) {
      docFieldLengthsData[docId] = Object.fromEntries(lengths);
    }

    return {
      index: indexData,
      docStore: docStoreData,
      docCount: this.docCount,
      fieldConfigs: fieldConfigsData,
      avgFieldLengths: avgFieldLengthsData,
      docFieldLengths: docFieldLengthsData,
    };
  }

  deserialize(data: any): void {
    this.index.clear();
    this.docStore.clear();
    this.docFieldLengths.clear();
    this.avgFieldLengths.clear();

    this.docCount = data.docCount;

    this.fieldConfigs.clear();
    for (const config of data.fieldConfigs) {
      this.fieldConfigs.set(config.name, config);
    }

    this.avgFieldLengths = new Map(Object.entries(data.avgFieldLengths));

    for (const [docId, fields] of Object.entries(data.docStore)) {
      this.docStore.set(docId, new Map(Object.entries(fields as Record<string, any>)));
    }

    for (const [docId, lengths] of Object.entries(data.docFieldLengths)) {
      this.docFieldLengths.set(docId, new Map(Object.entries(lengths as Record<string, number>)));
    }

    for (const [fieldName, fieldIndex] of Object.entries(data.index)) {
      const fieldMap = new Map<string, PostingsList>();
      for (const [term, postingsListData] of Object.entries(fieldIndex as Record<string, any>)) {
        const pld = postingsListData as any;
        const postings: Posting[] = pld.postings.map((p: any) => ({
          docId: p.docId,
          termFreq: p.termFreq,
          positions: p.positions,
          fieldOffsets: new Map(p.fieldOffsets as [string, number[]][]),
        }));
        fieldMap.set(term, {
          term: pld.term,
          docFreq: pld.docFreq,
          postings,
        });
      }
      this.index.set(fieldName, fieldMap);
    }
  }
}
