const { createSearchEngine, FieldType } = require('./dist/index');

async function test() {
  const fieldConfigs = [
    { name: 'id', type: FieldType.KEYWORD, indexed: false, stored: true },
    { name: 'title', type: FieldType.TEXT, weight: 2.0, indexed: true, stored: true },
    { name: 'content', type: FieldType.TEXT, weight: 1.0, indexed: true, stored: true },
  ];
  
  const engine = await createSearchEngine(fieldConfigs);
  
  await engine.addDocument({ id: 'doc1', fields: { title: '机器学习入门', content: '深度学习和神经网络基础' } });
  await engine.addDocument({ id: 'doc2', fields: { title: 'Python编程', content: 'Python语言基础教程' } });
  await engine.addDocument({ id: 'doc3', fields: { title: '深度学习进阶', content: '神经网络和强化学习' } });
  
  console.log('\n=== Testing search for "机器学习" ===');
  const response = await engine.search('机器学习');
  console.log('Total results:', response.total);
  response.results.forEach((r, i) => {
    console.log(`  ${i+1}. docId=${r.docId}, score=${r.score.toFixed(2)}, title=${r.document.fields.title}`);
  });
  
  console.log('\n=== Testing search for "深度学习" ===');
  const response2 = await engine.search('深度学习');
  console.log('Total results:', response2.total);
  response2.results.forEach((r, i) => {
    console.log(`  ${i+1}. docId=${r.docId}, score=${r.score.toFixed(2)}, title=${r.document.fields.title}`);
  });
  
  console.log('\nSUCCESS!');
}

test().catch(e => {
  console.error('ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});
