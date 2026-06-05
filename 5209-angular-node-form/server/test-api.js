const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== API 测试 ===\n');

  console.log('1. 健康检查:');
  const health = await get('/api/health');
  console.log('   ', JSON.stringify(health));

  console.log('\n2. 获取模板列表:');
  const templates = await get('/api/templates');
  console.log('   模板数量:', templates.length);
  templates.forEach(t => console.log(`   - ${t.name} (${t.isBuiltIn ? '内置' : '自定义'})`));

  console.log('\n3. 获取表单列表 (空):');
  const forms1 = await get('/api/forms');
  console.log('   表单数量:', forms1.length);

  console.log('\n4. 创建一个测试表单:');
  const testForm = {
    name: '测试表单',
    description: '这是一个测试表单',
    webhookUrl: '',
    fields: [
      {
        key: 'name',
        label: '姓名',
        type: 'text',
        required: true,
        placeholder: '请输入姓名',
        typeMeta: { minLength: 1, maxLength: 100 }
      },
      {
        key: 'age',
        label: '年龄',
        type: 'number',
        required: false,
        typeMeta: { min: 0, max: 150 }
      },
      {
        key: 'gender',
        label: '性别',
        type: 'select',
        required: true,
        options: [
          { label: '男', value: 'male' },
          { label: '女', value: 'female' }
        ]
      }
    ]
  };
  const createdForm = await post('/api/forms', testForm);
  console.log('   创建成功, ID:', createdForm.id);
  console.log('   版本:', createdForm.version);

  const formId = createdForm.id;

  console.log('\n5. 获取版本列表:');
  const versions = await get(`/api/forms/${formId}/versions`);
  console.log('   版本数量:', versions.length);

  console.log('\n6. 提交表单:');
  const submission = await post(`/api/forms/${formId}/submit`, {
    name: '张三',
    age: 25,
    gender: 'male'
  });
  console.log('   提交成功, 提交ID:', submission.id);

  console.log('\n7. 获取提交记录:');
  const submissions = await get(`/api/forms/${formId}/submissions`);
  console.log('   提交数量:', submissions.length);

  console.log('\n8. 更新表单:');
  
  function patch(path, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const options = {
        hostname: 'localhost',
        port: 3001,
        path,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
  
  const updatedForm = await patch(`/api/forms/${formId}`, {
    name: '测试表单',
    description: '更新后的描述',
    webhookUrl: '',
    fields: [
      ...testForm.fields,
      {
        key: 'email',
        label: '邮箱',
        type: 'text',
        required: false,
        typeMeta: { maxLength: 200 }
      }
    ]
  });
  console.log('   更新结果:', JSON.stringify(updatedForm).substring(0, 200));
  console.log('   更新成功, 新版本:', updatedForm.version);

  console.log('\n9. 复制表单:');
  const copiedForm = await post(`/api/forms/${formId}/copy`, {});
  console.log('   复制成功, 名称:', copiedForm.name);

  console.log('\n10. 获取所有表单:');
  const allForms = await get('/api/forms');
  console.log('   总表单数:', allForms.length);

  console.log('\n=== 测试完成 ===');
}

runTests().catch(console.error);
