interface HistoryItem {
  query: string;
  timestamp: number;
}

interface HotWordData {
  count: number;
  lastSearched: number;
}

export class SearchHistory {
  private maxEntries: number;
  private maxHistoryItems: number;
  private history: HistoryItem[];
  private hotWords: Map<string, HotWordData>;

  constructor(maxEntries?: number, maxHistoryItems?: number) {
    this.maxEntries = maxEntries ?? 100;
    this.maxHistoryItems = maxHistoryItems ?? 1000;
    this.history = [];
    this.hotWords = new Map();
  }

  record(query: string, timestamp?: number): void {
    const ts = timestamp ?? Date.now();
    this.history.unshift({ query, timestamp: ts });
    if (this.history.length > this.maxHistoryItems) {
      this.history.pop();
    }
    const existing = this.hotWords.get(query);
    if (existing) {
      existing.count++;
      existing.lastSearched = ts;
    } else {
      this.hotWords.set(query, { count: 1, lastSearched: ts });
    }
    if (this.hotWords.size > this.maxEntries) {
      const sorted = Array.from(this.hotWords.entries()).sort((a, b) => {
        if (b[1].count !== a[1].count) {
          return a[1].count - b[1].count;
        }
        return a[1].lastSearched - b[1].lastSearched;
      });
      const toRemove = sorted[0][0];
      this.hotWords.delete(toRemove);
    }
  }

  getHistory(limit?: number): Array<{ query: string; timestamp: number }> {
    if (limit !== undefined && limit > 0) {
      return this.history.slice(0, limit);
    }
    return this.history.slice();
  }

  clearHistory(): void {
    this.history = [];
  }

  getHotWords(limit?: number): Array<{ query: string; count: number; lastSearched: number }> {
    const sorted = Array.from(this.hotWords.entries()).sort((a, b) => {
      if (b[1].count !== a[1].count) {
        return b[1].count - a[1].count;
      }
      return b[1].lastSearched - a[1].lastSearched;
    });
    const result = sorted.map(([query, data]) => ({
      query,
      count: data.count,
      lastSearched: data.lastSearched,
    }));
    if (limit !== undefined && limit > 0) {
      return result.slice(0, limit);
    }
    return result;
  }

  clearHotWords(): void {
    this.hotWords.clear();
  }
}
