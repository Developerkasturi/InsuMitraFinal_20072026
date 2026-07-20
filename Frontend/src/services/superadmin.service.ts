import axios from 'axios';
import { useSuperAdminStore } from '@store/superadmin.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const superApi = axios.create({ baseURL: BASE_URL });

superApi.interceptors.request.use((config) => {
  const token = useSuperAdminStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

superApi.interceptors.response.use(
  (res) => res,
  (error) => {
    // TEMP DEBUG
    console.log('[superApi 401-interceptor] fired', {
      status:  error.response?.status,
      url:     error.config?.url,
      tokenInStore: useSuperAdminStore.getState().accessToken?.slice(0, 20) ?? null,
    });
    if (error.response?.status === 401) {
      console.log('[superApi 401-interceptor] calling logout() + redirect');
      useSuperAdminStore.getState().logout();
      window.location.href = '/superadmin/login';
    }
    return Promise.reject(error);
  },
);

export const superAdminService = {
  async login(email: string, password: string) {
    const { data } = await superApi.post('/superadmin/auth/login', { email, password });
    const { accessToken, admin } = data.data;
    // TEMP DEBUG
    console.log('[login] raw data.data:', data.data);
    console.log('[login] accessToken extracted:', accessToken?.slice(0, 20) ?? null);
    console.log('[login] admin extracted:', admin);
    useSuperAdminStore.getState().setAuth(accessToken, admin);
    // TEMP DEBUG — verify store updated immediately after setAuth
    const storedToken = useSuperAdminStore.getState().accessToken;
    console.log('[login] store.accessToken immediately after setAuth():', storedToken?.slice(0, 20) ?? null);
    return data.data;
  },

  async getMe() {
    const { data } = await superApi.get('/superadmin/auth/me');
    return data.data;
  },

  async getPlatformStats() {
    const { data } = await superApi.get('/superadmin/auth/platform-stats');
    return data.data as {
      totalTenants:   number;
      activeTenants:  number;
      totalUsers:     number;
      totalPolicies:  number;
      totalContacts:  number;
    };
  },

  async listTenants(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await superApi.get('/superadmin/auth/tenants', { params });
    return data as { data: any[]; meta: { total: number; page: number; limit: number; totalPages: number } };
  },

  async createTenant(body: {
    tenantName: string; tenantSlug: string;
    email: string; password: string;
    firstName: string; lastName: string; phone?: string;
  }) {
    const { data } = await superApi.post('/superadmin/auth/tenants', body);
    return data;
  },

  async setTenantStatus(tenantId: string, isActive: boolean) {
    const { data } = await superApi.patch(`/superadmin/auth/tenants/${tenantId}/status`, { isActive });
    return data;
  },

  async updateTenant(tenantId: string, body: { name?: string; email?: string; phone?: string }) {
    const { data } = await superApi.patch(`/superadmin/auth/tenants/${tenantId}`, body);
    return data;
  },

  async deleteTenant(tenantId: string) {
    const { data } = await superApi.delete(`/superadmin/auth/tenants/${tenantId}`);
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await superApi.post('/superadmin/auth/change-password', { currentPassword, newPassword });
    return data;
  },

  async getAllFeedback(params?: { page?: number; limit?: number }) {
    const { data } = await superApi.get('/superadmin/auth/feedback', { params });
    return data as { data: any[]; meta: { total: number } };
  },

  async getDeletionRequests() {
    const { data } = await superApi.get('/deletion-requests');
    return data as { data: any[] };
  },

  async resolveDeletionRequest(id: string, action: 'APPROVED' | 'REJECTED') {
    const { data } = await superApi.put(`/deletion-requests/${id}/resolve`, { action });
    return data;
  },

  logout() {
    // TEMP DEBUG
    console.log('[superAdminService.logout()] called — stack:', new Error().stack);
    useSuperAdminStore.getState().logout();
  },
};
