/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * سیستم جامع لاگ و خطایابی سامانه ثبت‌نام علامه حلی
 * ثبت خودکار رویدادها، خطاهای همگام‌سازی، نشست و درخواست‌های سرور با امکان خروجی گرفتن
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory = 'AUTH' | 'API' | 'SYNC' | 'MUTATION' | 'SYSTEM' | 'SECURITY';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO
  jalaliTime: string; // HH:mm:ss
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  status?: number;
  url?: string;
  durationMs?: number;
}

const STORAGE_LOGS_KEY = 'helli_system_logs_v1';
const MAX_LOGS = 600;

class SystemLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  constructor() {
    this.loadFromStorage();
    this.initGlobalHandlers();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_LOGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.logs = parsed.slice(-MAX_LOGS);
        }
      }
    } catch {
      this.logs = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(this.logs));
    } catch {
      // Storage quota fallback
      if (this.logs.length > 50) {
        this.logs = this.logs.slice(-50);
        try {
          localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(this.logs));
        } catch { /* ignore */ }
      }
    }
  }

  private notify() {
    const list = [...this.logs];
    this.listeners.forEach((fn) => {
      try { fn(list); } catch (e) { console.error('Logger listener error', e); }
    });
  }

  private initGlobalHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.error('SYSTEM', `خطای کلاینت: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || 'خطای پردازش‌نشده ناهمگام');
      this.error('SYSTEM', `Promise Rejection: ${msg}`, {
        reason: typeof reason === 'object' ? { ...reason, message: reason?.message } : reason,
      });
    });
  }

  public log(level: LogLevel, category: LogCategory, message: string, details?: any, extra?: { status?: number; url?: string; durationMs?: number }) {
    const now = new Date();
    const jalaliTime = now.toLocaleTimeString('fa-IR', { hour12: false });
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: now.toISOString(),
      jalaliTime,
      level,
      category,
      message,
      details,
      status: extra?.status,
      url: extra?.url,
      durationMs: extra?.durationMs,
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    this.saveToStorage();
    this.notify();

    // Mirror to native console for browser devtools
    if (level === 'error') {
      console.error(`[${category}] ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${category}] ${message}`, details || '');
    } else {
      console.log(`[${category}] ${message}`, details || '');
    }
  }

  public info(category: LogCategory, message: string, details?: any) {
    this.log('info', category, message, details);
  }

  public warn(category: LogCategory, message: string, details?: any) {
    this.log('warn', category, message, details);
  }

  public error(category: LogCategory, message: string, details?: any, extra?: { status?: number; url?: string }) {
    this.log('error', category, message, details, extra);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => this.listeners.delete(listener);
  }

  public clear() {
    this.logs = [];
    try {
      localStorage.removeItem(STORAGE_LOGS_KEY);
    } catch { /* ignore */ }
    this.notify();
    this.info('SYSTEM', 'تمام لاگ‌های سامانه توسط کاربر پاکسازی شد.');
  }

  /**
   * خروجی کامل لاگ‌ها به فرمت استاندارد JSON
   */
  public exportJson(): string {
    const meta = {
      exportedAt: new Date().toISOString(),
      exportJalali: new Date().toLocaleString('fa-IR'),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      totalLogs: this.logs.length,
      logs: this.logs,
    };
    return JSON.stringify(meta, null, 2);
  }

  /**
   * خروجی لاگ‌ها به فرمت CSV سازگار با اکسل و گزارش‌های فنی
   */
  public exportCsv(): string {
    const headers = ['شناسه', 'زمان میلادی', 'ساعت', 'سطح', 'دسته‌بندی', 'کد وضعیت', 'آدرس/عملیات', 'پیام', 'جزئیات'];
    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = this.logs.map((l) => [
      escapeCsv(l.id),
      escapeCsv(l.timestamp),
      escapeCsv(l.jalaliTime),
      escapeCsv(l.level),
      escapeCsv(l.category),
      escapeCsv(l.status || ''),
      escapeCsv(l.url || ''),
      escapeCsv(l.message),
      escapeCsv(l.details ? JSON.stringify(l.details) : ''),
    ]);

    // BOM for correct UTF-8 display in Microsoft Excel
    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  /**
   * ایجاد گزارش متنی ساخت‌یافته و جامع برای ارسال سریع به تیم فنی
   */
  public generateDiagnosticsReport(extraInfo?: Record<string, any>): string {
    const errorCount = this.logs.filter((l) => l.level === 'error').length;
    const warnCount = this.logs.filter((l) => l.level === 'warn').length;
    const lastErrors = this.logs
      .filter((l) => l.level === 'error')
      .slice(-5)
      .map((e, idx) => `  ${idx + 1}. [${e.jalaliTime}] [${e.category}] ${e.message} (کد: ${e.status || '-'})`)
      .join('\n');

    return `
==============================================
گزارش جامع عیب‌یابی و ممیزی سیستم علامه حلی
==============================================
تاریخ گزارش: ${new Date().toLocaleString('fa-IR')}
تعداد کل لاگ‌ها: ${this.logs.length}
تعداد خطاها (Errors): ${errorCount}
تعداد هشدارها (Warnings): ${warnCount}

اطلاعات محیط کلاینت:
- مرورگر: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
- وضعیت اتصال شبکه: ${typeof navigator !== 'undefined' && navigator.onLine ? 'آنلاین (Online)' : 'آفلاین'}
- آدرس فعلی: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}
${extraInfo ? Object.entries(extraInfo).map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n') : ''}

آخرین خطاهای ثبت‌شده:
${lastErrors || '  هیچ خطایی ثبت نشده است.'}

برای مشاهده جزییات کامل، فایل JSON خروجی لاگ‌ها را ضمیمه نمایید.
==============================================
`.trim();
  }
}

export const logger = new SystemLogger();
