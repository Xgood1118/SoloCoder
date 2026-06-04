import { Building2, Users, FileText, DollarSign, TrendingUp, AlertTriangle, Clock, Plus } from 'lucide-react';
import { useStore } from '../../store';
import { formatCurrency, isContractExpiringSoon, calculateDaysUntilExpiry } from '../../utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { properties, tenants, contracts, payments, getStats } = useStore();
  const stats = getStats();

  const statCards = [
    {
      title: '总房源数',
      value: stats.totalProperties,
      subValue: `在租 ${stats.rentedProperties} / 待租 ${stats.availableProperties}`,
      icon: Building2,
      gradient: 'from-blue-500 to-blue-600',
      link: '/properties',
    },
    {
      title: '总租客数',
      value: stats.totalTenants,
      subValue: '活跃租客',
      icon: Users,
      gradient: 'from-emerald-500 to-emerald-600',
      link: '/tenants',
    },
    {
      title: '有效合同',
      value: stats.activeContracts,
      subValue: `${stats.expiringContracts} 个即将到期`,
      icon: FileText,
      gradient: 'from-amber-500 to-amber-600',
      link: '/contracts',
    },
    {
      title: '月租金收入',
      value: formatCurrency(stats.monthlyRent),
      subValue: `${stats.overduePayments} 笔逾期`,
      icon: DollarSign,
      gradient: 'from-purple-500 to-purple-600',
      link: '/finance',
    },
  ];

  const expiringContracts = contracts
    .filter((c) => c.status === 'active' && isContractExpiringSoon(c.endDate, 30))
    .slice(0, 5)
    .map((c) => {
      const property = properties.find((p) => p.id === c.propertyId);
      const tenant = tenants.find((t) => t.id === c.tenantId);
      return { ...c, property, tenant, daysLeft: calculateDaysUntilExpiry(c.endDate) };
    });

  const overduePayments = payments
    .filter((p) => p.status === 'overdue')
    .slice(0, 5)
    .map((p) => {
      const contract = contracts.find((c) => c.id === p.contractId);
      const tenant = contract ? tenants.find((t) => t.id === contract.tenantId) : null;
      return { ...p, contract, tenant };
    });

  const recentContracts = [...contracts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((c) => {
      const property = properties.find((p) => p.id === c.propertyId);
      const tenant = tenants.find((t) => t.id === c.tenantId);
      return { ...c, property, tenant };
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">欢迎回来</h2>
          <p className="text-slate-500 mt-1">这是您的业务数据概览</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/properties/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新增房源
          </Link>
          <Link
            to="/contracts/new"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            新建合同
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <Link
            key={index}
            to={card.link}
            className="relative overflow-hidden rounded-2xl p-6 bg-white shadow-sm hover:shadow-md transition-all duration-300 group"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2`} />
            <div className="relative">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-slate-500">{card.title}</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{card.value}</p>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {card.subValue}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-800">即将到期合同</h3>
            </div>
            <Link to="/contracts" className="text-sm text-blue-600 hover:text-blue-700">
              查看全部
            </Link>
          </div>
          {expiringContracts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              暂无即将到期的合同
            </div>
          ) : (
            <div className="space-y-4">
              {expiringContracts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{c.contractNo}</p>
                    <p className="text-sm text-slate-500 truncate">
                      {c.tenant?.name} - {c.property?.address.slice(0, 15)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full">
                      {c.daysLeft} 天后到期
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-slate-800">逾期缴费提醒</h3>
            </div>
            <Link to="/finance" className="text-sm text-blue-600 hover:text-blue-700">
              查看全部
            </Link>
          </div>
          {overduePayments.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              暂无逾期缴费记录
            </div>
          ) : (
            <div className="space-y-4">
              {overduePayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800">{p.tenant?.name}</p>
                    <p className="text-sm text-slate-500">{p.period} 租金</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-red-600">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-red-500">含滞纳金 {formatCurrency(p.lateFee)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-800">最近签订合同</h3>
          <Link to="/contracts" className="text-sm text-blue-600 hover:text-blue-700">
            查看全部
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">合同编号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">租客</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">房源</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">月租金</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">期限</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
              </tr>
            </thead>
            <tbody>
              {recentContracts.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 font-medium text-slate-800">{c.contractNo}</td>
                  <td className="py-4 px-4 text-slate-600">{c.tenant?.name}</td>
                  <td className="py-4 px-4 text-slate-600 max-w-xs truncate">{c.property?.address}</td>
                  <td className="py-4 px-4 text-slate-800 font-medium">{formatCurrency(c.monthlyRent)}</td>
                  <td className="py-4 px-4 text-slate-600 text-sm">
                    {c.startDate} ~ {c.endDate}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      c.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'expired' ? 'bg-slate-100 text-slate-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {c.status === 'active' ? '生效中' : c.status === 'expired' ? '已到期' : '已终止'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
