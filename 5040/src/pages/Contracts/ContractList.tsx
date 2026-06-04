import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Eye, FileText, Building2, Users, Calendar, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import {
  getContractStatusText,
  getContractStatusColor,
  getContractTemplateText,
  formatCurrency,
  formatDate,
  isContractExpiringSoon,
  calculateDaysUntilExpiry,
} from '../../utils';
import type { ContractStatus, ContractTemplateType } from '../../types';

export default function ContractList() {
  const { contracts, properties, tenants } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [templateFilter, setTemplateFilter] = useState<ContractTemplateType | 'all'>('all');

  const filteredContracts = contracts
    .map((c) => ({
      ...c,
      property: properties.find((p) => p.id === c.propertyId),
      tenant: tenants.find((t) => t.id === c.tenantId),
      isExpiringSoon: isContractExpiringSoon(c.endDate, 30),
      daysLeft: calculateDaysUntilExpiry(c.endDate),
    }))
    .filter((c) => {
      const matchesSearch =
        c.contractNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.tenant?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.property?.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesTemplate = templateFilter === 'all' || c.templateType === templateFilter;
      return matchesSearch && matchesStatus && matchesTemplate;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索合同、租客、房源..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ContractStatus | 'all')}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">全部状态</option>
              <option value="active">生效中</option>
              <option value="expired">已到期</option>
              <option value="terminated">已终止</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value as ContractTemplateType | 'all')}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">全部类型</option>
              <option value="residential">住宅租赁</option>
              <option value="commercial">商铺租赁</option>
              <option value="office">写字楼租赁</option>
            </select>
          </div>
        </div>
        <Link
          to="/contracts/new"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新建合同
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredContracts.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl shadow-sm p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">暂无合同数据</p>
          </div>
        ) : (
          filteredContracts.map((contract) => (
            <div
              key={contract.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-blue-600 font-semibold">{contract.contractNo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getContractStatusColor(contract.status)}`}>
                        {getContractStatusText(contract.status)}
                      </span>
                      {contract.isExpiringSoon && contract.status === 'active' && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          {contract.daysLeft}天后到期
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{getContractTemplateText(contract.templateType)}</span>
                  </div>
                  <Link
                    to={`/contracts/${contract.id}`}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-600 truncate">{contract.property?.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-600">{contract.tenant?.name}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600">{contract.tenant?.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-600">
                      {formatDate(contract.startDate)} ~ {formatDate(contract.endDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500">月租金</span>
                  <p className="text-xl font-bold text-slate-800">{formatCurrency(contract.monthlyRent)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">履约保证金</span>
                  <p className="text-lg font-semibold text-slate-700">{formatCurrency(contract.deposit)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">付款方式</span>
                  <p className="text-sm font-medium text-slate-700">{contract.paymentMethod}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
