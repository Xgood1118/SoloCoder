import React, { useState, useEffect } from 'react';
import { HistoryItem, RequestConfig } from '../types';
import { getHistory, deleteHistory, clearHistory, searchHistory } from '../utils/db';

interface HistoryPanelProps {
  onLoadRequest: (config: RequestConfig) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onLoadRequest }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      searchHistory(searchQuery).then(setHistory);
    } else {
      loadHistory();
    }
  }, [searchQuery]);

  const loadHistory = async () => {
    const items = await getHistory(100);
    setHistory(items);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteHistory(id);
    loadHistory();
  };

  const handleClearAll = async () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      await clearHistory();
      setHistory([]);
    }
  };

  const handleLoad = (item: HistoryItem) => {
    onLoadRequest(item.request);
    setIsOpen(false);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        历史记录
        {isOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-96 flex flex-col">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">请求历史</span>
              {history.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  清空全部
                </button>
              )}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 URL 或方法..."
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 overflow-auto">
            {history.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? '没有找到匹配的记录' : '暂无历史记录'}
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleLoad(item)}
                  className="p-3 border-b hover:bg-gray-50 cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono text-xs font-bold method-${item.method}`}>
                      {item.method}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(item.timestamp)}</span>
                  </div>
                  <div className="text-sm text-gray-700 truncate mb-1">{item.url}</div>
                  <div className="flex items-center justify-between">
                    {item.response?.status && (
                      <span className={`text-xs ${
                        item.response.status >= 200 && item.response.status < 300
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {item.response.status}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
