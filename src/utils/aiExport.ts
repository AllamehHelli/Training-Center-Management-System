/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QueryLogItem } from '../aiTypes';

export function downloadQueriesCSV(items: QueryLogItem[], filename = 'ai-queries-log.csv') {
  const headers = [
    'ID',
    'Query',
    'Category',
    'User',
    'Email',
    'Model',
    'Status',
    'Response Time (s)',
    'Tokens Prompt',
    'Tokens Completion',
    'Cost ($)',
    'Timestamp',
    'Routing Path',
  ];

  const rows = items.map((q) => [
    q.id,
    `"${q.query.replace(/"/g, '""')}"`,
    q.category,
    `"${q.user.replace(/"/g, '""')}"`,
    q.userEmail,
    q.model,
    q.status,
    q.responseTime.toFixed(1),
    q.tokensPrompt,
    q.tokensCompletion,
    q.cost.toFixed(4),
    q.timestamp,
    `"${q.routingPath.replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadQueriesJSON(items: QueryLogItem[], filename = 'ai-queries-log.json') {
  const jsonContent = JSON.stringify(items, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
