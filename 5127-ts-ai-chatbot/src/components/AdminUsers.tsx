import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import { authFetch } from '@/stores/auth.store';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = async () => {
    const res = await authFetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleEnabled = async (id: string, enabled: boolean) => {
    const res = await authFetch(`/api/users/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (res.ok) fetchUsers();
  };

  const roleLabel = (role: string) => role === 'admin' ? '管理员' : '普通用户';

  return (
    <div>
      <div className="mb-4">
        <span className="text-sm text-light-300">共 {users.length} 个用户</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-dark-600">
        <table className="w-full text-left text-sm">
          <thead className="bg-dark-700">
            <tr>
              <th className="px-4 py-3 font-medium text-light-200">用户名</th>
              <th className="px-4 py-3 font-medium text-light-200">角色</th>
              <th className="px-4 py-3 font-medium text-light-200">状态</th>
              <th className="px-4 py-3 font-medium text-light-200">最后登录</th>
              <th className="px-4 py-3 font-medium text-light-200">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-600">
            {users.map((u) => (
              <tr key={u.id} className="bg-dark-800 hover:bg-dark-700/50">
                <td className="px-4 py-3 text-light-100">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs',
                    u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                  )}>
                    {roleLabel(u.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={u.enabled ? 'text-green-400' : 'text-red-400'}>
                    {u.enabled ? '启用' : '禁用'}
                  </span>
                </td>
                <td className="px-4 py-3 text-light-300">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-CN') : '-'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleEnabled(u.id, u.enabled)}
                    className={cn(
                      'rounded-lg px-3 py-1 text-xs transition-colors',
                      u.enabled
                        ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                        : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                    )}
                  >
                    {u.enabled ? '禁用' : '启用'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-8 text-center text-sm text-light-300">暂无用户</div>
        )}
      </div>
    </div>
  );
}
