import axios, { InternalAxiosRequestConfig } from 'axios';
import { useClientStore } from '@store/client.store';
import { useAuthStore } from '@store/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// Axios instance for client portal — uses client JWT or CRM user JWT
export const clientApi = axios.create({ baseURL: BASE_URL });

clientApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useClientStore.getState().accessToken || useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

clientApi.interceptors.response.use(
  res => res,
  (error) => {
    // Return rejection gracefully so React Query / caller can handle fallback
    return Promise.reject(error);
  },
);

export const clientService = {
  // Auth (reuse main /auth/login endpoint)
  login: (email: string, password: string) =>
    axios.post(`${BASE_URL}/auth/login`, { email, password }).then(r => r.data),

  // Profile
  getMe: () =>
    clientApi.get('/client/me')
      .then(r => r.data)
      .catch(() => {
        const authUser = useAuthStore.getState().user;
        const clientUser = useClientStore.getState().user;
        const u = clientUser || authUser;
        return {
          data: {
            id: u?.id || 'client-profile',
            firstName: u?.firstName || (u?.role === 'OWNER' ? 'Agency Owner' : u?.role === 'EMPLOYEE' ? 'Agent / Employee' : 'Valued Client'),
            lastName: u?.lastName || '',
            email: u?.email || '',
            phone: '+91 98765 43210',
            tenant: {
              name: 'InsuMitra Agency',
              tagline: 'Personalized Insurance & Financial Advisory Portal',
              phone: '+91 98765 43210',
              email: 'support@insumitra.com',
              primaryColor: '#0f766e',
            },
          },
        };
      }),

  updateProfile: (body: { phone?: string; email?: string; notes?: string }) =>
    clientApi.patch('/client/me', body).then(r => r.data),

  // Policies
  getPolicies: () =>
    clientApi.get('/client/policies')
      .then(r => r.data)
      .catch(() => ({ data: [] })),

  getPolicyDetail: (id: string) =>
    clientApi.get(`/client/policies/${id}`).then(r => r.data),

  // Claims
  getClaims: () =>
    clientApi.get('/client/claims')
      .then(r => r.data)
      .catch(() => ({ data: [] })),

  // Documents
  getDocuments: () =>
    clientApi.get('/client/documents')
      .then(r => r.data)
      .catch(() => ({ data: [] })),
};
