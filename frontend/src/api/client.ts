import axios, { AxiosError } from 'axios';
import type { ApiError } from '../types/api';
import { clearToken, getToken, SESSION_EXPIRED_EVENT } from '../auth/token';

/**
 * The API mounts every route under /api, so the base URL must end with it.
 * A missing suffix is the most common deploy mistake and produces a confusing
 * CORS-looking failure on a 404, so it is called out in the console instead.
 */
function resolveBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:4000/api';
  const base = raw.replace(/\/+$/, '');
  if (!/\/api$/i.test(base)) {
    console.warn(
      `[hrms] VITE_API_URL is "${raw}" — it should end with /api (e.g. https://your-backend.onrender.com/api). Requests will go to ${base}/auth/login, which the API does not serve.`,
    );
  }
  return base;
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token from the store on every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 from any route means the session is over: clear it and let the auth
// layer redirect. The login route's own 401 (bad credentials) is excluded so
// the form can show the message instead of bouncing.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isLoginCall = error.config?.url?.endsWith('/auth/login');
    if (error.response?.status === 401 && !isLoginCall) {
      clearToken();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

/** Normalises anything thrown by an API call into the backend's error shape. */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: ApiError } | undefined;
    if (body?.error?.message) return body.error;
    if (error.code === 'ECONNABORTED') return { code: 'TIMEOUT', message: 'The server took too long to respond.' };
    if (!error.response) return { code: 'NETWORK', message: 'Cannot reach the API. Is the backend running?' };
    return { code: 'HTTP_' + error.response.status, message: error.message };
  }
  return { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Something went wrong.' };
}
