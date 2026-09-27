/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Lock, EyeOff, AlertTriangle, CheckCircle2, Sliders } from 'lucide-react';

export const SecurityView: React.FC = () => {
  const [piiMasking, setPiiMasking] = useState(true);
  const [jailbreakProtection, setJailbreakProtection] = useState(true);
  const [medicalDisclaimer, setMedicalDisclaimer] = useState(true);
  const [financialGuardrail, setFinancialGuardrail] = useState(true);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Safety & Guardrails</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Automated content moderation, PII redaction, and enterprise compliance enforcement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Toggle 1: PII Masking */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff size={16} className="text-purple-600" />
              <h4 className="font-bold text-slate-900 text-sm">Automated PII Redaction</h4>
            </div>
            <button
              type="button"
              onClick={() => setPiiMasking(!piiMasking)}
              className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                piiMasking ? 'bg-purple-600 justify-end' : 'bg-slate-200 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Masks credit card numbers, SSNs, phone numbers, and home addresses before prompts reach external LLM endpoints.
          </p>
          <div className="text-[11px] text-purple-700 bg-purple-50 p-2 rounded-xl">
            Status: Active · 4,210 tokens sanitized this month
          </div>
        </div>

        {/* Toggle 2: Jailbreak Protection */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-indigo-600" />
              <h4 className="font-bold text-slate-900 text-sm">Prompt Injection & Jailbreak Defense</h4>
            </div>
            <button
              type="button"
              onClick={() => setJailbreakProtection(!jailbreakProtection)}
              className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                jailbreakProtection ? 'bg-purple-600 justify-end' : 'bg-slate-200 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Heuristic and semantic classifiers detect instruction overrides, developer mode exploits, and system prompt leakage attempts.
          </p>
          <div className="text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded-xl">
            Status: Active · 18 adversarial prompts neutralized
          </div>
        </div>

        {/* Toggle 3: Clinical Disclaimer */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <h4 className="font-bold text-slate-900 text-sm">Clinical & Medical Guardrail</h4>
            </div>
            <button
              type="button"
              onClick={() => setMedicalDisclaimer(!medicalDisclaimer)}
              className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                medicalDisclaimer ? 'bg-purple-600 justify-end' : 'bg-slate-200 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ensures medical queries include mandatory professional evaluation disclaimers and flags high-risk dosage recommendations.
          </p>
        </div>

        {/* Toggle 4: Financial Advice Guardrail */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-amber-600" />
              <h4 className="font-bold text-slate-900 text-sm">Fiduciary & Investment Guardrail</h4>
            </div>
            <button
              type="button"
              onClick={() => setFinancialGuardrail(!financialGuardrail)}
              className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                financialGuardrail ? 'bg-purple-600 justify-end' : 'bg-slate-200 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Restricts specific stock pick promises and inserts SEC regulatory disclaimers on portfolio calculations.
          </p>
        </div>
      </div>
    </div>
  );
};
