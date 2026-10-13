/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from './store';
import { useFieldSettings } from './Settings';
import { toPersianDigits, formatToman, calculateClassDuration, parseSessionTimeRange, migrateSessionTimes } from './utils';
import { ClassRoom, ClassSession, SessionKind, StudentGrade } from './types';
import { Modal, ConfirmModal, ProgressBar, useToast, Field, InfoTooltip } from './ui';
import { DayPicker, TimeRangePicker } from './SchedulePickers';
import {
  Package,
  Layers,
  BookOpen,
  Check,
  Link as LinkIcon,
  Plus,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  X,
  Filter,
} from 'lucide-react';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconAlert,
} from './icons';

export interface ClassesProps {
  initialFilters?: {
    openClassId?: string;
    teacherFilter?: string;
    gradeFilter?: string;
  };
}

// ----------------------------------------------------------------------------
// Reusable Multi-Select Dropdown Component (لیست کشویی با قابلیت چند انتخابی)
// ----------------------------------------------------------------------------
interface MultiSelectCourseOption {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  tuition: number;
}

interface MultiSelectCoursesDropdownProps {
  courses: MultiSelectCourseOption[];
  selectedIds: string[];
  onChange: (newIds: string[]) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
}

const MultiSelectCoursesDropdown: React.FC<MultiSelectCoursesDropdownProps> = ({
  courses,
  selectedIds,
  onChange,
  placeholder = 'انتخاب تک‌درس‌ها از لیست کشویی...',
  label,
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilterTab, setGradeFilterTab] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueGrades = Array.from(new Set(courses.map((c) => c.grade).filter(Boolean)));

  const filteredCourses = courses.filter((c) => {
    if (gradeFilterTab !== 'all' && c.grade !== gradeFilterTab) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.teacher.toLowerCase().includes(q) ||
      c.grade.toLowerCase().includes(q)
    );
  });

  const toggleCourse = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    const allFilteredIds = Array.from(new Set([...selectedIds, ...filteredCourses.map((c) => c.id)]));
    onChange(allFilteredIds);
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedCourses = courses.filter((c) => selectedIds.includes(c.id));
  const sumTuition = selectedCourses.reduce((sum, c) => sum + (c.tuition || 0), 0);

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-neutral-800 block">{label}</label>
          {selectedIds.length > 0 && (
            <span className="text-[11px] font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
              {toPersianDigits(selectedIds.length)} تک‌درس متصل‌شده
            </span>
          )}
        </div>
      )}

      {helperText && <p className="text-[11px] text-neutral-500">{helperText}</p>}

      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3 py-2 text-right bg-white border rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2 truncate flex-1">
          <Layers size={15} className="text-indigo-600 shrink-0" />
          {selectedIds.length === 0 ? (
            <span className="text-xs text-neutral-400 truncate">{placeholder}</span>
          ) : (
            <span className="text-xs font-bold text-indigo-950 truncate">
              {toPersianDigits(selectedIds.length)} تک‌درس انتخاب شده: {selectedCourses.map((c) => c.name).join('، ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-neutral-400">
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
          />
        </div>
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in flex flex-col max-h-80">
          {/* Search, Grade Pills & Actions Bar */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام درس، استاد یا پایه..."
                className="w-full pr-8 pl-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 text-right"
                autoFocus
              />
              <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick Grade Filter Tabs */}
            {uniqueGrades.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] no-scrollbar">
                <button
                  type="button"
                  onClick={() => setGradeFilterTab('all')}
                  className={`px-2 py-0.5 rounded-md font-bold shrink-0 transition-colors cursor-pointer ${
                    gradeFilterTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  همه پایه‌ها ({toPersianDigits(courses.length)})
                </button>
                {uniqueGrades.map((g) => {
                  const cnt = courses.filter((c) => c.grade === g).length;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGradeFilterTab(g)}
                      className={`px-2 py-0.5 rounded-md font-bold shrink-0 transition-colors cursor-pointer ${
                        gradeFilterTab === g
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      پایه {g} ({toPersianDigits(cnt)})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] px-1">
              <button
                type="button"
                onClick={selectAll}
                className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
              >
                انتخاب همه نتایج ({toPersianDigits(filteredCourses.length)})
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-red-500 hover:text-red-700 cursor-pointer"
                >
                  پاک کردن انتخاب‌ها
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-100 flex-1">
            {filteredCourses.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                هیچ تک‌درسی با این مشخصات یافت نشد
              </div>
            ) : (
              filteredCourses.map((course) => {
                const isSelected = selectedIds.includes(course.id);
                return (
                  <div
                    key={course.id}
                    onClick={() => toggleCourse(course.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/80 text-indigo-950 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0 cursor-pointer"
                      />
                      <div className="truncate">
                        <div className="truncate font-bold">{course.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal truncate">
                          پایه {course.grade} • مدرس: {course.teacher}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-left mr-2">
                      <span className="text-[10px] font-mono text-emerald-700 font-bold block">
                        {formatToman(course.tuition)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Done Bar */}
          <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500">
              تعداد انتخاب: <strong>{toPersianDigits(selectedIds.length)}</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              تأیید و بستن
            </button>
          </div>
        </div>
      )}

      {/* Selected Tags Pills (تگ‌های دروس متصل‌شده با امکان حذف تکی) */}
      {selectedCourses.length > 0 && (
        <div className="pt-1.5 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {selectedCourses.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-medium shadow-2xs"
              >
                <span>{c.name}</span>
                <span className="text-[10px] text-indigo-500 font-mono">({formatToman(c.tuition)})</span>
                <button
                  type="button"
                  onClick={() => toggleCourse(c.id)}
                  className="text-indigo-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                  title="حذف از پکیج"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          <div className="text-[11px] text-indigo-900 bg-indigo-50/50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
            <span>
              مجموع شهریه تک‌درس‌های متصل: <strong className="font-mono">{formatToman(sumTuition)}</strong>
            </span>
            <span className="text-slate-400 text-[10px]">
              {toPersianDigits(selectedCourses.length)} تک‌درس متصل‌شده به این پکیج
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const Classes: React.FC<ClassesProps> = ({ initialFilters }) => {
  const { state, dispatch, getSessionEnrolledCount } = useAppStore();
  const { grades } = useFieldSettings();
  const { showToast } = useToast();

  // Active top tab: 'single' (تک‌درس‌ها) or 'packages' (پکیج‌های جامع)
  const [activeTab, setActiveTab] = useState<'single' | 'packages'>('single');

  // Filters
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [teacherFilter, setTeacherFilter] = useState<'all' | string>('all');

  // Collapsible States for Boxes (قابلیت جمع‌شوندگی برای هر باکس)
  const [collapsedCourseIds, setCollapsedCourseIds] = useState<Record<string, boolean>>({});
  const [collapsedPackageIds, setCollapsedPackageIds] = useState<Record<string, boolean>>({});
  const [allCoursesCollapsed, setAllCoursesCollapsed] = useState(false);
  const [allPackagesCollapsed, setAllPackagesCollapsed] = useState(false);

  // Form Section Collapsible States
  const [isSessionsSectionCollapsed, setIsSessionsSectionCollapsed] = useState(false);
  const [isPackageAttachSectionCollapsed, setIsPackageAttachSectionCollapsed] = useState(false);
  const [collapsedSessionBoxIds, setCollapsedSessionBoxIds] = useState<Record<string, boolean>>({});

  // Deletion state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // 1. Single Course Form State (اختصاصی تعریف تک‌درس)
  // --------------------------------------------------------------------------
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [courseFormName, setCourseFormName] = useState('');
  const [courseFormGrade, setCourseFormGrade] = useState<StudentGrade>(grades[0] || 'هفتم');
  const [courseFormTeacherId, setCourseFormTeacherId] = useState<string>('');
  const [courseFormTeacher, setCourseFormTeacher] = useState('');
  const [courseFormTuition, setCourseFormTuition] = useState<number>(12000000);
  const [courseFormSessions, setCourseFormSessions] = useState<ClassSession[]>([]);
  const [courseFormPackageIds, setCourseFormPackageIds] = useState<string[]>([]);
  const [courseFormError, setCourseFormError] = useState('');

  // --------------------------------------------------------------------------
  // 2. Package Form State (اختصاصی تعریف پکیج با لیست کشویی چند انتخابی)
  // --------------------------------------------------------------------------
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ClassRoom | null>(null);
  const [packageFormName, setPackageFormName] = useState('');
  const [packageFormGrade, setPackageFormGrade] = useState<StudentGrade>(grades[0] || 'هفتم');
  const [packageFormTuition, setPackageFormTuition] = useState<number>(30000000);
  const [packageFormCourseIds, setPackageFormCourseIds] = useState<string[]>([]);
  const [packageFormSessions, setPackageFormSessions] = useState<ClassSession[]>([]);
  const [packageFormError, setPackageFormError] = useState('');

  // --------------------------------------------------------------------------
  // 3. Quick Attach Modal (اتصال تک‌درس به پکیج با لیست کشویی)
  // --------------------------------------------------------------------------
  const [quickAttachClass, setQuickAttachClass] = useState<ClassRoom | null>(null);
  const [quickAttachSelectedPackageIds, setQuickAttachSelectedPackageIds] = useState<string[]>([]);

  // --------------------------------------------------------------------------
  // 4. Batch Selection States for Single Courses
  // --------------------------------------------------------------------------
  const [selectedBatchClassIds, setSelectedBatchClassIds] = useState<string[]>([]);
  const [isBatchAttachModalOpen, setIsBatchAttachModalOpen] = useState(false);
  const [batchTargetPackageId, setBatchTargetPackageId] = useState('');

  // Minimum capacity guard (LO-5)
  const liveEnrolledByBell = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of state.registrations) {
      if (r.status === 'cancelled') continue;
      if (r.isPackage && r.packageSelections && r.packageSelections.length > 0) {
        for (const sel of r.packageSelections) {
          const key = `${sel.classId}::${sel.sessionId}`;
          map.set(key, (map.get(key) ?? 0) + 1);
        }
      } else {
        const key = `${r.classId}::${r.sessionId}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [state.registrations]);

  const minCapacityFor = (targetClassId: string | undefined, ses: ClassSession): number => {
    if (!targetClassId) return 1;
    return Math.max(1, liveEnrolledByBell.get(`${targetClassId}::${ses.id}`) ?? ses.enrolledCount ?? 0);
  };

  // Filter single courses vs packages
  const singleCourses = state.classes.filter((c) => !c.isPackage);
  const packageCourses = state.classes.filter((c) => !!c.isPackage);

  const filteredSingleCourses = singleCourses.filter((c) => {
    if (gradeFilter !== 'all' && c.grade !== gradeFilter) return false;
    if (teacherFilter !== 'all' && c.teacherId !== teacherFilter) return false;
    return true;
  });

  const filteredPackages = packageCourses.filter((c) => {
    if (gradeFilter !== 'all' && c.grade !== gradeFilter) return false;
    return true;
  });

  // Toggle Collapse handlers
  const toggleCourseCollapse = (id: string) => {
    setCollapsedCourseIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePackageCollapse = (id: string) => {
    setCollapsedPackageIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllCoursesCollapse = () => {
    const nextState = !allCoursesCoursesState();
    const update: Record<string, boolean> = {};
    singleCourses.forEach((c) => {
      update[c.id] = nextState;
    });
    setCollapsedCourseIds(update);
    setAllCoursesCollapsed(nextState);
  };

  const allCoursesCoursesState = () => {
    if (filteredSingleCourses.length === 0) return false;
    return filteredSingleCourses.every((c) => collapsedCourseIds[c.id]);
  };

  const toggleAllPackagesCollapse = () => {
    const nextState = !allPackagesState();
    const update: Record<string, boolean> = {};
    packageCourses.forEach((p) => {
      update[p.id] = nextState;
    });
    setCollapsedPackageIds(update);
    setAllPackagesCollapsed(nextState);
  };

  const allPackagesState = () => {
    if (filteredPackages.length === 0) return false;
    return filteredPackages.every((p) => collapsedPackageIds[p.id]);
  };

  // Handle incoming deep-link action from notifications
  const lastProcessedFilterRef = useRef<string>('');
  useEffect(() => {
    if (!initialFilters) return;
    const filterKey = JSON.stringify(initialFilters);
    if (lastProcessedFilterRef.current === filterKey) return;
    lastProcessedFilterRef.current = filterKey;

    if (initialFilters.gradeFilter) {
      setGradeFilter(initialFilters.gradeFilter);
    }
    if (initialFilters.teacherFilter) {
      setTeacherFilter(initialFilters.teacherFilter);
    }
    if (initialFilters.openClassId) {
      const targetClass = state.classes.find((c) => c.id === initialFilters.openClassId);
      if (targetClass) {
        if (targetClass.isPackage) {
          setActiveTab('packages');
          openPackageForm(targetClass);
        } else {
          setActiveTab('single');
          openCourseForm(targetClass);
        }
      }
    }
  }, [initialFilters]);

  // --------------------------------------------------------------------------
  // Single Course Modal Handlers
  // --------------------------------------------------------------------------
  const openCourseForm = (c?: ClassRoom) => {
    setCourseFormError('');
    if (c) {
      setEditingClass(c);
      setCourseFormName(c.name);
      setCourseFormGrade(c.grade);
      setCourseFormTeacherId(c.teacherId || '');
      setCourseFormTeacher(c.teacher);
      setCourseFormTuition(c.tuition);
      const currentParentPkgs = state.classes
        .filter((pkg) => pkg.isPackage && pkg.packageCourseIds?.includes(c.id))
        .map((pkg) => pkg.id);
      setCourseFormPackageIds(currentParentPkgs);

      setCourseFormSessions(
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
      setCourseFormName('');
      setCourseFormGrade((gradeFilter !== 'all' ? (gradeFilter as StudentGrade) : grades[0]) || 'هفتم');
      setCourseFormTeacherId('');
      setCourseFormTeacher('');
      setCourseFormTuition(12000000);
      setCourseFormPackageIds([]);
      setCourseFormSessions([
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
    setIsCourseModalOpen(true);
  };

  const handleCourseAddSession = () => {
    setCourseFormSessions((prev) => [
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

  const handleCourseRemoveSession = (id: string) => {
    if (courseFormSessions.length <= 1) {
      showToast('حداقل یک زنگ آموزشی برای کلاس الزامی است', 'info');
      return;
    }
    setCourseFormSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCourseSessionKindChange = (id: string, kind: SessionKind) => {
    setCourseFormSessions((prev) =>
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
        return { ...s, kind, days: defaultDays, label: defaultLabel };
      })
    );
  };

  const handleCourseUpdateSession = (id: string, field: keyof ClassSession, val: any) => {
    setCourseFormSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleCourseUpdateTimeRange = (id: string, start: string, end: string) => {
    const dur = calculateClassDuration(start, end);
    const displayTime = `${toPersianDigits(start)} الی ${toPersianDigits(end)} (${dur.formatted})`;
    setCourseFormSessions((prev) =>
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

  const handleCourseFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCourseFormError('');

    if (!courseFormName.trim()) {
      setCourseFormError('نام تک‌درس الزامی است');
      return;
    }
    if (!courseFormTeacher.trim()) {
      setCourseFormError('نام مدرس دوره الزامی است');
      return;
    }
    if (courseFormTuition <= 0) {
      setCourseFormError('مبلغ شهریه باید عددی مثبت باشد');
      return;
    }
    if (courseFormSessions.length === 0) {
      setCourseFormError('حداقل یک زنگ آموزشی الزامی است');
      return;
    }

    for (let i = 0; i < courseFormSessions.length; i++) {
      const ses = courseFormSessions[i];
      if (!ses.days.trim()) {
        setCourseFormError(`لطفاً روزهای برگزاری زنگ ${toPersianDigits(i + 1)} را مشخص کنید`);
        return;
      }
      const minCap = minCapacityFor(editingClass?.id, ses);
      if (!(ses.capacity >= 1)) {
        setCourseFormError(`ظرفیت زنگ ${toPersianDigits(i + 1)} باید دست‌کم ۱ نفر باشد`);
        return;
      }
      if (ses.capacity < minCap) {
        setCourseFormError(
          `ظرفیت «${ses.label}» نمی‌تواند کمتر از ${toPersianDigits(minCap)} نفر باشد؛ در حال حاضر ${toPersianDigits(minCap)} دانش‌آموز فعال در این زنگ ثبت‌نام دارند.`
        );
        return;
      }
    }

    const duplicate = state.classes.find(
      (c) =>
        !c.isPackage &&
        c.name.trim().toLowerCase() === courseFormName.trim().toLowerCase() &&
        c.grade === courseFormGrade &&
        c.id !== editingClass?.id
    );
    if (duplicate) {
      setCourseFormError(`تک‌درسی با نام «${courseFormName}» برای پایه ${courseFormGrade} قبلاً تعریف شده است.`);
      return;
    }

    const normalizedSessions = migrateSessionTimes([{ id: 'form', sessions: courseFormSessions }])[0]
      .sessions as ClassSession[];

    const classId = editingClass ? editingClass.id : `cls-${Date.now()}`;
    const coursePayload: ClassRoom = {
      id: classId,
      name: courseFormName.trim(),
      grade: courseFormGrade,
      teacherId: courseFormTeacherId === 'custom' || !courseFormTeacherId ? undefined : courseFormTeacherId,
      teacher: courseFormTeacher.trim(),
      tuition: courseFormTuition,
      sessions: normalizedSessions,
      isPackage: false,
    };

    if (editingClass) {
      dispatch({ type: 'UPDATE_CLASS', payload: coursePayload });
      showToast(`مشخصات تک‌درس «${coursePayload.name}» به‌روزرسانی شد`, 'success');
    } else {
      dispatch({ type: 'ADD_CLASS', payload: coursePayload });
      showToast(`تک‌درس «${coursePayload.name}» با موفقیت افزوده شد`, 'success');
    }

    // Synchronize package membership across all packages in store
    state.classes
      .filter((pkg) => pkg.isPackage)
      .forEach((pkg) => {
        const isAssigned = courseFormPackageIds.includes(pkg.id);
        const currentCourseIds = pkg.packageCourseIds || [];
        const alreadyHasCourse = currentCourseIds.includes(classId);

        if (isAssigned && !alreadyHasCourse) {
          const updatedPkg: ClassRoom = {
            ...pkg,
            packageCourseIds: [...currentCourseIds, classId],
          };
          dispatch({ type: 'UPDATE_CLASS', payload: updatedPkg });
        } else if (!isAssigned && alreadyHasCourse) {
          const updatedPkg: ClassRoom = {
            ...pkg,
            packageCourseIds: currentCourseIds.filter((cid) => cid !== classId),
          };
          dispatch({ type: 'UPDATE_CLASS', payload: updatedPkg });
        }
      });

    setIsCourseModalOpen(false);
  };

  // --------------------------------------------------------------------------
  // Package Form Handlers (تعریف پکیج با لیست کشویی چند انتخابی)
  // --------------------------------------------------------------------------
  const openPackageForm = (pkg?: ClassRoom) => {
    setPackageFormError('');
    if (pkg) {
      setEditingPackage(pkg);
      setPackageFormName(pkg.name);
      setPackageFormGrade(pkg.grade);
      setPackageFormTuition(pkg.tuition);
      setPackageFormCourseIds(pkg.packageCourseIds || []);
      setPackageFormSessions(
        pkg.sessions.map((s) => {
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
      setEditingPackage(null);
      setPackageFormName('');
      const targetGrade = (gradeFilter !== 'all' ? (gradeFilter as StudentGrade) : grades[0]) || 'هفتم';
      setPackageFormGrade(targetGrade);
      setPackageFormTuition(35000000);
      setPackageFormCourseIds([]);
      setPackageFormSessions([
        {
          id: `ses-${Date.now()}-1`,
          kind: 'even',
          label: 'زنگ جامع روزهای زوج',
          days: 'شنبه، دوشنبه، چهارشنبه',
          time: '۱۶:۰۰ الی ۱۹:۱۵ (۳ ساعت و ۱۵ دقیقه)',
          startTime: '16:00',
          endTime: '19:15',
          durationMinutes: 195,
          capacity: 30,
        },
        {
          id: `ses-${Date.now()}-2`,
          kind: 'odd',
          label: 'زنگ جامع روزهای فرد',
          days: 'یکشنبه، سه‌شنبه، پنجشنبه',
          time: '۱۶:۰۰ الی ۱۹:۱۵ (۳ ساعت و ۱۵ دقیقه)',
          startTime: '16:00',
          endTime: '19:15',
          durationMinutes: 195,
          capacity: 30,
        },
      ]);
    }
    setIsPackageModalOpen(true);
  };

  const handlePackageFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPackageFormError('');

    if (!packageFormName.trim()) {
      setPackageFormError('نام پکیج الزامی است (مثال: گاما تیزهوشان)');
      return;
    }
    if (packageFormTuition <= 0) {
      setPackageFormError('مبلغ شهریه پکیج باید عددی مثبت باشد');
      return;
    }
    if (packageFormSessions.length === 0) {
      setPackageFormError('حداقل یک زنگ آموزشی برای پکیج الزامی است');
      return;
    }

    const duplicate = state.classes.find(
      (c) =>
        c.isPackage &&
        c.name.trim().toLowerCase() === packageFormName.trim().toLowerCase() &&
        c.grade === packageFormGrade &&
        c.id !== editingPackage?.id
    );
    if (duplicate) {
      setPackageFormError(`پکیجی با نام «${packageFormName}» برای پایه ${packageFormGrade} قبلاً تعریف شده است.`);
      return;
    }

    const normalizedSessions = migrateSessionTimes([{ id: 'pkg', sessions: packageFormSessions }])[0]
      .sessions as ClassSession[];

    const pkgId = editingPackage ? editingPackage.id : `pkg-${Date.now()}`;
    const pkgPayload: ClassRoom = {
      id: pkgId,
      name: packageFormName.trim(),
      grade: packageFormGrade,
      teacher: 'دپارتمان اساتید پکیج تیزهوشان',
      tuition: packageFormTuition,
      sessions: normalizedSessions,
      isPackage: true,
      packageCourseIds: packageFormCourseIds,
    };

    if (editingPackage) {
      dispatch({ type: 'UPDATE_CLASS', payload: pkgPayload });
      showToast(`مشخصات پکیج «${pkgPayload.name}» به‌روزرسانی شد`, 'success');
    } else {
      dispatch({ type: 'ADD_CLASS', payload: pkgPayload });
      showToast(`پکیج آموزشی «${pkgPayload.name}» با موفقیت تعریف شد`, 'success');
    }

    setIsPackageModalOpen(false);
  };

  // --------------------------------------------------------------------------
  // Quick Attach Single Course to Packages
  // --------------------------------------------------------------------------
  const openQuickAttachModal = (course: ClassRoom) => {
    setQuickAttachClass(course);
    const parentPkgIds = state.classes
      .filter((pkg) => pkg.isPackage && pkg.packageCourseIds?.includes(course.id))
      .map((pkg) => pkg.id);
    setQuickAttachSelectedPackageIds(parentPkgIds);
  };

  const handleSaveQuickAttach = () => {
    if (!quickAttachClass) return;
    const cid = quickAttachClass.id;

    state.classes
      .filter((pkg) => pkg.isPackage)
      .forEach((pkg) => {
        const isAssigned = quickAttachSelectedPackageIds.includes(pkg.id);
        const currentCourseIds = pkg.packageCourseIds || [];
        const hasIt = currentCourseIds.includes(cid);

        if (isAssigned && !hasIt) {
          dispatch({
            type: 'UPDATE_CLASS',
            payload: { ...pkg, packageCourseIds: [...currentCourseIds, cid] },
          });
        } else if (!isAssigned && hasIt) {
          dispatch({
            type: 'UPDATE_CLASS',
            payload: { ...pkg, packageCourseIds: currentCourseIds.filter((id) => id !== cid) },
          });
        }
      });

    showToast(`اتصال درس «${quickAttachClass.name}» به پکیج‌ها ذخیره شد`, 'success');
    setQuickAttachClass(null);
  };

  // --------------------------------------------------------------------------
  // Direct Quick Inline Dropdown Course Attachment for Package Cards
  // --------------------------------------------------------------------------
  const handleUpdatePackageCoursesDirectly = (pkg: ClassRoom, newCourseIds: string[]) => {
    const updatedPkg: ClassRoom = {
      ...pkg,
      packageCourseIds: newCourseIds,
    };
    dispatch({ type: 'UPDATE_CLASS', payload: updatedPkg });
    showToast(`تک‌درس‌های پکیج «${pkg.name}» به‌روزرسانی شد (${toPersianDigits(newCourseIds.length)} درس)`, 'success');
  };

  // --------------------------------------------------------------------------
  // Batch Actions
  // --------------------------------------------------------------------------
  const handleToggleBatchSelect = (id: string) => {
    setSelectedBatchClassIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchCreateNewPackage = () => {
    if (selectedBatchClassIds.length === 0) return;
    const chosen = state.classes.filter((c) => selectedBatchClassIds.includes(c.id));
    const targetGrade = chosen[0]?.grade || grades[0] || 'هفتم';
    const sumTuition = chosen.reduce((acc, c) => acc + (c.tuition || 0), 0);

    setEditingPackage(null);
    setPackageFormError('');
    setPackageFormName(`پکیج جامع پایه ${targetGrade} (${toPersianDigits(chosen.length)} درس)`);
    setPackageFormGrade(targetGrade);
    setPackageFormTuition(sumTuition);
    setPackageFormCourseIds(selectedBatchClassIds);
    setPackageFormSessions([
      {
        id: `ses-${Date.now()}-1`,
        kind: 'even',
        label: 'زنگ جامع روزهای زوج',
        days: 'شنبه، دوشنبه، چهارشنبه',
        time: '۱۶:۰۰ الی ۱۹:۱۵ (۳ ساعت و ۱۵ دقیقه)',
        startTime: '16:00',
        endTime: '19:15',
        durationMinutes: 195,
        capacity: 30,
      },
      {
        id: `ses-${Date.now()}-2`,
        kind: 'odd',
        label: 'زنگ جامع روزهای فرد',
        days: 'یکشنبه، سه‌شنبه، پنجشنبه',
        time: '۱۶:۰۰ الی ۱۹:۱۵ (۳ ساعت و ۱۵ دقیقه)',
        startTime: '16:00',
        endTime: '19:15',
        durationMinutes: 195,
        capacity: 30,
      },
    ]);
    setIsPackageModalOpen(true);
  };

  const handleBatchAttachToExistingPackage = (targetPkgId: string) => {
    const targetPkg = state.classes.find((c) => c.id === targetPkgId);
    if (!targetPkg) return;
    const existingIds = new Set(targetPkg.packageCourseIds || []);
    selectedBatchClassIds.forEach((id) => existingIds.add(id));
    const updatedPkg: ClassRoom = {
      ...targetPkg,
      packageCourseIds: Array.from(existingIds),
    };
    dispatch({ type: 'UPDATE_CLASS', payload: updatedPkg });
    showToast(`${toPersianDigits(selectedBatchClassIds.length)} درس با موفقیت به پکیج «${targetPkg.name}» متصل شد`, 'success');
    setSelectedBatchClassIds([]);
    setIsBatchAttachModalOpen(false);
  };

  const handleDeleteClass = (id: string) => {
    dispatch({ type: 'DELETE_CLASS', payload: id });
    showToast('دوره/پکیج آموزشی با موفقیت حذف شد', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-900">
              مدیریت تک‌درس‌ها و پکیج‌های آموزشی
            </h2>
            <InfoTooltip
              title="ساختار تک‌درس‌ها و پکیج‌ها"
              content="پکیج‌ها (مانند «گاما تیزهوشان») از تک‌درس‌ها تشکیل می‌شوند. کافی است هنگام تعریف پکیج، تک‌درس‌ها را از لیست کشویی چند انتخابی متصل فرمایید."
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            تعریف نام پکیج‌ها، اتصال سریع تک‌درس‌ها از طریق لیست کشویی، و امکان جمع‌شدن باکس‌ها
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openPackageForm()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded-full hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
          >
            <Package size={14} className="text-indigo-600" />
            <span>تعریف پکیج جدید</span>
          </button>
          <button
            type="button"
            onClick={() => openCourseForm()}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-full hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
          >
            <BookOpen size={14} className="text-emerald-400" />
            <span>تعریف تک‌درس جدید</span>
          </button>
        </div>
      </div>

      {/* Main Mode Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 bg-neutral-100/90 rounded-2xl border border-neutral-200/80">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/60'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
            }`}
          >
            <BookOpen size={15} className={activeTab === 'single' ? 'text-emerald-600' : 'text-neutral-400'} />
            <span>دوره‌های تک‌درس</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'single' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200/80 text-neutral-600'
              }`}
            >
              {toPersianDigits(singleCourses.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('packages')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'packages'
                ? 'bg-white text-indigo-950 shadow-sm border border-indigo-200/70 ring-1 ring-indigo-500/20'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
            }`}
          >
            <Package size={15} className={activeTab === 'packages' ? 'text-indigo-600' : 'text-neutral-400'} />
            <span>پکیج‌های جامع آموزشی</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'packages' ? 'bg-indigo-100 text-indigo-800' : 'bg-neutral-200/80 text-neutral-600'
              }`}
            >
              {toPersianDigits(packageCourses.length)}
            </span>
          </button>
        </div>

        {/* Grade Filter Pill Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setGradeFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
              gradeFilter === 'all'
                ? 'bg-neutral-900 text-white font-bold'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/60'
            }`}
          >
            همه پایه‌ها
          </button>
          {grades.map((grade) => (
            <button
              key={grade}
              type="button"
              onClick={() => setGradeFilter(grade)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                gradeFilter === grade
                  ? 'bg-neutral-900 text-white font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/60'
              }`}
            >
              پایه {grade}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Batch Actions Bar for Single Courses */}
      {activeTab === 'single' && selectedBatchClassIds.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in border border-indigo-700/50">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center font-bold text-xs font-mono border border-indigo-400/30">
              {toPersianDigits(selectedBatchClassIds.length)}
            </span>
            <div>
              <div className="text-xs font-bold font-heading">
                {toPersianDigits(selectedBatchClassIds.length)} تک‌درس آموزشی انتخاب شده است
              </div>
              <div className="text-[11px] text-indigo-200">
                می‌توانید این دروس را به یک پکیج متصل کرده یا از آن‌ها پکیج جامع جدید بسازید.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (packageCourses.length === 0) {
                  showToast('هنوز هیچ پکیجی در سیستم تعریف نشده است. ابتدا یک پکیج ایجاد فرمایید.', 'info');
                  return;
                }
                setBatchTargetPackageId(packageCourses[0].id);
                setIsBatchAttachModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <LinkIcon size={14} />
              <span>اتصال به پکیج موجود...</span>
            </button>
            <button
              type="button"
              onClick={handleBatchCreateNewPackage}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FolderPlus size={14} />
              <span>ساخت پکیج جدید از این دروس</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedBatchClassIds([])}
              className="px-2.5 py-1.5 text-xs text-indigo-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: Single Courses Grid                                          */}
      {/* ==================================================================== */}
      {activeTab === 'single' && (
        <div className="space-y-4">
          {/* Sub-header with Collapse All and Teacher Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-500">
            <div className="flex items-center gap-3">
              <span>نمایش <strong>{toPersianDigits(filteredSingleCourses.length)}</strong> تک‌درس</span>
              {gradeFilter !== 'all' && <span>(پایه {gradeFilter})</span>}

              {/* Global Collapse / Expand All Button for Course Boxes */}
              {filteredSingleCourses.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllCoursesCollapse}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                  title="جمع کردن یا باز کردن تمام باکس‌های تک‌درس"
                >
                  <ChevronsUpDown size={13} className="text-slate-500" />
                  <span>{allCoursesCoursesState() ? 'باز کردن همه باکس‌ها' : 'جمع کردن همه باکس‌ها'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500 font-medium shrink-0">فیلتر استاد:</label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-neutral-200/80 rounded-full font-bold text-neutral-700 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              >
                <option value="all">همه اساتید (بانک اساتید)</option>
                {(state.teachers || []).map((t) => {
                  const count = singleCourses.filter((c) => c.teacherId === t.id).length;
                  return (
                    <option key={t.id} value={t.id}>
                      استاد {t.firstName} {t.lastName} ({toPersianDigits(count)} درس)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSingleCourses.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-neutral-200/70 space-y-3">
                <BookOpen size={36} className="mx-auto text-neutral-300" />
                <div className="text-sm font-bold text-neutral-700">هیچ تک‌درسی در این فیلتر یافت نشد</div>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  با کلیک روی دکمه «تعریف تک‌درس جدید» درس‌های مستقل را ثبت کرده و در صورت نیاز آن‌ها را به پکیج‌های آموزشی متصل نمایید.
                </p>
                <button
                  type="button"
                  onClick={() => openCourseForm()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-full hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <IconPlus size={14} />
                  <span>تعریف تک‌درس جدید</span>
                </button>
              </div>
            ) : (
              filteredSingleCourses.map((cls) => {
                let classCap = 0;
                let classEnrolled = 0;
                cls.sessions.forEach((s) => {
                  classCap += s.capacity;
                  classEnrolled += getSessionEnrolledCount(cls.id, s.id);
                });

                const isBatchSelected = selectedBatchClassIds.includes(cls.id);
                const parentPackages = state.classes.filter(
                  (p) => p.isPackage && p.packageCourseIds?.includes(cls.id)
                );
                const isCollapsed = !!collapsedCourseIds[cls.id];

                return (
                  <div
                    key={cls.id}
                    className={`bg-white rounded-3xl border transition-all flex flex-col justify-between ${
                      isCollapsed ? 'p-4' : 'p-5 sm:p-6'
                    } ${
                      isBatchSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-400/40 shadow-md bg-indigo-50/10'
                        : 'border-neutral-200/70 shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Card Header with Collapse Button (قابلیت جمع‌شوندگی) */}
                      <div className="flex items-start justify-between gap-2.5 mb-2.5">
                        <div className="flex items-start gap-2.5 truncate flex-1">
                          <input
                            type="checkbox"
                            checked={isBatchSelected}
                            onChange={() => handleToggleBatchSelect(cls.id)}
                            className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                            title="انتخاب جهت اتصال گروهی"
                          />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                                پایه {cls.grade}
                              </span>
                              {parentPackages.length > 0 && isCollapsed && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md truncate">
                                  {parentPackages[0].name}
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-neutral-900 mt-1 leading-snug truncate">
                              {cls.name}
                            </h3>
                          </div>
                        </div>

                        {/* Actions + Collapse / Expand Toggle Button */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleCourseCollapse(cls.id)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isCollapsed
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title={isCollapsed ? 'باز کردن کامل باکس' : 'جمع کردن این باکس'}
                          >
                            {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openCourseForm(cls)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="ویرایش تک‌درس"
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(cls.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف تک‌درس"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </div>

                      {/* When Collapsed: Compact Summary View */}
                      {isCollapsed ? (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <div>
                            مدرس: <strong className="text-slate-800">{cls.teacher}</strong>
                          </div>
                          <div className="font-mono text-emerald-700 font-bold">
                            {formatToman(cls.tuition)}
                          </div>
                        </div>
                      ) : (
                        /* When Expanded: Full Rich Card View */
                        <>
                          {/* Teacher info */}
                          <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
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

                          {/* Package Connection Indicator */}
                          <div className="mb-3 p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs truncate">
                              <Package size={13} className="text-indigo-600 shrink-0" />
                              {parentPackages.length > 0 ? (
                                <span className="text-indigo-900 font-semibold truncate text-[11px]">
                                  متصل به پکیج:{' '}
                                  <strong>{parentPackages.map((p) => p.name).join('، ')}</strong>
                                </span>
                              ) : (
                                <span className="text-neutral-400 text-[11px]">
                                  تک‌درس آزاد (فاقد پکیج)
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => openQuickAttachModal(cls)}
                              className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors shrink-0 shadow-2xs cursor-pointer flex items-center gap-1"
                            >
                              <LinkIcon size={10} />
                              <span>{parentPackages.length > 0 ? 'تغییر پکیج' : '+ اتصال به پکیج'}</span>
                            </button>
                          </div>

                          {/* Tuition */}
                          <div className="text-xs font-bold text-neutral-800 mb-3 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                            <span>شهریه دوره:</span>
                            <span className="font-mono text-emerald-700 font-bold">{formatToman(cls.tuition)}</span>
                          </div>

                          {/* Sessions List */}
                          <div className="space-y-2.5">
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
                                  className="p-2.5 bg-slate-50/90 rounded-xl border border-slate-200/70 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-800 text-[11px]">{ses.label}</span>
                                    <span
                                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${kindBadgeClass}`}
                                    >
                                      {kindText}
                                    </span>
                                  </div>
                                  <div className="text-slate-500 text-[10px]">
                                    {ses.days} • ساعت: {toPersianDigits(ses.time)}
                                  </div>
                                  <div className="pt-0.5">
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
                        </>
                      )}
                    </div>

                    {/* Summary Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>کل ثبت‌نام‌ها:</span>
                      <span className="font-bold text-neutral-800">
                        {toPersianDigits(classEnrolled)} از {toPersianDigits(classCap)} نفر
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: Course Packages Grid (صفحه اختصاصی تعریف و مدیریت پکیج‌ها)     */}
      {/* ==================================================================== */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          {/* Informational Guidance Box with Collapse All */}
          <div className="p-4 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 rounded-2xl border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs mt-0.5 shrink-0">
                <Package size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-950 font-heading">
                  تعریف نام پکیج و اتصال تک‌درس‌ها از لیست کشویی
                </h4>
                <p className="text-[11px] text-indigo-900/80 mt-0.5 leading-relaxed">
                  نام پکیج را تعریف کنید (مانند «گاما تیزهوشان»)؛ سپس به سادگی از طریق لیست کشویی چند انتخابی، هر تک‌درسی را که می‌خواهید به این پکیج متصل فرمایید.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {filteredPackages.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllPackagesCollapse}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="جمع کردن یا باز کردن تمام باکس‌های پکیج"
                >
                  <ChevronsUpDown size={14} className="text-slate-500" />
                  <span>{allPackagesState() ? 'باز کردن همه' : 'جمع کردن همه'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openPackageForm()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <IconPlus size={14} />
                <span>+ تعریف نام پکیج جدید</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredPackages.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-neutral-200/70 space-y-3">
                <Package size={40} className="mx-auto text-indigo-300" />
                <div className="text-sm font-bold text-neutral-800">هنوز هیچ پکیج آموزشی تعریف نشده است</div>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  یک نام پکیج (مثلاً «گاما تیزهوشان») ایجاد کنید، سپس تک‌درس‌ها را از لیست کشویی به آن متصل فرمایید.
                </p>
                <button
                  type="button"
                  onClick={() => openPackageForm()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <IconPlus size={14} />
                  <span>تعریف پکیج جدید (مانند گاما تیزهوشان)</span>
                </button>
              </div>
            ) : (
              filteredPackages.map((pkg) => {
                const subCourseIds = pkg.packageCourseIds || [];
                const attachedCourses = state.classes.filter(
                  (c) => !c.isPackage && subCourseIds.includes(c.id)
                );
                const sumAttachedTuition = attachedCourses.reduce((sum, c) => sum + (c.tuition || 0), 0);
                const packageTuition = pkg.tuition || 0;
                const discount = sumAttachedTuition > packageTuition ? sumAttachedTuition - packageTuition : 0;
                const isCollapsed = !!collapsedPackageIds[pkg.id];

                // All single courses available for package attachment
                const allAvailableCourses = singleCourses;

                return (
                  <div
                    key={pkg.id}
                    className={`bg-white rounded-3xl border border-indigo-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                      isCollapsed ? 'p-4' : 'p-6'
                    }`}
                  >
                    <div>
                      {/* Top Header with Collapse Button (قابلیت جمع‌شوندگی پکیج) */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1">
                              <Package size={12} />
                              <span>پکیج جامع</span>
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                              پایه {pkg.grade}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {toPersianDigits(attachedCourses.length)} تک‌درس متصل
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-indigo-950 mt-2 font-heading leading-tight truncate">
                            {pkg.name}
                          </h3>
                        </div>

                        {/* Actions + Collapse Button */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => togglePackageCollapse(pkg.id)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isCollapsed
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title={isCollapsed ? 'باز کردن کامل باکس پکیج' : 'جمع کردن این باکس پکیج'}
                          >
                            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openPackageForm(pkg)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="ویرایش مشخصات پکیج"
                          >
                            <IconEdit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(pkg.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف پکیج"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </div>

                      {/* When Collapsed: Compact Summary View */}
                      {isCollapsed ? (
                        <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-xs text-slate-600">
                          <div>
                            شهریه کل پکیج: <strong className="font-mono text-indigo-950 font-bold">{formatToman(packageTuition)}</strong>
                          </div>
                          <div className="text-indigo-700 text-[11px]">
                            {attachedCourses.length > 0
                              ? attachedCourses.map((c) => c.name).slice(0, 2).join('، ') + (attachedCourses.length > 2 ? ' ...' : '')
                              : 'فاقد درس متصل'}
                          </div>
                        </div>
                      ) : (
                        /* When Expanded: Full Package View with Multi-Select Dropdown */
                        <>
                          {/* Dedicated Multi-Select Dropdown to Attach Courses Right Inside the Card! */}
                          <div className="my-4 p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3">
                            <MultiSelectCoursesDropdown
                              label="اتصال تک‌درس‌ها به این پکیج (لیست کشویی چند انتخابی):"
                              helperText="از لیست کشویی زیر تک‌درس‌های مورد نظر را انتخاب یا حذف کنید تا سریعاً به این پکیج متصل شوند (محدودیتی در تعداد دروس نیست):"
                              courses={allAvailableCourses}
                              selectedIds={subCourseIds}
                              onChange={(newIds) => handleUpdatePackageCoursesDirectly(pkg, newIds)}
                              placeholder={`انتخاب از میان تمام ${toPersianDigits(allAvailableCourses.length)} تک‌درس تعریف‌شده...`}
                            />
                          </div>

                          {/* Pricing Info */}
                          <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-4">
                            <div>
                              <span className="text-neutral-500 block">شهریه تعیین‌شده پکیج:</span>
                              <span className="text-base font-bold text-indigo-950 font-mono">
                                {formatToman(packageTuition)}
                              </span>
                            </div>

                            {attachedCourses.length > 0 && (
                              <div className="text-left sm:text-right">
                                <span className="text-[11px] text-neutral-400 block">
                                  مجموع مجزای تک‌درس‌ها: <span className="font-mono">{formatToman(sumAttachedTuition)}</span>
                                </span>
                                {discount > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                                    تخفیف پکیج: {formatToman(discount)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Sessions */}
                          <div className="space-y-2 text-xs">
                            <div className="font-semibold text-slate-600 flex items-center justify-between text-[11px]">
                              <span>زنگ‌های کلی و زمان‌بندی پکیج:</span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                {toPersianDigits(pkg.sessions.length)} زنگ
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {pkg.sessions.map((ses) => (
                                <div key={ses.id} className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] space-y-1">
                                  <div className="font-bold text-slate-800">{ses.label}</div>
                                  <div className="text-slate-500 text-[10px]">{ses.days}</div>
                                  <div className="text-slate-400 text-[10px]">ساعت: {toPersianDigits(ses.time)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {!isCollapsed && (
                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>{toPersianDigits(attachedCourses.length)} تک‌درس متصل‌شده به این پکیج</span>
                        <button
                          type="button"
                          onClick={() => openPackageForm(pkg)}
                          className="text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                        >
                          ویرایش نام و تنظیمات پکیج
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: Single Course Definition (صفحه اختصاصی تعریف تک‌درس)         */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title={editingClass ? 'ویرایش تک‌درس آموزشی' : 'تعریف تک‌درس آموزشی جدید'}
        maxWidth="3xl"
      >
        <form onSubmit={handleCourseFormSubmit} className="space-y-5">
          {courseFormError && (
            <div className="p-3 bg-red-50 border border-red-200 text-[#D64545] rounded-xl text-xs flex items-center gap-2">
              <IconAlert size={16} className="shrink-0" />
              <span>{courseFormError}</span>
            </div>
          )}

          {/* Form Header info */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <BookOpen size={16} className="text-emerald-700 shrink-0" />
            <span>
              مشخصات تک‌درس را وارد کرده و در صورت تمایل، آن را به پکیج‌های آموزشی تعریف‌شده متصل فرمایید.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Course Name */}
            <Field label="نام تک‌درس" required>
              <input
                type="text"
                value={courseFormName}
                onChange={(e) => setCourseFormName(e.target.value)}
                placeholder="مثلاً: ریاضیات پیشرفته و المپیاد تیزهوشان"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              />
            </Field>

            {/* Grade Selection */}
            <Field label="پایه تحصیلی" required>
              <select
                value={courseFormGrade}
                onChange={(e) => setCourseFormGrade(e.target.value as StudentGrade)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              >
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    پایه {grade}
                  </option>
                ))}
              </select>
            </Field>

            {/* Teacher Selection */}
            <Field label="مدرس تک‌درس (بانک اساتید)" required>
              <div className="space-y-2">
                <select
                  value={courseFormTeacherId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setCourseFormTeacherId(selectedId);
                    if (selectedId && selectedId !== 'custom') {
                      const t = (state.teachers || []).find((tch) => tch.id === selectedId);
                      if (t) setCourseFormTeacher(`استاد ${t.firstName} ${t.lastName}`);
                    } else if (selectedId === 'custom') {
                      setCourseFormTeacher('');
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

                {(!courseFormTeacherId || courseFormTeacherId === 'custom') && (
                  <input
                    type="text"
                    value={courseFormTeacher}
                    onChange={(e) => setCourseFormTeacher(e.target.value)}
                    placeholder="نام و عنوان مدرس را وارد کنید (مثال: دکتر علیرضا میرزایی)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
                  />
                )}
              </div>
            </Field>

            {/* Tuition */}
            <Field label="مبلغ شهریه دوره (تومان)" required>
              <input
                type="number"
                min="0"
                step="500000"
                value={courseFormTuition}
                onChange={(e) => setCourseFormTuition(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white text-right"
              />
            </Field>
          </div>

          {/* Collapsible Box: اتصال این تک‌درس به پکیج‌های آموزشی */}
          <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Package size={15} className="text-indigo-600" />
                <span className="text-xs font-bold text-indigo-950">
                  اتصال این تک‌درس به پکیج‌های آموزشی (اختیاری)
                </span>
                {courseFormPackageIds.length > 0 && (
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-mono font-bold">
                    {toPersianDigits(courseFormPackageIds.length)} پکیج
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPackageAttachSectionCollapsed(!isPackageAttachSectionCollapsed)}
                  className="p-1 text-indigo-600 hover:bg-indigo-100/70 rounded-lg transition-colors cursor-pointer"
                  title="جمع کردن / باز کردن این بخش"
                >
                  {isPackageAttachSectionCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                </button>
              </div>
            </div>

            {!isPackageAttachSectionCollapsed && (
              <div className="space-y-2 pt-1 border-t border-indigo-100/70">
                <p className="text-[11px] text-indigo-800">
                  مشخص کنید این تک‌درس عضو کدام پکیج‌های پایه {courseFormGrade} است (مثلاً پکیج گاما تیزهوشان).
                </p>

                {(() => {
                  const availablePackages = state.classes.filter(
                    (c) => c.isPackage && c.grade === courseFormGrade
                  );
                  if (availablePackages.length === 0) {
                    return (
                      <div className="p-3 bg-white/80 rounded-xl border border-indigo-200/70 text-xs text-indigo-900 flex items-center justify-between">
                        <span>هنوز هیچ پکیجی برای پایه {courseFormGrade} تعریف نشده است.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPackageModalOpen(true);
                            setEditingPackage(null);
                            setPackageFormName('');
                            setPackageFormGrade(courseFormGrade);
                          }}
                          className="text-xs font-bold text-indigo-700 underline cursor-pointer"
                        >
                          تعریف پکیج جدید (مانند گاما تیزهوشان)
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {availablePackages.map((pkg) => {
                        const isChecked = courseFormPackageIds.includes(pkg.id);
                        return (
                          <label
                            key={pkg.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-white border-indigo-400 ring-2 ring-indigo-300 font-bold text-indigo-950 shadow-2xs'
                                : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCourseFormPackageIds((prev) => [...prev, pkg.id]);
                                  } else {
                                    setCourseFormPackageIds((prev) => prev.filter((id) => id !== pkg.id));
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                              />
                              <span className="truncate">{pkg.name}</span>
                            </div>
                            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-mono shrink-0 mr-2">
                              پکیج جامع
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Collapsible Box: تنظیمات زنگ‌های برگزاری */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#0A3528]">
                  تنظیمات زنگ‌های برگزاری کلاس <span className="text-[#D64545]">*</span>
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  {toPersianDigits(courseFormSessions.length)} زنگ
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCourseAddSession}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#0E7C5B] hover:text-[#0A3528] bg-emerald-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <IconPlus size={13} />
                  <span>افزودن زنگ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSessionsSectionCollapsed(!isSessionsSectionCollapsed)}
                  className="p-1 text-slate-500 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                  title="جمع کردن / باز کردن بخش زنگ‌ها"
                >
                  {isSessionsSectionCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                </button>
              </div>
            </div>

            {!isSessionsSectionCollapsed && (
              <div className="space-y-4 pt-1">
                {courseFormSessions.map((ses, index) => {
                  const isSessionBoxCollapsed = !!collapsedSessionBoxIds[ses.id];
                  return (
                    <div
                      key={ses.id}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200/90 space-y-3 shadow-2xs"
                    >
                      {/* Session Box Header with Collapse Button */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#0A3528] text-white text-[11px] font-bold flex items-center justify-center">
                            {toPersianDigits(index + 1)}
                          </span>
                          <span className="font-bold text-xs text-[#0A3528]">
                            {ses.label || `زنگ ${toPersianDigits(index + 1)}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedSessionBoxIds((prev) => ({
                                ...prev,
                                [ses.id]: !prev[ses.id],
                              }))
                            }
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                            title={isSessionBoxCollapsed ? 'باز کردن زنگ' : 'جمع کردن زنگ'}
                          >
                            {isSessionBoxCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCourseRemoveSession(ses.id)}
                            className="p-1 text-slate-400 hover:text-[#D64545] rounded transition-colors cursor-pointer"
                            title="حذف این زنگ"
                          >
                            <IconClose size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Session Details */}
                      {!isSessionBoxCollapsed && (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">نوع زنگ:</label>
                              <select
                                value={ses.kind}
                                onChange={(e) => handleCourseSessionKindChange(ses.id, e.target.value as SessionKind)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
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
                                onChange={(e) => handleCourseUpdateSession(ses.id, 'label', e.target.value)}
                                placeholder="مثلاً: زنگ عصر روزهای زوج"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">ظرفیت پذیرش (نفر):</label>
                              {(() => {
                                const minCap = minCapacityFor(editingClass?.id, ses);
                                const invalid = ses.capacity < minCap;
                                return (
                                  <>
                                    <input
                                      type="number"
                                      min={minCap}
                                      max="200"
                                      value={ses.capacity}
                                      onChange={(e) =>
                                        handleCourseUpdateSession(ses.id, 'capacity', Number(e.target.value) || 20)
                                      }
                                      aria-invalid={invalid}
                                      className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg focus:outline-hidden text-center ${
                                        invalid ? 'border-[#D64545] ring-1 ring-[#D64545]/30' : 'border-slate-200'
                                      }`}
                                    />
                                    {editingClass && minCap > 1 && (
                                      <div className="mt-1 text-[10px] text-slate-400">
                                        حداقل مجاز: {toPersianDigits(minCap)} نفر (ثبت‌نام فعال)
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Day Picker */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1">
                            <label className="block text-xs font-semibold text-slate-700">
                              روزهای برگزاری زنگ (انتخاب چندتایی):
                            </label>
                            <DayPicker
                              value={ses.days}
                              onChange={(newDays) => handleCourseUpdateSession(ses.id, 'days', newDays)}
                            />
                          </div>

                          {/* Time Range Picker */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1">
                            <label className="block text-xs font-semibold text-slate-700">
                              ساعت برگزاری کلاس:
                            </label>
                            <TimeRangePicker
                              startTime={ses.startTime || '16:00'}
                              endTime={ses.endTime || '17:30'}
                              onChange={(start, end) => handleCourseUpdateTimeRange(ses.id, start, end)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCourseModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0E7C5B] rounded-lg hover:bg-[#0A3528] transition-colors shadow-xs cursor-pointer"
            >
              {editingClass ? 'ذخیره تغییرات تک‌درس' : 'ثبت تک‌درس آموزشی'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL 2: Package Definition (تعریف پکیج با لیست کشویی چند انتخابی)   */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isPackageModalOpen}
        onClose={() => setIsPackageModalOpen(false)}
        title={editingPackage ? 'ویرایش پکیج آموزشی' : 'تعریف پکیج آموزشی جدید (مانند گاما تیزهوشان)'}
        maxWidth="2xl"
      >
        <form onSubmit={handlePackageFormSubmit} className="space-y-5">
          {packageFormError && (
            <div className="p-3 bg-red-50 border border-red-200 text-[#D64545] rounded-xl text-xs flex items-center gap-2">
              <IconAlert size={16} className="shrink-0" />
              <span>{packageFormError}</span>
            </div>
          )}

          <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Package size={15} className="text-indigo-600" />
              <span>تعریف پکیج و اتصال تک‌درس‌ها</span>
            </div>
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              نام پکیج را وارد کنید (مثلاً «گاما تیزهوشان»). سپس از <strong>لیست کشویی چند انتخابی</strong> زیر، تک‌درس‌های مورد نظر را به این پکیج متصل فرمایید.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Package Name */}
            <Field label="نام پکیج آموزشی" required>
              <input
                type="text"
                value={packageFormName}
                onChange={(e) => setPackageFormName(e.target.value)}
                placeholder="مثلاً: گاما تیزهوشان"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:bg-white"
              />
            </Field>

            {/* Grade */}
            <Field label="پایه تحصیلی" required>
              <select
                value={packageFormGrade}
                onChange={(e) => setPackageFormGrade(e.target.value as StudentGrade)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:bg-white"
              >
                <option value="جامع (همه پایه‌ها)">جامع (همه پایه‌ها)</option>
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    پایه {grade}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* KEY REQUEST: لیست کشویی با قابلیت چند انتخابی جهت اتصال تک‌درس‌ها */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            {(() => {
              const allSingleCourses = state.classes.filter((c) => !c.isPackage);
              const sumTuition = packageFormCourseIds.reduce(
                (sum, cid) => sum + (state.classes.find((c) => c.id === cid)?.tuition || 0),
                0
              );

              return (
                <div className="space-y-3">
                  <MultiSelectCoursesDropdown
                    label="لیست کشویی چند انتخابی تک‌درس‌ها:"
                    helperText="هر تک‌درسی که می‌خواهید جزو این پکیج باشد را از لیست کشویی زیر انتخاب نمایید (می‌توانید تمام ۷ درس یا هر تعداد دلخواه را متصل کنید):"
                    courses={allSingleCourses}
                    selectedIds={packageFormCourseIds}
                    onChange={(newIds) => setPackageFormCourseIds(newIds)}
                    placeholder={`انتخاب از میان تمام ${toPersianDigits(allSingleCourses.length)} تک‌درس تعریف‌شده...`}
                  />

                  {packageFormCourseIds.length > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-600 text-[11px]">
                        مجموع شهریه تک‌درس‌های انتخاب‌شده ({toPersianDigits(packageFormCourseIds.length)} درس):{' '}
                        <strong className="font-mono text-emerald-800 font-bold">{formatToman(sumTuition)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPackageFormTuition(sumTuition)}
                        className="text-[11px] text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 font-bold transition-colors cursor-pointer"
                      >
                        تنظیم شهریه مساوی مجموع ({formatToman(sumTuition)})
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Package Tuition */}
          <Field label="مبلغ شهریه کل پکیج (تومان)" required>
            <input
              type="number"
              min="0"
              step="500000"
              value={packageFormTuition}
              onChange={(e) => setPackageFormTuition(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:bg-white text-right"
            />
          </Field>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsPackageModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
            >
              {editingPackage ? 'ذخیره تغییرات پکیج' : 'ثبت پکیج آموزشی'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL 3: Quick Attach Single Course to Packages                      */}
      {/* ==================================================================== */}
      <Modal
        isOpen={!!quickAttachClass}
        onClose={() => setQuickAttachClass(null)}
        title={`اتصال درس «${quickAttachClass?.name || ''}» به پکیج`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            مشخص کنید این تک‌درس جزو کدام پکیج‌های پایه <strong>{quickAttachClass?.grade}</strong> است:
          </p>

          {(() => {
            const availablePkgs = state.classes.filter(
              (c) =>
                c.isPackage &&
                (c.grade === quickAttachClass?.grade ||
                  c.grade === 'جامع (همه پایه‌ها)' ||
                  c.grade === 'همه' ||
                  !c.grade)
            );
            const pkgsToDisplay = availablePkgs.length > 0 ? availablePkgs : state.classes.filter((c) => c.isPackage);
            if (pkgsToDisplay.length === 0) {
              return (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-center text-slate-500 space-y-2">
                  <div>هنوز هیچ پکیج جامعی در سیستم تعریف نشده است.</div>
                  <button
                    type="button"
                    onClick={() => {
                      const grade = quickAttachClass?.grade || 'هفتم';
                      setQuickAttachClass(null);
                      openPackageForm();
                      setPackageFormGrade(grade);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    تعریف پکیج جدید
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {pkgsToDisplay.map((pkg) => {
                  const isChecked = quickAttachSelectedPackageIds.includes(pkg.id);
                  return (
                    <label
                      key={pkg.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-indigo-50/70 border-indigo-400 font-bold text-indigo-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setQuickAttachSelectedPackageIds((prev) => [...prev, pkg.id]);
                            } else {
                              setQuickAttachSelectedPackageIds((prev) =>
                                prev.filter((id) => id !== pkg.id)
                              );
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span>{pkg.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {toPersianDigits(pkg.packageCourseIds?.length || 0)} درس
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })()}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setQuickAttachClass(null)}
              className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSaveQuickAttach}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              ذخیره اتصال
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL 4: Batch Attach Multiple Courses                               */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isBatchAttachModalOpen}
        onClose={() => setIsBatchAttachModalOpen(false)}
        title="اتصال دروس انتخابی به پکیج موجود"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            تعداد <strong>{toPersianDigits(selectedBatchClassIds.length)}</strong> درس انتخاب شده است. لطفاً پکیج جامعی که می‌خواهید این دروس به آن اضافه شوند را انتخاب نمایید:
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">انتخاب پکیج مقصد:</label>
            <select
              value={batchTargetPackageId}
              onChange={(e) => setBatchTargetPackageId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
            >
              {packageCourses.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} (پایه {pkg.grade}) - دارای {toPersianDigits(pkg.packageCourseIds?.length || 0)} درس فعلی
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-600" />
              <span>دروس در حال اتصال:</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {state.classes
                .filter((c) => selectedBatchClassIds.includes(c.id))
                .map((c) => (
                  <span key={c.id} className="px-2 py-0.5 bg-white text-indigo-800 rounded-md border border-indigo-200 text-[11px]">
                    {c.name}
                  </span>
                ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsBatchAttachModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => handleBatchAttachToExistingPackage(batchTargetPackageId)}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              تأیید و اتصال به پکیج
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDeleteClass(deleteConfirmId)}
        title="حذف دوره یا پکیج آموزشی"
        description="آیا از حذف اطمینان دارید؟ در صورت حذف پکیج، تک‌درس‌های آن حذف نخواهند شد. اما ثبت‌نام‌های وابسته به این دوره حذف می‌شوند."
        confirmText="بله، حذف شود"
        cancelText="انصراف"
      />
    </div>
  );
};
