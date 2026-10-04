/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from './store';
import {
  toPersianDigits,
  formatToman,
  formatNumber,
  isOverdue,
  daysOverdue,
  getTodayJalali,
  jalaliToDate,
} from './utils';
import { DateRangePicker, JalaliDateRange } from './DateRangePicker';
import { ProgressBar, useToast, Avatar, InfoTooltip } from './ui';
import { PaymentDateModal } from './components/PaymentDateModal';
import { StudentDossierModal } from './components/StudentDossierModal';
import { WooCsvImportModal } from './components/WooCsvImportModal';
import {
  IconFinance,
  IconAlert,
  IconCheck,
  IconSearch,
  IconCalendar,
  IconRefresh,
} from './icons';
import { FileText, UserCheck, Phone, CreditCard, FileSpreadsheet } from 'lucide-react';
import { PaymentPlanManager } from './PaymentPlanManager';

interface FlatInstallment {
  regId: string;
  code: string;
  studentId: string;
  classId: string;
  instId: string;
  title: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  isOverdue: boolean;
  delayDays: number;
}

export interface FinanceProps {
  initialFilters?: {
    status?: 'all' | 'overdue' | 'upcoming' | 'paid';
    q?: string;
    targetInstId?: string;
    regId?: string;
    openStudentId?: string;
  };
  onNavigate?: (view: any, filters?: any) => void;
}

export const Finance: React.FC<FinanceProps> = ({ initialFilters, onNavigate }) => {
  const { state, dispatch, getStudentById, getClassById } = useAppStore();
  const { showToast } = useToast();

  const [activeFinanceTab, setActiveFinanceTab] = useState<'ledger' | 'plans'>('ledger');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'upcoming' | 'paid'>('all');
  const [dateRange, setDateRange] = useState<JalaliDateRange>({ preset: 'all' });
  const [paymentModalItem, setPaymentModalItem] = useState<FlatInstallment | null>(null);
  const [selectedDossier, setSelectedDossier] = useState<{ studentId: string; regId?: string } | null>(null);
  const [isWooImportOpen, setIsWooImportOpen] = useState(false);


  // Flatten all installments across active registrations
  const allInstallments: FlatInstallment[] = [];
  let totalContractValue = 0;
  let totalCollected = 0;
  let totalOverdueAmount = 0;
  let overdueCount = 0;

  state.registrations.forEach((reg) => {
    if (reg.status === 'cancelled') return;
    reg.plan.installments.forEach((inst) => {
      const overdue = isOverdue(inst.dueDate, inst.paidAt);
      const delay = overdue ? daysOverdue(inst.dueDate) : 0;

      totalContractValue += inst.amount;
      if (inst.paidAt) {
        totalCollected += inst.amount;
      } else if (overdue) {
        totalOverdueAmount += inst.amount;
        overdueCount += 1;
      }

      allInstallments.push({
        regId: reg.id,
        code: reg.code,
        studentId: reg.studentId,
        classId: reg.classId,
        instId: inst.id,
        title: inst.title,
        amount: inst.amount,
        dueDate: inst.dueDate,
        paidAt: inst.paidAt,
        isOverdue: overdue,
        delayDays: delay,
      });
    });
  });

  const remainingCollectible = Math.max(0, totalContractValue - totalCollected);
  const collectionPercentage =
    totalContractValue > 0 ? Math.round((totalCollected / totalContractValue) * 100) : 0;

  // Handle incoming deep-link action from notifications or dashboard
  useEffect(() => {
    if (!initialFilters) return;
    if (initialFilters.status) {
      setStatusFilter(initialFilters.status);
    }
    if (initialFilters.q) {
      setSearchTerm(initialFilters.q);
    }
    if (initialFilters.targetInstId && initialFilters.regId) {
      const match = allInstallments.find(
        (i) => i.instId === initialFilters.targetInstId && i.regId === initialFilters.regId
      );
      if (match && !match.paidAt) {
        setPaymentModalItem(match);
      }
    }
    if (initialFilters.openStudentId) {
      setSelectedDossier({
        studentId: initialFilters.openStudentId,
        regId: initialFilters.regId,
      });
    }
  }, [initialFilters]);

  // Filter installments
  const filteredInstallments = allInstallments
    .filter((item) => {
      // Status filter
      if (statusFilter === 'overdue' && !item.isOverdue) return false;
      if (statusFilter === 'upcoming' && (item.paidAt || item.isOverdue)) return false;
      if (statusFilter === 'paid' && !item.paidAt) return false;

      // Date range filter
      if (dateRange.preset !== 'all' && dateRange.startDate && dateRange.endDate) {
        if (item.dueDate < dateRange.startDate || item.dueDate > dateRange.endDate) {
          return false;
        }
      }

      // Search term
      if (searchTerm) {
        const term = searchTerm.trim().toLowerCase();
        const student = getStudentById(item.studentId);
        const classRoom = getClassById(item.classId);
        const studentName = student ? `${student.firstName} ${student.lastName}`.toLowerCase() : '';
        const className = classRoom ? classRoom.name.toLowerCase() : '';
        const matchesCode = item.code.toLowerCase().includes(term);

        if (!studentName.includes(term) && !className.includes(term) && !matchesCode) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // Prioritize overdue items first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Then by due date ascending
      return a.dueDate.localeCompare(b.dueDate);
    });

  // Handle payment action (record payment with Jalali date or refund)
  const handleTogglePayment = (item: FlatInstallment) => {
    if (item.paidAt) {
      dispatch({ type: 'REFUND_INSTALLMENT', payload: { regId: item.regId, instId: item.instId } });
      showToast('وضعیت قسط به پرداخت‌نشده تغییر یافت', 'info');
    } else {
      setPaymentModalItem(item);

    }
  };

  // HI-4: shared modal component owns the payment date; this is the confirm handler
  const handleConfirmPayment = (paidAt: string) => {
    if (!paymentModalItem) return;
    dispatch({
      type: 'MARK_INSTALLMENT_PAID',
      payload: {
        regId: paymentModalItem.regId,
        instId: paymentModalItem.instId,
        paidAt: paidAt || getTodayJalali(),
      },
    });
    showToast('وصول قسط با تاریخ شمسی انتخابی ثبت شد', 'success');
    setPaymentModalItem(null);
  };

  // 6-Month Collection Trend Mock Data
  const monthlyTrend = [
    { month: 'اردیبهشت', target: 45000000, collected: 42000000 },
    { month: 'خرداد', target: 55000000, collected: 51000000 },
    { month: 'تیر', target: 70000000, collected: 68000000 },
    { month: 'مرداد', target: 95000000, collected: 90000000 },
    { month: 'شهریور', target: 130000000, collected: 122000000 },
    { month: 'مهر', target: 110000000, collected: 85000000 },
  ];
  const maxMonthlyTarget = Math.max(...monthlyTrend.map((m) => m.target));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-[#162E6E]">امور مالی و دفترچه اقساط</h2>
            <InfoTooltip
              title="سامانه جامع مالی آموزشگاه"
              content="پایش اقساط سررسید شده، ثبت تسویه‌حساب‌های اولیا، محاسبه کارمزد پلن‌های اقساطی و پیگیری مطالبات معوق."
            />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            پایش وصولی‌ها، سررسید اقساط شهریه و پیگیری معوقات مالی
          </p>
        </div>

        {/* Actions & Tab switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsWooImportOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded-full hover:bg-indigo-100 transition-colors shadow-2xs"
            title="همگام‌سازی و تحلیل سفارشات و اقساط فایل خروجی ووکامرس"
          >
            <FileSpreadsheet size={14} className="text-indigo-600" />
            <span>ورود سفارشات ووکامرس (CSV)</span>
          </button>

          <div className="flex items-center gap-1 p-1 bg-neutral-100/80 rounded-full shrink-0">
            <button
              type="button"
              onClick={() => setActiveFinanceTab('ledger')}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                activeFinanceTab === 'ledger'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <IconFinance size={14} className={activeFinanceTab === 'ledger' ? 'text-neutral-900' : 'text-neutral-400'} />
              <span>دفترچه اقساط</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFinanceTab('plans')}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                activeFinanceTab === 'plans'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <span>پلن‌های پرداخت</span>
            </button>
          </div>
        </div>
      </div>

      {activeFinanceTab === 'plans' ? (
        <PaymentPlanManager />
      ) : (
        <>
          {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Contract */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-neutral-500 font-bold">ارزش قراردادها</span>
                <InfoTooltip
                  title="مجموع تعهدات شهریه"
                  content={`مجموع ارزش کل قراردادهای آموزشی ثبت‌شده در سال تحصیلی معادل ${formatToman(totalContractValue)} در قالب ${toPersianDigits(allInstallments.length)} قسط و پیش‌پرداخت است.`}
                />
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">مجموع شهریه‌های دوره جاری</p>
              <div className="text-2xl font-bold text-neutral-900 mt-1.5 tabular-nums">
                {formatToman(totalContractValue)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
              <IconFinance size={20} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
            <span>تعداد کل اقساط:</span>
            <span className="tabular-nums font-semibold">{toPersianDigits(allInstallments.length)} قسط</span>
          </div>
        </div>

        {/* Card 2: Collected */}
        <div className="bg-[#FBFDFC] rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-bold">مجموع وصول شده</span>
                <InfoTooltip
                  title="دریافتی‌های قطعی"
                  content={`مجموع وجوه وصول‌شده شامل تسویه‌های نقدی و اقساط پرداخت‌شده معادل ${formatToman(totalCollected)} بوده و نشان‌دهنده تحقق ${toPersianDigits(collectionPercentage)} درصدی تعهدات است.`}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">دریافتی‌های نقدی و اقساطی</p>
              <div className="text-2xl font-bold text-[#0E7C5B] mt-1.5 tabular-nums leading-tight">
                {formatToman(totalCollected)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0E7C5B] flex items-center justify-center shrink-0">
              <IconCheck size={20} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
            <ProgressBar current={totalCollected} max={totalContractValue} colorClass="bg-[#0E7C5B]" showText={false} />
            <div className="flex justify-between text-[11px] text-slate-500 tabular-nums">
              <span>درصد تحقق:</span>
              <span className="font-bold text-[#0E7C5B]">{toPersianDigits(collectionPercentage)}٪</span>
            </div>
          </div>
        </div>

        {/* Card 3: Remaining Collectible */}
        <div className="bg-[#FBFDFC] rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-bold">مانده قابل وصول</span>
                <InfoTooltip
                  title="اقساط آتی در دست وصول"
                  content={`مبلغ ${formatToman(remainingCollectible)} شامل اقساطی است که موعد سررسید آن‌ها هنوز نرسیده و در ماه‌های آتی بر اساس تقویم مالی وصول خواهند شد.`}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">اقساط آتی در نوبت سررسید</p>
              <div className="text-2xl font-bold text-[#3E7CB1] mt-1.5 tabular-nums">
                {formatToman(remainingCollectible)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#3E7CB1] flex items-center justify-center shrink-0">
              <IconCalendar size={20} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
            <span>در حال وصول ماهانه:</span>
            <span className="tabular-nums font-semibold text-sky-800">
              {toPersianDigits(allInstallments.filter((i) => !i.paidAt && !i.isOverdue).length)} قسط در راه
            </span>
          </div>
        </div>

        {/* Card 4: Overdue Alert */}
        <div className="bg-[#FBFDFC] rounded-2xl p-4 sm:p-5 border border-red-200 shadow-xs flex flex-col justify-between bg-linear-to-b from-white to-red-50/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#D64545] font-bold">معوقات سررسید گذشته</span>
                <InfoTooltip
                  title="اقساط نیازمند پیگیری تلفنی"
                  content={`تعداد ${toPersianDigits(overdueCount)} قسط با ارزش کل ${formatToman(totalOverdueAmount)} تاریخ سررسید آن‌ها سپری شده و پرداخت نشده است.`}
                />
              </div>
              <p className="text-[11px] text-red-500/80 mt-0.5">اقساط پرداخت نشده نیازمند پیگیری</p>
              <div className="text-2xl font-bold text-[#D64545] mt-1.5 tabular-nums">
                {formatToman(totalOverdueAmount)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 text-[#D64545] flex items-center justify-center shrink-0">
              <IconAlert size={20} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-red-100 text-xs flex justify-between items-center text-[#D64545]">
            <span>نیازمند تماس با ولی:</span>
            <span className="tabular-nums font-bold">{toPersianDigits(overdueCount)} قسط معوق</span>
          </div>
        </div>
      </div>


      {/* 6-Month Trend & Course Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Bar Chart */}
        <div className="lg:col-span-2 bg-[#FBFDFC] rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-heading text-[#0A3528]">نمودار روند وصولی ۶ ماه اخیر</h2>
              <p className="text-xs text-slate-500">مقایسه هدف مالی قراردادها با مبالغ وصول‌شده نقدی و اقساطی</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-200" />
                <span className="text-slate-600">تعهد قرارداد</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0E7C5B]" />
                <span className="text-slate-600">وصول‌شده</span>
              </div>
            </div>
          </div>

          <div className="h-56 flex items-end justify-between gap-4 pt-6 px-3">
            {monthlyTrend.map((item, idx) => {
              const targetHeight = Math.round((item.target / maxMonthlyTarget) * 100);
              const collectedHeight = Math.round((item.collected / maxMonthlyTarget) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1.5 h-40">
                    <div
                      className="w-4 bg-slate-200 rounded-t-md transition-all duration-300"
                      style={{ height: `${targetHeight}%` }}
                      title={`هدف: ${formatToman(item.target)}`}
                    />
                    <div
                      className="w-4 bg-[#0E7C5B] group-hover:bg-[#0A3528] rounded-t-md transition-all duration-300"
                      style={{ height: `${collectedHeight}%` }}
                      title={`وصول: ${formatToman(item.collected)}`}
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700">{item.month}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Course-by-Course Financial Progress */}
        <div className="bg-[#FBFDFC] rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-heading text-[#0A3528]">پیشرفت مالی هر دوره</h2>
            <p className="text-xs text-slate-500 mb-4">درصد وصولی شهریه کلاس‌های مختلف</p>

            <div className="space-y-4">
              {state.classes.slice(0, 4).map((cls) => {
                let clsTotal = 0;
                let clsPaid = 0;

                state.registrations.forEach((r) => {
                  if (r.classId === cls.id && r.status !== 'cancelled') {
                    r.plan.installments.forEach((i) => {
                      clsTotal += i.amount;
                      if (i.paidAt) clsPaid += i.amount;
                    });
                  }
                });

                const pct = clsTotal > 0 ? Math.round((clsPaid / clsTotal) * 100) : 0;

                return (
                  <div key={cls.id} className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-semibold truncate max-w-[170px]">{cls.name}</span>
                      <span className="font-mono text-emerald-800 font-bold">{toPersianDigits(pct)}٪</span>
                    </div>
                    <ProgressBar current={clsPaid} max={clsTotal} colorClass="bg-[#0E7C5B]" showText={false} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
            سیستم وصول اقساط از طریق درگاه و پیگیری تلفنی فعال است.
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Installment Ledger (دفترچه اقساط بازطراحی شده)                   */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-heading text-[#0A3528]">دفترچه جامع اقساط دانش‌آموزان</h3>
            <p className="text-xs text-slate-500">
              لیست کامل سررسیدها با اولویت‌بندی معوقات، پیگیری پرداخت و فیلترهای زمانی
            </p>
          </div>

          {/* Date range picker */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-[#FBFDFC] p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <IconSearch
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو بر اساس نام دانش‌آموز، عنوان دوره یا کد ثبت‌نام..."
              className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white transition-all"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {(
              [
                { id: 'all', label: 'همه اقساط' },
                { id: 'overdue', label: 'معوقات سررسید گذشته' },
                { id: 'upcoming', label: 'در راه و آتی' },
                { id: 'paid', label: 'تسویه شده' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#0A3528] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Installments Table */}
        <div className="bg-[#FBFDFC] rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F4F7F5] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">دانش‌آموز</th>
                  <th className="py-3 px-4 font-semibold">دوره و کد</th>
                  <th className="py-3 px-4 font-semibold">عنوان قسط</th>
                  <th className="py-3 px-4 font-semibold">مبلغ قسط</th>
                  <th className="py-3 px-4 font-semibold">تاریخ سررسید</th>
                  <th className="py-3 px-4 font-semibold">وضعیت وصول</th>
                  <th className="py-3 px-4 font-semibold text-center">عملیات مالی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInstallments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      هیچ قسطی با این شرایط فیلتر یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredInstallments.map((item) => {
                    const student = getStudentById(item.studentId);
                    const classRoom = getClassById(item.classId);

                    return (
                      <tr
                        key={`${item.regId}-${item.instId}`}
                        className={`transition-colors hover:bg-slate-50/70 ${
                          item.isOverdue ? 'bg-red-50/30' : ''
                        }`}
                      >
                        {/* Student Info (Clickable for Financial & Contact Dossier) */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedDossier({ studentId: item.studentId, regId: item.regId })}
                            className="flex items-center gap-2.5 text-right w-full p-1.5 -m-1.5 rounded-xl transition-all hover:bg-emerald-50/80 group cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#0E7C5B]/30"
                            title="کلیک برای مشاهده و ویرایش پرونده مالی و مشخصات ارتباطی دانش‌آموز"
                          >
                            <Avatar
                              name={student ? `${student.firstName} ${student.lastName}` : 'د'}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-800 group-hover:text-[#0E7C5B] transition-colors flex items-center gap-1.5">
                                <span className="truncate">{student ? `${student.firstName} ${student.lastName}` : 'نامشخص'}</span>
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-100/90 text-[#0A3528] rounded-md font-bold transition-colors shrink-0">
                                  پرونده مالی (اقساط و تسویه)
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                <span dir="ltr">
                                  {student?.phones?.[0]?.number
                                    ? toPersianDigits(student.phones[0].number)
                                    : '---'}
                                </span>
                                {student?.grade && <span>• پایه {student.grade}</span>}
                              </div>
                            </div>
                          </button>
                        </td>

                        {/* Course & Reg Code */}
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium truncate max-w-[160px]">
                            {classRoom?.name || 'کلاس نامشخص'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            کد ثبت‌نام: {item.code}
                          </div>
                        </td>

                        {/* Title */}
                        <td className="py-3 px-4 font-medium text-slate-700">{item.title}</td>

                        {/* Amount */}
                        <td className="py-3 px-4 font-bold text-[#0A3528]">
                          {formatToman(item.amount)}
                        </td>

                        {/* Due Date */}
                        <td className="py-3 px-4 text-slate-700">
                          {toPersianDigits(item.dueDate)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {item.paidAt ? (
                            <span className="text-[#0E7C5B] font-medium">
                              پرداخت در {toPersianDigits(item.paidAt)}
                            </span>
                          ) : item.isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-[#D64545] font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                              <IconAlert size={12} />
                              <span>{toPersianDigits(item.delayDays)} روز تأخیر</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium">سررسید آتی</span>
                          )}
                        </td>

                        {/* Action: Record Payment / Refund + Open Dossier */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTogglePayment(item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                item.paidAt
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-[#0E7C5B] hover:bg-[#0A3528] text-white shadow-xs'
                              }`}
                            >
                              {item.paidAt ? 'عودت پرداخت' : 'ثبت پرداخت'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedDossier({ studentId: item.studentId, regId: item.regId })}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="مشاهده پرونده مالی (اقساط و تسویه)"
                            >
                              <CreditCard size={13} />
                              <span>پرونده مالی (اقساط و تسویه)</span>
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
        </div>
      </div>
      </>
      )}

      {/* HI-4: Record Payment with Jalali Date — shared modal (same as receipt in Registrations) */}
      {paymentModalItem && (
        <PaymentDateModal
          isOpen={Boolean(paymentModalItem)}
          onClose={() => setPaymentModalItem(null)}
          studentName={
            getStudentById(paymentModalItem.studentId)
              ? `${getStudentById(paymentModalItem.studentId)?.firstName} ${getStudentById(
                  paymentModalItem.studentId
                )?.lastName}`
              : 'نامشخص'
          }
          installmentTitle={paymentModalItem.title}
          amount={paymentModalItem.amount}
          dueDate={paymentModalItem.dueDate}
          onConfirm={handleConfirmPayment}
        />
      )}

      {/* Financial Dossier & Contact Profile Modal */}
      {selectedDossier && (
        <StudentDossierModal
          studentId={selectedDossier.studentId}
          registrationId={selectedDossier.regId}
          mode="financial"
          onClose={() => setSelectedDossier(null)}
          onNavigate={onNavigate}
        />
      )}

      {/* WooCommerce CSV Sync Modal */}
      <WooCsvImportModal
        isOpen={isWooImportOpen}
        onClose={() => setIsWooImportOpen(false)}
      />
    </div>
  );
};
