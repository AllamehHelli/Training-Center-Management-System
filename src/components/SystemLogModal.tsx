/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * مودال پیشرفته سیستم لاگ، خطایابی و ممیزی سامانه علامه حلی
 * همراه با فیلتر، جستجو، خروجی JSON/CSV، کپی گزارش و بارگذاری ۵ داده نمونه
 */

import React, { useState, useEffect, useMemo } from 'react';
import { logger, LogEntry, LogLevel, LogCategory } from '../logger';
import { BACKEND_ENABLED, serverApi, getToken } from '../api';
import { useAppStore } from '../store';
import { useToast } from '../ui';
import {
  FileText,
  Download,
  Copy,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Server,
  Database,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  PlusCircle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRestoreFiveSamples?: () => void;
}

export const SystemLogModal: React.FC<Props> = ({ isOpen, onClose, onRestoreFiveSamples }) => {
  const { state, dispatch } = useAppStore();
  const { showToast } = useToast();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'disconnected' | 'local'>('checking');
  const [serverDetails, setServerDetails] = useState<any>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Subscribe to live log updates
  useEffect(() => {
    if (!isOpen) return;
    const unsub = logger.subscribe((newLogs) => {
      setLogs([...newLogs]);
    });
    return unsub;
  }, [isOpen]);

  // Check health and server connection when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (!BACKEND_ENABLED) {
      setServerStatus('local');
      return;
    }

    setServerStatus('checking');
    serverApi.getState()
      .then((st) => {
        setServerStatus('connected');
        setServerDetails(st);
      })
      .catch((err) => {
        setServerStatus('disconnected');
        logger.error('API', `بررسی اتصال به سرور ناموفق بود: ${err.message}`, { error: err });
      });
  }, [isOpen]);

  // Metrics
  const errorCount = useMemo(() => logs.filter((l) => l.level === 'error').length, [logs]);
  const warnCount = useMemo(() => logs.filter((l) => l.level === 'warn').length, [logs]);
  const syncCount = useMemo(() => logs.filter((l) => l.category === 'SYNC').length, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs
      .filter((l) => {
        if (selectedLevel !== 'ALL' && l.level !== selectedLevel) return false;
        if (selectedCategory !== 'ALL' && l.category !== selectedCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const inMsg = l.message.toLowerCase().includes(q);
          const inCat = l.category.toLowerCase().includes(q);
          const inUrl = l.url?.toLowerCase().includes(q) ?? false;
          const inDetails = l.details ? JSON.stringify(l.details).toLowerCase().includes(q) : false;
          return inMsg || inCat || inUrl || inDetails;
        }
        return true;
      })
      .reverse(); // Newest first
  }, [logs, selectedLevel, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleExportJson = () => {
    try {
      const jsonContent = logger.exportJson();
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `helli-logs-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('فایل JSON لاگ‌ها با موفقیت دانلود شد.', 'success');
    } catch (e: any) {
      showToast(`خطا در ایجاد خروجی: ${e.message}`, 'error');
    }
  };

  const handleExportCsv = () => {
    try {
      const csvContent = logger.exportCsv();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `helli-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('فایل CSV لاگ‌ها با موفقیت دانلود شد.', 'success');
    } catch (e: any) {
      showToast(`خطا در ایجاد خروجی اکسل: ${e.message}`, 'error');
    }
  };

  const handleCopyReport = async () => {
    try {
      const report = logger.generateDiagnosticsReport({
        'حالت کاری': BACKEND_ENABLED ? 'متصل به بک‌اند PHP' : 'محلی (Local Storage)',
        'وضعیت سرور': serverStatus,
        'توکن نشست': getToken() ? 'موجود' : 'ناموجود',
        'تعداد دانش‌آموزان در استور': state.students.length,
        'تعداد کلاس‌ها در استور': state.classes.length,
        'تعداد ثبت‌نام‌ها در استور': state.registrations.length,
        'سال تحصیلی فعال': state.activeYearId,
      });

      await navigator.clipboard.writeText(report);
      showToast('گزارش جامع عیب‌یابی در کلیپ‌بورد کپی شد؛ آماده ارسال به پشتیبانی.', 'success');
    } catch {
      showToast('امکان دسترسی به حافظه کلیپ‌بورد فراهم نبود.', 'error');
    }
  };

  const handleClearLogs = () => {
    logger.clear();
    showToast('تمام لاگ‌های سیستم با موفقیت پاکسازی شدند.', 'info');
  };

  const handleLoadSamples = async () => {
    setIsSeeding(true);
    try {
      if (BACKEND_ENABLED) {
        try {
          await serverApi.seedSamples();
          const st = await serverApi.getState();
          window.dispatchEvent(new CustomEvent('helli:server-state', { detail: st }));
          logger.info('SYSTEM', '۵ داده نمونه از سرور دریافت و جایگزین شد.');
        } catch (serverErr: any) {
          logger.warn('SYSTEM', `بارگذاری سروری داده نمونه ناموفق بود (${serverErr.message}). اعمال نمونه محلی...`);
          if (onRestoreFiveSamples) onRestoreFiveSamples();
        }
      } else {
        if (onRestoreFiveSamples) onRestoreFiveSamples();
      }
      showToast('۵ داده نمونه استاندارد با موفقیت بارگذاری شدند.', 'success');
    } catch (e: any) {
      showToast(`خطا در بارگذاری نمونه‌ها: ${e.message}`, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#162E6E]">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 font-heading">
                  سیستم لاگ و خطایابی سامانه
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-800 rounded-full font-mono">
                  {logs.length} رویداد
                </span>
                {errorCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-700 rounded-full flex items-center gap-1 font-mono">
                    <XCircle size={12} />
                    {errorCount} خطا
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1 font-mono">
                    <AlertTriangle size={12} />
                    {warnCount} هشدار
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ثبت کلیه عملیات ثبت‌نام، همگام‌سازی، نشست کاربری و خطاهای سرور PHP با قابلیت خروجی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="بستن"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* System Diagnostics Banner */}
        <div className="px-6 py-3 bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border-b border-slate-200/60 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-medium">
              <Server size={14} className="text-slate-400" />
              <span>معماری بک‌اند:</span>
              <span className="font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {BACKEND_ENABLED ? 'PHP 8.x + MySQL (مستقل از Node.js)' : 'لوکال / آفلاین (LocalStorage)'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-medium">
              <Database size={14} className="text-slate-400" />
              <span>وضعیت سرور:</span>
              {serverStatus === 'connected' && (
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                  <CheckCircle2 size={12} /> متصل و آنلاین
                </span>
              )}
              {serverStatus === 'disconnected' && (
                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                  <XCircle size={12} /> قطع ارتباط
                </span>
              )}
              {serverStatus === 'checking' && (
                <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                  <RefreshCw size={12} className="animate-spin" /> در حال بررسی...
                </span>
              )}
              {serverStatus === 'local' && (
                <span className="text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-semibold">
                  حالت محلی
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <ShieldCheck size={14} className="text-slate-400" />
              <span>آمار فعال:</span>
              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {state.students.length} دانش‌آموز | {state.registrations.length} پرونده | {state.classes.length} کلاس
              </span>
            </div>
          </div>

          {/* Quick Action: Seed 5 samples */}
          <button
            type="button"
            onClick={handleLoadSamples}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="افزودن و بازیابی ۵ رکورد نمونه استاندارد برای بررسی عملکرد سیستم"
          >
            <PlusCircle size={14} />
            <span>{isSeeding ? 'در حال افزودن...' : 'بارگذاری ۵ داده نمونه'}</span>
          </button>
        </div>

        {/* Toolbar: Filters & Export Actions */}
        <div className="p-4 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در پیام‌ها، آدرس‌ها، کد خطاها یا جزئیات..."
              className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Level selector */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:border-blue-500"
            >
              <option value="ALL">همه سطوح (All Levels)</option>
              <option value="error">فقط خطاها (Errors)</option>
              <option value="warn">فقط هشدارها (Warnings)</option>
              <option value="info">پیام‌های عادی (Info)</option>
            </select>

            {/* Category selector */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:border-blue-500"
            >
              <option value="ALL">همه دسته‌ها (All Categories)</option>
              <option value="SYNC">همگام‌سازی (SYNC)</option>
              <option value="API">درخواست سرور (API)</option>
              <option value="AUTH">احراز هویت و دسترسی (AUTH)</option>
              <option value="MUTATION">تغییرات داده (MUTATION)</option>
              <option value="SYSTEM">سیستم و محیط (SYSTEM)</option>
            </select>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="دانلود فایل JSON حاوی کل لاگ‌ها و متادیتای سیستم"
            >
              <Download size={14} />
              <span>خروجی JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="دانلود فایل اکسل / CSV لاگ‌ها"
            >
              <Download size={14} />
              <span>خروجی CSV</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="کپی گزارش جامع خطایابی برای ارسال سریع در چت یا پشتیبانی"
            >
              <Copy size={14} />
              <span>کپی گزارش فنی</span>
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="پاکسازی لاگ‌ها"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Log List View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Info size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">هیچ لاگی با فیلترهای انتخابی یافت نشد.</p>
              <p className="text-xs text-slate-400">تمام رویدادهای سامانه، درخواست‌ها و خطاهای سرور به صورت زنده اینجا ثبت می‌شوند.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';

              let borderColor = 'border-slate-200';
              let badgeBg = 'bg-slate-100 text-slate-700';
              let icon = <Info size={14} className="text-slate-500 shrink-0" />;

              if (isError) {
                borderColor = 'border-rose-300 bg-rose-50/40';
                badgeBg = 'bg-rose-100 text-rose-800 border-rose-200';
                icon = <XCircle size={15} className="text-rose-600 shrink-0" />;
              } else if (isWarn) {
                borderColor = 'border-amber-300 bg-amber-50/40';
                badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
                icon = <AlertTriangle size={15} className="text-amber-600 shrink-0" />;
              } else if (log.category === 'SYNC') {
                borderColor = 'border-blue-200 bg-blue-50/30';
                badgeBg = 'bg-blue-100 text-blue-800 border-blue-200';
                icon = <RefreshCw size={14} className="text-blue-600 shrink-0" />;
              }

              return (
                <div
                  key={log.id}
                  className={`border rounded-xl bg-white p-3 transition-all ${borderColor} text-xs space-y-2`}
                >
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer select-none"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="mt-0.5">{icon}</div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeBg}`}>
                            {log.category}
                          </span>
                          {log.status && (
                            <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded ${log.status >= 400 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              HTTP {log.status}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-slate-400 dir-ltr">
                            {log.jalaliTime}
                          </span>
                          {log.url && (
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded truncate max-w-[260px] dir-ltr" title={log.url}>
                              {log.url}
                            </span>
                          )}
                        </div>

                        <p className={`font-medium break-words ${isError ? 'text-rose-900 font-semibold' : 'text-slate-800'}`}>
                          {log.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-slate-400">
                      {log.details && (
                        <span className="text-[11px] text-slate-400 font-medium">جزئیات</span>
                      )}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && log.details && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto dir-ltr">
                        <pre className="whitespace-pre-wrap">
                          {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            نمایش {filteredLogs.length} از مجموع {logs.length} رویداد
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#162E6E] hover:bg-[#122558] text-white rounded-xl font-medium transition-colors cursor-pointer"
            >
              بستن پنجره
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
