/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { toPersianDigits } from '../utils';

export interface SchoolKPIItem {
  id: string;
  title: string;
  value: string;
  numericValue: number;
  trend: string;
  isPositive: boolean;
  sparkline: number[];
  icon: 'registrations' | 'success' | 'overdue' | 'revenue';
  accentColor: string;
}

interface KPICardsProps {
  kpis: SchoolKPIItem[];
  selectedMetricId?: string;
  onSelectMetric?: (id: string) => void;
}

// Convert numbers array to smooth SVG cubic bezier path
function generateSmoothPath(
  points: number[],
  width = 110,
  height = 34
): { path: string; lastPoint: [number, number] } {
  if (points.length < 2) return { path: '', lastPoint: [0, 0] };

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const stepX = width / (points.length - 1);
  const coords: [number, number][] = points.map((p, i) => [
    i * stepX,
    height - ((p - min) / range) * (height - 8) - 4,
  ]);

  let path = `M ${coords[0][0]},${coords[0][1]}`;

  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i];
    const next = coords[i + 1];
    const controlX = (current[0] + next[0]) / 2;
    path += ` C ${controlX},${current[1]} ${controlX},${next[1]} ${next[0]},${next[1]}`;
  }

  const lastPoint = coords[coords.length - 1];
  return { path, lastPoint };
}

export const KPICards: React.FC<KPICardsProps> = ({
  kpis,
  selectedMetricId,
  onSelectMetric,
}) => {
  const renderIcon = (type: SchoolKPIItem['icon']) => {
    switch (type) {
      case 'registrations':
        return <ClipboardList size={16} className="text-purple-600" strokeWidth={1.8} />;
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-600" strokeWidth={1.8} />;
      case 'overdue':
        return <AlertTriangle size={16} className="text-rose-600" strokeWidth={1.8} />;
      case 'revenue':
        return <Coins size={16} className="text-indigo-600" strokeWidth={1.8} />;
      default:
        return <ClipboardList size={16} className="text-purple-600" strokeWidth={1.8} />;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {kpis.map((kpi) => {
        const { path, lastPoint } = generateSmoothPath(kpi.sparkline, 110, 34);
        const isSelected = selectedMetricId === kpi.id;

        return (
          <div
            key={kpi.id}
            onClick={() => onSelectMetric?.(kpi.id)}
            className={`group relative bg-white/80 hover:bg-white backdrop-blur-md rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgb(0,0,0,0.05)] ${
              isSelected
                ? 'border-purple-300 ring-2 ring-purple-100 bg-white'
                : 'border-white/90 hover:border-purple-100'
            }`}
          >
            {/* Top row: Icon on start, Curvy sparkline on end */}
            <div className="flex items-center justify-between mb-3">
              {/* Icon badge */}
              <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100/90 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                {renderIcon(kpi.icon)}
              </div>

              {/* Sparkline curve */}
              <div className="relative w-28 h-9 overflow-visible" dir="ltr">
                <svg
                  width="110"
                  height="34"
                  viewBox="0 0 110 34"
                  fill="none"
                  className="overflow-visible"
                >
                  <path
                    d={path}
                    stroke={kpi.accentColor}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Glowing end point */}
                  <circle
                    cx={lastPoint[0]}
                    cy={lastPoint[1]}
                    r="3.5"
                    fill={kpi.accentColor}
                    className="animate-pulse"
                  />
                  <circle
                    cx={lastPoint[0]}
                    cy={lastPoint[1]}
                    r="6.5"
                    fill={kpi.accentColor}
                    opacity="0.25"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <div className="text-xs font-medium text-slate-500 mb-1">{kpi.title}</div>

            {/* Bottom row: Large Metric Value & Trend Badge */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                {toPersianDigits(kpi.value)}
              </span>

              {/* Trend indicator badge */}
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  kpi.isPositive
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                    : 'text-rose-700 bg-rose-50 border border-rose-100'
                }`}
              >
                {kpi.isPositive ? (
                  <ArrowUpRight size={11} className="stroke-[2.5]" />
                ) : (
                  <ArrowDownRight size={11} className="stroke-[2.5]" />
                )}
                <span>{toPersianDigits(kpi.trend)}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
