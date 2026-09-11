const BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

export function token() {
  if (typeof window === 'undefined') return null;

  return localStorage.getItem('rozzi_token');
}

export function setSession(data: any) {
  localStorage.setItem(
    'rozzi_token',
    data.accessToken,
  );

  localStorage.setItem(
    'rozzi_refresh',
    data.refreshToken || '',
  );
}

export function logout() {
  localStorage.removeItem('rozzi_token');
  localStorage.removeItem('rozzi_refresh');
}

/**
 * Converts backend errors of different shapes
 * into a clear message that can be shown to users.
 */
function formatErrorMessage(
  data: any,
  status: number,
): string {
  /*
   * Authentication errors should never expose raw HTTP/NestJS
   * messages such as "401 Unauthorized" to the user.
   */
  if (status === 401) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.error === 'string'
          ? data.error
          : '';

    const normalized = message.toLowerCase();

    if (
      normalized.includes('incorrect email or password') ||
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

  // No response body
  if (!data) {
    return `Request failed (${status}).`;
  }

  // Simple string response
  if (typeof data === 'string') {
    return data;
  }

  // NestJS validation errors
  if (Array.isArray(data.message)) {
    return data.message
      .map((item: any) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item?.message) {
          return item.message;
        }

        return String(item);
      })
      .filter(Boolean)
      .join('. ');
  }

  // Simple backend message
  if (typeof data.message === 'string') {
    return data.message;
  }

  // Structured message object
  if (
    data.message &&
    typeof data.message === 'object'
  ) {
    return formatObjectError(data.message);
  }

  // Another common backend format
  if (typeof data.error === 'string') {
    return data.error;
  }

  if (
    data.error &&
    typeof data.error === 'object'
  ) {
    return formatObjectError(data.error);
  }

  // Backend details
  if (typeof data.details === 'string') {
    return data.details;
  }

  if (
    data.details &&
    typeof data.details === 'object'
  ) {
    return formatObjectError(data.details);
  }

  return `Request failed (${status}).`;
}

/**
 * Converts structured backend objects into
 * readable messages.
 */
function formatObjectError(
  value: any,
): string {
  if (!value) {
    return 'Something went wrong.';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        formatObjectError(item),
      )
      .filter(Boolean)
      .join('. ');
  }

  if (typeof value === 'object') {
    const messages = Object.entries(value)
      .map(([key, message]) => {
        const label =
          key.charAt(0).toUpperCase() +
          key.slice(1);

        return `${label}: ${formatObjectError(
          message,
        )}`;
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join('. ');
    }
  }

  return String(value);
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(
    options.headers,
  );

  headers.set(
    'Content-Type',
    'application/json',
  );

  const t = token();

  if (t) {
    headers.set(
      'Authorization',
      `Bearer ${t}`,
    );
  }

  let response = await fetch(
    `${BASE}${path}`,
    {
      ...options,
      headers,
      cache: 'no-store',
    },
  );

  if (
    response.status === 401 &&
    retry &&
    typeof window !== 'undefined'
  ) {
    const refreshed =
      await refreshAccessToken();

    if (refreshed) {
      return api<T>(
        path,
        options,
        false,
      );
    }
  }

  const text =
    await response.text();

  let data: any;

  try {
    data = text
      ? JSON.parse(text)
      : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      formatErrorMessage(
        data,
        response.status,
      ),
    );
  }

  return data as T;
}

let refreshPromise:
  Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken =
    typeof window !== 'undefined'
      ? localStorage.getItem(
          'rozzi_refresh',
        )
      : null;

  if (!refreshToken) {
    return false;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response =
        await fetch(
          `${BASE}/api/auth/refresh`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              refreshToken,
            }),
            cache: 'no-store',
          },
        );

      if (!response.ok) {
        throw new Error(
          'Refresh failed',
        );
      }

      const data =
        await response.json();

      if (!data?.accessToken) {
        throw new Error(
          'Refresh token response was invalid',
        );
      }

      localStorage.setItem(
        'rozzi_token',
        data.accessToken,
      );

      if (data.refreshToken) {
        localStorage.setItem(
          'rozzi_refresh',
          data.refreshToken,
        );
      }

      return true;
    } catch {
      localStorage.removeItem(
        'rozzi_token',
      );

      localStorage.removeItem(
        'rozzi_refresh',
      );

      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const post = (
  path: string,
  body?: any,
) =>
  api(
    path,
    {
      method: 'POST',
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    },
  );

export const patch = (
  path: string,
  body: any,
) =>
  api(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );