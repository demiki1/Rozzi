const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Admin access tokens are intentionally memory-only. The refresh token is kept
// in an HttpOnly cookie by the API, so JavaScript cannot read or persist it.
let accessToken: string | null = null;

export function getAccessToken() { return accessToken; }
export function setAccessToken(token: string | null) { accessToken = token; }
export function clearTokens() { accessToken = null; }

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

async function rawRequest(path: string, options: RequestInit = {}, token: string | null) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await rawRequest('/api/auth/refresh', { method: 'POST' }, null);
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  const token = body?.accessToken;
  if (!token) return null;
  accessToken = token;
  return token;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, options, accessToken);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await rawRequest(path, options, refreshed);
    else {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new ApiError('SESSION_EXPIRED', 'Your session has expired. Please log in again.', 401);
    }
  }
  const body = await res.json().catch(() => null);
if (!res.ok || body?.success === false) {
  const err = body?.error;

  let message =
    typeof err?.message === 'string'
      ? err.message
      : res.statusText || 'Something went wrong.';

  const normalized = message.toLowerCase();

  if (
    res.status === 401 ||
    normalized.includes('invalid credentials') ||
    normalized.includes('incorrect email or password') ||
    normalized.includes('unauthorized')
  ) {
    message = 'Incorrect email or password.';
  } else if (normalized.includes('verification')) {
    message = 'Please verify your account before signing in.';
  } else if (normalized.includes('inactive')) {
    message =
      'This account is currently inactive. Please contact ROZZI support.';
  }

  throw new ApiError(
    err?.code || 'UNKNOWN_ERROR',
    message,
    res.status,
  );
}
  return body as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, data?: unknown, headers?: HeadersInit) => apiRequest<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined, headers }),
  patch: <T>(path: string, data?: unknown) => apiRequest<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
