import { useEffect, useState } from 'react';
import { logsApi } from '../api';
import { OperationLog } from '../types';

const actionLabels: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  publish: '发布',
  restore: '恢复',
  delete_permanent: '永久删除',
  restore_version: '版本回滚',
  request_approval: '提交审批',
  approve: '审批通过',
  reject: '审批驳回',
};

const targetTypeLabels: Record<string, string> = {
  article: '文章',
  category: '分类',
  tag: '标签',
  template: '模板',
  approval: '审批',
};

export default function Logs() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    target_type: '',
    action: '',
  });

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter.target_type) params.target_type = filter.target_type;
      const res = await logsApi.getList(params);
      let data = res.data.data;
      if (filter.action) {
        data = data.filter((l: OperationLog) => l.action === filter.action);
      }
      setLogs(data);
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">操作日志</h1>

      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="p-4 border-b">
          <div className="flex flex-wrap gap-4">
            <select
              className="px-3 py-2 border rounded-lg"
              value={filter.target_type}
              onChange={(e) => setFilter({ ...filter, target_type: e.target.value })}
            >
              <option value="">全部类型</option>
              <option value="article">文章</option>
              <option value="category">分类</option>
              <option value="tag">标签</option>
              <option value="template">模板</option>
              <option value="approval">审批</option>
            </select>

            <select
              className="px-3 py-2 border rounded-lg"
              value={filter.action}
              onChange={(e) => setFilter({ ...filter, action: e.target.value })}
            >
              <option value="">全部操作</option>
              <option value="create">创建</option>
              <option value="update">更新</option>
              <option value="delete">删除</option>
              <option value="publish">发布</option>
              <option value="restore">恢复</option>
              <option value="approve">审批通过</option>
              <option value="reject">审批驳回</option>
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作人</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作类型</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">目标类型</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">详情</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500">
                      暂无日志记录
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{log.operator_name}</span>
                        <div className="text-xs text-gray-500">ID: {log.operator_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {targetTypeLabels[log.target_type] || log.target_type}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">
                        {log.details || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {new Date(log.created_at).toLocaleString()}
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
