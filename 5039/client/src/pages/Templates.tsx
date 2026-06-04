import { useEffect, useState } from 'react';
import { templatesApi } from '../api';
import { Template } from '../types';

const templateTypes = [
  { value: 'news', label: '新闻快讯' },
  { value: 'product', label: '产品介绍' },
  { value: 'case', label: '用户案例' },
  { value: 'blog', label: '博客文章' },
];

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'news',
    layout_config: '{}',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await templatesApi.getList();
      setTemplates(res.data);
    } catch (error) {
      console.error('加载模板失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      type: template.type,
      layout_config: template.layout_config,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请输入模板名称');
      return;
    }

    try {
      const layoutConfig = JSON.parse(formData.layout_config);
      if (editingId) {
        await templatesApi.update(editingId, { ...formData, layout_config: layoutConfig });
      } else {
        await templatesApi.create({ ...formData, layout_config: layoutConfig });
      }
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请检查JSON格式是否正确');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`确定要删除模板"${name}"吗?`)) {
      try {
        await templatesApi.delete(id);
        loadTemplates();
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败');
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'news', layout_config: '{}' });
    setEditingId(null);
    setShowForm(false);
  };

  const getTypeLabel = (type: string) => {
    return templateTypes.find((t) => t.value === type)?.label || type;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">模板管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + 新建模板
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h3 className="text-lg font-medium mb-4">
            {editingId ? '编辑模板' : '新建模板'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm text-gray-600 mb-1">模板名称 *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">模板类型</label>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {templateTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">布局配置 (JSON)</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                rows={8}
                value={formData.layout_config}
                onChange={(e) => setFormData({ ...formData, layout_config: e.target.value })}
                placeholder='{"sidebar": true, "showAuthor": true}'
              />
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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-500">
                    暂无模板
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {template.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                        {getTypeLabel(template.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {new Date(template.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(template)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(template.id, template.name)}
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
