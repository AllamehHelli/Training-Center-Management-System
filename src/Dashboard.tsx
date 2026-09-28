/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { useFieldSettings } from './Settings';
import {
  toPersianDigits,
  formatToman,
  getTodayJalali,
  addDaysJalali,
  isOverdue,
  downloadCSV,
} from './utils';
import { Counter, ProgressBar, Avatar, useToast, InfoTooltip } from './ui';
import {
  IconCheck,
  IconClose,
  IconArrowUpRight,
  IconDownload,
  IconSearch,
  IconRegistrations,
  IconFinance,
  IconClasses,
  IconCalendar,
  IconPhone,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
} from './icons';
import { SparklineWave } from './components/SparklineWave';
import { StudentDossierModal } from './components/StudentDossierModal';
import { JalaliDateRange, TopBarDateRangeFilter } from './components/TopBarDateRangeFilter';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  Layers,
  FileText,
  UserCheck,
  TrendingUp,
  Calendar as CalendarIcon,
} from 'lucide-react';

interface DashboardProps {
  onNavigateToRegistrations: (filters?: Record<string, string>) => void;
  onNavigateToFinance: () => void;
  dateFilter?: JalaliDateRange;
  onDateFilterChange?: (range: JalaliDateRange) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToRegistrations,
  onNavigateToFinance,
  dateFilter,
  onDateFilterChange,
}) => {
  const { state, dispatch, getStudentById, getClassById, getSessionById } = useAppStore();
  const { grades } = useFieldSettings();
  const { showToast } = useToast();
  const today = getTodayJalali();

  // Fast dossier modal state
  const [selectedDossierRegId, setSelectedDossierRegId] = useState<string | null>(null);

  // Filter state for Registration Log Table
  const [tableSearch, setTableSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [openRowActionId, setOpenRowActionId] = useState<string | null>(null);
  // ME-3: pagination state for the registrations table (was hard-capped at 8 rows)
  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 8;

  // Active Jalali date filter evaluation
  const isDateFilterActive =
    !!dateFilter && dateFilter.preset !== 'all' && !!dateFilter.startDate && !!dateFilter.endDate;

  const dateScopedRegistrations = isDateFilterActive
    ? state.registrations.filter(
        (r) => r.date >= dateFilter!.startDate! && r.date <= dateFilter!.endDate!
      )
    : state.registrations;

  // Metrics computation based on active date range
  const totalRegistrations = dateScopedRegistrations.length;
  const approvedRegistrations = dateScopedRegistrations.filter((r) => r.status === 'approved');
  const pendingRegistrations = dateScopedRegistrations.filter((r) => r.status === 'pending');
  const cancelledRegistrations = dateScopedRegistrations.filter((r) => r.status === 'cancelled');

  // Registrations in last 7 days (exact Jalali date math)
  const sevenDaysAgo = addDaysJalali(today, -7);
  const recent7DaysCount = state.registrations.filter((r) => r.date >= sevenDaysAgo).length;

  // Financial aggregates for active date range
  let totalContractValue = 0;
  let totalCollected = 0;
  let totalOverdueAmount = 0;
  let overdueCount = 0;

  dateScopedRegistrations.forEach((reg) => {
    if (reg.status === 'cancelled') return;
    reg.plan.installments.forEach((inst) => {
      totalContractValue += inst.amount;
      if (inst.paidAt) {
        totalCollected += inst.amount;
      } else if (isOverdue(inst.dueDate, inst.paidAt)) {
        totalOverdueAmount += inst.amount;
        overdueCount += 1;
      }
    });
  });

  const remainingCollectible = Math.max(0, totalContractValue - totalCollected);

  // Overall institute capacity
  let totalCapacity = 0;
  let totalEnrolled = 0;
  state.classes.forEach((cls) => {
    cls.sessions.forEach((ses) => {
      totalCapacity += ses.capacity;
      const enrolled = state.registrations.filter(
        (r) => r.classId === cls.id && r.sessionId === ses.id && r.status !== 'cancelled'
      ).length;
      totalEnrolled += enrolled;
    });
  });

  const capacityPercentage = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;
  const approvedPercentage = totalRegistrations > 0 ? Math.round((approvedRegistrations.length / totalRegistrations) * 100) : 0;

  // Grade Distribution for Donut Chart (reflects active date range)
  const gradeCounts: Record<string, number> = {};
  grades.forEach((g) => {
    gradeCounts[g] = 0;
  });
  dateScopedRegistrations.forEach((r) => {
    const s = getStudentById(r.studentId);
    if (s && s.grade) {
      gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1;
    }
  });

  const totalCohort = dateScopedRegistrations.length || 1;
  const colorPalette = [
    '#162E6E',
    '#EA580C',
    '#2563EB',
    '#F97316',
    '#3E7CB1',
    '#7C3AED',
    '#0C1838',
    '#0D9488',
  ];

  let cumulativeAngle = 0;
  const donutSegments = Object.entries(gradeCounts).map(([grade, count], idx) => {
    const fraction = count / totalCohort;
    const angle = fraction * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      grade,
      count,
      percent: Math.round(fraction * 100),
      color: colorPalette[idx % colorPalette.length],
      startAngle,
      angle,
    };
  });

  // 7-Day Trend Data
  const chartDays = [
    { day: 'شنبه', date: '۲۸ شهریور', count: 3 },
    { day: 'یکشنبه', date: '۲۹ شهریور', count: 5 },
    { day: 'دوشنبه', date: '۳۰ شهریور', count: 4 },
    { day: 'سه‌شنبه', date: '۳۱ شهریور', count: 6 },
    { day: 'چهارشنبه', date: '۱ مهر', count: 8 },
    { day: 'پنجشنبه', date: '۲ مهر', count: 7 },
    { day: 'جمعه', date: '۳ مهر', count: 2 },
  ];
  const maxChartCount = Math.max(...chartDays.map((d) => d.count), 10);

  // Quick Approve/Reject handlers
  const handleApprove = (id: string) => {
    dispatch({ type: 'UPDATE_REGISTRATION_STATUS', payload: { id, status: 'approved' } });
    showToast('ثبت‌نام دانش‌آموز با موفقیت تأیید شد', 'success');
    setOpenRowActionId(null);
  };

  const handleReject = (id: string) => {
    dispatch({ type: 'UPDATE_REGISTRATION_STATUS', payload: { id, status: 'cancelled' } });
    showToast('ثبت‌نام لغو شد', 'error');
    setOpenRowActionId(null);
  };

  // CSV Export for Registrations
  const handleExportCSV = () => {
    const headers = ['کد پیگیری', 'نام دانش‌آموز', 'پایه تحصیلی', 'دوره آموزشی', 'وضعیت پذیرش', 'مبلغ کل (تومان)', 'تاریخ ثبت'];
    const csvContent = [
      headers.join(','),
      ...state.registrations.map((r) => {
        const student = getStudentById(r.studentId);
        const classRoom = getClassById(r.classId);
        return [
          `"${r.code}"`,
          `"${student ? `${student.firstName} ${student.lastName}` : ''}"`,
          `"${student?.grade || ''}"`,
          `"${classRoom?.name || ''}"`,
          `"${r.status === 'approved' ? 'تأیید شده' : r.status === 'pending' ? 'در انتظار' : 'لغو شده'}"`,
          `"${r.plan.totalAmount || r.amount}"`,
          `"${r.date}"`,
        ].join(',');
      }),
    ].join('\n');
    downloadCSV(`گزارش_ثبت_نام_${today.replace(/\//g, '-')}.csv`, csvContent);
    showToast('فایل اکسل گزارش ثبت‌نام‌ها با موفقیت دانلود شد', 'success');
  };

  // Filtered registrations for the management table
  const filteredRegistrations = dateScopedRegistrations.filter((r) => {
    const student = getStudentById(r.studentId);
    const classRoom = getClassById(r.classId);

    // Search query
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      const matchName = student && `${student.firstName} ${student.lastName}`.toLowerCase().includes(q);
      const matchCode = r.code.toLowerCase().includes(q);
      const matchClass = classRoom && classRoom.name.toLowerCase().includes(q);
      const matchParent = student?.phones.some((p) => p.number.includes(q));
      if (!matchName && !matchCode && !matchClass && !matchParent) return false;
    }

    // Category (Grade) filter
    if (categoryFilter !== 'all') {
      if (student?.grade !== categoryFilter) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (r.status !== statusFilter) return false;
    }

    // Payment model filter
    if (paymentFilter !== 'all') {
      if (paymentFilter === 'cash' && r.plan.months !== 0) return false;
      if (paymentFilter === 'installments' && r.plan.months === 0) return false;
    }

    return true;
  });

  // ME-3: paginated view of the table instead of a silent hard cap of 8 rows.
  const totalPages = Math.max(1, Math.ceil(filteredRegistrations.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(tablePage, totalPages - 1);
  const pagedRegistrations = filteredRegistrations.slice(
    safePage * TABLE_PAGE_SIZE,
    (safePage + 1) * TABLE_PAGE_SIZE
  );
  const rangeStart = filteredRegistrations.length === 0 ? 0 : safePage * TABLE_PAGE_SIZE + 1;
  const rangeEnd = Math.min((safePage + 1) * TABLE_PAGE_SIZE, filteredRegistrations.length);

  // Reset to the first page whenever any active filter changes, so the user
  // never lands on an out-of-range page after narrowing the result set.
  useEffect(() => {
    setTablePage(0);
  }, [tableSearch, categoryFilter, statusFilter, paymentFilter, dateFilter?.preset, dateFilter?.startDate, dateFilter?.endDate]);

  // ME-3: jump to the full registrations page carrying over every active
  // filter (search / status) so nothing looks "missing".
  const handleViewAllRegistrations = () => {
    const params: Record<string, string> = {};
    if (tableSearch.trim()) params.q = tableSearch.trim();
    if (statusFilter !== 'all') params.status = statusFilter;
    onNavigateToRegistrations(params);
  };

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Page Title & Main Actions (Management Header)                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-neutral-900 tracking-tight">
              داشبورد پایش ثبت‌نام و پذیرش تیزهوشان
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            مرکز پایش وضعیت تحصیلی، مدیریت ظرفیت کلاس‌های حضوری و وصولی اقساط شهریه موسسه علامه حلی
          </p>
        </div>

        {/* Action Buttons: Date Filter + Export Report + New Registration */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 self-start sm:self-auto">
          {dateFilter && onDateFilterChange && (
            <TopBarDateRangeFilter value={dateFilter} onChange={onDateFilterChange} />
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200/90 rounded-full text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5"
          >
            <IconDownload size={13} className="text-neutral-500" />
            <span>خروجی اکسل</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToRegistrations()}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5"
          >
            <IconPlus size={13} className="text-white/90" />
            <span>ثبت‌نام جدید</span>
          </button>
        </div>
      </div>

      {/* Active Jalali Date Filter Notice Banner - Ultra-Minimal */}
      {isDateFilterActive && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-neutral-900 text-white rounded-2xl shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CalendarIcon size={14} className="text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="text-neutral-300">بازه زمانی فعال: </span>
              <strong className="text-amber-300 font-bold">
                {dateFilter.preset === 'today'
                  ? `امروز (${toPersianDigits(today)})`
                  : dateFilter.preset === 'week'
                  ? '۷ روز اخیر'
                  : dateFilter.preset === 'month'
                  ? '۳۰ روز اخیر'
                  : dateFilter.preset === '15days'
                  ? '۱۵ روز اخیر'
                  : dateFilter.preset === '90days'
                  ? 'سه ماه اخیر'
                  : `${toPersianDigits(dateFilter.startDate!)} تا ${toPersianDigits(dateFilter.endDate!)}`}
              </strong>
              <span className="text-neutral-400 mr-2 text-[11px]">
                ({toPersianDigits(totalRegistrations)} پرونده ثبت‌نام منطبق)
              </span>
            </div>
          </div>
          {onDateFilterChange && (
            <button
              type="button"
              onClick={() => onDateFilterChange({ preset: 'all' })}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-medium transition-colors shrink-0 self-end sm:self-auto"
            >
              نمایش همه ثبت‌نام‌ها
            </button>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4 Executive KPI Cards with Smooth Bezier Sparkline Curves         */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Registrations (Pink Wave) */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-8 h-8 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 shrink-0">
              <IconRegistrations size={16} />
            </div>
            <SparklineWave variant="pink" />
          </div>

          <div className="mt-4">
            <span className="text-xs text-neutral-500 font-medium">
              کل پرونده‌های ثبت‌نام
            </span>
            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tabular-nums">
                <Counter value={totalRegistrations} />
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/60 tabular-nums">
                +۱۲.۴٪ رشد
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
              <span>ثبت‌نام ۷ روز اخیر:</span>
              <span className="text-neutral-700 font-semibold tabular-nums">
                +{toPersianDigits(recent7DaysCount)} پرونده جدید
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Approved Admissions (Purple Wave) */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <CheckCircle2 size={16} strokeWidth={2.2} />
            </div>
            <SparklineWave variant="purple" />
          </div>

          <div className="mt-4">
            <span className="text-xs text-neutral-500 font-medium">
              پذیرش‌های قطعی و تأییدشده
            </span>
            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tabular-nums">
                <Counter value={approvedRegistrations.length} />
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/60 tabular-nums">
                {toPersianDigits(approvedPercentage)}٪ موفق
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
              <span>صدور کارت ورود به کلاس:</span>
              <span className="text-neutral-700 font-semibold tabular-nums">
                {toPersianDigits(approvedRegistrations.length)} دانش‌آموز
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Overdue Installments (Blue Wave) */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <AlertCircle size={16} strokeWidth={2.2} />
            </div>
            <SparklineWave variant="blue" />
          </div>

          <div className="mt-4">
            <span className="text-xs text-neutral-500 font-medium">
              اقساط معوق سررسید گذشته
            </span>
            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tabular-nums">
                {toPersianDigits(overdueCount)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100/60 tabular-nums">
                نیازمند تماس
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
              <span>مبلغ معوقات:</span>
              <span className="text-rose-600 font-semibold tabular-nums">
                {formatToman(totalOverdueAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Pending Verification (Coral Wave) */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
              <Clock size={16} strokeWidth={2.2} />
            </div>
            <SparklineWave variant="coral" />
          </div>

          <div className="mt-4">
            <span className="text-xs text-neutral-500 font-medium">
              پرونده‌های در صف بررسی
            </span>
            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tabular-nums">
                <Counter value={pendingRegistrations.length} />
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100/60 tabular-nums">
                اقدام فوری
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
              <span>در انتظار مدارک یا پرداخت:</span>
              <span className="text-amber-700 font-semibold tabular-nums">
                {toPersianDigits(pendingRegistrations.length)} متقاضی
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Quick Summary Row: Capacity & Financial Progress                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Capacity Progress */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700">
                <IconClasses size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold text-neutral-900 block">ظرفیت صندلی‌های آموزشگاه</span>
                <span className="text-[11px] text-neutral-400">مجموع کلاس‌های زوج، فرد و اختصاصی</span>
              </div>
            </div>
            <span className="text-lg font-bold text-neutral-900 tabular-nums">
              {toPersianDigits(capacityPercentage)}٪ تکمیل
            </span>
          </div>
          <div className="mt-4 space-y-1.5">
            <ProgressBar current={totalEnrolled} max={totalCapacity} colorClass="bg-neutral-900" showText={false} />
            <div className="flex justify-between text-[11px] text-neutral-500 tabular-nums">
              <span>{toPersianDigits(totalEnrolled)} دانش‌آموز ثبت‌نام شده</span>
              <span>از مجموع {toPersianDigits(totalCapacity)} صندلی</span>
            </div>
          </div>
        </div>

        {/* Financial Collection Progress */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                <IconFinance size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold text-neutral-900 block">وصولی شهریه دوره جاری</span>
                <span className="text-[11px] text-neutral-400">دریافتی‌های نقدی و اقساط وصول شده</span>
              </div>
            </div>
            <span className="text-base font-bold text-emerald-700 tabular-nums">
              {formatToman(totalCollected)}
            </span>
          </div>
          <div className="mt-4 space-y-1.5">
            <ProgressBar current={totalCollected} max={totalContractValue} colorClass="bg-emerald-600" showText={false} />
            <div className="flex justify-between text-[11px] text-neutral-500 tabular-nums">
              <span>مانده تعهدات: {formatToman(remainingCollectible)}</span>
              <span>ارزش کل قراردادها: {formatToman(totalContractValue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Comprehensive Registrations Management Table                      */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-neutral-200/70 shadow-xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Section Title & Result Count */}
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-neutral-900 font-heading">
              فهرست آخرین پرونده‌های ثبت‌نام
            </h2>
            <span className="text-xs text-neutral-400 tabular-nums">
              {toPersianDigits(filteredRegistrations.length)} پرونده
            </span>
            {filteredRegistrations.length > TABLE_PAGE_SIZE && (
              <button
                type="button"
                onClick={handleViewAllRegistrations}
                title="مشاهده‌ی کامل این فهرست در صفحه ثبت‌نام‌ها، با همان فیلترهای فعال"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold transition-colors"
              >
                مشاهده همه در صفحه ثبت‌نام
                <IconArrowUpRight size={12} />
              </button>
            )}
          </div>

          {/* Search input & Select Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <IconSearch size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="جستجو با نام، کد، تلفن یا دوره..."
                className="w-full pr-8 pl-3.5 py-1.5 bg-neutral-50 hover:bg-neutral-100/80 focus:bg-white border border-neutral-200/80 rounded-full text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden transition-all"
              />
            </div>

            {/* Categories (Grade) Select */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none bg-neutral-50 hover:bg-neutral-100/80 text-neutral-700 pr-3.5 pl-7 py-1.5 rounded-full border border-neutral-200/80 text-xs font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="all">همه پایه‌ها</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    پایه {g}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>

            {/* Status Select */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-neutral-50 hover:bg-neutral-100/80 text-neutral-700 pr-3.5 pl-7 py-1.5 rounded-full border border-neutral-200/80 text-xs font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="approved">تأیید شده</option>
                <option value="pending">در انتظار بررسی</option>
                <option value="cancelled">لغو شده</option>
              </select>
              <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>

            {/* Payment Model Select */}
            <div className="relative">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="appearance-none bg-neutral-50 hover:bg-neutral-100/80 text-neutral-700 pr-3.5 pl-7 py-1.5 rounded-full border border-neutral-200/80 text-xs font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="all">همه روش‌های پرداخت</option>
                <option value="cash">تسویه نقدی</option>
                <option value="installments">دفترچه اقساطی</option>
              </select>
              <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-neutral-100 text-neutral-400 font-medium bg-neutral-50/50">
                <th className="py-3.5 px-5 font-medium">دانش‌آموز و کد پرونده</th>
                <th className="py-3.5 px-4 font-medium">پایه تحصیلی</th>
                <th className="py-3.5 px-4 font-medium">نام ولی و شماره تماس</th>
                <th className="py-3.5 px-4 font-medium">دوره آموزشی و زنگ</th>
                <th className="py-3.5 px-4 font-medium">وضعیت پذیرش</th>
                <th className="py-3.5 px-4 font-medium">شهریه و نحوه پرداخت</th>
                <th className="py-3.5 px-4 font-medium text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/80">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400 text-xs">
                    هیچ پرونده‌ای مطابق با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                pagedRegistrations.map((reg) => {
                  const student = getStudentById(reg.studentId);
                  const classRoom = getClassById(reg.classId);
                  const session = classRoom?.sessions.find((s) => s.id === reg.sessionId);
                  const parentPhone = student?.phones[0]?.number || '۰۹۱۲۰۰۰۰۰۰۰';

                  return (
                    <tr
                      key={reg.id}
                      className="hover:bg-neutral-50/70 transition-colors group"
                    >
                      {/* Student Column */}
                      <td className="py-3.5 px-5 font-medium text-neutral-800">
                        <div
                          className="flex items-center gap-3 cursor-pointer group/std"
                          onClick={() => setSelectedDossierRegId(reg.id)}
                          title="کلیک برای باز شدن سریع پرونده کامل و ویرایش اطلاعات"
                        >
                          <Avatar
                            name={student ? `${student.firstName} ${student.lastName}` : 'د'}
                            size="sm"
                          />
                          <div>
                            <div className="font-semibold text-neutral-900 group-hover/std:text-blue-700 transition-colors">
                              {student ? `${student.firstName} ${student.lastName}` : 'ثبت‌نام نامشخص'}
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-0.5">
                              کد رهگیری: {reg.code}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Grade */}
                      <td className="py-3.5 px-4 text-neutral-700">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-xs font-medium">
                          {student ? `پایه ${student.grade}` : 'عمومی'}
                        </span>
                      </td>

                      {/* Guardian & Phone */}
                      <td className="py-3.5 px-4 text-neutral-600">
                        <div>
                          <span className="font-medium text-neutral-800">
                            {student?.fatherName ? `آقای ${student.fatherName}` : 'ولی دانش‌آموز'}
                          </span>
                          <span className="block text-[10px] text-neutral-400 mt-0.5">
                            {toPersianDigits(parentPhone)}
                          </span>
                        </div>
                      </td>

                      {/* Course and Session */}
                      <td className="py-3.5 px-4 text-neutral-600">
                        <div className="truncate max-w-[200px]" title={classRoom?.name}>
                          <span className="text-xs text-neutral-800 font-semibold">
                            {classRoom?.name || 'کلاس نامشخص'}
                          </span>
                          <span className="block text-[10px] text-neutral-400 mt-0.5">
                            {session ? session.label : 'زنگ عادی'}
                          </span>
                        </div>
                      </td>

                      {/* Status: Soft pastel pills */}
                      <td className="py-3.5 px-4">
                        {reg.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <IconCheck size={12} />
                            <span>تأیید شده</span>
                          </span>
                        )}
                        {reg.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            <Clock size={12} />
                            <span>در انتظار بررسی</span>
                          </span>
                        )}
                        {reg.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                            <IconClose size={12} />
                            <span>لغو شده</span>
                          </span>
                        )}
                      </td>

                      {/* Tuition and Payment Type */}
                      <td className="py-3.5 px-4 text-neutral-700 tabular-nums text-xs">
                        <div>
                          <span className="font-semibold text-neutral-900 block">
                            {formatToman(reg.plan.totalAmount || reg.amount)}
                          </span>
                          <span className="text-[10px] text-neutral-400 block mt-0.5">
                            {reg.plan.months === 0 ? 'تسویه نقدی کامل' : `دفترچه ${toPersianDigits(reg.plan.months)} ماهه`}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {reg.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleApprove(reg.id)}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="تأیید پذیرش"
                            >
                              <IconCheck size={15} />
                            </button>
                          )}
                          {reg.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleReject(reg.id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                              title="لغو ثبت‌نام"
                            >
                              <IconClose size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedDossierRegId(reg.id)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                            title="مشاهده پرونده کامل، ویرایش و مدیریت اقساط"
                          >
                            <IconArrowUpRight size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ME-3: Pagination footer — makes it explicit that more rows exist */}
        {filteredRegistrations.length > TABLE_PAGE_SIZE && (
          <div className="px-4 sm:px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <span className="text-[11px] text-neutral-500 tabular-nums">
              نمایش {toPersianDigits(rangeStart)} تا {toPersianDigits(rangeEnd)} از{' '}
              {toPersianDigits(filteredRegistrations.length)} پرونده
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTablePage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                title="صفحه قبلی"
                className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {/* RTL: «next page» visually points left, «previous» points right */}
                <IconChevronRight size={15} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTablePage(i)}
                  aria-current={i === safePage ? 'page' : undefined}
                  className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold tabular-nums border transition-colors ${
                    i === safePage
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {toPersianDigits(i + 1)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTablePage(Math.min(totalPages - 1, safePage + 1))}
                disabled={safePage >= totalPages - 1}
                title="صفحه بعدی"
                className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <IconChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={handleViewAllRegistrations}
                className="mr-2 px-3 h-7 rounded-lg text-[11px] font-semibold text-neutral-700 border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors flex items-center gap-1"
                title="بدون صفحه‌بندی، همه را در صفحه ثبت‌نام ببینید"
              >
                مشاهده همه
                <IconArrowUpRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Lower Section: 7-Day Trend Chart & Grade Distribution Donut       */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Trend (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/70 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-heading font-bold text-neutral-900">
                  روند هفتگی پذیرش دانش‌آموزان
                </h2>
                <InfoTooltip
                  title="نمودار روند پذیرش"
                  content="نمودار ستونی تعداد ثبت‌نام‌های انجام شده در ۷ روز گذشته جهت تحلیل تقاضای داوطلبان تیزهوشان."
                />
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                بررسی روزانه پرونده‌های ارسال‌شده در طول هفته اخیر
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
              سامانه آنلاین و فعال
            </span>
          </div>

          <div className="h-56 flex items-end justify-between gap-3 pt-6 px-2">
            {chartDays.map((item, idx) => {
              const heightPercent = Math.max(12, Math.round((item.count / maxChartCount) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="text-xs font-bold text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                    {toPersianDigits(item.count)}
                  </span>
                  <div className="w-full max-w-[36px] bg-neutral-100 rounded-t-xl overflow-hidden flex items-end h-40">
                    <div
                      className="w-full bg-neutral-900 group-hover:bg-[#EA580C] rounded-t-xl transition-all duration-300"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-semibold text-neutral-800">{item.day}</div>
                    <div className="text-[10px] text-neutral-400">{item.date}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grade Distribution Donut Chart (1 column) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/70 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-heading font-bold text-neutral-900">
                توزیع پایه‌های تحصیلی
              </h2>
              <InfoTooltip
                title="توزیع پایه‌های تحصیلی"
                content="نمایش درصد و تعداد دانش‌آموزان ثبت‌نام شده در مقاطع ششم، هفتم، هشتم و نهم تیزهوشان."
              />
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">درصد دانش‌آموزان هر پایه از کل پذیرش‌ها</p>
          </div>

          {/* Donut representation */}
          <div className="py-4 flex items-center justify-center">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90 transform">
                {donutSegments.map((seg, i) => {
                  const dashArray = `${seg.percent} ${100 - seg.percent}`;
                  let offset = 0;
                  for (let j = 0; j < i; j++) {
                    offset += donutSegments[j].percent;
                  }
                  return (
                    <circle
                      key={seg.grade}
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="3.6"
                      strokeDasharray={dashArray}
                      strokeDashoffset={-offset}
                      className="transition-all duration-500"
                    />
                  );
                })}
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-bold text-neutral-900 tabular-nums">
                  {toPersianDigits(state.students.length)}
                </span>
                <span className="block text-[11px] text-neutral-400">دانش‌آموز</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 text-xs">
            {donutSegments.map((seg) => (
              <div key={seg.grade} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-neutral-600 font-medium">پایه {seg.grade}:</span>
                <span className="text-neutral-900 font-bold tabular-nums">{toPersianDigits(seg.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Instant Fast Dossier & Quick Edit Modal right in Dashboard */}
      {selectedDossierRegId && (
        <StudentDossierModal
          registrationId={selectedDossierRegId}
          onClose={() => setSelectedDossierRegId(null)}
        />
      )}
    </div>
  );
};
