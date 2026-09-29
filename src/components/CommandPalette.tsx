/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { toPersianDigits } from '../utils';
import {
  IconSearch,
  IconClose,
  IconDashboard,
  IconRegistrations,
  IconStudents,
  IconClasses,
  IconFinance,
  IconWoo,
  IconSettings,
} from '../icons';
import { GraduationCap, HeartHandshake } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: 'dashboard' | 'registrations' | 'students' | 'counselors' | 'classes' | 'teachers' | 'finance' | 'woo' | 'settings') => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const { state } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalized = query.trim().toLowerCase();

  // Navigation pages
  const navShortcuts = [
    { id: 'dashboard' as const, label: 'داشبورد مدیریت و تحلیل پذیرش', icon: IconDashboard },
    { id: 'registrations' as const, label: 'مدیریت ثبت‌نام‌ها و پرونده‌ها', icon: IconRegistrations },
    { id: 'students' as const, label: 'پرونده اطلاعاتی دانش‌آموزان', icon: IconStudents },
    { id: 'counselors' as const, label: 'بانک مشاوران تحصیلی و ظرفیت‌ها', icon: HeartHandshake },
    { id: 'classes' as const, label: 'کلاس‌ها، زنگ‌ها و ظرفیت‌ها', icon: IconClasses },
    { id: 'teachers' as const, label: 'بانک اساتید و مدرسان دوره‌ها', icon: GraduationCap },
    { id: 'finance' as const, label: 'امور مالی، چک‌ها و دفترچه اقساط', icon: IconFinance },
    { id: 'woo' as const, label: 'اتصال ووکامرس و پرداخت اینترنتی', icon: IconWoo },
    { id: 'settings' as const, label: 'تنظیمات سامانه و سال تحصیلی', icon: IconSettings },
  ].filter((item) => !normalized || item.label.includes(normalized));

  // Matching students
  const filteredStudents = state.students
    .filter(
      (s) =>
        !normalized ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(normalized) ||
        s.nationalId.includes(normalized) ||
        (s.counselorName && s.counselorName.toLowerCase().includes(normalized)) ||
        s.phones.some((p) => p.number.includes(normalized))
    )
    .slice(0, 4);

  // Matching classes
  const filteredClasses = state.classes
    .filter((c) => !normalized || c.name.toLowerCase().includes(normalized) || c.teacher.toLowerCase().includes(normalized))
    .slice(0, 3);

  // Matching teachers
  const filteredTeachers = (state.teachers || [])
    .filter(
      (t) =>
        !normalized ||
        `${t.firstName} ${t.lastName}`.toLowerCase().includes(normalized) ||
        (t.specialty && t.specialty.toLowerCase().includes(normalized)) ||
        (t.phone && t.phone.includes(normalized))
    )
    .slice(0, 3);

  // Matching counselors
  const filteredCounselors = (state.counselors || [])
    .filter(
      (c) =>
        !normalized ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(normalized) ||
        (c.specialty && c.specialty.toLowerCase().includes(normalized)) ||
        (c.phone && c.phone.includes(normalized))
    )
    .slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4" dir="rtl">
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-neutral-200/80 overflow-hidden z-10 flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100">
          <IconSearch size={18} className="text-neutral-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی دانش‌آموز، دوره، کد ملی، شماره تماس..."
            autoFocus
            className="flex-1 bg-transparent border-none text-sm text-neutral-800 placeholder-neutral-400 focus:outline-hidden"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-medium text-neutral-400 bg-neutral-100 rounded-md border border-neutral-200/60">
            بستن
          </kbd>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 overflow-y-auto space-y-4 flex-1">
          {/* Section: Shortcuts */}
          {navShortcuts.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 px-3 py-1">
                بخش‌های سامانه
              </div>
              <div className="space-y-0.5">
                {navShortcuts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id as any);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100/80 transition-colors text-right"
                    >
                      <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600 shrink-0">
                        <Icon size={14} />
                      </div>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Students */}
          {filteredStudents.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 px-3 py-1">
                دانش‌آموزان
              </div>
              <div className="space-y-0.5">
                {filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onNavigate('students');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100/80 transition-colors text-right"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-semibold flex items-center justify-center text-xs shrink-0">
                        {s.firstName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-neutral-800">
                          {s.firstName} {s.lastName}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          کد ملی: {toPersianDigits(s.nationalId)} · پایه {s.grade}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {toPersianDigits(s.phones[0]?.number)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section: Classes */}
          {filteredClasses.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 px-3 py-1">
                دوره‌ها و کلاس‌ها
              </div>
              <div className="space-y-0.5">
                {filteredClasses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onNavigate('classes');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100/80 transition-colors text-right"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="font-medium text-neutral-800">{c.name}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">پایه {c.grade} · {c.teacher}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section: Teachers */}
          {filteredTeachers.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 px-3 py-1 flex items-center justify-between">
                <span>اساتید و مدرسان</span>
                <span className="text-[10px] text-indigo-600 font-bold">بانک اساتید</span>
              </div>
              <div className="space-y-0.5">
                {filteredTeachers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onNavigate('teachers');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100/80 transition-colors text-right"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-xs shrink-0">
                        {t.firstName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-neutral-800">
                          استاد {t.firstName} {t.lastName}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {t.specialty}
                        </div>
                      </div>
                    </div>
                    {t.phone && (
                      <span className="text-[11px] text-neutral-400 font-mono" dir="ltr">
                        {toPersianDigits(t.phone)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section: Counselors */}
          {filteredCounselors.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 px-3 py-1 flex items-center justify-between">
                <span>مشاوران تحصیلی</span>
                <span className="text-[10px] text-teal-600 font-bold">بانک مشاوران</span>
              </div>
              <div className="space-y-0.5">
                {filteredCounselors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onNavigate('counselors');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100/80 transition-colors text-right"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 font-semibold flex items-center justify-center text-xs shrink-0">
                        {c.firstName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-neutral-800">
                          مشاور {c.firstName} {c.lastName}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {c.specialty || 'هدایت تحصیلی'}
                        </div>
                      </div>
                    </div>
                    {c.phone && (
                      <span className="text-[11px] text-neutral-400 font-mono" dir="ltr">
                        {toPersianDigits(c.phone)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {navShortcuts.length === 0 && filteredStudents.length === 0 && filteredClasses.length === 0 && filteredTeachers.length === 0 && filteredCounselors.length === 0 && (
            <div className="py-8 text-center text-xs text-neutral-400">
              نتیجه‌ای برای جستجوی شما یافت نشد.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
