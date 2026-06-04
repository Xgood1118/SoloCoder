import { useState } from 'react';
import { Search, Filter, DollarSign, Calendar, User, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useStore } from '../../store';
import { formatCurrency, formatDate, getPaymentStatusText, getPaymentStatusColor } from '../../utils';
import type { PaymentStatus } from '../../types';

export default function FinancePage() {
  const { payments, contracts, tenants } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');

  const paymentList = payments.map((p) => {
    const contract = contracts.find((c) => c.id === p.contractId);
    const tenant = contract ? tenants.find((t) => t.id === contract.tenantId) : null;
    return { ...p, contract, tenant };
  }).filter((p) => {
    const matchesSearch =
      p.tenant?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.period.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contract?.contractNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const overdueAmount = payments.filter((p) => p.status === 'overdue').reduce((sum, p) => sum + p.amount + p.lateFee, 0);
  const pendingAmount = payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  const handleMarkPaid = (paymentId: string) => {
    console.log('Mark as paid:', paymentId);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">总收款</span>
            <DollarSign className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">已收款</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(paidAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">待收款</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">逾期金额</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(overdueAmount)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-800">缴费记录</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索租客、周期、合同..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
                  className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="all">全部状态</option>
                  <option value="paid">已缴</option>
                  <option value="pending">待缴</option>
                  <option value="overdue">逾期</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">租客</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">缴费周期</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">应缴金额</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">应缴日期</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">滞纳金</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">实缴日期</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">状态</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400">暂无缴费记录</p>
                  </td>
                </tr>
              ) : (
                paymentList.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {payment.tenant?.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{payment.tenant?.name}</p>
                          <p className="text-xs text-slate-400">{payment.contract?.contractNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600">{payment.period}</td>
                    <td className="py-4 px-6 font-medium text-slate-800">{formatCurrency(payment.amount)}</td>
                    <td className="py-4 px-6 text-slate-600">{formatDate(payment.dueDate)}</td>
                    <td className="py-4 px-6">
                      {payment.lateFee > 0 ? (
                        <span className="text-red-600 font-medium">{formatCurrency(payment.lateFee)}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-600">
                      {payment.paidDate ? formatDate(payment.paidDate) : '-'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(payment.status)}`}>
                        {getPaymentStatusText(payment.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {payment.status !== 'paid' && (
                        <button
                          onClick={() => handleMarkPaid(payment.id)}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          确认缴费
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
