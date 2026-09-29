// لایه همگام‌سازی با بک‌اند (Node.js + MySQL روی cPanel)
// فعال‌سازی: VITE_API_BASE="/api" هنگام build. اگر ست نباشد، برنامه در همان
// حالت محلی (localStorage) کار می‌کند — سازگاری کامل با نسخه فعلی.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') || '';
export const BACKEND_ENABLED = API_BASE !== '';

const TOKEN_KEY = 'helli_auth_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function req<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const err: Error & { status?: number; code?: string } = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status; err.code = body?.code;
    throw err;
  }
  return body as T;
}

export interface ServerState {
  academicYears: any[]; activeYearId: string; viewingYearId: string; nextRegSeq: number;
  students: any[]; classes: any[]; registrations: any[]; settings: Record<string, any>;
  archivedData: Record<string, any>;
}

export const serverApi = {
  login: (username: string, password: string) =>
    req<{ token: string; user: { id: string; username: string; displayName: string; role: string } }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  me: () => req<{ user: { uid: string; role: string; name: string } }>('/auth/me'),
  getState: () => req<ServerState>('/state'),
  post: (p: string, b: unknown) => req(p, { method: 'POST', body: JSON.stringify(b) }),
  put: (p: string, b: unknown) => req(p, { method: 'PUT', body: JSON.stringify(b) }),
  del: (p: string) => req(p, { method: 'DELETE' }),
  // ووکامرس سمت سرور (CR-4): کلیدها هرگز به مرورگر نمی‌آیند
  wooStatus: () => req<{ configured: boolean; storeUrl: string }>('/woo/status'),
  wooTest: () => req<{ connected: boolean; error?: string }>('/woo/test', { method: 'POST' }),
  wooOrders: () => req<any[]>('/woo/orders'),
  wooProducts: () => req<any[]>('/woo/products'),
};

/**
 * نگاشت یک اکشن فرانت به فراخوانی REST معادل. صرفاً «تکرار» عملیات است؛
 * اعتبارسنجی‌های اصلی همچنان در ریدیوسر انجام شده و سرور لایه دوم دفاع است.
 * اکشن‌هایی که اینجا نیستند (مثل SET_VIEWING_YEAR) یا فقط UI هستند یا مسیر
 * اختصاصی خود را دارند.
 */
export async function syncAction(a: { type: string; payload?: any }): Promise<void> {
  switch (a.type) {
    case 'ADD_STUDENT': return void await serverApi.post('/students', a.payload);
    case 'UPDATE_STUDENT': return void await serverApi.put(`/students/${a.payload.id}`, a.payload);
    case 'DELETE_STUDENT': return void await serverApi.del(`/students/${a.payload.id ?? a.payload}`);
    case 'BULK_ADD_STUDENTS':
      for (const s of a.payload) await serverApi.post('/students', s);
      return;
    case 'ADD_CLASS': return void await serverApi.post('/classes', a.payload);
    case 'UPDATE_CLASS': return void await serverApi.put(`/classes/${a.payload.id}`, a.payload);
    case 'DELETE_CLASS': return void await serverApi.del(`/classes/${a.payload.id ?? a.payload}`);
    case 'ADD_REGISTRATION': return void await serverApi.post('/registrations', a.payload);
    case 'UPDATE_REGISTRATION':
      return void await serverApi.put(`/registrations/${a.payload.id}`, a.payload);
    case 'UPDATE_REGISTRATION_STATUS':
      return void await serverApi.put(`/registrations/${a.payload.registrationId ?? a.payload.id}`, {
        status: a.payload.status,
      });
    case 'DELETE_REGISTRATION': return void await serverApi.del(`/registrations/${a.payload.id ?? a.payload}`);
    default: return; // MARK_INSTALLMENT_PAID/REFUND از رویداد اختصاصی زیر استفاده می‌کنند
  }
}
