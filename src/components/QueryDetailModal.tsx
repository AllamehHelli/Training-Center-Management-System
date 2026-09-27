/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Zap,
  Clock,
  Coins,
  ShieldAlert,
  AlertCircle,
  Cpu,
  Layers,
  Code2,
} from 'lucide-react';
import { QueryLogItem } from '../aiTypes';

interface QueryDetailModalProps {
  query: QueryLogItem | null;
  onClose: () => void;
}

export const QueryDetailModal: React.FC<QueryDetailModalProps> = ({ query, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!query) return null;

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-2xl p-5 sm:p-7 overflow-hidden z-10 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150 text-slate-800 text-xs">
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">ID: {query.id}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  query.status === 'Success'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : query.status === 'Failed'
                    ? 'bg-rose-50 text-rose-500 border border-rose-100'
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}
              >
                {query.status}
              </span>
              <span className="text-[11px] text-slate-400">{query.timestamp}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">Prompt Execution Inspector</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 py-3.5 pr-1">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-purple-600 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400">Response Time</div>
                <div className="font-bold text-slate-900">{query.responseTime}s</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-indigo-600 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400">Model Used</div>
                <div className="font-bold text-slate-900 truncate">{query.model}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-500 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400">Tokens (In / Out)</div>
                <div className="font-bold text-slate-900">
                  {query.tokensPrompt} / {query.tokensCompletion}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400">Est. Cost</div>
                <div className="font-bold text-slate-900">${query.cost.toFixed(4)}</div>
              </div>
            </div>
          </div>

          {/* User & Client Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50/60 rounded-xl text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-800">{query.user}</span>
              <span className="text-slate-400">({query.userEmail})</span>
            </div>
            <div className="flex items-center gap-3 text-slate-500">
              <span>Category: <strong className="text-slate-700">{query.category}</strong></span>
              {query.clientIp && <span>IP: <code className="font-mono text-[10px]">{query.clientIp}</code></span>}
            </div>
          </div>

          {/* Flag / Failure Alerts */}
          {query.flagReason && (
            <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl text-amber-800 flex items-start gap-2">
              <ShieldAlert size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                <div className="font-semibold text-xs text-amber-900">Content Moderation Flag</div>
                <div className="text-[11px] mt-0.5">{query.flagReason}</div>
              </div>
            </div>
          )}

          {query.failureReason && (
            <div className="p-3 bg-rose-50/90 border border-rose-200/80 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
              <div>
                <div className="font-semibold text-xs text-rose-900">Execution Error</div>
                <div className="text-[11px] mt-0.5">{query.failureReason}</div>
              </div>
            </div>
          )}

          {/* Full User Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-700 text-xs">User Prompt</span>
              <button
                type="button"
                onClick={() => handleCopy('prompt', query.fullPrompt)}
                className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 transition-colors"
              >
                {copiedField === 'prompt' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedField === 'prompt' ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 font-sans text-xs whitespace-pre-wrap leading-relaxed select-text">
              {query.fullPrompt}
            </div>
          </div>

          {/* AI Generated Response */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-700 text-xs">Model Response</span>
              <button
                type="button"
                onClick={() => handleCopy('response', query.responseText)}
                className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 transition-colors"
              >
                {copiedField === 'response' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedField === 'response' ? 'Copied' : 'Copy Response'}</span>
              </button>
            </div>
            <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto select-text shadow-inner">
              {query.responseText}
            </div>
          </div>

          {/* Latency Waterfall Breakdown */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">Latency Waterfall Breakdown</div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Routing & DNS lookup</span>
                <span className="font-mono text-slate-700">{query.latencyBreakdown.dnsMs}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Time to First Token (TTFT)</span>
                <span className="font-mono text-slate-700">{query.latencyBreakdown.ttftMs}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Token Generation Stream</span>
                <span className="font-mono text-slate-700">{query.latencyBreakdown.generationMs}ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 truncate max-w-[280px]">
            Route: {query.routingPath}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full font-medium text-xs shadow-xs transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
