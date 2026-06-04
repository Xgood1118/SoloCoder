import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { articlesApi, categoriesApi } from '../../api';
import { Article, Category } from '../../types';

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  published: '已发布',
  archived: '已归档',
};

export default function ArticleList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    category_id: '',
    language: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadArticles();
  }, [filters, pagination.page]);

  const loadCategories = async () => {
    try {
      const res = await categoriesApi.getList();
      setCategories(res.data);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const loadArticles = async () => {
    setLoading(true);
    try {
      const [allRes, filteredRes] = await Promise.all([
        articlesApi.getList({ page_size: 1000 }),
        articlesApi.getList({
          ...filters,
          page: pagination.page,
          page_size: pagination.page_size,
        }),
      ]);
      setAllArticles(allRes.data.data || []);
      setArticles(filteredRes.data.data);
      setPagination((prev) => ({ ...prev, total: filteredRes.data.total }));
    } catch (error) {
      console.error('加载文章失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLanguageVersions = (article: Article) => {
    const masterId = article.master_id || article.id;
    return allArticles.filter(
      (a) => a.master_id === masterId || a.id === masterId
    );
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`确定要删除文章"${title}"吗?`)) {
      try {
        await articlesApi.delete(id);
        loadArticles();
      } catch (error) {
        console.error('删除失败:', error);
      }
    }
  };

  const handlePublish = async (id: string) => {
    if (confirm('确定要发布这篇文章吗?')) {
      try {
        await articlesApi.publish(id);
        loadArticles();
      } catch (error) {
        console.error('发布失败:', error);
      }
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.page_size);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">文章管理</h1>
        <Link
          to="/articles/new"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + 新建文章
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="p-4 border-b">
          <div className="flex flex-wrap gap-4">
            <select
              className="px-3 py-2 border rounded-lg"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="pending_approval">待审批</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>

            <select
              className="px-3 py-2 border rounded-lg"
              value={filters.category_id}
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
            >
              <option value="">全部分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              className="px-3 py-2 border rounded-lg"
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value })}
            >
              <option value="">全部语言</option>
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">标题</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">分类</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">语言版本</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">创建时间</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {articles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-500">
                      暂无文章
                    </td>
                  </tr>
                ) : (
                  articles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/articles/${article.id}`}
                          className="font-medium text-gray-800 hover:text-blue-600"
                        >
                          {article.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {article.category_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {getLanguageVersions(article).map((v) => (
                            <Link
                              key={v.id}
                              to={`/articles/${v.id}`}
                              className={`px-2 py-0.5 text-xs rounded border ${
                                v.id === article.id
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                              title={v.title}
                            >
                              {v.language}
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full status-${article.status}`}
                        >
                          {statusLabels[article.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {new Date(article.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            to={`/articles/${article.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            编辑
                          </Link>
                          {article.status === 'draft' && (
                            <button
                              onClick={() => handlePublish(article.id)}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              发布
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(article.id, article.title)}
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
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              共 {pagination.total} 条，第 {pagination.page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                上一页
              </button>
              <button
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                disabled={pagination.page >= totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
