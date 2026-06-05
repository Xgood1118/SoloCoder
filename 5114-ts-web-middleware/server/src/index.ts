import express from 'express';
import cors from 'cors';
import axios, { AxiosRequestConfig, Method } from 'axios';

const app = express();
const PORT = process.env.PORT || 8514;

app.use(cors({
  origin: ['http://localhost:8515', 'http://127.0.0.1:8515'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

interface ProxyRequest {
  url: string;
  method: Method;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: any;
  timeout?: number;
}

interface ProxyResponse {
  success: boolean;
  data?: any;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  error?: string;
  responseTime?: number;
}

app.post('/api/proxy', async (req, res) => {
  const { url, method, headers = {}, params, data, timeout = 30000 }: ProxyRequest = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    } as ProxyResponse);
  }

  try {
    const startTime = Date.now();

    const axiosConfig: AxiosRequestConfig = {
      url,
      method: method || 'GET',
      headers: {
        ...headers,
      },
      params,
      timeout,
      validateStatus: () => true,
      responseType: 'arraybuffer',
    };

    if (data && Object.keys(data).length > 0) {
      axiosConfig.data = data;
    }

    const response = await axios(axiosConfig);
    const responseTime = Date.now() - startTime;

    const responseHeaders: Record<string, string> = {};
    Object.entries(response.headers).forEach(([key, value]) => {
      responseHeaders[key] = String(value);
    });

    const contentType = String(response.headers['content-type'] || '');
    let responseData: any;

    if (contentType.includes('application/json') || contentType.includes('+json')) {
      try {
        responseData = JSON.parse(response.data.toString('utf-8'));
      } catch {
        responseData = response.data.toString('utf-8');
      }
    } else if (contentType.includes('text/')) {
      responseData = response.data.toString('utf-8');
    } else {
      responseData = response.data.toString('base64');
    }

    const result: ProxyResponse = {
      success: true,
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      responseTime
    };

    res.json(result);
  } catch (error: any) {
    const errorResult: ProxyResponse = {
      success: false,
      error: error.message || 'Request failed',
      status: error.response?.status,
      statusText: error.response?.statusText,
    };

    if (error.response) {
      errorResult.headers = error.response.headers;
      try {
        errorResult.data = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data);
      } catch {
        errorResult.data = 'Error response data';
      }
    }

    res.status(200).json(errorResult);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`API Debug Server is running on http://localhost:${PORT}`);
});
