import { format, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';
import type { Property, Tenant, Contract, Payment } from '../types';

export const formatDate = (date: string, pattern = 'yyyy-MM-dd'): string => {
  return format(new Date(date), pattern);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const getPropertyStatusText = (status: Property['status']): string => {
  const map = {
    available: '待租',
    rented: '在租',
    sold: '已售',
  };
  return map[status];
};

export const getPropertyStatusColor = (status: Property['status']): string => {
  const map = {
    available: 'bg-amber-100 text-amber-800',
    rented: 'bg-emerald-100 text-emerald-800',
    sold: 'bg-slate-100 text-slate-800',
  };
  return map[status];
};

export const getContractStatusText = (status: Contract['status']): string => {
  const map = {
    active: '生效中',
    expired: '已到期',
    terminated: '已终止',
  };
  return map[status];
};

export const getContractStatusColor = (status: Contract['status']): string => {
  const map = {
    active: 'bg-emerald-100 text-emerald-800',
    expired: 'bg-slate-100 text-slate-800',
    terminated: 'bg-red-100 text-red-800',
  };
  return map[status];
};

export const getPaymentStatusText = (status: Payment['status']): string => {
  const map = {
    pending: '待缴',
    paid: '已缴',
    overdue: '逾期',
  };
  return map[status];
};

export const getPaymentStatusColor = (status: Payment['status']): string => {
  const map = {
    pending: 'bg-blue-100 text-blue-800',
    paid: 'bg-emerald-100 text-emerald-800',
    overdue: 'bg-red-100 text-red-800',
  };
  return map[status];
};

export const getContractTemplateText = (type: Contract['templateType']): string => {
  const map = {
    residential: '住宅租赁',
    commercial: '商铺租赁',
    office: '写字楼租赁',
  };
  return map[type];
};

export const calculateDaysUntilExpiry = (endDate: string): number => {
  return differenceInDays(new Date(endDate), new Date());
};

export const isContractExpiringSoon = (endDate: string, days = 30): boolean => {
  const daysUntil = calculateDaysUntilExpiry(endDate);
  return daysUntil >= 0 && daysUntil <= days;
};

export const calculateLateFee = (
  dueDate: string,
  amount: number,
  dailyRate = 0.005
): number => {
  const today = new Date();
  const due = new Date(dueDate);
  if (isBefore(today, due)) return 0;
  const daysLate = differenceInDays(today, due);
  return Math.round(amount * dailyRate * daysLate);
};

export const getPropertyById = (properties: Property[], id: string): Property | undefined => {
  return properties.find(p => p.id === id);
};

export const getTenantById = (tenants: Tenant[], id: string): Tenant | undefined => {
  return tenants.find(t => t.id === id);
};

export const getContractsByPropertyId = (contracts: Contract[], propertyId: string): Contract[] => {
  return contracts.filter(c => c.propertyId === propertyId);
};

export const getContractsByTenantId = (contracts: Contract[], tenantId: string): Contract[] => {
  return contracts.filter(c => c.tenantId === tenantId);
};

export const getPaymentsByContractId = (payments: Payment[], contractId: string): Payment[] => {
  return payments.filter(p => p.contractId === contractId);
};

export const maskPhone = (phone: string): string => {
  if (phone.length !== 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

export const maskIdCard = (idCard: string): string => {
  if (idCard.length !== 18) return idCard;
  return idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
};
