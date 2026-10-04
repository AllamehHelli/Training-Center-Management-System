// لایه همگام‌سازی با بک‌اند اختصاصی PHP + MySQL روی cPanel
// فعال‌سازی: VITE_API_BASE="/api" هنگام build. اگر ست نباشد، برنامه در همان
// حالت محلی (localStorage) کار می‌کند — سازگاری کامل با نسخه فعلی بدون وابستگی به Node.js.
import { logger } from './logger';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') || '';
export const BACKEND_ENABLED = API_BASE !== '';

const TOKEN_KEY = 'helli_auth_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function req<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const startTime = Date.now();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  // هدر کمکی برای هاست‌هایی که متدهای PUT یا DELETE را در وب‌سرور فیلتر می‌کنند
  if (method === 'PUT' || method === 'DELETE') {
    headers['X-HTTP-Method-Override'] = method;
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  logger.info('API', `ارسال درخواست ${method} به ${path}`, { method, path, hasToken: !!token });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (netErr: any) {
    const elapsed = Date.now() - startTime;
    logger.error('API', `خطای شبکه در ارتباط با سرور: ${netErr?.message || 'Network Failure'}`, { path, method, elapsed }, { url: path });
    throw new Error(`خطای ارتباط با سرور: اتصال اینترنت یا وب‌سرور هاست را بررسی کنید (${netErr?.message || 'خطای شبکه'})`);
  }

  const elapsed = Date.now() - startTime;
  let body: any = null;
  try { 
    body = await res.json(); 
  } catch { 
    /* non-JSON response */ 
  }

  if (!res.ok) {
    let errMsg = body?.message || body?.error;
    if (!errMsg) {
      if (res.status === 403) {
        errMsg = 'دسترسی غیرمجاز (۴۰۳): سرور اجازه ثبت این عملیات را به این حساب کاربری نداد. دسترسی مدیر را بررسی کنید.';
      } else if (res.status === 401) {
        errMsg = 'نشست کاربری شما منقضی شده یا نامعتبر است. لطفاً مجدداً وارد سامانه شوید.';
      } else if (res.status === 404) {
        errMsg = `مسیر درخواستی روی سرور یافت نشد (۴۰۴): ${path}`;
      } else if (res.status === 500) {
        errMsg = 'خطای داخلی وب‌سرور یا دیتابیس MySQL (۵۰۰). لطفاً فایل لاگ‌های سرور را بررسی فرمایید.';
      } else {
        errMsg = `خطای سرور HTTP ${res.status}`;
      }
    }

    const err: Error & { status?: number; code?: string } = new Error(errMsg);
    err.status = res.status;
    err.code = body?.code;

    logger.error('API', `خطای پاسخ سرور [${res.status}] برای ${method} ${path}: ${errMsg}`, {
      path,
      method,
      status: res.status,
      elapsed,
      body,
    }, { status: res.status, url: path });

    throw err;
  }

  logger.info('API', `پاسخ موفق [${res.status}] برای ${method} ${path} (${elapsed}ms)`, { path, status: res.status, elapsed });
  return body as T;
}

export interface ServerState {
  academicYears: any[];
  activeYearId: string;
  viewingYearId: string;
  nextRegSeq: number;
  students: any[];
  classes: any[];
  registrations: any[];
  teachers?: any[];
  counselors?: any[];
  settings: Record<string, any>;
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
  teachers: () => req<any[]>('/teachers'),
  counselors: () => req<any[]>('/counselors'),
  // بارگذاری و بازیابی ۵ داده نمونه آزمایشی در سمت سرور
  seedSamples: () => req<{ ok: boolean; message: string; count?: number }>('/seed-samples', { method: 'POST' }),
  // دریافت لاگ‌های ممیزی سرور
  serverLogs: () => req<{ logs: any[]; count: number }>('/logs'),
  // ووکامرس سمت سرور (CR-4): کلیدها هرگز به مرورگر نمی‌آیند
  wooStatus: () => req<{ configured: boolean; storeUrl: string }>('/woo/status'),
  wooTest: () => req<{ connected: boolean; error?: string }>('/woo/test', { method: 'POST' }),
  wooOrders: () => req<any[]>('/woo/orders'),
  wooProducts: () => req<any[]>('/woo/products'),
};

/**
 * نگاشت یک اکشن فرانت به فراخوانی REST معادل در بک‌اند PHP.
 * لایه دوم دفاع؛ اعتبارسنجی در هر دو سمت فرانت و سرور اعمال می‌شود.
 */
export async function syncAction(a: { type: string; payload?: any }): Promise<void> {
  logger.info('SYNC', `شروع همگام‌سازی اکشن ${a.type} با سرور`, { actionType: a.type });
  try {
    switch (a.type) {
      case 'ADD_STUDENT':
        await serverApi.post('/students', a.payload);
        break;
      case 'UPDATE_STUDENT':
        await serverApi.put(`/students/${a.payload.id}`, a.payload);
        break;
      case 'DELETE_STUDENT':
        await serverApi.del(`/students/${a.payload.id ?? a.payload}`);
        break;
      case 'BULK_ADD_STUDENTS':
        for (const s of a.payload) await serverApi.post('/students', s);
        break;
      case 'ADD_CLASS':
        await serverApi.post('/classes', a.payload);
        break;
      case 'UPDATE_CLASS':
        await serverApi.put(`/classes/${a.payload.id}`, a.payload);
        break;
      case 'DELETE_CLASS':
        await serverApi.del(`/classes/${a.payload.id ?? a.payload}`);
        break;
      case 'ADD_TEACHER':
        await serverApi.post('/teachers', a.payload);
        break;
      case 'UPDATE_TEACHER':
        await serverApi.put(`/teachers/${a.payload.id}`, a.payload);
        break;
      case 'DELETE_TEACHER':
        await serverApi.del(`/teachers/${a.payload.id ?? a.payload}`);
        break;
      case 'ADD_COUNSELOR':
        await serverApi.post('/counselors', a.payload);
        break;
      case 'UPDATE_COUNSELOR':
        await serverApi.put(`/counselors/${a.payload.id}`, a.payload);
        break;
      case 'DELETE_COUNSELOR':
        await serverApi.del(`/counselors/${a.payload.id ?? a.payload}`);
        break;
      case 'ADD_REGISTRATION':
        await serverApi.post('/registrations', a.payload);
        break;
      case 'UPDATE_REGISTRATION':
        await serverApi.put(`/registrations/${a.payload.id}`, a.payload);
        break;
      case 'UPDATE_REGISTRATION_STATUS':
        await serverApi.put(`/registrations/${a.payload.registrationId ?? a.payload.id}`, {
          status: a.payload.status,
        });
        break;
      case 'DELETE_REGISTRATION':
        await serverApi.del(`/registrations/${a.payload.id ?? a.payload}`);
        break;
      default:
        break;
    }
    logger.info('SYNC', `همگام‌سازی موفق ${a.type}`, { actionType: a.type });
  } catch (err: any) {
    logger.error('SYNC', `شکست همگام‌سازی ${a.type}: ${err?.message || 'نامشخص'}`, { actionType: a.type, error: err });
    throw err;
  }
}
