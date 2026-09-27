/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, Key, Globe, BellRing, Database, Save, Check } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [isSaved, setIsSaved] = useState(false);
  const [retentionDays, setRetentionDays] = useState('90');
  const [webhookUrl, setWebhookUrl] = useState('https://api.enterprise.internal/webhooks/ai-events');

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Workspace Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure telemetry retention, automated export webhooks, and rate limits.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs rounded-full shadow-xs transition-colors self-start sm:self-auto"
        >
          {isSaved ? <Check size={14} className="text-emerald-400" /> : <Save size={14} />}
          <span>{isSaved ? 'Settings Saved' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* API Connection */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-purple-600" />
            <h4 className="font-bold text-slate-900 text-sm">Telemetry Ingestion Key</h4>
          </div>
          <p className="text-slate-500">Bearer token used by client applications to stream query logs.</p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              readOnly
              value="monogram_live_8f993bc712aa44ef109"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs"
            />
            <button
              type="button"
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl font-medium text-slate-700"
            >
              Roll
            </button>
          </div>
        </div>

        {/* Webhook Events */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-indigo-600" />
            <h4 className="font-bold text-slate-900 text-sm">Real-time Webhook URL</h4>
          </div>
          <p className="text-slate-500">Delivers JSON payloads for every Flagged or Failed prompt.</p>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs focus:bg-white focus:outline-hidden focus:border-purple-400"
          />
        </div>

        {/* Log Retention Policy */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-sm">Log Retention Window</h4>
          </div>
          <p className="text-slate-500">Raw prompts older than this threshold will be pruned per GDPR.</p>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs"
          >
            <option value="30">30 Days</option>
            <option value="90">90 Days (Recommended)</option>
            <option value="180">180 Days</option>
            <option value="365">365 Days (Enterprise Compliance)</option>
          </select>
        </div>

        {/* Failure Alerts */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <BellRing size={16} className="text-amber-600" />
            <h4 className="font-bold text-slate-900 text-sm">Automated Alert Thresholds</h4>
          </div>
          <p className="text-slate-500">Trigger Slack / Email alerts when error rate exceeds 2.5% over 5m window.</p>
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
            <span className="text-slate-700 font-medium">Slack Ops Channel Sync</span>
            <span className="text-emerald-600 font-semibold">Connected (#ai-alerts)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
