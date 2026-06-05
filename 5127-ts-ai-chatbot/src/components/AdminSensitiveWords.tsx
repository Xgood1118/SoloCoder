import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, X, Check, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SensitiveWord } from '@/types';
import { authFetch } from '@/stores/auth.store';

const levelMap: Record<string, { label: string; className: string }> = {
  low: { label: '低', className: 'bg-green-500/20 text-green-400' },
  medium: { label: '中', className: 'bg-amber-500/20 text-amber-400' },
  high: { label: '高', className: 'bg-red-500/20 text-red-400' },
};

export default function AdminSensitiveWords() {
  const [words, setWords] = useState<SensitiveWord[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [word, setWord] = useState('');
  const [level, setLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState('');
  const [editLevel, setEditLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [batchText, setBatchText] = useState('');
  const [showBatch, setShowBatch] = useState(false);

  const fetchWords = async () => {
    const res = await authFetch('/api/sensitive-words');
    if (res.ok) {
      const data = await res.json();
      setWords(data);
    }
  };

  useEffect(() => { fetchWords(); }, []);

  const handleAdd = async () => {
    if (!word.trim()) return;
    const res = await authFetch('/api/sensitive-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, level, category }),
    });
    if (res.ok) {
      setWord(''); setLevel('medium'); setCategory('');
      setShowAdd(false);
      fetchWords();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await authFetch(`/api/sensitive-words/${id}`, { method: 'DELETE' });
    if (res.ok) fetchWords();
  };

  const startEdit = (w: SensitiveWord) => {
    setEditId(w.id);
    setEditWord(w.word);
    setEditLevel(w.level);
  };

  const confirmEdit = async () => {
    if (!editId || !editWord.trim()) return;
    const res = await authFetch(`/api/sensitive-words/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: editWord, level: editLevel }),
    });
    if (res.ok) {
      setEditId(null);
      fetchWords();
    }
  };

  const handleBatchImport = async () => {
    if (!batchText.trim()) return;
    const lines = batchText.split('\n').filter((l) => l.trim());
    const res = await authFetch('/api/sensitive-words/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: lines.map((l) => ({ word: l.trim(), level: 'medium', category: '' })) }),
    });
    if (res.ok) {
      setBatchText('');
      setShowBatch(false);
      fetchWords();
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-light-300">共 {words.length} 个敏感词</span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBatch(!showBatch)}
            className="flex items-center gap-1 rounded-lg bg-dark-700 px-3 py-1.5 text-xs text-light-200 transition-colors hover:bg-dark-600"
          >
            <Upload className="h-3.5 w-3.5" />
            批量导入
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/80"
          >
            <Plus className="h-3.5 w-3.5" />
            新增敏感词
          </button>
        </div>
      </div>

      {showBatch && (
        <div className="mb-4 rounded-xl border border-dark-600 bg-dark-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-light-100">批量导入</h3>
            <button onClick={() => setShowBatch(false)} className="text-light-300 hover:text-light-100"><X className="h-4 w-4" /></button>
          </div>
          <textarea
            value={batchText} onChange={(e) => setBatchText(e.target.value)}
            placeholder="每行一个敏感词" rows={4}
            className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-light-100 placeholder:text-light-300 focus:border-primary/50 focus:outline-none"
          />
          <button onClick={handleBatchImport} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/80">
            导入
          </button>
        </div>
      )}

      {showAdd && (
        <div className="mb-4 rounded-xl border border-dark-600 bg-dark-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-light-100">新增敏感词</h3>
            <button onClick={() => setShowAdd(false)} className="text-light-300 hover:text-light-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex gap-3">
            <input
              value={word} onChange={(e) => setWord(e.target.value)}
              placeholder="敏感词" className="flex-1 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-light-100 placeholder:text-light-300 focus:border-primary/50 focus:outline-none"
            />
            <select
              value={level} onChange={(e) => setLevel(e.target.value as typeof level)}
              className="rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-light-100 focus:border-primary/50 focus:outline-none"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
            <input
              value={category} onChange={(e) => setCategory(e.target.value)}
              placeholder="分类" className="w-32 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-light-100 placeholder:text-light-300 focus:border-primary/50 focus:outline-none"
            />
            <button onClick={handleAdd} className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/80">添加</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-dark-600">
        <table className="w-full text-left text-sm">
          <thead className="bg-dark-700">
            <tr>
              <th className="px-4 py-3 font-medium text-light-200">敏感词</th>
              <th className="px-4 py-3 font-medium text-light-200">等级</th>
              <th className="px-4 py-3 font-medium text-light-200">分类</th>
              <th className="px-4 py-3 font-medium text-light-200">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-600">
            {words.map((w) => (
              <tr key={w.id} className="bg-dark-800 hover:bg-dark-700/50">
                <td className="px-4 py-3 text-light-100">
                  {editId === w.id ? (
                    <input value={editWord} onChange={(e) => setEditWord(e.target.value)} className="rounded bg-dark-600 px-2 py-0.5 text-sm text-light-100 outline-none" />
                  ) : w.word}
                </td>
                <td className="px-4 py-3">
                  {editId === w.id ? (
                    <select value={editLevel} onChange={(e) => setEditLevel(e.target.value as typeof level)} className="rounded bg-dark-600 px-2 py-0.5 text-sm text-light-100 outline-none">
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                    </select>
                  ) : (
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', levelMap[w.level]?.className)}>
                      {levelMap[w.level]?.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-light-300">{w.category || '-'}</td>
                <td className="px-4 py-3">
                  {editId === w.id ? (
                    <div className="flex gap-1">
                      <button onClick={confirmEdit} className="text-green-400 hover:text-green-300"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditId(null)} className="text-light-300 hover:text-light-100"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(w)} className="text-primary hover:text-primary/80"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(w.id)} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {words.length === 0 && (
          <div className="py-8 text-center text-sm text-light-300">暂无敏感词</div>
        )}
      </div>
    </div>
  );
}
