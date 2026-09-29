// صفحه ورود (Login) — فقط در حالت اتصال به بک‌اند (VITE_API_BASE ست باشد) فعال است.
// تا زمان ورود موفق، کل برنامه نمایش داده نمی‌شود؛ بنابراین داده‌های دانش‌آموزان
// (که طبق CR-4 نیاز به احراز هویت دارند) هرگز به کاربر ناشناس نشان داده نمی‌شود.
import React, { useState } from 'react';
import { serverApi, setToken } from '../api';

export const LoginPage: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await serverApi.login(username.trim(), password);
      setToken(r.token);
      try {
        const st = await serverApi.getState();
        window.dispatchEvent(new CustomEvent('helli:server-state', { detail: st }));
      } catch (loadErr) {
        console.warn('Initial server state fetch failed:', loadErr);
      }
      onDone();
    } catch (ex: any) {
      setErr(ex?.status === 401 ? 'نام کاربری یا رمز عبور نادرست است.' : `خطا: ${ex.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">ورود به سامانه ثبت‌نام</h1>
          <p className="text-sm text-slate-500 mt-1">برای ادامه وارد حساب خود شوید.</p>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600">نام کاربری</span>
          <input
            value={username} onChange={(e) => setUsername(e.target.value)}
            autoComplete="username" required autoFocus
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">رمز عبور</span>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 transition-colors"
        >
          {busy ? 'در حال بررسی…' : 'ورود'}
        </button>
      </form>
    </div>
  );
};
