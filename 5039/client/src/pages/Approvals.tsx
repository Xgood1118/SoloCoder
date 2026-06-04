import { useEffect, useState } from 'react';
import { approvalsApi } from '../api';
import { Approval } from '../types';

const statusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
};

const statusClasses: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadApprovals();
  }, [filter]);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const res = await approvalsApi.getList(params);
      setApprovals(res.data);
    } catch (error) {
      console.error('加载审批失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const note = prompt('请输入审批备注(可选):');
    if (confirm('确定通过审批?')) {
      try {
        await approvalsApi.approve(id, note || undefined);
        loadApprovals();
      } catch (error) {
        console.error('审批失败:', error);
        alert('审批失败');
      }
    }
  };

  const handleReject = async (id: string) => {
    const note = prompt('请输入驳回原因:');
    if (note && confirm('确定驳回审批?')) {
      try {
        await approvalsApi.reject(id, note);
        loadApprovals();
      } catch (error) {
        console.error('驳回失败:', error);
        alert('驳回失败');
      }
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">审批中心</h1>

      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="p-4 border-b">
          <div className="flex gap-4">
            <button
              className={`px-4 py-2 rounded-lg ${
                filter === '' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setFilter('')}
            >
              全部
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${
                filter === 'pending' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setFilter('pending')}
            >
              待审批
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${
                filter === 'approved' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setFilter('approved')}
            >
              已通过
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${
                filter === 'rejected' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setFilter('rejected')}
            >
              已驳回
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">文章标题</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">申请备注</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">申请时间</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500">
                      暂无审批记录
                    </td>
                  </tr>
                ) : (
                  approvals.map((approval) => (
                    <tr key={approval.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {approval.article_title}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${statusClasses[approval.status]}`}
                        >
                          {statusLabels[approval.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">
                        {approval.request_note || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {new Date(approval.requested_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {approval.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(approval.id)}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              通过
                            </button>
                            <button
                              onClick={() => handleReject(approval.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              驳回
                            </button>
                          </div>
                        )}
                        {approval.status !== 'pending' && (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
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
