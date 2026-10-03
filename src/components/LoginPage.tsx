// صفحه ورود (Login) — فقط در حالت اتصال به بک‌اند (VITE_API_BASE ست باشد) فعال است.
import React, { useState } from 'react';
import { serverApi, setToken } from '../api';
import { LogoHelli } from '../Logo';
import { KeyRound, User, Eye, EyeOff, ShieldCheck, HelpCircle, ArrowLeft } from 'lucide-react';

export const LoginPage: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
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
      if (ex?.status === 401) {
        setErr('نام کاربری یا رمز عبور نادرست است.');
      } else if (ex?.message?.includes('db-connection') || ex?.message?.includes('database') || ex?.status === 500) {
        setErr('خطای اتصال به دیتابیس MySQL: لطفاً فایل .env هاست را بررسی نمایید.');
      } else {
        setErr(ex?.message || 'خطا در ارتباط با سرور.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFillDefault = () => {
    setUsername('admin');
    setPassword('admin123');
    setErr('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-neutral-50 to-slate-200 p-4 select-none" dir="rtl">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
        {/* Header with Brand */}
        <div className="p-6 pb-4 text-center border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-transparent">
          <div className="inline-flex justify-center mb-3">
            <LogoHelli size={64} />
          </div>
          <h1 className="text-xl font-heading font-extrabold text-[#162E6E]">
            سامانه جامع ثبت‌نام علامه حلی
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            ورود به پرتال یکپارچه مدیریت، امور مالی و ثبت‌نام‌ها
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Default Credentials Helper Card */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-blue-900 font-bold">
              <ShieldCheck size={16} className="text-blue-600 shrink-0" />
              <span>اطلاعات ورود پیش‌فرض مدیر سامانه:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-white/80 p-2 rounded-xl border border-blue-100">
                <span className="text-slate-500 block text-[10px]">نام کاربری:</span>
                <code className="font-mono font-bold text-blue-950 text-xs">admin</code>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-blue-100">
                <span className="text-slate-500 block text-[10px]">رمز عبور:</span>
                <code className="font-mono font-bold text-blue-950 text-xs">admin123</code>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFillDefault}
              className="w-full text-center text-[11px] text-blue-700 hover:text-blue-900 font-semibold pt-0.5 hover:underline cursor-pointer"
            >
              کلیک برای تکمیل خودکار اطلاعات پیش‌فرض
            </button>
          </div>

          {/* Username Field */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              نام کاربری
            </label>
            <div className="relative">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <User size={16} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                autoFocus
                placeholder="admin"
                className="w-full pr-9 pl-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#162E6E] focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-mono"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              رمز عبور
            </label>
            <div className="relative">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <KeyRound size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full pr-9 pl-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#162E6E] focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'مخفی کردن' : 'نمایش رمز'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {err && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
              <p className="font-semibold">{err}</p>
              {err.includes('دیتابیس') && (
                <p className="text-[11px] text-rose-600">
                  راهنما: در cPanel مطمئن شوید دیتابیس ساخته شده و نام کاربری با تمام دسترسی‌ها به آن متصل است و مقادیر در فایل <code className="font-mono">.env</code> درج شده‌اند.
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 bg-[#162E6E] hover:bg-[#0f2150] disabled:opacity-60 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy ? (
              <span>در حال بررسی نشست و بارگذاری…</span>
            ) : (
              <>
                <span>ورود به سامانه</span>
                <ArrowLeft size={14} />
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-center text-[11px] text-slate-500">
          دسترسی فقط ویژه پرسنل مجاز و کادر آموزشگاه تیزهوشان علامه حلی
        </div>
      </div>
    </div>
  );
};
