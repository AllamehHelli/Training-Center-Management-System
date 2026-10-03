/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { useFieldSettings } from '../Settings';
import { validateStudent, buildStudentFromInput } from '../studentValidation';
import { RegistrationStatus, Student } from '../types';
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
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  Copy,
  Phone,
  CreditCard,
  ExternalLink,
  PhoneCall,
  GraduationCap,
  Sparkles,
  Calendar,
  Award,
} from 'lucide-react';
import { PaymentDateModal } from './PaymentDateModal';

export interface StudentDossierModalProps {
  registrationId?: string | null;
  studentId?: string | null;
  mode?: 'educational' | 'financial';
  onClose: () => void;
  onNavigate?: (view: any, filters?: any) => void;
}

export const StudentDossierModal: React.FC<StudentDossierModalProps> = ({
  registrationId,
  studentId,
  mode = 'educational',
  onClose,
  onNavigate,
}) => {
  const { state, dispatch, getStudentById, getClassById } = useAppStore();
  const { fieldSettings } = useFieldSettings();
  const { showToast } = useToast();
  const today = getTodayJalali();

  // Mode switcher: Educational vs Financial
  const [activeMode, setActiveMode] = useState<'educational' | 'financial'>(mode);

  useEffect(() => {
    if (mode) setActiveMode(mode);
  }, [mode]);

  // Determine current student and registrations
  const initialReg = registrationId ? state.registrations.find((r) => r.id === registrationId) : null;
  const initialStudentId = initialReg ? initialReg.studentId : studentId;
  const student = initialStudentId ? getStudentById(initialStudentId) : null;

  // Student's all registrations (active first)
  const studentRegistrations = student
    ? state.registrations.filter((r) => r.studentId === student.id)
    : [];

  const activeRegistrations = studentRegistrations.filter((r) => r.status !== 'cancelled');

  // activeTab can be a specific registration id OR 'all' for consolidated view in financial mode
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

  // Save Registration / Educational Notes
  const handleSaveNotes = () => {
    if (!reg) return;
    dispatch({
      type: 'UPDATE_REGISTRATION',
      payload: { ...reg, notes: editNotes.trim() },
    });
    showToast('یادداشت پرونده با موفقیت ذخیره شد', 'success');
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

  // Current single registration calculations
  const currentRegTotal = reg ? reg.plan.installments.reduce((sum, i) => sum + i.amount, 0) : 0;
  const currentRegPaid = reg ? reg.plan.installments.filter((i) => i.paidAt).reduce((sum, i) => sum + i.amount, 0) : 0;
  const currentRegRemaining = Math.max(0, currentRegTotal - currentRegPaid);
  const currentRegPaidCount = reg ? reg.plan.installments.filter((i) => i.paidAt).length : 0;
  const currentRegTotalCount = reg ? reg.plan.installments.length : 0;

  // Flattened all installments for the consolidated view in financial mode
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
      title={
        activeMode === 'educational'
          ? `پرونده آموزشی فراگیر - ${student.firstName} ${student.lastName}`
          : `پرونده مالی (اقساط و تسویه) - ${student.firstName} ${student.lastName}`
      }
      maxWidth="4xl"
    >
      <div className="space-y-4 text-right font-sans" dir="rtl">
        {/* ------------------------------------------------------------- */}
        {/* Top Header Mode Buttons: عناوین دقیق درخواست شده                 */}
        {/* 1. پرونده آموزشی                                             */}
        {/* 2. پرونده مالی (اقساط و تسویه)                               */}
        {/* ------------------------------------------------------------- */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-slate-100/90 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-2 p-1 bg-white rounded-xl shadow-2xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveMode('educational')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'educational'
                  ? 'bg-[#162E6E] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <GraduationCap size={16} />
              <span>پرونده آموزشی</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('financial')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'financial'
                  ? 'bg-[#0E7C5B] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <CreditCard size={16} />
              <span>پرونده مالی (اقساط و تسویه)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 px-2 flex items-center gap-2 shrink-0">
            <span>وضعیت پرونده:</span>
            <span className="font-bold text-slate-800">
              {activeRegistrations.length > 0
                ? `${toPersianDigits(activeRegistrations.length)} دوره فعال`
                : 'بدون ثبت‌نام فعال'}
            </span>
          </div>
        </div>

        {/* ============================================================= */}
        {/* MODE 1: EDUCATIONAL VIEW (اطلاعات هویتی + آموزشی در یک نگاه)   */}
        {/* بدون تکرار داده‌ها (پایه، کد ملی، نام پدر و... فقط یک‌بار)   */}
        {/* ============================================================= */}
        {activeMode === 'educational' && (
          <div className="space-y-4">
            {/* Top Identity & Academic Header Banner (نمایش یک‌بارِ داده‌ها) */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white rounded-3xl border border-blue-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <Avatar name={`${student.firstName} ${student.lastName}`} size="lg" />
                <div className="space-y-1">
                  {/* Name + Grade Badge (تنها جای نمایش پایه) + National ID + GPA */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-heading font-extrabold text-[#162E6E]">
                      {student.firstName} {student.lastName}
                    </h3>
                    {/* Grade Badge - ONLY HERE */}
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold border border-blue-200">
                      پایه {student.grade}
                    </span>

                    {/* National ID Badge - ONLY HERE */}
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-medium border border-slate-200">
                      کد ملی: {toPersianDigits(student.nationalId)}
                    </span>

                    {/* Academic Performance Badge */}
                    {student.gpa >= 18 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Sparkles size={12} className="text-amber-600" />
                        <span>رتبه الف تیزهوشان (معدل {toPersianDigits(student.gpa)})</span>
                      </span>
                    ) : student.gpa >= 15 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Award size={12} className="text-emerald-600" />
                        <span>سطح خیلی خوب (معدل {toPersianDigits(student.gpa)})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <span>معدل: {toPersianDigits(student.gpa)}</span>
                      </span>
                    )}
                  </div>

                  {/* Clean Identity Metadata (مدرسه، نام پدر و تاریخ ثبت) - بدون تکرار در کادرهای دیگر */}
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 pt-0.5">
                    <span>مدرسه: <strong className="text-slate-800">{student.school || 'نامشخص'}</strong></span>
                    <span>·</span>
                    <span>نام پدر: <strong className="text-slate-800">{student.fatherName || 'نامشخص'}</strong></span>
                    {student.createdAt && (
                      <>
                        <span>·</span>
                        <span>ثبت در سیستم: <strong className="font-mono text-slate-700">{toPersianDigits(student.createdAt)}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit Profile & Print */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                {!isEditingStudent ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingStudent(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    <IconEdit size={13} />
                    <span>ویرایش مشخصات</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingStudent(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    انصراف
                  </button>
                )}

                {reg && (
                  <button
                    type="button"
                    onClick={() => setIsPrintReceiptOpen(true)}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-medium shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="مشاهده و چاپ برگه رسمی پذیرش"
                  >
                    <IconPrinter size={13} />
                    <span>چاپ برگه پذیرش</span>
                  </button>
                )}
              </div>
            </div>

            {/* If Edit Profile Mode is open */}
            {isEditingStudent ? (
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
                <form onSubmit={handleSaveStudent} className="space-y-4 pt-1">
                  <h4 className="font-heading font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                    <IconEdit size={16} className="text-[#162E6E]" />
                    <span>ویرایش مشخصات هویتی و شماره‌های تماس دانش‌آموز</span>
                  </h4>

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
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </Field>
                    <Field label="نام خانوادگی" required={fieldSettings.lastName} error={editErrors.lastName}>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </Field>
                    <Field label="نام پدر" required={fieldSettings.fatherName} error={editErrors.fatherName}>
                      <input
                        type="text"
                        value={editFatherName}
                        onChange={(e) => setEditFatherName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="کد ملی" required={fieldSettings.nationalId} error={editErrors.nationalId}>
                      <input
                        type="text"
                        value={editNationalId}
                        onChange={(e) => setEditNationalId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-left"
                      />
                    </Field>
                    <Field label="مدرسه" required={fieldSettings.school} error={editErrors.school}>
                      <input
                        type="text"
                        value={editSchool}
                        onChange={(e) => setEditSchool(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </Field>
                    <Field label="معدل" required={fieldSettings.gpa} error={editErrors.gpa}>
                      <input
                        type="text"
                        value={editGpa}
                        onChange={(e) => setEditGpa(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-left"
                      />
                    </Field>
                  </div>

                  {/* Phone Numbers Editor */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        شماره‌های تماس اولیا و دانش‌آموز:{fieldSettings.phones && <span className="text-[#D64545]"> *</span>}
                      </label>
                      <button
                        type="button"
                        onClick={handleAddPhone}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <IconPlus size={12} />
                        <span>افزودن شماره تماس</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {editPhones.map((phone) => (
                        <div
                          key={phone.id}
                          className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/80"
                        >
                          <select
                            value={phone.label}
                            onChange={(e) =>
                              setEditPhones((prev) =>
                                prev.map((p) => (p.id === phone.id ? { ...p, label: e.target.value } : p))
                              )
                            }
                            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1"
                          >
                            <option value="پدر">پدر</option>
                            <option value="مادر">مادر</option>
                            <option value="دانش‌آموز">دانش‌آموز</option>
                            <option value="منزل">منزل</option>
                            <option value="ولی">ولی</option>
                          </select>
                          <input
                            type="text"
                            value={phone.number}
                            onChange={(e) =>
                              setEditPhones((prev) =>
                                prev.map((p) => (p.id === phone.id ? { ...p, number: e.target.value } : p))
                              )
                            }
                            placeholder="0912..."
                            className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-mono text-left"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhone(phone.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                            title="حذف شماره"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingStudent(false)}
                      className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold text-white bg-[#162E6E] hover:bg-[#0f204d] rounded-xl shadow-xs cursor-pointer"
                    >
                      ذخیره تغییرات مشخصات
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Contact Numbers Card (شماره‌های تماس کامل با قابلیت تماس و کپی - بدون تکرار پایه و مشخصات) */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Phone size={15} className="text-blue-600" />
                      <h4 className="text-xs font-bold text-slate-900 font-heading">
                        شماره‌های تماس اولیا و ارتباط مستقیم
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {toPersianDigits(student.phones.length)} شماره ثبت‌شده
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
                          className="flex items-center justify-between p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${
                                isFather
                                  ? 'bg-blue-100 text-blue-800'
                                  : isMother
                                  ? 'bg-purple-100 text-purple-800'
                                  : isGuardian
                                  ? 'bg-amber-100 text-amber-800'
                                  : isStudent
                                  ? 'bg-teal-100 text-teal-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {p.label}
                            </span>
                            <span className="font-bold text-slate-800 font-mono text-xs truncate" dir="ltr">
                              {toPersianDigits(p.number)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`tel:${p.number}`}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title={`تماس با ${p.label}`}
                            >
                              <PhoneCall size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(p.number);
                                showToast(`شماره ${p.label} (${p.number}) کپی شد`, 'info');
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                              title="کپی شماره"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Academic Counselor Card (مشاور تحصیلی اختصاصی) */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <HeartHandshake size={16} className="text-teal-600" />
                      <h4 className="text-xs font-bold text-slate-900 font-heading">
                        مشاور تحصیلی و برنامه‌ریزی درسی
                      </h4>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-3.5 bg-teal-50/60 rounded-2xl border border-teal-100">
                    <div>
                      {student.counselorId ? (
                        <div className="space-y-1">
                          <div className="font-heading font-extrabold text-slate-900 text-xs">
                            مشاور تحصیلی: مشاور {student.counselorName}
                          </div>
                          {(() => {
                            const cns = (state.counselors || []).find((c) => c.id === student.counselorId);
                            return cns ? (
                              <div className="text-[11px] text-teal-800 space-y-0.5">
                                <p>حوزه تخصص: {cns.specialty || 'هدایت تحصیلی و تیزهوشان'}</p>
                                {cns.phone && (
                                  <p>
                                    تماس مستقیم مشاور: <span className="font-mono font-bold" dir="ltr">{toPersianDigits(cns.phone)}</span>
                                  </p>
                                )}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-amber-800 text-xs">
                            هنوز مشاوری به این دانش‌آموز اختصاص نیافته است.
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            می‌توانید از منوی روبرو یک مشاور از بانک مشاوران موسسه برای این فراگیر تعیین کنید.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-600 font-medium">تغییر / تخصیص مشاور:</span>
                      <select
                        value={student.counselorId || ''}
                        onChange={(e) => handleQuickAssignCounselor(e.target.value)}
                        className="text-xs bg-white border border-teal-300 rounded-xl px-3 py-1.5 text-teal-950 font-bold focus:outline-hidden shadow-2xs"
                      >
                        <option value="">-- بدون مشاور --</option>
                        {(state.counselors || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            مشاور {c.firstName} {c.lastName} ({c.specialty || 'هدایت تحصیلی'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Enrolled Courses & Timetable (دوره‌های آموزشی ثبت‌نامی و زمان‌بندی زنگ‌ها) */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <GraduationCap size={16} className="text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-900 font-heading">
                        دوره‌های آموزشی ثبت‌نامی و برنامه هفتگی زنگ‌ها
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500">
                      {toPersianDigits(studentRegistrations.length)} دوره ثبت‌شده
                    </span>
                  </div>

                  {studentRegistrations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                      این دانش‌آموز هنوز در هیچ دوره آموزشی ثبت‌نام نکرده است.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {studentRegistrations.map((r, idx) => {
                        const cls = getClassById(r.classId);
                        const ses = cls?.sessions.find((s) => s.id === r.sessionId);
                        const isApproved = r.status === 'approved';
                        const isPending = r.status === 'pending';
                        const isCancelled = r.status === 'cancelled';

                        return (
                          <div
                            key={r.id}
                            className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-heading font-extrabold text-slate-900 text-xs">
                                  {cls?.name || `دوره شماره ${toPersianDigits(idx + 1)}`}
                                </h5>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  مدرس: <strong className="text-slate-700">{cls?.teacher || 'نامشخص'}</strong>
                                </p>
                              </div>

                              <div>
                                {isApproved && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    تأیید پذیرش
                                  </span>
                                )}
                                {isPending && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    در انتظار بررسی
                                  </span>
                                )}
                                {isCancelled && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    انصراف / لغو
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="p-2 bg-white rounded-xl border border-slate-100 text-xs space-y-1">
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <Calendar size={13} className="text-slate-400 shrink-0" />
                                <span>زنگ کلاسی:</span>
                                <strong className="text-slate-900">
                                  {ses ? `${ses.label} (${ses.days} - ${ses.time})` : 'تعیین نشده'}
                                </strong>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                <span>کد ثبت‌نام: <strong className="font-mono text-slate-700">{r.code}</strong></span>
                                <span>تاریخ پذیرش: <strong className="font-mono text-slate-700">{toPersianDigits(r.date)}</strong></span>
                              </div>
                            </div>

                            {/* Quick Status Toggle */}
                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex items-center gap-1">
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange('approved', r.id)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <IconCheck size={12} />
                                    <span>تأیید پذیرش</span>
                                  </button>
                                )}
                                {isApproved && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange('pending', r.id)}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                                  >
                                    تغییر به انتظار
                                  </button>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRegId(r.id);
                                  setIsPrintReceiptOpen(true);
                                }}
                                className="text-[11px] text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                <IconPrinter size={12} />
                                <span>چاپ برگه</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Educational Progress & Counseling Notes */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      <label className="text-xs font-bold text-slate-900 font-heading">
                        سوابق، ارزیابی‌ها و یادداشت‌های آموزشی فراگیر:
                      </label>
                    </div>
                    {reg && (
                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        className="px-3.5 py-1 text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-full font-semibold transition-colors shadow-2xs cursor-pointer"
                      >
                        ذخیره یادداشت
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400">ثبت سریع سوابق:</span>
                    {[
                      'جلسه مشاوره و برنامه‌ریزی درسی انجام شد',
                      'کارنامه و نمرات آزمون‌های کلاسی بررسی شد',
                      'هماهنگی جلسه با اولیای دانش‌آموز',
                      'برنامه مطالعاتی جامع تیزهوشان تحویل داده شد',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setEditNotes((prev) => (prev ? `${prev}\n• ${today}: ${preset}` : `• ${today}: ${preset}`));
                        }}
                        className="text-[10px] px-2.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="ثبت نکات ارزیابی آموزشی، نقاط قوت و ضعف در دروس، گزارش جلسات اولیا و وضعیت پیشرفت تحصیلی..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:bg-white focus:border-slate-900 transition-all"
                  />
                </div>

                {/* Bottom Bridge to Financial Dossier */}
                <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <CreditCard size={16} className="text-[#0E7C5B]" />
                    <span>نیاز به بررسی شهریه‌ها، اقساط و ثبت پرداخت‌ها دارید؟</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMode('financial')}
                    className="px-3.5 py-1.5 bg-[#0E7C5B] hover:bg-[#0A3528] text-white rounded-xl font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>انتقال به پرونده مالی (اقساط و تسویه)</span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* MODE 2: FINANCIAL VIEW (پرونده هویتی + مالی فراگیر)           */}
        {/* بدون داده‌های تکراری: تمرکز بر اطلاعات ارتباطی، بدهی و اقساط  */}
        {/* ============================================================= */}
        {activeMode === 'financial' && (
          <div className="space-y-4">
            {/* Top Financial & Direct Contact Strip (تنها جای نمایش مشخصات هویتی و شماره‌های تماس پیگیری) */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/70 via-teal-50/30 to-white rounded-3xl border border-emerald-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <Avatar name={`${student.firstName} ${student.lastName}`} size="lg" />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-heading font-extrabold text-slate-900">
                      {student.firstName} {student.lastName}
                    </h3>

                    {/* Grade Badge - ONLY ONCE */}
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      پایه {student.grade}
                    </span>

                    {/* National ID - ONLY ONCE */}
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-medium border border-slate-200">
                      کد ملی: {toPersianDigits(student.nationalId)}
                    </span>

                    {/* Financial Status Tag */}
                    {grandOverdueCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-50 text-[#D64545] border border-red-200 rounded-full text-xs font-bold">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>{toPersianDigits(grandOverdueCount)} قسط معوق</span>
                      </span>
                    ) : grandTotalRemaining === 0 && grandTotalTuition > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                        <CheckCircle2 size={12} className="shrink-0" />
                        <span>تسویه کامل کلیه دوره‌ها</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                        <Clock size={12} className="shrink-0" />
                        <span>اقساط جاری بر برنامه</span>
                      </span>
                    )}
                  </div>

                  {/* Immediate Contact Strip for Financial Officer (شماره‌ها برای تماس مستقیم و پیگیری) */}
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2 pt-0.5">
                    <span>نام پدر: <strong className="text-slate-800">{student.fatherName || 'نامشخص'}</strong></span>
                    <span>·</span>
                    <span className="text-slate-500">شماره‌های پیگیری مالی:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {student.phones.map((p) => (
                        <div
                          key={p.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-lg border border-slate-200 text-[11px] shadow-2xs"
                        >
                          <span className="text-slate-400">{p.label}:</span>
                          <span className="font-mono font-bold text-slate-800" dir="ltr">
                            {toPersianDigits(p.number)}
                          </span>
                          <a
                            href={`tel:${p.number}`}
                            className="text-emerald-700 hover:text-emerald-900 p-0.5"
                            title={`تماس با ${p.label}`}
                          >
                            <PhoneCall size={11} />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(p.number);
                              showToast(`شماره ${p.label} کپی شد`, 'info');
                            }}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title="کپی"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit or Print */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                {!isEditingStudent ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingStudent(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    <IconEdit size={13} />
                    <span>ویرایش مشخصات</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingStudent(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    انصراف
                  </button>
                )}

                {reg && (
                  <button
                    type="button"
                    onClick={() => setIsPrintReceiptOpen(true)}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-medium shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconPrinter size={13} />
                    <span>چاپ رسید مالی</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aggregated Financial Overview (4 Clean Metric Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-400 block text-[11px]">مجموع کل شهریه‌ها:</span>
                <span className="font-bold text-slate-900 font-mono text-sm mt-1 block">
                  {formatToman(grandTotalTuition)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 shadow-2xs">
                <span className="text-emerald-700 block text-[11px]">مجموع وصول‌شده:</span>
                <span className="font-bold text-emerald-900 font-mono text-sm mt-1 block">
                  {formatToman(grandTotalPaid)}
                </span>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-400 block text-[11px]">مانده کل بدهی:</span>
                <span
                  className={`font-bold font-mono text-sm mt-1 block ${
                    grandTotalRemaining > 0 ? 'text-amber-800' : 'text-slate-700'
                  }`}
                >
                  {formatToman(grandTotalRemaining)}
                </span>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-400 block text-[11px]">معوقات سررسید گذشته:</span>
                <span
                  className={`font-bold font-mono text-sm mt-1 block ${
                    grandTotalOverdue > 0 ? 'text-[#D64545]' : 'text-emerald-700'
                  }`}
                >
                  {grandTotalOverdue > 0 ? formatToman(grandTotalOverdue) : '۰ تومان (بدون معوق)'}
                </span>
              </div>
            </div>

            {/* Course Navigation Tabs & Consolidated Ledger */}
            {studentRegistrations.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span className="text-xs text-slate-500 font-medium shrink-0 ml-1">انتخاب دوره:</span>
                    {studentRegistrations.map((r, idx) => {
                      const cls = getClassById(r.classId);
                      const isSelected = r.id === activeRegId;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setActiveRegId(r.id)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-[#0E7C5B] text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                          activeRegId === 'all'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>همه اقساط فراگیر ({toPersianDigits(allConsolidatedInstallments.length)})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Single Course Installments */}
                {reg ? (
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-[#0E7C5B]" />
                        <h4 className="text-xs font-bold text-slate-900 font-heading">
                          دفترچه اقساط {classRoom?.name || 'این دوره'}
                        </h4>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3">
                        <span>
                          وصول‌شده: <strong className="text-slate-900 font-mono">{toPersianDigits(currentRegPaidCount)} از {toPersianDigits(currentRegTotalCount)}</strong>
                        </span>
                        <span>·</span>
                        <span>مبلغ وصول: <strong className="text-emerald-700 font-mono">{formatToman(currentRegPaid)}</strong></span>
                        <span>·</span>
                        <span>مانده: <strong className="text-slate-900 font-mono">{formatToman(currentRegRemaining)}</strong></span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 bg-slate-50/50">
                            <th className="py-2.5 px-3 font-medium">ردیف</th>
                            <th className="py-2.5 px-3 font-medium">عنوان قسط</th>
                            <th className="py-2.5 px-3 font-medium">مبلغ قسط</th>
                            <th className="py-2.5 px-3 font-medium">موعد سررسید</th>
                            <th className="py-2.5 px-3 font-medium">وضعیت تسویه</th>
                            <th className="py-2.5 px-3 font-medium text-center">عملیات مالی درجا</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reg.plan.installments.map((inst, index) => {
                            const overdue = isOverdue(inst.dueDate, inst.paidAt);
                            const isPaid = !!inst.paidAt;

                            return (
                              <tr key={inst.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 font-mono text-slate-500">{toPersianDigits(index + 1)}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">{inst.title}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{formatToman(inst.amount)}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">{toPersianDigits(inst.dueDate)}</td>
                                <td className="py-2.5 px-3">
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
                                    <span className="inline-flex items-center gap-1 text-slate-500">
                                      <Clock size={13} />
                                      <span>در انتظار سررسید</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isPaid ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInstallment(reg.id, inst.id, true)}
                                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[11px] font-medium transition-colors cursor-pointer"
                                    >
                                      عودت پرداخت
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInstallment(reg.id, inst.id, false)}
                                      className="px-3.5 py-1 bg-[#0E7C5B] hover:bg-[#0A3528] text-white rounded-full text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer"
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
                ) : (
                  /* Multi-Course Consolidated Table */
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-[#0E7C5B]" />
                        <h4 className="text-xs font-bold text-slate-900 font-heading">
                          دفترچه تجمیعی اقساط کلیه دوره‌های فراگیر
                        </h4>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        مجموع {toPersianDigits(allConsolidatedInstallments.length)} قسط
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 bg-slate-50/50">
                            <th className="py-2.5 px-3 font-medium">ردیف</th>
                            <th className="py-2.5 px-3 font-medium">دوره آموزشی</th>
                            <th className="py-2.5 px-3 font-medium">عنوان قسط</th>
                            <th className="py-2.5 px-3 font-medium">مبلغ قسط</th>
                            <th className="py-2.5 px-3 font-medium">موعد سررسید</th>
                            <th className="py-2.5 px-3 font-medium">وضعیت تسویه</th>
                            <th className="py-2.5 px-3 font-medium text-center">عملیات مالی</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allConsolidatedInstallments.map((item, index) => {
                            const inst = item.installment;
                            const overdue = isOverdue(inst.dueDate, inst.paidAt);
                            const isPaid = !!inst.paidAt;

                            return (
                              <tr key={`${item.regId}-${inst.id}`} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 font-mono text-slate-500">{toPersianDigits(index + 1)}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  <div>{item.courseName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">کد: {item.regCode}</div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-700">{inst.title}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{formatToman(inst.amount)}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">{toPersianDigits(inst.dueDate)}</td>
                                <td className="py-2.5 px-3">
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
                                    <span className="inline-flex items-center gap-1 text-slate-500">
                                      <Clock size={13} />
                                      <span>در انتظار سررسید</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isPaid ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInstallment(item.regId, inst.id, true)}
                                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[11px] font-medium transition-colors cursor-pointer"
                                    >
                                      عودت پرداخت
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInstallment(item.regId, inst.id, false)}
                                      className="px-3.5 py-1 bg-[#0E7C5B] hover:bg-[#0A3528] text-white rounded-full text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer"
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

                {/* Financial Notes & Follow-ups */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 font-heading">
                      یادداشت‌ها و پیگیری مالی این پرونده:
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="px-3.5 py-1 text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-full font-semibold transition-colors shadow-2xs cursor-pointer"
                    >
                      ذخیره یادداشت مالی
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400">ثبت سریع پیگیری:</span>
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
                        className="text-[10px] px-2.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="یادداشت‌های پیگیری مالی، توافقات اقساطی با اولیا، شماره چک یا فیش واریزی..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:bg-white focus:border-slate-900 transition-all"
                  />
                </div>

                {/* Bottom Bridge to Educational Dossier */}
                <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <GraduationCap size={16} className="text-[#162E6E]" />
                    <span>مشاهده کلاس‌ها، زنگ‌ها، نمرات و مشاور تحصیلی فراگیر:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMode('educational')}
                    className="px-3.5 py-1.5 bg-[#162E6E] hover:bg-[#0f204d] text-white rounded-xl font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>انتقال به پرونده آموزشی</span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Printable Official Card / Receipt Preview                     */}
        {/* ------------------------------------------------------------- */}
        {isPrintReceiptOpen && reg && (
          <div className="p-5 bg-white rounded-3xl border border-slate-300 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">پیش‌نمایش برگه رسمی ثبت‌نام و پذیرش</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-medium flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <IconPrinter size={13} />
                  <span>پرینت برگه</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintReceiptOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>

            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <LogoHelli size={34} />
                  <div>
                    <h4 className="font-heading font-bold text-slate-900 text-sm">آموزشگاه تیزهوشان علامه حلی</h4>
                    <p className="text-[10px] text-slate-500">برگه رسمی ثبت‌نام فراگیر و مشخصات دوره</p>
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
                <div>مدرس: <strong>{classRoom?.teacher}</strong></div>
                <div>زنگ: <strong>{session?.label}</strong></div>
                <div>شهریه دوره: <strong>{formatToman(currentRegTotal)}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Footer: Quick Actions & Close                                 */}
        {/* ------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('students', { q: student.nationalId, openStudentId: student.id });
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeMode === 'educational'
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="انتقال به بخش پرونده دانش‌آموزان"
                >
                  <GraduationCap size={13} />
                  <span>پرونده دانش‌آموزان</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('finance', { q: student.nationalId });
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeMode === 'financial'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="انتقال به بخش امور مالی و اقساط"
                >
                  <CreditCard size={13} />
                  <span>امور مالی و اقساط</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('registrations', { q: student.nationalId, openDossierRegId: reg?.id });
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="انتقال به بخش مدیریت ثبت‌نام‌ها"
                >
                  <ExternalLink size={12} />
                  <span>مدیریت ثبت‌نام‌ها</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-full transition-colors shadow-2xs cursor-pointer"
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
