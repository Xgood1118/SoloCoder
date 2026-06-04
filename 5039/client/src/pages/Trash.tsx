import { useEffect, useState } from 'react';
import { articlesApi } from '../api';
import { Article } from '../types';

export default function Trash() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const res = await articlesApi.getList({ include_deleted: true });
      const allArticles = res.data.data || [];
      setArticles(allArticles.filter((a: Article) => a.deleted_at));
    } catch (error) {
      console.error('加载回收站失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string, title: string) => {
    if (confirm(`确定要恢复文章"${title}"吗?`)) {
      try {
        await articlesApi.restore(id);
        loadTrash();
      } catch (error) {
        console.error('恢复失败:', error);
      }
    }
  };

  const handleDeletePermanent = async (id: string, title: string) => {
    if (confirm(`确定要永久删除文章"${title}"吗?此操作不可恢复!`)) {
      try {
        await articlesApi.delete(id, true);
        loadTrash();
      } catch (error) {
        console.error('删除失败:', error);
      }
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">回收站</h1>

      <div className="bg-white rounded-lg shadow-sm">
        {loading ? (
          <div className="text-center py-10">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">标题</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">删除时间</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {articles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-gray-500">
                      回收站为空
                    </td>
                  </tr>
                ) : (
                  articles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{article.title}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {new Date(article.deleted_at!).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleRestore(article.id, article.title)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            恢复
                          </button>
                          <button
                            onClick={() => handleDeletePermanent(article.id, article.title)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            永久删除
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
      </div>
    </div>
  );
}
