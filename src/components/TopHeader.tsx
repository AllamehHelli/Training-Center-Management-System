/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Download,
  Bell,
  ChevronDown,
  Sparkles,
  Command,
  Check,
  GraduationCap,
} from 'lucide-react';
import { AppTabId } from './LeftSidebar';
import { useAppStore } from '../store';
import { toPersianDigits } from '../utils';

interface TopHeaderProps {
  currentTab: AppTabId;
  onOpenCommandPalette: () => void;
  onExportData: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  onOpenCommandPalette,
  onExportData,
  onOpenNotifications,
  unreadCount,
}) => {
  const { state, activeAcademicYear, viewingAcademicYear, switchAcademicYear } = useAppStore();
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const getBreadcrumbTitle = (tab: AppTabId) => {
    switch (tab) {
      case 'dashboard':
        return 'داشبورد مدیریتی و تحلیلی';
      case 'registrations':
        return 'مدیریت پرونده‌های ثبت‌نام';
      case 'students':
        return 'اطلاعات و پرونده دانش‌آموزان';
      case 'classes':
        return 'برنامه‌ریزی کلاس‌ها و دوره‌ها';
      case 'finance':
        return 'امور مالی و وصول اقساط';
      case 'academicYears':
        return 'مدیریت و آرشیو سال‌های تحصیلی';
      case 'paymentPlans':
        return 'قالب‌های تقسیط و محاسبات شهریه';
      case 'woo':
        return 'یکپارچه‌سازی فروشگاه ووکامرس';
      case 'settings':
        return 'پیکربندی و تنظیمات سامانه';
      default:
        return 'داشبورد مدیریتی';
    }
  };

  return (
    <header className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 text-xs select-none">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-slate-500 font-medium text-xs">
        <span className="hover:text-purple-900 transition-colors">موسسه علامه حلی</span>
        <span className="text-slate-300 font-normal">/</span>
        <span className="text-slate-900 font-bold">{getBreadcrumbTitle(currentTab)}</span>
      </div>

      {/* Right Controls & Profile */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto justify-end">
        {/* Global Search Pill Input */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white/75 hover:bg-white backdrop-blur-md border border-slate-200/80 rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-xs group w-full sm:w-64 md:w-72"
        >
          <Search size={14} className="text-slate-400 group-hover:text-purple-600 transition-colors shrink-0" />
          <span className="text-xs text-slate-500 truncate flex-1 text-right">
            جستجوی دانش‌آموز، کدملی، کلاس...
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">
            <Command size={10} /> K
          </kbd>
        </button>

        {/* Academic Year Selector Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsYearMenuOpen(!isYearMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/75 hover:bg-white backdrop-blur-md border border-slate-200/80 rounded-full text-slate-700 transition-all shadow-xs"
          >
            <Calendar size={13} className="text-purple-600 shrink-0" />
            <span className="font-semibold text-xs text-slate-800">
              {viewingAcademicYear ? viewingAcademicYear.title : 'سال تحصیلی'}
            </span>
            {viewingAcademicYear?.isArchived && (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded-full">
                آرشیو
              </span>
            )}
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {isYearMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsYearMenuOpen(false)}
              />
              <div className="absolute end-0 mt-1.5 w-60 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-xl z-40 p-1.5 text-xs animate-in fade-in duration-100">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-100">
                  انتخاب سال تحصیلی
                </div>
                {state.academicYears.map((year) => {
                  const isCurrent = viewingAcademicYear?.id === year.id;
                  const isActive = activeAcademicYear?.id === year.id;
                  return (
                    <button
                      key={year.id}
                      type="button"
                      onClick={() => {
                        switchAcademicYear(year.id);
                        setIsYearMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors ${
                        isCurrent
                          ? 'bg-purple-50 text-purple-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{year.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {toPersianDigits(year.startDate)} الی {toPersianDigits(year.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isActive && (
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] rounded-full">
                            فعال
                          </span>
                        )}
                        {isCurrent && <Check size={13} className="text-purple-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Export Data Button */}
        <button
          type="button"
          onClick={onExportData}
          title="خروجی داده‌های صفحه به فرمت اکسل / CSV"
          className="p-2 sm:px-3 sm:py-1.5 bg-white/75 hover:bg-white backdrop-blur-md border border-slate-200/80 rounded-full text-slate-700 hover:text-purple-900 transition-all shadow-xs flex items-center gap-1.5"
        >
          <Download size={13} className="text-slate-500" />
          <span className="hidden sm:inline font-medium">خروجی اکسل</span>
        </button>

        {/* Notification Bell */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative p-2 bg-white/75 hover:bg-white backdrop-blur-md border border-slate-200/80 rounded-full text-slate-700 hover:text-purple-900 transition-all shadow-xs"
          title="اعلان‌ها و هشدارهای سررسید"
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              {unreadCount > 9 ? '+۹' : toPersianDigits(unreadCount)}
            </span>
          )}
        </button>

        {/* User Profile Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 bg-white/80 hover:bg-white backdrop-blur-md border border-slate-200/80 rounded-full shadow-xs transition-all"
          >
            {/* User Avatar */}
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center font-bold text-[11px] ring-1 ring-white">
              س
            </div>

            {/* User Name & Role */}
            <div className="hidden sm:flex flex-col text-right leading-tight">
              <span className="font-semibold text-slate-900 text-xs">سارا میرزایی</span>
              <span className="text-[10px] text-purple-700 font-medium">مدیر ارشد سامانه</span>
            </div>

            <ChevronDown size={11} className="text-slate-400 mr-0.5" />
          </button>

          {isProfileMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsProfileMenuOpen(false)}
              />
              <div className="absolute end-0 mt-1.5 w-52 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-xl z-40 p-2 text-xs animate-in fade-in duration-100">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900">سارا میرزایی</div>
                  <div className="text-[11px] text-slate-500">sarah.mitchell@helli.ir</div>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-semibold">
                    Super Admin • دسترسی کامل
                  </span>
                </div>
                <div className="py-1">
                  <div className="px-3 py-1.5 text-slate-600">
                    موسسه آموزشی تیزهوشان علامه حلی
                  </div>
                  <div className="px-3 py-1 text-[11px] text-emerald-600 font-medium">
                    نسخه سامانه: ۳.۴.۰ (پایدار)
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
