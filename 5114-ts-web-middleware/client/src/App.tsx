import { useState, useCallback } from 'react';
import { HttpMethod, RequestConfig, ResponseData, KeyValuePair } from './types';
import { sendRequest } from './utils/api';
import { generateId } from './utils/format';
import { addHistory } from './utils/db';
import KeyValueEditor from './components/KeyValueEditor';
import BodyEditor from './components/BodyEditor';
import ResponseViewer from './components/ResponseViewer';
import HistoryPanel from './components/HistoryPanel';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

const createDefaultRequest = (): RequestConfig => ({
  url: 'https://jsonplaceholder.typicode.com/posts/1',
  method: 'GET',
  params: [{ id: generateId(), key: '', value: '', enabled: true }],
  headers: [
    { id: generateId(), key: 'Content-Type', value: 'application/json', enabled: true },
  ],
  bodyType: 'none',
  body: {
    json: '',
    formdata: [{ id: generateId(), key: '', value: '', enabled: true }],
    raw: '',
  },
});

function App() {
  const [request, setRequest] = useState<RequestConfig>(createDefaultRequest());
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params');

  const handleSend = useCallback(async () => {
    if (!request.url) {
      alert('请输入 URL');
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const result = await sendRequest(request);
      setResponse(result);

      const historyItem = {
        id: generateId(),
        url: request.url,
        method: request.method,
        request: { ...request },
        response: result,
        timestamp: Date.now(),
      };
      await addHistory(historyItem);
    } catch (error) {
      setResponse({
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  }, [request]);

  const handleLoadRequest = useCallback((config: RequestConfig) => {
    setRequest(config);
    setResponse(null);
  }, []);

  const updateRequest = <K extends keyof RequestConfig>(
    key: K,
    value: RequestConfig[K]
  ) => {
    setRequest((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">API Debug Tool</h1>
        </div>
        <HistoryPanel onLoadRequest={handleLoadRequest} />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col border-r bg-white">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-4">
              <select
                value={request.method}
                onChange={(e) => updateRequest('method', e.target.value as HttpMethod)}
                className={`px-3 py-2 border rounded-md font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 method-${request.method}`}
              >
                {HTTP_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={request.url}
                onChange={(e) => updateRequest('url', e.target.value)}
                placeholder="输入请求 URL..."
                className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '发送中...' : '发送'}
              </button>
            </div>

            <div className="flex border-b">
              {(['params', 'headers', 'body'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab === 'params' ? 'Query 参数' : tab === 'headers' ? 'Headers' : 'Body'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'params' && (
              <KeyValueEditor
                items={request.params}
                onChange={(items) => updateRequest('params', items)}
                placeholderKey="参数名"
                placeholderValue="值"
              />
            )}

            {activeTab === 'headers' && (
              <KeyValueEditor
                items={request.headers}
                onChange={(items) => updateRequest('headers', items)}
                placeholderKey="Header 名"
                placeholderValue="值"
              />
            )}

            {activeTab === 'body' && (
              <BodyEditor
                bodyType={request.bodyType}
                onTypeChange={(type) => updateRequest('bodyType', type)}
                json={request.body.json}
                onJsonChange={(value) =>
                  updateRequest('body', { ...request.body, json: value })
                }
                formdata={request.body.formdata}
                onFormdataChange={(items: KeyValuePair[]) =>
                  updateRequest('body', { ...request.body, formdata: items })
                }
                raw={request.body.raw}
                onRawChange={(value) =>
                  updateRequest('body', { ...request.body, raw: value })
                }
              />
            )}
          </div>
        </div>

        <div className="w-1/2 bg-white">
          <ResponseViewer response={response} loading={loading} />
        </div>
      </div>
    </div>
  );
}

export default App;
