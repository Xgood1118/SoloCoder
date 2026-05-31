const { createSearchEngine, FieldType } = require('./dist/index');

async function test() {
  const fieldConfigs = [
    { name: 'id', type: FieldType.KEYWORD, indexed: false, stored: true },
    { name: 'title', type: FieldType.TEXT, weight: 2.0, indexed: true, stored: true },
    { name: 'content', type: FieldType.TEXT, weight: 1.0, indexed: true, stored: true },
  ];
  
  const engine = await createSearchEngine(fieldConfigs);
  
  console.log('=== Checking invertedIndex references ===');
  console.log('engine.invertedIndex === engine.indexBuilder.getIndex():', engine.invertedIndex === engine.indexBuilder.getIndex());
  console.log('engine.searchEngine.invertedIndex === engine.invertedIndex:', engine.searchEngine.invertedIndex === engine.invertedIndex);
  
  await engine.addDocument({ id: 'doc1', fields: { title: '机器学习入门', content: '' } });
  await engine.addDocument({ id: 'doc2', fields: { title: '深度学习进阶', content: '' } });
  
  console.log('\n=== Indexed terms (title) ===');
  console.log('From facade.invertedIndex:', engine.invertedIndex.getAllTerms('title'));
  console.log('From indexBuilder:', engine.indexBuilder.getIndex().getAllTerms('title'));
  
  console.log('\n=== Searching for "机器学习" ===');
  const response = await engine.search('机器学习');
  console.log('Total results:', response.total);
  response.results.forEach((r, i) => {
    console.log(`  ${i+1}. docId=${r.docId}, score=${r.score.toFixed(2)}`);
  });
  
  console.log('\nSUCCESS!');
}

test().catch(e => {
  console.error('ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});
