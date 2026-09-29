/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from './store';
import { Counselor, Student } from './types';
import { toPersianDigits } from './utils';
import { Modal, ConfirmModal, useToast, Field, ProgressBar } from './ui';
import { StudentDossierModal } from './components/StudentDossierModal';
import {
  UserCheck,
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  HeartHandshake,
  LayoutGrid,
  List,
  Sparkles,
  ExternalLink,
  GraduationCap,
} from 'lucide-react';

export const Counselors: React.FC = () => {
  const { state, dispatch, isViewingArchived } = useAppStore();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCounselor, setEditingCounselor] = useState<Counselor | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedCounselorStudents, setSelectedCounselorStudents] = useState<Counselor | null>(null);
  const [dossierStudent, setDossierStudent] = useState<Student | null>(null);

  // Form State
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formGrades, setFormGrades] = useState<string[]>(['هفتم', 'هشتم', 'نهم']);
  const [formMaxCapacity, setFormMaxCapacity] = useState<number>(30);
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Available grade options
  const gradeOptions = ['ششم', 'هفتم', 'هشتم', 'نهم', 'دهم', 'یازدهم', 'دوازدهم'];

  // Counselors list
  const counselors = state.counselors || [];
  const activeCounselorsCount = counselors.filter((c) => c.isActive).length;

  const getAssignedStudents = (counselorId: string): Student[] => {
    return state.students.filter((s) => s.counselorId === counselorId);
  };

  const totalAssignedStudentsCount = state.students.filter((s) => Boolean(s.counselorId)).length;
  const totalSlotsCapacity = counselors.reduce((acc, c) => acc + (c.maxCapacity || 30), 0);
  const totalFreeSlots = Math.max(0, totalSlotsCapacity - totalAssignedStudentsCount);

  // Filtered counselors
  const filteredCounselors = counselors.filter((c) => {
    if (statusFilter === 'active' && !c.isActive) return false;
    if (statusFilter === 'inactive' && c.isActive) return false;

    if (gradeFilter !== 'all') {
      if (!c.grades || !c.grades.includes(gradeFilter)) return false;
    }

    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    const specialty = (c.specialty || '').toLowerCase();
    const phone = c.phone || '';
    return fullName.includes(term) || specialty.includes(term) || phone.includes(term);
  });

  const openForm = (counselor?: Counselor) => {
    setFormError('');
    if (counselor) {
      setEditingCounselor(counselor);
      setFormFirstName(counselor.firstName);
      setFormLastName(counselor.lastName);
      setFormNationalId(counselor.nationalId || '');
      setFormPhone(counselor.phone || '');
      setFormEmail(counselor.email || '');
      setFormSpecialty(counselor.specialty || '');
      setFormGrades(counselor.grades || ['هفتم', 'هشتم', 'نهم']);
      setFormMaxCapacity(counselor.maxCapacity || 30);
      setFormNotes(counselor.notes || '');
      setFormIsActive(counselor.isActive);
    } else {
      setEditingCounselor(null);
      setFormFirstName('');
      setFormLastName('');
      setFormNationalId('');
      setFormPhone('0912');
      setFormEmail('');
      setFormSpecialty('');
      setFormGrades(['هفتم', 'هشتم', 'نهم']);
      setFormMaxCapacity(30);
      setFormNotes('');
      setFormIsActive(true);
    }
    setIsFormModalOpen(true);
  };

  const handleGradeToggle = (g: string) => {
    if (formGrades.includes(g)) {
      setFormGrades(formGrades.filter((item) => item !== g));
    } else {
      setFormGrades([...formGrades, g]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim() || !formLastName.trim()) {
      setFormError('نام و نام خانوادگی مشاور الزامی است.');
      return;
    }
    if (!formSpecialty.trim()) {
      setFormError('زمینه تخصصی مشاوره الزامی است.');
      return;
    }

    const payload: Counselor = {
      id: editingCounselor ? editingCounselor.id : `cns-${Date.now()}`,
      firstName: formFirstName.trim(),
      lastName: formLastName.trim(),
      nationalId: formNationalId.trim() || undefined,
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      specialty: formSpecialty.trim(),
      grades: formGrades,
      maxCapacity: Number(formMaxCapacity) || 30,
      notes: formNotes.trim() || undefined,
      isActive: formIsActive,
      createdAt: editingCounselor ? editingCounselor.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingCounselor) {
      dispatch({ type: 'UPDATE_COUNSELOR', payload });
      showToast(`اطلاعات مشاور «${payload.firstName} ${payload.lastName}» به‌روزرسانی شد.`, 'success');
    } else {
      dispatch({ type: 'ADD_COUNSELOR', payload });
      showToast(`مشاور جدید «${payload.firstName} ${payload.lastName}» به بانک مشاوران اضافه شد.`, 'success');
    }

    setIsFormModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const assigned = getAssignedStudents(id);
    if (assigned.length > 0) {
      showToast(
        `تعداد ${toPersianDigits(assigned.length)} دانش‌آموز تحت پوشش این مشاور هستند. ابتدا مشاور آن‌ها را تغییر دهید.`,
        'error'
      );
      setDeleteConfirmId(null);
      return;
    }

    dispatch({ type: 'DELETE_COUNSELOR', payload: id });
    showToast('مشاور با موفقیت از سیستم حذف شد.', 'info');
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-700 flex items-center justify-center shadow-xs">
              <UserCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-neutral-900 tracking-tight">بانک مشاوران تحصیلی</h1>
              <p className="text-xs text-neutral-500 mt-0.5">تخصیص مشاوران به دانش‌آموزان، کنترل ظرفیت پذیرش و هدایت تحصیلی</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openForm()}
          disabled={isViewingArchived}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-teal-600/20 disabled:opacity-50"
        >
          <Plus size={16} />
          <span>افزودن مشاور جدید</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 block mb-1">کل مشاوران موسسه</span>
            <span className="text-2xl font-black text-neutral-900 tracking-tight">
              {toPersianDigits(counselors.length)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 block mb-1">مشاوران فعال</span>
            <span className="text-2xl font-black text-emerald-600 tracking-tight">
              {toPersianDigits(activeCounselorsCount)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 block mb-1">دانش‌آموزان دارای مشاور</span>
            <span className="text-2xl font-black text-teal-600 tracking-tight">
              {toPersianDigits(totalAssignedStudentsCount)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <HeartHandshake size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 block mb-1">ظرفیت مشاوره خالی</span>
            <span className="text-2xl font-black text-indigo-600 tracking-tight">
              {toPersianDigits(totalFreeSlots)} نفر
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 relative max-w-md">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="جستجو بر اساس نام مشاور، تخصص مشاوره، تلفن..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-neutral-50/80 hover:bg-neutral-50 focus:bg-white border border-neutral-200/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-neutral-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Grade Filter */}
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="all">همه پایه‌ها</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                پایه {g}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center p-0.5 bg-neutral-100 rounded-xl text-xs font-bold text-neutral-600">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white text-neutral-900 shadow-2xs' : 'hover:text-neutral-900'}`}
            >
              همه ({toPersianDigits(counselors.length)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'active' ? 'bg-white text-emerald-600 shadow-2xs' : 'hover:text-neutral-900'}`}
            >
              فعال ({toPersianDigits(activeCounselorsCount)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'inactive' ? 'bg-white text-rose-600 shadow-2xs' : 'hover:text-neutral-900'}`}
            >
              غیرفعال ({toPersianDigits(counselors.length - activeCounselorsCount)})
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-neutral-100 rounded-xl text-neutral-500">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-neutral-900 shadow-2xs' : 'hover:text-neutral-900'}`}
              title="نمای کارتی"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-neutral-900 shadow-2xs' : 'hover:text-neutral-900'}`}
              title="نمای جدولی"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Counselors Content */}
      {filteredCounselors.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto mb-3">
            <UserCheck size={28} />
          </div>
          <h3 className="text-sm font-bold text-neutral-800">هیچ مشاور تحصیلی یافت نشد</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            موردی مطابق با جستجو یا فیلتر انتخابی پیدا نشد. برای اضافه کردن اولین مشاور دکمه زیر را بزنید.
          </p>
          <button
            type="button"
            onClick={() => openForm()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-teal-600/20"
          >
            <Plus size={15} />
            <span>تعریف مشاور جدید</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCounselors.map((counselor) => {
            const assignedStudents = getAssignedStudents(counselor.id);
            const maxCap = counselor.maxCapacity || 30;
            const percentage = Math.min(100, Math.round((assignedStudents.length / maxCap) * 100));

            return (
              <div
                key={counselor.id}
                className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Avatar + Name + Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-800 text-white flex items-center justify-center text-sm font-black shadow-xs shrink-0">
                        {counselor.firstName[0]}
                        {counselor.lastName[0]}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-neutral-900 group-hover:text-teal-600 transition-colors">
                          مشاور {counselor.firstName} {counselor.lastName}
                        </h3>
                        <span className="inline-block mt-0.5 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md">
                          {counselor.specialty || 'هدایت تحصیلی و انگیزشی'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        counselor.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                      }`}
                    >
                      {counselor.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>

                  {/* Grades Covered */}
                  {counselor.grades && counselor.grades.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      <span className="text-[10px] text-neutral-400 font-bold">پایه‌های تحت پوشش:</span>
                      {counselor.grades.map((g) => (
                        <span key={g} className="text-[10px] font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-md">
                          پایه {g}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Capacity Bar */}
                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 mb-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-700">ظرفیت پذیرش دانش‌آموز</span>
                      <span className="font-extrabold text-teal-700">
                        {toPersianDigits(assignedStudents.length)} از {toPersianDigits(maxCap)} نفر ({toPersianDigits(percentage)}٪)
                      </span>
                    </div>
                    <div className="w-full bg-neutral-200/80 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          percentage >= 100 ? 'bg-rose-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-neutral-500 text-left">
                      {maxCap - assignedStudents.length > 0 ? (
                        <span className="text-emerald-600 font-bold">
                          {toPersianDigits(maxCap - assignedStudents.length)} ظرفیت خالی
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold">ظرفیت تکمیل</span>
                      )}
                    </div>
                  </div>

                  {/* Contact Info Pills */}
                  <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                    {counselor.phone && (
                      <a
                        href={`tel:${counselor.phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700 rounded-lg text-[11px] font-medium transition-colors"
                        dir="ltr"
                      >
                        <Phone size={11} className="text-neutral-500" />
                        <span>{toPersianDigits(counselor.phone)}</span>
                      </a>
                    )}
                    {counselor.email && (
                      <a
                        href={`mailto:${counselor.email}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700 rounded-lg text-[11px] font-medium transition-colors"
                        dir="ltr"
                      >
                        <Mail size={11} className="text-neutral-500" />
                        <span className="truncate max-w-[140px]">{counselor.email}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setSelectedCounselorStudents(counselor)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 px-2.5 py-1.5 rounded-xl border border-teal-200/60"
                  >
                    <Users size={13} />
                    <span>مشاهده دانش‌آموزان ({toPersianDigits(assignedStudents.length)})</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openForm(counselor)}
                      disabled={isViewingArchived}
                      className="p-1.5 text-neutral-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      title="ویرایش اطلاعات مشاور"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(counselor.id)}
                      disabled={isViewingArchived}
                      className="p-1.5 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="حذف مشاور"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-neutral-50/80 border-b border-neutral-200/80 text-neutral-500 font-bold">
                <tr>
                  <th className="py-3 px-4">مشاور</th>
                  <th className="py-3 px-4">تخصص مشاوره</th>
                  <th className="py-3 px-4">پایه‌ها</th>
                  <th className="py-3 px-4">شماره تماس</th>
                  <th className="py-3 px-4">دانش‌آموزان تحت پوشش</th>
                  <th className="py-3 px-4">ظرفیت باقیمانده</th>
                  <th className="py-3 px-4">وضعیت</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {filteredCounselors.map((counselor) => {
                  const assignedStudents = getAssignedStudents(counselor.id);
                  const maxCap = counselor.maxCapacity || 30;
                  const free = Math.max(0, maxCap - assignedStudents.length);

                  return (
                    <tr key={counselor.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {counselor.firstName[0]}
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 block">
                              مشاور {counselor.firstName} {counselor.lastName}
                            </span>
                            {counselor.nationalId && (
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {toPersianDigits(counselor.nationalId)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 bg-teal-50 text-teal-700 font-bold rounded-md border border-teal-100 text-[11px]">
                          {counselor.specialty || 'هدایت تحصیلی'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(counselor.grades || []).map((g) => (
                            <span key={g} className="text-[10px] bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded">
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-neutral-800" dir="ltr">
                          {toPersianDigits(counselor.phone || '—')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedCounselorStudents(counselor)}
                          className="font-bold text-teal-700 hover:text-teal-900"
                        >
                          {toPersianDigits(assignedStudents.length)} از {toPersianDigits(maxCap)} نفر
                        </button>
                      </td>

                      <td className="py-3 px-4 font-bold">
                        {free > 0 ? (
                          <span className="text-emerald-600">{toPersianDigits(free)} نفر خالی</span>
                        ) : (
                          <span className="text-rose-600">تکمیل</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            counselor.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                          }`}
                        >
                          {counselor.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openForm(counselor)}
                            disabled={isViewingArchived}
                            className="p-1.5 text-neutral-400 hover:text-teal-600 rounded-lg hover:bg-neutral-100"
                            title="ویرایش"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(counselor.id)}
                            disabled={isViewingArchived}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Counselor Modal */}
      {isFormModalOpen && (
        <Modal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          title={editingCounselor ? `ویرایش مشاور: ${editingCounselor.firstName} ${editingCounselor.lastName}` : 'افزودن مشاور جدید به بانک'}
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs font-medium text-neutral-700" dir="rtl">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="نام مشاور *" required>
                <input
                  type="text"
                  required
                  placeholder="مثال: فرهاد"
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </Field>

              <Field label="نام خانوادگی *" required>
                <input
                  type="text"
                  required
                  placeholder="مثال: سلیمانی"
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="زمینه تخصصی مشاوره *" required>
                <input
                  type="text"
                  required
                  placeholder="مثال: برنامه‌ریزی جامع تیزهوشان و انتخاب رشته"
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </Field>

              <Field label="سقف ظرفیت پذیرش دانش‌آموز (نفر)">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={formMaxCapacity}
                  onChange={(e) => setFormMaxCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="شماره تلفن همراه">
                <input
                  type="text"
                  placeholder="0912..."
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-left font-mono"
                  dir="ltr"
                />
              </Field>

              <Field label="کد ملی (اختیاری)">
                <input
                  type="text"
                  placeholder="۱۰ رقم"
                  maxLength={10}
                  value={formNationalId}
                  onChange={(e) => setFormNationalId(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-left font-mono"
                  dir="ltr"
                />
              </Field>

              <Field label="ایمیل (اختیاری)">
                <input
                  type="email"
                  placeholder="counselor@helli.ir"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-left"
                  dir="ltr"
                />
              </Field>
            </div>

            {/* Grades checkboxes */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                پایه‌های تحصیلی تحت پوشش این مشاور:
              </label>
              <div className="flex flex-wrap gap-2">
                {gradeOptions.map((g) => {
                  const selected = formGrades.includes(g);
                  return (
                    <button
                      type="button"
                      key={g}
                      onClick={() => handleGradeToggle(g)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        selected
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      پایه {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="یادداشت‌ها و سوابق تکمیلی">
              <textarea
                rows={2}
                placeholder="تحصیلات، مدارک روانشناسی، ساعات مشاوره و..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
              />
            </Field>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="counselorIsActive"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded border-neutral-300 focus:ring-teal-500"
              />
              <label htmlFor="counselorIsActive" className="text-xs font-bold text-neutral-800 cursor-pointer">
                مشاور فعال است (آماده پذیرش دانش‌آموز جدید)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-teal-600/20"
              >
                {editingCounselor ? 'ذخیره تغییرات' : 'ثبت در بانک مشاوران'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Counselor Students Modal */}
      {selectedCounselorStudents && (
        <Modal
          isOpen={Boolean(selectedCounselorStudents)}
          onClose={() => setSelectedCounselorStudents(null)}
          title={`دانش‌آموزان تحت پوشش مشاور ${selectedCounselorStudents.firstName} ${selectedCounselorStudents.lastName}`}
        >
          <div className="space-y-3" dir="rtl">
            {getAssignedStudents(selectedCounselorStudents.id).length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">
                هیچ دانش‌آموزی در حال حاضر به این مشاور اختصاص داده نشده است.
              </p>
            ) : (
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                {getAssignedStudents(selectedCounselorStudents.id).map((s) => (
                  <div key={s.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center">
                        {s.firstName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-neutral-900">
                            {s.firstName} {s.lastName}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-neutral-200 text-neutral-700 rounded">
                            پایه {s.grade}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2">
                          <span>مدرسه: {s.school || 'نامشخص'}</span>
                          <span>•</span>
                          <span>معدل: {toPersianDigits(s.gpa)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDossierStudent(s)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-bold text-neutral-700 transition-colors shadow-2xs"
                    >
                      <ExternalLink size={12} />
                      <span>مشاهده پرونده</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setSelectedCounselorStudents(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
              >
                بستن
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Student Dossier Modal */}
      {dossierStudent && (
        <StudentDossierModal
          studentId={dossierStudent.id}
          onClose={() => setDossierStudent(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <ConfirmModal
          isOpen={Boolean(deleteConfirmId)}
          title="حذف مشاور تحصیلی"
          description="آیا از حذف این مشاور اطمینان دارید؟ در صورت داشتن دانش‌آموز تحت پوشش، ارتباط این دانش‌آموزان با مشاور برداشته خواهد شد."
          confirmText="حذف قطعی"
          danger={true}
          onConfirm={() => handleDelete(deleteConfirmId)}
          onClose={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
};
