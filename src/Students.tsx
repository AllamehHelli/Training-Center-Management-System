/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from './store';
import { useFieldSettings } from './Settings';
import {
  toPersianDigits,
  toEnglishDigits,
  validateIranianMobile,
  validateNationalId,
  downloadCSV,
  getTodayJalali,
  formatToman,
} from './utils';
import { Student, PhoneNumber, StudentGrade } from './types';
import { Modal, ConfirmModal, Avatar, useToast, Field, InfoTooltip } from './ui';
import {
  IconPlus,
  IconSearch,
  IconDownload,
  IconUpload,
  IconEdit,
  IconTrash,
  IconPhone,
  IconCheck,
  IconAlert,
  IconClose,
} from './icons';
import { LogoHelli } from './Logo';
import { StudentDossierModal } from './components/StudentDossierModal';

export const Students: React.FC = () => {
  const { state, dispatch, getStudentRegistrations, getClassById } = useAppStore();
  const { fieldSettings, grades } = useFieldSettings();
  const { showToast } = useToast();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [dossierStudent, setDossierStudent] = useState<Student | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formGrade, setFormGrade] = useState<StudentGrade>(grades[0] || 'هفتم');
  const [formGpa, setFormGpa] = useState<string>('20.00');
  const [formSchool, setFormSchool] = useState('');
  const [formPhones, setFormPhones] = useState<PhoneNumber[]>([
    { id: 'p-init-1', label: 'پدر', number: '0912' },
  ]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Bulk Import State
  const [bulkText, setBulkText] = useState('');
  const [bulkValidationErrors, setBulkValidationErrors] = useState<string[]>([]);
  const [bulkValidCount, setBulkValidCount] = useState<number>(0);

  // Filter students
  const filteredStudents = state.students.filter((student) => {
    if (gradeFilter !== 'all' && student.grade !== gradeFilter) return false;
    if (!searchTerm) return true;

    const term = searchTerm.trim().toLowerCase();
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    const nid = student.nationalId.toLowerCase();
    const school = student.school.toLowerCase();
    const matchesPhone = student.phones.some((p) =>
      p.number.includes(toEnglishDigits(term))
    );

    return fullName.includes(term) || nid.includes(term) || school.includes(term) || matchesPhone;
  });

  // Open Form for Add or Edit
  const openForm = (student?: Student) => {
    setFormErrors({});
    if (student) {
      setEditingStudent(student);
      setFormFirstName(student.firstName);
      setFormLastName(student.lastName);
      setFormFatherName(student.fatherName);
      setFormNationalId(student.nationalId);
      setFormGrade(student.grade);
      setFormGpa(student.gpa.toString());
      setFormSchool(student.school);
      setFormPhones(student.phones.length > 0 ? [...student.phones] : [{ id: 'p-1', label: 'پدر', number: '' }]);
    } else {
      setEditingStudent(null);
      setFormFirstName('');
      setFormLastName('');
      setFormFatherName('');
      setFormNationalId('');
      setFormGrade('هفتم');
      setFormGpa('20.00');
      setFormSchool('');
      setFormPhones([{ id: `p-${Date.now()}-1`, label: 'پدر', number: '' }]);
    }
    setIsFormModalOpen(true);
  };

  // Phone numbers handlers
  const handleAddPhoneRow = () => {
    setFormPhones((prev) => [
      ...prev,
      { id: `p-${Date.now()}-${prev.length + 1}`, label: 'مادر', number: '' },
    ]);
  };

  const handleUpdatePhoneRow = (id: string, field: 'label' | 'number', val: string) => {
    setFormPhones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const handleRemovePhoneRow = (id: string) => {
    if (formPhones.length <= 1) {
      showToast('حداقل یک ردیف شماره تماس باید باقی بماند', 'info');
      return;
    }
    setFormPhones((prev) => prev.filter((p) => p.id !== id));
  };

  // Form Validation & Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    // Validate fields according to fieldSettings
    if (fieldSettings.firstName && !formFirstName.trim()) {
      errors.firstName = 'نام کوچک دانش‌آموز الزامی است';
    }
    if (fieldSettings.lastName && !formLastName.trim()) {
      errors.lastName = 'نام خانوادگی الزامی است';
    }
    if (fieldSettings.fatherName && !formFatherName.trim()) {
      errors.fatherName = 'نام پدر الزامی است';
    }

    // National ID
    if (fieldSettings.nationalId) {
      const nidCheck = validateNationalId(formNationalId);
      if (!nidCheck.isValid) {
        errors.nationalId = nidCheck.message;
      } else {
        // Check uniqueness
        const dup = state.students.find(
          (s) => s.nationalId === toEnglishDigits(formNationalId) && s.id !== editingStudent?.id
        );
        if (dup) {
          errors.nationalId = 'کد ملی وارد شده قبلاً برای دانش‌آموز دیگری ثبت شده است';
        }
      }
    }

    // GPA
    const gpaNum = parseFloat(toEnglishDigits(formGpa));
    if (fieldSettings.gpa) {
      if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 20) {
        errors.gpa = 'معدل باید عددی بین ۰ تا ۲۰ باشد';
      }
    }

    // School
    if (fieldSettings.school && !formSchool.trim()) {
      errors.school = 'نام مدرسه فعلی الزامی است';
    }

    // Phones
    if (fieldSettings.phones) {
      if (formPhones.length === 0) {
        errors.phones = 'حداقل یک شماره تماس الزامی است';
      } else {
        let phoneErr = '';
        for (let i = 0; i < formPhones.length; i++) {
          const ph = formPhones[i];
          const check = validateIranianMobile(ph.number);
          if (!check.isValid) {
            phoneErr = `ردیف ${toPersianDigits(i + 1)} (${ph.label}): ${check.message}`;
            break;
          }
        }
        if (phoneErr) {
          errors.phones = phoneErr;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const cleanPhones = formPhones.map((p) => ({
      ...p,
      number: toEnglishDigits(p.number).trim(),
    }));

    if (editingStudent) {
      const updated: Student = {
        ...editingStudent,
        firstName: formFirstName.trim(),
        lastName: formLastName.trim(),
        fatherName: formFatherName.trim(),
        nationalId: toEnglishDigits(formNationalId).trim(),
        grade: formGrade,
        gpa: isNaN(gpaNum) ? 20.0 : gpaNum,
        school: formSchool.trim(),
        phones: cleanPhones,
      };
      dispatch({ type: 'UPDATE_STUDENT', payload: updated });
      showToast('اطلاعات دانش‌آموز با موفقیت به‌روزرسانی شد', 'success');
    } else {
      const newStudent: Student = {
        id: `std-${Date.now()}`,
        firstName: formFirstName.trim(),
        lastName: formLastName.trim(),
        fatherName: formFatherName.trim(),
        nationalId: toEnglishDigits(formNationalId).trim(),
        grade: formGrade,
        gpa: isNaN(gpaNum) ? 20.0 : gpaNum,
        school: formSchool.trim(),
        phones: cleanPhones,
        createdAt: getTodayJalali(),
      };
      dispatch({ type: 'ADD_STUDENT', payload: newStudent });
      showToast(`پرونده دانش‌آموز ${newStudent.firstName} ${newStudent.lastName} تشکیل شد`, 'success');
    }

    setIsFormModalOpen(false);
  };

  // Delete Student
  const handleDeleteStudent = (id: string) => {
    dispatch({ type: 'DELETE_STUDENT', payload: id });
    showToast('پرونده دانش‌آموز و ثبت‌نام‌های مربوطه حذف شدند', 'info');
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['نام', 'نام خانوادگی', 'نام پدر', 'کد ملی', 'پایه', 'معدل', 'مدرسه', 'شماره‌های تماس'];
    const rows = state.students.map((s) => {
      const phoneList = s.phones.map((p) => `${p.label}: ${p.number}`).join(' | ');
      return [
        `"${s.firstName}"`,
        `"${s.lastName}"`,
        `"${s.fatherName}"`,
        `"${s.nationalId}"`,
        `"${s.grade}"`,
        `"${s.gpa}"`,
        `"${s.school}"`,
        `"${phoneList}"`,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    downloadCSV(`students-${getTodayJalali().replace(/\//g, '-')}.csv`, csv);
    showToast('فهرست دانش‌آموزان به صورت فایل CSV دانلود شد', 'info');
  };

  // -------------------------------------------------------------
  // Bulk CSV Import Logic
  // -------------------------------------------------------------
  const sampleCSVText = `نام,نام خانوادگی,نام پدر,کد ملی,پایه,معدل,مدرسه,شماره همراه
سامان,یوسفی,محسن,0041238910,هشتم,19.90,علامه حلی ۲,09121234567
روژان,کریمیان,داریوش,0056781290,نهم,20.00,فرزانگان ۴,09129876543
مهبد,انصاری,حسین,0067894512,ششم,19.85,دبستان اندیشه نو,09351112233`;

  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    validateBulkCSV(text);
  };

  const validateBulkCSV = (text: string) => {
    const lines = text.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      setBulkValidationErrors(['لطفاً حداقل یک ردیف داده وارد نمایید.']);
      setBulkValidCount(0);
      return;
    }

    const errors: string[] = [];
    let validCount = 0;

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1;
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 8) {
        errors.push(`سطر ${toPersianDigits(lineNum)}: تعداد ستون‌ها کمتر از ۸ ستون الزامی است.`);
        continue;
      }

      const [fn, ln, fath, nid, gr, gpa, sch, phone] = parts;

      if (!fn || !ln) {
        errors.push(`سطر ${toPersianDigits(lineNum)}: نام یا نام خانوادگی خالی است.`);
        continue;
      }

      const nidCheck = validateNationalId(nid);
      if (!nidCheck.isValid) {
        errors.push(`سطر ${toPersianDigits(lineNum)}: کد ملی نامعتبر است (${nidCheck.message})`);
        continue;
      }

      const phoneCheck = validateIranianMobile(phone);
      if (!phoneCheck.isValid) {
        errors.push(`سطر ${toPersianDigits(lineNum)}: شماره موبایل نامعتبر است (${phoneCheck.message})`);
        continue;
      }

      validCount++;
    }

    setBulkValidationErrors(errors);
    setBulkValidCount(validCount);
  };

  const handleBulkInsertSample = () => {
    setBulkText(sampleCSVText);
    validateBulkCSV(sampleCSVText);
  };

  const handleBulkCopySample = () => {
    navigator.clipboard.writeText(sampleCSVText);
    showToast('نمونه CSV در کلیپ‌بورد کپی شد', 'info');
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setBulkText(content);
      validateBulkCSV(content);
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = () => {
    const lines = bulkText.trim().split('\n').filter((l) => l.trim().length > 0);
    const parsedStudents: Student[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 8) continue;

      const [fn, ln, fath, nid, gr, gpaStr, sch, phone] = parts;
      const cleanNid = toEnglishDigits(nid);
      const cleanPhone = toEnglishDigits(phone);

      parsedStudents.push({
        id: `std-bulk-${Date.now()}-${i}`,
        firstName: fn,
        lastName: ln,
        fatherName: fath || '',
        nationalId: cleanNid,
        grade: gr || 'هفتم',
        gpa: parseFloat(gpaStr) || 20.0,
        school: sch || '',
        phones: [{ id: `p-bulk-${Date.now()}-${i}`, label: 'همراه', number: cleanPhone }],
        createdAt: getTodayJalali(),
      });
    }

    if (parsedStudents.length === 0) {
      showToast('هیچ ردیف معتبری برای افزودن یافت نشد', 'error');
      return;
    }

    dispatch({ type: 'BULK_ADD_STUDENTS', payload: parsedStudents });
    showToast(`${toPersianDigits(parsedStudents.length)} دانش‌آموز با موفقیت وارد سامانه شدند`, 'success');
    setIsBulkModalOpen(false);
    setBulkText('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-900">پرونده دانش‌آموزان</h2>
            <InfoTooltip
              title="بانک اطلاعاتی دانش‌آموزان"
              content="مدیریت جامع پرونده هویتی دانش‌آموزان، کد ملی، شماره‌های تماس متعدد (پدر، مادر، دانش‌آموز) و امکان ورود دسته‌جمعی از فایل اکسل."
            />
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            مشخصات هویتی، اطلاعات اولیا و شماره‌های تماس فراگیران
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
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200/80 rounded-full hover:bg-neutral-50 transition-colors shadow-2xs"
          >
            <IconUpload size={14} />
            <span>ورود دسته‌جمعی از فایل</span>
          </button>
          <button
            type="button"
            onClick={() => openForm()}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-full hover:bg-neutral-800 transition-colors shadow-xs"
          >
            <IconPlus size={15} />
            <span>دانش‌آموز جدید</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
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
            placeholder="جستجو در نام، کد ملی، نام مدرسه یا تمامی شماره‌های تماس..."
            className="w-full pl-3.5 pr-9 py-2 text-xs bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white border border-neutral-200/80 rounded-full focus:outline-hidden transition-all"
          />
        </div>

        {/* Grade tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100/80 rounded-full shrink-0">
          <button
            type="button"
            onClick={() => setGradeFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              gradeFilter === 'all'
                ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            همه پایه‌ها ({toPersianDigits(state.students.length)})
          </button>
          {grades.map((grade) => {
            const count = state.students.filter((s) => s.grade === grade).length;
            return (
              <button
                key={grade}
                type="button"
                onClick={() => setGradeFilter(grade)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  gradeFilter === grade
                    ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                پایه {grade} ({toPersianDigits(count)})
              </button>
            );
          })}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/70 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-neutral-50/60 border-b border-neutral-100 text-neutral-400 font-medium">
              <tr>
                <th className="py-3 px-4 font-semibold">دانش‌آموز</th>
                <th className="py-3 px-4 font-semibold">کد ملی</th>
                <th className="py-3 px-4 font-semibold">نام پدر</th>
                <th className="py-3 px-4 font-semibold">پایه و معدل</th>
                <th className="py-3 px-4 font-semibold">شماره‌های تماس</th>
                <th className="py-3 px-4 font-semibold">مدرسه</th>
                <th className="py-3 px-4 font-semibold text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    هیچ دانش‌آموزی با این مشخصات یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((std) => {
                  const regs = getStudentRegistrations(std.id);
                  return (
                    <tr key={std.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div
                          className="flex items-center gap-2.5 cursor-pointer group"
                          onClick={() => setDossierStudent(std)}
                        >
                          <Avatar name={`${std.firstName} ${std.lastName}`} size="sm" />
                          <div>
                            <div className="font-semibold text-slate-800 group-hover:text-[#0E7C5B] transition-colors">
                              {std.firstName} {std.lastName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {regs.length > 0 ? `${toPersianDigits(regs.length)} ثبت‌نام فعال` : 'بدون ثبت‌نام'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* National ID */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {toPersianDigits(std.nationalId)}
                      </td>

                      {/* Father Name */}
                      <td className="py-3 px-4 text-slate-700">{std.fatherName || '---'}</td>

                      {/* Grade & GPA */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">پایه {std.grade}</span>
                        <div className="text-[11px] text-emerald-700 font-mono mt-0.5 font-bold">
                          معدل: {toPersianDigits(std.gpa)}
                        </div>
                      </td>

                      {/* Phones list */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {std.phones.map((p) => (
                            <div key={p.id} className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                              <span className="text-[10px] text-slate-400 font-sans">{p.label}:</span>
                              <span>{toPersianDigits(p.number)}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* School */}
                      <td className="py-3 px-4 text-slate-600 truncate max-w-[150px]">
                        {std.school || 'نامشخص'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDossierStudent(std)}
                            className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-800 rounded-lg text-xs font-semibold transition-colors"
                            title="مشاهده پرونده کامل، ویرایش، ثبت‌نام و مدیریت اقساط بدون تغییر صفحه"
                          >
                            مشاهده کامل پرونده
                          </button>
                          <button
                            type="button"
                            onClick={() => openForm(std)}
                            className="p-1.5 text-slate-500 hover:text-[#0E7C5B] hover:bg-slate-100 rounded-lg transition-colors"
                            title="ویرایش"
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(std.id)}
                            className="p-1.5 text-slate-400 hover:text-[#D64545] hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف پرونده"
                          >
                            <IconTrash size={15} />
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
      {/* Modal: Add / Edit Student                                           */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingStudent ? 'ویرایش پرونده دانش‌آموز' : 'تشکیل پرونده دانش‌آموز جدید'}
        maxWidth="2xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <Field label="نام کوچک" required={fieldSettings.firstName} error={formErrors.firstName}>
              <input
                type="text"
                value={formFirstName}
                onChange={(e) => setFormFirstName(e.target.value)}
                placeholder="مثلاً: آرتین"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              />
            </Field>

            {/* Last Name */}
            <Field label="نام خانوادگی" required={fieldSettings.lastName} error={formErrors.lastName}>
              <input
                type="text"
                value={formLastName}
                onChange={(e) => setFormLastName(e.target.value)}
                placeholder="مثلاً: حسینی"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              />
            </Field>

            {/* Father Name */}
            <Field label="نام پدر" required={fieldSettings.fatherName} error={formErrors.fatherName}>
              <input
                type="text"
                value={formFatherName}
                onChange={(e) => setFormFatherName(e.target.value)}
                placeholder="مثلاً: محمدرضا"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              />
            </Field>

            {/* National ID */}
            <Field
              label="کد ملی (۱۰ رقم)"
              required={fieldSettings.nationalId}
              error={formErrors.nationalId}
              hint="ده رقم بدون خط تیره"
            >
              <input
                type="text"
                dir="ltr"
                maxLength={10}
                value={formNationalId}
                onChange={(e) => setFormNationalId(e.target.value)}
                placeholder="0021345678"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] font-mono focus:bg-white text-right"
              />
            </Field>

            {/* Grade */}
            <Field label="پایه تحصیلی" required={fieldSettings.grade}>
              <select
                value={formGrade}
                onChange={(e) => setFormGrade(e.target.value as StudentGrade)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              >
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    پایه {grade}
                  </option>
                ))}
              </select>
            </Field>

            {/* GPA */}
            <Field label="معدل سال گذشته" required={fieldSettings.gpa} error={formErrors.gpa}>
              <input
                type="number"
                step="0.01"
                min="0"
                max="20"
                dir="ltr"
                value={formGpa}
                onChange={(e) => setFormGpa(e.target.value)}
                placeholder="20.00"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] font-mono focus:bg-white text-right"
              />
            </Field>

            {/* School */}
            <div className="sm:col-span-2">
              <Field label="نام مدرسه فعلی" required={fieldSettings.school} error={formErrors.school}>
                <input
                  type="text"
                  value={formSchool}
                  onChange={(e) => setFormSchool(e.target.value)}
                  placeholder="مثلاً: فرزانگان ۱ / علامه حلی ۳ / دبستان معرفت نو"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
                />
              </Field>
            </div>
          </div>

          {/* Compact Phone Numbers Table */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                فهرست شماره‌های تماس و اولیا {fieldSettings.phones && <span className="text-[#D64545]">*</span>}
              </label>
              <button
                type="button"
                onClick={handleAddPhoneRow}
                className="flex items-center gap-1 text-[11px] font-medium text-[#0E7C5B] hover:text-[#0A3528]"
              >
                <IconPlus size={14} />
                <span>افزودن شماره جدید</span>
              </button>
            </div>

            {formErrors.phones && (
              <div className="text-xs text-[#D64545] bg-red-50 p-2 rounded-lg border border-red-200">
                {formErrors.phones}
              </div>
            )}

            <div className="space-y-2">
              {formPhones.map((ph, index) => {
                const validation = validateIranianMobile(ph.number);
                return (
                  <div
                    key={ph.id}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    {/* Label */}
                    <div className="w-full sm:w-28 shrink-0">
                      <select
                        value={ph.label}
                        onChange={(e) => handleUpdatePhoneRow(ph.id, 'label', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                      >
                        <option value="پدر">پدر</option>
                        <option value="مادر">مادر</option>
                        <option value="ولی">ولی قانونی</option>
                        <option value="منزل">تلفن منزل</option>
                        <option value="دانش‌آموز">دانش‌آموز</option>
                        <option value="سایر">سایر</option>
                      </select>
                    </div>

                    {/* Number */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={11}
                        value={ph.number}
                        onChange={(e) => handleUpdatePhoneRow(ph.id, 'number', e.target.value)}
                        placeholder="09123456789"
                        className={`w-full px-3 py-1.5 text-xs font-mono bg-white border rounded-lg focus:outline-hidden text-right ${
                          ph.number && !validation.isValid
                            ? 'border-red-300 focus:border-red-500'
                            : 'border-slate-200 focus:border-[#0E7C5B]'
                        }`}
                      />
                    </div>

                    {/* Live validation tag */}
                    <div className="sm:w-44 text-[10px] text-slate-400">
                      {ph.number ? (
                        validation.isValid ? (
                          <span className="text-[#0E7C5B] flex items-center gap-1 font-sans">
                            <IconCheck size={12} />
                            شماره معتبر
                          </span>
                        ) : (
                          <span className="text-[#D64545] font-sans">{validation.message}</span>
                        )
                      ) : (
                        <span>۱۱ رقم با پیش‌شماره ۰۹</span>
                      )}
                    </div>

                    {/* Delete row */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoneRow(ph.id)}
                      className="p-1.5 text-slate-400 hover:text-[#D64545] hover:bg-white rounded-lg transition-colors self-end sm:self-center"
                      title="حذف شماره"
                    >
                      <IconClose size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-medium text-white bg-[#0E7C5B] rounded-lg hover:bg-[#0A3528] transition-colors shadow-xs"
            >
              {editingStudent ? 'ذخیره تغییرات' : 'ثبت پرونده دانش‌آموز'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Student Dossier (پرونده کامل با امکان ویرایش، اقساط و تأیید) */}
      {/* ------------------------------------------------------------------ */}
      {dossierStudent && (
        <StudentDossierModal
          studentId={dossierStudent.id}
          onClose={() => setDossierStudent(null)}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Bulk Excel / Data Import                                     */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="ورود گروهی دانش‌آموزان از طریق فایل یا متن اکسل"
        maxWidth="3xl"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            می‌توانید اطلاعات دانش‌آموزان را به صورت دسته‌ای با فرمت استاندارد وارد سیستم نمایید.
            سیستم به صورت خودکار کد ملی، شماره موبایل و قالب داده‌ها را قبل از ثبت اعتبارسنجی می‌کند.
          </p>

          {/* Quick buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkInsertSample}
              className="px-3 py-1.5 bg-emerald-50 text-[#0E7C5B] rounded-lg font-medium hover:bg-emerald-100 transition-colors"
            >
              درج ۳ نمونه آماده
            </button>
            <button
              type="button"
              onClick={handleBulkCopySample}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              کپی الگوی متنی نمونه
            </button>
            <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-1">
              <IconUpload size={14} />
              <span>انتخاب فایل اکسل یا داده‌ها از سیستم</span>
              <input type="file" accept=".csv" onChange={handleBulkFileUpload} className="hidden" />
            </label>
          </div>

          {/* Text Area */}
          <div>
            <textarea
              dir="ltr"
              rows={8}
              value={bulkText}
              onChange={(e) => handleBulkTextChange(e.target.value)}
              placeholder="نام,نام خانوادگی,نام پدر,کد ملی,پایه,معدل,مدرسه,شماره همراه..."
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white text-left leading-relaxed"
            />
          </div>

          {/* Live Validation Feedback */}
          {bulkText && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-700">نتیجه اعتبارسنجی زنده:</span>
                <span className="text-[#0E7C5B] font-mono">
                  {toPersianDigits(bulkValidCount)} ردیف آماده ثبت
                </span>
              </div>

              {bulkValidationErrors.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto pt-2 border-t border-slate-200 text-[#D64545]">
                  {bulkValidationErrors.map((err, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D64545] shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleBulkSubmit}
              disabled={bulkValidCount === 0}
              className={`px-5 py-2 text-xs font-medium text-white rounded-lg transition-colors ${
                bulkValidCount > 0 ? 'bg-[#0E7C5B] hover:bg-[#0A3528]' : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              وارد کردن {toPersianDigits(bulkValidCount)} دانش‌آموز
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDeleteStudent(deleteConfirmId)}
        title="حذف پرونده دانش‌آموز"
        description="آیا از حذف این پرونده اطمینان دارید؟ تمام سوابق ثبت‌نام و اقساط مربوط به این دانش‌آموز نیز حذف خواهند شد."
        confirmText="بله، حذف پرونده"
        cancelText="انصراف"
      />
    </div>
  );
};
