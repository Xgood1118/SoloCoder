import React, { useState, useMemo } from 'react';
import { ResponseData } from '../types';
import JSONViewer from './JSONViewer';
import { executeJSONPath, isValidJSONPath } from '../utils/jsonpath';
import { parseJSONSafe, getResponseSize, shouldTruncateResponse } from '../utils/format';

interface ResponseViewerProps {
  response: ResponseData | null;
  loading: boolean;
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, loading }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const [jsonPath, setJsonPath] = useState('');
  const [showTruncated, setShowTruncated] = useState(true);
  const [jsonPathResults, setJsonPathResults] = useState<any[]>([]);

  const { valid: isJsonValid, data: parsedData } = useMemo(() => {
    if (!response?.data) return { valid: true, data: undefined };
    return parseJSONSafe(response.data);
  }, [response?.data]);

  const truncateInfo = useMemo(() => {
    if (!response?.data) return { shouldTruncate: false, lineCount: 0, truncatedText: '' };
    return shouldTruncateResponse(response.data, 500);
  }, [response?.data]);

  const handleJSONPathChange = (value: string) => {
    setJsonPath(value);
    if (value && isJsonValid && parsedData) {
      const results = executeJSONPath(parsedData, value);
      setJsonPathResults(results);
    } else {
      setJsonPathResults([]);
    }
  };

  const downloadResponse = () => {
    if (!response?.data) return;
    const content = typeof response.data === 'string' 
      ? response.data 
      : JSON.stringify(response.data, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusClass = (status?: number) => {
    if (!status) return 'status-error';
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 300 && status < 400) return 'status-3xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    return 'status-5xx';
  };

  const highlightPaths = jsonPathResults.map((r) => r.pointer);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          正在发送请求...
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        发送请求后响应将显示在这里
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-4">
          {response.success && response.status && (
            <span className={`font-mono text-sm font-bold ${getStatusClass(response.status)}`}>
              {response.status} {response.statusText}
            </span>
          )}
          {!response.success && (
            <span className="text-red-600 text-sm font-bold">{response.error || '请求失败'}</span>
          )}
          {response.responseTime && (
            <span className="text-sm text-gray-500">{response.responseTime}ms</span>
          )}
          {response.data && (
            <span className="text-sm text-gray-500">{getResponseSize(response.data)}</span>
          )}
        </div>
        {response.data && (
          <button
            onClick={downloadResponse}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
          >
            下载响应
          </button>
        )}
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('body')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'body'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Body
        </button>
        <button
          onClick={() => setActiveTab('headers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'headers'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Headers
        </button>
      </div>

      {activeTab === 'body' && response.data && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {isJsonValid && (
            <div className="px-4 py-2 border-b">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">JSONPath:</span>
                <input
                  type="text"
                  value={jsonPath}
                  onChange={(e) => handleJSONPathChange(e.target.value)}
                  placeholder="$.data.items[0].name"
                  className={`flex-1 px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    !isValidJSONPath(jsonPath) ? 'border-red-300' : ''
                  }`}
                />
                {jsonPathResults.length > 0 && (
                  <span className="text-sm text-green-600">
                    找到 {jsonPathResults.length} 个匹配
                  </span>
                )}
              </div>
            </div>
          )}

          {jsonPathResults.length > 0 && (
            <div className="px-4 py-2 bg-yellow-50 border-b">
              <div className="text-sm font-medium text-yellow-800 mb-1">匹配结果:</div>
              <div className="response-text text-sm">
                {JSON.stringify(jsonPathResults.map((r) => r.value), null, 2)}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            {truncateInfo.shouldTruncate && showTruncated ? (
              <div>
                <div className="mb-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded">
                  响应过大 ({truncateInfo.lineCount} 行)，已截断显示前 500 行。
                  <button
                    onClick={() => setShowTruncated(false)}
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    显示全部
                  </button>
                </div>
                <pre className="response-text text-gray-800">{truncateInfo.truncatedText}</pre>
              </div>
            ) : isJsonValid ? (
              <JSONViewer data={parsedData} highlightPaths={highlightPaths} />
            ) : (
              <pre className="response-text text-gray-800">
                {typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {activeTab === 'headers' && response.headers && (
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(response.headers).map(([key, value]) => (
                <tr key={key} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium text-gray-700 w-1/3">{key}</td>
                  <td className="py-2 text-gray-600 break-all">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ResponseViewer;
