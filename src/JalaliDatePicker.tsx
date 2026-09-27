/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  getTodayJalali,
  parseJalaliDate,
  formatJalaliDate,
  getDaysInJalaliMonth,
  getFirstDayOfJalaliMonth,
  isLeapJalaliYear,
  getJalaliDayOfWeek,
  formatJalaliHuman,
  toPersianDigits,
  toEnglishDigits,
  PERSIAN_MONTH_NAMES,
  PERSIAN_DAY_SHORT_NAMES,
} from './utils';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClose, IconCheck } from './icons';

export interface JalaliDatePickerProps {
  value: string; // YYYY/MM/DD (e.g. "1403/07/15")
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  minDate?: string; // YYYY/MM/DD
  maxDate?: string; // YYYY/MM/DD
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'md';
  align?: 'right' | 'left';
  showHumanPreview?: boolean;
  inline?: boolean;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = '۱۴۰۳/۰۱/۰۱',
  minDate,
  maxDate,
  disabled = false,
  clearable = true,
  required = false,
  error,
  className = '',
  inputClassName = '',
  size = 'md',
  align = 'right',
  showHumanPreview = false,
  inline = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Parse current value or default to today
  const todayStr = getTodayJalali();
  const parsedValue = parseJalaliDate(value);
  const parsedToday = parseJalaliDate(todayStr)!;

  // View state (which month/year is currently displayed in the calendar)
  const [viewYear, setViewYear] = useState<number>(
    parsedValue ? parsedValue.year : parsedToday.year
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsedValue ? parsedValue.month : parsedToday.month
  );

  // For direct manual typing input
  const [inputValue, setInputValue] = useState<string>(value || '');

  // Keep view year/month and text input in sync when value changes externally
  useEffect(() => {
    setInputValue(value || '');
    if (value) {
      const p = parseJalaliDate(value);
      if (p) {
        setViewYear(p.year);
        setViewMonth(p.month);
      }
    }
  }, [value]);

  // Positioning state for portal dropdown
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    placement: 'bottom' | 'top';
  }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });

  // Calculate coordinates when opening
  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pickerWidth = 276;
    const pickerHeight = 330;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: 'bottom' | 'top' = 'bottom';
    let top = rect.bottom + 6;

    if (spaceBelow < pickerHeight && spaceAbove >= pickerHeight) {
      placement = 'top';
      top = rect.top - pickerHeight - 6;
    }

    // Horizontal alignment
    let left = rect.right - pickerWidth; // align right by default in RTL
    if (align === 'left') {
      left = rect.left;
    }

    // Clamp within viewport
    const minLeft = 8;
    const maxLeft = Math.max(8, window.innerWidth - pickerWidth - 8);
    left = Math.max(minLeft, Math.min(left, maxLeft));

    setPopoverCoords({
      top: Math.max(8, top),
      left,
      placement,
    });
  };

  useEffect(() => {
    if (!isOpen || inline) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize);
    };
  }, [isOpen, inline]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen || inline) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        pickerRef.current &&
        !pickerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, inline]);

  // Calendar navigation
  const goToPreviousMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formatted = formatJalaliDate(viewYear, viewMonth, day);
    onChange(formatted);
    setInputValue(formatted);
    if (!inline) {
      setIsOpen(false);
    }
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(todayStr);
    setInputValue(todayStr);
    setViewYear(parsedToday.year);
    setViewMonth(parsedToday.month);
    if (!inline) {
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setInputValue('');
  };

  // Handle manual input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    const parsed = parseJalaliDate(raw);
    if (parsed) {
      const formatted = formatJalaliDate(parsed.year, parsed.month, parsed.day);
      onChange(formatted);
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      if (clearable && !required) {
        onChange('');
      } else {
        setInputValue(value || '');
      }
      return;
    }
    const parsed = parseJalaliDate(inputValue);
    if (parsed) {
      const formatted = formatJalaliDate(parsed.year, parsed.month, parsed.day);
      onChange(formatted);
      setInputValue(formatted);
    } else {
      // Revert if invalid
      setInputValue(value || '');
    }
  };

  // Month days calculation
  const totalDays = getDaysInJalaliMonth(viewYear, viewMonth);
  const firstDayOfWeek = getFirstDayOfJalaliMonth(viewYear, viewMonth); // 0 (شنبه) to 6 (جمعه)
  const isLeapYear = isLeapJalaliYear(viewYear);

  // Check if date is disabled
  const isDayDisabled = (day: number) => {
    const curDateStr = formatJalaliDate(viewYear, viewMonth, day);
    if (minDate && curDateStr < minDate) return true;
    if (maxDate && curDateStr > maxDate) return true;
    return false;
  };

  // Year options for fast select (anchored around active year 1403)
  const currentJalaliYear = parsedToday.year;
  const yearOptions: number[] = [];
  for (let y = currentJalaliYear - 6; y <= currentJalaliYear + 4; y++) {
    yearOptions.push(y);
  }

  // Calendar content component (ultra-minimal, fixed width, no overflow)
  const calendarContent = (
    <div
      ref={pickerRef}
      dir="rtl"
      data-jalali-picker="true"
      className="w-[276px] bg-white rounded-2xl shadow-xl border border-neutral-200/90 p-3 select-none text-neutral-800 text-xs font-sans animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Calendar Header: Minimal, centered, guaranteed never to overflow */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
        {/* Next Month Button (points right in RTL) */}
        <button
          type="button"
          onClick={goToNextMonth}
          title="ماه بعد"
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
        >
          <IconChevronRight size={15} />
        </button>

        {/* Minimal Month & Year Selectors */}
        <div className="flex items-center gap-1">
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
            className="text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200/70 px-2 py-0.5 rounded-lg border-0 cursor-pointer outline-hidden transition-colors"
          >
            {PERSIAN_MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={viewYear}
            onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
            className="text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200/70 px-2 py-0.5 rounded-lg border-0 cursor-pointer outline-hidden font-mono transition-colors"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {toPersianDigits(y)}
              </option>
            ))}
          </select>
        </div>

        {/* Previous Month Button (points left in RTL) */}
        <button
          type="button"
          onClick={goToPreviousMonth}
          title="ماه قبل"
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
        >
          <IconChevronLeft size={15} />
        </button>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 gap-1 mt-2 mb-1 text-center text-[10px] font-semibold text-neutral-400">
        {PERSIAN_DAY_SHORT_NAMES.map((name, idx) => (
          <div
            key={name}
            className={`py-0.5 ${idx === 6 ? 'text-rose-500 font-bold' : ''}`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day Cells Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {/* Empty cells before the 1st day */}
        {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-7 w-7" />
        ))}

        {/* Days 1..totalDays */}
        {Array.from({ length: totalDays }).map((_, idx) => {
          const dayNumber = idx + 1;
          const dateStr = formatJalaliDate(viewYear, viewMonth, dayNumber);
          const isSelected = value === dateStr;
          const isToday = todayStr === dateStr;
          const isFriday = (firstDayOfWeek + idx) % 7 === 6;
          const disabledDay = isDayDisabled(dayNumber);

          return (
            <button
              key={`day-${dayNumber}`}
              type="button"
              disabled={disabledDay}
              onClick={() => handleSelectDay(dayNumber)}
              className={`h-7 w-7 mx-auto rounded-lg flex items-center justify-center font-medium transition-all text-xs ${
                disabledDay
                  ? 'text-neutral-300 cursor-not-allowed opacity-40'
                  : isSelected
                  ? 'bg-neutral-900 text-white font-bold shadow-xs scale-105'
                  : isToday
                  ? 'ring-1 ring-neutral-400 text-neutral-900 font-bold hover:bg-neutral-100'
                  : isFriday
                  ? 'text-rose-600 hover:bg-rose-50 font-semibold'
                  : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              {toPersianDigits(dayNumber)}
            </button>
          );
        })}
      </div>

      {/* Calendar Footer: Minimal */}
      <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={handleSelectToday}
          className="text-neutral-700 hover:text-neutral-900 font-semibold hover:underline flex items-center gap-1"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          <span>امروز ({toPersianDigits(todayStr)})</span>
        </button>

        {clearable && value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-neutral-400 hover:text-rose-600 transition-colors"
          >
            پاک کردن
          </button>
        )}
      </div>

      {/* Human Date Preview */}
      {value && (
        <div className="mt-1.5 text-[10px] text-neutral-500 bg-neutral-50 rounded-lg py-1 px-2 text-center font-medium border border-neutral-100">
          {formatJalaliHuman(value)}
        </div>
      )}
    </div>
  );

  if (inline) {
    return <div className={`inline-block ${className}`}>{calendarContent}</div>;
  }

  return (
    <div ref={containerRef} className={`relative inline-block w-full text-right ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-neutral-700 mb-1">
          {label}
          {required && <span className="text-red-500 mr-0.5">*</span>}
        </label>
      )}

      {/* Input Group */}
      <div className="relative flex items-center">
        <input
          type="text"
          dir="ltr"
          disabled={disabled}
          value={toPersianDigits(inputValue)}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onClick={() => !disabled && setIsOpen(true)}
          placeholder={toPersianDigits(placeholder)}
          className={`w-full font-mono text-left pl-8 pr-7 rounded-xl border transition-colors focus:outline-hidden ${
            size === 'sm' ? 'py-1 px-2.5 text-xs' : 'py-1.5 px-3 text-xs'
          } ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
              : 'border-neutral-200 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900'
          } ${
            disabled ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' : 'bg-white text-neutral-800'
          } ${inputClassName}`}
        />

        {/* Calendar Icon Button (Left side in LTR input) */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="absolute left-2 text-neutral-400 hover:text-neutral-700 transition-colors disabled:cursor-not-allowed"
          title="باز کردن تقویم شمسی"
        >
          <IconCalendar size={size === 'sm' ? 13 : 14} />
        </button>

        {/* Clear or Status Button (Right side) */}
        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-neutral-300 hover:text-rose-500 transition-colors"
            title="پاک کردن تاریخ"
          >
            <IconClose size={13} />
          </button>
        )}
      </div>

      {/* Optional human preview under input */}
      {showHumanPreview && value && (
        <div className="mt-1 text-[11px] text-neutral-500 flex items-center gap-1">
          <IconCheck size={12} className="text-emerald-600" />
          <span>{formatJalaliHuman(value)}</span>
        </div>
      )}

      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}

      {/* Floating Popover via Portal */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* Backdrop to close on touch / click */}
            <div
              className="fixed inset-0 z-[9990] bg-transparent"
              onClick={() => setIsOpen(false)}
            />
            <div
              data-jalali-picker="true"
              style={{
                position: 'fixed',
                top: `${popoverCoords.top}px`,
                left: `${popoverCoords.left}px`,
                zIndex: 99999,
              }}
            >
              {calendarContent}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};
