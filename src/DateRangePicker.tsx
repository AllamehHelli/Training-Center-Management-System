/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { getTodayJalali, addMonthsJalali, addDaysJalali, toPersianDigits } from './utils';
import { IconCalendar, IconChevronDown } from './icons';
import { JalaliDatePicker } from './JalaliDatePicker';

export type DateFilterPreset = 'all' | 'week' | '15days' | 'month' | '90days' | 'custom';

export interface JalaliDateRange {
  preset: DateFilterPreset;
  startDate?: string; // YYYY/MM/DD
  endDate?: string;   // YYYY/MM/DD
}

interface DateRangePickerProps {
  value: JalaliDateRange;
  onChange: (range: JalaliDateRange) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const today = getTodayJalali();
  const [customStart, setCustomStart] = useState(value.startDate || today);
  const [customEnd, setCustomEnd] = useState(value.endDate || today);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('[data-jalali-picker]')) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const presets: { id: DateFilterPreset; label: string }[] = [
    { id: 'all', label: 'همه تاریخ‌ها' },
    { id: 'week', label: '۷ روز اخیر' },
    { id: '15days', label: '۱۵ روز اخیر' },
    { id: 'month', label: '۳۰ روز اخیر' },
    { id: 'custom', label: 'بازه دلخواه...' },
  ];

  const handleSelectPreset = (preset: DateFilterPreset) => {
    if (preset === 'all') {
      onChange({ preset: 'all' });
      setIsOpen(false);
      return;
    }
    if (preset === 'custom') {
      return;
    }

    let start = today;
    if (preset === 'month') {
      start = addDaysJalali(today, -30);
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

  const activePresetLabel = presets.find((p) => p.id === value.preset)?.label || 'همه تاریخ‌ها';

  return (
    <div ref={containerRef} className="relative inline-block text-right">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200/90 rounded-full hover:bg-neutral-50 transition-colors shadow-2xs select-none"
      >
        <IconCalendar size={13} className="text-neutral-500" />
        <span>فیلتر تاریخ:</span>
        <span className="font-bold text-neutral-900">
          {value.preset === 'custom' && value.startDate && value.endDate
            ? `${toPersianDigits(value.startDate)} تا ${toPersianDigits(value.endDate)}`
            : activePresetLabel}
        </span>
        <IconChevronDown size={12} className={`text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-neutral-200/90 z-30 p-3 text-xs space-y-1 text-right">
          <div className="text-[11px] font-semibold text-neutral-400 px-2 py-1">گزینه‌های پیش‌فرض</div>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p.id)}
              className={`w-full text-right px-2.5 py-1.5 rounded-xl transition-colors flex items-center justify-between ${
                value.preset === p.id
                  ? 'bg-neutral-100 text-neutral-900 font-bold'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <span>{p.label}</span>
              {value.preset === p.id && <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />}
            </button>
          ))}

          {value.preset === 'custom' && (
            <div className="pt-2 mt-1 border-t border-neutral-100 space-y-2 px-1">
              <div className="text-[11px] font-semibold text-neutral-700">
                <span>تعیین بازه زمانی دلخواه:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <JalaliDatePicker
                  label="از تاریخ:"
                  value={customStart}
                  onChange={(d) => setCustomStart(d)}
                  maxDate={customEnd}
                  size="sm"
                  clearable={false}
                />
                <JalaliDatePicker
                  label="تا تاریخ:"
                  value={customEnd}
                  onChange={(d) => setCustomEnd(d)}
                  minDate={customStart}
                  size="sm"
                  clearable={false}
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCustom}
                className="w-full py-1.5 bg-neutral-900 text-white rounded-xl font-semibold text-xs hover:bg-neutral-800 transition-colors mt-2 shadow-2xs"
              >
                اعمال تاریخ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
