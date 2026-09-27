/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Coins,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAppStore } from '../store';
import { useFieldSettings } from '../Settings';
import { toPersianDigits, formatToman } from '../utils';

export const SchoolChartsSection: React.FC = () => {
  const { state, getSessionEnrolledCount } = useAppStore();
  const { grades } = useFieldSettings();

  // Weekly Trend Data (Last 7 days)
  const daysOfWeek = [
    { label: 'شنبه', count: 4, amount: 48000000 },
    { label: 'یکشنبه', count: 7, amount: 84000000 },
    { label: 'دوشنبه', count: 5, amount: 60000000 },
    { label: 'سه‌شنبه', count: 9, amount: 108000000 },
    { label: 'چهارشنبه', count: 12, amount: 144000000 },
    { label: 'پنجشنبه', count: 8, amount: 96000000 },
    { label: 'جمعه', count: 3, amount: 36000000 },
  ];

  const maxWeeklyCount = Math.max(...daysOfWeek.map((d) => d.count), 15);

  // Grade Distribution Calculation
  const gradeCounts: Record<string, number> = {};
  grades.forEach((g) => {
    gradeCounts[g] = 0;
  });
  state.students.forEach((s) => {
    gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1;
  });

  const totalStudents = state.students.length || 1;
  const gradePalette = ['#7C3AED', '#2563EB', '#0D9488', '#EA580C', '#E11D48', '#4F46E5'];

  let accumulatedAngle = 0;
  const donutSegments = Object.entries(gradeCounts).map(([grade, count], idx) => {
    const fraction = count / totalStudents;
    const angle = fraction * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;
    return {
      grade,
      count,
      percent: Math.round(fraction * 100),
      color: gradePalette[idx % gradePalette.length],
      startAngle,
      angle,
    };
  });

  // Capacity breakdown of top 4 classes
  const classCapacities = state.classes.slice(0, 4).map((cls) => {
    let cap = 0;
    let enrolled = 0;
    cls.sessions.forEach((ses) => {
      cap += ses.capacity;
      enrolled += getSessionEnrolledCount(cls.id, ses.id);
    });
    const fillPercent = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;
    return {
      id: cls.id,
      name: cls.name,
      teacher: cls.teacher,
      enrolled,
      cap,
      fillPercent,
    };
  });

  // Financial aggregates
  let totalContract = 0;
  let totalCollected = 0;
  let totalOverdue = 0;
  state.registrations.forEach((r) => {
    if (r.status === 'cancelled') return;
    r.plan.installments.forEach((inst) => {
      totalContract += inst.amount;
      if (inst.paidAt) {
        totalCollected += inst.amount;
      } else if (inst.dueDate < '1403/07/01') {
        totalOverdue += inst.amount;
      }
    });
  });
  const collectedPercent = totalContract > 0 ? Math.round((totalCollected / totalContract) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
      {/* Chart 1: Weekly Registration Trend (Area SVG) */}
      <div className="lg:col-span-2 bg-white/80 hover:bg-white backdrop-blur-xl rounded-2xl p-5 border border-white/90 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-purple-600" />
              <h3 className="font-bold text-slate-900 text-sm">روند پذیرش و ثبت‌نام در هفته اخیر</h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              تعداد پرونده‌های نهایی‌شده به تفکیک روزهای هفته
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-[11px] font-semibold">
            {toPersianDigits(daysOfWeek.reduce((acc, d) => acc + d.count, 0))} پرونده
          </span>
        </div>

        {/* SVG Area Line Chart */}
        <div className="w-full h-44 relative" dir="ltr">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
            <defs>
              <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line x1="30" y1="30" x2="470" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
            <line x1="30" y1="75" x2="470" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" />
            <line x1="30" y1="120" x2="470" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />

            {/* Area & Line */}
            {(() => {
              const pts = daysOfWeek.map((d, i) => {
                const x = 30 + (i / (daysOfWeek.length - 1)) * 440;
                const y = 135 - (d.count / maxWeeklyCount) * 105;
                return { x, y, ...d };
              });

              let pathD = `M ${pts[0].x},${pts[0].y}`;
              for (let i = 0; i < pts.length - 1; i++) {
                const cX = (pts[i].x + pts[i + 1].x) / 2;
                pathD += ` C ${cX},${pts[i].y} ${cX},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
              }
              const areaD = `${pathD} L 470,140 L 30,140 Z`;

              return (
                <>
                  <path d={areaD} fill="url(#purpleGradient)" />
                  <path d={pathD} fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" />
                  {pts.map((p, idx) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#7C3AED" strokeWidth="2.5" />
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>

          {/* X-Axis Day Labels */}
          <div className="flex justify-between items-center px-4 text-[11px] text-slate-500 font-medium mt-1" dir="rtl">
            {daysOfWeek.map((d, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <span>{d.label}</span>
                <span className="text-[10px] text-purple-700 font-bold">{toPersianDigits(d.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 2: Grade Distribution Donut Chart */}
      <div className="bg-white/80 hover:bg-white backdrop-blur-xl rounded-2xl p-5 border border-white/90 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon size={16} className="text-purple-600" />
              <h3 className="font-bold text-slate-900 text-sm">توزیع دانش‌آموزان بر اساس پایه</h3>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mb-4">
            ترکیب ثبت‌نام‌ها در مقاطع تحصیلی فعال
          </p>

          {/* SVG Donut */}
          <div className="flex items-center justify-center my-2">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                {donutSegments.map((seg, idx) => {
                  const strokeDasharray = `${seg.angle * 0.7} 300`;
                  const strokeDashoffset = `-${seg.startAngle * 0.7}`;
                  return (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r="35"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="14"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-300"
                    />
                  );
                })}
              </svg>
              <div className="absolute flex flex-col items-center text-center">
                <span className="text-sm font-bold text-slate-800">{toPersianDigits(totalStudents)}</span>
                <span className="text-[10px] text-slate-400">دانش‌آموز</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
          {donutSegments.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-slate-600 truncate">{s.grade}:</span>
              <span className="font-bold text-slate-800 font-sans mr-auto">{toPersianDigits(s.count)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart 3: Class Capacities & Financial Recovery Status */}
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Capacity Bars */}
        <div className="bg-white/80 hover:bg-white backdrop-blur-xl rounded-2xl p-5 border border-white/90 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-purple-600" />
              <h3 className="font-bold text-slate-900 text-sm">وضعیت تکمیل ظرفیت کلاس‌ها</h3>
            </div>
            <span className="text-[11px] text-slate-400">کلاس‌های اولویت‌دار</span>
          </div>

          <div className="space-y-3 pt-1">
            {classCapacities.map((c) => (
              <div key={c.id} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-800 truncate">{c.name} ({c.teacher})</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {toPersianDigits(c.enrolled)} از {toPersianDigits(c.cap)} نفر ({toPersianDigits(c.fillPercent)}٪)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${c.fillPercent}%`,
                      backgroundColor: c.fillPercent > 80 ? '#7C3AED' : c.fillPercent > 50 ? '#2563EB' : '#10B981',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Progress */}
        <div className="bg-white/80 hover:bg-white backdrop-blur-xl rounded-2xl p-5 border border-white/90 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">شاخص وصول شهریه و تعهدات مالی</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                {toPersianDigits(collectedPercent)}٪ وصول قطعی
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              نسبت مجموع مبالغ وصول‌شده به کل تعهدات قراردادهای جاری
            </p>

            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${collectedPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-[11px]">مجموع وصول‌شده:</div>
              <div className="font-bold text-emerald-700 text-xs mt-0.5">{formatToman(totalCollected)}</div>
            </div>
            <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-[11px]">کل قراردادهای معتبر:</div>
              <div className="font-bold text-purple-900 text-xs mt-0.5">{formatToman(totalContract)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
