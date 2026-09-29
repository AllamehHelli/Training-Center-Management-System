/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from './store';
import { Teacher } from './types';
import { toPersianDigits } from './utils';
import { Modal, ConfirmModal, useToast, Field, InfoTooltip } from './ui';
import {
  GraduationCap,
  Plus,
  Search,
  BookOpen,
  Users,
  Phone,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Award,
  Calendar,
  Layers,
  LayoutGrid,
  List,
  Sparkles,
} from 'lucide-react';

export const Teachers: React.FC = () => {
  const { state, dispatch, isViewingArchived } = useAppStore();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTeacherClasses, setSelectedTeacherClasses] = useState<Teacher | null>(null);

  // Form State
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formDegree, setFormDegree] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Statistics
  const teachers = state.teachers || [];
  const activeTeachersCount = teachers.filter((t) => t.isActive).length;
  const totalClassesCount = state.classes.length;

  // Filtered teachers
  const filteredTeachers = teachers.filter((t) => {
    if (statusFilter === 'active' && !t.isActive) return false;
    if (statusFilter === 'inactive' && t.isActive) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
    const specialty = (t.specialty || '').toLowerCase();
    const degree = (t.degree || '').toLowerCase();
    const phone = (t.phone || '');
    return fullName.includes(term) || specialty.includes(term) || degree.includes(term) || phone.includes(term);
  });

  const getTeacherCourses = (teacherId: string) => {
    return state.classes.filter((c) => c.teacherId === teacherId);
  };

  const getTeacherStudentsCount = (teacherId: string) => {
    const teacherClassIds = new Set(getTeacherCourses(teacherId).map((c) => c.id));
    return state.registrations.filter((r) => teacherClassIds.has(r.classId) && r.status !== 'cancelled').length;
  };

  const openForm = (teacher?: Teacher) => {
    setFormError('');
    if (teacher) {
      setEditingTeacher(teacher);
      setFormFirstName(teacher.firstName);
      setFormLastName(teacher.lastName);
      setFormNationalId(teacher.nationalId || '');
      setFormPhone(teacher.phone || '');
      setFormEmail(teacher.email || '');
      setFormSpecialty(teacher.specialty || '');
      setFormDegree(teacher.degree || '');
      setFormNotes(teacher.notes || '');
      setFormIsActive(teacher.isActive);
    } else {
      setEditingTeacher(null);
      setFormFirstName('');
      setFormLastName('');
      setFormNationalId('');
      setFormPhone('0912');
      setFormEmail('');
      setFormSpecialty('');
      setFormDegree('');
      setFormNotes('');
      setFormIsActive(true);
    }
    setIsFormModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim() || !formLastName.trim()) {
      setFormError('نام و نام خانوادگی استاد الزامی است.');
      return;
    }
    if (!formSpecialty.trim()) {
      setFormError('زمینه تخصصی یا درس تدریسی الزامی است.');
      return;
    }

    const payload: Teacher = {
      id: editingTeacher ? editingTeacher.id : `tch-${Date.now()}`,
      firstName: formFirstName.trim(),
      lastName: formLastName.trim(),
      nationalId: formNationalId.trim() || undefined,
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      specialty: formSpecialty.trim(),
      degree: formDegree.trim() || undefined,
      notes: formNotes.trim() || undefined,
      isActive: formIsActive,
      createdAt: editingTeacher ? editingTeacher.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingTeacher) {
      dispatch({ type: 'UPDATE_TEACHER', payload });
      showToast(`اطلاعات استاد «${payload.firstName} ${payload.lastName}» به‌روزرسانی شد.`, 'success');
    } else {
      dispatch({ type: 'ADD_TEACHER', payload });
      showToast(`استاد جدید «${payload.firstName} ${payload.lastName}» به بانک اساتید اضافه شد.`, 'success');
    }

    setIsFormModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const courses = getTeacherCourses(id);
    if (courses.length > 0) {
      showToast(
        `این استاد در ${toPersianDigits(courses.length)} دوره تعریف شده است. ابتدا استاد دوره‌ها را تغییر دهید.`,
        'error'
      );
      setDeleteConfirmId(null);
      return;
    }

    dispatch({ type: 'DELETE_TEACHER', payload: id });
    showToast('استاد با موفقیت از سیستم حذف شد.', 'info');
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-700 flex items-center justify-center shadow-xs">
              <GraduationCap size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-neutral-900 tracking-tight">بانک اساتید و مدرسان</h1>
              <p className="text-xs text-neutral-500 mt-0.5">مدیریت اعضای هیئت علمی، دوره‌های تحت تدریس و سوابق تحصیلی</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openForm()}
          disabled={isViewingArchived}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50"
        >
          <Plus size={16} />
          <span>افزودن استاد جدید</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 block mb-1">کل اساتید ثبت‌شده</span>
            <span className="text-2xl font-black text-neutral-900 tracking-tight">
              {toPersianDigits(teachers.length)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 block mb-1">اساتید فعال در ترم جاری</span>
            <span className="text-2xl font-black text-emerald-600 tracking-tight">
              {toPersianDigits(activeTeachersCount)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 block mb-1">دوره‌ها و کلاس‌های دایر</span>
            <span className="text-2xl font-black text-indigo-600 tracking-tight">
              {toPersianDigits(totalClassesCount)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BookOpen size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 block mb-1">کل دانش‌آموزان در کلاس‌ها</span>
            <span className="text-2xl font-black text-neutral-900 tracking-tight">
              {toPersianDigits(state.registrations.filter((r) => r.status !== 'cancelled').length)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award size={18} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 relative max-w-md">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="جستجو بر اساس نام استاد، رشته تخصصی، مدرک..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-neutral-50/80 hover:bg-neutral-50 focus:bg-white border border-neutral-200/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-neutral-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center p-0.5 bg-neutral-100 rounded-xl text-xs font-bold text-neutral-600">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white text-neutral-900 shadow-2xs' : 'hover:text-neutral-900'}`}
            >
              همه ({toPersianDigits(teachers.length)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'active' ? 'bg-white text-emerald-600 shadow-2xs' : 'hover:text-neutral-900'}`}
            >
              فعال ({toPersianDigits(activeTeachersCount)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'inactive' ? 'bg-white text-rose-600 shadow-2xs' : 'hover:text-neutral-900'}`}
            >
              غیرفعال ({toPersianDigits(teachers.length - activeTeachersCount)})
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

      {/* Teachers Content */}
      {filteredTeachers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto mb-3">
            <GraduationCap size={28} />
          </div>
          <h3 className="text-sm font-bold text-neutral-800">هیچ استادی یافت نشد</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            موردی مطابق با جستجو یا فیلتر انتخابی پیدا نشد. برای اضافه کردن اولین استاد دکمه زیر را بزنید.
          </p>
          <button
            type="button"
            onClick={() => openForm()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/20"
          >
            <Plus size={15} />
            <span>تعریف استاد جدید</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => {
            const courses = getTeacherCourses(teacher.id);
            const studentsCount = getTeacherStudentsCount(teacher.id);

            return (
              <div
                key={teacher.id}
                className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Avatar + Name + Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center text-sm font-black shadow-xs shrink-0">
                        {teacher.firstName[0]}
                        {teacher.lastName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-extrabold text-neutral-900 group-hover:text-indigo-600 transition-colors">
                            استاد {teacher.firstName} {teacher.lastName}
                          </h3>
                        </div>
                        <span className="inline-block mt-0.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-md">
                          {teacher.specialty}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        teacher.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                      }`}
                    >
                      {teacher.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>

                  {/* Degree / Academic Info */}
                  {teacher.degree && (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-600 mb-3 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                      <Award size={14} className="text-indigo-500 shrink-0" />
                      <span className="truncate">{teacher.degree}</span>
                    </div>
                  )}

                  {/* Contact Info Pills */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                    {teacher.phone && (
                      <a
                        href={`tel:${teacher.phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700 rounded-lg text-[11px] font-medium transition-colors"
                        dir="ltr"
                      >
                        <Phone size={11} className="text-neutral-500" />
                        <span>{toPersianDigits(teacher.phone)}</span>
                      </a>
                    )}
                    {teacher.email && (
                      <a
                        href={`mailto:${teacher.email}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700 rounded-lg text-[11px] font-medium transition-colors"
                        dir="ltr"
                      >
                        <Mail size={11} className="text-neutral-500" />
                        <span className="truncate max-w-[140px]">{teacher.email}</span>
                      </a>
                    )}
                  </div>

                  {/* Courses Taught Preview */}
                  <div className="pt-3 border-t border-neutral-100">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-neutral-700 flex items-center gap-1.5">
                        <BookOpen size={13} className="text-neutral-400" />
                        <span>دوره‌های تحت تدریس</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTeacherClasses(teacher)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        {toPersianDigits(courses.length)} دوره ({toPersianDigits(studentsCount)} دانش‌آموز)
                      </button>
                    </div>

                    {courses.length === 0 ? (
                      <p className="text-[11px] text-neutral-400 italic">هنوز کلاسی به این استاد متصل نشده است.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {courses.slice(0, 2).map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-md"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="truncate max-w-[130px]">{c.name}</span>
                          </span>
                        ))}
                        {courses.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setSelectedTeacherClasses(teacher)}
                            className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-md hover:bg-neutral-200"
                          >
                            +{toPersianDigits(courses.length - 2)} دوره دیگر
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-3.5 mt-3.5 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => openForm(teacher)}
                    disabled={isViewingArchived}
                    className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="ویرایش اطلاعات استاد"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(teacher.id)}
                    disabled={isViewingArchived}
                    className="p-1.5 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="حذف استاد"
                  >
                    <Trash2 size={15} />
                  </button>
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
                  <th className="py-3 px-4">استاد</th>
                  <th className="py-3 px-4">زمینه تخصصی</th>
                  <th className="py-3 px-4">مدرک و سوابق</th>
                  <th className="py-3 px-4">اطلاعات تماس</th>
                  <th className="py-3 px-4">دوره‌های فعال</th>
                  <th className="py-3 px-4">کل دانش‌آموزان</th>
                  <th className="py-3 px-4">وضعیت</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {filteredTeachers.map((teacher) => {
                  const courses = getTeacherCourses(teacher.id);
                  const studentsCount = getTeacherStudentsCount(teacher.id);

                  return (
                    <tr key={teacher.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {teacher.firstName[0]}
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 block">
                              استاد {teacher.firstName} {teacher.lastName}
                            </span>
                            {teacher.nationalId && (
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {toPersianDigits(teacher.nationalId)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md border border-indigo-100 text-[11px]">
                          {teacher.specialty}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-neutral-600 max-w-[180px] truncate">
                        {teacher.degree || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {teacher.phone && (
                            <span className="block font-mono text-[11px] text-neutral-800" dir="ltr">
                              {toPersianDigits(teacher.phone)}
                            </span>
                          )}
                          {teacher.email && (
                            <span className="block text-[10px] text-neutral-400 truncate max-w-[120px]" dir="ltr">
                              {teacher.email}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedTeacherClasses(teacher)}
                          className="font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          {toPersianDigits(courses.length)} دوره
                        </button>
                      </td>

                      <td className="py-3 px-4 font-bold text-neutral-900">
                        {toPersianDigits(studentsCount)} نفر
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            teacher.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                          }`}
                        >
                          {teacher.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openForm(teacher)}
                            disabled={isViewingArchived}
                            className="p-1.5 text-neutral-400 hover:text-indigo-600 rounded-lg hover:bg-neutral-100"
                            title="ویرایش"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(teacher.id)}
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

      {/* Add / Edit Teacher Modal */}
      {isFormModalOpen && (
        <Modal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          title={editingTeacher ? `ویرایش استاد: ${editingTeacher.firstName} ${editingTeacher.lastName}` : 'افزودن استاد جدید به بانک'}
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs font-medium text-neutral-700" dir="rtl">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="نام استاد *" required>
                <input
                  type="text"
                  required
                  placeholder="مثال: علیرضا"
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </Field>

              <Field label="نام خانوادگی *" required>
                <input
                  type="text"
                  required
                  placeholder="مثال: میرزایی"
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="زمینه تخصصی / درس تدریسی *" required>
                <input
                  type="text"
                  required
                  placeholder="مثال: ریاضی و هندسه تیزهوشان"
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </Field>

              <Field label="مدرک تحصیلی و دانشگاه">
                <input
                  type="text"
                  placeholder="مثال: دکتری ریاضی دانشگاه صنعتی شریف"
                  value={formDegree}
                  onChange={(e) => setFormDegree(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-left font-mono"
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
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-left font-mono"
                  dir="ltr"
                />
              </Field>

              <Field label="ایمیل (اختیاری)">
                <input
                  type="email"
                  placeholder="teacher@helli.ir"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-left"
                  dir="ltr"
                />
              </Field>
            </div>

            <Field label="یادداشت‌ها و رزومه تکمیلی">
              <textarea
                rows={2}
                placeholder="سوابق تالیف، سابقه تدریس در مدارس سمپاد و..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </Field>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="formIsActive"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500"
              />
              <label htmlFor="formIsActive" className="text-xs font-bold text-neutral-800 cursor-pointer">
                استاد فعال است (آماده تدریس در دوره‌های جاری)
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
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/20"
              >
                {editingTeacher ? 'ذخیره تغییرات' : 'ثبت در بانک اساتید'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Teacher Courses Modal */}
      {selectedTeacherClasses && (
        <Modal
          isOpen={Boolean(selectedTeacherClasses)}
          onClose={() => setSelectedTeacherClasses(null)}
          title={`دوره‌های تحت تدریس: استاد ${selectedTeacherClasses.firstName} ${selectedTeacherClasses.lastName}`}
        >
          <div className="space-y-3" dir="rtl">
            {getTeacherCourses(selectedTeacherClasses.id).length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">
                هیچ دوره‌ای در حال حاضر برای این استاد ثبت نشده است.
              </p>
            ) : (
              getTeacherCourses(selectedTeacherClasses.id).map((c) => {
                const regs = state.registrations.filter((r) => r.classId === c.id && r.status !== 'cancelled');
                return (
                  <div key={c.id} className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-neutral-900">{c.name}</span>
                        <span className="px-2 py-0.5 bg-indigo-100/70 text-indigo-700 rounded-md text-[10px] font-bold">
                          پایه {c.grade}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1">
                        <span>ظرفیت کل: {toPersianDigits(c.sessions.reduce((acc, s) => acc + s.capacity, 0))} نفر</span>
                        <span>•</span>
                        <span>{toPersianDigits(c.sessions.length)} زنگ فعال</span>
                      </div>
                    </div>

                    <div className="text-left font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl">
                      {toPersianDigits(regs.length)} دانش‌آموز ثبت‌نامی
                    </div>
                  </div>
                );
              })
            )}

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setSelectedTeacherClasses(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
              >
                بستن
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <ConfirmModal
          isOpen={Boolean(deleteConfirmId)}
          title="حذف استاد از بانک"
          description="آیا از حذف این استاد اطمینان دارید؟ در صورت داشتن دوره فعال، ارتباط این دوره‌ها با استاد برداشته خواهد شد."
          confirmText="حذف قطعی"
          danger={true}
          onConfirm={() => handleDelete(deleteConfirmId)}
          onClose={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
};
