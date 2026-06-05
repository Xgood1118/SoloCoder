import axios from 'axios';
import { RequestConfig, ResponseData } from '../types';

const PROXY_URL = '/api/proxy';

export async function sendRequest(config: RequestConfig): Promise<ResponseData> {
  const headers: Record<string, string> = {};
  config.headers.forEach((h) => {
    if (h.enabled && h.key) {
      headers[h.key] = h.value;
    }
  });

  const params: Record<string, string> = {};
  config.params.forEach((p) => {
    if (p.enabled && p.key) {
      params[p.key] = p.value;
    }
  });

  let data: any = undefined;
  if (config.method !== 'GET' && config.method !== 'HEAD') {
    switch (config.bodyType) {
      case 'json':
        if (config.body.json.trim()) {
          try {
            data = JSON.parse(config.body.json);
          } catch {
            data = config.body.json;
          }
        }
        break;
      case 'formdata':
        data = {};
        config.body.formdata.forEach((f) => {
          if (f.enabled && f.key) {
            data[f.key] = f.value;
          }
        });
        break;
      case 'raw':
        if (config.body.raw.trim()) {
          data = config.body.raw;
        }
        break;
    }
  }

  try {
    const response = await axios.post(PROXY_URL, {
      url: config.url,
      method: config.method,
      headers,
      params,
      data,
    });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '请求失败',
    };
  }
}
