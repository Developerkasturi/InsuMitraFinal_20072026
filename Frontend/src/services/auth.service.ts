import api from './api';
import { useAuthStore } from '@store/auth.store';
import { useLookupStore } from '@store/lookup.store';

export interface LoginPayload     { email: string; password: string }
export interface RegisterPayload  { tenantName: string; tenantSlug: string; email: string; password: string; firstName: string; lastName: string; phone?: string }
export interface ChangePassPayload { currentPassword: string; newPassword: string }

export const authService = {
  async login(payload: LoginPayload) {
    const { data } = await api.post('/auth/login', payload);
    const { accessToken, refreshToken, user } = data.data;
    useAuthStore.getState().setTokens(accessToken, refreshToken);
    useAuthStore.getState().setUser(user);
    // Load lookups right after login
    useLookupStore.getState().loadAll();
    return data.data;
  },

  async register(payload: RegisterPayload) {
    const { data } = await api.post('/auth/register', payload);
    return data.data;
  },

  async changePassword(payload: ChangePassPayload) {
    const { data } = await api.post('/auth/change-password', payload);
    return data;
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch {}
    useAuthStore.getState().logout();
    useLookupStore.getState().clearCache();
  },
};

