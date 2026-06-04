import { useState } from 'react';
import { Search, ClipboardList, ArrowRight, CheckCircle, AlertCircle, Home, LogOut } from 'lucide-react';
import { useStore } from '../../store';
import { formatDate } from '../../utils';

export default function HandoverPage() {
  const { handovers, contracts, properties, tenants } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'checkin' | 'checkout'>('all');

  const handoverList = handovers.map((h) => {
    const contract = contracts.find((c) => c.id === h.contractId);
    const property = contract ? properties.find((p) => p.id === contract.propertyId) : null;
    const tenant = contract ? tenants.find((t) => t.id === contract.tenantId) : null;
    return { ...h, contract, property, tenant };
  }).filter((h) => {
    const matchesSearch =
      h.property?.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.tenant?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || h.type === typeFilter;
    return matchesSearch && matchesType;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getHandoverTypeText = (type: string) => {
    return type === 'checkin' ? '入住交接' : '退租交接';
  };

  const getHandoverTypeColor = (type: string) => {
    return type === 'checkin'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-700';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-emerald-100 text-emerald-700';
      case 'normal':
        return 'bg-amber-100 text-amber-700';
      case 'damaged':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'good':
        return '良好';
      case 'normal':
        return '一般';
      case 'damaged':
        return '损坏';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索房源、租客..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'checkin' | 'checkout')}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">全部类型</option>
              <option value="checkin">入住交接</option>
              <option value="checkout">退租交接</option>
            </select>
          </div>
        </div>
      </div>

      {handoverList.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">暂无交接记录</p>
        </div>
      ) : (
        <div className="space-y-6">
          {handoverList.map((handover) => (
            <div key={handover.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      handover.type === 'checkin' ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}>
                      {handover.type === 'checkin' ? (
                        <Home className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <LogOut className="w-6 h-6 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800">
                          {handover.property?.address}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getHandoverTypeColor(handover.type)}`}>
                          {getHandoverTypeText(handover.type)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        租客：{handover.tenant?.name} | 交接日期：{formatDate(handover.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    合同编号：<span className="font-mono text-blue-600">{handover.contract?.contractNo}</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-4">设施检查清单</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {handover.checklist.map((item, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </div>
                      {item.remarks && (
                        <p className="text-xs text-slate-500">{item.remarks}</p>
                      )}
                    </div>
                  ))}
                </div>

                {handover.remarks && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">备注：</span>
                      {handover.remarks}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
