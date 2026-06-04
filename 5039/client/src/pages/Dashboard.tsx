import { useEffect, useState } from 'react';
import { articlesApi, approvalsApi } from '../api';
import { Article, Approval } from '../types';
import { Link } from 'react-router-dom';

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  published: '已发布',
  archived: '已归档',
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    published: 0,
    pending: 0,
  });
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [articlesRes, approvalsRes] = await Promise.all([
        articlesApi.getList({ page_size: 5 }),
        approvalsApi.getList({ status: 'pending' }),
      ]);

      const allArticles = await articlesApi.getList({ page_size: 1000 });
      const articles = allArticles.data.data || [];

      setStats({
        total: articles.length,
        draft: articles.filter((a: Article) => a.status === 'draft').length,
        published: articles.filter((a: Article) => a.status === 'published').length,
        pending: articles.filter((a: Article) => a.status === 'pending_approval').length,
      });

      setRecentArticles(articlesRes.data.data || []);
      setPendingApprovals(approvalsRes.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">仪表盘</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="text-3xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-gray-500">总文章数</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="text-3xl font-bold text-gray-600">{stats.draft}</div>
          <div className="text-gray-500">草稿</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="text-3xl font-bold text-green-600">{stats.published}</div>
          <div className="text-gray-500">已发布</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-gray-500">待审批</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">最近文章</h2>
          </div>
          <div className="p-4">
            {recentArticles.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无文章</p>
            ) : (
              <div className="space-y-3">
                {recentArticles.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <Link
                        to={`/articles/${article.id}`}
                        className="font-medium text-gray-800 hover:text-blue-600"
                      >
                        {article.title}
                      </Link>
                      <div className="text-sm text-gray-500">
                        {new Date(article.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full status-${article.status}`}
                    >
                      {statusLabels[article.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">待审批列表</h2>
          </div>
          <div className="p-4">
            {pendingApprovals.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无待审批</p>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between p-3 bg-yellow-50 rounded"
                  >
                    <div>
                      <div className="font-medium text-gray-800">
                        {approval.article_title}
                      </div>
                      <div className="text-sm text-gray-500">
                        申请时间: {new Date(approval.requested_at).toLocaleString()}
                      </div>
                    </div>
                    <Link
                      to="/approvals"
                      className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                    >
                      处理
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
