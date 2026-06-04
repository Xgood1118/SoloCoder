import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useStore } from '../../store';
import { getContractsByTenantId, formatCurrency, formatDate, getContractStatusText, getContractStatusColor } from '../../utils';

interface TenantFormData {
  name: string;
  phone: string;
  idCard: string;
  emergencyContact: string;
  emergencyPhone: string;
  address: string;
}

export default function TenantForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tenants, contracts, addTenant, updateTenant } = useStore();
  const [isEditing, setIsEditing] = useState(false);

  const isNew = id === 'new';
  const editMode = searchParams.get('edit') === 'true';

  const tenant = !isNew ? tenants.find((t) => t.id === id) : null;
  const tenantContracts = tenant ? getContractsByTenantId(contracts, tenant.id) : [];

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TenantFormData>({
    defaultValues: {
      name: '',
      phone: '',
      idCard: '',
      emergencyContact: '',
      emergencyPhone: '',
      address: '',
    },
  });

  useEffect(() => {
    if (tenant && !editMode) {
      reset({
        name: tenant.name,
        phone: tenant.phone,
        idCard: tenant.idCard,
        emergencyContact: tenant.emergencyContact,
        emergencyPhone: tenant.emergencyPhone,
        address: tenant.address || '',
      });
    }
  }, [tenant, editMode, reset]);

  useEffect(() => {
    setIsEditing(isNew || editMode);
  }, [isNew, editMode]);

  const onSubmit = (data: TenantFormData) => {
    if (isNew) {
      addTenant(data);
    } else if (tenant) {
      updateTenant(tenant.id, data);
    }
    navigate('/tenants');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/tenants"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            {isNew ? '新增租客' : '租客详情'}
          </h2>
          <p className="text-sm text-slate-500">
            {isNew ? '录入新租客信息' : '查看和编辑租客信息'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">基本信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('name', { required: '请输入姓名' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                placeholder="请输入租客姓名"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                联系电话 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                {...register('phone', { required: '请输入联系电话' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                placeholder="请输入联系电话"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                身份证号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('idCard', { required: '请输入身份证号' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                placeholder="请输入身份证号"
              />
              {errors.idCard && (
                <p className="mt-1 text-sm text-red-500">{errors.idCard.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                紧急联系人 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('emergencyContact', { required: '请输入紧急联系人' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                placeholder="请输入紧急联系人姓名"
              />
              {errors.emergencyContact && (
                <p className="mt-1 text-sm text-red-500">{errors.emergencyContact.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                紧急联系电话 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                {...register('emergencyPhone', { required: '请输入紧急联系电话' })}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                placeholder="请输入紧急联系电话"
              />
              {errors.emergencyPhone && (
                <p className="mt-1 text-sm text-red-500">{errors.emergencyPhone.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                联系地址
              </label>
              <input
                type="text"
                {...register('address')}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                placeholder="请输入联系地址"
              />
            </div>
          </div>
        </div>

        {!isNew && tenantContracts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              历史合同
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">合同编号</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">月租金</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">期限</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantContracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-sm text-blue-600">{contract.contractNo}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{formatCurrency(contract.monthlyRent)}</td>
                      <td className="py-3 px-4 text-slate-600 text-sm">
                        {formatDate(contract.startDate)} ~ {formatDate(contract.endDate)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getContractStatusColor(contract.status)}`}>
                          {getContractStatusText(contract.status)}
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
            to="/tenants"
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
              {isNew ? '保存租客' : '保存修改'}
            </button>
          ) : (
            <Link
              to={`/tenants/${id}?edit=true`}
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
