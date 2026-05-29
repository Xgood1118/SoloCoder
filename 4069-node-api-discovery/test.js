const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  const baseOptions = {
    hostname: 'localhost',
    port: 8080,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  console.log('=== 服务发现与注册管理系统 功能测试 ===\n');

  try {
    console.log('1. 注册服务实例 user-service...');
    const registerRes = await makeRequest({
      ...baseOptions,
      method: 'POST',
      path: '/api/v1/services'
    }, {
      name: 'user-service',
      host: 'localhost',
      port: 3001,
      tags: ['v1', 'prod'],
      metadata: { weight: 3, version: '1.0.0' }
    });
    console.log(`   状态码: ${registerRes.statusCode}`);
    console.log(`   实例ID: ${registerRes.data.instance_id}`);
    const instanceId1 = registerRes.data.instance_id;

    console.log('\n2. 注册第二个 user-service 实例...');
    const registerRes2 = await makeRequest({
      ...baseOptions,
      method: 'POST',
      path: '/api/v1/services'
    }, {
      name: 'user-service',
      host: 'localhost',
      port: 3002,
      tags: ['v2', 'staging'],
      metadata: { weight: 1 }
    });
    console.log(`   状态码: ${registerRes2.statusCode}`);
    const instanceId2 = registerRes2.data.instance_id;

    console.log('\n3. 查询所有服务实例...');
    const listRes = await makeRequest({
      ...baseOptions,
      method: 'GET',
      path: '/api/v1/services?name=user-service'
    });
    console.log(`   状态码: ${listRes.statusCode}`);
    console.log(`   实例数量: ${listRes.data.length}`);

    console.log('\n4. 按标签 v1 过滤...');
    const tagRes = await makeRequest({
      ...baseOptions,
      method: 'GET',
      path: '/api/v1/services?name=user-service&tags=v1'
    });
    console.log(`   状态码: ${tagRes.statusCode}`);
    console.log(`   匹配实例数: ${tagRes.data.length}`);

    console.log('\n5. 更新实例元数据...');
    const patchRes = await makeRequest({
      ...baseOptions,
      method: 'PATCH',
      path: `/api/v1/services/${instanceId1}/metadata`
    }, {
      owner: 'team-a',
      region: 'us-east'
    });
    console.log(`   状态码: ${patchRes.statusCode}`);
    console.log(`   元数据:`, patchRes.data);

    console.log('\n6. 手动设置实例状态为 healthy...');
    const stateRes = await makeRequest({
      ...baseOptions,
      method: 'PUT',
      path: `/api/v1/services/${instanceId1}/state`
    }, {
      state: 'healthy'
    });
    console.log(`   状态码: ${stateRes.statusCode}`);
    console.log(`   当前状态: ${stateRes.data.current_state}`);

    console.log('\n7. 手动设置第二个实例状态为 healthy...');
    await makeRequest({
      ...baseOptions,
      method: 'PUT',
      path: `/api/v1/services/${instanceId2}/state`
    }, {
      state: 'healthy'
    });

    console.log('\n8. 服务发现 - 加权随机策略...');
    const discoverRes = await makeRequest({
      ...baseOptions,
      method: 'GET',
      path: '/api/v1/discover/user-service'
    });
    console.log(`   状态码: ${discoverRes.statusCode}`);
    if (discoverRes.data.error) {
      console.log(`   错误: ${discoverRes.data.error}`);
    } else {
      console.log(`   选中实例: ${discoverRes.data.host}:${discoverRes.data.port}`);
      console.log(`   使用策略: ${discoverRes.data.strategy_used}`);
    }

    console.log('\n9. 服务发现 - 轮询策略...');
    const rrRes = await makeRequest({
      ...baseOptions,
      method: 'GET',
      path: '/api/v1/discover/user-service?strategy=round_robin'
    });
    console.log(`   状态码: ${rrRes.statusCode}`);
    if (!rrRes.data.error) {
      console.log(`   选中实例: ${rrRes.data.host}:${rrRes.data.port}`);
    }

    console.log('\n10. 按标签路由 (v2)...');
    const tagDiscoverRes = await makeRequest({
      ...baseOptions,
      method: 'GET',
      path: '/api/v1/discover/user-service?tags=v2'
    });
    console.log(`   状态码: ${tagDiscoverRes.statusCode}`);
    if (!tagDiscoverRes.data.error) {
      console.log(`   选中实例: ${tagDiscoverRes.data.host}:${tagDiscoverRes.data.port}`);
      console.log(`   标签: ${tagDiscoverRes.data.tags}`);
    }

    console.log('\n11. 批量注册服务...');
    const batchRes = await makeRequest({
      ...baseOptions,
      method: 'POST',
      path: '/api/v1/services/batch'
    }, {
      services: [
        { name: 'order-service', host: 'localhost', port: 4001, tags: ['v1'] },
        { name: 'payment-service', host: 'localhost', port: 5001, tags: ['v1'] }
      ]
    });
    console.log(`   状态码: ${batchRes.statusCode}`);
    console.log(`   注册数量: ${batchRes.data.results.length}`);

    console.log('\n12. 查询命名空间...');
    const nsRes = await makeRequest({
      ...baseOptions,
      method: 'GET',
      path: '/api/v1/namespaces'
    });
    console.log(`   状态码: ${nsRes.statusCode}`);
    console.log(`   命名空间: ${nsRes.data.namespaces}`);

    console.log('\n13. 导出数据...');
    const exportRes = await makeRequest({
      ...baseOptions,
      method: 'GET',
      path: '/api/v1/export'
    });
    console.log(`   状态码: ${exportRes.statusCode}`);
    console.log(`   导出数据包含 ${Object.keys(exportRes.data.data).length} 个命名空间`);

    console.log('\n14. 上报指标数据...');
    const metricsRes = await makeRequest({
      ...baseOptions,
      method: 'POST',
      path: `/api/v1/services/${instanceId1}/metrics`
    }, {
      requests_count: 150,
      avg_latency_ms: 45,
      error_count: 2
    });
    console.log(`   状态码: ${metricsRes.statusCode}`);

    console.log('\n=== 测试完成 ===');
    console.log('\n系统模块说明:');
    console.log('- registry.js: 服务注册/注销、实例管理（内存 Map CRUD）');
    console.log('- health.js: 健康检查调度器（定时任务 + 状态机流转）');
    console.log('- discovery.js: 服务发现/负载均衡策略（加权随机/轮询/最少连接）');
    console.log('- router.js: 依赖管理 + 命名空间 + 批量操作');
    console.log('- server.js: 入口，HTTP 路由注册');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n请先启动服务器: node server.js');
  }
}

runTests();
