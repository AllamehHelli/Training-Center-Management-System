/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * مودال پیشرفته همگام‌سازی و تحلیل خروجی سفارشات ووکامرس
 * همراه با درگ‌اند-دراپ فایل، پیش‌نمایش آماری ۴ وضعیت مالی و اعمال هوشمند اقساط
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  parseWooCommerceOrdersCsv,
  WooSyncPreviewResult,
  WooFinancialCategory,
} from '../wooCsvParser';
import { useAppStore } from '../store';
import { useToast } from '../ui';
import { formatToman, toPersianDigits } from '../utils';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  Filter,
  Search,
  Users,
  GraduationCap,
  Calendar,
  X,
  ArrowRight,
  Database,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const WooCsvImportModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { state, dispatch, activeAcademicYear } = useAppStore();
  const { showToast } = useToast();

  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewResult, setPreviewResult] = useState<WooSyncPreviewResult | null>(null);
  const [filterCategory, setFilterCategory] = useState<WooFinancialCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // فیلتر ردیف‌های پیش‌نمایش جدول
  const filteredRows = useMemo(() => {
    if (!previewResult) return [];
    return previewResult.rows.filter((r) => {
      if (filterCategory !== 'all' && r.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = r.fullName.toLowerCase().includes(q);
        const inNid = r.cleanNationalId.includes(q) || r.nationalId.includes(q);
        const inOrder = r.orderId.includes(q);
        const inItems = r.rawItems.toLowerCase().includes(q);
        return inName || inNid || inOrder || inItems;
      }
      return true;
    });
  }, [previewResult, filterCategory, searchQuery]);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      setCsvContent(text);
      try {
        const result = parseWooCommerceOrdersCsv(
          text,
          state.activeYearId,
          state.students,
          state.registrations,
          state.classes
        );
        setPreviewResult(result);
      } catch (err: any) {
        showToast(`خطا در پردازش فایل: ${err?.message || 'فرمت فایل معتبر نیست'}`, 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleApply = () => {
    if (!previewResult) return;
    setIsApplying(true);

    try {
      // اعمال همزمان و بدون رکورد تکراری دوره‌ها، دانش‌آموزان و پرونده‌های ثبت‌نام همراه با اقساط
      dispatch({
        type: 'UPSERT_WOO_SYNC_DATA',
        payload: {
          classes: previewResult.classesToUpsert,
          students: previewResult.studentsToUpsert,
          registrations: previewResult.registrationsToUpsert,
        },
      });

      // ثبت رویداد در لاگ ممیزی
      dispatch({
        type: 'ADD_WOO_LOG',
        payload: {
          time: new Date().toLocaleTimeString('fa-IR'),
          message: `همگام‌سازی فایل ووکامرس انجام شد: ${toPersianDigits(
            previewResult.summary.totalOrdersCount
          )} سفارش برای ${toPersianDigits(
            previewResult.summary.totalUniqueStudents
          )} دانش‌آموز با موفقیت پردازش و اعمال شد.`,
          type: 'success',
        },
      });

      showToast(
        `همگام‌سازی موفق: ${toPersianDigits(
          previewResult.registrationsToUpsert.length
        )} پرونده ثبت‌نام و اقساط به‌روزرسانی شدند.`,
        'success'
      );

      setIsApplying(false);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setIsApplying(false);
      showToast(`خطا در اعمال داده‌ها: ${err?.message || 'ناشناخته'}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-bold text-slate-900">
                همگام‌سازی و تحلیل سفارشات ووکامرس (CSV / Excel)
              </h3>
              <p className="text-xs text-slate-500">
                تفکیک هوشمند وصولی نقد، معوقات، درآمدهای آتی و ثبت خودکار اقساط دوره‌ها
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* File Upload Zone */}
          {!previewResult ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/60 scale-[0.99]'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <UploadCloud size={30} />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                فایل اکسل / CSV سفارشات ووکامرس را اینجا رها کنید
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                یا برای انتخاب فایل کلیک فرمایید. فایل خروجی شامل شماره سفارش، نام دانش‌آموز، کد ملی، پایه، مبلغ و وضعیت سفارش به صورت خودکار شناسایی و تحلیل می‌شود.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold shadow-sm transition-colors">
                <span>انتخاب فایل خروجی ووکامرس</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Banner: File Info & Academic Year */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-indigo-600 shrink-0" />
                  <span className="font-bold text-slate-800">{fileName}</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">
                    تعداد کل سطرها: <strong>{toPersianDigits(previewResult.summary.totalOrdersCount)}</strong> سفارش
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar size={14} className="text-slate-400" />
                    <span>سال تحصیلی جاری:</span>
                    <strong className="text-indigo-700 font-bold">{activeAcademicYear?.title || '۱۴۰۴-۱۴۰۵'}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewResult(null);
                      setCsvContent(null);
                    }}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    تغییر فایل
                  </button>
                </div>
              </div>

              {/* 4 Financial Categorization Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Realized Cash */}
                <div
                  onClick={() => setFilterCategory(filterCategory === 'realized' ? 'all' : 'realized')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    filterCategory === 'realized'
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200'
                      : 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      وصولی (نقد محقق‌شده)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800 font-mono">
                      {toPersianDigits(previewResult.summary.realizedCount)}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-heading font-extrabold text-emerald-900 leading-tight">
                    {formatToman(previewResult.summary.realizedAmount)} <span className="text-[10px] font-normal">تومان</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1">
                    تکمیل شده، در حال انجام، تقریباً پرداخت شده
                  </div>
                </div>

                {/* 2. Overdue Installments */}
                <div
                  onClick={() => setFilterCategory(filterCategory === 'overdue' ? 'all' : 'overdue')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    filterCategory === 'overdue'
                      ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-200'
                      : 'bg-rose-50/50 hover:bg-rose-50 border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertCircle size={15} className="text-rose-600" />
                      مطالبات معوق (پیگیری)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800 font-mono">
                      {toPersianDigits(previewResult.summary.overdueCount)}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-heading font-extrabold text-rose-900 leading-tight">
                    {formatToman(previewResult.summary.overdueAmount)} <span className="text-[10px] font-normal">تومان</span>
                  </div>
                  <div className="text-[11px] text-rose-700 mt-1">
                    وضعیت «در انتظار پرداخت قسط»
                  </div>
                </div>

                {/* 3. Future Scheduled */}
                <div
                  onClick={() => setFilterCategory(filterCategory === 'future' ? 'all' : 'future')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    filterCategory === 'future'
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200'
                      : 'bg-amber-50/50 hover:bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Clock size={15} className="text-amber-600" />
                      درآمد آتی پیش‌بینی‌شده
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 font-mono">
                      {toPersianDigits(previewResult.summary.futureCount)}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-heading font-extrabold text-amber-950 leading-tight">
                    {formatToman(previewResult.summary.futureAmount)} <span className="text-[10px] font-normal">تومان</span>
                  </div>
                  <div className="text-[11px] text-amber-800 mt-1">
                    «زمان‌بندی شده» (اقساط ماه‌های بعد)
                  </div>
                </div>

                {/* 4. Excluded */}
                <div
                  onClick={() => setFilterCategory(filterCategory === 'excluded' ? 'all' : 'excluded')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    filterCategory === 'excluded'
                      ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Ban size={15} className="text-slate-500" />
                      اقلام مستثنی (صفر وصولی)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 font-mono">
                      {toPersianDigits(previewResult.summary.excludedCount)}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-heading font-extrabold text-slate-800 leading-tight">
                    {formatToman(previewResult.summary.excludedAmount)} <span className="text-[10px] font-normal">تومان</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    سفارش‌های «لغو شده» و «مسترد شده»
                  </div>
                </div>
              </div>

              {/* Statistics Chips */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-medium text-slate-700">
                  <Users size={14} className="text-slate-500" />
                  <span>دانش‌آموزان یکتا:</span>
                  <strong className="text-slate-900">{toPersianDigits(previewResult.summary.totalUniqueStudents)} نفر</strong>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-medium text-slate-700">
                  <GraduationCap size={14} className="text-slate-500" />
                  <span>دوره‌های آموزشی:</span>
                  <strong className="text-slate-900">{toPersianDigits(previewResult.summary.totalUniqueCourses)} دوره</strong>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-medium text-slate-700">
                  <Database size={14} className="text-slate-500" />
                  <span>پرونده‌های ثبت‌نام تجمیعی:</span>
                  <strong className="text-slate-900">{toPersianDigits(previewResult.registrationsToUpsert.length)} مورد</strong>
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-md">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجوی نام، کدملی، شماره سفارش یا نام دوره..."
                    className="w-full pr-9 pl-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setFilterCategory('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filterCategory === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    همه ({toPersianDigits(previewResult.rows.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('realized')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filterCategory === 'realized'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    وصولی ({toPersianDigits(previewResult.summary.realizedCount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('overdue')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filterCategory === 'overdue'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    معوق ({toPersianDigits(previewResult.summary.overdueCount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('future')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filterCategory === 'future'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    آتی ({toPersianDigits(previewResult.summary.futureCount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('excluded')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filterCategory === 'excluded'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    مستثنی ({toPersianDigits(previewResult.summary.excludedCount)})
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">سفارش</th>
                        <th className="px-4 py-2.5">نام دانش‌آموز</th>
                        <th className="px-4 py-2.5">کد ملی</th>
                        <th className="px-4 py-2.5">پایه</th>
                        <th className="px-4 py-2.5">دوره آموزشی</th>
                        <th className="px-4 py-2.5">مبلغ (تومان)</th>
                        <th className="px-4 py-2.5">وضعیت ووکامرس</th>
                        <th className="px-4 py-2.5">دسته‌بندی مالی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.slice(0, 50).map((r) => (
                        <tr key={r.orderId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-2 font-mono font-medium text-indigo-700">
                            #{toPersianDigits(r.orderId)}
                          </td>
                          <td className="px-4 py-2 font-bold text-slate-800">
                            {r.fullName}
                          </td>
                          <td className="px-4 py-2 font-mono text-slate-600">
                            {toPersianDigits(r.cleanNationalId || r.nationalId || '-')}
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            {r.normalizedGrade}
                          </td>
                          <td className="px-4 py-2 text-slate-800 max-w-xs truncate" title={r.rawItems}>
                            {r.courses.join(' | ')}
                          </td>
                          <td className="px-4 py-2 font-bold text-slate-900 font-mono">
                            {formatToman(r.amount)}
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            {r.rawStatus}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                r.category === 'realized'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : r.category === 'overdue'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : r.category === 'future'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {r.categoryLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredRows.length > 50 && (
                  <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 font-medium">
                    نمایش ۵۰ مورد از {toPersianDigits(filteredRows.length)} سطر فیلترشده (همه موارد در صورت تایید اعمال خواهند شد).
                  </div>
                )}
              </div>

              {/* Informational Safety Banner */}
              <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200 flex items-start gap-2.5 text-xs text-indigo-900 leading-relaxed">
                <ShieldCheck size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold mb-0.5">امنیت و عدم ایجاد رکوردهای تکراری (Idempotent):</strong>
                  دانش‌آموزان بر اساس کد ملی شناسایی می‌شوند و هیچ پرونده یا قسط تکراری اضافه نخواهد شد. در آپلودهای روزانه بعدی، اقساطی که وضعیت آن‌ها به وصولی تغییر کند به‌صورت خودکار در دفترچه اقساط تسویه می‌شوند.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-full text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
          >
            انصراف
          </button>

          {previewResult && (
            <button
              type="button"
              disabled={isApplying}
              onClick={handleApply}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-full text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer"
            >
              {isApplying ? (
                <span>در حال اعمال در دیتابیس...</span>
              ) : (
                <>
                  <span>تایید و اعمال در سامانه ({toPersianDigits(previewResult.registrationsToUpsert.length)} پرونده دوره)</span>
                  <ArrowRight size={15} className="rtl:rotate-180" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
