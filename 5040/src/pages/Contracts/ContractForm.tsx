import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, FileText, Clock, DollarSign, Users, Building2, ChevronDown, ChevronUp, Eye, Edit, EyeOff, Star } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useStore } from '../../store';
import { contractTemplates } from '../../data/contractTemplates';
import {
  formatCurrency, formatDate, getPaymentsByContractId, getPaymentStatusText, getPaymentStatusColor } from '../../utils';
import type { ContractTemplateType, ContractStatus, ContractClause } from '../../types';

interface ContractFormData {
  contractNo: string;
  propertyId: string;
  tenantId: string;
  templateType: ContractTemplateType;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  paymentMethod: string;
  deposit: number;
  status: ContractStatus;
  remarks: string;
}

export default function ContractForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { contracts, properties, tenants, payments, addContract, updateContract } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [customClauses, setCustomClauses] = useState<ContractClause[]>([]);
  const [editingClause, setEditingClause] = useState<string | null>(null);

  const isNew = id === 'new';
  const editMode = searchParams.get('edit') === 'true';

  const contract = !isNew ? contracts.find((c) => c.id === id) : null;
  const contractPayments = contract ? getPaymentsByContractId(payments, contract.id) : [];
  const property = contract ? properties.find((p) => p.id === contract.propertyId) : null;
  const tenant = contract ? tenants.find((t) => t.id === contract.tenantId) : null;

  const availableProperties = properties.filter((p) => p.status === 'available');

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ContractFormData>({
    defaultValues: {
      contractNo: '',
      propertyId: '',
      tenantId: '',
      templateType: 'residential' as ContractTemplateType,
      startDate: '',
      endDate: '',
      monthlyRent: 0,
      paymentMethod: '押一付三',
      deposit: 0,
      status: 'active' as ContractStatus,
      remarks: '',
    },
  });

  const selectedTemplateType = useWatch({
    control,
    name: 'templateType',
    defaultValue: 'residential' as ContractTemplateType,
  });

  useEffect(() => {
    const template = contractTemplates[selectedTemplateType];
    setCustomClauses([...template.clauses]);
  }, [selectedTemplateType]);

  useEffect(() => {
    if (contract && !editMode) {
      reset({
        contractNo: contract.contractNo,
        propertyId: contract.propertyId,
        tenantId: contract.tenantId,
        templateType: contract.templateType,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyRent: contract.monthlyRent,
        paymentMethod: contract.paymentMethod,
        deposit: contract.deposit,
        status: contract.status,
        remarks: contract.remarks || '',
      });
    }
  }, [contract, editMode, reset]);

  useEffect(() => {
    setIsEditing(isNew || editMode);
  }, [isNew, editMode]);

  const onSubmit = (data: ContractFormData) => {
    if (isNew) {
      addContract(data);
    } else if (contract) {
      updateContract(contract.id, data);
    }
    navigate('/contracts');
  };

  const handleClauseChange = (clauseId: string, newContent: string) => {
    setCustomClauses((prev) =>
      prev.map((c) => (c.id === clauseId ? { ...c, content: newContent } : c))
    );
  };

  const getProcessedContent = (content: string) => {
    const data = {
      address: property?.address || '【房屋地址】',
      area: property?.area?.toString() || '【面积】',
      layout: property?.layout || '【户型】',
      startDate: contract?.startDate || '【起租日期】',
      endDate: contract?.endDate || '【到期日期】',
      monthlyRent: contract?.monthlyRent?.toString() || '【月租金】',
      deposit: contract?.deposit?.toString() || '【保证金】',
      paymentMethod: contract?.paymentMethod || '【付款方式】',
    };

    return content
      .replace(/【房屋地址】/g, data.address)
      .replace(/【面积】/g, data.area)
      .replace(/【户型】/g, data.layout)
      .replace(/【起租日期】/g, data.startDate)
      .replace(/【到期日期】/g, data.endDate)
      .replace(/【月租金】/g, data.monthlyRent)
      .replace(/【保证金】/g, data.deposit)
      .replace(/【付款方式】/g, data.paymentMethod);
  };

  const templateOptions: { value: ContractTemplateType; label: string }[] = [
    { value: 'residential', label: '住宅租赁' },
    { value: 'commercial', label: '商铺租赁' },
    { value: 'office', label: '写字楼租赁' },
  ];

  const statusOptions: { value: ContractStatus; label: string }[] = [
    { value: 'active', label: '生效中' },
    { value: 'expired', label: '已到期' },
    { value: 'terminated', label: '已终止' },
  ];

  const paymentMethods = ['押一付一', '押一付三', '押二付一', '押二付六', '年付'];

  const currentTemplate = contractTemplates[selectedTemplateType];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/contracts"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-800">
            {isNew ? '新建合同' : '合同详情'}
          </h2>
          <p className="text-sm text-slate-500">
            {isNew ? '创建新的租赁合同' : '查看和编辑合同信息'}
          </p>
        </div>
        <button
          onClick={() => setShowTemplatePreview(!showTemplatePreview)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
        >
          {showTemplatePreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showTemplatePreview ? '隐藏预览' : '预览模板'}
        </button>
      </div>

      {!isNew && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">合同概览</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Building2 className="w-4 h-4" />
                <span className="text-sm font-medium">租赁房源</span>
              </div>
              <p className="text-slate-800 font-medium">{property?.address}</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">承租客户</span>
              </div>
              <p className="text-slate-800 font-medium">{tenant?.name}</p>
              <p className="text-slate-500 text-sm">{tenant?.phone}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">月租金</span>
              </div>
              <p className="text-slate-800 font-bold text-xl">{formatCurrency(contract?.monthlyRent || 0)}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            基本信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                合同编号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('contractNo', { required: '请输入合同编号' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                placeholder="如：HT202401001"
              />
              {errors.contractNo && (
                <p className="mt-1 text-sm text-red-500">{errors.contractNo.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                合同模板 <span className="text-red-500">*</span>
              </label>
              <select
                {...register('templateType', { required: '请选择合同模板' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              >
                {templateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {isNew && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    选择房源 <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('propertyId', { required: '请选择房源' })}
                    disabled={!isEditing}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                  >
                    <option value="">请选择待租房源</option>
                    {availableProperties.map((p) => (
                      <option key={p.id} value={p.id}>{p.propertyNo} - {p.address}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    选择租客 <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('tenantId', { required: '请选择租客' })}
                    disabled={!isEditing}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                  >
                    <option value="">请选择租客</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} - {t.phone}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                起租日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('startDate', { required: '请选择起租日期' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                到期日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('endDate', { required: '请选择到期日期' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                月租金 (元) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...register('monthlyRent', { required: '请输入月租金', min: 0 })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                履约保证金 (元) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...register('deposit', { required: '请输入履约保证金', min: 0 })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                付款方式 <span className="text-red-500">*</span>
              </label>
              <select
                {...register('paymentMethod', { required: '请选择付款方式' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              >
                {paymentMethods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                合同状态
              </label>
              <select
                {...register('status')}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                备注
              </label>
              <textarea
                {...register('remarks')}
                disabled={!isEditing}
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all resize-none"
                placeholder="其他合同条款说明"
              />
            </div>
          </div>
        </div>

        {showTemplatePreview && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                合同模板预览 - {currentTemplate.name}
              </h3>
              <span className="text-sm text-slate-500">
                {currentTemplate.description}
              </span>
            </div>

            <div className="space-y-4">
              {customClauses.map((clause, index) => (
                <div key={clause.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer"
                    onClick={() => setEditingClause(editingClause === clause.id ? null : clause.id)}
                  >
                    <div className="flex items-center gap-3">
                      {clause.required && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      <span className="font-medium text-slate-800">{clause.title}</span>
                    </div>
                    {isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingClause(editingClause === clause.id ? null : clause.id);
                        }}
                        className="flex items-center gap-1 text-sm text-blue-600"
                      >
                        <Edit className="w-4 h-4" />
                        编辑条款
                      </button>
                    )}
                  </div>
                  {editingClause === clause.id && isEditing ? (
                    <div className="p-4">
                      <textarea
                        value={clause.content}
                        onChange={(e) => handleClauseChange(clause.id, e.target.value)}
                        rows={5}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>
                  ) : (
                    <div className="p-4 bg-white">
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {getProcessedContent(clause.content)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-amber-50 rounded-xl">
              <h4 className="font-medium text-amber-800 mb-2">特殊约定条款</h4>
              <ul className="space-y-2">
                {currentTemplate.specialTerms.map((term, index) => (
                  <li key={index} className="flex items-start gap-2 text-amber-700">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!isNew && contractPayments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                缴费记录
              </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">缴费周期</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">应缴金额</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">应缴日期</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">滞纳金</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contractPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-700">{payment.period}</td>
                      <td className="py-3 px-4 text-slate-800 font-medium">{formatCurrency(payment.amount)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(payment.dueDate)}</td>
                      <td className="py-3 px-4 text-red-600">{payment.lateFee > 0 ? formatCurrency(payment.lateFee) : '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(payment.status)}`}>
                          {getPaymentStatusText(payment.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            to="/contracts"
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            取消
          </Link>
          {isEditing ? (
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              {isNew ? '创建合同' : '保存修改'}
            </button>
          ) : (
            <Link
              to={`/contracts/${id}?edit=true`}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              编辑
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
