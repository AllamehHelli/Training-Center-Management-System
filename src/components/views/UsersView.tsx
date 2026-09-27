/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, UserCheck, ShieldCheck, Mail, Activity } from 'lucide-react';

export const UsersView: React.FC = () => {
  const usersList = [
    {
      name: 'Sarah Mitchell',
      email: 'sarah.mitchell@enterprise.ai',
      role: 'Super Admin',
      queries: 1420,
      tokens: '412k',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
      status: 'Active',
    },
    {
      name: 'Violet Norman',
      email: 'violet.norman@example.com',
      role: 'Product Lead',
      queries: 3840,
      tokens: '890k',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face',
      status: 'Active',
    },
    {
      name: 'James Wilson',
      email: 'j.wilson@craftbakery.io',
      role: 'Staff Engineer',
      queries: 2150,
      tokens: '620k',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      status: 'Active',
    },
    {
      name: 'Marcus Vance',
      email: 'mvance@apexholdings.vc',
      role: 'Financial Analyst',
      queries: 1820,
      tokens: '980k',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      status: 'Active',
    },
    {
      name: 'Dr. Elena Rostova',
      email: 'e.rostova@healthsystem.org',
      role: 'Clinical Auditor',
      queries: 820,
      tokens: '310k',
      avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&crop=face',
      status: 'Active',
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Users & Prompt Quotas</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage organization members, assigned roles, and model consumption limits.
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs rounded-full shadow-xs transition-colors self-start sm:self-auto"
        >
          Invite Member
        </button>
      </div>

      <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 bg-white/60">
                <th className="py-3 px-4 font-medium">User</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium">30-Day Queries</th>
                <th className="py-3 px-4 font-medium">Tokens Used</th>
                <th className="py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {usersList.map((user) => (
                <tr key={user.email} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 flex items-center gap-3">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-[11px] text-slate-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-sans font-medium text-slate-800">
                    {user.queries.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-sans font-medium text-slate-800">
                    {user.tokens}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
