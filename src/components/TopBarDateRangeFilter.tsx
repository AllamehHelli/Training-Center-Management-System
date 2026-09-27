/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { getTodayJalali, addMonthsJalali, addDaysJalali, toPersianDigits } from '../utils';
import { IconCalendar } from '../icons';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { ChevronDown, Check, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';

export type DateFilterPreset = 'all' | 'today' | 'week' | '15days' | 'month' | '90days' | 'custom';

export interface JalaliDateRange {
  preset: DateFilterPreset;
  startDate?: string; // YYYY/MM/DD
  endDate?: string;   // YYYY/MM/DD
}

interface TopBarDateRangeFilterProps {
  value: JalaliDateRange;
  onChange: (range: JalaliDateRange) => void;
}

export const TopBarDateRangeFilter: React.FC<TopBarDateRangeFilterProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const today = getTodayJalali();

  const [customStart, setCustomStart] = useState(value.startDate || addMonthsJalali(today, -1));
  const [customEnd, setCustomEnd] = useState(value.endDate || today);

  // Close when clicking outside (ignoring clicks inside the JalaliDatePicker portal)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('[data-jalali-picker]')) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const presets: { id: DateFilterPreset; label: string; sub?: string }[] = [
    { id: 'all', label: 'همه تاریخ‌ها', sub: 'کل سال تحصیلی ۱۴۰۳-۱۴۰۴' },
    { id: 'today', label: 'امروز', sub: toPersianDigits(today) },
    { id: 'week', label: '۷ روز اخیر', sub: 'هفته گذشته تا امروز' },
    { id: '15days', label: '۱۵ روز اخیر', sub: 'دو هفته گذشته' },
    { id: 'month', label: '۳۰ روز اخیر', sub: 'یک ماه گذشته' },
    { id: 'custom', label: 'بازه دلخواه...', sub: 'انتخاب تاریخ شروع و پایان' },
  ];

  const handleSelectPreset = (preset: DateFilterPreset) => {
    if (preset === 'all') {
      onChange({ preset: 'all' });
      setIsOpen(false);
      return;
    }
    if (preset === 'today') {
      onChange({ preset: 'today', startDate: today, endDate: today });
      setIsOpen(false);
      return;
    }
    if (preset === 'custom') {
      return;
    }

    let start = today;
    if (preset === 'month') {
      start = addDaysJalali(today, -30);
    } else if (preset === '90days') {
      start = addMonthsJalali(today, -3);
    } else if (preset === 'week') {
      start = addDaysJalali(today, -7);
    } else if (preset === '15days') {
      start = addDaysJalali(today, -15);
    }

    onChange({ preset, startDate: start, endDate: today });
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    onChange({ preset: 'custom', startDate: customStart, endDate: customEnd });
    setIsOpen(false);
  };

  // Get active display text
  const getDisplayText = () => {
    if (value.preset === 'all') return 'همه تاریخ‌ها';
    if (value.preset === 'month') return '۳۰ روز اخیر';
    if (value.preset === '15days') return '۱۵ روز اخیر';
    if (value.preset === 'week') return '۷ روز اخیر';
    if (value.preset === 'today') return `امروز (${toPersianDigits(today)})`;
    if (value.preset === 'custom' && value.startDate && value.endDate) {
      return `${toPersianDigits(value.startDate)} تا ${toPersianDigits(value.endDate)}`;
    }
    return 'فیلتر تاریخ';
  };

  return (
    <div ref={containerRef} className="relative inline-block text-right">
      {/* Trigger Button (Top Bar Capsule - Minimal & Sleek) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all shadow-2xs select-none ${
          value.preset !== 'all'
            ? 'bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800'
            : 'bg-white border-neutral-200/90 text-neutral-700 hover:bg-neutral-50'
        }`}
        title="فیلتر بازه تاریخی اطلاعات داشبورد"
      >
        <CalendarIcon size={13} className={value.preset !== 'all' ? 'text-amber-400' : 'text-neutral-500'} />
        <span>{getDisplayText()}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Popover Dropdown - Ultra-Minimal */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto right-auto sm:right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-neutral-200/90 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-right">
          <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100">
            <div className="flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-neutral-800" />
              <span className="text-xs font-bold text-neutral-900">
                فیلتر بازه زمانی اطلاعات
              </span>
            </div>
            {value.preset !== 'all' && (
              <button
                type="button"
                onClick={() => handleSelectPreset('all')}
                className="text-[11px] text-neutral-500 hover:text-neutral-900 font-medium flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={11} />
                <span>نمایش همه</span>
              </button>
            )}
          </div>

          {/* Quick Presets List */}
          <div className="py-2 space-y-1">
            {presets.map((p) => {
              const isSelected = value.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                    isSelected
                      ? 'bg-neutral-100 font-bold text-neutral-900'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <div className="text-right">
                    <span className="block">{p.label}</span>
                    {p.sub && <span className="block text-[10px] text-neutral-400 mt-0.5">{p.sub}</span>}
                  </div>
                  {isSelected && <Check size={14} className="text-neutral-900" />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Picker Inputs */}
          <div className="pt-2.5 border-t border-neutral-100 space-y-2.5">
            <span className="text-[11px] font-semibold text-neutral-600 block">
              تعیین تاریخ دلخواه شمسی:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">از تاریخ:</label>
                <JalaliDatePicker value={customStart} onChange={setCustomStart} size="sm" clearable={false} />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">تا تاریخ:</label>
                <JalaliDatePicker value={customEnd} onChange={setCustomEnd} size="sm" clearable={false} />
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              اعمال بازه تاریخی
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
