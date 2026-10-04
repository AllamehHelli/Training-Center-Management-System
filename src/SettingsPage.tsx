/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useFieldSettings, DEFAULT_FIELD_SETTINGS } from './Settings';
import { useAppStore } from './store';
import { FieldSettings } from './types';
import { useToast, InfoTooltip } from './ui';
import {
  IconCheck,
  IconRefresh,
  IconPlus,
  IconClose,
  IconGripVertical,
  IconArrowUp,
  IconArrowDown,
  IconSettings,
  IconFinance,
  IconCalendar,
} from './icons';
import { toPersianDigits, formatToman } from './utils';
import { PaymentPlanManager } from './PaymentPlanManager';
import { AcademicYearManager } from './AcademicYearManager';
import { Type, UploadCloud, CheckCircle2, FileText, AlertCircle, Sparkles, RefreshCw, Download, Copy, PlusCircle } from 'lucide-react';
import { PRESET_FONTS, setActiveFont, getActiveFontId, uploadAndApplyFont, SystemFontOption } from './fontManager';
import { logger } from './logger';
import { BACKEND_ENABLED } from './api';

export const SettingsPage: React.FC = () => {
  const {
    fieldSettings,
    saveFieldSettings,
    resetFieldSettings,
    grades,
    addGrade,
    removeGrade,
    reorderGrades,
    resetGrades,
  } = useFieldSettings();

  const { state, dispatch } = useAppStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'years' | 'grades' | 'plans' | 'fields' | 'fonts' | 'logs'>('years');
  const [localState, setLocalState] = useState<FieldSettings>({ ...fieldSettings });

  // Font Management State
  const [selectedFontId, setSelectedFontId] = useState<string>(getActiveFontId());
  const [isUploadingFont, setIsUploadingFont] = useState(false);
  const [uploadedFontName, setUploadedFontName] = useState<string | null>(
    localStorage.getItem('helli_custom_font_filename')
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFont = (fontId: string) => {
    setSelectedFontId(fontId);
    setActiveFont(fontId);
    showToast('فونت سامانه با موفقیت تغییر کرد', 'success');
  };

  const handleFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFont(true);
    const res = await uploadAndApplyFont(file);
    setIsUploadingFont(false);
    if (res.success) {
      setSelectedFontId('custom-upload');
      setUploadedFontName(file.name);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // New Grade state
  const [newGradeName, setNewGradeName] = useState('');

  // Drag and drop state for grades
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fieldsList: { key: keyof FieldSettings; label: string; desc: string }[] = [
    { key: 'firstName', label: 'نام دانش‌آموز', desc: 'وارد کردن نام کوچک هنگام ثبت‌نام و تشکیل پرونده الزامی باشد' },
    { key: 'lastName', label: 'نام خانوادگی', desc: 'نام خانوادگی شناسنامه‌ای الزامی باشد' },
    { key: 'fatherName', label: 'نام پدر', desc: 'نام پدر برای پرونده تحصیلی و احراز هویت الزامی باشد' },
    { key: 'nationalId', label: 'کد ملی (۱۰ رقم)', desc: 'کد ملی ۱۰ رقمی با اعتبارسنجی ارقام الزامی باشد' },
    { key: 'grade', label: 'پایه تحصیلی', desc: 'انتخاب پایه تحصیلی الزامی باشد' },
    { key: 'gpa', label: 'معدل سال گذشته', desc: 'معدل کارنامه سال تحصیلی قبل ثبت شود' },
    { key: 'school', label: 'نام مدرسه فعلی', desc: 'نام مدرسه‌ای که دانش‌آموز در آن مشغول به تحصیل است' },
    { key: 'phones', label: 'شماره‌های تماس', desc: 'ثبت حداقل یک شماره موبایل معتبر (۱۱ رقم با پیش‌شماره ۰۹)' },
  ];

  const handleToggle = (key: keyof FieldSettings) => {
    setLocalState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveFields = () => {
    saveFieldSettings(localState);
    showToast('تنظیمات فیلدهای الزامی با موفقیت ذخیره شد', 'success');
  };

  const handleResetFields = () => {
    setLocalState({ ...DEFAULT_FIELD_SETTINGS });
    resetFieldSettings();
    showToast('تنظیمات فیلدها به حالت پیش‌فرض بازنشانی شد', 'info');
  };

  // Grade Add / Remove
  const handleAddNewGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGradeName.trim()) {
      showToast('لطفاً عنوان پایه تحصیلی را وارد کنید', 'error');
      return;
    }
    const res = addGrade(newGradeName.trim());
    if (res.success) {
      showToast(res.message, 'success');
      setNewGradeName('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleRemoveGrade = (gradeName: string) => {
    const usedByStudents = state.students.filter((s) => s.grade === gradeName).length;
    const usedByClasses = state.classes.filter((c) => c.grade === gradeName).length;

    if (usedByStudents > 0 || usedByClasses > 0) {
      showToast(
        `امکان حذف پایه «${gradeName}» وجود ندارد زیرا ${toPersianDigits(
          usedByStudents
        )} دانش‌آموز و ${toPersianDigits(usedByClasses)} کلاس به آن متصل هستند.`,
        'error'
      );
      return;
    }

    const res = removeGrade(gradeName);
    if (res.success) {
      showToast(res.message, 'info');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Reorder grade helpers (Drag and Drop + Arrow buttons)
  const handleMoveGrade = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= grades.length || fromIdx === toIdx) return;
    const updated = [...grades];
    const [movedItem] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, movedItem);
    reorderGrades(updated);
    showToast(`ترتیب پایه «${movedItem}» تغییر یافت`, 'success');
  };

  // Drag Handlers
  const onDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const onDragLeave = () => {
    // Keep clean
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      handleMoveGrade(draggedIdx, targetIdx);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const onDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Quick preset grade suggestions
  const gradeSuggestions = ['دهم', 'یازدهم', 'دوازدهم', 'کنکور سراسری', 'تیزهوشان پنجم', 'المپیاد پیشرفته'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/70">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-neutral-900">تنظیمات سامانه و پیکربندی</h1>
            <InfoTooltip
              title="پیکربندی آموزشگاه"
              content="مدیریت دوره‌های سال تحصیلی و بایگانی، شخصی‌سازی پایه‌ها، الگوهای اقساط شهریه و تعیین فیلدهای اجباری فرم تشکیل پرونده."
            />
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            دوره‌های سال تحصیلی، پایه‌های آموزشی، پلن‌های پرداخت اقساط و فیلدهای پرونده
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 bg-neutral-100/80 rounded-full flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('years')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              activeTab === 'years'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <IconCalendar size={13} className={activeTab === 'years' ? 'text-neutral-900' : 'text-neutral-400'} />
            <span>دوره‌های سال تحصیلی</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grades')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              activeTab === 'grades'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <span>پایه‌های تحصیلی</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              activeTab === 'plans'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <IconFinance size={13} className={activeTab === 'plans' ? 'text-neutral-900' : 'text-neutral-400'} />
            <span>پلن‌های اقساط</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              activeTab === 'fields'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <IconSettings size={13} className={activeTab === 'fields' ? 'text-neutral-900' : 'text-neutral-400'} />
            <span>فیلدهای پرونده</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fonts')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              activeTab === 'fonts'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Type size={13} className={activeTab === 'fonts' ? 'text-neutral-900' : 'text-neutral-400'} />
            <span>فونت و ظاهر</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              activeTab === 'logs'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <FileText size={13} className={activeTab === 'logs' ? 'text-neutral-900' : 'text-neutral-400'} />
            <span>لاگ‌ها و خطایابی</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 0: ACADEMIC YEARS & ARCHIVE MANAGEMENT                     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'years' && (
        <div className="bg-[#FBFDFC] rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6">
          <AcademicYearManager isInline={true} />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: GRADES MANAGEMENT WITH DRAG AND DROP                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'grades' && (
        <div className="space-y-6">
          <div className="bg-[#FBFDFC] rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#0A3528]">
                  پایه‌های تحصیلی آموزشگاه و تنظیم ترتیب با درگ اند دراپ
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  کارت‌های پایه‌ها را بگیرید و بکشید (Drag & Drop) تا ترتیب نمایش آنها در فرم‌ها، فیلترها و کارنامه‌ها تغییر کند.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetGrades();
                  showToast('پایه‌های تحصیلی به ششم تا نهم بازنشانی شد', 'info');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs shrink-0"
              >
                <IconRefresh size={14} />
                <span>بازنشانی به پیش‌فرض</span>
              </button>
            </div>

            {/* Add new grade form */}
            <form onSubmit={handleAddNewGrade} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newGradeName}
                  onChange={(e) => setNewGradeName(e.target.value)}
                  placeholder="عنوان پایه جدید را بنویسید (مثلاً: دهم، یازدهم، دوازدهم، کنکور، المپیاد...)"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white transition-colors"
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#0E7C5B] rounded-xl hover:bg-[#0A3528] transition-colors shadow-xs shrink-0"
              >
                <IconPlus size={16} />
                <span>افزودن پایه جدید</span>
              </button>
            </form>

            {/* Quick suggestions */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="text-[11px] text-slate-400">پیشنهادات سریع:</span>
              {gradeSuggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    const res = addGrade(sug);
                    if (res.success) showToast(res.message, 'success');
                    else showToast(res.message, 'info');
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-[#0E7C5B]/10 hover:text-[#0E7C5B] text-slate-700 rounded-lg text-[11px] transition-colors"
                >
                  + {sug}
                </button>
              ))}
            </div>

            {/* Drag & Drop Notice */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-amber-900 flex items-center gap-2.5">
              <IconGripVertical size={16} className="text-[#E9A13B] shrink-0" />
              <span>
                <strong>راهنمای جابجایی:</strong> می‌توانید با نگه‌داشتن و کشیدن هر کارت (درگ اند دراپ) یا با کلیک روی فلش‌های بالا و پایین، اولویت و ترتیب پایه‌ها را در کل سامانه شخصی‌سازی کنید.
              </span>
            </div>

            {/* Reorderable Grades List */}
            <div className="space-y-2.5 pt-2">
              <div className="text-xs font-semibold text-slate-700 mb-2">
                فهرست پایه‌های فعال به ترتیب اولویت ({toPersianDigits(grades.length)} پایه):
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grades.map((grade, index) => {
                  const studentCount = state.students.filter((s) => s.grade === grade).length;
                  const classCount = state.classes.filter((c) => c.grade === grade).length;
                  const isDragging = draggedIdx === index;
                  const isOver = dragOverIdx === index;

                  return (
                    <div
                      key={grade}
                      draggable={true}
                      onDragStart={(e) => onDragStart(e, index)}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDrop(e, index)}
                      onDragEnd={onDragEnd}
                      className={`group relative p-3.5 bg-white rounded-xl border transition-all select-none cursor-grab active:cursor-grabbing flex items-center justify-between gap-3 ${
                        isDragging
                          ? 'opacity-40 border-dashed border-[#0E7C5B] bg-emerald-50 scale-95 shadow-inner'
                          : isOver
                          ? 'border-2 border-[#0E7C5B] bg-emerald-50/60 shadow-md scale-[1.02]'
                          : 'border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                      }`}
                    >
                      {/* Left: Drag Handle and Number */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className="p-1 text-slate-400 group-hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="برای تغییر ترتیب درگ کنید"
                        >
                          <IconGripVertical size={16} />
                        </div>
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center justify-center font-mono">
                          {toPersianDigits(index + 1)}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-[#0A3528]">پایه {grade}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {toPersianDigits(studentCount)} دانش‌آموز · {toPersianDigits(classCount)} کلاس
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Arrow Buttons + Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveGrade(index, index - 1);
                          }}
                          className={`p-1 rounded-md transition-colors ${
                            index === 0
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title="انتقال به بالا"
                        >
                          <IconArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={index === grades.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveGrade(index, index + 1);
                          }}
                          className={`p-1 rounded-md transition-colors ${
                            index === grades.length - 1
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title="انتقال به پایین"
                        >
                          <IconArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveGrade(grade);
                          }}
                          className="p-1.5 text-slate-400 hover:text-[#D64545] hover:bg-red-50 rounded-lg transition-colors mr-1"
                          title={`حذف پایه ${grade}`}
                        >
                          <IconClose size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: PAYMENT PLANS & FINANCIAL SYSTEM                       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'plans' && (
        <div>
          <PaymentPlanManager />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: REQUIRED FIELDS SETTINGS                               */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'fields' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-[#0A3528]">تنظیمات فیلدهای الزامی پرونده دانش‌آموز</h2>
              <p className="text-xs text-slate-500 mt-1">
                تعیین کنید کدام فیلدها در فرم ثبت‌نام و تشکیل پرونده دانش‌آموزان برای اپراتور اجباری هستند.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFields}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
              >
                <IconRefresh size={14} />
                <span>بازنشانی به پیش‌فرض</span>
              </button>
              <button
                type="button"
                onClick={handleSaveFields}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0E7C5B] rounded-lg hover:bg-[#0A3528] transition-colors shadow-xs"
              >
                <IconCheck size={16} />
                <span>ذخیره تنظیمات فیلدها</span>
              </button>
            </div>
          </div>

          {/* Settings Grid */}
          <div className="bg-[#FBFDFC] rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-xs">
            {fieldsList.map((item) => {
              const isRequired = localState[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1 pr-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#0A3528]">{item.label}</span>
                      {isRequired ? (
                        <span className="text-[11px] font-medium text-[#D64545] bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                          الزامی
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          اختیاری
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>

                  {/* Toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isRequired}
                    onClick={() => handleToggle(item.key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      isRequired ? 'bg-[#0E7C5B]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isRequired ? '-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Info notice box */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/70 rounded-xl text-xs text-[#0A3528] leading-relaxed flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0E7C5B] mt-1.5 shrink-0" />
            <div>
              تغییرات اعمال شده بلافاصله در فرم ثبت‌نام جدید، افزودن دانش‌آموز و سیستم ایمپورت گروهی اثر خواهند گذاشت.
              فیلدهای غیرفعال به عنوان اختیاری علامت‌گذاری می‌شوند و عدم تکمیل آن‌ها مانع ثبت نخواهد شد.
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: FONTS & TYPOGRAPHY MANAGEMENT                          */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'fonts' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-[#FBFDFC] rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Type className="text-[#162E6E]" size={20} />
                  <span>مدیریت فونت و تایپوگرافی سامانه</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  شخصی‌سازی قلم سیستم، آپلود مستقیم فایل TTF در مرورگر و اتصال به فونت‌های گیتهاب و هاست بدون وابستگی خارجی.
                </p>
              </div>

              {/* Direct File Upload Trigger */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".ttf,.woff,.woff2,.otf"
                  onChange={handleFontFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFont}
                  className="flex items-center gap-2 px-4 py-2 bg-[#162E6E] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {isUploadingFont ? (
                    <RefreshCw className="animate-spin" size={15} />
                  ) : (
                    <UploadCloud size={15} />
                  )}
                  <span>آپلود مستقیم فونت TTF / WOFF2</span>
                </button>
              </div>
            </div>

            {/* Custom Uploaded Status Banner */}
            {uploadedFontName && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
                  <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                  <span>فونت بارگذاری‌شده در این مرورگر: <strong>{uploadedFontName}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('helli_custom_font_data');
                    localStorage.removeItem('helli_custom_font_filename');
                    setUploadedFontName(null);
                    handleSelectFont('app-auto');
                    showToast('فونت اختصاصی حذف و به حالت خودکار بازگشت', 'info');
                  }}
                  className="text-[11px] text-blue-700 hover:text-red-600 underline font-medium cursor-pointer"
                >
                  حذف فونت آپلودی و بازگشت به پیش‌فرض
                </button>
              </div>
            )}

            {/* Font Grid List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
              {PRESET_FONTS.map((font) => {
                const isSelected = selectedFontId === font.id;
                return (
                  <div
                    key={font.id}
                    onClick={() => handleSelectFont(font.id)}
                    className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-[#162E6E] bg-blue-50/30 shadow-xs'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-xs text-slate-800">{font.name}</span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#162E6E] text-white">
                            <CheckCircle2 size={11} />
                            <span>فعال</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{font.description}</p>
                    </div>

                    {/* Font Preview Text Styled with this font */}
                    <div
                      style={{ fontFamily: font.family }}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 font-medium"
                    >
                      موسسه آموزشی علامه حلی (۱۲۳۴۵۶۷۸۹۰)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Typography Preview Board */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              <span>پیش‌نمایش زنده المان‌ها و فرم‌ها با فونت انتخابی فعلی</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sample Record Box */}
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-800">علیرضا صادقی‌پور</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-xs font-bold rounded-md">
                    پایه دهم ریاضی
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex items-center justify-between">
                  <span>کد ملی: {toPersianDigits('0012345678')}</span>
                  <span>معدل کل: {toPersianDigits('19.85')}</span>
                </div>
                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                  <span className="text-slate-500">شهریه و وضعیت مالی:</span>
                  <span className="font-bold text-emerald-700">{toPersianDigits(formatToman(14500000))}</span>
                </div>
              </div>

              {/* Sample Action Buttons */}
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col justify-center gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 bg-[#162E6E] text-white text-xs font-bold rounded-lg text-center shadow-xs"
                  >
                    پرونده آموزشی
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 bg-[#0E7C5B] text-white text-xs font-bold rounded-lg text-center shadow-xs"
                  >
                    پرونده مالی (اقساط و تسویه)
                  </button>
                </div>
                <div className="text-center text-[11px] text-slate-400">
                  تمامی دکمه‌ها، جداول، عناوین و ارقام با فونت منتخب همگام هستند.
                </div>
              </div>
            </div>
          </div>

          {/* GitHub & cPanel Deployment Guide */}
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <FileText size={16} className="text-amber-700" />
              <span>راهنمای قرار دادن دائمی فایل TTF فونت در گیتهاب و هاست cPanel</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-amber-900 pr-1 text-[11px]">
              <li>فایل فونت خود را با نام <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">font-regular.ttf</code> در پوشه <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">public/fonts/</code> مخزن گیتهاب قرار دهید.</li>
              <li>در صورت داشتن نسخه بولد، آن را با نام <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">font-bold.ttf</code> در همان پوشه بگذارید.</li>
              <li>با کامیت و پوش کردن روی گیت‌هاب، اکشن استقرار خودکار فایل‌ها را در هاست قرار داده و کلیه کاربران بدون نیاز به هیچ تنظیمی دقیقاً همین فونت را مشاهده خواهند کرد.</li>
            </ol>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: SYSTEM LOGS, DIAGNOSTICS & SAMPLE DATA                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="bg-[#FBFDFC] rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#0A3528]">
                  سیستم لاگ، عیب‌یابی و گزارش‌گیری سامانه
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  بررسی کلیه عملیات ثبت‌نام، همگام‌سازی، نشست کاربری و خطاهای سرور PHP با قابلیت خروجی
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const json = logger.exportJson();
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `helli-logs-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('خروجی JSON لاگ‌ها دریافت شد.', 'success');
                  }}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  <span>خروجی JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const csv = logger.exportCsv();
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `helli-logs-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('خروجی CSV لاگ‌ها دریافت شد.', 'success');
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  <span>خروجی CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'RESTORE_FIVE_SAMPLES' });
                    showToast('۵ داده نمونه استاندارد با موفقیت در سامانه بارگذاری شدند.', 'success');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <PlusCircle size={13} />
                  <span>بارگذاری مجدد ۵ داده نمونه</span>
                </button>
              </div>
            </div>

            {/* Diagnostics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="text-[11px] text-slate-500 font-medium">معماری سرور</div>
                <div className="text-sm font-bold text-slate-800">
                  {BACKEND_ENABLED ? 'PHP 8.x + MySQL (هاست cPanel)' : 'محلی (بدون سرور)'}
                </div>
                <p className="text-[11px] text-slate-400">کامل مستقل از Node.js، سازگار با انواع هاست اشتراکی</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="text-[11px] text-slate-500 font-medium">آمار پرونده‌ها</div>
                <div className="text-sm font-bold text-slate-800 font-mono">
                  {state.students.length} دانش‌آموز | {state.registrations.length} پرونده
                </div>
                <p className="text-[11px] text-slate-400">تعداد کلاس‌های فعال: {state.classes.length}</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="text-[11px] text-slate-500 font-medium">گزارش سریع پشتیبانی</div>
                <button
                  type="button"
                  onClick={async () => {
                    const report = logger.generateDiagnosticsReport({
                      'حالت': BACKEND_ENABLED ? 'سرور PHP' : 'لوکال',
                      'دانش‌آموزان': state.students.length,
                      'پرونده‌ها': state.registrations.length,
                    });
                    await navigator.clipboard.writeText(report);
                    showToast('گزارش فنی در کلیپ‌بورد کپی شد.', 'success');
                  }}
                  className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy size={13} />
                  <span>کپی خلاصه عیب‌یابی</span>
                </button>
              </div>
            </div>

            {/* Embedded Live Log Ring Buffer */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700">آخرین رویدادها و خطاهای ثبت‌شده:</h3>
              <div className="max-h-80 overflow-y-auto space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs">
                {logger.getLogs().slice(-25).reverse().map((l) => (
                  <div
                    key={l.id}
                    className={`p-2.5 rounded-lg border bg-white flex items-start justify-between gap-2 ${
                      l.level === 'error' ? 'border-rose-300 bg-rose-50/30 text-rose-900' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${
                          l.level === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {l.category}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 dir-ltr">{l.jalaliTime}</span>
                        {l.status && <span className="text-[10px] font-mono text-slate-500">[{l.status}]</span>}
                      </div>
                      <p className="font-medium text-[11px] truncate">{l.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
