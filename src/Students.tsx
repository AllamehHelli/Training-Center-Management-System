/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from './store';
import { useFieldSettings } from './Settings';
import {
  toPersianDigits,
  toEnglishDigits,
  validateIranianMobile,
  downloadCSV,
  getTodayJalali,
  formatToman,
} from './utils';
import { Student, PhoneNumber, StudentGrade } from './types';
import {
  validateStudent,
  buildStudentFromInput,
  parseAndValidateBulkCSV,
  buildStudentsFromBulkResults,
  BulkCsvReport,
} from './studentValidation';
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
import { HeartHandshake, UserCheck, Sparkles, Filter, Users, GraduationCap, CreditCard, PlusCircle } from 'lucide-react';
import { LogoHelli } from './Logo';
import { StudentDossierModal } from './components/StudentDossierModal';

export interface StudentsProps {
  initialFilters?: {
    counselorFilter?: 'all' | 'unassigned' | string;
    gradeFilter?: string;
    q?: string;
    openStudentId?: string;
    action?: 'quickAssign' | 'dossier' | 'edit';
  };
}

export const Students: React.FC<StudentsProps> = ({ initialFilters }) => {
  const { state, dispatch, getStudentRegistrations, getClassById } = useAppStore();
  const { fieldSettings, grades } = useFieldSettings();
  const { showToast } = useToast();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [counselorFilter, setCounselorFilter] = useState<'all' | 'unassigned' | string>('all');

  // Handle incoming deep-link action from notifications or command palette
  useEffect(() => {
    if (!initialFilters) return;
    if (initialFilters.counselorFilter) {
      setCounselorFilter(initialFilters.counselorFilter);
    }
    if (initialFilters.gradeFilter) {
      setGradeFilter(initialFilters.gradeFilter);
    }
    if (initialFilters.q) {
      setSearchTerm(initialFilters.q);
    }
    if (initialFilters.openStudentId) {
      const targetStd = state.students.find((s) => s.id === initialFilters.openStudentId);
      if (targetStd) {
        if (initialFilters.action === 'quickAssign' || !initialFilters.action) {
          setQuickAssignStudent(targetStd);
          setQuickAssignCounselorId(targetStd.counselorId || '');
        } else if (initialFilters.action === 'dossier') {
          setDossierStudent(targetStd);
        } else if (initialFilters.action === 'edit') {
          openForm(targetStd);
        }
      }
    }
  }, [initialFilters, state.students]);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [dossierStudent, setDossierStudent] = useState<Student | null>(null);
  const [dossierInitialMode, setDossierInitialMode] = useState<'educational' | 'financial'>('educational');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Quick Assign Counselor Modal State
  const [quickAssignStudent, setQuickAssignStudent] = useState<Student | null>(null);
  const [quickAssignCounselorId, setQuickAssignCounselorId] = useState<string>('');

  // Bulk Assign Counselor Modal State
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
  const [bulkAssignTargetCounselorId, setBulkAssignTargetCounselorId] = useState<string>('');
  const [bulkAssignSelectedStudentIds, setBulkAssignSelectedStudentIds] = useState<string[]>([]);

  // Form State
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formGrade, setFormGrade] = useState<StudentGrade>(grades[0] || 'هفتم');
  const [formGpa, setFormGpa] = useState<string>('20.00');
  const [formSchool, setFormSchool] = useState('');
  const [formCounselorId, setFormCounselorId] = useState<string>('');
  const [formPhones, setFormPhones] = useState<PhoneNumber[]>([
    { id: 'p-init-1', label: 'پدر', number: '0912' },
  ]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Bulk Import State (HI-3: full per-row validation report instead of a flat error list)
  const [bulkText, setBulkText] = useState('');
  const [bulkReport, setBulkReport] = useState<BulkCsvReport | null>(null);

  // Filter students
  const filteredStudents = state.students.filter((student) => {
    if (gradeFilter !== 'all' && student.grade !== gradeFilter) return false;
    if (counselorFilter === 'unassigned' && student.counselorId) return false;
    if (counselorFilter !== 'all' && counselorFilter !== 'unassigned' && student.counselorId !== counselorFilter) return false;
    if (!searchTerm) return true;

    const term = searchTerm.trim().toLowerCase();
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    const nid = student.nationalId.toLowerCase();
    const school = student.school.toLowerCase();
    const cName = (student.counselorName || '').toLowerCase();
    const matchesPhone = student.phones.some((p) =>
      p.number.includes(toEnglishDigits(term))
    );

    return fullName.includes(term) || nid.includes(term) || school.includes(term) || cName.includes(term) || matchesPhone;
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
      setFormCounselorId(student.counselorId || '');
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
      setFormCounselorId('');
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

  // Form Validation & Submit (HI-2: shared validateStudent from studentValidation.ts)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedCounselor = (state.counselors || []).find((c) => c.id === formCounselorId);

    const input = {
      firstName: formFirstName,
      lastName: formLastName,
      fatherName: formFatherName,
      nationalId: formNationalId,
      grade: formGrade,
      gpa: formGpa,
      school: formSchool,
      phones: formPhones,
      counselorId: formCounselorId || undefined,
      counselorName: selectedCounselor ? `${selectedCounselor.firstName} ${selectedCounselor.lastName}` : undefined,
    };

    const errors = validateStudent(input, fieldSettings, state.students, editingStudent?.id);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (editingStudent) {
      const updated = buildStudentFromInput(input, editingStudent);
      dispatch({ type: 'UPDATE_STUDENT', payload: updated });
      showToast('اطلاعات دانش‌آموز با موفقیت به‌روزرسانی شد', 'success');
    } else {
      const newStudent = buildStudentFromInput(input, {
        id: `std-${Date.now()}`,
        createdAt: getTodayJalali(),
      });
      dispatch({ type: 'ADD_STUDENT', payload: newStudent });
      showToast(`پرونده دانش‌آموز ${newStudent.firstName} ${newStudent.lastName} تشکیل شد`, 'success');
    }

    setIsFormModalOpen(false);
  };

  // Quick Assign Counselor for Single Student
  const handleQuickAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAssignStudent) return;

    const selectedCns = (state.counselors || []).find((c) => c.id === quickAssignCounselorId);
    const updated: Student = {
      ...quickAssignStudent,
      counselorId: quickAssignCounselorId || undefined,
      counselorName: selectedCns ? `${selectedCns.firstName} ${selectedCns.lastName}` : undefined,
    };

    dispatch({ type: 'UPDATE_STUDENT', payload: updated });
    showToast(
      selectedCns
        ? `مشاور ${selectedCns.firstName} ${selectedCns.lastName} به ${quickAssignStudent.firstName} ${quickAssignStudent.lastName} اختصاص یافت`
        : `تخصیص مشاور برای ${quickAssignStudent.firstName} ${quickAssignStudent.lastName} لغو شد`,
      'success'
    );
    setQuickAssignStudent(null);
  };

  // Bulk Assign Counselor
  const handleBulkAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkAssignSelectedStudentIds.length === 0) {
      showToast('لطفاً دست‌کم یک دانش‌آموز را انتخاب کنید', 'info');
      return;
    }
    const selectedCns = (state.counselors || []).find((c) => c.id === bulkAssignTargetCounselorId);
    if (!selectedCns && bulkAssignTargetCounselorId) {
      showToast('مشاور انتخاب‌شده معتبر نیست', 'error');
      return;
    }

    bulkAssignSelectedStudentIds.forEach((stdId) => {
      const std = state.students.find((s) => s.id === stdId);
      if (std) {
        dispatch({
          type: 'UPDATE_STUDENT',
          payload: {
            ...std,
            counselorId: bulkAssignTargetCounselorId || undefined,
            counselorName: selectedCns ? `${selectedCns.firstName} ${selectedCns.lastName}` : undefined,
          },
        });
      }
    });

    showToast(
      selectedCns
        ? `مشاور ${selectedCns.firstName} ${selectedCns.lastName} به ${toPersianDigits(bulkAssignSelectedStudentIds.length)} دانش‌آموز اختصاص یافت`
        : `تخصیص مشاور برای ${toPersianDigits(bulkAssignSelectedStudentIds.length)} دانش‌آموز برداشته شد`,
      'success'
    );
    setIsBulkAssignModalOpen(false);
    setBulkAssignSelectedStudentIds([]);
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
  // -------------------------------------------------------------
  // Bulk CSV Import Logic (HI-3 fix)
  //   • RFC-4180 parsing via PapaParse (quoted commas are preserved)
  //   • same shared validateStudent() rules as the single-student form
  //     (national-ID format/checksum + uniqueness vs DB and within file,
  //      grade membership in Settings list, GPA 0..20, required fields)
  //   • per-row rejection report shown BEFORE anything is committed
  // -------------------------------------------------------------
  const sampleCSVText = `نام,نام خانوادگی,نام پدر,کد ملی,پایه,معدل,مدرسه,شماره همراه
سامان,یوسفی,محسن,0041238915,هشتم,19.90,"علامه حلی ۲",09121234567
روژان,کریمیان,داریوش,0056781296,نهم,20.00,فرزانگان ۴,09129876543
مهبد,انصاری,حسین,0067894518,ششم,19.85,دبستان اندیشه نو,09351112233`;

  const runBulkValidation = (text: string): BulkCsvReport => {
    const report = parseAndValidateBulkCSV(text, fieldSettings, state.students);
    setBulkReport(report);
    return report;
  };

  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    runBulkValidation(text);
  };

  const handleBulkInsertSample = () => {
    setBulkText(sampleCSVText);
    runBulkValidation(sampleCSVText);
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
      runBulkValidation(content);
    };
    reader.readAsText(file);
  };

  const bulkValidRows = bulkReport?.results.filter((r) => r.errors.length === 0) ?? [];
  const bulkRejectedRows = bulkReport?.results.filter((r) => r.errors.length > 0) ?? [];
  const bulkValidCount = bulkReport?.validCount ?? 0;

  const handleBulkSubmit = () => {
    // Re-validate at submit time against the CURRENT store so a row that was
    // valid when typed cannot slip through if a duplicate appeared meanwhile.
    const report = runBulkValidation(bulkText);
    if (report.fileErrors.length > 0) {
      showToast(report.fileErrors[0], 'error');
      return;
    }

    const validResults = report.results.filter((r) => r.errors.length === 0);
    if (validResults.length === 0) {
      showToast('هیچ ردیف معتبری برای افزودن یافت نشد', 'error');
      return;
    }

    const batchId = `${Date.now()}`;
    const parsedStudents = buildStudentsFromBulkResults(validResults, batchId);

    // Final defensive guard: never import a national ID that already exists
    // or repeats inside the batch itself.
    const seen = new Set<string>(state.students.map((s) => toEnglishDigits(s.nationalId)));
    const deduped = parsedStudents.filter((s) => {
      const nid = toEnglishDigits(s.nationalId);
      if (seen.has(nid)) return false;
      seen.add(nid);
      return true;
    });
    const skippedDupes = parsedStudents.length - deduped.length;

    if (deduped.length === 0) {
      showToast('تمام ردیف‌های معتبر به دلیل تکراری‌بودن کد ملی رد شدند', 'error');
      return;
    }

    dispatch({ type: 'BULK_ADD_STUDENTS', payload: deduped });
    const rejectedCount = report.invalidCount + skippedDupes;
    showToast(
      rejectedCount > 0
        ? `${toPersianDigits(deduped.length)} دانش‌آموز وارد شد و ${toPersianDigits(rejectedCount)} ردیف نامعتبر رد گردید`
        : `${toPersianDigits(deduped.length)} دانش‌آموز با موفقیت وارد سامانه شدند`,
      rejectedCount > 0 ? 'info' : 'success'
    );
    setIsBulkModalOpen(false);
    setBulkText('');
    setBulkReport(null);
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
            onClick={() => {
              const unassignedIds = state.students.filter((s) => !s.counselorId).map((s) => s.id);
              setBulkAssignSelectedStudentIds(unassignedIds);
              setBulkAssignTargetCounselorId('');
              setIsBulkAssignModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/80 rounded-full hover:bg-teal-100 transition-colors shadow-2xs"
            title="تخصیص گروهی دانش‌آموزان به مشاوران"
          >
            <HeartHandshake size={14} className="text-teal-600" />
            <span>تخصیص گروهی مشاور</span>
          </button>
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
            placeholder="جستجو در نام، کد ملی، نام مدرسه، نام مشاور یا تمامی شماره‌های تماس..."
            className="w-full pl-3.5 pr-9 py-2 text-xs bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white border border-neutral-200/80 rounded-full focus:outline-hidden transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Counselor Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <HeartHandshake size={14} className="text-teal-600" />
            <select
              value={counselorFilter}
              onChange={(e) => setCounselorFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200/80 rounded-full font-bold text-neutral-700 focus:outline-hidden focus:border-teal-600 shadow-2xs"
            >
              <option value="all">همه مشاوران ({toPersianDigits(state.students.length)})</option>
              <option value="unassigned">
                بدون مشاور ({toPersianDigits(state.students.filter((s) => !s.counselorId).length)})
              </option>
              {(state.counselors || []).map((c) => {
                const assigned = state.students.filter((s) => s.counselorId === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    مشاور {c.firstName} {c.lastName} ({toPersianDigits(assigned)} دانش‌آموز)
                  </option>
                );
              })}
            </select>
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
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/70 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-neutral-50/60 border-b border-neutral-100 text-neutral-400 font-medium">
              <tr>
                <th className="py-3 px-4 font-semibold">دانش‌آموز</th>
                <th className="py-3 px-4 font-semibold">کد ملی</th>
                <th className="py-3 px-4 font-semibold">مشاور تحصیلی</th>
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
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <p className="text-xs">
                        {state.students.length === 0
                          ? 'هیچ پرونده دانش‌آموزی در سامانه موجود نیست.'
                          : 'هیچ دانش‌آموزی با این مشخصات یافت نشد.'}
                      </p>
                      {state.students.length === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            dispatch({ type: 'RESTORE_FIVE_SAMPLES' });
                            showToast('۵ داده نمونه استاندارد با موفقیت بارگذاری شدند.', 'success');
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <PlusCircle size={14} />
                          <span>بارگذاری ۵ داده نمونه جهت بررسی عملکرد</span>
                        </button>
                      )}
                    </div>
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
                          onClick={() => {
                            setDossierStudent(std);
                            setDossierInitialMode('educational');
                          }}
                          title="مشاهده پرونده آموزشی دانش‌آموز"
                        >
                          <Avatar name={`${std.firstName} ${std.lastName}`} size="sm" />
                          <div>
                            <div className="font-semibold text-slate-800 group-hover:text-[#162E6E] transition-colors">
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

                      {/* Counselor */}
                      <td className="py-3 px-4">
                        {std.counselorId ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200/80 rounded-lg text-[11px] font-bold">
                              <HeartHandshake size={12} className="text-teal-600 shrink-0" />
                              <span>{std.counselorName || 'مشاور تحصیلی'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setQuickAssignStudent(std);
                                setQuickAssignCounselorId(std.counselorId || '');
                              }}
                              className="text-[10px] text-slate-400 hover:text-teal-700 underline"
                              title="تغییر مشاور"
                            >
                              تغییر
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAssignStudent(std);
                              setQuickAssignCounselorId('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg text-[10px] font-semibold transition-colors"
                            title="تخصیص مشاور از بانک مشاوران"
                          >
                            <HeartHandshake size={11} className="text-amber-600 shrink-0" />
                            <span>تخصیص مشاور</span>
                          </button>
                        )}
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
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDossierStudent(std);
                              setDossierInitialMode('educational');
                            }}
                            className="px-2.5 py-1 bg-[#162E6E] hover:bg-[#0f204d] text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            title="مشاهده اطلاعات هویتی و آموزشی دانش‌آموز در یک نگاه"
                          >
                            <GraduationCap size={13} />
                            <span>پرونده آموزشی</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDossierStudent(std);
                              setDossierInitialMode('financial');
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="مشاهده پرونده مالی، اقساط، تسویه و معوقات"
                          >
                            <CreditCard size={13} />
                            <span>پرونده مالی (اقساط و تسویه)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openForm(std)}
                            className="p-1.5 text-slate-500 hover:text-[#162E6E] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="ویرایش مشخصات"
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(std.id)}
                            className="p-1.5 text-slate-400 hover:text-[#D64545] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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

            {/* Counselor Selection from Bank */}
            <div className="sm:col-span-2">
              <Field label="مشاور تحصیلی اختصاصی (بانک مشاوران)">
                <div className="space-y-1">
                  <select
                    value={formCounselorId}
                    onChange={(e) => setFormCounselorId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-600 focus:bg-white"
                  >
                    <option value="">-- بدون مشاور / بعداً تخصیص داده شود --</option>
                    {(state.counselors || []).map((c) => {
                      const assignedCount = state.students.filter(
                        (s) => s.counselorId === c.id && s.id !== editingStudent?.id
                      ).length;
                      const maxCap = c.maxCapacity || 30;
                      const free = Math.max(0, maxCap - assignedCount);
                      return (
                        <option key={c.id} value={c.id}>
                          مشاور {c.firstName} {c.lastName} ({c.specialty || 'هدایت تحصیلی'}) — ظرفیت خالی: {toPersianDigits(free)} از {toPersianDigits(maxCap)} نفر
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[10px] text-slate-400">
                    انتخاب مشاور از بانک مشاوران موسسه برای پیگیری برنامه‌ریزی درسی و ارزیابی‌های روان‌شناختی دانش‌آموز
                  </p>
                </div>
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
      {/* Modal: Student Dossier (پرونده هویتی و آموزشی فراگیر در یک نگاه)    */}
      {/* ------------------------------------------------------------------ */}
      {dossierStudent && (
        <StudentDossierModal
          studentId={dossierStudent.id}
          mode={dossierInitialMode}
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

          {/* Live Validation Feedback (HI-3: per-row report before commit) */}
          {bulkText && bulkReport && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-700">نتیجه اعتبارسنجی زنده:</span>
                <span className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-[#0E7C5B]">
                    {toPersianDigits(bulkValidCount)} ردیف آماده ثبت
                  </span>
                  {(bulkRejectedRows.length > 0 || bulkReport.fileErrors.length > 0) && (
                    <span className="text-[#D64545]">
                      {toPersianDigits(bulkRejectedRows.length + bulkReport.fileErrors.length)} ردیف رد شده
                    </span>
                  )}
                </span>
              </div>

              {bulkReport.fileErrors.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-200 text-[#D64545]">
                  {bulkReport.fileErrors.map((err, i) => (
                    <div key={`f-${i}`} className="flex items-center gap-1.5 text-[11px] font-bold">
                      <IconAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {bulkRejectedRows.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto pt-2 border-t border-slate-200 text-[#D64545]">
                  {bulkRejectedRows.slice(0, 50).map((row) => (
                    <div key={row.lineNo} className="text-[11px] leading-relaxed">
                      <span className="font-mono font-bold">
                        سطر {toPersianDigits(row.lineNo)}
                      </span>
                      {(row.input.firstName || row.input.lastName) && (
                        <span className="text-slate-500"> ({row.input.firstName} {row.input.lastName})</span>
                      )}
                      {' — '}
                      <span>{row.errors.join(' | ')}</span>
                    </div>
                  ))}
                  {bulkRejectedRows.length > 50 && (
                    <div className="text-[11px] text-slate-500">
                      … و {toPersianDigits(bulkRejectedRows.length - 50)} ردیف ردشده دیگر
                    </div>
                  )}
                </div>
              )}

              {bulkReport.totalDataRows > 0 && bulkRejectedRows.length === 0 && bulkReport.fileErrors.length === 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#0E7C5B] pt-1">
                  <IconCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>همه ردیف‌ها معتبرند؛ قابل ثبت بدون هیچ ناسازگاری.</span>
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

      {/* Quick Assign Counselor Modal */}
      {quickAssignStudent && (
        <Modal
          isOpen={Boolean(quickAssignStudent)}
          onClose={() => setQuickAssignStudent(null)}
          title={`تخصیص مشاور به ${quickAssignStudent.firstName} ${quickAssignStudent.lastName}`}
          maxWidth="md"
        >
          <form onSubmit={handleQuickAssignSubmit} className="space-y-4 text-xs font-medium" dir="rtl">
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-1">
              <div className="font-bold text-neutral-800">
                دانش‌آموز: {quickAssignStudent.firstName} {quickAssignStudent.lastName} (پایه {quickAssignStudent.grade})
              </div>
              <div className="text-[11px] text-neutral-500">
                مدرسه: {quickAssignStudent.school || 'نامشخص'} • معدل: {toPersianDigits(quickAssignStudent.gpa)}
              </div>
            </div>

            <Field label="انتخاب مشاور تحصیلی از بانک مشاوران:">
              <select
                value={quickAssignCounselorId}
                onChange={(e) => setQuickAssignCounselorId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-bold text-neutral-800"
              >
                <option value="">-- بدون مشاور (حذف تخصیص) --</option>
                {(state.counselors || []).map((c) => {
                  const assignedCount = state.students.filter(
                    (s) => s.counselorId === c.id && s.id !== quickAssignStudent.id
                  ).length;
                  const maxCap = c.maxCapacity || 30;
                  const free = Math.max(0, maxCap - assignedCount);
                  return (
                    <option key={c.id} value={c.id}>
                      مشاور {c.firstName} {c.lastName} ({c.specialty || 'هدایت تحصیلی'}) — ظرفیت خالی: {toPersianDigits(free)} از {toPersianDigits(maxCap)} نفر
                    </option>
                  );
                })}
              </select>
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setQuickAssignStudent(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold transition-colors"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all shadow-sm shadow-teal-600/20"
              >
                ثبت و اعمال تخصیص
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk Assign Counselor Modal */}
      {isBulkAssignModalOpen && (
        <Modal
          isOpen={isBulkAssignModalOpen}
          onClose={() => setIsBulkAssignModalOpen(false)}
          title="تخصیص گروهی دانش‌آموزان به مشاور تحصیلی"
          maxWidth="lg"
        >
          <form onSubmit={handleBulkAssignSubmit} className="space-y-4 text-xs font-medium" dir="rtl">
            <p className="text-neutral-600 leading-relaxed">
              مشاور مورد نظر را از بانک مشاوران انتخاب کنید و دانش‌آموزانی را که می‌خواهید به این مشاور هدایت شوند علامت بزنید.
            </p>

            <Field label="مشاور تحصیلی مقصد:">
              <select
                value={bulkAssignTargetCounselorId}
                onChange={(e) => setBulkAssignTargetCounselorId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-bold text-neutral-800"
              >
                <option value="">-- انتخاب مشاور از بانک مشاوران --</option>
                {(state.counselors || []).map((c) => {
                  const assignedCount = state.students.filter((s) => s.counselorId === c.id).length;
                  const maxCap = c.maxCapacity || 30;
                  const free = Math.max(0, maxCap - assignedCount);
                  return (
                    <option key={c.id} value={c.id}>
                      مشاور {c.firstName} {c.lastName} ({c.specialty || 'هدایت تحصیلی'}) — ظرفیت خالی: {toPersianDigits(free)} از {toPersianDigits(maxCap)} نفر
                    </option>
                  );
                })}
              </select>
            </Field>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-800">
                  انتخاب دانش‌آموزان ({toPersianDigits(bulkAssignSelectedStudentIds.length)} دانش‌آموز انتخاب‌شده):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const unassigned = state.students.filter((s) => !s.counselorId).map((s) => s.id);
                      setBulkAssignSelectedStudentIds(unassigned);
                    }}
                    className="text-teal-700 hover:underline"
                  >
                    فقط بدون مشاوران
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setBulkAssignSelectedStudentIds(state.students.map((s) => s.id))}
                    className="text-neutral-600 hover:underline"
                  >
                    انتخاب همه
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setBulkAssignSelectedStudentIds([])}
                    className="text-neutral-400 hover:underline"
                  >
                    عدم انتخاب
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100 p-1 bg-neutral-50/50">
                {state.students.map((s) => {
                  const isChecked = bulkAssignSelectedStudentIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isChecked ? 'bg-teal-50/80 text-teal-900 font-bold' : 'hover:bg-neutral-100/70 text-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkAssignSelectedStudentIds((prev) => [...prev, s.id]);
                            } else {
                              setBulkAssignSelectedStudentIds((prev) => prev.filter((id) => id !== s.id));
                            }
                          }}
                          className="w-4 h-4 text-teal-600 rounded border-neutral-300 focus:ring-teal-500"
                        />
                        <span>{s.firstName} {s.lastName}</span>
                        <span className="text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded">
                          پایه {s.grade}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 font-normal">
                        {s.counselorName ? `مشاور فعلی: ${s.counselorName}` : 'بدون مشاور'}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsBulkAssignModalOpen(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold transition-colors"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all shadow-sm shadow-teal-600/20"
              >
                تخصیص به {toPersianDigits(bulkAssignSelectedStudentIds.length)} دانش‌آموز
              </button>
            </div>
          </form>
        </Modal>
      )}

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
