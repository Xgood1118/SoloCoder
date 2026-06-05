import { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import type { KnowledgeDoc } from '@/types';
import { authFetch } from '@/stores/auth.store';

export default function AdminKnowledge() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');

  const fetchDocs = async () => {
    const res = await authFetch('/api/knowledge');
    if (res.ok) {
      const data = await res.json();
      setDocs(data);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleAdd = async () => {
    if (!title.trim() || !content.trim() || !category.trim()) return;
    const res = await authFetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, content }),
    });
    if (res.ok) {
      setTitle(''); setCategory(''); setContent('');
      setShowAdd(false);
      fetchDocs();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await authFetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    if (res.ok) fetchDocs();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await authFetch('/api/knowledge/upload', { method: 'POST', body: formData });
    if (res.ok) fetchDocs();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-light-300">共 {docs.length} 条文档</span>
        <div className="flex gap-2">
          <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-dark-700 px-3 py-1.5 text-xs text-light-200 transition-colors hover:bg-dark-600">
            <Upload className="h-3.5 w-3.5" />
            导入文件
            <input type="file" accept=".txt,.md,.pdf,.docx" onChange={handleUpload} className="hidden" />
          </label>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/80"
          >
            <Plus className="h-3.5 w-3.5" />
            新增文档
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-xl border border-dark-600 bg-dark-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-light-100">新增知识文档</h3>
            <button onClick={() => setShowAdd(false)} className="text-light-300 hover:text-light-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="文档标题" className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-light-100 placeholder:text-light-300 focus:border-primary/50 focus:outline-none"
            />
            <input
              value={category} onChange={(e) => setCategory(e.target.value)}
              placeholder="分类" className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-light-100 placeholder:text-light-300 focus:border-primary/50 focus:outline-none"
            />
            <textarea
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="文档内容" rows={4}
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-light-100 placeholder:text-light-300 focus:border-primary/50 focus:outline-none"
            />
            <button onClick={handleAdd} className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/80">
              提交
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-dark-600">
        <table className="w-full text-left text-sm">
          <thead className="bg-dark-700">
            <tr>
              <th className="px-4 py-3 font-medium text-light-200">标题</th>
              <th className="px-4 py-3 font-medium text-light-200">分类</th>
              <th className="px-4 py-3 font-medium text-light-200">状态</th>
              <th className="px-4 py-3 font-medium text-light-200">创建时间</th>
              <th className="px-4 py-3 font-medium text-light-200">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-600">
            {docs.map((doc) => (
              <tr key={doc.id} className="bg-dark-800 hover:bg-dark-700/50">
                <td className="px-4 py-3 text-light-100">{doc.title}</td>
                <td className="px-4 py-3 text-light-300">{doc.category || '-'}</td>
                <td className="px-4 py-3">
                  <span className={doc.indexed ? 'text-green-400' : 'text-amber-400'}>
                    {doc.indexed ? '已索引' : '待索引'}
                  </span>
                </td>
                <td className="px-4 py-3 text-light-300">
                  {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(doc.id)} className="text-red-400 transition-colors hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 && (
          <div className="py-8 text-center text-sm text-light-300">暂无知识文档</div>
        )}
      </div>
    </div>
  );
}
