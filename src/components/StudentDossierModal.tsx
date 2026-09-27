/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Registration, RegistrationStatus, Student } from '../types';
import {
  toPersianDigits,
  toEnglishDigits,
  formatToman,
  getTodayJalali,
  isOverdue,
  daysOverdue,
  validateNationalId,
  validateIranianMobile,
} from '../utils';
import { Modal, Avatar, useToast, Field, ProgressBar } from '../ui';
import {
  IconCheck,
  IconClose,
  IconEdit,
  IconPrinter,
  IconPhone,
  IconCalendar,
  IconFinance,
  IconClasses,
  IconAlert,
  IconPlus,
  IconTrash,
} from '../icons';
import { LogoHelli } from '../Logo';
import { Clock, UserCheck, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

interface StudentDossierModalProps {
  registrationId?: string | null;
  studentId?: string | null;
  onClose: () => void;
}

export const StudentDossierModal: React.FC<StudentDossierModalProps> = ({
  registrationId,
  studentId,
  onClose,
}) => {
  const { state, dispatch, getStudentById, getClassById, getSessionById } = useAppStore();
  const { showToast } = useToast();
  const today = getTodayJalali();

  // Determine current student and registrations
  const initialReg = registrationId ? state.registrations.find((r) => r.id === registrationId) : null;
  const initialStudentId = initialReg ? initialReg.studentId : studentId;
  const student = initialStudentId ? getStudentById(initialStudentId) : null;

  // Student's all registrations
  const studentRegistrations = student
    ? state.registrations.filter((r) => r.studentId === student.id)
    : [];

  const [activeRegId, setActiveRegId] = useState<string | null>(
    registrationId || studentRegistrations[0]?.id || null
  );

  // Sync activeRegId when props change
  React.useEffect(() => {
    if (registrationId) {
      setActiveRegId(registrationId);
    } else if (studentRegistrations.length > 0) {
      setActiveRegId(studentRegistrations[0].id);
    } else {
      setActiveRegId(null);
    }
  }, [registrationId, studentId]);

  const reg = state.registrations.find((r) => r.id === activeRegId) || null;
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
  const [editPhones, setEditPhones] = useState<{ id: string; label: string; number: string }[]>([]);

  // Notes state
  const [editNotes, setEditNotes] = useState('');
  const [isPrintReceiptOpen, setIsPrintReceiptOpen] = useState(false);

  // Sync edit state when modal opens
  React.useEffect(() => {
    if (student) {
      setEditFirstName(student.firstName);
      setEditLastName(student.lastName);
      setEditFatherName(student.fatherName);
      setEditNationalId(student.nationalId);
      setEditGrade(student.grade);
      setEditSchool(student.school);
      setEditGpa(String(student.gpa));
      setEditPhones([...student.phones]);
    }
    if (reg) {
      setEditNotes(reg.notes || '');
    }
    setIsEditingStudent(false);
    setIsPrintReceiptOpen(false);
  }, [activeRegId, student?.id]);

  if (!student) return null;

  // Status Change handlers
  const handleStatusChange = (newStatus: RegistrationStatus) => {
    if (!reg) return;
    dispatch({ type: 'UPDATE_REGISTRATION_STATUS', payload: { id: reg.id, status: newStatus } });
    showToast(
      newStatus === 'approved'
        ? 'ثبت‌نام دانش‌آموز با موفقیت تأیید قطعی شد'
        : newStatus === 'cancelled'
        ? 'ثبت‌نام دانش‌آموز لغو شد'
        : 'پرونده به صف در انتظار بررسی بازگردانده شد',
      newStatus === 'approved' ? 'success' : 'info'
    );
  };

  // Toggle Installment Payment
  const handleToggleInstallment = (instId: string, isPaid: boolean) => {
    if (!reg) return;
    if (isPaid) {
      dispatch({ type: 'REFUND_INSTALLMENT', payload: { regId: reg.id, instId } });
      showToast('پرداخت قسط عودت داده شد و به حالت پرداخت‌نشده بازگشت', 'info');
    } else {
      dispatch({ type: 'MARK_INSTALLMENT_PAID', payload: { regId: reg.id, instId, paidAt: today } });
      showToast('پرداخت قسط با موفقیت در سیستم ثبت گردید', 'success');
    }
  };

  // Save Student Profile Edits
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFirstName.trim() || !editLastName.trim()) {
      showToast('نام و نام خانوادگی دانش‌آموز الزامی است', 'error');
      return;
    }

    const updatedStudent: Student = {
      ...student,
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
      fatherName: editFatherName.trim(),
      nationalId: toEnglishDigits(editNationalId.trim()),
      grade: editGrade,
      school: editSchool.trim(),
      gpa: parseFloat(toEnglishDigits(editGpa)) || student.gpa,
      phones: editPhones.filter((p) => p.number.trim().length > 0),
    };

    dispatch({ type: 'UPDATE_STUDENT', payload: updatedStudent });
    showToast('مشخصات دانش‌آموز با موفقیت به‌روزرسانی شد', 'success');
    setIsEditingStudent(false);
  };

  // Save Registration Notes
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

  // Financial Computations
  const totalAmount = reg ? reg.plan.installments.reduce((sum, i) => sum + i.amount, 0) : 0;
  const paidAmount = reg ? reg.plan.installments.filter((i) => i.paidAt).reduce((sum, i) => sum + i.amount, 0) : 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const totalInstallmentsCount = reg ? reg.plan.installments.length : 0;
  const paidCount = reg ? reg.plan.installments.filter((i) => i.paidAt).length : 0;

  return (
    <Modal
      isOpen={!!(registrationId || studentId)}
      onClose={onClose}
      title={`پرونده جامع دانش‌آموز - ${student.firstName} ${student.lastName}`}
      maxWidth="4xl"
    >
      <div className="space-y-6 text-right">
        {/* Multi-registration tabs if student has more than 1 course */}
        {studentRegistrations.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-neutral-100">
            <span className="text-xs text-neutral-500 font-medium shrink-0">دوره‌های ثبت‌نامی فراگیر:</span>
            {studentRegistrations.map((r, idx) => {
              const cls = getClassById(r.classId);
              const isSelected = r.id === activeRegId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveRegId(r.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {cls?.name || `دوره ${toPersianDigits(idx + 1)}`} ({toPersianDigits(r.code)})
                </button>
              );
            })}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Header Summary Banner                                         */}
        {/* ------------------------------------------------------------- */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-50 via-white to-blue-50/30 rounded-3xl border border-neutral-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={`${student.firstName} ${student.lastName}`} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-heading font-bold text-neutral-900">
                  {student.firstName} {student.lastName}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-medium">
                  پایه {student.grade}
                </span>
                {reg && reg.status === 'approved' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <IconCheck size={12} />
                    <span>تأیید شده</span>
                  </span>
                )}
                {reg && reg.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={12} />
                    <span>در انتظار بررسی</span>
                  </span>
                )}
                {reg && reg.status === 'cancelled' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <IconClose size={12} />
                    <span>لغو شده</span>
                  </span>
                )}
                {!reg && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                    بدون دوره فعال
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-400 mt-1 flex flex-wrap items-center gap-3">
                {reg && (
                  <>
                    <span>کد پیگیری: <strong className="text-neutral-700 font-mono">{reg.code}</strong></span>
                    <span>·</span>
                    <span>تاریخ ثبت: <strong className="text-neutral-700 font-mono">{toPersianDigits(reg.date)}</strong></span>
                    <span>·</span>
                  </>
                )}
                <span>کد ملی: <strong className="text-neutral-700 font-mono">{toPersianDigits(student.nationalId)}</strong></span>
                <span>·</span>
                <span>معدل: <strong className="text-neutral-700 font-mono">{toPersianDigits(student.gpa)}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          {reg ? (
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              {reg.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('approved')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <IconCheck size={14} />
                  <span>تأیید نهایی پذیرش</span>
                </button>
              )}

              {reg.status === 'approved' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('pending')}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Clock size={14} />
                  <span>انتقال به در انتظار</span>
                </button>
              )}

              {reg.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('cancelled')}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-full text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <IconClose size={14} />
                  <span>لغو ثبت‌نام</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsPrintReceiptOpen(true)}
                className="px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-full text-xs font-medium shadow-2xs transition-colors flex items-center gap-1.5"
                title="مشاهده و چاپ رسید رسمی"
              >
                <IconPrinter size={14} />
                <span>چاپ رسید</span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-neutral-500">
              پرونده هویتی آماده ثبت دوره
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Printable Receipt View (when toggled)                         */}
        {/* ------------------------------------------------------------- */}
        {isPrintReceiptOpen && reg && (
          <div className="p-5 bg-white rounded-3xl border border-neutral-300 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-700">پیش‌نمایش برگه رسمی ثبت‌نام</span>
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
                  <div>تاریخ: {toPersianDigits(reg.date)}</div>
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
                <div>شهریه کل: <strong>{formatToman(totalAmount)}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Section 1: Identity & Dossier with Inline Edit                */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h4 className="text-sm font-bold text-neutral-900 font-heading">
                مشخصات هویتی و تحصیلی فراگیر
              </h4>
            </div>

            {!isEditingStudent ? (
              <button
                type="button"
                onClick={() => setIsEditingStudent(true)}
                className="flex items-center gap-1 px-3 py-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-full text-xs font-medium transition-colors"
              >
                <IconEdit size={13} />
                <span>ویرایش اطلاعات دانش‌آموز</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
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
                <span className="text-neutral-400 block text-[11px]">معدل کارنامه قبلی:</span>
                <span className="font-bold text-neutral-900 mt-0.5 block font-mono">{toPersianDigits(student.gpa)}</span>
              </div>
              <div className="p-3 bg-neutral-50/70 rounded-2xl">
                <span className="text-neutral-400 block text-[11px]">شماره‌های تماس ثبت‌شده:</span>
                <div className="mt-1 space-y-1">
                  {student.phones.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-neutral-500">{p.label}:</span>
                      <span className="font-bold text-neutral-800">{toPersianDigits(p.number)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Inline Edit Form */
            <form onSubmit={handleSaveStudent} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="نام کوچک">
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </Field>
                <Field label="نام خانوادگی">
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </Field>
                <Field label="نام پدر">
                  <input
                    type="text"
                    value={editFatherName}
                    onChange={(e) => setEditFatherName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="کد ملی">
                  <input
                    type="text"
                    value={editNationalId}
                    onChange={(e) => setEditNationalId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-left"
                  />
                </Field>
                <Field label="مدرسه">
                  <input
                    type="text"
                    value={editSchool}
                    onChange={(e) => setEditSchool(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </Field>
                <Field label="معدل">
                  <input
                    type="text"
                    value={editGpa}
                    onChange={(e) => setEditGpa(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-left"
                  />
                </Field>
              </div>

              {/* Phone Numbers Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700">شماره‌های تماس اولیا و دانش‌آموز:</label>
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
                    <div key={phone.id} className="flex items-center gap-2 p-2 bg-neutral-50 rounded-xl border border-neutral-200/80">
                      <select
                        value={phone.label}
                        onChange={(e) =>
                          setEditPhones((prev) =>
                            prev.map((p) => (p.id === phone.id ? { ...p, label: e.target.value } : p))
                          )
                        }
                        className="text-xs bg-white border border-neutral-200 rounded-lg px-2 py-1"
                      >
                        <option value="پدر">پدر</option>
                        <option value="مادر">مادر</option>
                        <option value="دانش‌آموز">دانش‌آموز</option>
                        <option value="منزل">منزل</option>
                        <option value="ولی">ولی</option>
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
                  className="px-5 py-1.5 text-xs text-white bg-neutral-900 rounded-full hover:bg-neutral-800 font-semibold"
                >
                  ذخیره تغییرات مشخصات
                </button>
              </div>
            </form>
          )}
        </div>

        {reg ? (
          <>
            {/* ------------------------------------------------------------- */}
            {/* Section 2: Selected Course & Session                          */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <h4 className="text-sm font-bold text-neutral-900 font-heading">
                  مشخصات دوره آموزشی و زنگ انتخابی
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-neutral-50 rounded-2xl">
                  <span className="text-neutral-400 block text-[11px]">عنوان دوره:</span>
                  <span className="font-bold text-neutral-900 mt-0.5 block">{classRoom?.name || 'کلاس نامشخص'}</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl">
                  <span className="text-neutral-400 block text-[11px]">مدرس و استاد دوره:</span>
                  <span className="font-bold text-neutral-900 mt-0.5 block">{classRoom?.teacher || 'نامشخص'}</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl">
                  <span className="text-neutral-400 block text-[11px]">زمان‌بندی و زنگ کلاس:</span>
                  <span className="font-bold text-neutral-900 mt-0.5 block">{session?.label} ({session?.days} - {session?.time})</span>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Section 3: Financials & Installments with Quick Payment       */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h4 className="text-sm font-bold text-neutral-900 font-heading">
                    دفترچه اقساط و ثبت پرداخت‌های شهریه
                  </h4>
                </div>
                <div className="text-xs text-neutral-500 flex items-center gap-3">
                  <span>تعداد اقساط: <strong className="text-neutral-900 font-mono">{toPersianDigits(paidCount)} از {toPersianDigits(totalInstallmentsCount)}</strong></span>
                  <span>·</span>
                  <span>وصول‌شده: <strong className="text-emerald-700 font-mono">{formatToman(paidAmount)}</strong></span>
                  <span>·</span>
                  <span>مانده: <strong className="text-neutral-900 font-mono">{formatToman(remainingAmount)}</strong></span>
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
                      <th className="py-2.5 px-3 font-medium text-center">عملیات درجا</th>
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
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                <IconCheck size={13} />
                                <span>پرداخت شد ({toPersianDigits(inst.paidAt!)})</span>
                              </span>
                            ) : overdue ? (
                              <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                                <AlertTriangle size={13} />
                                <span>سررسید گذشته ({toPersianDigits(daysOverdue(inst.dueDate))} روز)</span>
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
                                onClick={() => handleToggleInstallment(inst.id, true)}
                                className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-[11px] font-medium transition-colors"
                              >
                                لغو پرداخت
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleInstallment(inst.id, false)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[11px] font-semibold shadow-2xs transition-colors"
                              >
                                ثبت پرداخت قسط
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

            {/* ------------------------------------------------------------- */}
            {/* Section 4: Registration Notes                                 */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-900 font-heading">
                  توضیحات و یادداشت‌های پرونده ثبت‌نام:
                </label>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="px-3.5 py-1 text-xs text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-full font-medium transition-colors"
                >
                  ذخیره یادداشت
                </button>
              </div>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="یادداشت‌های ویژه پیگیری ثبت‌نام، هماهنگی با اولیا، مدارک تحویل گرفته شده و..."
                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-hidden focus:bg-white focus:border-neutral-900 transition-all"
              />
            </div>
          </>
        ) : (
          <div className="p-8 bg-neutral-50 rounded-3xl border border-neutral-200 text-center text-xs text-neutral-500 space-y-2">
            <p className="font-semibold text-neutral-700">این دانش‌آموز هنوز در هیچ دوره‌ای ثبت‌نام نکرده است.</p>
            <p className="text-[11px] text-neutral-400">اطلاعات هویتی و شماره‌های تماس فراگیر در بالا ثبت شده و قابل ویرایش است.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
