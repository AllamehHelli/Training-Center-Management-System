/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Server,
  Layers,
} from 'lucide-react';
import { MODEL_METRICS } from '../aiMockData';

interface AIPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIPerformanceModal: React.FC<AIPerformanceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-2xl p-5 sm:p-7 overflow-hidden z-10 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150 text-slate-800 text-xs">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">AI Routing & Performance Telemetry</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Real-time model latency, fallback triggers, and cost health</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto space-y-4 py-4 pr-1">
          {/* Status Banners */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>All Clusters Healthy</span>
              </div>
              <div className="text-xl font-bold text-emerald-950 mt-1.5 font-sans">99.94%</div>
              <div className="text-[10px] text-emerald-700 mt-0.5">30-day uptime SLA</div>
            </div>

            <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl">
              <div className="text-[11px] text-purple-800 font-semibold flex items-center gap-1.5">
                <Zap size={14} className="text-purple-600" />
                <span>Peak Throughput</span>
              </div>
              <div className="text-xl font-bold text-purple-950 mt-1.5 font-sans">48.2 req/s</div>
              <div className="text-[10px] text-purple-700 mt-0.5">Auto-scale headroom +140%</div>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl">
              <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1.5">
                <Clock size={14} className="text-amber-600" />
                <span>Avg Latency (p50)</span>
              </div>
              <div className="text-xl font-bold text-amber-950 mt-1.5 font-sans">1.82s</div>
              <div className="text-[10px] text-amber-700 mt-0.5">Target: &lt; 2.50s</div>
            </div>
          </div>

          {/* Model Health Matrix Table */}
          <div>
            <div className="text-xs font-semibold text-slate-800 mb-2">Model Fleet Benchmarks</div>
            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[11px] text-slate-400 bg-white/60">
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">Traffic Share</th>
                    <th className="py-2.5 px-3">Avg Latency</th>
                    <th className="py-2.5 px-3">Success Rate</th>
                    <th className="py-2.5 px-3">Cost / 1k Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MODEL_METRICS.map((m) => (
                    <tr key={m.name} className="hover:bg-white transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                        <span>{m.name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{m.queriesCount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-700">{m.avgLatency}s</td>
                      <td className="py-2.5 px-3">
                        <span className="text-emerald-600 font-semibold">{m.successRate}%</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">${m.costPer1k.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* System Edge Caching Note */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[11px] text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-800">Dynamic Edge Cache:</span> 41.2% of repetitive queries (e.g. recipe templates, FAQ routing) are answered from Tier-1 low latency edge cache without consuming primary LLM tokens.
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Cluster: us-east-2 (active multi-region failover)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full font-medium text-xs shadow-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
