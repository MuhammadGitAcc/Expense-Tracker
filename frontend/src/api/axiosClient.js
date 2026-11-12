import axios from 'axios';
import { store } from '@/app/store';
import { queryClient } from '@/app/queryClient';
import { clearCredentials, expireSession, setCredentials } from '@/features/auth/authSlice';

// In development leave VITE_API_URL empty: the Vite proxy forwards /api to the backend, so the
// refresh cookie stays same-origin. In production set it to the full API URL.
const rawBase = import.meta.env.VITE_API_URL || '/api/v1';
export const API_BASE_URL = rawBase.replace(/\/+$/, '');

const isAbsolute = (value) => /^https?:\/\//i.test(value);

/** "/uploads/avatars/x.png" (from the API) to a URL the browser can load. Receipts are NOT here: they are private. */
export function assetUrl(path) {
  if (!path) return null;
  if (isAbsolute(path)) return path;
  const origin = isAbsolute(API_BASE_URL) ? new URL(API_BASE_URL).origin : '';
  return `${origin}${path}`;
}

/**
 * Every API function uses this client and returns response.data, the whole body
 * { success, message, data, meta }, so meta (pagination, totals) is never lost.
 */
export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30 * 1000,
  withCredentials: true, // sends the httpOnly refresh cookie
  headers: { Accept: 'application/json' },
});

// ---- Request: attach the access token ------------------------------------------------------

axiosClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Token refresh (one at a time) ---------------------------------------------------------

let refreshPromise = null;

/**
 * Asks the server for a new access token with the refresh cookie and stores the result.
 * Many callers at once share ONE request (refresh tokens are single use).
 * Used by the interceptor below and by the start-up check in Phase 8.
 * Resolves with the new access token; rejects when the server refuses.
 */
export function refreshSession() {
  if (!refreshPromise) {
    // A plain axios call: the interceptors of axiosClient must not run for the refresh itself.
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, null, { withCredentials: true, timeout: 15 * 1000 })
      .then((response) => {
        const { user, accessToken } = response.data.data;
        store.dispatch(setCredentials({ user, accessToken }));
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function endSession() {
  const hadSession = Boolean(store.getState().auth.accessToken);
  store.dispatch(hadSession ? expireSession() : clearCredentials());
  queryClient.clear(); // nothing of the old user may stay in memory
}

// Login, register, verify, refresh, logout, forgot and reset answer 401 for reasons that a
// refresh cannot fix (wrong password, wrong code), so they are never retried.
const isAuthRequest = (url) => /\/auth\//.test(url ?? '');

// A download that fails answers with a Blob. Turn a JSON error back into an object,
// so error.response.data.message works for exports and receipts as well.
async function readBlobError(error) {
  const data = error.response?.data;
  if (!(data instanceof Blob) || !data.type.includes('json')) return;
  try {
    error.response.data = JSON.parse(await data.text());
  } catch {
    // not JSON: keep the Blob
  }
}

// ---- Response: refresh once on 401, then retry ---------------------------------------------

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    await readBlobError(error);

    const original = error.config;
    const status = error.response?.status;

    const canRefresh =
      status === 401 &&
      original &&
      !original._retry &&
      original.headers?.Authorization && // a request sent without a login cannot be repaired
      !isAuthRequest(original.url);

    if (!canRefresh) return Promise.reject(error);

    original._retry = true;

    try {
      const token = await refreshSession();
      original.headers.Authorization = `Bearer ${token}`;
      return axiosClient(original);
    } catch (refreshError) {
      // Log out only when the server REFUSED the refresh. No network or a 5xx keeps the session.
      const refused = refreshError.response && refreshError.response.status < 500;
      if (refused) endSession();
      return Promise.reject(error);
    }
  },
);

// ---- Helpers for error handling ------------------------------------------------------------

export const getErrorStatus = (error) => error?.response?.status ?? null;

/** The "code" field of an error answer, for example EMAIL_NOT_VERIFIED. */
export const getErrorCode = (error) => error?.response?.data?.code ?? null;

/** No answer from the server at all (offline, server down, time-out). */
export const isNetworkError = (error) => Boolean(error) && !error.response;

/**
 * The message the server sent, or `fallback` (pass a translated text: t('errors.generic')).
 * Server messages are in English: the backend does not translate them.
 */
export function getErrorMessage(error, fallback = '') {
  const message = error?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
}

export default axiosClient;
