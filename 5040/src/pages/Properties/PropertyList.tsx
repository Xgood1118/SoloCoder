import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Eye, Edit, Trash2, Building2 } from 'lucide-react';
import { useStore } from '../../store';
import { getPropertyStatusText, getPropertyStatusColor, formatCurrency } from '../../utils';
import type { PropertyStatus } from '../../types';

export default function PropertyList() {
  const { properties, deleteProperty } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'all'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredProperties = properties.filter((p) => {
    const matchesSearch =
      p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.propertyNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = (id: string) => {
    deleteProperty(id);
    setShowDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索房源地址、编号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PropertyStatus | 'all')}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">全部状态</option>
              <option value="available">待租</option>
              <option value="rented">在租</option>
              <option value="sold">已售</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <Link
          to="/properties/new"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新增房源
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">房源编号</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">房源信息</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">户型</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">面积</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">楼层</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">状态</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400">暂无房源数据</p>
                  </td>
                </tr>
              ) : (
                filteredProperties.map((property) => (
                  <tr key={property.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm text-blue-600 font-medium">{property.propertyNo}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="max-w-xs">
                        <p className="font-medium text-slate-800 truncate">{property.address}</p>
                        <p className="text-sm text-slate-500">{property.decoration} · {property.orientation}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600">{property.layout}</td>
                    <td className="py-4 px-6 text-slate-600">{property.area} ㎡</td>
                    <td className="py-4 px-6 text-slate-600">{property.floor}/{property.totalFloors}层</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getPropertyStatusColor(property.status)}`}>
                        {getPropertyStatusText(property.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/properties/${property.id}`}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/properties/${property.id}?edit=true`}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setShowDeleteConfirm(property.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">确认删除</h3>
            <p className="text-slate-500 mb-6">确定要删除该房源吗？此操作不可撤销。</p>
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
