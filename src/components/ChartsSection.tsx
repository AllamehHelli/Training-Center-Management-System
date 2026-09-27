/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  HOURLY_USAGE_TREND,
  CATEGORY_BREAKDOWN,
  MODEL_METRICS,
} from '../aiMockData';

export const ChartsSection: React.FC = () => {
  const [activeTrendMetric, setActiveTrendMetric] = useState<'queries' | 'failed' | 'latency'>('queries');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  // SVG dimensions for Trend Line/Area Chart
  const svgWidth = 520;
  const svgHeight = 180;
  const paddingX = 40;
  const paddingY = 24;

  const points = HOURLY_USAGE_TREND.map((item, idx) => {
    const x = paddingX + (idx / (HOURLY_USAGE_TREND.length - 1)) * (svgWidth - paddingX * 2);
    const val = item[activeTrendMetric];
    const maxVal = activeTrendMetric === 'latency' ? 3.0 : 5000;
    const y = svgHeight - paddingY - (val / maxVal) * (svgHeight - paddingY * 2);
    return { x, y, time: item.time, value: val };
  });

  // Build smooth cubic bezier curve
  let curvePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpX = (curr.x + next.x) / 2;
    curvePath += ` C ${cpX},${curr.y} ${cpX},${next.y} ${next.x},${next.y}`;
  }

  const areaPath = `${curvePath} L ${points[points.length - 1].x},${svgHeight - paddingY} L ${points[0].x},${svgHeight - paddingY} Z`;

  // Donut chart calculations
  let accumulatedAngle = 0;
  const donutRadius = 55;
  const donutCenter = 75;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * donutRadius;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: AI Usage & Latency Trend (Takes 2 cols on lg) */}
        <div className="lg:col-span-2 bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <TrendingUp size={16} className="text-purple-600" />
                <h4 className="text-sm font-bold text-slate-900 tracking-tight">AI Usage & Throughput Trend</h4>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Real-time prompt traffic and response latency</p>
            </div>

            {/* Metric Selector Pills */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-full text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTrendMetric('queries')}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  activeTrendMetric === 'queries'
                    ? 'bg-white text-purple-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Queries (24h)
              </button>
              <button
                type="button"
                onClick={() => setActiveTrendMetric('latency')}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  activeTrendMetric === 'latency'
                    ? 'bg-white text-purple-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Avg Latency (s)
              </button>
              <button
                type="button"
                onClick={() => setActiveTrendMetric('failed')}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  activeTrendMetric === 'failed'
                    ? 'bg-white text-rose-600 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Errors
              </button>
            </div>
          </div>

          {/* SVG Area Chart */}
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-44 sm:h-52 overflow-visible select-none"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line
                x1={paddingX}
                y1={svgHeight - paddingY}
                x2={svgWidth - paddingX}
                y2={svgHeight - paddingY}
                stroke="#F1F5F9"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={svgHeight / 2}
                x2={svgWidth - paddingX}
                y2={svgHeight / 2}
                stroke="#F1F5F9"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1={paddingX}
                y1={paddingY}
                x2={svgWidth - paddingX}
                y2={paddingY}
                stroke="#F1F5F9"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Filled Area */}
              <path
                d={areaPath}
                fill={activeTrendMetric === 'failed' ? 'url(#errorGradient)' : 'url(#trendGradient)'}
              />

              {/* Smooth Stroke Line */}
              <path
                d={curvePath}
                fill="none"
                stroke={activeTrendMetric === 'failed' ? '#F43F5E' : '#8B5CF6'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points & hover triggers */}
              {points.map((pt, idx) => (
                <g key={`pt-${idx}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#FFFFFF"
                    stroke={activeTrendMetric === 'failed' ? '#F43F5E' : '#8B5CF6'}
                    strokeWidth="2.2"
                    className="cursor-pointer hover:scale-125 transition-transform"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        x: pt.x,
                        y: pt.y,
                        label: pt.time,
                        value:
                          activeTrendMetric === 'latency'
                            ? `${pt.value.toFixed(1)}s`
                            : `${pt.value.toLocaleString()} queries`,
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* X Axis Time Labels */}
                  <text
                    x={pt.x}
                    y={svgHeight - 6}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-sans"
                  >
                    {pt.time}
                  </text>
                </g>
              ))}
            </svg>

            {/* Interactive Tooltip */}
            {hoveredPoint && (
              <div
                style={{ left: `${(hoveredPoint.x / svgWidth) * 100}%`, top: `${(hoveredPoint.y / svgHeight) * 100}%` }}
                className="absolute -translate-x-1/2 -translate-y-full mb-2 pointer-events-none bg-neutral-900 text-white text-[11px] font-medium px-2 py-1 rounded-md shadow-lg z-20 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="text-[10px] text-slate-400">{hoveredPoint.label}</div>
                <div className="font-semibold text-white">{hoveredPoint.value}</div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Category Distribution Donut Chart */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <PieChartIcon size={16} className="text-pink-500" />
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Category Distribution</h4>
            </div>
            <p className="text-[11px] text-slate-400">Share of incoming prompt intents</p>
          </div>

          {/* Donut graphic */}
          <div className="flex items-center justify-center my-3 relative">
            <svg width="150" height="150" viewBox="0 0 150 150" className="transform -rotate-90">
              {CATEGORY_BREAKDOWN.slice(0, 5).map((cat, idx) => {
                const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -accumulatedAngle;
                accumulatedAngle += (cat.percentage / 100) * circumference;

                return (
                  <circle
                    key={cat.name}
                    cx={donutCenter}
                    cy={donutCenter}
                    r={donutRadius}
                    fill="transparent"
                    stroke={cat.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="hover:opacity-85 transition-opacity"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-slate-900">24.8k</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Prompts</span>
            </div>
          </div>

          {/* Mini Legend */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-xs">
            {CATEGORY_BREAKDOWN.slice(0, 4).map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-slate-600 truncate">{c.name}</span>
                <span className="font-semibold text-slate-900 mr-auto ml-1">{c.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Model Usage Breakdown Bars & Latency Percentiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model Usage Breakdown */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 size={16} className="text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Model Routing & Volume</h4>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Monthly queries</span>
          </div>

          <div className="space-y-3 pt-1">
            {MODEL_METRICS.map((model) => {
              const maxCount = 18000;
              const widthPct = Math.min(100, Math.round((model.queriesCount / maxCount) * 100));

              return (
                <div key={model.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{model.name}</span>
                    <span className="font-semibold text-slate-900 font-sans">
                      {model.queriesCount.toLocaleString()} ({model.successRate}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${widthPct}%`, backgroundColor: model.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Latency Percentiles Card */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-amber-500" />
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Response Latency SLAs</h4>
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              99.8% on target
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 my-2 text-center">
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
              <div className="text-[11px] text-slate-400 font-medium">p50 (Median)</div>
              <div className="text-xl font-bold text-slate-900 mt-1">1.8s</div>
              <div className="text-[10px] text-emerald-600 font-medium mt-0.5">-0.2s vs last wk</div>
            </div>
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
              <div className="text-[11px] text-slate-400 font-medium">p95 (Target)</div>
              <div className="text-xl font-bold text-slate-900 mt-1">3.4s</div>
              <div className="text-[10px] text-emerald-600 font-medium mt-0.5">SLA: &lt; 5.0s</div>
            </div>
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
              <div className="text-[11px] text-slate-400 font-medium">p99 (Outlier)</div>
              <div className="text-xl font-bold text-slate-900 mt-1">5.8s</div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">Tool calls included</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-2.5 flex items-center justify-between">
            <span>Cache Hit Acceleration:</span>
            <span className="font-semibold text-purple-700">41.2% saved round-trip</span>
          </div>
        </div>
      </div>
    </div>
  );
};
