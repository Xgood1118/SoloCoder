import {
  Query,
  QueryType,
  TermQuery,
  PhraseQuery,
  BooleanQuery,
  FuzzyQuery,
  RangeQuery,
  MultiFieldQuery,
  WildcardQuery,
  MatchAllQuery,
  Posting,
} from '../core/types';
import { InvertedIndex } from '../index/inverted-index';
import { editDistance, globMatch } from './utils';

export interface IScorer {
  score(query: Query, index: InvertedIndex): Map<string, number>;
}

export class TFIDFScorer implements IScorer {
  private fieldWeights: Map<string, number>;

  constructor(fieldWeights?: Record<string, number>) {
    this.fieldWeights = new Map();
    if (fieldWeights) {
      for (const [field, weight] of Object.entries(fieldWeights)) {
        this.fieldWeights.set(field, weight);
      }
    }
  }

  score(query: Query, index: InvertedIndex): Map<string, number> {
    let scores: Map<string, number>;
    switch (query.type) {
      case QueryType.TERM:
        scores = this.scoreTermQuery(query as TermQuery, index);
        break;
      case QueryType.PHRASE:
        scores = this.scorePhraseQuery(query as PhraseQuery, index);
        break;
      case QueryType.BOOLEAN:
        scores = this.scoreBooleanQuery(query as BooleanQuery, index);
        break;
      case QueryType.FUZZY:
        scores = this.scoreFuzzyQuery(query as FuzzyQuery, index);
        break;
      case QueryType.RANGE:
        scores = this.scoreRangeQuery(query as RangeQuery, index);
        break;
      case QueryType.MULTI_FIELD:
        scores = this.scoreMultiFieldQuery(query as MultiFieldQuery, index);
        break;
      case QueryType.WILDCARD:
        scores = this.scoreWildcardQuery(query as WildcardQuery, index);
        break;
      case QueryType.MATCH_ALL:
        scores = this.scoreMatchAllQuery(query as MatchAllQuery, index);
        break;
      default:
        scores = new Map();
    }
    if (query.boost && query.boost !== 1) {
      for (const [docId, score] of scores) {
        scores.set(docId, score * query.boost);
      }
    }
    return scores;
  }

  private scoreTermQuery(query: TermQuery, index: InvertedIndex): Map<string, number> {
    const scores = new Map<string, number>();
    const fieldWeight = this.fieldWeights.get(query.field) ?? 1;
    const docCount = index.getDocCount();
    const df = index.getDocFrequency(query.field, query.term);
    if (df === 0) return scores;
    const idf = Math.log((docCount + 1) / (df + 1)) + 1;
    const postingsList = index.getPostings(query.field, query.term);
    if (!postingsList) return scores;
    for (const posting of postingsList.postings) {
      const tf = 1 + Math.log(posting.termFreq);
      const score = tf * idf * fieldWeight;
      scores.set(posting.docId, score);
    }
    return scores;
  }

  private scorePhraseQuery(query: PhraseQuery, index: InvertedIndex): Map<string, number> {
    const scores = new Map<string, number>();
    if (query.terms.length === 0) return scores;
    const fieldWeight = this.fieldWeights.get(query.field) ?? 1;
    const docCount = index.getDocCount();
    const termPostings: Posting[][] = [];
    for (const term of query.terms) {
      const postingsList = index.getPostings(query.field, term);
      if (!postingsList || postingsList.postings.length === 0) return scores;
      termPostings.push(postingsList.postings);
    }
    const firstPostings = termPostings[0];
    for (const firstPosting of firstPostings) {
      const docId = firstPosting.docId;
      const otherPostings: Posting[] = [];
      let allFound = true;
      for (let i = 1; i < termPostings.length; i++) {
        const found = termPostings[i].find(p => p.docId === docId);
        if (!found) {
          allFound = false;
          break;
        }
        otherPostings.push(found);
      }
      if (!allFound) continue;
      let matched = false;
      for (const firstPos of firstPosting.positions) {
        let allConsecutive = true;
        for (let i = 0; i < otherPostings.length; i++) {
          const expectedPos = firstPos + i + 1;
          if (!otherPostings[i].positions.includes(expectedPos)) {
            allConsecutive = false;
            break;
          }
        }
        if (allConsecutive) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      let totalTf = 0;
      let totalDf = 0;
      for (let i = 0; i < query.terms.length; i++) {
        const term = query.terms[i];
        const tf = i === 0 ? firstPosting.termFreq : otherPostings[i - 1].termFreq;
        totalTf += tf;
        const df = index.getDocFrequency(query.field, term);
        totalDf += df;
      }
      const avgTf = totalTf / query.terms.length;
      const avgDf = totalDf / query.terms.length;
      const tf = 1 + Math.log(avgTf);
      const idf = Math.log((docCount + 1) / (avgDf + 1)) + 1;
      const score = tf * idf * fieldWeight * 1.5;
      scores.set(docId, score);
    }
    return scores;
  }

  private scoreBooleanQuery(query: BooleanQuery, index: InvertedIndex): Map<string, number> {
    const scores = new Map<string, number>();
    if (query.queries.length === 0) return scores;
    const subScores: Map<string, number>[] = query.queries.map(q => this.score(q, index));
    if (query.operator === 'AND') {
      if (subScores.length === 0) return scores;
      const firstScores = subScores[0];
      for (const [docId, firstScore] of firstScores) {
        let allPresent = true;
        let totalScore = firstScore;
        for (let i = 1; i < subScores.length; i++) {
          const subScore = subScores[i].get(docId);
          if (subScore === undefined) {
            allPresent = false;
            break;
          }
          totalScore += subScore;
        }
        if (allPresent) {
          scores.set(docId, totalScore);
        }
      }
    } else if (query.operator === 'OR') {
      for (const subScoreMap of subScores) {
        for (const [docId, score] of subScoreMap) {
          const existing = scores.get(docId) ?? 0;
          scores.set(docId, existing + score);
        }
      }
    } else if (query.operator === 'NOT') {
      if (subScores.length === 0) return scores;
      const notScores = subScores[0];
      const allDocIds = this.getAllDocIds(index);
      for (const docId of allDocIds) {
        if (!notScores.has(docId)) {
          scores.set(docId, 1);
        }
      }
    }
    return scores;
  }

  private scoreFuzzyQuery(query: FuzzyQuery, index: InvertedIndex): Map<string, number> {
    const scores = new Map<string, number>();
    const maxEdits = query.maxEdits ?? 2;
    const prefixLength = query.prefixLength ?? 0;
    const fieldWeight = this.fieldWeights.get(query.field) ?? 1;
    const docCount = index.getDocCount();
    const allTerms = index.getAllTerms(query.field);
    const matchingTerms: string[] = [];
    for (const term of allTerms) {
      if (prefixLength > 0 && query.term.length >= prefixLength) {
        const queryPrefix = query.term.substring(0, prefixLength);
        const termPrefix = term.substring(0, prefixLength);
        if (queryPrefix !== termPrefix) continue;
      }
      const distance = editDistance(query.term, term);
      if (distance <= maxEdits) {
        matchingTerms.push(term);
      }
    }
    for (const term of matchingTerms) {
      const df = index.getDocFrequency(query.field, term);
      if (df === 0) continue;
      const idf = Math.log((docCount + 1) / (df + 1)) + 1;
      const postingsList = index.getPostings(query.field, term);
      if (!postingsList) continue;
      const distance = editDistance(query.term, term);
      const distanceBoost = 1 - (distance / (maxEdits + 1));
      for (const posting of postingsList.postings) {
        const tf = 1 + Math.log(posting.termFreq);
        const score = tf * idf * fieldWeight * distanceBoost;
        const existing = scores.get(posting.docId) ?? 0;
        if (score > existing) {
          scores.set(posting.docId, score);
        }
      }
    }
    return scores;
  }

  private scoreRangeQuery(query: RangeQuery, index: InvertedIndex): Map<string, number> {
    const scores = new Map<string, number>();
    const allTerms = index.getAllTerms(query.field);
    for (const term of allTerms) {
      const termValue = this.parseRangeValue(term);
      if (termValue === null) continue;
      let matches = true;
      if (query.gt !== undefined) {
        const gtValue = this.parseRangeValue(String(query.gt));
        if (gtValue === null || termValue <= gtValue) matches = false;
      }
      if (query.gte !== undefined) {
        const gteValue = this.parseRangeValue(String(query.gte));
        if (gteValue === null || termValue < gteValue) matches = false;
      }
      if (query.lt !== undefined) {
        const ltValue = this.parseRangeValue(String(query.lt));
        if (ltValue === null || termValue >= ltValue) matches = false;
      }
      if (query.lte !== undefined) {
        const lteValue = this.parseRangeValue(String(query.lte));
        if (lteValue === null || termValue > lteValue) matches = false;
      }
      if (matches) {
        const postingsList = index.getPostings(query.field, term);
        if (postingsList) {
          for (const posting of postingsList.postings) {
            scores.set(posting.docId, 1);
          }
        }
      }
    }
    return scores;
  }

  private scoreMultiFieldQuery(query: MultiFieldQuery, index: InvertedIndex): Map<string, number> {
    const scores = new Map<string, number>();
    const terms = query.query.split(/\s+/).filter(t => t.length > 0);
    for (const field of query.fields) {
      const fieldWeight = query.fieldWeights[field] ?? this.fieldWeights.get(field) ?? 1;
      for (const term of terms) {
        const termQuery: TermQuery = {
          type: QueryType.TERM,
          field,
          term,
        };
        const termScores = this.scoreTermQuery(termQuery, index);
        for (const [docId, score] of termScores) {
          const existing = scores.get(docId) ?? 0;
          scores.set(docId, existing + score * fieldWeight);
        }
      }
    }
    return scores;
  }

  private scoreWildcardQuery(query: WildcardQuery, index: InvertedIndex): Map<string, number> {
    const scores = new Map<string, number>();
    const fieldWeight = this.fieldWeights.get(query.field) ?? 1;
    const docCount = index.getDocCount();
    const allTerms = index.getAllTerms(query.field);
    for (const term of allTerms) {
      if (globMatch(query.pattern, term)) {
        const df = index.getDocFrequency(query.field, term);
        if (df === 0) continue;
        const idf = Math.log((docCount + 1) / (df + 1)) + 1;
        const postingsList = index.getPostings(query.field, term);
        if (!postingsList) continue;
        for (const posting of postingsList.postings) {
          const tf = 1 + Math.log(posting.termFreq);
          const score = tf * idf * fieldWeight;
          const existing = scores.get(posting.docId) ?? 0;
          scores.set(posting.docId, existing + score);
        }
      }
    }
    return scores;
  }

  private scoreMatchAllQuery(query: MatchAllQuery, index: InvertedIndex): Map<string, number> {
    const scores = new Map<string, number>();
    const allDocIds = this.getAllDocIds(index);
    for (const docId of allDocIds) {
      scores.set(docId, 1);
    }
    return scores;
  }

  private getAllDocIds(index: InvertedIndex): Set<string> {
    const docIds = new Set<string>();
    const commonFields = ['_all', 'content', 'title', 'body', 'text', 'name', 'description'];
    let foundField = false;
    for (const field of commonFields) {
      const terms = index.getAllTerms(field);
      if (terms.length > 0) {
        foundField = true;
        for (const term of terms) {
          const postings = index.getPostings(field, term);
          if (postings) {
            for (const posting of postings.postings) {
              docIds.add(posting.docId);
            }
          }
        }
        break;
      }
    }
    if (!foundField) {
      for (let i = 0; i < 100; i++) {
        const field = `field_${i}`;
        const terms = index.getAllTerms(field);
        if (terms.length > 0) {
          for (const term of terms) {
            const postings = index.getPostings(field, term);
            if (postings) {
              for (const posting of postings.postings) {
                docIds.add(posting.docId);
              }
            }
          }
          break;
        }
      }
    }
    return docIds;
  }

  private parseRangeValue(value: string): number | string | null {
    const num = parseFloat(value);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
    return value;
  }
}
