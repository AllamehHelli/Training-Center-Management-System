/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore, ARCHIVED_READONLY_MESSAGE } from './store';
import { useFieldSettings } from './Settings';
import {
  toPersianDigits,
  toEnglishDigits,
  formatToman,
  formatNumber,
  getTodayJalali,
  formatJalaliHuman,
  buildPlan,
  buildPlanFromTemplate,
  downloadCSV,
  isOverdue,
  daysOverdue,
} from './utils';
import { Registration, RegistrationStatus, PaymentPlan, PaymentPlanTemplate } from './types';
import { Modal, ConfirmModal, Avatar, ProgressBar, useToast, InfoTooltip } from './ui';
import {
  IconPlus,
  IconSearch,
  IconPrinter,
  IconDownload,
  IconCheck,
  IconClose,
  IconAlert,
  IconPhone,
  IconCalendar,
  IconArrowUpRight,
} from './icons';
import { LogoHelli } from './Logo';
import { JalaliDatePicker } from './JalaliDatePicker';
import { PaymentDateModal } from './components/PaymentDateModal';
import { StudentDossierModal } from './components/StudentDossierModal';

interface RegistrationsProps {
  /** ME-3: filters carried over from the dashboard "view all" action. */
  initialFilters?: Record<string, string>;
  onNavigate?: (view: any, filters?: any) => void;
}

export const Registrations: React.FC<RegistrationsProps> = ({ initialFilters, onNavigate }) => {
  const {
    state,
    dispatch,
    getStudentById,
    getClassById,
    getSessionById,
    getSessionRemainingCapacity,
    getSessionEnrolledCount,
    isViewingArchived,
  } = useAppStore();
  const { showToast } = useToast();

  // Filters & Search
  // ME-3: seed the filters from the dashboard "view all" hand-off so the user
  // sees exactly the same result set, unpaginated.
  const [searchTerm, setSearchTerm] = useState(initialFilters?.q ?? '');
  const [statusFilter, setStatusFilter] = useState<'all' | RegistrationStatus>(
    initialFilters?.status === 'approved' ||
      initialFilters?.status === 'pending' ||
      initialFilters?.status === 'cancelled'
      ? initialFilters.status
      : 'all'
  );

  // ME-3: apply a new filter hand-off even when the page is already mounted.
  useEffect(() => {
    if (!initialFilters) return;
    setSearchTerm(initialFilters.q ?? '');
    if (
      initialFilters.status === 'approved' ||
      initialFilters.status === 'pending' ||
      initialFilters.status === 'cancelled'
    ) {
      setStatusFilter(initialFilters.status);
    } else {
      setStatusFilter('all');
    }
    if (initialFilters.openDossierRegId) {
      setSelectedDossierRegId(initialFilters.openDossierRegId);
    }
  }, [initialFilters]);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  // HI-4: store only the id; the receipt object is derived from state on every
  // render so it always reflects the latest payments (no stale closure/setTimeout).
  const [receiptRegistrationId, setReceiptRegistrationId] = useState<string | null>(null);
  const receiptRegistration = receiptRegistrationId
    ? state.registrations.find((r) => r.id === receiptRegistrationId) ?? null
    : null;
  // HI-4: pending installment payment initiated from the receipt (shared modal with Finance page)
  const [pendingReceiptPayment, setPendingReceiptPayment] = useState<{
    regId: string;
    instId: string;
    title: string;
    amount: number;
    dueDate: string;
    studentName: string;
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedDossierRegId, setSelectedDossierRegId] = useState<string | null>(null);

  // Form State for New Registration
  const { paymentPlans } = useFieldSettings();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-cash');
  const [isCustomPlan, setIsCustomPlan] = useState(false);
  const [customDownPaymentPct, setCustomDownPaymentPct] = useState(35);
  const [customFeePct, setCustomFeePct] = useState(7);
  const [customIntervalMonths, setCustomIntervalMonths] = useState(2);
  const [customInstallmentsCount, setCustomInstallmentsCount] = useState(2);
  const [registrationDate, setRegistrationDate] = useState<string>(getTodayJalali());
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Selected class & session helpers for form
  const selectedClass = getClassById(selectedClassId);
  const currentTuition = selectedClass?.tuition || 0;
  const netTuition = Math.max(0, currentTuition - discountAmount);

  // Custom template constructed dynamically
  const customTemplate: PaymentPlanTemplate = {
    id: 'custom-template',
    title: `پلن سفارشی (${toPersianDigits(customFeePct)}٪ کارمزد - بیعانه ${toPersianDigits(customDownPaymentPct)}٪)`,
    feePercent: customFeePct,
    downPaymentPercent: customDownPaymentPct,
    intervalMonths: customIntervalMonths,
    installmentsCount: customInstallmentsCount,
    installmentsConfig: Array.from({ length: customInstallmentsCount }, (_, idx) => {
      const remainingPct = Math.max(0, 100 + customFeePct - customDownPaymentPct);
      const equalShare = Number((remainingPct / customInstallmentsCount).toFixed(2));
      const isLast = idx === customInstallmentsCount - 1;
      const share = isLast
        ? Number((remainingPct - equalShare * (customInstallmentsCount - 1)).toFixed(2))
        : equalShare;
      const offset = (idx + 1) * customIntervalMonths;
      return {
        id: `custom-cfg-${idx + 1}`,
        title: `قسط ${toPersianDigits(idx + 1)} (ماه ${toPersianDigits(offset)})`,
        percent: share,
        dueMonthOffset: offset,
      };
    }),
  };

  const activeTemplate: PaymentPlanTemplate = isCustomPlan
    ? customTemplate
    : paymentPlans.find((p) => p.id === selectedPlanId) || paymentPlans[0] || customTemplate;

  // Live computed preview plan using active template and selected Jalali date
  const previewPlan: PaymentPlan = buildPlanFromTemplate(
    activeTemplate,
    currentTuition,
    discountAmount,
    registrationDate
  );

  // Filter registrations
  const filteredRegistrations = state.registrations.filter((reg) => {
    if (statusFilter !== 'all' && reg.status !== statusFilter) return false;
    if (!searchTerm) return true;

    const term = searchTerm.trim().toLowerCase();
    const student = getStudentById(reg.studentId);
    const classRoom = getClassById(reg.classId);

    const matchesName = student
      ? `${student.firstName} ${student.lastName}`.toLowerCase().includes(term)
      : false;
    const matchesCode = reg.code.toLowerCase().includes(term);
    const matchesClass = classRoom ? classRoom.name.toLowerCase().includes(term) : false;
    const matchesPhone = student
      ? student.phones.some((p) => p.number.includes(toEnglishDigits(term)))
      : false;

    return matchesName || matchesCode || matchesClass || matchesPhone;
  });

  // Handle opening New Registration Modal
  const openNewRegistration = () => {
    const firstStudent = state.students[0]?.id || '';
    const firstClass = state.classes[0]?.id || '';
    const firstSession = state.classes[0]?.sessions[0]?.id || '';

    setSelectedStudentId(firstStudent);
    setSelectedClassId(firstClass);
    setSelectedSessionId(firstSession);
    setDiscountAmount(0);
    setSelectedPlanId(paymentPlans[1]?.id || paymentPlans[0]?.id || 'plan-cash');
    setIsCustomPlan(false);
    setCustomDownPaymentPct(35);
    setCustomFeePct(7);
    setCustomIntervalMonths(2);
    setCustomInstallmentsCount(2);
    setRegistrationDate(getTodayJalali());
    setNotes('');
    setFormError('');
    setIsNewModalOpen(true);
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    const cls = getClassById(classId);
    if (cls && cls.sessions.length > 0) {
      setSelectedSessionId(cls.sessions[0].id);
    } else {
      setSelectedSessionId('');
    }
  };

  const handleSubmitNewRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedStudentId) {
      setFormError('لطفاً دانش‌آموز را انتخاب کنید');
      return;
    }
    if (!selectedClassId) {
      setFormError('لطفاً کلاس را انتخاب کنید');
      return;
    }
    if (!selectedSessionId) {
      setFormError('لطفاً زنگ برگزاری را انتخاب کنید');
      return;
    }

    // Check capacity
    const remaining = getSessionRemainingCapacity(selectedClassId, selectedSessionId);
    if (remaining <= 0) {
      setFormError('ظرفیت این زنگ تکمیل شده است. لطفاً زنگ دیگری را انتخاب فرمایید.');
      return;
    }

    // Check duplicate registration in same session
    const existing = state.registrations.find(
      (r) =>
        r.studentId === selectedStudentId &&
        r.classId === selectedClassId &&
        r.sessionId === selectedSessionId &&
        r.status !== 'cancelled'
    );
    if (existing) {
      setFormError('این دانش‌آموز قبلاً در این زنگ ثبت‌نام شده است.');
      return;
    }

    const newCode = `T-${101 + state.registrations.length}`;
    const newReg: Registration = {
      id: `reg-${Date.now()}`,
      code: newCode,
      studentId: selectedStudentId,
      classId: selectedClassId,
      sessionId: selectedSessionId,
      status: 'approved',
      amount: previewPlan.totalAmount || netTuition,
      discount: discountAmount,
      plan: previewPlan,
      date: registrationDate || getTodayJalali(),
      notes: notes.trim(),
    };

    dispatch({ type: 'ADD_REGISTRATION', payload: newReg });
    showToast(`ثبت‌نام جدید با کد پیگیری ${newCode} با موفقیت ثبت شد`, 'success');
    setIsNewModalOpen(false);
    setReceiptRegistrationId(newReg.id);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'کد پیگیری',
      'نام دانش‌آموز',
      'کد ملی',
      'دوره',
      'زنگ برگزاری',
      'شهریه نهایی (تومان)',
      'تخفیف',
      'نوع پرداخت',
      'وضعیت',
      'تاریخ ثبت',
    ];

    const rows = state.registrations.map((reg) => {
      const student = getStudentById(reg.studentId);
      const classRoom = getClassById(reg.classId);
      const session = classRoom?.sessions.find((s) => s.id === reg.sessionId);
      const studentName = student ? `${student.firstName} ${student.lastName}` : '';
      const nid = student?.nationalId || '';
      const statusFa =
        reg.status === 'approved' ? 'تأیید شده' : reg.status === 'pending' ? 'در انتظار' : 'لغو شده';
      const planFa = reg.plan.months === 0 ? 'نقدی' : `${reg.plan.months} ماهه`;

      return [
        `"${reg.code}"`,
        `"${studentName}"`,
        `"${nid}"`,
        `"${classRoom?.name || ''}"`,
        `"${session?.label || ''}"`,
        `"${reg.amount}"`,
        `"${reg.discount}"`,
        `"${planFa}"`,
        `"${statusFa}"`,
        `"${reg.date}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadCSV(`registrations-${getTodayJalali().replace(/\//g, '-')}.csv`, csvContent);
    showToast('فایل اکسل (CSV) با موفقیت دانلود شد', 'info');
  };

  // Status Change
  const handleStatusChange = (id: string, status: RegistrationStatus) => {
    if (isViewingArchived) {
      showToast(ARCHIVED_READONLY_MESSAGE, 'error');
      return;
    }
    dispatch({ type: 'UPDATE_REGISTRATION_STATUS', payload: { id, status } });
    showToast(
      status === 'approved'
        ? 'ثبت‌نام تأیید شد'
        : status === 'cancelled'
        ? 'ثبت‌نام لغو شد'
        : 'به صف انتظار منتقل شد',
      status === 'approved' ? 'success' : 'info'
    );
  };

  // HI-4: Payment actions on the receipt. The receipt itself is derived from
  // state.registrations every render (see receiptRegistrationId), so no
  // setTimeout / stale-closure refresh is needed anymore.

  // Refund (un-pay) an installment directly from the receipt
  const handleReceiptRefund = (regId: string, instId: string) => {
    if (isViewingArchived) {
      showToast(ARCHIVED_READONLY_MESSAGE, 'error');
      return;
    }
    dispatch({ type: 'REFUND_INSTALLMENT', payload: { regId, instId } });
    showToast('پرداخت قسط عودت داده شد', 'info');
  };

  // Opening a payment asks for the Jalali payment date first (same modal as Finance page)
  const handleReceiptRequestPayment = (
    regId: string,
    inst: { id: string; title: string; amount: number; dueDate: string },
    studentName: string
  ) => {
    if (isViewingArchived) {
      showToast(ARCHIVED_READONLY_MESSAGE, 'error');
      return;
    }
    setPendingReceiptPayment({
      regId,
      instId: inst.id,
      title: inst.title,
      amount: inst.amount,
      dueDate: inst.dueDate,
      studentName,
    });
  };

  // Confirm the payment with the chosen date (dispatch paidAt, like Finance.tsx)
  const handleReceiptConfirmPayment = (paidAt: string) => {
    if (!pendingReceiptPayment) return;
    if (isViewingArchived) {
      showToast(ARCHIVED_READONLY_MESSAGE, 'error');
      setPendingReceiptPayment(null);
      return;
    }
    dispatch({
      type: 'MARK_INSTALLMENT_PAID',
      payload: {
        regId: pendingReceiptPayment.regId,
        instId: pendingReceiptPayment.instId,
        paidAt,
      },
    });
    showToast('پرداخت قسط با موفقیت ثبت شد', 'success');
    setPendingReceiptPayment(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-900">مدیریت ثبت‌نام‌ها و پذیرش</h2>
            <InfoTooltip
              title="سامانه پذیرش و ثبت‌نام آموزشگاه"
              content="فهرست جامع دانش‌آموزان پذیرش شده در دوره‌ها، وضعیت پرداخت، چاپ رسید فیش شهریه و ثبت پرونده جدید."
            />
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            فهرست پرونده‌های آموزشی و پیگیری اقساط دوره جاری آموزشگاه
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200/80 rounded-full hover:bg-neutral-50 transition-colors shadow-2xs"
          >
            <IconDownload size={14} />
            <span>خروجی اکسل</span>
          </button>
          <button
            type="button"
            onClick={openNewRegistration}
            disabled={isViewingArchived}
            title={isViewingArchived ? 'داده‌های بایگانی‌شده فقط‌خواندنی هستند' : undefined}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-full hover:bg-neutral-800 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-900"
          >
            <IconPlus size={15} />
            <span>ثبت‌نام جدید</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-neutral-200/70 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <IconSearch
            size={15}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در نام دانش‌آموز، کد پیگیری، نام دوره..."
            className="w-full pl-3.5 pr-9 py-2 text-xs bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white border border-neutral-200/80 rounded-full focus:outline-hidden transition-all"
          />
        </div>

        {/* Status segmented tabs */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 p-1 bg-neutral-100/80 rounded-full shrink-0">
            {(
              [
                { id: 'all', label: 'همه' },
                { id: 'approved', label: 'تأیید شده' },
                { id: 'pending', label: 'در انتظار' },
                { id: 'cancelled', label: 'لغو شده' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <InfoTooltip
            title="فیلتر وضعیت ثبت‌نام"
            content="فیلتر بر اساس تأیید شده (پذیرش قطعی)، در انتظار (نیازمند مدارک یا تسویه پیش‌پرداخت) یا لغو شده (انصراف)."
          />
        </div>
      </div>

      {/* Registrations Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/70 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-neutral-50/60 border-b border-neutral-100 text-neutral-400 font-medium">
              <tr>
                <th className="py-3 px-4 font-medium">کد پیگیری</th>
                <th className="py-3 px-4 font-medium">دانش‌آموز</th>
                <th className="py-3 px-4 font-medium">کلاس و زنگ انتخابی</th>
                <th className="py-3 px-4 font-medium">شهریه و تخفیف</th>
                <th className="py-3 px-4 font-medium">
                  <div className="inline-flex items-center gap-1">
                    <span>برنامه اقساط</span>
                    <InfoTooltip
                      title="پیگیری پرداخت اقساط"
                      content="نمایش تعداد اقساط تسویه شده در برابر کل اقساط، به همراه هشدارهای اقساط سررسید گذشته (نارنجی/قرمز)."
                    />
                  </div>
                </th>
                <th className="py-3 px-4 font-medium">
                  <div className="inline-flex items-center gap-1">
                    <span>وضعیت</span>
                    <InfoTooltip
                      title="وضعیت پذیرش دانش‌آموز"
                      content="تأیید شده: مدارک کامل و ثبت‌نام نهایی. در انتظار: نیازمند پرداخت یا تأیید نهایی آموزشگاه."
                    />
                  </div>
                </th>
                <th className="py-3 px-4 font-medium text-center">عملیات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    موردی با این مشخصات یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg) => {
                  const student = getStudentById(reg.studentId);
                  const classRoom = getClassById(reg.classId);
                  const session = classRoom?.sessions.find((s) => s.id === reg.sessionId);

                  // Calculate paid progress
                  const totalInst = reg.plan.installments.length;
                  const paidInst = reg.plan.installments.filter((i) => i.paidAt).length;
                  const hasOverdue = reg.plan.installments.some((i) => isOverdue(i.dueDate, i.paidAt));

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Code */}
                      <td className="py-3 px-4 font-bold text-[#0A3528]">{reg.code}</td>

                      {/* Student */}
                      <td className="py-3 px-4">
                        <div
                          className="flex items-center gap-2.5 cursor-pointer group/std"
                          onClick={() => setSelectedDossierRegId(reg.id)}
                          title="کلیک برای مشاهده پرونده کامل و ویرایش"
                        >
                          <Avatar
                            name={student ? `${student.firstName} ${student.lastName}` : 'ث'}
                            size="sm"
                          />
                          <div>
                            <div className="font-semibold text-slate-800 group-hover/std:text-blue-700 transition-colors">
                              {student ? `${student.firstName} ${student.lastName}` : 'نامشخص'}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {student?.phones?.[0]?.number
                                ? toPersianDigits(student.phones[0].number)
                                : 'بدون شماره'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Class & Session */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-medium text-slate-800 truncate">{classRoom?.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              session?.kind === 'even'
                                ? 'bg-[#0E7C5B]'
                                : session?.kind === 'odd'
                                ? 'bg-[#E9A13B]'
                                : 'bg-[#3E7CB1]'
                            }`}
                          />
                          <span className="truncate">{session?.label}</span>
                        </div>
                      </td>

                      {/* Tuition */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0A3528]">{formatToman(reg.amount)}</div>
                        {reg.discount > 0 && (
                          <div className="text-[10px] text-emerald-600 mt-0.5">
                            تخفیف: {formatToman(reg.discount)}
                          </div>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">
                            {reg.plan.months === 0
                              ? 'تسویه نقدی'
                              : `${toPersianDigits(paidInst)} از ${toPersianDigits(totalInst)} قسط`}
                          </span>
                          {hasOverdue && (
                            <span className="text-[10px] bg-red-50 text-[#D64545] border border-red-200 px-1.5 py-0.5 rounded-md font-medium">
                              معوق
                            </span>
                          )}
                        </div>
                        <div className="w-24 mt-1">
                          <ProgressBar
                            current={paidInst}
                            max={totalInst}
                            colorClass={hasOverdue ? 'bg-[#D64545]' : 'bg-[#0E7C5B]'}
                            showText={false}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {reg.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100/70">
                            <IconCheck size={13} />
                            <span>تأیید شده</span>
                          </span>
                        )}
                        {reg.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>در انتظار</span>
                          </span>
                        )}
                        {reg.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100/70">
                            <IconClose size={13} />
                            <span>لغو شده</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Receipt */}
                          <button
                            type="button"
                            onClick={() => setReceiptRegistrationId(reg.id)}
                            className="p-1.5 text-slate-600 hover:text-[#0E7C5B] hover:bg-emerald-50 rounded-lg transition-colors"
                            title="رسید و دفترچه اقساط"
                          >
                            <IconPrinter size={16} />
                          </button>

                          {/* Quick Approve if pending */}
                          {reg.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(reg.id, 'approved')}
                              className="p-1.5 text-[#0E7C5B] hover:bg-emerald-50 rounded-lg transition-colors"
                              title="تأیید ثبت‌نام"
                            >
                              <IconCheck size={16} />
                            </button>
                          )}

                          {/* Cancel if active */}
                          {reg.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(reg.id, 'cancelled')}
                              className="p-1.5 text-slate-400 hover:text-[#D64545] hover:bg-red-50 rounded-lg transition-colors"
                              title="لغو ثبت‌نام"
                            >
                              <IconClose size={16} />
                            </button>
                          )}

                          {/* Full Dossier Modal */}
                          <button
                            type="button"
                            onClick={() => setSelectedDossierRegId(reg.id)}
                            className="p-1.5 text-slate-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="مشاهده پرونده کامل، ویرایش و مدیریت اقساط"
                          >
                            <IconArrowUpRight size={16} />
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

      {/* ------------------------------------------------------------------ */}
      {/* Modal: New Registration                                            */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="فرم ثبت‌نام جدید در آموزشگاه تیزهوشان علامه حلی"
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitNewRegistration} className="space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-[#D64545] rounded-xl text-xs flex items-center gap-2">
              <IconAlert size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Student & Class selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Student */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                انتخاب دانش‌آموز <span className="text-[#D64545]">*</span>
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              >
                {state.students.map((std) => (
                  <option key={std.id} value={std.id}>
                    {std.firstName} {std.lastName} - کد ملی: {std.nationalId} (پایه {std.grade})
                  </option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                انتخاب دوره آموزشی <span className="text-[#D64545]">*</span>
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              >
                {state.classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} (پایه {cls.grade}) - شهریه: {formatToman(cls.tuition)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sessions selector with Remaining Capacity */}
          {selectedClass && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                انتخاب زنگ برگزاری (ظرفیت و زمان‌بندی) <span className="text-[#D64545]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedClass.sessions.map((ses) => {
                  const enrolled = getSessionEnrolledCount(selectedClass.id, ses.id);
                  const remaining = Math.max(0, ses.capacity - enrolled);
                  const isFull = remaining === 0;
                  const isSelected = selectedSessionId === ses.id;

                  return (
                    <div
                      key={ses.id}
                      onClick={() => !isFull && setSelectedSessionId(ses.id)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isFull
                          ? 'opacity-60 bg-slate-100 border-slate-200 cursor-not-allowed'
                          : isSelected
                          ? 'border-[#0E7C5B] bg-[#0E7C5B]/5 shadow-xs ring-1 ring-[#0E7C5B]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`font-semibold ${
                            ses.kind === 'even'
                              ? 'text-[#0E7C5B]'
                              : ses.kind === 'odd'
                              ? 'text-[#E9A13B]'
                              : 'text-[#3E7CB1]'
                          }`}
                        >
                          {ses.label}
                        </span>
                        {isSelected && <IconCheck size={16} className="text-[#0E7C5B]" />}
                      </div>
                      <div className="text-slate-600 text-[11px] mb-2 font-mono">
                        {ses.days} · ساعت {ses.time}
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className={isFull ? 'text-[#D64545] font-bold' : 'text-slate-500'}>
                          {isFull ? 'ظرفیت تکمیل' : `${toPersianDigits(remaining)} صندلی خالی`}
                        </span>
                        <span className="text-slate-400">
                          {toPersianDigits(enrolled)} / {toPersianDigits(ses.capacity)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Registration Date, Tuition & Discount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <JalaliDatePicker
                label="تاریخ ثبت‌نام و مبنای اقساط (شمسی)"
                value={registrationDate}
                onChange={(d) => setRegistrationDate(d || getTodayJalali())}
                clearable={false}
                required={true}
                showHumanPreview={true}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">شهریه پایه دوره</label>
              <div className="px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold font-mono">
                {formatToman(currentTuition)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">مبلغ تخفیف (تومان)</label>
              <input
                type="number"
                min="0"
                max={currentTuition}
                step="100000"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] font-mono"
              />
            </div>
          </div>

          {/* Payment Plan Selection & Calculation */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-[#0A3528]">برنامه تسویه مالی و شرایط اقساط</label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  انتخاب از الگوهای مالی تعریف‌شده موسسه یا تعیین کارمزد، بیعانه و سررسیدهای سفارشی
                </p>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-slate-200 rounded-lg text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCustomPlan(false)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    !isCustomPlan ? 'bg-white text-[#0A3528] font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  الگوهای موسسه ({toPersianDigits(paymentPlans.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomPlan(true)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    isCustomPlan ? 'bg-white text-[#0A3528] font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  پلن سفارشی / دستی
                </button>
              </div>
            </div>

            {!isCustomPlan ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {paymentPlans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    const totalPct = 100 + plan.feePercent;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-2 border-[#0E7C5B] bg-emerald-50/60 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? 'text-[#0A3528]' : 'text-slate-800'
                            }`}
                          >
                            {plan.title}
                          </span>
                          {isSelected && <IconCheck size={16} className="text-[#0E7C5B] shrink-0" />}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[11px]">
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-md">
                            بیعانه: {toPersianDigits(plan.downPaymentPercent)}٪
                          </span>
                          <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded-md">
                            {plan.feePercent === 0
                              ? 'بدون کارمزد'
                              : `سود: +${toPersianDigits(plan.feePercent)}٪`}
                          </span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-md">
                            مجموع: {toPersianDigits(totalPct)}٪
                          </span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded-md">
                            {plan.installmentsCount === 0
                              ? 'نقدی'
                              : `${toPersianDigits(plan.installmentsCount)} قسط`}
                          </span>
                        </div>
                        {plan.description && (
                          <p className="text-[10px] text-slate-400 mt-1.5 line-clamp-1">
                            {plan.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Custom Plan Config Inputs */
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-semibold text-slate-700">
                  تنظیم دستی بیعانه، سود/کارمزد و دوره‌های پرداخت:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">بیعانه اولیه نقدی</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customDownPaymentPct}
                        onChange={(e) => setCustomDownPaymentPct(Number(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-center"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ٪
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">درصد سود / کارمزد</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={customFeePct}
                        onChange={(e) => setCustomFeePct(Number(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-center"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ٪
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">فاصله اقساط</label>
                    <select
                      value={customIntervalMonths}
                      onChange={(e) => setCustomIntervalMonths(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                    >
                      <option value={1}>هر ۱ ماه یکبار</option>
                      <option value={2}>هر ۲ ماه یکبار</option>
                      <option value={3}>هر ۳ ماه یکبار</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">تعداد اقساط</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={customInstallmentsCount}
                      onChange={(e) =>
                        setCustomInstallmentsCount(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-center"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span>
                    مجموع درصد پرداختی: <strong>{toPersianDigits(100 + customFeePct)}٪</strong>
                  </span>
                  <span>
                    مانده تقسیط:{' '}
                    <strong>
                      {toPersianDigits(Math.max(0, 100 + customFeePct - customDownPaymentPct))}٪
                    </strong>
                  </span>
                </div>
              </div>
            )}

            {/* Live Financial Breakdown Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block">شهریه پس از تخفیف:</span>
                <span className="font-bold text-slate-700 font-mono text-[11px]">
                  {formatToman(netTuition)}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block">
                  بیعانه اولیه ({toPersianDigits(activeTemplate.downPaymentPercent)}٪):
                </span>
                <span className="font-bold text-[#0E7C5B] font-mono text-[11px]">
                  {formatToman(previewPlan.downPayment || 0)}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block">
                  سود / کارمزد ({toPersianDigits(activeTemplate.feePercent)}٪):
                </span>
                <span className="font-bold text-amber-700 font-mono text-[11px]">
                  +{formatToman(previewPlan.feeAmount || 0)}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-800 block font-semibold">
                  مجموع قابل پرداخت:
                </span>
                <span className="font-bold text-[#0A3528] font-mono text-xs">
                  {formatToman(previewPlan.totalAmount || netTuition)}
                </span>
              </div>
            </div>

            {/* Installments preview schedule */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-600">
                پیش‌نمایش سررسید و مبلغ اقساط ({toPersianDigits(previewPlan.installments.length)} مرحله):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                {previewPlan.installments.map((inst, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-0.5"
                  >
                    <div className="font-semibold text-slate-700 truncate">{inst.title}</div>
                    <div className="text-[#0E7C5B] font-mono font-bold">
                      {formatToman(inst.amount)}
                    </div>
                    <div className="text-slate-400 font-mono text-[10px]">
                      سررسید: {toPersianDigits(inst.dueDate)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">یادداشت ثبت‌نام</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="توضیحات تکمیلی، نحوه واریز، مدارک مورد نیاز و..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-medium text-white bg-[#0E7C5B] rounded-lg hover:bg-[#0A3528] transition-colors shadow-xs"
            >
              تأیید و صدور رسید ثبت‌نام
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Printable Receipt (رسید ثبت‌نام)                             */}
      {/* ------------------------------------------------------------------ */}
      {receiptRegistration && (
        <Modal
          isOpen={!!receiptRegistration}
          onClose={() => setReceiptRegistrationId(null)}
          title={`رسید رسمی ثبت‌نام - کد پیگیری ${receiptRegistration.code}`}
          maxWidth="3xl"
        >
          {(() => {
            const student = getStudentById(receiptRegistration.studentId);
            const classRoom = getClassById(receiptRegistration.classId);
            const session = classRoom?.sessions.find((s) => s.id === receiptRegistration.sessionId);

            const totalAmount = receiptRegistration.plan.installments.reduce(
              (sum, i) => sum + i.amount,
              0
            );
            const paidAmount = receiptRegistration.plan.installments
              .filter((i) => i.paidAt)
              .reduce((sum, i) => sum + i.amount, 0);
            const remainingAmount = Math.max(0, totalAmount - paidAmount);

            return (
              <div className="space-y-6">
                {/* Print Action Header (Hidden during print) */}
                <div className="no-print flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="text-xs text-slate-500">
                    این رسید حاوی اطلاعات پذیرش و جدول اقساط دانش‌آموز است.
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A3528] text-white rounded-lg text-xs font-medium hover:bg-[#0E7C5B] transition-colors shadow-xs"
                  >
                    <IconPrinter size={15} />
                    <span>چاپ رسید</span>
                  </button>
                </div>

                {/* Printable Document Sheet */}
                <div className="print-area bg-white p-6 rounded-xl border border-slate-200 text-slate-800 space-y-5 text-xs">
                  {/* School Logo & Document Header */}
                  <div className="flex items-center justify-between border-b-2 border-[#162E6E] pb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-orange-200/80 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                        <LogoHelli size={48} />
                      </div>
                      <div>
                        <h1 className="text-xl font-heading text-[#162E6E]">
                          آموزشگاه تیزهوشان و المپیاد علامه حلی
                        </h1>
                        <div className="text-slate-500 text-[11px] mt-0.5 font-medium">
                          برگه رسمی ثبت‌نام و جدول سررسید اقساط شهریه
                        </div>
                      </div>
                    </div>
                    <div className="text-left font-mono text-[11px] space-y-0.5">
                      <div>
                        شماره پیگیری: <strong className="text-[#162E6E]">{receiptRegistration.code}</strong>
                      </div>
                      <div>تاریخ صدور: {toPersianDigits(receiptRegistration.date)}</div>
                    </div>
                  </div>

                  {/* Student & Class Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-[11px] text-slate-400 block">نام دانش‌آموز:</span>
                      <strong className="text-slate-800">
                        {student ? `${student.firstName} ${student.lastName}` : 'نامشخص'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">کد ملی:</span>
                      <span className="font-mono">{student?.nationalId || '---'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">نام پدر:</span>
                      <span>{student?.fatherName || '---'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">پایه تحصیلی:</span>
                      <span>پایه {student?.grade || '---'}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block">عنوان دوره:</span>
                      <strong className="text-[#0A3528]">{classRoom?.name}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block">زنگ و زمان برگزاری:</span>
                      <span>
                        {session?.label} ({session?.days} - ساعت {session?.time})
                      </span>
                    </div>
                  </div>

                  {/* Applied Payment Plan Info */}
                  {receiptRegistration.plan.templateTitle && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 block">برنامه مالی انتخاب شده:</span>
                        <strong className="text-[#0A3528]">{receiptRegistration.plan.templateTitle}</strong>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                        {receiptRegistration.plan.feePercent ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            سود و کارمزد: +{toPersianDigits(receiptRegistration.plan.feePercent)}٪ ({formatToman(receiptRegistration.plan.feeAmount || 0)})
                          </span>
                        ) : null}
                        {receiptRegistration.plan.downPayment ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            بیعانه پرداختی: {formatToman(receiptRegistration.plan.downPayment)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Financial Summary */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                      <span className="text-[11px] text-slate-500 block">شهریه کل قرارداد:</span>
                      <span className="text-sm font-bold text-[#0A3528] font-mono">
                        {formatToman(totalAmount)}
                      </span>
                    </div>
                    <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100">
                      <span className="text-[11px] text-slate-500 block">مبلغ وصول شده:</span>
                      <span className="text-sm font-bold text-[#0E7C5B] font-mono">
                        {formatToman(paidAmount)}
                      </span>
                    </div>
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                      <span className="text-[11px] text-slate-500 block">مانده تعهدات:</span>
                      <span className="text-sm font-bold text-amber-800 font-mono">
                        {formatToman(remainingAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Installments Schedule Table */}
                  <div className="space-y-2">
                    <div className="font-semibold text-slate-700 text-xs">جدول وضعیت اقساط و سررسیدها:</div>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="py-2.5 px-3">ردیف</th>
                            <th className="py-2.5 px-3">عنوان قسط</th>
                            <th className="py-2.5 px-3">مبلغ قسط</th>
                            <th className="py-2.5 px-3">تاریخ سررسید</th>
                            <th className="py-2.5 px-3">وضعیت پرداخت</th>
                            <th className="py-2.5 px-3 no-print text-center">عملیات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {receiptRegistration.plan.installments.map((inst, idx) => {
                            const overdue = isOverdue(inst.dueDate, inst.paidAt);
                            return (
                              <tr key={inst.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-mono">{toPersianDigits(idx + 1)}</td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">{inst.title}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-[#0A3528]">
                                  {formatToman(inst.amount)}
                                </td>
                                <td className="py-2.5 px-3 font-mono">{toPersianDigits(inst.dueDate)}</td>
                                <td className="py-2.5 px-3">
                                  {inst.paidAt ? (
                                    <span className="text-[#0E7C5B] font-medium font-mono">
                                      پرداخت شده در {toPersianDigits(inst.paidAt)}
                                    </span>
                                  ) : overdue ? (
                                    <span className="text-[#D64545] font-semibold">
                                      معوق ({toPersianDigits(daysOverdue(inst.dueDate))} روز تأخیر)
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">در انتظار وصول</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 no-print text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      inst.paidAt
                                        ? handleReceiptRefund(receiptRegistration.id, inst.id)
                                        : handleReceiptRequestPayment(
                                            receiptRegistration.id,
                                            {
                                              id: inst.id,
                                              title: inst.title,
                                              amount: inst.amount,
                                              dueDate: inst.dueDate,
                                            },
                                            student
                                              ? `${student.firstName} ${student.lastName}`
                                              : 'نامشخص'
                                          )
                                    }
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                      inst.paidAt
                                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        : 'bg-[#0E7C5B] text-white hover:bg-[#0A3528]'
                                    }`}
                                  >
                                    {inst.paidAt ? 'عودت پرداخت' : 'ثبت پرداخت'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notes & Signatures */}
                  {receiptRegistration.notes && (
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-600 text-[11px] border border-slate-100">
                      <strong>یادداشت:</strong> {receiptRegistration.notes}
                    </div>
                  )}

                  <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-slate-500 text-[11px]">
                    <div>مهر و امضای پذیرش آموزشگاه</div>
                    <div>امضای ولی / دانش‌آموز</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* HI-4: Shared payment-date modal (same as Finance page) for receipt payments */}
      {pendingReceiptPayment && (
        <PaymentDateModal
          isOpen={Boolean(pendingReceiptPayment)}
          onClose={() => setPendingReceiptPayment(null)}
          studentName={pendingReceiptPayment.studentName}
          installmentTitle={pendingReceiptPayment.title}
          amount={pendingReceiptPayment.amount}
          dueDate={pendingReceiptPayment.dueDate}
          onConfirm={handleReceiptConfirmPayment}
        />
      )}

      {/* Student Dossier Modal */}
      {selectedDossierRegId && (
        <StudentDossierModal
          registrationId={selectedDossierRegId}
          onClose={() => setSelectedDossierRegId(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};
