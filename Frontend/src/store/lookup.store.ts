import { create } from 'zustand';
import {
  insuranceService,
  policiesService,
  employeesService,
  whatsappService,
  tenantService,
} from '../services/index';

interface LookupState {
  companies: any[];
  plans: any[];
  employees: any[];
  templates: any[];
  tenantDetails: any | null;
  loading: boolean;
  error: string | null;

  loadCompanies: (force?: boolean) => Promise<void>;
  loadPlans: (force?: boolean) => Promise<void>;
  loadEmployees: (force?: boolean) => Promise<void>;
  loadTemplates: (force?: boolean) => Promise<void>;
  loadTenantDetails: (force?: boolean) => Promise<void>;
  loadAll: (force?: boolean) => Promise<void>;
  clearCache: () => void;
}

export const useLookupStore = create<LookupState>((set, get) => ({
  companies: [],
  plans: [],
  employees: [],
  templates: [],
  tenantDetails: null,
  loading: false,
  error: null,

  loadCompanies: async (force = false) => {
    if (get().companies.length > 0 && !force) return;
    try {
      const res = await insuranceService.listCompanies();
      set({ companies: res.data ?? [] });
    } catch (err: any) {
      console.error('Failed to load insurance companies lookup', err);
    }
  },

  loadPlans: async (force = false) => {
    if (get().plans.length > 0 && !force) return;
    try {
      const res = await policiesService.plans();
      set({ plans: res.data ?? [] });
    } catch (err: any) {
      console.error('Failed to load insurance plans lookup', err);
    }
  },

  loadEmployees: async (force = false) => {
    if (get().employees.length > 0 && !force) return;
    try {
      const res = await employeesService.list({ limit: 100 });
      set({ employees: res.data ?? [] });
    } catch (err: any) {
      console.error('Failed to load employees lookup', err);
    }
  },

  loadTemplates: async (force = false) => {
    if (get().templates.length > 0 && !force) return;
    try {
      const { useAuthStore } = await import('./auth.store');
      const user = useAuthStore.getState().user;
      if (user && user.role !== 'SUPERADMIN') {
        const { subscriptionsService } = await import('../services/index');
        const subRes = await subscriptionsService.current();
        const planName = subRes?.data?.plan?.name || 'Free';
        if (planName !== 'Enterprise' && planName !== 'Business') {
          return;
        }
      }
      const res = await whatsappService.templates();
      set({ templates: res.data ?? [] });
    } catch (err: any) {
      console.error('Failed to load whatsapp templates lookup', err);
    }
  },

  loadTenantDetails: async (force = false) => {
    if (get().tenantDetails && !force) return;
    try {
      const res = await tenantService.getCurrent();
      set({ tenantDetails: res.data ?? null });
    } catch (err: any) {
      console.error('Failed to load tenant details lookup', err);
    }
  },

  loadAll: async (force = false) => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().loadCompanies(force),
        get().loadPlans(force),
        get().loadEmployees(force),
        get().loadTemplates(force),
        get().loadTenantDetails(force),
      ]);
      set({ loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to load lookups' });
    }
  },

  clearCache: () => {
    set({
      companies: [],
      plans: [],
      employees: [],
      templates: [],
      tenantDetails: null,
      loading: false,
      error: null,
    });
  },
}));
