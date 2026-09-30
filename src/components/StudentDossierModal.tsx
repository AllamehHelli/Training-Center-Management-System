/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { useFieldSettings } from '../Settings';
import { validateStudent, buildStudentFromInput } from '../studentValidation';
import { Registration, RegistrationStatus, Student } from '../types';
import {
  toPersianDigits,
  formatToman,
  getTodayJalali,
  isOverdue,
  daysOverdue,
} from '../utils';
import { Modal, Avatar, useToast, Field } from '../ui';
import {
  IconCheck,
  IconClose,
  IconEdit,
  IconPrinter,
  IconAlert,
  IconPlus,
  IconTrash,
} from '../icons';
import { LogoHelli } from '../Logo';
import {
  Clock,
  UserCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  HeartHandshake,
  Copy,
  Phone,
  CreditCard,
  ExternalLink,
  PhoneCall,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { PaymentDateModal } from './PaymentDateModal';

export interface StudentDossierModalProps {
  registrationId?: string | null;
  studentId?: string | null;
  onClose: () => void;
  onNavigate?: (view: any, filters?: any) => void;
}

export const StudentDossierModal: React.FC<StudentDossierModalProps> = ({
  registrationId,
  studentId,
  onClose,
  onNavigate,
}) => {
  const { state, dispatch, getStudentById, getClassById } = useAppStore();
  const { fieldSettings } = useFieldSettings();
  const { showToast } = useToast();
  const today = getTodayJalali();

  // Determine current student and registrations
  const initialReg = registrationId ? state.registrations.find((r) => r.id === registrationId) : null;
  const initialStudentId = initialReg ? initialReg.studentId : studentId;
  const student = initialStudentId ? getStudentById(initialStudentId) : null;

  // Student's all registrations (active first)
  const studentRegistrations = student
    ? state.registrations.filter((r) => r.studentId === student.id)
    : [];

  const activeRegistrations = studentRegistrations.filter((r) => r.status !== 'cancelled');

  // activeTab can be a specific registration id OR 'all' for consolidated view
  const [activeRegId, setActiveRegId] = useState<string | 'all'>(() => {
    if (registrationId) return registrationId;
    if (studentRegistrations.length > 0) return studentRegistrations[0].id;
    return 'all';
  });

  // Sync activeRegId when props change
  useEffect(() => {
    if (registrationId) {
      setActiveRegId(registrationId);
    } else if (studentRegistrations.length > 0) {
      setActiveRegId(studentRegistrations[0].id);
    } else {
      setActiveRegId('all');
    }
  }, [registrationId, studentId]);

  const reg = activeRegId !== 'all' ? state.registrations.find((r) => r.id === activeRegId) || null : null;
  const classRoom = reg ? getClassById(reg.classId) : null;
  const session = classRoom && reg ? classRoom.sessions.find((s) => s.id === reg.sessionId) : null;

  // Edit Mode for Student Details
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editGpa, setEditGpa] = useState('');
  const [editCounselorId, setEditCounselorId] = useState('');
  const [editPhones, setEditPhones] = useState<{ id: string; label: string; number: string }[]>([]);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Notes state
  const [editNotes, setEditNotes] = useState('');
  const [isPrintReceiptOpen, setIsPrintReceiptOpen] = useState(false);

  // Sync edit state when modal opens or active student/reg changes
  useEffect(() => {
    if (student) {
      setEditFirstName(student.firstName);
      setEditLastName(student.lastName);
      setEditFatherName(student.fatherName);
      setEditNationalId(student.nationalId);
      setEditGrade(student.grade);
      setEditSchool(student.school);
      setEditGpa(String(student.gpa));
      setEditCounselorId(student.counselorId || '');
      setEditPhones([...student.phones]);
    }
    if (reg) {
      setEditNotes(reg.notes || '');
    }
    setIsEditingStudent(false);
    setIsPrintReceiptOpen(false);
    setEditErrors({});
  }, [activeRegId, student?.id]);

  if (!student) return null;

  // Aggregated totals across ALL active courses of this student
  let grandTotalTuition = 0;
  let grandTotalPaid = 0;
  let grandTotalOverdue = 0;
  let grandOverdueCount = 0;

  activeRegistrations.forEach((r) => {
    r.plan.installments.forEach((inst) => {
      grandTotalTuition += inst.amount;
      if (inst.paidAt) {
        grandTotalPaid += inst.amount;
      } else if (isOverdue(inst.dueDate, inst.paidAt)) {
        grandTotalOverdue += inst.amount;
        grandOverdueCount += 1;
      }
    });
  });
  const grandTotalRemaining = Math.max(0, grandTotalTuition - grandTotalPaid);

  // Quick Assign / Change Counselor
  const handleQuickAssignCounselor = (newCounselorId: string) => {
    if (!student) return;
    const selectedCns = (state.counselors || []).find((c) => c.id === newCounselorId);
    const updatedStudent: Student = {
      ...student,
      counselorId: newCounselorId || undefined,
      counselorName: selectedCns ? `${selectedCns.firstName} ${selectedCns.lastName}` : undefined,
    };
    dispatch({ type: 'UPDATE_STUDENT', payload: updatedStudent });
    setEditCounselorId(newCounselorId);
    showToast(
      selectedCns
        ? `مشاور ${selectedCns.firstName} ${selectedCns.lastName} به این دانش‌آموز اختصاص یافت`
        : `تخصیص مشاور لغو شد`,
      'success'
    );
  };

  // Status Change handlers
  const handleStatusChange = (newStatus: RegistrationStatus, targetRegId?: string) => {
    const targetId = targetRegId || reg?.id;
    if (!targetId) return;
    dispatch({ type: 'UPDATE_REGISTRATION_STATUS', payload: { id: targetId, status: newStatus } });
    showToast(
      newStatus === 'approved'
        ? 'ثبت‌نام دانش‌آموز با موفقیت تأیید قطعی شد'
        : newStatus === 'cancelled'
        ? 'ثبت‌نام دانش‌آموز لغو شد'
        : 'پرونده به صف در انتظار بررسی بازگردانده شد',
      newStatus === 'approved' ? 'success' : 'info'
    );
  };

  // Payment Date Modal state for on-the-spot Jalali date recording
  const [paymentModalItem, setPaymentModalItem] = useState<{
    regId: string;
    instId: string;
    title: string;
    amount: number;
    dueDate: string;
  } | null>(null);

  // Toggle Installment Payment (handles specific registration)
  const handleToggleInstallment = (targetRegId: string, instId: string, isPaid: boolean) => {
    if (isPaid) {
      dispatch({ type: 'REFUND_INSTALLMENT', payload: { regId: targetRegId, instId } });
      showToast('پرداخت قسط عودت داده شد و به حالت پرداخت‌نشده بازگشت', 'info');
    } else {
      const targetReg = state.registrations.find((r) => r.id === targetRegId);
      const targetInst = targetReg?.plan.installments.find((i) => i.id === instId);
      if (targetInst && targetReg) {
        setPaymentModalItem({
          regId: targetReg.id,
          instId: targetInst.id,
          title: targetInst.title,
          amount: targetInst.amount,
          dueDate: targetInst.dueDate,
        });
      }
    }
  };

  const handleConfirmPayment = (paidDate: string) => {
    if (!paymentModalItem) return;
    dispatch({
      type: 'MARK_INSTALLMENT_PAID',
      payload: {
        regId: paymentModalItem.regId,
        instId: paymentModalItem.instId,
        paidAt: paidDate || today,
      },
    });
    showToast('وصول قسط با تاریخ شمسی انتخابی ثبت شد', 'success');
    setPaymentModalItem(null);
  };

  // Save Student Profile Edits
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedCns = (state.counselors || []).find((c) => c.id === editCounselorId);

    const input = {
      firstName: editFirstName,
      lastName: editLastName,
      fatherName: editFatherName,
      nationalId: editNationalId,
      grade: editGrade || student.grade,
      gpa: editGpa,
      school: editSchool,
      phones: editPhones.filter((p) => p.number.trim().length > 0),
      counselorId: editCounselorId || undefined,
      counselorName: selectedCns ? `${selectedCns.firstName} ${selectedCns.lastName}` : undefined,
    };

    const errors = validateStudent(input, fieldSettings, state.students, student.id);

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      showToast('لطفاً خطاهای مشخصات دانش‌آموز را برطرف نمایید', 'error');
      return;
    }
    setEditErrors({});

    const updatedStudent: Student = buildStudentFromInput(input, student);

    dispatch({ type: 'UPDATE_STUDENT', payload: updatedStudent });
    showToast('مشخصات و اطلاعات تماس دانش‌آموز با موفقیت به‌روزرسانی شد', 'success');
    setIsEditingStudent(false);
  };

  // Save Registration Notes
  const handleSaveNotes = () => {
    if (!reg) return;
    dispatch({
      type: 'UPDATE_REGISTRATION',
      payload: { ...reg, notes: editNotes.trim() },
    });
    showToast('یادداشت پیگیری پرونده با موفقیت ذخیره شد', 'success');
  };

  // Add Phone Row in Edit Mode
  const handleAddPhone = () => {
    setEditPhones((prev) => [
      ...prev,
      { id: `p-${Date.now()}-${prev.length + 1}`, label: 'همراه', number: '' },
    ]);
  };

  // Remove Phone Row in Edit Mode
  const handleRemovePhone = (pId: string) => {
    if (editPhones.length <= 1) {
      showToast('حداقل یک شماره تماس باید باقی بماند', 'info');
      return;
    }
    setEditPhones((prev) => prev.filter((p) => p.id !== pId));
  };

  // Current single registration calculations (when a specific reg is active)
  const currentRegTotal = reg ? reg.plan.installments.reduce((sum, i) => sum + i.amount, 0) : 0;
  const currentRegPaid = reg ? reg.plan.installments.filter((i) => i.paidAt).reduce((sum, i) => sum + i.amount, 0) : 0;
  const currentRegRemaining = Math.max(0, currentRegTotal - currentRegPaid);
  const currentRegPaidCount = reg ? reg.plan.installments.filter((i) => i.paidAt).length : 0;
  const currentRegTotalCount = reg ? reg.plan.installments.length : 0;

  // Flattened all installments for the consolidated view
  const allConsolidatedInstallments: {
    regId: string;
    regCode: string;
    courseName: string;
    installment: typeof state.registrations[0]['plan']['installments'][0];
  }[] = [];

  activeRegistrations.forEach((r) => {
    const cls = getClassById(r.classId);
    r.plan.installments.forEach((inst) => {
      allConsolidatedInstallments.push({
        regId: r.id,
        regCode: r.code,
        courseName: cls?.name || 'کلاس نامشخص',
        installment: inst,
      });
    });
  });

  return (
    <Modal
      isOpen={!!(registrationId || studentId)}
      onClose={onClose}
      title={`پرونده مالی و مشخصات ارتباطی دانش‌آموز - ${student.firstName} ${student.lastName}`}
      maxWidth="4xl"
    >
      <div className="space-y-5 text-right font-sans" dir="rtl">
        {/* ------------------------------------------------------------- */}
        {/* Top Summary Banner: Student identity + Registration Status    */}
        {/* ------------------------------------------------------------- */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-50 via-white to-blue-50/40 rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={`${student.firstName} ${student.lastName}`} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-heading font-bold text-neutral-900">
                  {student.firstName} {student.lastName}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-semibold">
                  پایه {student.grade}
                </span>

                {reg && reg.status === 'approved' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <IconCheck size={12} />
                    <span>پذیرش تأیید شده</span>
                  </span>
                )}
                {reg && reg.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={12} />
                    <span>در انتظار پذیرش</span>
                  </span>
                )}
                {reg && reg.status === 'cancelled' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <IconClose size={12} />
                    <span>لغو شده</span>
                  </span>
                )}

                {student.counselorId ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    <HeartHandshake size={12} className="text-teal-600" />
                    <span>مشاور: {student.counselorName || 'مشاور تحصیلی'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                    بدون مشاور تحصیلی
                  </span>
                )}
              </div>

              <div className="text-xs text-neutral-500 mt-1.5 flex flex-wrap items-center gap-3">
                {reg && (
                  <>
                    <span>کد پیگیری دوره: <strong className="text-neutral-800 font-mono">{reg.code}</strong></span>
                    <span>·</span>
                    <span>تاریخ ثبت: <strong className="text-neutral-800 font-mono">{toPersianDigits(reg.date)}</strong></span>
                    <span>·</span>
                  </>
                )}
                <span>کد ملی: <strong className="text-neutral-800 font-mono">{toPersianDigits(student.nationalId)}</strong></span>
                <span>·</span>
                <span>معدل: <strong className="text-neutral-800 font-mono">{toPersianDigits(student.gpa)}</strong></span>
                <span>·</span>
                <span>مدرسه: <strong className="text-neutral-800">{student.school || 'نامشخص'}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Actions for this registration / receipt */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
            {reg && reg.status === 'pending' && (
              <button
                type="button"
                onClick={() => handleStatusChange('approved')}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <IconCheck size={13} />
                <span>تأیید پذیرش</span>
              </button>
            )}

            {reg && reg.status === 'approved' && (
              <button
                type="button"
                onClick={() => handleStatusChange('pending')}
                className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Clock size={13} />
                <span>انتقال به بررسی</span>
              </button>
            )}

            {reg && (
              <button
                type="button"
                onClick={() => setIsPrintReceiptOpen(true)}
                className="px-3.5 py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-full text-xs font-medium shadow-2xs transition-colors flex items-center gap-1.5"
                title="مشاهده و چاپ برگه رسمی پذیرش و جدول اقساط"
              >
                <IconPrinter size={13} />
                <span>چاپ رسید</span>
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Aggregated Financial Overview Card (وضعیت تجمیعی مالی)        */}
        {/* ------------------------------------------------------------- */}
        <div className="p-4 bg-gradient-to-r from-emerald-50/50 via-white to-blue-50/30 rounded-2xl border border-emerald-100/90 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-[#0E7C5B] flex items-center justify-center shrink-0">
                <CreditCard size={16} />
              </div>
              <div>
                <h4 className="text-xs font-heading font-bold text-neutral-900">
                  خلاصه وضعیت مالی تجمیعی فراگیر (سراسر دوره‌ها)
                </h4>
                <p className="text-[11px] text-neutral-500">
                  محاسبه آنلاین مجموع تعهدات، وصولی‌ها و معوقات کلیه دوره‌های ثبت‌نامی این دانش‌آموز
                </p>
              </div>
            </div>

            {/* Financial Health Status Badge */}
            <div>
              {grandOverdueCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-[#D64545] border border-red-200 rounded-full text-xs font-bold">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>{toPersianDigits(grandOverdueCount)} قسط معوق سررسید گذشته</span>
                </span>
              ) : grandTotalRemaining === 0 && grandTotalTuition > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>تسویه کامل تمام دوره‌ها</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                  <Clock size={13} className="shrink-0" />
                  <span>اقساط جاری و منظم</span>
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-white rounded-xl border border-neutral-200/70">
              <span className="text-neutral-400 block text-[10px]">مجموع کل شهریه‌ها:</span>
              <span className="font-bold text-neutral-900 font-mono text-sm mt-0.5 block">
                {formatToman(grandTotalTuition)}
              </span>
            </div>
            <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200/70">
              <span className="text-emerald-700 block text-[10px]">مجموع وصول‌شده:</span>
              <span className="font-bold text-emerald-800 font-mono text-sm mt-0.5 block">
                {formatToman(grandTotalPaid)}
              </span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-neutral-200/70">
              <span className="text-neutral-400 block text-[10px]">مانده کل بدهی:</span>
              <span
                className={`font-bold font-mono text-sm mt-0.5 block ${
                  grandTotalRemaining > 0 ? 'text-amber-800' : 'text-neutral-700'
                }`}
              >
                {formatToman(grandTotalRemaining)}
              </span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-neutral-200/70">
              <span className="text-neutral-400 block text-[10px]">مبلغ معوقات سررسید گذشته:</span>
              <span
                className={`font-bold font-mono text-sm mt-0.5 block ${
                  grandTotalOverdue > 0 ? 'text-[#D64545]' : 'text-emerald-700'
                }`}
              >
                {grandTotalOverdue > 0 ? formatToman(grandTotalOverdue) : '۰ تومان (بدون معوق)'}
              </span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Printable Receipt Modal / View                                */}
        {/* ------------------------------------------------------------- */}
        {isPrintReceiptOpen && reg && (
          <div className="p-5 bg-white rounded-3xl border border-neutral-300 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-800">پیش‌نمایش برگه رسمی ثبت‌نام و جدول اقساط</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full text-xs font-medium flex items-center gap-1.5 shadow-2xs"
                >
                  <IconPrinter size={13} />
                  <span>پرینت فوری برگه</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintReceiptOpen(false)}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-full text-xs"
                >
                  بستن
                </button>
              </div>
            </div>

            <div className="p-5 bg-neutral-50/50 rounded-2xl border border-neutral-200 text-xs space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <LogoHelli size={34} />
                  <div>
                    <h4 className="font-heading font-bold text-neutral-900 text-sm">آموزشگاه تیزهوشان علامه حلی</h4>
                    <p className="text-[10px] text-neutral-500">برگه رسمی پذیرش و جدول سررسید اقساط شهریه</p>
                  </div>
                </div>
                <div className="text-left font-mono text-[11px]">
                  <div>کد پیگیری: <strong>{reg.code}</strong></div>
                  <div>تاریخ صدور: {toPersianDigits(reg.date)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
                <div>دانش‌آموز: <strong>{student.firstName} {student.lastName}</strong></div>
                <div>کد ملی: <strong className="font-mono">{toPersianDigits(student.nationalId)}</strong></div>
                <div>پایه: <strong>{student.grade}</strong></div>
                <div>نام پدر: <strong>{student.fatherName || 'نامشخص'}</strong></div>
                <div>دوره: <strong>{classRoom?.name}</strong></div>
                <div>استاد: <strong>{classRoom?.teacher}</strong></div>
                <div>زنگ: <strong>{session?.label}</strong></div>
                <div>شهریه دوره: <strong>{formatToman(currentRegTotal)}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Section 1: Contact & Profile with Inline Edit                 */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h4 className="text-sm font-bold text-neutral-900 font-heading">
                مشخصات ارتباطی اولیا و اطلاعات هویتی فراگیر
              </h4>
            </div>

            {!isEditingStudent ? (
              <button
                type="button"
                onClick={() => setIsEditingStudent(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-full text-xs font-semibold transition-colors"
              >
                <IconEdit size={13} />
                <span>ویرایش اطلاعات و شماره‌های تماس</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingStudent(false)}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                انصراف از ویرایش
              </button>
            )}
          </div>

          {!isEditingStudent ? (
            <div className="space-y-4">
              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-neutral-50/70 rounded-2xl">
                  <span className="text-neutral-400 block text-[11px]">نام و نام خانوادگی:</span>
                  <span className="font-bold text-neutral-900 mt-0.5 block">{student.firstName} {student.lastName}</span>
                </div>
                <div className="p-3 bg-neutral-50/70 rounded-2xl">
                  <span className="text-neutral-400 block text-[11px]">نام پدر:</span>
                  <span className="font-bold text-neutral-900 mt-0.5 block">{student.fatherName || 'ثبت نشده'}</span>
                </div>
                <div className="p-3 bg-neutral-50/70 rounded-2xl">
                  <span className="text-neutral-400 block text-[11px]">کد ملی ۱۰ رقمی:</span>
                  <span className="font-bold text-neutral-900 mt-0.5 block font-mono">{toPersianDigits(student.nationalId)}</span>
                </div>
                <div className="p-3 bg-neutral-50/70 rounded-2xl">
                  <span className="text-neutral-400 block text-[11px]">مدرسه فعلی:</span>
                  <span className="font-bold text-neutral-900 mt-0.5 block">{student.school || 'نامشخص'}</span>
                </div>
                <div className="p-3 bg-neutral-50/70 rounded-2xl">
                  <span className="text-neutral-400 block text-[11px]">معدل کارنامه:</span>
                  <span className="font-bold text-neutral-900 mt-0.5 block font-mono">{toPersianDigits(student.gpa)}</span>
                </div>
                <div className="p-3 bg-teal-50/60 border border-teal-100/80 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-teal-800 block text-[11px] font-bold">مشاور تحصیلی:</span>
                      <HeartHandshake size={14} className="text-teal-600" />
                    </div>
                    {student.counselorId ? (
                      <span className="font-extrabold text-neutral-900 block text-xs mt-1">
                        مشاور {student.counselorName}
                      </span>
                    ) : (
                      <span className="font-medium text-amber-700 mt-1 block text-xs">
                        بدون مشاور تحصیلی
                      </span>
                    )}
                  </div>
                  <div className="mt-2 pt-1 border-t border-teal-100/80 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-neutral-500">تغییر:</span>
                    <select
                      value={student.counselorId || ''}
                      onChange={(e) => handleQuickAssignCounselor(e.target.value)}
                      className="text-[11px] bg-white border border-teal-200 rounded-lg px-2 py-0.5 text-teal-900 font-bold focus:outline-hidden"
                    >
                      <option value="">-- بدون مشاور --</option>
                      {(state.counselors || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          مشاور {c.firstName} {c.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dedicated Contact & Phones Card with Call & Copy */}
              <div className="p-3.5 bg-neutral-50/90 rounded-2xl border border-neutral-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                    <Phone size={14} className="text-[#0E7C5B]" />
                    <span>شماره‌های تماس ثبت‌شده جهت پیگیری مالی و اولیا:</span>
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    {toPersianDigits(student.phones.length)} شماره تماس فعال
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {student.phones.map((p) => {
                    const isFather = p.label.includes('پدر');
                    const isMother = p.label.includes('مادر');
                    const isGuardian = p.label.includes('ولی');
                    const isStudent = p.label.includes('دانش‌آموز');

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-neutral-200 shadow-2xs hover:border-neutral-300 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              isFather
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isMother
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : isGuardian
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : isStudent
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {p.label}
                          </span>
                          <span className="font-bold text-neutral-800 font-mono text-xs" dir="ltr">
                            {toPersianDigits(p.number)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <a
                            href={`tel:${p.number}`}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                            title={`تماس مستقیم با ${p.label}`}
                          >
                            <PhoneCall size={13} />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(p.number);
                              showToast(`شماره ${p.label} (${p.number}) کپی شد`, 'info');
                            }}
                            className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="کپی شماره در حافظه"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Inline Edit Form */
            <form onSubmit={handleSaveStudent} className="space-y-4 pt-2">
              {Object.keys(editErrors).length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <IconAlert size={14} className="mt-0.5 shrink-0" />
                  <ul className="list-disc pr-4 space-y-1">
                    {Object.values(editErrors).map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="نام کوچک" required={fieldSettings.firstName} error={editErrors.firstName}>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </Field>
                <Field label="نام خانوادگی" required={fieldSettings.lastName} error={editErrors.lastName}>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </Field>
                <Field label="نام پدر" required={fieldSettings.fatherName} error={editErrors.fatherName}>
                  <input
                    type="text"
                    value={editFatherName}
                    onChange={(e) => setEditFatherName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="کد ملی" required={fieldSettings.nationalId} error={editErrors.nationalId}>
                  <input
                    type="text"
                    value={editNationalId}
                    onChange={(e) => setEditNationalId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-left"
                  />
                </Field>
                <Field label="مدرسه" required={fieldSettings.school} error={editErrors.school}>
                  <input
                    type="text"
                    value={editSchool}
                    onChange={(e) => setEditSchool(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </Field>
                <Field label="معدل" required={fieldSettings.gpa} error={editErrors.gpa}>
                  <input
                    type="text"
                    value={editGpa}
                    onChange={(e) => setEditGpa(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-left"
                  />
                </Field>
                <div className="sm:col-span-3">
                  <Field label="مشاور تحصیلی اختصاصی (از بانک مشاوران)">
                    <select
                      value={editCounselorId}
                      onChange={(e) => setEditCounselorId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-neutral-800"
                    >
                      <option value="">-- بدون مشاور تحصیلی --</option>
                      {(state.counselors || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          مشاور {c.firstName} {c.lastName} ({c.specialty || 'هدایت تحصیلی'})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Phone Numbers Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700">
                    شماره‌های تماس اولیا و دانش‌آموز:{fieldSettings.phones && <span className="text-[#D64545]"> *</span>}
                  </label>
                  {editErrors.phones && (
                    <span className="text-[11px] text-red-600 font-medium">{editErrors.phones}</span>
                  )}
                  <button
                    type="button"
                    onClick={handleAddPhone}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                  >
                    <IconPlus size={12} />
                    <span>افزودن شماره تماس</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {editPhones.map((phone) => (
                    <div
                      key={phone.id}
                      className="flex items-center gap-2 p-2 bg-neutral-50 rounded-xl border border-neutral-200/80"
                    >
                      <select
                        value={phone.label}
                        onChange={(e) =>
                          setEditPhones((prev) =>
                            prev.map((p) => (p.id === phone.id ? { ...p, label: e.target.value } : p))
                          )
                        }
                        className="text-xs bg-white border border-neutral-200 rounded-lg px-2 py-1 font-medium"
                      >
                        <option value="پدر">پدر</option>
                        <option value="مادر">مادر</option>
                        <option value="دانش‌آموز">دانش‌آموز</option>
                        <option value="منزل">منزل</option>
                        <option value="ولی">ولی</option>
                        <option value="اضطراری">اضطراری</option>
                      </select>
                      <input
                        type="tel"
                        dir="ltr"
                        value={phone.number}
                        onChange={(e) =>
                          setEditPhones((prev) =>
                            prev.map((p) => (p.id === phone.id ? { ...p, number: e.target.value } : p))
                          )
                        }
                        placeholder="09120000000"
                        className="flex-1 px-2.5 py-1 text-xs bg-white border border-neutral-200 rounded-lg font-mono text-left"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhone(phone.id)}
                        className="text-neutral-400 hover:text-rose-600 p-1"
                        title="حذف شماره"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsEditingStudent(false)}
                  className="px-4 py-1.5 text-xs text-neutral-600 bg-neutral-100 rounded-full hover:bg-neutral-200"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 text-xs text-white bg-neutral-900 rounded-full hover:bg-neutral-800 font-semibold shadow-2xs"
                >
                  ذخیره تغییرات مشخصات
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Section 2: Course Navigation Tabs & Consolidated Toggle       */}
        {/* ------------------------------------------------------------- */}
        {studentRegistrations.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-200">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-xs text-neutral-500 font-medium shrink-0 ml-1">انتخاب دوره:</span>
                {studentRegistrations.map((r, idx) => {
                  const cls = getClassById(r.classId);
                  const isSelected = r.id === activeRegId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setActiveRegId(r.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#0E7C5B] text-white shadow-2xs'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      <span>{cls?.name || `دوره ${toPersianDigits(idx + 1)}`}</span>
                      <span className="text-[10px] opacity-75 font-mono">({toPersianDigits(r.code)})</span>
                    </button>
                  );
                })}
                {studentRegistrations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveRegId('all')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${
                      activeRegId === 'all'
                        ? 'bg-neutral-900 text-white shadow-2xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    <span>همه اقساط فراگیر ({toPersianDigits(allConsolidatedInstallments.length)})</span>
                  </button>
                )}
              </div>

              {reg && (
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  <span>وضعیت پذیرش:</span>
                  <span className="font-bold text-neutral-800">
                    {reg.status === 'approved' ? 'تأیید شده' : reg.status === 'pending' ? 'در انتظار' : 'لغو شده'}
                  </span>
                </div>
              )}
            </div>

            {/* If Single Course selected */}
            {reg ? (
              <>
                {/* Course Details Card */}
                <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <h4 className="text-sm font-bold text-neutral-900 font-heading">
                      مشخصات دوره آموزشی و زمان‌بندی زنگ
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-neutral-50 rounded-2xl">
                      <span className="text-neutral-400 block text-[11px]">عنوان دوره:</span>
                      <span className="font-bold text-neutral-900 mt-0.5 block">{classRoom?.name || 'کلاس نامشخص'}</span>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-2xl">
                      <span className="text-neutral-400 block text-[11px]">مدرس دوره:</span>
                      <span className="font-bold text-neutral-900 mt-0.5 block">{classRoom?.teacher || 'نامشخص'}</span>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-2xl">
                      <span className="text-neutral-400 block text-[11px]">زمان‌بندی و زنگ کلاس:</span>
                      <span className="font-bold text-neutral-900 mt-0.5 block">
                        {session?.label} ({session?.days} - {session?.time})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Single Course Installments */}
                <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h4 className="text-sm font-bold text-neutral-900 font-heading">
                        دفترچه اقساط این دوره
                      </h4>
                    </div>
                    <div className="text-xs text-neutral-500 flex items-center gap-3">
                      <span>
                        تسویه شده: <strong className="text-neutral-900 font-mono">{toPersianDigits(currentRegPaidCount)} از {toPersianDigits(currentRegTotalCount)}</strong>
                      </span>
                      <span>·</span>
                      <span>وصول‌شده: <strong className="text-emerald-700 font-mono">{formatToman(currentRegPaid)}</strong></span>
                      <span>·</span>
                      <span>مانده: <strong className="text-neutral-900 font-mono">{formatToman(currentRegRemaining)}</strong></span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-neutral-100 text-neutral-400 bg-neutral-50/50">
                          <th className="py-2.5 px-3 font-medium">ردیف</th>
                          <th className="py-2.5 px-3 font-medium">عنوان قسط</th>
                          <th className="py-2.5 px-3 font-medium">مبلغ قسط</th>
                          <th className="py-2.5 px-3 font-medium">موعد سررسید</th>
                          <th className="py-2.5 px-3 font-medium">وضعیت تسویه</th>
                          <th className="py-2.5 px-3 font-medium text-center">عملیات مالی درجا</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {reg.plan.installments.map((inst, index) => {
                          const overdue = isOverdue(inst.dueDate, inst.paidAt);
                          const isPaid = !!inst.paidAt;

                          return (
                            <tr key={inst.id} className="hover:bg-neutral-50/50">
                              <td className="py-3 px-3 font-mono text-neutral-500">{toPersianDigits(index + 1)}</td>
                              <td className="py-3 px-3 font-semibold text-neutral-800">{inst.title}</td>
                              <td className="py-3 px-3 font-mono font-bold text-neutral-900">{formatToman(inst.amount)}</td>
                              <td className="py-3 px-3 font-mono text-neutral-600">{toPersianDigits(inst.dueDate)}</td>
                              <td className="py-3 px-3">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                                    <IconCheck size={13} />
                                    <span>وصول در {toPersianDigits(inst.paidAt!)}</span>
                                  </span>
                                ) : overdue ? (
                                  <span className="inline-flex items-center gap-1 text-rose-600 font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                                    <AlertTriangle size={13} />
                                    <span>{toPersianDigits(daysOverdue(inst.dueDate))} روز تأخیر</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-neutral-500">
                                    <Clock size={13} />
                                    <span>در انتظار سررسید</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {isPaid ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleInstallment(reg.id, inst.id, true)}
                                    className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-[11px] font-medium transition-colors"
                                  >
                                    عودت پرداخت
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleInstallment(reg.id, inst.id, false)}
                                    className="px-3.5 py-1 bg-[#0E7C5B] hover:bg-[#0A3528] text-white rounded-full text-[11px] font-semibold shadow-2xs transition-colors"
                                  >
                                    ثبت وصول قسط
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 4: Registration Notes & Quick Financial Action Logging */}
                <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-900 font-heading">
                      توضیحات و یادداشت‌های پیگیری مالی پرونده:
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="px-4 py-1 text-xs text-white bg-neutral-900 hover:bg-neutral-800 rounded-full font-semibold transition-colors shadow-2xs"
                    >
                      ذخیره یادداشت
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-neutral-400">ثبت سریع پیگیری مالی:</span>
                    {[
                      'تماس تلفنی با ولی: وعده واریز تا دو روز آینده',
                      'پیامک یادآوری موعد قسط ارسال شد',
                      'تسویه حضوری کارتخوان انجام شد',
                      'درخواست تمدید تاریخ سررسید قسط',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setEditNotes((prev) => (prev ? `${prev}\n• ${today}: ${preset}` : `• ${today}: ${preset}`));
                        }}
                        className="text-[10px] px-2.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition-colors cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="یادداشت‌های پیگیری مالی، توافقات اقساطی با اولیا، مدارک تحویل گرفته شده و..."
                    className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-hidden focus:bg-white focus:border-neutral-900 transition-all"
                  />
                </div>
              </>
            ) : (
              /* Consolidated Multi-Course Installments View */
              <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-bold text-neutral-900 font-heading">
                      دفترچه تجمیعی اقساط کلیه دوره‌های فراگیر
                    </h4>
                  </div>
                  <span className="text-xs text-neutral-500 font-mono">
                    مجموع {toPersianDigits(allConsolidatedInstallments.length)} قسط
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-neutral-100 text-neutral-400 bg-neutral-50/50">
                        <th className="py-2.5 px-3 font-medium">ردیف</th>
                        <th className="py-2.5 px-3 font-medium">دوره آموزشی</th>
                        <th className="py-2.5 px-3 font-medium">عنوان قسط</th>
                        <th className="py-2.5 px-3 font-medium">مبلغ قسط</th>
                        <th className="py-2.5 px-3 font-medium">موعد سررسید</th>
                        <th className="py-2.5 px-3 font-medium">وضعیت تسویه</th>
                        <th className="py-2.5 px-3 font-medium text-center">عملیات مالی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {allConsolidatedInstallments.map((item, index) => {
                        const inst = item.installment;
                        const overdue = isOverdue(inst.dueDate, inst.paidAt);
                        const isPaid = !!inst.paidAt;

                        return (
                          <tr key={`${item.regId}-${inst.id}`} className="hover:bg-neutral-50/50">
                            <td className="py-3 px-3 font-mono text-neutral-500">{toPersianDigits(index + 1)}</td>
                            <td className="py-3 px-3 font-semibold text-neutral-800">
                              <div>{item.courseName}</div>
                              <div className="text-[10px] text-neutral-400 font-mono">کد: {item.regCode}</div>
                            </td>
                            <td className="py-3 px-3 text-neutral-700">{inst.title}</td>
                            <td className="py-3 px-3 font-mono font-bold text-neutral-900">{formatToman(inst.amount)}</td>
                            <td className="py-3 px-3 font-mono text-neutral-600">{toPersianDigits(inst.dueDate)}</td>
                            <td className="py-3 px-3">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                                  <IconCheck size={13} />
                                  <span>وصول در {toPersianDigits(inst.paidAt!)}</span>
                                </span>
                              ) : overdue ? (
                                <span className="inline-flex items-center gap-1 text-rose-600 font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                                  <AlertTriangle size={13} />
                                  <span>{toPersianDigits(daysOverdue(inst.dueDate))} روز تأخیر</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-neutral-500">
                                  <Clock size={13} />
                                  <span>در انتظار سررسید</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleInstallment(item.regId, inst.id, true)}
                                  className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-[11px] font-medium transition-colors"
                                >
                                  عودت پرداخت
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleInstallment(item.regId, inst.id, false)}
                                  className="px-3.5 py-1 bg-[#0E7C5B] hover:bg-[#0A3528] text-white rounded-full text-[11px] font-semibold shadow-2xs transition-colors"
                                >
                                  ثبت وصول قسط
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {studentRegistrations.length === 0 && (
          <div className="p-8 bg-neutral-50 rounded-3xl border border-neutral-200 text-center text-xs text-neutral-500 space-y-2">
            <p className="font-semibold text-neutral-700">این دانش‌آموز هنوز در هیچ دوره‌ای ثبت‌نام نکرده است.</p>
            <p className="text-[11px] text-neutral-400">اطلاعات هویتی و شماره‌های تماس فراگیر در بالا ثبت شده و قابل ویرایش است.</p>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Footer: Global Cross-System Navigation Connections            */}
        {/* ------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200">
          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('registrations', { q: student.nationalId, openDossierRegId: reg?.id });
                  }}
                  className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5"
                  title="انتقال به بخش مدیریت ثبت‌نام‌ها برای این دانش‌آموز"
                >
                  <ExternalLink size={12} />
                  <span>مدیریت ثبت‌نام‌ها</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('students', { q: student.nationalId, openStudentId: student.id });
                  }}
                  className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5"
                  title="انتقال به پرونده دانش‌آموزان"
                >
                  <UserCheck size={12} />
                  <span>پرونده دانش‌آموزان</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('finance', { q: student.nationalId });
                  }}
                  className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5"
                  title="فیلتر دفترچه اقساط برای این دانش‌آموز"
                >
                  <CreditCard size={12} />
                  <span>دفترچه اقساط</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white rounded-full transition-colors shadow-2xs"
            >
              بستن پرونده
            </button>
          </div>
        </div>
      </div>

      {/* HI-4: Record Payment with Jalali Date Modal */}
      {paymentModalItem && (
        <PaymentDateModal
          isOpen={Boolean(paymentModalItem)}
          onClose={() => setPaymentModalItem(null)}
          studentName={`${student.firstName} ${student.lastName}`}
          installmentTitle={paymentModalItem.title}
          amount={paymentModalItem.amount}
          dueDate={paymentModalItem.dueDate}
          onConfirm={handleConfirmPayment}
        />
      )}
    </Modal>
  );
};
