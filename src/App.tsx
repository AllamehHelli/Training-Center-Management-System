/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useAppStore, DEMO_TOOLS_ENABLED } from './store';
import { SettingsProvider } from './Settings';
import { ToastProvider, useToast, ConfirmModal } from './ui';
import { getTodayJalali, toPersianDigits, downloadCSV } from './utils';
import { BACKEND_ENABLED, clearToken, getToken } from './api';

// Icons & Lucide
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Compass,
  CreditCard,
  ShoppingBag,
  Sliders,
  Calendar,
  Download,
  Bell,
  Search,
  RotateCcw,
  Info,
  LogOut,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Menu,
  X,
  UserRound,
  GraduationCap,
  HeartHandshake,
} from 'lucide-react';
import { LogoHelli } from './Logo';
import { CommandPalette } from './components/CommandPalette';
import { TopBarDateRangeFilter, JalaliDateRange } from './components/TopBarDateRangeFilter';
import { NotificationCenter } from './components/NotificationCenter';

// Pages
import { Dashboard } from './Dashboard';
import { Registrations } from './Registrations';
import { Students } from './Students';
import { Classes } from './Classes';
import { Teachers } from './Teachers';
import { Counselors } from './Counselors';
import { Finance } from './Finance';
import { Woo } from './Woo';
import { SettingsPage } from './SettingsPage';

export type ViewMode =
  | 'dashboard'
  | 'registrations'
  | 'students'
  | 'counselors'
  | 'classes'
  | 'teachers'
  | 'finance'
  | 'woo'
  | 'settings';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('helli_sidebar_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('helli_sidebar_expanded', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<JalaliDateRange>({ preset: 'all' });
  // ME-3: filter hand-off from the dashboard table ("view all") to the
  // registrations page.
  const [registrationsFilters, setRegistrationsFilters] = useState<Record<string, string> | undefined>(undefined);
  const [financeFilters, setFinanceFilters] = useState<any>(undefined);
  const [studentsFilters, setStudentsFilters] = useState<any>(undefined);
  const [classesFilters, setClassesFilters] = useState<any>(undefined);

  const navigateTo = (view: ViewMode, clearFilters = true) => {
    if (clearFilters) {
      setRegistrationsFilters(undefined);
      setFinanceFilters(undefined);
      setStudentsFilters(undefined);
      setClassesFilters(undefined);
    }
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  const {
    state,
    dispatch,
    activeAcademicYear,
    viewingAcademicYear,
    isViewingArchived,
    switchAcademicYear,
  } = useAppStore();
  const { showToast } = useToast();
  const today = getTodayJalali();

  const navItems: {
    id: ViewMode;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  }[] = [
    { id: 'dashboard', label: 'داشبورد مدیریتی', icon: LayoutDashboard },
    { id: 'registrations', label: 'مدیریت ثبت‌نام‌ها', icon: ClipboardList },
    { id: 'students', label: 'پرونده دانش‌آموزان', icon: Users },
    { id: 'counselors', label: 'بانک مشاوران', icon: HeartHandshake },
    { id: 'classes', label: 'کلاس‌ها و زنگ‌ها', icon: Compass },
    { id: 'teachers', label: 'بانک اساتید', icon: GraduationCap },
    { id: 'finance', label: 'امور مالی و اقساط', icon: CreditCard },
    { id: 'woo', label: 'فروشگاه ووکامرس', icon: ShoppingBag },
    { id: 'settings', label: 'تنظیمات و دوره‌ها', icon: Sliders },
  ];

  const handleResetData = () => {
    dispatch({ type: 'RESET_DATA' });
    showToast('اطلاعات سامانه به داده‌های نمونه اولیه بازنشانی شد', 'info');
  };

  const handleQuickExport = () => {
    const headers = ['کد پیگیری', 'دانش‌آموز', 'پایه', 'دوره', 'وضعیت پذیرش', 'مبلغ کل (تومان)'];
    const csvContent = [
      headers.join(','),
      ...state.registrations.map((r) => {
        const student = state.students.find((s) => s.id === r.studentId);
        const classRoom = state.classes.find((c) => c.id === r.classId);
        const statusFa =
          r.status === 'approved' ? 'تأیید شده' : r.status === 'pending' ? 'در انتظار بررسی' : 'لغو شده';
        return [
          `"${r.code}"`,
          `"${student ? `${student.firstName} ${student.lastName}` : ''}"`,
          `"${student?.grade || ''}"`,
          `"${classRoom?.name || ''}"`,
          `"${statusFa}"`,
          `"${r.plan.totalAmount || r.amount}"`,
        ].join(',');
      }),
    ].join('\n');
    downloadCSV(`خروجی_ثبت_نام_${today.replace(/\//g, '-')}.csv`, csvContent);
    showToast('فایل اکسل خلاصه ثبت‌نام‌ها دانلود شد', 'success');
  };

  const pendingCount = state.registrations.filter((r) => r.status === 'pending').length;
  const currentNav = navItems.find((n) => n.id === currentView) || navItems[0];

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F8] text-slate-800 p-2 sm:p-3 lg:p-4 gap-3 lg:gap-4 select-none" dir="rtl">
      {/* ----------------------------------------------------------------- */}
      {/* Modern Glass Collapsible Sidebar (استایل شیشه‌ای با قابلیت باز و بسته شدن) */}
      {/* ----------------------------------------------------------------- */}
      <aside
        className={`no-print fixed inset-y-3 right-3 z-40 bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.06)] ring-1 ring-slate-900/5 flex flex-col justify-between py-4 transition-all duration-300 ease-in-out md:static ${
          isSidebarExpanded ? 'w-[250px] px-3' : 'w-[74px] items-center px-2'
        } ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl w-[260px]' : 'translate-x-[120%] md:translate-x-0'
        }`}
      >
        {/* Top: Logo, Titles & Toggle Button */}
        <div className="flex flex-col gap-3 w-full">
          {isSidebarExpanded ? (
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 px-1">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => navigateTo('dashboard')}
                  title="موسسه تیزهوشان علامه حلی"
                  className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500/15 via-orange-500/10 to-blue-500/15 border border-purple-200/50 flex items-center justify-center p-1 shadow-2xs hover:scale-105 transition-transform shrink-0 cursor-pointer"
                >
                  <LogoHelli size={28} />
                </button>
                <div className="min-w-0">
                  <h1 className="font-heading font-extrabold text-xs text-[#162E6E] truncate">
                    علامه حلی
                  </h1>
                  <p className="text-[10px] text-slate-400 truncate">
                    سامانه هوشمند مدیریت
                  </p>
                </div>
              </div>

              {/* Collapse Toggle Button (Desktop) */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden md:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100/80 transition-all cursor-pointer"
                title="جمع کردن سایدبار"
              >
                <ChevronRight size={18} />
              </button>

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 pb-3 border-b border-slate-200/60">
              <button
                type="button"
                onClick={() => navigateTo('dashboard')}
                title="موسسه تیزهوشان علامه حلی"
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-500/15 via-orange-500/10 to-blue-500/15 border border-purple-200/50 flex items-center justify-center p-1 shadow-2xs hover:scale-105 transition-transform cursor-pointer"
              >
                <LogoHelli size={30} />
              </button>

              {/* Expand Toggle Button (Desktop) */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100/90 hover:bg-[#162E6E] text-slate-500 hover:text-white transition-all shadow-2xs cursor-pointer group"
                title="باز کردن منو و مشاهده عنوان‌ها"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}

          {/* Navigation Items Stack */}
          <nav className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-210px)] py-1 no-scrollbar">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;

              if (isSidebarExpanded) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-[#162E6E] text-white shadow-md shadow-[#162E6E]/20 scale-[1.01]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        size={18}
                        className={isActive ? 'text-white' : 'text-slate-500'}
                        strokeWidth={isActive ? 2.2 : 1.8}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.id === 'registrations' && pendingCount > 0 && (
                      <span className="px-2 py-0.5 bg-[#EA580C] text-white rounded-full text-[10px] font-mono shrink-0 shadow-2xs font-bold">
                        {toPersianDigits(pendingCount)}
                      </span>
                    )}
                  </button>
                );
              }

              return (
                <div key={item.id} className="relative group flex justify-center">
                  <button
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    onMouseEnter={() => setHoveredNavId(item.id)}
                    onMouseLeave={() => setHoveredNavId(null)}
                    aria-label={item.label}
                    className={`relative p-3 rounded-2xl transition-all duration-200 flex items-center justify-center cursor-pointer ${
                      isActive
                        ? 'bg-[#162E6E] text-white shadow-md shadow-[#162E6E]/25 scale-105'
                        : 'text-slate-400 hover:text-slate-900 hover:bg-white/90'
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />

                    {/* Pending notification dot on registrations */}
                    {item.id === 'registrations' && pendingCount > 0 && (
                      <span className="absolute top-1.5 left-1.5 w-2.5 h-2.5 bg-[#EA580C] rounded-full border-2 border-white ring-1 ring-orange-200" />
                    )}
                  </button>

                  {/* Clean Hover Tooltip in collapsed mode */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 shadow-lg z-50 flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.id === 'registrations' && pendingCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-[#EA580C] text-white rounded-md text-[10px] font-mono">
                        {toPersianDigits(pendingCount)} در انتظار
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Icons & Year Status */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/50">
          {isSidebarExpanded ? (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => navigateTo('settings')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-colors text-xs font-medium cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-slate-400" />
                  <span className="truncate">سال تحصیلی</span>
                </div>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-lg text-slate-700 font-mono font-bold">
                  {viewingAcademicYear?.shortTitle || '۱۴۰۳-۱۴۰۴'}
                </span>
              </button>

              {DEMO_TOOLS_ENABLED && (
                <button
                  type="button"
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50/60 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>بازنشانی داده‌ها</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => navigateTo('settings')}
                  aria-label="اطلاعات سامانه و سال تحصیلی"
                  className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-white/90 transition-all flex items-center justify-center cursor-pointer"
                >
                  <Info size={18} strokeWidth={1.8} />
                </button>
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 shadow-lg z-50">
                  سال تحصیلی ({viewingAcademicYear?.shortTitle || '۱۴۰۳-۱۴۰۴'})
                </div>
              </div>

              {DEMO_TOOLS_ENABLED && (
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setIsResetConfirmOpen(true)}
                    aria-label="بازنشانی داده‌های نمونه اولیه"
                    className="p-2.5 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <RotateCcw size={18} strokeWidth={1.8} />
                  </button>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 shadow-lg z-50">
                    بازنشانی داده‌های آزمایشی
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/30 z-30 md:hidden backdrop-blur-xs"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Main Workspace Frame (Modern SaaS Canvas)                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/60 backdrop-blur-md rounded-3xl border border-neutral-200/80 shadow-xs">
        {/* Modern Top Bar (Header with Breadcrumbs, Search, Date, Export, User) */}
        <header className="no-print px-4 sm:px-6 py-3 border-b border-neutral-200/60 flex items-center justify-between shrink-0 bg-white/70 backdrop-blur-sm z-10">
          {/* Leading: Mobile Menu Trigger + Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-neutral-600 hover:bg-neutral-100 rounded-xl"
              aria-label="باز کردن منو"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
              <button
                type="button"
                onClick={() => navigateTo('dashboard')}
                className="hover:text-neutral-800 transition-colors"
              >
                داشبورد
              </button>
              <ChevronRight size={14} className="text-neutral-300 rtl:rotate-180" />
              <span className="font-semibold text-neutral-800">
                {currentNav.label}
              </span>
            </div>
          </div>

          {/* Center: Search pill with Cmd+K */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-1.5 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200/80 rounded-full text-xs text-neutral-400 transition-all shadow-2xs group"
            >
              <div className="flex items-center gap-2">
                <Search size={14} className="text-neutral-400 group-hover:text-neutral-600" />
                <span>جستجوی دانش‌آموز، دوره، کد ملی...</span>
              </div>
              <kbd className="px-2 py-0.5 text-[10px] text-neutral-500 bg-white rounded-md border border-neutral-200 shadow-2xs font-medium">
                جستجو
              </kbd>
            </button>
          </div>

          {/* Trailing: Date Filter Capsule + Download + Notification + User Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Accurate Jalali Date Range Filter (Pop-over selector) */}
            <TopBarDateRangeFilter value={dateFilter} onChange={setDateFilter} />

            {/* Quick Download / Export Button */}
            <button
              type="button"
              onClick={handleQuickExport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 border border-neutral-200/80 text-neutral-700 rounded-full text-xs font-medium shadow-2xs transition-colors"
              title="دریافت خروجی اکسل سریع"
            >
              <Download size={13} className="text-neutral-500" />
              <span>خروجی</span>
            </button>

            {/* Notification Bell with Badge */}
            <button
              type="button"
              onClick={() => setIsNotificationCenterOpen((prev) => !prev)}
              className={`relative w-8 h-8 rounded-full border flex items-center justify-center transition-colors shadow-2xs ${
                isNotificationCenterOpen
                  ? 'bg-neutral-900 text-white border-neutral-900 ring-2 ring-neutral-300'
                  : 'bg-white hover:bg-neutral-50 text-neutral-600 border-neutral-200/80'
              }`}
              aria-label="مرکز رویدادها و اعلان‌ها"
              title="مرکز رویدادها و اعلان‌ها"
            >
              <Bell size={14} />
              {(unreadNotificationCount > 0 || pendingCount > 0) && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#EA580C] ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* User Profile Avatar Capsule */}
            <div className="flex items-center gap-2 pr-1 sm:pr-2 border-r border-neutral-200/70">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-700 to-indigo-900 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                <UserRound size={14} />
              </div>
              <div className="hidden xl:block text-right leading-tight">
                <span className="block text-xs font-bold text-neutral-900">
                  {BACKEND_ENABLED && getToken() ? 'مدیر سامانه' : 'کاربر محلی'}
                </span>
                <span className="block text-[10px] text-emerald-600 font-medium">
                  {BACKEND_ENABLED && getToken() ? 'متصل به سرور' : 'حالت آفلاین'}
                </span>
              </div>
              {BACKEND_ENABLED && getToken() && (
                <button
                  type="button"
                  onClick={() => {
                    clearToken();
                    window.location.reload();
                  }}
                  className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mr-1"
                  title="خروج از سامانه"
                  aria-label="خروج از حساب کاربری"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Archived Academic Year Warning Banner */}
        {isViewingArchived && (
          <div className="bg-amber-500 text-white px-4 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                شما در حال مشاهده داده‌های بایگانی <strong>{viewingAcademicYear?.title}</strong> هستید (فقط‌خواندنی).
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeAcademicYear) {
                  switchAcademicYear(activeAcademicYear.id);
                  showToast(`به سال جاری بازگشتید`, 'info');
                }
              }}
              className="px-3 py-0.5 bg-white text-amber-900 rounded-full font-bold text-[11px] self-end sm:self-auto hover:bg-amber-50"
            >
              بازگشت به سال جاری
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          <div className="max-w-[1500px] mx-auto">
            {currentView === 'dashboard' && (
              <Dashboard
                onNavigateToRegistrations={(filters) => {
                  // ME-3: carry the dashboard's active filters over.
                  setRegistrationsFilters(filters && Object.keys(filters).length > 0 ? filters : undefined);
                  setCurrentView('registrations');
                }}
                onNavigateToFinance={() => setCurrentView('finance')}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
              />
            )}
            {currentView === 'registrations' && (
              <Registrations
                initialFilters={registrationsFilters}
                onNavigate={(view, filters) => {
                  if (view === 'registrations') setRegistrationsFilters(filters);
                  else if (view === 'students') setStudentsFilters(filters);
                  else if (view === 'classes') setClassesFilters(filters);
                  else if (view === 'finance') setFinanceFilters(filters);
                  setCurrentView(view);
                }}
              />
            )}
            {currentView === 'students' && <Students initialFilters={studentsFilters} />}
            {currentView === 'counselors' && <Counselors />}
            {currentView === 'classes' && <Classes initialFilters={classesFilters} />}
            {currentView === 'teachers' && <Teachers />}
            {currentView === 'finance' && (
              <Finance
                initialFilters={financeFilters}
                onNavigate={(view, filters) => {
                  if (view === 'registrations') setRegistrationsFilters(filters);
                  else if (view === 'students') setStudentsFilters(filters);
                  else if (view === 'classes') setClassesFilters(filters);
                  else if (view === 'finance') setFinanceFilters(filters);
                  setCurrentView(view);
                }}
              />
            )}
            {currentView === 'woo' && <Woo />}
            {currentView === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Global Command Palette (⌘ K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view) => navigateTo(view)}
      />

      {/* Live Notification & Activity Center Popover */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onNavigate={(view, filters) => {
          if (view === 'registrations') {
            setRegistrationsFilters(filters);
          } else if (view === 'finance') {
            setFinanceFilters(filters);
          } else if (view === 'students') {
            setStudentsFilters(filters);
          } else if (view === 'classes') {
            setClassesFilters(filters);
          }
          setCurrentView(view);
        }}
        unreadCountChange={(count) => setUnreadNotificationCount(count)}
      />

      {/* HI-1: Reset Confirmation Modal — requires typing the exact phrase,
          and the store layer downloads a full JSON backup before resetting. */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetData}
        title="بازنشانی داده‌ها به حالت اولیه"
        description="هشدار: این کار تمام اطلاعات سامانه شامل سال‌های تحصیلی بایگانی‌شده و سوابق مالی را با داده‌های نمونه جایگزین می‌کند و قابل بازگشت نیست. پیش از بازنشانی، یک فایل پشتیبان JSON به‌صورت خودکار دانلود می‌شود؛ لطفاً آن را نگه دارید."
        confirmText="بله، بازنشانی اطلاعات"
        cancelText="انصراف"
        danger={true}
        requirePhrase="بازنشانی کن"
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </AppProvider>
    </ToastProvider>
  );
}
