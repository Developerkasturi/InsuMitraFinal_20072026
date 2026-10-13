import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@store/auth.store';

export const isProxyHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'swara.exportshub.in' || host === 'www.swara.exportshub.in';
};

export const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export function applyProxyIfNeeded(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (isProxyHost() && config.url && !config.url.startsWith('/api-proxy.php')) {
    const rawUrl = config.url.replace(/^https?:\/\/[^/]+\/api\/v1/, '').replace(/^\/api\/v1/, '');
    const [pathPart, queryPart] = rawUrl.split('?');
    const searchParams = new URLSearchParams(queryPart || '');
    const existingParams = config.params ?? {};
    const mergedParams: Record<string, any> = { __path: pathPart.startsWith('/') ? pathPart : `/${pathPart}` };
    searchParams.forEach((val, key) => {
      mergedParams[key] = val;
    });
    Object.assign(mergedParams, existingParams);

    config.baseURL = '';
    config.url = '/api-proxy.php';
    config.params = mergedParams;
  }
  return config;
}

export const api = axios.create({ baseURL: BASE_URL });

// ── Request: attach bearer token & proxy routing ──────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return applyProxyIfNeeded(config);
});

// ── Response: auto-refresh on 401 ────────────────────────────────────────────
let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

function flushQueue(token: string) {
  queue.forEach(resolve => resolve(token));
  queue = [];
}

api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _proxyRetry?: boolean };

    // Fallback to same-origin PHP proxy if a cross-origin request fails due to CORS / network error
    if (!error.response && original && !original._proxyRetry && typeof window !== 'undefined' && window.location.protocol.startsWith('http') && !window.location.hostname.includes('localhost')) {
      original._proxyRetry = true;
      const rawUrl = (original.url || '').replace(/^https?:\/\/[^/]+\/api\/v1/, '').replace(/^\/api\/v1/, '');
      const [pathPart, queryPart] = rawUrl.split('?');
      const searchParams = new URLSearchParams(queryPart || '');
      const mergedParams: Record<string, any> = { __path: pathPart.startsWith('/') ? pathPart : `/${pathPart}` };
      searchParams.forEach((val, key) => {
        mergedParams[key] = val;
      });
      Object.assign(mergedParams, original.params ?? {});
      original.baseURL = '';
      original.url = '/api-proxy.php';
      original.params = mergedParams;
      return api(original);
    }

    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise(resolve => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;
    const { refreshToken, setTokens, logout } = useAuthStore.getState();

    try {
      const refreshReq = isProxyHost()
        ? axios.post('/api-proxy.php', { refreshToken }, { params: { __path: '/auth/refresh' } })
        : axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const { data } = await refreshReq;
      const newAccess = data.data.accessToken;
      setTokens(newAccess, data.data.refreshToken ?? refreshToken!);
      flushQueue(newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch {
      logout();
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;

