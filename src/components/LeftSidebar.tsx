/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutGrid,
  ClipboardList,
  GraduationCap,
  Layers,
  CreditCard,
  Calendar,
  Sliders,
  ShoppingBag,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { LogoHelli } from '../Logo';

export type AppTabId =
  | 'dashboard'
  | 'registrations'
  | 'students'
  | 'classes'
  | 'finance'
  | 'academicYears'
  | 'paymentPlans'
  | 'woo'
  | 'settings';

interface LeftSidebarProps {
  activeTab: AppTabId;
  onTabChange: (tab: AppTabId) => void;
  pendingRegistrationsCount?: number;
  overdueInstallmentsCount?: number;
  onOpenHelp?: () => void;
  onLogout?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeTab,
  onTabChange,
  pendingRegistrationsCount = 0,
  overdueInstallmentsCount = 0,
  onOpenHelp,
  onLogout,
}) => {
  const navItems: { id: AppTabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'داشبورد مدیریتی', icon: <LayoutGrid size={18} /> },
    {
      id: 'registrations',
      label: 'ثبت‌نام‌ها',
      icon: <ClipboardList size={18} />,
      badge: pendingRegistrationsCount,
    },
    { id: 'students', label: 'دانش‌آموزان', icon: <GraduationCap size={18} /> },
    { id: 'classes', label: 'کلاس‌ها و دوره‌ها', icon: <Layers size={18} /> },
    {
      id: 'finance',
      label: 'امور مالی و اقساط',
      icon: <CreditCard size={18} />,
      badge: overdueInstallmentsCount,
    },
    { id: 'academicYears', label: 'سال تحصیلی', icon: <Calendar size={18} /> },
    { id: 'paymentPlans', label: 'قالب‌های اقساط', icon: <Sliders size={18} /> },
    { id: 'woo', label: 'اتصال ووکامرس', icon: <ShoppingBag size={18} /> },
    { id: 'settings', label: 'تنظیمات سامانه', icon: <Settings size={18} /> },
  ];

  return (
    <aside className="w-14 sm:w-16 my-2 sm:my-3 mx-2 sm:mx-3 bg-white/85 backdrop-blur-xl rounded-full sm:rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center py-4 justify-between shrink-0 z-20 transition-all select-none">
      {/* Top Institute Logo with Purple subtle ring */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => onTabChange('dashboard')}
          title="موسسه علامه حلی - سامانه جامع ثبت‌نام"
          className="relative group p-1.5 rounded-2xl bg-white border border-purple-200/80 shadow-xs hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
        >
          <LogoHelli size={32} />
          <span className="sr-only">موسسه علامه حلی</span>
        </button>
      </div>

      {/* Middle Navigation Icons */}
      <nav className="flex flex-col items-center gap-1.5 sm:gap-2 my-auto py-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="relative group">
              <button
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative p-2.5 rounded-full transition-all duration-200 flex items-center justify-center ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-md shadow-neutral-900/30 scale-105'
                    : 'text-slate-400 hover:text-purple-900 hover:bg-purple-50/80'
                }`}
                aria-label={item.label}
              >
                {item.icon}

                {/* Notification badge dot */}
                {Boolean(item.badge && item.badge > 0) && !isActive && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>

              {/* Tooltip on hover */}
              <div className="absolute start-full ms-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-lg z-50">
                {item.label}
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="ms-1.5 px-1 py-0.2 bg-rose-500 text-white rounded-full text-[10px]">
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-slate-100/80 w-full px-2">
        <div className="relative group">
          <button
            type="button"
            onClick={onOpenHelp}
            title="راهنما و مستندات"
            className="p-2.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100/80 transition-colors"
          >
            <HelpCircle size={18} />
          </button>
          <div className="absolute start-full ms-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-50">
            راهنما و مستندات
          </div>
        </div>

        <div className="relative group">
          <button
            type="button"
            onClick={onLogout}
            title="خروج یا تغییر کاربر"
            className="p-2.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={18} />
          </button>
          <div className="absolute start-full ms-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-50">
            سارا میرزایی (مدیر ارشد)
          </div>
        </div>
      </div>
    </aside>
  );
};
