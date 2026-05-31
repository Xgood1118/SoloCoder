const { IndexBuilder } = require('./dist/index/index-builder');
const { AnalyzerRegistry } = require('./dist/analyzer/analyzer');
const { FieldType } = require('./dist/core/types');

const fieldConfigs = [
  { name: 'title', type: FieldType.TEXT, weight: 2.0, indexed: true, stored: true },
  { name: 'content', type: FieldType.TEXT, weight: 1.0, indexed: true, stored: true },
];

const analyzerRegistry = new AnalyzerRegistry();
const indexBuilder = new IndexBuilder(fieldConfigs, analyzerRegistry);

console.log('=== Analyzers in registry ===');
console.log('Has default:', analyzerRegistry.has('default'));

const analyzer = analyzerRegistry.get('default');
console.log('Analyzer analyze "机器学习":', JSON.stringify(analyzer.analyze('机器学习'), null, 2));

console.log('\n=== Testing analyzeDocument ===');
const doc = { id: 'doc1', fields: { title: '机器学习入门', content: '' } };
const tokens = indexBuilder.analyzeDocument(doc);
console.log('Tokens map:', tokens);
console.log('Title tokens:', tokens.get('title'));
