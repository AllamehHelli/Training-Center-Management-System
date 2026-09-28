/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useAppStore, DEMO_TOOLS_ENABLED } from './store';
import { SettingsProvider } from './Settings';
import { ToastProvider, useToast, ConfirmModal } from './ui';
import { getTodayJalali, toPersianDigits, downloadCSV } from './utils';

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
  AlertTriangle,
  Menu,
  X,
} from 'lucide-react';
import { LogoHelli } from './Logo';
import { CommandPalette } from './components/CommandPalette';
import { TopBarDateRangeFilter, JalaliDateRange } from './components/TopBarDateRangeFilter';

// Pages
import { Dashboard } from './Dashboard';
import { Registrations } from './Registrations';
import { Students } from './Students';
import { Classes } from './Classes';
import { Finance } from './Finance';
import { Woo } from './Woo';
import { SettingsPage } from './SettingsPage';

type ViewMode =
  | 'dashboard'
  | 'registrations'
  | 'students'
  | 'classes'
  | 'finance'
  | 'woo'
  | 'settings';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<JalaliDateRange>({ preset: 'all' });

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
    { id: 'classes', label: 'کلاس‌ها و زنگ‌ها', icon: Compass },
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
      {/* Minimal Icon Sidebar (Exact replication of screenshot)            */}
      {/* ----------------------------------------------------------------- */}
      <aside
        className={`no-print fixed inset-y-3 right-3 z-40 w-[74px] bg-white/95 backdrop-blur-md rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col items-center justify-between py-5 transition-transform duration-300 md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-[120%] md:translate-x-0'
        }`}
      >
        {/* Top: Brand Logo Badge */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            title="موسسه تیزهوشان علامه حلی"
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500/15 via-orange-500/10 to-blue-500/15 border border-purple-200/50 flex items-center justify-center p-1.5 shadow-2xs hover:scale-105 transition-transform"
          >
            <LogoHelli size={32} />
          </button>

          {/* Navigation Icons Stack */}
          <nav className="flex flex-col items-center gap-2 mt-2">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;

              return (
                <div key={item.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    onMouseEnter={() => setHoveredNavId(item.id)}
                    onMouseLeave={() => setHoveredNavId(null)}
                    aria-label={item.label}
                    className={`relative p-3 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                      isActive
                        ? 'bg-neutral-900 text-white shadow-md scale-105'
                        : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100/90'
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />

                    {/* Pending notification dot on registrations */}
                    {item.id === 'registrations' && pendingCount > 0 && (
                      <span className="absolute top-1.5 left-1.5 w-2.5 h-2.5 bg-[#EA580C] rounded-full border-2 border-white ring-1 ring-orange-200" />
                    )}
                  </button>

                  {/* Clean Hover Tooltip */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 shadow-lg z-50 flex items-center gap-2">
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

        {/* Bottom Icons: Info & Reset */}
        <div className="flex flex-col items-center gap-2">
          {/* Info Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setCurrentView('settings')}
              aria-label="اطلاعات سامانه و سال تحصیلی"
              className="p-3 rounded-2xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100/90 transition-all flex items-center justify-center"
            >
              <Info size={19} strokeWidth={1.8} />
            </button>
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 shadow-lg z-50">
              راهنما و سال تحصیلی ({viewingAcademicYear?.shortTitle || '۱۴۰۳-۱۴۰۴'})
            </div>
          </div>

          {/* HI-1: Reset Demo Data Button — hidden entirely in operational
              builds; only available when demo tools are enabled (DEV mode or
              VITE_ENABLE_DEMO_TOOLS=true). Even then it requires typing a
              confirmation phrase and downloads an automatic backup first. */}
          {DEMO_TOOLS_ENABLED && (
            <div className="relative group">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                aria-label="بازنشانی داده‌های نمونه اولیه"
                className="p-3 rounded-2xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-all flex items-center justify-center"
              >
                <RotateCcw size={19} strokeWidth={1.8} />
              </button>
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 shadow-lg z-50">
                بازنشانی داده‌های آزمایشی
              </div>
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
                onClick={() => setCurrentView('dashboard')}
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
              onClick={() => setCurrentView('registrations')}
              className="relative w-8 h-8 rounded-full bg-white hover:bg-neutral-50 border border-neutral-200/80 flex items-center justify-center text-neutral-600 transition-colors shadow-2xs"
              aria-label="اعلان‌ها"
            >
              <Bell size={14} />
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#EA580C] ring-2 ring-white" />
              )}
            </button>

            {/* User Profile Avatar Capsule (Sarah Mitchell / Super admin) */}
            <div className="flex items-center gap-2 pr-1 sm:pr-2 border-r border-neutral-200/70">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neutral-800 to-neutral-700 text-white flex items-center justify-center text-xs font-bold font-mono shadow-2xs">
                سم
              </div>
              <div className="hidden xl:block text-right leading-tight">
                <span className="block text-xs font-bold text-neutral-900">
                  سارا محمدی
                </span>
                <span className="block text-[10px] text-neutral-400 font-medium">
                  مدیر ارشد سامانه
                </span>
              </div>
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
                onNavigateToRegistrations={() => setCurrentView('registrations')}
                onNavigateToFinance={() => setCurrentView('finance')}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
              />
            )}
            {currentView === 'registrations' && <Registrations />}
            {currentView === 'students' && <Students />}
            {currentView === 'classes' && <Classes />}
            {currentView === 'finance' && <Finance />}
            {currentView === 'woo' && <Woo />}
            {currentView === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Global Command Palette (⌘ K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view) => setCurrentView(view)}
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
