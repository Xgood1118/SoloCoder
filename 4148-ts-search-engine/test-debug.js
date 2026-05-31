const { SearchEngine } = require('./dist/search/search-engine');
const { InvertedIndex } = require('./dist/index/inverted-index');
const { TFIDFScorer } = require('./dist/scoring/scorer');
const { ChineseTokenizer } = require('./dist/analyzer/tokenizer');
const { QueryParser } = require('./dist/query/query-parser');
const { Highlighter } = require('./dist/search/highlighter');
const { QueryType, FieldType } = require('./dist/core/types');

const fieldConfigs = [
  { name: 'title', type: FieldType.TEXT, weight: 2.0, indexed: true, stored: true },
  { name: 'content', type: FieldType.TEXT, weight: 1.0, indexed: true, stored: true },
];

const invertedIndex = new InvertedIndex(fieldConfigs);
const scorer = new TFIDFScorer({ title: 2.0, content: 1.0 });
const tokenizer = new ChineseTokenizer();
const queryParser = new QueryParser({ defaultField: 'content', defaultOperator: 'OR' });
const fieldConfigsMap = new Map(fieldConfigs.map(f => [f.name, f]));

const searchEngine = new SearchEngine({ maxPaginationDepth: 1000 });
searchEngine.invertedIndex = invertedIndex;
searchEngine.scorer = scorer;
searchEngine.fieldConfigs = fieldConfigsMap;
searchEngine.queryParser = queryParser;
searchEngine.highlighter = new Highlighter(fieldConfigsMap);

function indexDocument(docId, title, content) {
  const tokens = new Map();
  tokens.set('title', tokenizer.tokenize(title));
  tokens.set('content', tokenizer.tokenize(content));
  invertedIndex.addDocument(docId, { id: docId, fields: { title, content } }, tokens);
}

indexDocument('doc1', '机器学习入门', '');
indexDocument('doc2', '深度学习进阶', '');

console.log('=== Indexed terms (title) ===');
console.log(invertedIndex.getAllTerms('title'));

console.log('\n=== QueryParser parsing "机器学习" ===');
const parsedQuery = queryParser.parse('机器学习');
console.log('Parsed query:', JSON.stringify(parsedQuery, null, 2));

console.log('\n=== Searching for "机器学习" ===');
const response = searchEngine.search({ query: '机器学习', pagination: { from: 0, size: 10 } });
console.log('Total results:', response.total);
console.log('Results:', JSON.stringify(response.results, null, 2));
