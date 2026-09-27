/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Bell, AlertTriangle, Clock, CheckCircle2, ShoppingBag } from 'lucide-react';
import { useAppStore } from '../store';
import { toPersianDigits, formatToman, isOverdue, daysOverdue } from '../utils';

interface SchoolNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToFinance: () => void;
  onNavigateToRegistrations: () => void;
}

export const SchoolNotificationDrawer: React.FC<SchoolNotificationDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateToFinance,
  onNavigateToRegistrations,
}) => {
  const { state, getStudentById, getClassById } = useAppStore();

  if (!isOpen) return null;

  // Find overdue installments
  const overdueItems: {
    regId: string;
    studentName: string;
    className: string;
    amount: number;
    delayDays: number;
  }[] = [];

  state.registrations.forEach((reg) => {
    if (reg.status === 'cancelled') return;
    const student = getStudentById(reg.studentId);
    const cls = getClassById(reg.classId);
    reg.plan.installments.forEach((inst) => {
      if (!inst.paidAt && isOverdue(inst.dueDate, inst.paidAt)) {
        overdueItems.push({
          regId: reg.id,
          studentName: student ? `${student.firstName} ${student.lastName}` : 'نامشخص',
          className: cls ? cls.name : 'کلاس',
          amount: inst.amount,
          delayDays: daysOverdue(inst.dueDate),
        });
      }
    });
  });

  // Pending registrations
  const pendingRegs = state.registrations.filter((r) => r.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-100">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 end-0 max-w-sm w-full bg-white/95 backdrop-blur-2xl shadow-2xl border-s border-white/90 p-5 flex flex-col z-10 animate-in slide-in-from-right duration-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-purple-600" />
            <h3 className="font-bold text-slate-900 text-sm">اعلان‌ها و هشدارهای سیستم</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {/* Overdue Section */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                <AlertTriangle size={13} />
                اقساط معوق ({toPersianDigits(overdueItems.length)})
              </span>
              <button
                type="button"
                onClick={() => {
                  onNavigateToFinance();
                  onClose();
                }}
                className="text-[10px] text-purple-700 hover:underline"
              >
                مشاهده همه
              </button>
            </div>

            {overdueItems.length === 0 ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-center text-xs">
                هیچ قسط معوقه‌ای وجود ندارد
              </div>
            ) : (
              <div className="space-y-1.5">
                {overdueItems.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onNavigateToFinance();
                      onClose();
                    }}
                    className="p-2.5 bg-rose-50/60 hover:bg-rose-50 border border-rose-100/80 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-center font-semibold text-slate-800">
                      <span>{item.studentName}</span>
                      <span className="text-rose-600">{toPersianDigits(item.delayDays)} روز تأخیر</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                      <span>{item.className}</span>
                      <span className="font-mono text-slate-700">{formatToman(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Registrations Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                <Clock size={13} />
                ثبت‌نام‌های در انتظار تأیید ({toPersianDigits(pendingRegs.length)})
              </span>
              <button
                type="button"
                onClick={() => {
                  onNavigateToRegistrations();
                  onClose();
                }}
                className="text-[10px] text-purple-700 hover:underline"
              >
                بررسی پرونده‌ها
              </button>
            </div>

            {pendingRegs.length === 0 ? (
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl text-center text-xs">
                همه ثبت‌نام‌ها تأیید شده‌اند
              </div>
            ) : (
              <div className="space-y-1.5">
                {pendingRegs.slice(0, 4).map((reg) => {
                  const student = getStudentById(reg.studentId);
                  const cls = getClassById(reg.classId);
                  return (
                    <div
                      key={reg.id}
                      onClick={() => {
                        onNavigateToRegistrations();
                        onClose();
                      }}
                      className="p-2.5 bg-amber-50/50 hover:bg-amber-50 border border-amber-100/80 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="font-semibold text-slate-800">
                        {student ? `${student.firstName} ${student.lastName}` : reg.id}
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                        <span>{cls ? cls.name : 'دوره'}</span>
                        <span className="text-amber-800 font-medium">نیاز به تأیید مدارک</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* WooCommerce Status */}
          <div className="pt-2 border-t border-slate-100">
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100/70 flex items-center gap-2.5">
              <ShoppingBag size={18} className="text-purple-600 shrink-0" />
              <div>
                <div className="font-semibold text-slate-800">اتصال ووکامرس فعال است</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  آخرین همگام‌سازی: امروز ساعت ۱۰:۳۰ (بدون خطا)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>موسسه علامه حلی</span>
          <button
            type="button"
            onClick={onClose}
            className="text-purple-700 hover:underline font-medium"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
