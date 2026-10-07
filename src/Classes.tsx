/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from './store';
import { useFieldSettings } from './Settings';
import { toPersianDigits, formatToman, calculateClassDuration, parseSessionTimeRange, migrateSessionTimes } from './utils';
import { ClassRoom, ClassSession, SessionKind, StudentGrade } from './types';
import { Modal, ConfirmModal, ProgressBar, useToast, Field, InfoTooltip } from './ui';
import { DayPicker, TimeRangePicker } from './SchedulePickers';
import { Package, Layers, BookOpen, Check } from 'lucide-react';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconCalendar,
  IconAlert,
  IconCheck,
} from './icons';

export interface ClassesProps {
  initialFilters?: {
    openClassId?: string;
    teacherFilter?: string;
    gradeFilter?: string;
  };
}

export const Classes: React.FC<ClassesProps> = ({ initialFilters }) => {
  const { state, dispatch, getSessionEnrolledCount } = useAppStore();
  const { grades } = useFieldSettings();
  const { showToast } = useToast();

  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [teacherFilter, setTeacherFilter] = useState<'all' | string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formGrade, setFormGrade] = useState<StudentGrade>(grades[0] || 'هفتم');
  const [formTeacherId, setFormTeacherId] = useState<string>('');
  const [formTeacher, setFormTeacher] = useState('');
  const [formTuition, setFormTuition] = useState<number>(12000000);
  const [formSessions, setFormSessions] = useState<ClassSession[]>([]);
  const [formIsPackage, setFormIsPackage] = useState(false);
  const [formPackageCourseIds, setFormPackageCourseIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  // LO-5: active (non-cancelled) registrations per bell in the CURRENT store.
  // Used as the minimum allowed capacity in the edit form so an admin can
  // never shrink a bell below the number of students occupying it.
  const liveEnrolledByBell = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of state.registrations) {
      if (r.status === 'cancelled') continue;
      const key = `${r.classId}::${r.sessionId}`;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [state.registrations]);

  const minCapacityFor = (ses: ClassSession): number => {
    const classId = editingClass?.id;
    if (!classId) return 1; // brand-new course — nobody is enrolled yet
    // Prefer the live count; fall back to the stamped value for safety.
    return Math.max(1, liveEnrolledByBell.get(`${classId}::${ses.id}`) ?? ses.enrolledCount ?? 0);
  };

  const sessionHasError = (ses: ClassSession): boolean =>
    ses.capacity < minCapacityFor(ses);

  // Filter classes
  const filteredClasses = state.classes.filter((c) => {
    if (gradeFilter !== 'all' && c.grade !== gradeFilter) return false;
    if (teacherFilter !== 'all' && c.teacherId !== teacherFilter) return false;
    return true;
  });

  const openForm = (c?: ClassRoom) => {
    setFormError('');
    if (c) {
      setEditingClass(c);
      setFormName(c.name);
      setFormGrade(c.grade);
      setFormTeacherId(c.teacherId || '');
      setFormTeacher(c.teacher);
      setFormTuition(c.tuition);
      setFormIsPackage(!!c.isPackage);
      setFormPackageCourseIds(c.packageCourseIds || []);
      // ME-2: derive real start/end times by parsing the session `time` string
      // (e.g. "۰۹:۰۰ الی ۱۳:۰۰") instead of guessing a fixed 16:00–17:30.
      setFormSessions(
        c.sessions.map((s) => {
          if (s.startTime && s.endTime) return { ...s };
          const parsed = parseSessionTimeRange(s.time);
          return {
            ...s,
            startTime: s.startTime || parsed?.startTime || '',
            endTime: s.endTime || parsed?.endTime || '',
          };
        })
      );
    } else {
      setEditingClass(null);
      setFormName('');
      setFormGrade(grades[0] || 'هفتم');
      setFormTeacher('');
      setFormTuition(12000000);
      setFormIsPackage(false);
      setFormPackageCourseIds([]);
      setFormSessions([
        {
          id: `ses-${Date.now()}-1`,
          kind: 'even',
          label: 'زنگ روزهای زوج',
          days: 'شنبه، دوشنبه، چهارشنبه',
          time: '۱۶:۰۰ الی ۱۷:۳۰ (۱ ساعت و ۳۰ دقیقه)',
          startTime: '16:00',
          endTime: '17:30',
          durationMinutes: 90,
          capacity: 25,
        },
        {
          id: `ses-${Date.now()}-2`,
          kind: 'odd',
          label: 'زنگ روزهای فرد',
          days: 'یکشنبه، سه‌شنبه، پنجشنبه',
          time: '۱۷:۴۵ الی ۱۹:۱۵ (۱ ساعت و ۳۰ دقیقه)',
          startTime: '17:45',
          endTime: '19:15',
          durationMinutes: 90,
          capacity: 25,
        },
      ]);
    }
    setIsModalOpen(true);
  };

  // Handle incoming deep-link action from notifications
  useEffect(() => {
    if (!initialFilters) return;
    if (initialFilters.gradeFilter) {
      setGradeFilter(initialFilters.gradeFilter);
    }
    if (initialFilters.teacherFilter) {
      setTeacherFilter(initialFilters.teacherFilter);
    }
    if (initialFilters.openClassId) {
      const targetClass = state.classes.find((c) => c.id === initialFilters.openClassId);
      if (targetClass) {
        openForm(targetClass);
      }
    }
  }, [initialFilters, state.classes]);

  const handleAddSession = () => {
    setFormSessions((prev) => [
      ...prev,
      {
        id: `ses-${Date.now()}-${prev.length + 1}`,
        kind: 'custom',
        label: `زنگ اختصاصی ${toPersianDigits(prev.length + 1)}`,
        days: 'پنجشنبه',
        time: '۰۹:۰۰ الی ۱۲:۰۰ (۳ ساعت)',
        startTime: '09:00',
        endTime: '12:00',
        durationMinutes: 180,
        capacity: 20,
      },
    ]);
  };

  const handleRemoveSession = (id: string) => {
    if (formSessions.length <= 1) {
      showToast('حداقل یک زنگ آموزشی برای کلاس الزامی است', 'info');
      return;
    }
    setFormSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSessionKindChange = (id: string, kind: SessionKind) => {
    setFormSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        let defaultDays = s.days;
        let defaultLabel = s.label;
        if (kind === 'even') {
          defaultDays = 'شنبه، دوشنبه، چهارشنبه';
          defaultLabel = 'زنگ روزهای زوج';
        } else if (kind === 'odd') {
          defaultDays = 'یکشنبه، سه‌شنبه، پنجشنبه';
          defaultLabel = 'زنگ روزهای فرد';
        } else {
          defaultDays = 'پنجشنبه، جمعه';
          defaultLabel = 'کارگاه پنجشنبه و جمعه';
        }
        return {
          ...s,
          kind,
          days: defaultDays,
          label: defaultLabel,
        };
      })
    );
  };

  const handleUpdateSession = (
    id: string,
    field: keyof ClassSession,
    val: any
  ) => {
    setFormSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleUpdateTimeRange = (id: string, start: string, end: string, durationStr: string) => {
    const dur = calculateClassDuration(start, end);
    const displayTime = `${toPersianDigits(start)} الی ${toPersianDigits(end)} (${dur.formatted})`;
    setFormSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              startTime: start,
              endTime: end,
              durationMinutes: dur.minutes,
              time: displayTime,
            }
          : s
      )
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('نام دوره آموزشی الزامی است');
      return;
    }
    if (!formTeacher.trim()) {
      setFormError('نام مدرس دوره الزامی است');
      return;
    }
    if (formTuition <= 0) {
      setFormError('مبلغ شهریه باید عددی مثبت باشد');
      return;
    }
    if (formSessions.length === 0) {
      setFormError('حداقل یک زنگ آموزشی الزامی است');
      return;
    }

    // Check sessions validity
    for (let i = 0; i < formSessions.length; i++) {
      const ses = formSessions[i];
      if (!ses.days.trim()) {
        setFormError(`لطفاً روزهای برگزاری زنگ ${toPersianDigits(i + 1)} را از طریق انتخابگر مشخص کنید`);
        return;
      }
      // LO-5: capacity must never drop below the number of active students
      // already enrolled in that bell.
      const minCap = minCapacityFor(ses);
      if (!(ses.capacity >= 1)) {
        setFormError(`ظرفیت زنگ ${toPersianDigits(i + 1)} باید دست‌کم ۱ نفر باشد`);
        return;
      }
      if (ses.capacity < minCap) {
        setFormError(
          `ظرفیت «${ses.label}» نمی‌تواند کمتر از ${toPersianDigits(minCap)} نفر باشد؛ ` +
            `در حال حاضر ${toPersianDigits(minCap)} دانش‌آموز فعال در این زنگ ثبت‌نام دارد.`
        );
        return;
      }
    }

    if (formIsPackage && formPackageCourseIds.length < 2) {
      setFormError('یک پکیج جامع آموزشی باید حداقل شامل ۲ درس مستقل باشد.');
      return;
    }

    // Check duplicate course name + grade
    const duplicate = state.classes.find(
      (c) =>
        c.name.trim().toLowerCase() === formName.trim().toLowerCase() &&
        c.grade === formGrade &&
        c.id !== editingClass?.id
    );
    if (duplicate) {
      setFormError(`دوره‌ای با نام «${formName}» برای پایه ${formGrade} قبلاً تعریف شده است.`);
      return;
    }

    // ME-2: normalize session times against their display `time` string before
    // persisting, so a stale/guessed startTime/endTime can never be saved.
    const normalizedSessions = migrateSessionTimes([{ id: 'form', sessions: formSessions }])[0]
      .sessions as ClassSession[];

    if (editingClass) {
      const updated: ClassRoom = {
        ...editingClass,
        name: formName.trim(),
        grade: formGrade,
        teacherId: formIsPackage ? undefined : (formTeacherId || undefined),
        teacher: formIsPackage ? (formTeacher.trim() || 'دپارتمان اساتید پکیج تیزهوشان') : formTeacher.trim(),
        tuition: formTuition,
        sessions: normalizedSessions,
        isPackage: formIsPackage,
        packageCourseIds: formIsPackage ? formPackageCourseIds : undefined,
      };
      dispatch({ type: 'UPDATE_CLASS', payload: updated });
      showToast(formIsPackage ? 'مشخصات پکیج جامع آموزشی با موفقیت به‌روزرسانی شد' : 'مشخصات دوره آموزشی با موفقیت به‌روزرسانی شد', 'success');
    } else {
      const newClass: ClassRoom = {
        id: `cls-${Date.now()}`,
        name: formName.trim(),
        grade: formGrade,
        teacherId: formIsPackage ? undefined : (formTeacherId || undefined),
        teacher: formIsPackage ? (formTeacher.trim() || 'دپارتمان اساتید پکیج تیزهوشان') : formTeacher.trim(),
        tuition: formTuition,
        sessions: normalizedSessions,
        isPackage: formIsPackage,
        packageCourseIds: formIsPackage ? formPackageCourseIds : undefined,
      };
      dispatch({ type: 'ADD_CLASS', payload: newClass });
      showToast(formIsPackage ? `پکیج جامع «${newClass.name}» با موفقیت تعریف شد` : `دوره «${newClass.name}» با موفقیت افزوده شد`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleDeleteClass = (id: string) => {
    dispatch({ type: 'DELETE_CLASS', payload: id });
    showToast('دوره آموزشی و برنامه‌های وابسته حذف شدند', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-900">کلاس‌ها و زنگ‌های آموزشی</h2>
            <InfoTooltip
              title="مدیریت دوره‌های آموزشی"
              content="تعریف کلاس‌های آموزشی، تعیین شهریه دوره، نام استاد، زنگ‌های روزهای زوج، فرد و اختصاصی به همراه پایش هوشمند ظرفیت صندلی‌های باقیمانده."
            />
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            برنامه کلاس‌ها، زمان‌بندی زنگ‌های زوج و فرد و پایش ظرفیت هر دوره
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openForm()}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-full hover:bg-neutral-800 transition-colors shadow-xs"
          >
            <IconPlus size={15} />
            <span>تعریف دوره جدید</span>
          </button>
        </div>
      </div>

      {/* Filter Bar: Grade Tabs + Teacher Bank Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Dynamic Grade Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100/80 rounded-full w-fit">
          <button
            type="button"
            onClick={() => setGradeFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              gradeFilter === 'all'
                ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            همه دوره‌ها ({toPersianDigits(state.classes.length)})
          </button>
          {grades.map((grade) => {
            const count = state.classes.filter((c) => c.grade === grade).length;
            return (
              <button
                key={grade}
                type="button"
                onClick={() => setGradeFilter(grade)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                  gradeFilter === grade
                    ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <span>پایه {grade}</span>
                <span className="text-[10px] opacity-75 font-mono">({toPersianDigits(count)})</span>
              </button>
            );
          })}
        </div>

        {/* Teacher Bank Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-500 font-medium shrink-0">فیلتر استاد:</label>
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-neutral-200/80 rounded-full font-bold text-neutral-700 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
          >
            <option value="all">همه اساتید (بانک اساتید)</option>
            {(state.teachers || []).map((t) => {
              const count = state.classes.filter((c) => c.teacherId === t.id).length;
              return (
                <option key={t.id} value={t.id}>
                  استاد {t.firstName} {t.lastName} ({toPersianDigits(count)} دوره)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClasses.length === 0 ? (
          <div className="col-span-full py-12 text-center text-neutral-400 bg-white rounded-3xl border border-neutral-200/70">
            هیچ دوره‌ای در این پایه تحصیلی تعریف نشده است. با دکمه «تعریف دوره جدید» شروع کنید.
          </div>
        ) : (
          filteredClasses.map((cls) => {
            let classCap = 0;
            let classEnrolled = 0;
            cls.sessions.forEach((s) => {
              classCap += s.capacity;
              classEnrolled += getSessionEnrolledCount(cls.id, s.id);
            });

            return (
              <div
                key={cls.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cls.isPackage ? (
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1">
                            <Package size={12} />
                            <span>پکیج جامع ({toPersianDigits(cls.packageCourseIds?.length || 0)} درس)</span>
                          </span>
                        ) : null}
                        <span className="text-[11px] font-semibold text-[#0E7C5B] bg-emerald-50 px-2 py-0.5 rounded-md">
                          پایه {cls.grade}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[#0A3528] mt-1.5 leading-snug">
                        {cls.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openForm(cls)}
                        className="p-1.5 text-slate-400 hover:text-[#0E7C5B] hover:bg-slate-100 rounded-lg transition-colors"
                        title="ویرایش دوره"
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(cls.id)}
                        className="p-1.5 text-slate-400 hover:text-[#D64545] hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف دوره"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 mb-3 flex items-center justify-between">
                    <div>
                      مدرس: <strong className="text-slate-800">{cls.teacher}</strong>
                    </div>
                    {(() => {
                      const tch = (state.teachers || []).find((t) => t.id === cls.teacherId);
                      return tch ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                          {tch.specialty}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* Sub-courses pills if package */}
                  {cls.isPackage && cls.packageCourseIds && cls.packageCourseIds.length > 0 && (
                    <div className="mb-3 p-2.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-1.5">
                      <div className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1">
                        <Layers size={13} className="text-indigo-600" />
                        <span>دروس زیرمجموعه پکیج ({toPersianDigits(cls.packageCourseIds.length)} درس):</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cls.packageCourseIds.map((subId) => {
                          const subCls = state.classes.find((c) => c.id === subId);
                          return subCls ? (
                            <span
                              key={subId}
                              className="text-[10px] bg-white border border-indigo-200/80 text-indigo-800 px-2 py-0.5 rounded-md font-medium"
                              title={`مدرس: ${subCls.teacher}`}
                            >
                              {subCls.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  <div className="text-xs font-bold text-[#0A3528] mb-4 pb-3 border-b border-slate-100">
                    شهریه دوره: {formatToman(cls.tuition)}
                  </div>

                  {/* Sessions List */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                      <span>زنگ‌های برگزاری و ظرفیت:</span>
                      <span className="text-slate-400 text-[10px]">
                        {toPersianDigits(cls.sessions.length)} زنگ
                      </span>
                    </div>

                    {cls.sessions.map((ses) => {
                      const enrolled = getSessionEnrolledCount(cls.id, ses.id);
                      const remaining = Math.max(0, ses.capacity - enrolled);
                      const isFull = remaining === 0;

                      let kindBadgeClass = 'bg-[#0E7C5B]/10 text-[#0E7C5B] border-[#0E7C5B]/30';
                      let kindText = 'روز زوج';
                      if (ses.kind === 'odd') {
                        kindBadgeClass = 'bg-[#E9A13B]/10 text-[#b37016] border-[#E9A13B]/30';
                        kindText = 'روز فرد';
                      } else if (ses.kind === 'custom') {
                        kindBadgeClass = 'bg-[#3E7CB1]/10 text-[#3E7CB1] border-[#3E7CB1]/30';
                        kindText = 'سفارشی';
                      }

                      return (
                        <div
                          key={ses.id}
                          className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{ses.label}</span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${kindBadgeClass}`}
                            >
                              {kindText}
                            </span>
                          </div>
                          <div className="text-slate-600 text-[11px]">
                            {ses.days}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            ساعت: {toPersianDigits(ses.time)}
                          </div>
                          <div className="pt-1">
                            <ProgressBar
                              current={enrolled}
                              max={ses.capacity}
                              colorClass={isFull ? 'bg-[#D64545]' : 'bg-[#0E7C5B]'}
                              showText={false}
                            />
                            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                              <span className={isFull ? 'text-[#D64545] font-bold' : ''}>
                                {isFull ? 'ظرفیت تکمیل' : `${toPersianDigits(remaining)} صندلی خالی`}
                              </span>
                              <span>
                                {toPersianDigits(enrolled)} از {toPersianDigits(ses.capacity)} نفر
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total Class Summary Footer */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>کل ثبت‌نام‌های دوره:</span>
                  <span className="font-bold text-[#0A3528]">
                    {toPersianDigits(classEnrolled)} از {toPersianDigits(classCap)} نفر
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Add / Edit Class                                             */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClass ? 'ویرایش دوره آموزشی' : 'تعریف دوره آموزشی جدید'}
        maxWidth="3xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-[#D64545] rounded-xl text-xs flex items-center gap-2">
              <IconAlert size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Course Type Toggle: Single Course vs Package */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 block">نوع ساختار دوره آموزشی:</span>
              <span className="text-[11px] text-slate-500">
                مشخص کنید این دوره یک درس مستقل است یا یک پکیج جامع متشکل از چند درس زیرمجموعه
              </span>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setFormIsPackage(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !formIsPackage
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen size={13} />
                <span>درس تک</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormIsPackage(true);
                  if (!formTeacher) setFormTeacher('دپارتمان اساتید پکیج تیزهوشان');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  formIsPackage
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package size={13} />
                <span>پکیج جامع (چنددرسی)</span>
              </button>
            </div>
          </div>

          {/* If Package: Constituent Sub-Courses Selection */}
          {formIsPackage && (
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Layers size={15} className="text-indigo-600" />
                    <span>انتخاب دروس تشکیل‌دهنده پکیج (پایه {formGrade}):</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    دانش‌آموز هنگام ثبت‌نام در این پکیج، زنگ کلاسی هر یک از این دروس را انتخاب کرده و در لیست کلاسی آن‌ها ثبت می‌شود.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs shrink-0">
                  {toPersianDigits(formPackageCourseIds.length)} درس انتخاب‌شده
                </span>
              </div>

              {/* Sub-courses Checkbox Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {state.classes
                  .filter((c) => !c.isPackage && c.grade === formGrade && c.id !== editingClass?.id)
                  .map((c) => {
                    const isChecked = formPackageCourseIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-white border-indigo-400 ring-1 ring-indigo-300 font-bold text-indigo-950 shadow-2xs'
                            : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormPackageCourseIds((prev) => [...prev, c.id]);
                              } else {
                                setFormPackageCourseIds((prev) => prev.filter((id) => id !== c.id));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="truncate">{c.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 mr-2">
                          {formatToman(c.tuition)}
                        </span>
                      </label>
                    );
                  })}
              </div>

              {/* Tuition helper */}
              {formPackageCourseIds.length > 0 && (() => {
                const sumTuition = formPackageCourseIds.reduce(
                  (sum, cid) => sum + (state.classes.find((c) => c.id === cid)?.tuition || 0),
                  0
                );
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-200 text-xs">
                    <span className="text-indigo-900 text-[11px]">
                      مجموع شهریه تک‌درس‌ها: <strong className="font-mono">{formatToman(sumTuition)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormTuition(sumTuition)}
                      className="text-[11px] text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 font-bold transition-colors cursor-pointer"
                    >
                      تنظیم شهریه پکیج مساوی مجموع تک‌درس‌ها ({formatToman(sumTuition)})
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Course Name */}
            <Field label="نام دوره آموزشی" required>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثلاً: ریاضیات پیشرفته و المپیاد تیزهوشان"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              />
            </Field>

            {/* Dynamic Grade selection */}
            <Field label="پایه تحصیلی" required>
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

            {/* Teacher Selection from Bank or Custom */}
            <Field label="مدرس دوره آموزشی (بانک اساتید)" required>
              <div className="space-y-2">
                <select
                  value={formTeacherId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setFormTeacherId(selectedId);
                    if (selectedId && selectedId !== 'custom') {
                      const t = (state.teachers || []).find((tch) => tch.id === selectedId);
                      if (t) setFormTeacher(`استاد ${t.firstName} ${t.lastName}`);
                    } else if (selectedId === 'custom') {
                      setFormTeacher('');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
                >
                  <option value="">-- انتخاب از بانک اساتید ثبت‌شده --</option>
                  {(state.teachers || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.specialty})
                    </option>
                  ))}
                  <option value="custom">استاد متفرقه یا ورود دستی نام...</option>
                </select>

                {(!formTeacherId || formTeacherId === 'custom') && (
                  <input
                    type="text"
                    value={formTeacher}
                    onChange={(e) => setFormTeacher(e.target.value)}
                    placeholder="نام و عنوان مدرس را وارد کنید (مثال: دکتر علیرضا میرزایی)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
                  />
                )}
              </div>
            </Field>

            {/* Tuition */}
            <Field label="مبلغ شهریه ترم (تومان)" required>
              <input
                type="number"
                min="0"
                step="500000"
                value={formTuition}
                onChange={(e) => setFormTuition(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white text-right"
              />
            </Field>
          </div>

          {/* Interactive Multi-Session Editor with DayPicker & TimeRangePicker */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-[#0A3528] block">
                  زنگ‌های برگزاری کلاس <span className="text-[#D64545]">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  برای هر زنگ، روزها را با انتخابگر چندتایی و ساعت شروع و پایان را مشخص کنید تا مدت زمان خودکار محاسبه شود
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddSession}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#0E7C5B] hover:text-[#0A3528] bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <IconPlus size={14} />
                <span>افزودن زنگ جدید</span>
              </button>
            </div>

            <div className="space-y-4">
              {formSessions.map((ses, index) => (
                <div
                  key={ses.id}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 shadow-2xs"
                >
                  {/* Session Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#0A3528] text-white text-[11px] font-bold flex items-center justify-center">
                        {toPersianDigits(index + 1)}
                      </span>
                      <span className="font-bold text-xs text-[#0A3528]">
                        تنظیمات زنگ {toPersianDigits(index + 1)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSession(ses.id)}
                      className="p-1 text-slate-400 hover:text-[#D64545] hover:bg-white rounded-lg transition-colors"
                      title="حذف این زنگ"
                    >
                      <IconClose size={15} />
                    </button>
                  </div>

                  {/* Top row: Type & Label & Capacity */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">نوع زنگ:</label>
                      <select
                        value={ses.kind}
                        onChange={(e) => handleSessionKindChange(ses.id, e.target.value as SessionKind)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                      >
                        <option value="even">روزهای زوج</option>
                        <option value="odd">روزهای فرد</option>
                        <option value="custom">سفارشی / آخر هفته</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">عنوان زنگ:</label>
                      <input
                        type="text"
                        value={ses.label}
                        onChange={(e) => handleUpdateSession(ses.id, 'label', e.target.value)}
                        placeholder="مثلاً: زنگ عصر روزهای زوج"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">ظرفیت پذیرش (نفر):</label>
                      {(() => {
                        // LO-5: clamp the input to at least the active enrolled
                        // count and surface inline feedback when the admin
                        // types a lower value.
                        const minCap = minCapacityFor(ses);
                        const invalid = sessionHasError(ses);
                        return (
                          <>
                            <input
                              type="number"
                              min={minCap}
                              max="200"
                              value={ses.capacity}
                              onChange={(e) =>
                                handleUpdateSession(ses.id, 'capacity', Number(e.target.value) || 20)
                              }
                              aria-invalid={invalid}
                              className={`w-full px-2.5 py-1.5 bg-white border rounded-lg focus:outline-hidden text-center ${
                                invalid ? 'border-[#D64545] ring-1 ring-[#D64545]/30' : 'border-slate-200'
                              }`}
                            />
                            <div className="mt-1 text-[10px] leading-tight">
                              {editingClass && minCap > 1 ? (
                                <span className={invalid ? 'text-[#D64545] font-bold' : 'text-slate-400'}>
                                  {invalid
                                    ? `کمتر از تعداد ثبت‌نام‌شدگان (${toPersianDigits(minCap)}) مجاز نیست`
                                    : `حداقل مجاز: ${toPersianDigits(minCap)} نفر (تعداد ثبت‌نام فعال)`}
                                </span>
                              ) : null}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Interactive Day Picker (Requirement 2) */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/90 space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      روزهای برگزاری زنگ (انتخاب چندتایی):
                    </label>
                    <DayPicker
                      value={ses.days}
                      onChange={(newDays) => handleUpdateSession(ses.id, 'days', newDays)}
                    />
                  </div>

                  {/* Minimal Start & End Time with Auto Duration (Requirement 3) */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/90 space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      ساعت برگزاری کلاس (شروع و پایان با محاسبه خودکار مدت زمان):
                    </label>
                    <TimeRangePicker
                      startTime={ses.startTime || '16:00'}
                      endTime={ses.endTime || '17:30'}
                      onChange={(start, end, durationStr) =>
                        handleUpdateTimeRange(ses.id, start, end, durationStr)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0E7C5B] rounded-lg hover:bg-[#0A3528] transition-colors shadow-xs"
            >
              {editingClass ? 'ذخیره تغییرات دوره' : 'ثبت دوره آموزشی'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDeleteClass(deleteConfirmId)}
        title="حذف دوره آموزشی"
        description="آیا از حذف این دوره آموزشی اطمینان دارید؟ تمام زنگ‌ها و ثبت‌نام‌های وابسته به این دوره حذف خواهند شد."
        confirmText="بله، حذف دوره"
        cancelText="انصراف"
      />
    </div>
  );
};
