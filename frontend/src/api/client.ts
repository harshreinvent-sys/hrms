import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
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

const BASE_URL = resolveBaseUrl();

// ---------------------------------------------------------------------------
// Cold-start tolerance — every route
//
// Free-tier hosting (Render) spins the API down after idle minutes; the first
// request afterwards hangs for 30–60 s while it boots, or gets a 502/503 from
// the platform's edge. Those are retried with a pause, for every method.
// Everything else — 4xx, and any 5xx that carries our own { error: { code } }
// body (the API is up, it just failed) — is returned at once.
//
// Why retrying writes is acceptable for THIS API (D-019): a platform 502/503
// means the request never reached the app, so any method is safe; on a
// timeout, PUT reapplies the same data, DELETE is a soft delete (204 twice),
// logout is stateless, and a repeated POST /employees is rejected by the
// unique email (409) rather than creating a second record.
// ---------------------------------------------------------------------------

/** Total attempts, including the first. */
export const MAX_ATTEMPTS = 3;
/** Pause before attempt 2 and attempt 3. */
const RETRY_DELAYS_MS = [4_000, 10_000];
/** Per-attempt timeout; a cold boot usually finishes inside this. */
const ATTEMPT_TIMEOUT_MS = 40_000;

/** Fired on window before each retry: `detail = { attempt, max, delayMs }`. */
export const SERVER_WAKING_EVENT = 'hrms:waking';
/** Fired once a retried request settles (success or final failure). */
export const SERVER_AWAKE_EVENT = 'hrms:awake';

type RetryConfig = AxiosRequestConfig & { __attempt?: number };

function isColdStartFailure(error: AxiosError): boolean {
  if (!error.response) return true; // network error or timeout
  const { status, data } = error.response;
  const apiShaped = typeof data === 'object' && data !== null && 'error' in data;
  return [502, 503, 504].includes(status) && !apiShaped;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: ATTEMPT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token from the store on every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const settled = () => window.dispatchEvent(new Event(SERVER_AWAKE_EVENT));

api.interceptors.response.use(
  (response) => {
    if ((response.config as RetryConfig).__attempt) settled();
    return response;
  },
  async (error: AxiosError) => {
    const config = (error.config ?? {}) as RetryConfig;

    // A 401 from any route means the session is over: clear it and let the
    // auth layer redirect. The login route's own 401 (bad credentials) is
    // excluded so the form can show the message instead of bouncing.
    const isLoginCall = /\/auth\/login$/.test(config.url ?? '');
    if (error.response?.status === 401 && !isLoginCall) {
      clearToken();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      return Promise.reject(error);
    }

    const attempt = config.__attempt ?? 1;
    if (attempt < MAX_ATTEMPTS && isColdStartFailure(error)) {
      const delayMs = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
      window.dispatchEvent(
        new CustomEvent(SERVER_WAKING_EVENT, { detail: { attempt: attempt + 1, max: MAX_ATTEMPTS, delayMs } }),
      );
      await sleep(delayMs);
      return api.request({ ...config, __attempt: attempt + 1 } as RetryConfig);
    }

    if (config.__attempt) settled();
    return Promise.reject(error);
  },
);

/**
 * Nudge a sleeping server the moment the app loads, so it is booting while the
 * user is still reading the login page. Fire-and-forget; failures are expected
 * and ignored. `/health` sits at the domain root, outside /api.
 */
export function warmUp(): void {
  const healthUrl = BASE_URL.replace(/\/api$/i, '') + '/health';
  void axios.get(healthUrl, { timeout: ATTEMPT_TIMEOUT_MS }).catch(() => undefined);
}

/** Normalises anything thrown by an API call into the backend's error shape. */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: ApiError } | undefined;
    if (body?.error?.message) return body.error;
    if (error.code === 'ECONNABORTED') {
      return { code: 'TIMEOUT', message: `The server did not respond after ${MAX_ATTEMPTS} attempts. It may still be starting — try again in a minute.` };
    }
    if (!error.response) return { code: 'NETWORK', message: 'Cannot reach the API. Is the backend running?' };
    if ([502, 503, 504].includes(error.response.status)) {
      return { code: 'UNAVAILABLE', message: `The server is unavailable after ${MAX_ATTEMPTS} attempts. Try again in a minute.` };
    }
    return { code: 'HTTP_' + error.response.status, message: error.message };
  }
  return { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Something went wrong.' };
}
