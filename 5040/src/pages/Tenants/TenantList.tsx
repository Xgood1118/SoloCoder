import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Edit, Trash2, Users, Phone, UserCircle } from 'lucide-react';
import { useStore } from '../../store';
import { maskPhone, maskIdCard, formatDate } from '../../utils';

export default function TenantList() {
  const { tenants, contracts, deleteTenant } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredTenants = tenants.filter((t) => {
    return (
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.phone.includes(searchTerm)
    );
  });

  const getTenantContractCount = (tenantId: string) => {
    return contracts.filter((c) => c.tenantId === tenantId).length;
  };

  const handleDelete = (id: string) => {
    deleteTenant(id);
    setShowDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索租客姓名、电话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <Link
          to="/tenants/new"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新增租客
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTenants.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl shadow-sm p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">暂无租客数据</p>
          </div>
        ) : (
          filteredTenants.map((tenant) => (
            <div
              key={tenant.id}
              className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-lg font-semibold shadow-lg">
                    {tenant.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{tenant.name}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {maskPhone(tenant.phone)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to={`/tenants/${tenant.id}`}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/tenants/${tenant.id}?edit=true`}
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setShowDeleteConfirm(tenant.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-1">
                    <UserCircle className="w-4 h-4" />
                    身份证号
                  </span>
                  <span className="text-slate-700 font-mono">{maskIdCard(tenant.idCard)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">紧急联系人</span>
                  <span className="text-slate-700">{tenant.emergencyContact}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">签约合同</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-medium">
                    {getTenantContractCount(tenant.id)} 份
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">录入时间</span>
                  <span className="text-slate-600">{formatDate(tenant.createdAt)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">确认删除</h3>
            <p className="text-slate-500 mb-6">确定要删除该租客信息吗？此操作不可撤销。</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
