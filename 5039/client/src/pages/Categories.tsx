import { useEffect, useState } from 'react';
import { categoriesApi } from '../api';
import { Category } from '../types';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await categoriesApi.getList();
      setCategories(res.data);
    } catch (error) {
      console.error('加载分类失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || '',
      parent_id: category.parent_id || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请输入分类名称');
      return;
    }

    try {
      if (editingId) {
        await categoriesApi.update(editingId, formData);
      } else {
        await categoriesApi.create(formData);
      }
      resetForm();
      loadCategories();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`确定要删除分类"${name}"吗?`)) {
      try {
        await categoriesApi.delete(id);
        loadCategories();
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败');
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', parent_id: '' });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">分类管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + 新建分类
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h3 className="text-lg font-medium mb-4">
            {editingId ? '编辑分类' : '新建分类'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-gray-600 mb-1">分类名称 *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">描述</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">父级分类</label>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={formData.parent_id}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
              >
                <option value="">无（顶级分类）</option>
                {categories
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex gap-3">
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
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        {loading ? (
          <div className="text-center py-10">加载中...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-500">
                    暂无分类
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {category.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {category.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {new Date(category.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(category)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(category.id, category.name)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
