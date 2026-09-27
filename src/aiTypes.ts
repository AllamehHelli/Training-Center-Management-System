/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type QueryCategory =
  | 'Restaurant'
  | 'Recipe'
  | 'Travel'
  | 'General'
  | 'Movies'
  | 'Planning'
  | 'Coding'
  | 'Finance'
  | 'Healthcare';

export type ModelName =
  | 'Monogram-GPT'
  | 'GPT-5'
  | 'Claude 3.5'
  | 'Gemini 1.5'
  | 'Custom AI';

export type QueryStatus = 'Success' | 'Failed' | 'Flagged';

export interface QueryLogItem {
  id: string;
  query: string;
  category: QueryCategory;
  user: string;
  userEmail: string;
  userAvatar?: string;
  model: ModelName;
  status: QueryStatus;
  responseTime: number; // in seconds
  timestamp: string; // ISO or human format
  tokensPrompt: number;
  tokensCompletion: number;
  cost: number; // in USD
  fullPrompt: string;
  responseText: string;
  routingPath: string;
  latencyBreakdown: {
    dnsMs: number;
    ttftMs: number;
    generationMs: number;
  };
  flagReason?: string;
  failureReason?: string;
  clientIp?: string;
  temperature?: number;
}

export interface KPICardItem {
  id: string;
  title: string;
  value: string;
  numericValue: number;
  trend: string;
  trendIsPositive: boolean;
  icon: 'queries' | 'success' | 'failed' | 'flagged';
  sparkline: number[];
  sparklineColor: string;
}

export type NavTabId =
  | 'dashboard'
  | 'queries'
  | 'models'
  | 'analytics'
  | 'reports'
  | 'users'
  | 'alerts'
  | 'security'
  | 'settings';

export interface DateRangeOption {
  id: string;
  label: string;
  days: number;
}

export interface ModelMetric {
  name: ModelName;
  queriesCount: number;
  avgLatency: number;
  successRate: number;
  costPer1k: number;
  color: string;
}
