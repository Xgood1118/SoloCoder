import { SearchHistory } from '../history/search-history';

describe('SearchHistory Tests', () => {
  let history: SearchHistory;

  beforeEach(() => {
    history = new SearchHistory(100, 1000);
  });

  it('should create empty search history', () => {
    expect(history.getHistory().length).toBe(0);
  });

  it('should record search queries', () => {
    history.record('query1');
    history.record('query2');

    const result = history.getHistory();
    expect(result.length).toBe(2);
    expect(result[0].query).toBe('query2');
    expect(result[1].query).toBe('query1');
  });

  it('should include timestamps', () => {
    const before = Date.now();
    history.record('query1');
    const after = Date.now();

    const result = history.getHistory();
    expect(result[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(result[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('should limit history items', () => {
    const smallHistory = new SearchHistory(100, 3);
    smallHistory.record('query1');
    smallHistory.record('query2');
    smallHistory.record('query3');
    smallHistory.record('query4');

    const result = smallHistory.getHistory();
    expect(result.length).toBe(3);
    expect(result[0].query).toBe('query4');
    expect(result[2].query).toBe('query2');
  });

  it('should clear history', () => {
    history.record('query1');
    history.clearHistory();
    expect(history.getHistory().length).toBe(0);
  });

  it('should track hot words with counts', () => {
    history.record('query1');
    history.record('query1');
    history.record('query2');

    const hotWords = history.getHotWords();
    expect(hotWords.length).toBe(2);
    expect(hotWords[0].query).toBe('query1');
    expect(hotWords[0].count).toBe(2);
    expect(hotWords[1].query).toBe('query2');
    expect(hotWords[1].count).toBe(1);
  });

  it('should sort hot words by count descending', () => {
    history.record('a');
    history.record('b');
    history.record('b');
    history.record('c');
    history.record('c');
    history.record('c');

    const hotWords = history.getHotWords();
    expect(hotWords[0].query).toBe('c');
    expect(hotWords[0].count).toBe(3);
    expect(hotWords[1].query).toBe('b');
    expect(hotWords[1].count).toBe(2);
    expect(hotWords[2].query).toBe('a');
    expect(hotWords[2].count).toBe(1);
  });

  it('should limit hot words', () => {
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j <= i; j++) {
        history.record(`query${i}`);
      }
    }

    const hotWords = history.getHotWords(3);
    expect(hotWords.length).toBe(3);
  });

  it('should clear hot words', () => {
    history.record('query1');
    history.record('query1');
    history.clearHotWords();

    const hotWords = history.getHotWords();
    expect(hotWords.length).toBe(0);
  });

  it('should track last searched time for hot words', () => {
    history.record('query1');
    const firstTime = history.getHotWords()[0].lastSearched;

    setTimeout(() => {
      history.record('query1');
      const secondTime = history.getHotWords()[0].lastSearched;
      expect(secondTime).toBeGreaterThan(firstTime);
    }, 10);
  });
});
