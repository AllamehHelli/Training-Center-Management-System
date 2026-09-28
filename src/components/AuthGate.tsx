// درِ احراز هویت: فقط وقتی بک‌اند فعال است (VITE_API_BASE) جلوی برنامه را می‌گیرد.
// پس از ورود موفق، یک بار GET /api/state خوانده و رویداد 'helli:server-state'
// broadcast می‌شود تا AppProvider داده localStorage را با واقعیت سرور جایگزین کند.
import React, { useEffect, useState } from 'react';
import { BACKEND_ENABLED, serverApi, getToken, clearToken } from '../api';
import { LoginPage } from './LoginPage';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authed, setAuthed] = useState(!BACKEND_ENABLED); // حالت محلی: بدون تغییر رفتار
  const [checking, setChecking] = useState(BACKEND_ENABLED);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    (async () => {
      if (!getToken()) { setChecking(false); return; }
      try {
        await serverApi.me();
        setAuthed(true);
        try {
          const st = await serverApi.getState();
          window.dispatchEvent(new CustomEvent('helli:server-state', { detail: st }));
        } catch (e) { console.error('initial state load failed', e); }
      } catch {
        clearToken();
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) return <div className="min-h-screen grid place-items-center text-slate-500" dir="rtl">در حال بررسی نشست…</div>;
  if (!authed) return <LoginPage onDone={() => setAuthed(true)} />;
  return <>{children}</>;
};
