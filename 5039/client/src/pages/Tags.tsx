import { useEffect, useState } from 'react';
import { tagsApi } from '../api';
import { Tag } from '../types';

export default function Tags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setLoading(true);
    try {
      const res = await tagsApi.getList();
      setTags(res.data);
    } catch (error) {
      console.error('加载标签失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setName(tag.name);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('请输入标签名称');
      return;
    }

    try {
      if (editingId) {
        await tagsApi.update(editingId, { name });
      } else {
        await tagsApi.create({ name });
      }
      resetForm();
      loadTags();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string, tagName: string) => {
    if (confirm(`确定要删除标签"${tagName}"吗?`)) {
      try {
        await tagsApi.delete(id);
        loadTags();
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败');
      }
    }
  };

  const resetForm = () => {
    setName('');
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">标签管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + 新建标签
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h3 className="text-lg font-medium mb-4">
            {editingId ? '编辑标签' : '新建标签'}
          </h3>
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-md">
            <input
              type="text"
              className="flex-1 px-3 py-2 border rounded-lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="标签名称"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              保存
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <div className="text-center py-10">加载中...</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tags.length === 0 ? (
              <p className="text-gray-500">暂无标签</p>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full"
                >
                  <span className="text-gray-800">{tag.name}</span>
                  <button
                    onClick={() => handleEdit(tag)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id, tag.name)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
