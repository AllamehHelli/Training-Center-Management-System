/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, Info, Check } from 'lucide-react';
import { SYSTEM_NOTIFICATIONS } from '../aiMockData';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkAllAsRead: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onMarkAllAsRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-100">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-white/95 backdrop-blur-2xl shadow-2xl border-l border-white/90 p-5 flex flex-col z-10 animate-in slide-in-from-right duration-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-purple-600" />
            <h3 className="font-bold text-slate-900 text-sm">Notifications & Alerts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {SYSTEM_NOTIFICATIONS.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-2xl border transition-all ${
                n.unread
                  ? 'bg-purple-50/40 border-purple-100 shadow-2xs'
                  : 'bg-slate-50/60 border-slate-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {n.type === 'warning' ? (
                    <AlertTriangle size={13} className="text-amber-500" />
                  ) : n.type === 'success' ? (
                    <CheckCircle2 size={13} className="text-emerald-500" />
                  ) : (
                    <Info size={13} className="text-purple-500" />
                  )}
                  <span className="font-semibold text-slate-900 text-xs">{n.title}</span>
                </div>
                <span className="text-[10px] text-slate-400">{n.time}</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:text-purple-900 transition-colors"
          >
            <Check size={12} />
            <span>Mark all as read</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-neutral-900 text-white rounded-full text-xs font-medium hover:bg-neutral-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
