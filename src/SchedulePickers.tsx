/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { toPersianDigits, calculateClassDuration, toEnglishDigits } from './utils';
import { IconCheck } from './icons';

// -------------------------------------------------------------
// Iranian Week Days Multi-select Picker
// -------------------------------------------------------------
export const IRANIAN_WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
] as const;

export interface DayPickerProps {
  value: string; // e.g. "شنبه، دوشنبه، چهارشنبه"
  onChange: (newValue: string) => void;
}

export const DayPicker: React.FC<DayPickerProps> = ({ value, onChange }) => {
  // Parse current selected days
  const selectedDays = value
    ? value
        .split('،')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  const toggleDay = (day: string) => {
    let updated: string[];
    if (selectedDays.includes(day)) {
      updated = selectedDays.filter((d) => d !== day);
    } else {
      // Keep days in chronological week order
      updated = IRANIAN_WEEKDAYS.filter(
        (d) => selectedDays.includes(d) || d === day
      );
    }
    onChange(updated.join('، '));
  };

  const setPreset = (preset: 'even' | 'odd' | 'weekend' | 'all' | 'clear') => {
    if (preset === 'even') {
      onChange('شنبه، دوشنبه، چهارشنبه');
    } else if (preset === 'odd') {
      onChange('یکشنبه، سه‌شنبه، پنجشنبه');
    } else if (preset === 'weekend') {
      onChange('پنجشنبه، جمعه');
    } else if (preset === 'all') {
      onChange(IRANIAN_WEEKDAYS.join('، '));
    } else if (preset === 'clear') {
      onChange('');
    }
  };

  const isEvenPresetActive =
    selectedDays.length === 3 &&
    selectedDays.includes('شنبه') &&
    selectedDays.includes('دوشنبه') &&
    selectedDays.includes('چهارشنبه');

  const isOddPresetActive =
    selectedDays.length === 3 &&
    selectedDays.includes('یکشنبه') &&
    selectedDays.includes('سه‌شنبه') &&
    selectedDays.includes('پنجشنبه');

  return (
    <div className="space-y-2.5">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <button
          type="button"
          onClick={() => setPreset('even')}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            isEvenPresetActive
              ? 'bg-[#0E7C5B] text-white font-semibold shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          روزهای زوج
        </button>
        <button
          type="button"
          onClick={() => setPreset('odd')}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            isOddPresetActive
              ? 'bg-[#E9A13B] text-slate-900 font-semibold shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          روزهای فرد
        </button>
        <button
          type="button"
          onClick={() => setPreset('weekend')}
          className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        >
          آخر هفته (پنجشنبه، جمعه)
        </button>
        {selectedDays.length > 0 && (
          <button
            type="button"
            onClick={() => setPreset('clear')}
            className="px-2 py-1 text-slate-400 hover:text-[#D64545] transition-colors mr-auto"
          >
            پاک کردن
          </button>
        )}
      </div>

      {/* Multi-Select Day Chips */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
        {IRANIAN_WEEKDAYS.map((day) => {
          const isSelected = selectedDays.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`py-1.5 px-2 text-xs rounded-lg border font-medium flex items-center justify-center gap-1 transition-all ${
                isSelected
                  ? 'bg-[#0A3528] text-white border-[#0A3528] shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {isSelected && <IconCheck size={12} className="text-[#E9A13B]" />}
              <span>{day}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Summary Label */}
      <div className="text-[11px] text-slate-500 flex items-center justify-between">
        <span>
          {selectedDays.length === 0 ? (
            <span className="text-[#D64545]">هیچ روزی انتخاب نشده است</span>
          ) : (
            <span>
              روزهای انتخابی: <strong className="text-slate-800">{value}</strong>
            </span>
          )}
        </span>
        <span className="text-slate-400 font-mono">
          {toPersianDigits(selectedDays.length)} روز در هفته
        </span>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Minimal Start / End Time Picker with Auto Duration Calculation
// -------------------------------------------------------------
export interface TimeRangePickerProps {
  startTime: string; // e.g. "16:00"
  endTime: string;   // e.g. "17:30"
  onChange: (start: string, end: string, durationStr: string) => void;
}

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  startTime,
  endTime,
  onChange,
}) => {
  const duration = calculateClassDuration(startTime, endTime);

  const handleStartChange = (newStart: string) => {
    const newDur = calculateClassDuration(newStart, endTime);
    onChange(newStart, endTime, newDur.formatted);
  };

  const handleEndChange = (newEnd: string) => {
    const newDur = calculateClassDuration(startTime, newEnd);
    onChange(startTime, newEnd, newDur.formatted);
  };

  // Quick duration adjustment helper (e.g. +90 mins)
  const setQuickDuration = (minutes: number) => {
    const cleanStart = toEnglishDigits(startTime || '16:00').trim();
    const parts = cleanStart.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const startMinutes = parts[0] * 60 + parts[1];
      const endTotal = startMinutes + minutes;
      const endH = Math.floor((endTotal / 60) % 24);
      const endM = endTotal % 60;
      const formattedEnd = `${endH < 10 ? '0' + endH : endH}:${endM < 10 ? '0' + endM : endM}`;
      const newDur = calculateClassDuration(cleanStart, formattedEnd);
      onChange(cleanStart, formattedEnd, newDur.formatted);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {/* Start Time Box */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            زمان شروع:
          </label>
          <div className="relative">
            <input
              type="time"
              value={startTime || '16:00'}
              onChange={(e) => handleStartChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] text-center font-mono"
            />
          </div>
        </div>

        {/* End Time Box */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            زمان پایان:
          </label>
          <div className="relative">
            <input
              type="time"
              value={endTime || '17:30'}
              onChange={(e) => handleEndChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] text-center font-mono"
            />
          </div>
        </div>
      </div>

      {/* Auto-Calculated Duration Display & Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px]">
        {/* Calculated duration badge */}
        <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100/90 px-2 py-1 rounded-md">
          <span className="text-slate-400">مدت زمان کلاس:</span>
          <strong className="text-[#0A3528]">
            {duration.isValid ? duration.formatted : 'نامعتبر'}
          </strong>
          {duration.isValid && duration.minutes > 0 && (
            <span className="text-[10px] text-slate-400 font-mono">
              ({toPersianDigits(duration.minutes)} دقیقه)
            </span>
          )}
        </div>

        {/* Quick Duration Buttons */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400">طول دوره:</span>
          <button
            type="button"
            onClick={() => setQuickDuration(60)}
            className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded text-[10px]"
          >
            ۱ ساعت
          </button>
          <button
            type="button"
            onClick={() => setQuickDuration(90)}
            className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded text-[10px]"
          >
            ۱٫۵ ساعت
          </button>
          <button
            type="button"
            onClick={() => setQuickDuration(120)}
            className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded text-[10px]"
          >
            ۲ ساعت
          </button>
        </div>
      </div>
    </div>
  );
};
