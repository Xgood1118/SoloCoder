export interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  frequency: number;
}

export class Trie {
  private root: TrieNode;

  constructor() {
    this.root = this.createNode();
  }

  private createNode(): TrieNode {
    return {
      children: new Map(),
      isEndOfWord: false,
      frequency: 0,
    };
  }

  insert(word: string, frequency: number): void {
    let current = this.root;
    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, this.createNode());
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
    current.frequency += frequency;
  }

  searchPrefix(prefix: string, limit: number): string[] {
    let current = this.root;
    for (const char of prefix) {
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char)!;
    }

    const suggestions: Array<{ word: string; frequency: number }> = [];
    const queue: Array<{ node: TrieNode; path: string }> = [{ node: current, path: prefix }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (node.isEndOfWord) {
        suggestions.push({ word: path, frequency: node.frequency });
      }
      for (const [char, child] of node.children) {
        queue.push({ node: child, path: path + char });
      }
    }

    suggestions.sort((a, b) => b.frequency - a.frequency);
    return suggestions.slice(0, limit).map(s => s.word);
  }

  serialize(): object {
    const serializeNode = (node: TrieNode): any => ({
      children: Object.fromEntries(
        Array.from(node.children.entries()).map(([char, child]) => [char, serializeNode(child)])
      ),
      isEndOfWord: node.isEndOfWord,
      frequency: node.frequency,
    });
    return serializeNode(this.root);
  }

  deserialize(data: any): void {
    const deserializeNode = (nodeData: any): TrieNode => ({
      children: new Map(
        Object.entries(nodeData.children).map(([char, childData]) => [char, deserializeNode(childData)])
      ),
      isEndOfWord: nodeData.isEndOfWord,
      frequency: nodeData.frequency,
    });
    this.root = deserializeNode(data);
  }
}

export class NGramSuggestion {
  private n: number;
  private index: Map<string, Array<{ term: string; frequency: number }>>;
  private termFrequencies: Map<string, number>;

  constructor(n?: number) {
    this.n = n ?? 2;
    this.index = new Map();
    this.termFrequencies = new Map();
  }

  private getNGrams(term: string): string[] {
    const grams: string[] = [];
    const padded = `$${term}$`;
    for (let i = 0; i <= padded.length - this.n; i++) {
      grams.push(padded.substring(i, i + this.n));
    }
    return grams;
  }

  indexTerm(term: string, frequency: number): void {
    const grams = this.getNGrams(term);
    const existingFreq = this.termFrequencies.get(term) || 0;
    const newFreq = existingFreq + frequency;
    this.termFrequencies.set(term, newFreq);

    for (const gram of grams) {
      if (!this.index.has(gram)) {
        this.index.set(gram, []);
      }
      const entries = this.index.get(gram)!;
      const existing = entries.find(e => e.term === term);
      if (existing) {
        existing.frequency = newFreq;
      } else {
        entries.push({ term, frequency: newFreq });
      }
    }
  }

  suggest(query: string, limit: number): string[] {
    const queryGrams = this.getNGrams(query);
    const termMatches = new Map<string, { matches: number; frequency: number }>();

    for (const gram of queryGrams) {
      const entries = this.index.get(gram);
      if (!entries) continue;
      for (const entry of entries) {
        if (!termMatches.has(entry.term)) {
          termMatches.set(entry.term, { matches: 0, frequency: entry.frequency });
        }
        termMatches.get(entry.term)!.matches++;
      }
    }

    const scored = Array.from(termMatches.entries()).map(([term, data]) => ({
      term,
      score: data.matches * 100 + data.frequency,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.term);
  }
}

export class Suggester {
  private useTrie: boolean;
  private useNGram: boolean;
  private trie: Trie;
  private nGram: NGramSuggestion;

  constructor(options?: { useTrie?: boolean; useNGram?: boolean }) {
    this.useTrie = options?.useTrie ?? true;
    this.useNGram = options?.useNGram ?? true;
    this.trie = new Trie();
    this.nGram = new NGramSuggestion();
  }

  indexTerms(terms: Array<{ term: string; frequency: number }>): void {
    for (const { term, frequency } of terms) {
      if (this.useTrie) {
        this.trie.insert(term, frequency);
      }
      if (this.useNGram) {
        this.nGram.indexTerm(term, frequency);
      }
    }
  }

  suggest(prefix: string, limit?: number): Array<{ suggestion: string; score: number }> {
    const actualLimit = limit ?? 10;
    const results = new Map<string, { trieScore: number; ngramScore: number }>();

    if (this.useTrie) {
      const trieResults = this.trie.searchPrefix(prefix, actualLimit * 2);
      trieResults.forEach((term, idx) => {
        const score = (trieResults.length - idx) / trieResults.length;
        if (!results.has(term)) {
          results.set(term, { trieScore: 0, ngramScore: 0 });
        }
        results.get(term)!.trieScore = score;
      });
    }

    if (this.useNGram) {
      const ngramResults = this.nGram.suggest(prefix, actualLimit * 2);
      ngramResults.forEach((term, idx) => {
        const score = (ngramResults.length - idx) / ngramResults.length;
        if (!results.has(term)) {
          results.set(term, { trieScore: 0, ngramScore: 0 });
        }
        results.get(term)!.ngramScore = score;
      });
    }

    const combined = Array.from(results.entries()).map(([suggestion, scores]) => {
      const trieWeight = this.useTrie && this.useNGram ? 1.0 : this.useTrie ? 1.0 : 0;
      const ngramWeight = this.useTrie && this.useNGram ? 0.6 : this.useNGram ? 1.0 : 0;
      const score = scores.trieScore * trieWeight + scores.ngramScore * ngramWeight;
      return { suggestion, score };
    });

    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, actualLimit);
  }
}
