const BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ACCESS_TOKEN_KEY = 'rozzi_token';
const REFRESH_TOKEN_KEY = 'rozzi_refresh';

let refreshPromise: Promise<boolean> | null = null;

export function token(): string | null {
  if (typeof window === 'undefined') return null;

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setSession(data: any) {
  if (typeof window === 'undefined') return;

  if (data?.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  }

  /*
   * Important:
   * Do not overwrite an existing refresh token with an empty value.
   *
   * This also keeps the client compatible with the backend's
   * HttpOnly-cookie refresh mode.
   */
  if (data?.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  }
}

export function logout() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Read the JWT expiry without requiring a JWT library.
 */
function getTokenExpiry(tokenValue: string | null): number | null {
  if (!tokenValue) return null;

  try {
    const parts = tokenValue.split('.');

    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
    );

    if (typeof payload.exp !== 'number') return null;

    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * Determine whether the access token is close to expiry.
 *
 * We refresh 60 seconds before expiry.
 */
function shouldRefreshAccessToken(): boolean {
  const currentToken = token();

  if (!currentToken) return false;

  const expiry = getTokenExpiry(currentToken);

  if (!expiry) return false;

  return expiry - Date.now() <= 60_000;
}

/**
 * Refresh the Customer access token.
 *
 * Only one refresh request is allowed at a time.
 * Other API calls wait for the same refresh operation.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken =
    localStorage.getItem(REFRESH_TOKEN_KEY);

  /*
   * If there is no local refresh token, try cookie-based
   * refresh. The backend supports both body and cookie refresh.
   */
  refreshPromise = (async () => {
    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      const body = refreshToken
        ? JSON.stringify({ refreshToken })
        : undefined;

      const response = await fetch(
        `${BASE}/api/auth/refresh`,
        {
          method: 'POST',
          headers,
          body,
          credentials: 'include',
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        /*
         * Do not immediately destroy the session for a temporary
         * network/server failure.
         *
         * A 401/403 from the refresh endpoint means the refresh
         * session itself is no longer valid.
         */
        if (
          response.status === 401 ||
          response.status === 403
        ) {
          logout();
        }

        return false;
      }

      const data = await response.json();

      if (!data?.accessToken) {
        return false;
      }

      /*
       * Save the new access token.
       */
      localStorage.setItem(
        ACCESS_TOKEN_KEY,
        data.accessToken,
      );

      /*
       * Refresh-token rotation:
       * If the backend sends a new refresh token, replace
       * the old one.
       *
       * If it doesn't send one, preserve the existing token.
       */
      if (data.refreshToken) {
        localStorage.setItem(
          REFRESH_TOKEN_KEY,
          data.refreshToken,
        );
      }

      return true;
    } catch {
      /*
       * Network error:
       * Don't automatically log the customer out.
       *
       * The next API request can try the refresh again.
       */
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function formatErrorMessage(
  data: any,
  status: number,
): string {
  if (status === 401) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.error === 'string'
          ? data.error
          : '';

    const normalized = message.toLowerCase();

    if (
      normalized.includes(
        'incorrect email or password',
      ) ||
      normalized.includes('invalid credentials') ||
      normalized.includes('unauthorized')
    ) {
      return 'Incorrect email or password.';
    }

    if (normalized.includes('verification')) {
      return 'Please verify your account before signing in.';
    }

    if (normalized.includes('inactive')) {
      return 'This account is currently inactive. Please contact ROZZI support.';
    }
  }

  if (!data) {
    return `Request failed (${status}).`;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data.message)) {
    return data.message
      .map((item: any) =>
        typeof item === 'string'
          ? item
          : item?.message || String(item),
      )
      .join('. ');
  }

  if (typeof data.message === 'string') {
    return data.message;
  }

  if (typeof data.error === 'string') {
    return data.error;
  }

  return `Request failed (${status}).`;
}

/**
 * Main Customer API request function.
 */
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  if (
    typeof window !== 'undefined' &&
    retry &&
    token() &&
    shouldRefreshAccessToken()
  ) {
    await refreshAccessToken();
  }

  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const currentToken = token();

  if (currentToken) {
    headers.set(
      'Authorization',
      `Bearer ${currentToken}`,
    );
  }

  let response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  /*
   * If the access token expired unexpectedly,
   * refresh it and retry the original request once.
   */
  if (
    response.status === 401 &&
    retry &&
    typeof window !== 'undefined'
  ) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return api<T>(path, options, false);
    }
  }

  const text = await response.text();

  let data: any;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      formatErrorMessage(data, response.status),
    );
  }

  return data as T;
}

export const post = (
  path: string,
  body?: any,
) =>
  api(path, {
    method: 'POST',
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });

export const patch = (
  path: string,
  body: any,
) =>
  api(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });