const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('nrh_token', token);
    else localStorage.removeItem('nrh_token');
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('nrh_token');
  }
  return authToken;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (body: { qra?: string; email?: string; password: string }) =>
    apiFetch<{ token: string; user: { uid: string; email: string; displayName?: string }; employee: Record<string, unknown> }>(
      '/api/auth/login', { method: 'POST', body: JSON.stringify(body) }
    ),

  register: (body: { qra: string; validationCode: string; password: string; name?: string }) =>
    apiFetch<{ token: string; user: { uid: string; email: string }; employee: Record<string, unknown> }>(
      '/api/auth/register', { method: 'POST', body: JSON.stringify(body) }
    ),

  me: () =>
    apiFetch<{ user: { uid: string; email: string }; employee: Record<string, unknown> }>('/api/auth/me'),

  query: (body: {
    collection: string;
    where?: { field: string; op: string; value: unknown }[];
    orderBy?: { field: string; direction?: 'asc' | 'desc' }[];
    limit?: number;
  }) => apiFetch<{ docs: Record<string, unknown>[] }>('/api/data/query', {
    method: 'POST', body: JSON.stringify(body),
  }),

  getDoc: (collection: string, id: string) =>
    apiFetch<{ doc: Record<string, unknown> }>(`/api/data/${collection}/${id}`),

  addDoc: (collection: string, data: Record<string, unknown>) =>
    apiFetch<{ doc: Record<string, unknown> }>(`/api/data/${collection}`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateDoc: (collection: string, id: string, data: Record<string, unknown>) =>
    apiFetch<{ doc: Record<string, unknown> }>(`/api/data/${collection}/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteDoc: (collection: string, id: string) =>
    apiFetch<{ success: boolean }>(`/api/data/${collection}/${id}`, { method: 'DELETE' }),

  getSetting: (key: string) =>
    apiFetch<{ doc: Record<string, unknown> }>(`/api/data/settings/${key}`),

  setSetting: (key: string, data: Record<string, unknown>) =>
    apiFetch<{ doc: Record<string, unknown> }>(`/api/data/settings/${key}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
};
