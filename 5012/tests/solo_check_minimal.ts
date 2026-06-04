// Minimal test to verify HTTP works when configured via env vars
import SdkCore, { SdkError, ErrorCode } from '../src';

process.env.SDK_SERVICE_NAME = 'env-svc';
process.env.SDK_HTTP_BASE_URL = 'http://127.0.0.1:18800';
process.env.SDK_HTTP_TIMEOUT_MS = '15000';
process.env.SDK_RETRY_MAX_RETRIES = '3';
process.env.SDK_RETRY_INITIAL_DELAY_MS = '10';
process.env.SDK_HEALTH_CHECK_ENABLED = 'true';
process.env.SDK_HEALTH_CHECK_INTERVAL_MS = '5000';

(async () => {
  console.log('Test 1: httpSuccess via env config');
  try {
    const sdk = await SdkCore.createInstance();
    const cfg = sdk.getConfig();
    console.log('serviceName:', cfg.serviceName);
    console.log('baseUrl:', cfg.httpClient.baseUrl);
    console.log('timeoutMs:', cfg.httpClient.timeoutMs);
    const resp = await sdk.get('/get', { timeoutMs: 15000 });
    console.log('status:', resp.status, 'data:', resp.data);
    await sdk.close();
  } catch (e: any) {
    console.log('Error:', e.message, 'code:', e.code);
  }

  console.log('\nTest 2: http404 via env config');
  try {
    const sdk = await SdkCore.createInstance();
    await sdk.get('/status/404', { timeoutMs: 15000 });
    console.log('Unexpected: should have thrown');
  } catch (e: any) {
    if (e instanceof SdkError) {
      console.log('code:', e.code, 'statusCode:', e.statusCode, 'expected: NOT_FOUND, 404');
    } else {
      console.log('Error:', e.message);
    }
  }

  console.log('\nTest 3: http500 via env config');
  try {
    const sdk = await SdkCore.createInstance();
    await sdk.get('/status/500', { timeoutMs: 15000 });
    console.log('Unexpected: should have thrown');
  } catch (e: any) {
    if (e instanceof SdkError) {
      console.log('code:', e.code, 'statusCode:', e.statusCode, 'expected: INTERNAL_SERVER_ERROR, 500');
    } else {
      console.log('Error:', e.message);
    }
  }

  console.log('\nTest 4: globalTimeout via env config');
  try {
    const sdk = await SdkCore.createInstance();
    const start = Date.now();
    await sdk.get('/delay?ms=3000', { timeoutMs: 100 });
    console.log('Unexpected: should have thrown');
  } catch (e: any) {
    if (e instanceof SdkError) {
      console.log('code:', e.code, 'elapsed:', Date.now() - (global as any).startTime, 'expected: REQUEST_TIMEOUT');
    } else {
      console.log('Error:', e.message);
    }
  }

  process.exit(0);
})();
