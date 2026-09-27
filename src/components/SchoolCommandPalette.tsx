/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Command,
  ArrowRight,
  ClipboardList,
  GraduationCap,
  Layers,
  CreditCard,
  Calendar,
  Sliders,
  ShoppingBag,
  Settings,
  X,
} from 'lucide-react';
import { AppTabId } from './LeftSidebar';
import { useAppStore } from '../store';
import { toPersianDigits } from '../utils';

interface SchoolCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: AppTabId) => void;
}

export const SchoolCommandPalette: React.FC<SchoolCommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { state, getClassById } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter students
  const matchedStudents = state.students
    .filter(
      (s) =>
        s.firstName.includes(searchTerm) ||
        s.lastName.includes(searchTerm) ||
        s.nationalId.includes(searchTerm) ||
        s.phones.some((p) => p.number.includes(searchTerm))
    )
    .slice(0, 4);

  // Filter classes
  const matchedClasses = state.classes
    .filter(
      (c) =>
        c.name.includes(searchTerm) ||
        c.teacher.includes(searchTerm) ||
        c.grade.includes(searchTerm)
    )
    .slice(0, 3);

  const navActions: { id: AppTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'داشبورد تحلیلی و مدیریتی', icon: <Layers size={14} /> },
    { id: 'registrations', label: 'پرونده‌ها و ثبت‌نام جدید', icon: <ClipboardList size={14} /> },
    { id: 'students', label: 'بانک اطلاعات دانش‌آموزان', icon: <GraduationCap size={14} /> },
    { id: 'classes', label: 'کلاس‌ها و دوره‌های آموزشی', icon: <Layers size={14} /> },
    { id: 'finance', label: 'امور مالی و پیگیری اقساط', icon: <CreditCard size={14} /> },
    { id: 'academicYears', label: 'مدیریت سال‌های تحصیلی', icon: <Calendar size={14} /> },
    { id: 'paymentPlans', label: 'قالب‌های تقسیط شهریه', icon: <Sliders size={14} /> },
    { id: 'woo', label: 'تنظیمات و همگام‌سازی ووکامرس', icon: <ShoppingBag size={14} /> },
    { id: 'settings', label: 'تنظیمات و فیلدهای سامانه', icon: <Settings size={14} /> },
  ];

  const filteredNav = navActions.filter((a) =>
    a.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 overflow-hidden animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-2xl overflow-hidden z-10 text-xs">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
          <Search size={16} className="text-purple-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی سریع دانش‌آموز، کدملی، شماره تماس یا کلاس..."
            className="flex-1 bg-transparent text-slate-800 text-xs outline-none placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-3 space-y-3">
          {/* Matched Students */}
          {matchedStudents.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 px-3 py-1">دانش‌آموزان</div>
              {matchedStudents.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    onNavigateTab('students');
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                      {s.firstName[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">
                        {s.firstName} {s.lastName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        پایه {s.grade} • کد ملی: {toPersianDigits(s.nationalId)}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={13} className="text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}

          {/* Matched Classes */}
          {matchedClasses.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 px-3 py-1">کلاس‌ها و دوره‌ها</div>
              {matchedClasses.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    onNavigateTab('classes');
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      <Layers size={13} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[10px] text-slate-400">
                        استاد: {c.teacher} • پایه: {c.grade}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={13} className="text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}

          {/* Navigation Sections */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 px-3 py-1">بخش‌های سامانه</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {filteredNav.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    onNavigateTab(action.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-right"
                >
                  <div className="text-slate-400">{action.icon}</div>
                  <span className="font-medium truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400">
          <span>موسسه آموزشی تیزهوشان علامه حلی</span>
          <span>کلیدهای میانبر: ⌘K / Esc</span>
        </div>
      </div>
    </div>
  );
};
