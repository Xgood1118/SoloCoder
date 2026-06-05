import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Copy } from 'lucide-react';
import type { Session, Message } from '@/types';
import { authFetch } from '@/stores/auth.store';

interface HistoryItem {
  session: Session;
  messages: Message[];
}

export default function History() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/history/search?q=${encodeURIComponent(keyword.trim())}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  const copyToCurrent = async (sessionId: string) => {
    await authFetch('/api/history/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceSessionId: sessionId, targetSessionId: '', messageIds: [] }),
    });
    navigate('/');
  };

  return (
    <div className="flex h-screen flex-col bg-dark-900">
      <div className="flex items-center gap-4 border-b border-dark-600 bg-dark-800 px-6 py-4">
        <button onClick={() => navigate('/')} className="text-light-300 transition-colors hover:text-light-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-light-100">历史记录</h1>
      </div>

      <div className="border-b border-dark-600 bg-dark-800 px-6 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2">
          <Search className="h-4 w-4 text-light-300" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索历史对话..."
            className="flex-1 bg-transparent text-sm text-light-100 placeholder:text-light-300 focus:outline-none"
          />
          <button
            onClick={search}
            disabled={!keyword.trim()}
            className="rounded-md bg-primary px-3 py-1 text-xs text-white transition-colors hover:bg-primary/80 disabled:opacity-40"
          >
            搜索
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && <div className="text-center text-sm text-light-300">搜索中...</div>}

        {!loading && results.length === 0 && keyword && (
          <div className="text-center text-sm text-light-300">未找到相关对话</div>
        )}

        {!loading && results.length === 0 && !keyword && (
          <div className="text-center text-sm text-light-300">输入关键词搜索历史对话</div>
        )}

        {results.map((item) => (
          <div key={item.session.id} className="mb-4 rounded-xl border border-dark-600 bg-dark-800 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-light-100">{item.session.title || '未命名会话'}</h3>
                <p className="mt-1 text-xs text-light-300">
                  {new Date(item.session.updatedAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <button
                onClick={() => copyToCurrent(item.session.id)}
                className="flex items-center gap-1 rounded-md bg-primary/15 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/25"
              >
                <Copy className="h-3 w-3" />
                复制到当前对话
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {item.messages.slice(0, 4).map((msg) => (
                <div key={msg.id} className="flex gap-2 text-xs">
                  <span className={msg.role === 'user' ? 'text-primary' : 'text-green-400'}>
                    {msg.role === 'user' ? '用户' : '助手'}
                  </span>
                  <span className="line-clamp-2 text-light-200">{msg.content}</span>
                </div>
              ))}
              {item.messages.length > 4 && (
                <p className="text-xs text-light-300">还有 {item.messages.length - 4} 条消息...</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
