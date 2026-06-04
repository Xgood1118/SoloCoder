import { create } from 'zustand';
import type { Property, Tenant, Contract, Payment, Handover, Stats } from '../types';
import { mockProperties, mockTenants, mockContracts, mockPayments, mockHandovers } from '../data/mockData';
import { generateId, isContractExpiringSoon } from '../utils';

interface AppState {
  properties: Property[];
  tenants: Tenant[];
  contracts: Contract[];
  payments: Payment[];
  handovers: Handover[];

  addProperty: (property: Omit<Property, 'id' | 'createdAt'>) => void;
  updateProperty: (id: string, property: Partial<Property>) => void;
  deleteProperty: (id: string) => void;

  addTenant: (tenant: Omit<Tenant, 'id' | 'createdAt'>) => void;
  updateTenant: (id: string, tenant: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;

  addContract: (contract: Omit<Contract, 'id' | 'createdAt'>) => void;
  updateContract: (id: string, contract: Partial<Contract>) => void;

  addPayment: (payment: Omit<Payment, 'id'>) => void;
  updatePayment: (id: string, payment: Partial<Payment>) => void;

  addHandover: (handover: Omit<Handover, 'id'>) => void;

  getStats: () => Stats;
}

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const useStore = create<AppState>((set, get) => ({
  properties: loadFromStorage('properties', mockProperties),
  tenants: loadFromStorage('tenants', mockTenants),
  contracts: loadFromStorage('contracts', mockContracts),
  payments: loadFromStorage('payments', mockPayments),
  handovers: loadFromStorage('handovers', mockHandovers),

  addProperty: (property) => {
    const newProperty: Property = {
      ...property,
      id: generateId(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    set((state) => {
      const properties = [...state.properties, newProperty];
      saveToStorage('properties', properties);
      return { properties };
    });
  },

  updateProperty: (id, property) => {
    set((state) => {
      const properties = state.properties.map((p) =>
        p.id === id ? { ...p, ...property } : p
      );
      saveToStorage('properties', properties);
      return { properties };
    });
  },

  deleteProperty: (id) => {
    set((state) => {
      const properties = state.properties.filter((p) => p.id !== id);
      saveToStorage('properties', properties);
      return { properties };
    });
  },

  addTenant: (tenant) => {
    const newTenant: Tenant = {
      ...tenant,
      id: generateId(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    set((state) => {
      const tenants = [...state.tenants, newTenant];
      saveToStorage('tenants', tenants);
      return { tenants };
    });
  },

  updateTenant: (id, tenant) => {
    set((state) => {
      const tenants = state.tenants.map((t) =>
        t.id === id ? { ...t, ...tenant } : t
      );
      saveToStorage('tenants', tenants);
      return { tenants };
    });
  },

  deleteTenant: (id) => {
    set((state) => {
      const tenants = state.tenants.filter((t) => t.id !== id);
      saveToStorage('tenants', tenants);
      return { tenants };
    });
  },

  addContract: (contract) => {
    const newContract: Contract = {
      ...contract,
      id: generateId(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    set((state) => {
      const contracts = [...state.contracts, newContract];
      saveToStorage('contracts', contracts);
      return { contracts };
    });
  },

  updateContract: (id, contract) => {
    set((state) => {
      const contracts = state.contracts.map((c) =>
        c.id === id ? { ...c, ...contract } : c
      );
      saveToStorage('contracts', contracts);
      return { contracts };
    });
  },

  addPayment: (payment) => {
    const newPayment: Payment = {
      ...payment,
      id: generateId(),
    };
    set((state) => {
      const payments = [...state.payments, newPayment];
      saveToStorage('payments', payments);
      return { payments };
    });
  },

  updatePayment: (id, payment) => {
    set((state) => {
      const payments = state.payments.map((p) =>
        p.id === id ? { ...p, ...payment } : p
      );
      saveToStorage('payments', payments);
      return { payments };
    });
  },

  addHandover: (handover) => {
    const newHandover: Handover = {
      ...handover,
      id: generateId(),
    };
    set((state) => {
      const handovers = [...state.handovers, newHandover];
      saveToStorage('handovers', handovers);
      return { handovers };
    });
  },

  getStats: () => {
    const state = get();
    const totalProperties = state.properties.length;
    const rentedProperties = state.properties.filter((p) => p.status === 'rented').length;
    const availableProperties = state.properties.filter((p) => p.status === 'available').length;
    const soldProperties = state.properties.filter((p) => p.status === 'sold').length;
    const totalTenants = state.tenants.length;
    const activeContracts = state.contracts.filter((c) => c.status === 'active').length;
    const expiringContracts = state.contracts.filter(
      (c) => c.status === 'active' && isContractExpiringSoon(c.endDate, 30)
    ).length;
    const monthlyRent = state.contracts
      .filter((c) => c.status === 'active')
      .reduce((sum, c) => sum + c.monthlyRent, 0);
    const overduePayments = state.payments.filter((p) => p.status === 'overdue').length;

    return {
      totalProperties,
      rentedProperties,
      availableProperties,
      soldProperties,
      totalTenants,
      activeContracts,
      expiringContracts,
      monthlyRent,
      overduePayments,
    };
  },
}));
