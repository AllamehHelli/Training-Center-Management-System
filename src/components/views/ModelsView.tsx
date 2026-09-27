/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layers, Cpu, Zap, CheckCircle2, Sliders, Shield, ArrowUpRight } from 'lucide-react';
import { MODEL_METRICS } from '../../aiMockData';
import { ModelMetric } from '../../aiTypes';

export const ModelsView: React.FC = () => {
  const [models, setModels] = useState<ModelMetric[]>(MODEL_METRICS);
  const [selectedModel, setSelectedModel] = useState<ModelMetric>(MODEL_METRICS[0]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Models & Routing</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure dynamic model routing, fallback rules, and cost-efficiency trade-offs.
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs rounded-full shadow-xs transition-colors self-start sm:self-auto"
        >
          Add Custom Fine-Tuned Model
        </button>
      </div>

      {/* Grid of Models */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => (
          <div
            key={model.name}
            onClick={() => setSelectedModel(model)}
            className={`bg-white/85 backdrop-blur-xl rounded-2xl border p-5 cursor-pointer transition-all duration-200 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-md ${
              selectedModel.name === model.name
                ? 'border-purple-300 ring-2 ring-purple-100 bg-white'
                : 'border-white/90 hover:border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: model.color }} />
                <h3 className="font-bold text-slate-900 text-sm">{model.name}</h3>
              </div>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-semibold border border-emerald-100">
                Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
              <div>
                <span className="text-[11px] text-slate-400">Monthly Traffic</span>
                <div className="font-bold text-slate-800 mt-0.5">{model.queriesCount.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Avg Latency</span>
                <div className="font-bold text-slate-800 mt-0.5">{model.avgLatency}s</div>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Success Rate</span>
                <div className="font-bold text-emerald-600 mt-0.5">{model.successRate}%</div>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Cost / 1k Tokens</span>
                <div className="font-bold text-slate-800 mt-0.5 font-mono">${model.costPer1k.toFixed(4)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Model Details & Routing Config */}
      <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-5 sm:p-6 text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-purple-600" />
            <h4 className="font-bold text-slate-900 text-sm">
              Routing Parameters: {selectedModel.name}
            </h4>
          </div>
          <span className="text-slate-400 text-[11px]">Last calibrated 1 hour ago</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">Automatic Fallback Target</div>
            <div className="font-semibold text-slate-800">Claude 3.5 (Sonnet)</div>
            <p className="text-[10px] text-slate-400">Triggered on 5xx errors or latency &gt; 8s</p>
          </div>
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">Dynamic Temperature</div>
            <div className="font-semibold text-slate-800">0.70 (Adaptive)</div>
            <p className="text-[10px] text-slate-400">Lower for coding (0.2), higher for creative (0.85)</p>
          </div>
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">Context Window Allocation</div>
            <div className="font-semibold text-slate-800">32,768 Tokens</div>
            <p className="text-[10px] text-slate-400">99.4% of queries fit in single batch</p>
          </div>
        </div>
      </div>
    </div>
  );
};
