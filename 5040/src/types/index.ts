export type PropertyStatus = 'available' | 'rented' | 'sold';
export type ContractStatus = 'active' | 'expired' | 'terminated';
export type PaymentStatus = 'pending' | 'paid' | 'overdue';
export type ContractTemplateType = 'residential' | 'commercial' | 'office';
export type HandoverType = 'checkin' | 'checkout';

export interface ContractClause {
  id: string;
  title: string;
  content: string;
  required: boolean;
}

export interface Property {
  id: string;
  propertyNo: string;
  address: string;
  area: number;
  layout: string;
  orientation: string;
  floor: number;
  totalFloors: number;
  decoration: string;
  facilities: string[];
  status: PropertyStatus;
  remarks?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  idCard: string;
  emergencyContact: string;
  emergencyPhone: string;
  address?: string;
  createdAt: string;
}

export interface Contract {
  id: string;
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
  remarks?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  contractId: string;
  period: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  lateFee: number;
  status: PaymentStatus;
}

export interface Handover {
  id: string;
  contractId: string;
  type: HandoverType;
  date: string;
  checklist: HandoverItem[];
  remarks?: string;
}

export interface HandoverItem {
  name: string;
  status: 'good' | 'normal' | 'damaged';
  remarks?: string;
}

export interface Stats {
  totalProperties: number;
  rentedProperties: number;
  availableProperties: number;
  soldProperties: number;
  totalTenants: number;
  activeContracts: number;
  expiringContracts: number;
  monthlyRent: number;
  overduePayments: number;
}
