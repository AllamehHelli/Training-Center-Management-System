/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  MoreVertical,
  ExternalLink,
  Eye,
  Copy,
  Check,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { QueryLogItem, QueryCategory, QueryStatus, ModelName } from '../aiTypes';

interface QueryLogTableProps {
  queries: QueryLogItem[];
  onSelectQuery: (query: QueryLogItem) => void;
  onRefreshData?: () => void;
}

export const QueryLogTable: React.FC<QueryLogTableProps> = ({
  queries,
  onSelectQuery,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedModel, setSelectedModel] = useState<string>('All');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Filtered queries
  const filteredQueries = useMemo(() => {
    return queries.filter((item) => {
      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesQuery = item.query.toLowerCase().includes(term);
        const matchesUser = item.user.toLowerCase().includes(term);
        const matchesEmail = item.userEmail.toLowerCase().includes(term);
        if (!matchesQuery && !matchesUser && !matchesEmail) return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'All' && item.status !== selectedStatus) {
        return false;
      }

      // Model filter
      if (selectedModel !== 'All' && item.model !== selectedModel) {
        return false;
      }

      return true;
    });
  }, [queries, searchTerm, selectedCategory, selectedStatus, selectedModel]);

  // Paginated slice
  const totalPages = Math.ceil(filteredQueries.length / pageSize) || 1;
  const paginatedQueries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQueries.slice(start, start + pageSize);
  }, [filteredQueries, currentPage]);

  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getStatusBadge = (status: QueryStatus) => {
    switch (status) {
      case 'Success':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
            Success
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-500 border border-rose-100">
            Failed
          </span>
        );
      case 'Flagged':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-100">
            Flagged
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 sm:p-6 transition-all duration-200">
      {/* Top Header & Filter Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        {/* Left: Title & Count */}
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Query log
          </h3>
          <div className="text-xs text-slate-400 font-normal mt-0.5">
            {filteredQueries.length} {filteredQueries.length === 1 ? 'result' : 'results'}
          </div>
        </div>

        {/* Right: Search and Dropdowns Filter Row */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Search Input Pill */}
          <div className="relative flex items-center min-w-[200px] sm:min-w-[240px]">
            <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-full text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>

          {/* Category Dropdown Pill */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-full text-xs text-slate-600 font-medium focus:outline-hidden focus:border-purple-400 cursor-pointer shadow-2xs transition-colors"
            >
              <option value="All">All categories</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Recipe">Recipe</option>
              <option value="Travel">Travel</option>
              <option value="General">General</option>
              <option value="Movies">Movies</option>
              <option value="Planning">Planning</option>
              <option value="Coding">Coding</option>
              <option value="Finance">Finance</option>
              <option value="Healthcare">Healthcare</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Dropdown Pill */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-full text-xs text-slate-600 font-medium focus:outline-hidden focus:border-purple-400 cursor-pointer shadow-2xs transition-colors"
            >
              <option value="All">All statuses</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
              <option value="Flagged">Flagged</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Model Dropdown Pill */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-full text-xs text-slate-600 font-medium focus:outline-hidden focus:border-purple-400 cursor-pointer shadow-2xs transition-colors"
            >
              <option value="All">All models</option>
              <option value="Monogram-GPT">Monogram-GPT</option>
              <option value="GPT-5">GPT-5</option>
              <option value="Claude 3.5">Claude 3.5</option>
              <option value="Gemini 1.5">Gemini 1.5</option>
              <option value="Custom AI">Custom AI</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 font-medium text-[11px]">
              <th className="pb-3 pl-4 pr-3 font-medium">User</th>
              <th className="pb-3 px-3 font-medium">Category</th>
              <th className="pb-3 px-3 font-medium">User</th>
              <th className="pb-3 px-3 font-medium">Model</th>
              <th className="pb-3 px-3 font-medium">Status</th>
              <th className="pb-3 px-3 font-medium">Response time</th>
              <th className="pb-3 pr-4 pl-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-slate-700">
            {paginatedQueries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search size={22} className="text-slate-300" />
                    <span>No queries match the selected filters</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedCategory('All');
                        setSelectedStatus('All');
                        setSelectedModel('All');
                      }}
                      className="text-xs text-purple-600 hover:underline font-medium mt-1"
                    >
                      Clear all filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedQueries.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelectQuery(item)}
                  className="group hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  {/* Query Text */}
                  <td className="py-3.5 pl-4 pr-3 max-w-[220px] sm:max-w-[280px]">
                    <div className="truncate font-normal text-slate-800 group-hover:text-purple-700 transition-colors" title={item.query}>
                      {item.query}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-3 text-slate-500 font-normal whitespace-nowrap">
                    {item.category}
                  </td>

                  {/* User Name */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span className="text-slate-600 font-normal">
                      {item.user}
                    </span>
                  </td>

                  {/* Model */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 font-normal">
                    {item.model}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {getStatusBadge(item.status)}
                  </td>

                  {/* Response Time */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 font-sans">
                    {item.responseTime.toFixed(1)}s
                  </td>

                  {/* Actions (Three-dot Menu) */}
                  <td className="py-3.5 pr-4 pl-3 whitespace-nowrap text-right relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveActionId(activeActionId === item.id ? null : item.id);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                      title="More options"
                    >
                      <MoreVertical size={15} />
                    </button>

                    {/* Dropdown Menu */}
                    {activeActionId === item.id && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionId(null);
                          }}
                        />
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-4 top-10 w-44 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 z-40 text-xs text-left animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionId(null);
                              onSelectQuery(item);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Eye size={13} className="text-slate-400" />
                            <span>View Prompt Log</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              handleCopy(item.id, item.fullPrompt, e);
                              setActiveActionId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            {copiedId === item.id ? (
                              <Check size={13} className="text-emerald-500" />
                            ) : (
                              <Copy size={13} className="text-slate-400" />
                            )}
                            <span>Copy Prompt Text</span>
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing <span className="font-medium text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-medium text-slate-800">
              {Math.min(currentPage * pageSize, filteredQueries.length)}
            </span>{' '}
            of <span className="font-medium text-slate-800">{filteredQueries.length}</span> queries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-medium text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
