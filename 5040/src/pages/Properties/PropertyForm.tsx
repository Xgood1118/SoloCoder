import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useStore } from '../../store';
import type { Property, PropertyStatus } from '../../types';

interface PropertyFormData {
  propertyNo: string;
  address: string;
  area: number;
  layout: string;
  orientation: string;
  floor: number;
  totalFloors: number;
  decoration: string;
  facilities: string;
  status: PropertyStatus;
  remarks: string;
}

export default function PropertyForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { properties, addProperty, updateProperty } = useStore();
  const [isEditing, setIsEditing] = useState(false);

  const isNew = id === 'new';
  const editMode = searchParams.get('edit') === 'true';

  const property = !isNew ? properties.find((p) => p.id === id) : null;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PropertyFormData>({
    defaultValues: {
      propertyNo: '',
      address: '',
      area: 0,
      layout: '',
      orientation: '',
      floor: 1,
      totalFloors: 1,
      decoration: '',
      facilities: '',
      status: 'available' as PropertyStatus,
      remarks: '',
    },
  });

  useEffect(() => {
    if (property && !editMode) {
      reset({
        propertyNo: property.propertyNo,
        address: property.address,
        area: property.area,
        layout: property.layout,
        orientation: property.orientation,
        floor: property.floor,
        totalFloors: property.totalFloors,
        decoration: property.decoration,
        facilities: property.facilities.join(', '),
        status: property.status,
        remarks: property.remarks || '',
      });
    }
  }, [property, editMode, reset]);

  useEffect(() => {
    setIsEditing(isNew || editMode);
  }, [isNew, editMode]);

  const onSubmit = (data: PropertyFormData) => {
    const propertyData = {
      ...data,
      facilities: data.facilities.split(',').map((f) => f.trim()).filter(Boolean),
    };

    if (isNew) {
      addProperty(propertyData);
    } else if (property) {
      updateProperty(property.id, propertyData);
    }

    navigate('/properties');
  };

  const layoutOptions = ['一室一厅', '两室一厅', '两室两厅', '三室一厅', '三室两厅', '四室两厅', '其他'];
  const orientationOptions = ['朝南', '朝北', '朝东', '朝西', '南北通透', '东西通透'];
  const decorationOptions = ['毛坯', '简装', '精装修', '豪华装修'];
  const statusOptions: { value: PropertyStatus; label: string }[] = [
    { value: 'available', label: '待租' },
    { value: 'rented', label: '在租' },
    { value: 'sold', label: '已售' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/properties"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            {isNew ? '新增房源' : '房源详情'}
          </h2>
          <p className="text-sm text-slate-500">
            {isNew ? '录入新房源信息' : '查看和编辑房源信息'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              房源编号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('propertyNo', { required: '请输入房源编号' })}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              placeholder="如：FY2024001"
            />
            {errors.propertyNo && (
              <p className="mt-1 text-sm text-red-500">{errors.propertyNo.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              房源状态
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
              房源地址 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('address', { required: '请输入房源地址' })}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              placeholder="请输入详细地址"
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              面积 (㎡) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              {...register('area', { required: '请输入面积', min: 1 })}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
            />
            {errors.area && (
              <p className="mt-1 text-sm text-red-500">{errors.area.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              户型 <span className="text-red-500">*</span>
            </label>
            <select
              {...register('layout', { required: '请选择户型' })}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
            >
              <option value="">请选择户型</option>
              {layoutOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {errors.layout && (
              <p className="mt-1 text-sm text-red-500">{errors.layout.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              朝向
            </label>
            <select
              {...register('orientation')}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
            >
              <option value="">请选择朝向</option>
              {orientationOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              装修情况
            </label>
            <select
              {...register('decoration')}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
            >
              <option value="">请选择装修情况</option>
              {decorationOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              所在楼层
            </label>
            <input
              type="number"
              {...register('floor', { min: 1 })}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              总楼层
            </label>
            <input
              type="number"
              {...register('totalFloors', { min: 1 })}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              配套设施
            </label>
            <input
              type="text"
              {...register('facilities')}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              placeholder="多个设施用逗号分隔，如：空调, 洗衣机, 冰箱"
            />
            <p className="mt-1 text-xs text-slate-400">多个设施用逗号分隔</p>
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
              placeholder="其他需要记录的信息"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
          <Link
            to="/properties"
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
              {isNew ? '保存房源' : '保存修改'}
            </button>
          ) : (
            <Link
              to={`/properties/${id}?edit=true`}
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
