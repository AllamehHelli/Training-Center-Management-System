/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from './store';
import { AcademicYear } from './types';
import { Modal, ConfirmModal, useToast, InfoTooltip } from './ui';
import { toPersianDigits, getTodayJalali } from './utils';
import { JalaliDatePicker } from './JalaliDatePicker';
import {
  IconArchive,
  IconCalendar,
  IconCheck,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconEdit,
  IconAlert,
} from './icons';

interface AcademicYearManagerProps {
  isOpen?: boolean;
  onClose?: () => void;
  isInline?: boolean;
}

export const AcademicYearManager: React.FC<AcademicYearManagerProps> = ({
  isOpen = true,
  onClose,
  isInline = false,
}) => {
  const {
    state,
    dispatch,
    activeAcademicYear,
    viewingAcademicYear,
    isViewingArchived,
    switchAcademicYear,
  } = useAppStore();
  const { showToast } = useToast();

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // New Academic Year Form State
  const [newYearTitle, setNewYearTitle] = useState('سال تحصیلی ۱۴۰۴-۱۴۰۵ (خرداد تا خرداد)');
  const [newShortTitle, setNewShortTitle] = useState('۱۴۰۴-۱۴۰۵');
  const [newPeriodLabel, setNewPeriodLabel] = useState('خرداد ۱۴۰۴ تا خرداد ۱۴۰۵');
  const [newStartDate, setNewStartDate] = useState('1404/03/01');
  const [newEndDate, setNewEndDate] = useState('1405/03/01');
  const [keepStudents, setKeepStudents] = useState(true);
  const [keepClasses, setKeepClasses] = useState(true);
  const [newDescription, setNewDescription] = useState('دوره آموزشی سال تحصیلی جدید آموزشگاه');

  // Edit Year State
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  const handleStartNewYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearTitle.trim()) {
      showToast('لطفاً عنوان سال تحصیلی جدید را وارد نمایید', 'error');
      return;
    }

    dispatch({
      type: 'ARCHIVE_AND_START_NEW_YEAR',
      payload: {
        newYear: {
          id: `ay-${Date.now()}`,
          title: newYearTitle.trim(),
          shortTitle: newShortTitle.trim() || 'دوره جدید',
          periodLabel: newPeriodLabel.trim() || 'خرداد تا خرداد',
          startDate: newStartDate.trim() || getTodayJalali(),
          endDate: newEndDate.trim() || '',
          description: newDescription.trim(),
        },
        keepStudents,
        keepClasses,
      },
    });

    setIsArchiveModalOpen(false);
    if (onClose) onClose();
    showToast('سال تحصیلی جدید آغاز شد و سوابق سال قبل در بایگانی ذخیره گردید', 'success');
  };

  const handleUpdateYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYear) return;

    dispatch({
      type: 'UPDATE_ACADEMIC_YEAR',
      payload: editingYear,
    });

    setEditingYear(null);
    showToast('اطلاعات دوره تحصیلی به‌روزرسانی شد', 'success');
  };

  const handleDeleteYear = (id: string) => {
    if (id === state.activeYearId) {
      showToast('امکان حذف سال تحصیلی جاری وجود ندارد', 'error');
      return;
    }
    dispatch({ type: 'DELETE_ACADEMIC_YEAR', payload: id });
    setDeleteTargetId(null);
    showToast('دوره تحصیلی از بایگانی حذف شد', 'info');
  };

  const mainContent = (
    <>
      {/* Header Description with Info Tooltip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm text-[#162E6E]">
              دوره‌های سال تحصیلی و انتقال داده‌ها
            </span>
            <InfoTooltip
              title="نحوه کارکرد سال تحصیلی و بایگانی"
              content={
                <div>
                  <p>
                    می‌توانید دوره‌های سال تحصیلی را متناسب با تقویم آموزشگاه (مثلاً خرداد تا خرداد) تعریف کنید.
                  </p>
                  <p className="mt-1">
                    با پایان سال تحصیلی، اطلاعات کلاس‌ها، فیش‌ها و ثبت‌نام‌های جاری به‌صورت خودکار در آرشیو ثبت شده و سال جدید با امکان شروع کاملاً تازه و ثبت‌نام از اول باز می‌شود.
                  </p>
                </div>
              }
            />
          </div>
          <p className="text-xs text-slate-600 mt-1">
            تعریف تقویم آموزشی (مانند خرداد تا خرداد)، بستن دوره و بایگانی سوابق با شروع سال جدید.
          </p>
        </div>

        {/* Archive & Start New Year Action Button */}
        <button
          type="button"
          onClick={() => setIsArchiveModalOpen(true)}
          className="px-4 py-2.5 bg-[#EA580C] hover:bg-[#D94816] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 shrink-0 transition-colors"
        >
          <IconArchive size={15} />
          <span>پایان دوره و شروع سال جدید</span>
        </button>
      </div>

      {/* List of Academic Years */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
          <span>فهرست سال‌های تحصیلی آموزشگاه</span>
          <span className="text-[11px] text-slate-400">
            {toPersianDigits(state.academicYears.length)} دوره ثبت شده
          </span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
          {state.academicYears.map((year) => {
            const isActive = year.id === state.activeYearId;
            const isCurrentlyViewing = year.id === state.viewingYearId;

            return (
              <div
                key={year.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  isCurrentlyViewing ? 'bg-orange-50/40' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <IconCalendar size={18} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-bold text-sm text-slate-900">
                        {year.title}
                      </span>

                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>سال تحصیلی جاری و فعال</span>
                        </span>
                      )}

                      {year.isArchived && (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          بایگانی شده
                        </span>
                      )}

                      {isCurrentlyViewing && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EA580C] text-white">
                          در حال مشاهده
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400">بازه زمانی:</span>
                        <span className="font-medium text-slate-700">{year.periodLabel}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400">تاریخ:</span>
                        <span className="font-mono text-slate-700">
                          {toPersianDigits(year.startDate)} الی {toPersianDigits(year.endDate)}
                        </span>
                      </span>
                      {year.archivedAt && (
                        <>
                          <span>•</span>
                          <span className="text-amber-700 text-[11px]">
                            تاریخ بایگانی: {toPersianDigits(year.archivedAt)}
                          </span>
                        </>
                      )}
                    </div>

                    {year.description && (
                      <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                        {year.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* Switch button */}
                  {!isCurrentlyViewing ? (
                    <button
                      type="button"
                      onClick={() => {
                        switchAcademicYear(year.id);
                        showToast(`مشاهده به "${year.title}" تغییر یافت`, 'info');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#162E6E] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      مشاهده این دوره
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-700 font-semibold px-2 py-1 bg-emerald-50 rounded-lg flex items-center gap-1">
                      <IconCheck size={14} />
                      <span>فعال در پنل</span>
                    </span>
                  )}

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => setEditingYear({ ...year })}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="ویرایش عنوان و تاریخ دوره"
                  >
                    <IconEdit size={15} />
                  </button>

                  {/* Delete Archived Year Button */}
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(year.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف این دوره از آرشیو"
                    >
                      <IconTrash size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <>
      {isInline ? (
        <div className="space-y-6">
          {mainContent}
        </div>
      ) : (
        <Modal isOpen={isOpen} onClose={onClose || (() => {})} title="مدیریت دوره‌های سال تحصیلی و بایگانی" maxWidth="3xl">
          <div className="space-y-6">
            {mainContent}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                نکته: با انتخاب هر سال تحصیلی، کلیه آمار، کلاس‌ها، ثبت‌نام‌ها و گزارش‌ها متناسب با آن سال نمایش داده می‌شوند.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Finish Current Academic Year and Start New One */}
      <Modal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        title="پایان دوره و بایگانی سال تحصیلی جاری"
        maxWidth="2xl"
      >
        <form onSubmit={handleStartNewYear} className="space-y-5">
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
            <IconAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">عملیات بستن و انتقال دوره تحصیلی:</div>
              <p className="mt-0.5">
                با اجرای این عملیات، تمامی ثبت‌نام‌ها و عملکرد مالی سال تحصیلی{' '}
                <strong className="font-semibold text-amber-950">
                  {activeAcademicYear?.title}
                </strong>{' '}
                به‌طور دائم در بخش آرشیو ذخیره شده و سال تحصیلی جدید برای تعریف کلاس‌ها و ثبت‌نام‌های تازه آغاز می‌گردد.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                عنوان سال تحصیلی جدید <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newYearTitle}
                onChange={(e) => setNewYearTitle(e.target.value)}
                placeholder="مثال: سال تحصیلی ۱۴۰۴-۱۴۰۵ (خرداد تا خرداد)"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#EA580C] focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                عنوان کوتاه دوره
              </label>
              <input
                type="text"
                value={newShortTitle}
                onChange={(e) => setNewShortTitle(e.target.value)}
                placeholder="مثال: ۱۴۰۴-۱۴۰۵"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#EA580C] focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                بازه زمانی دوره
              </label>
              <input
                type="text"
                value={newPeriodLabel}
                onChange={(e) => setNewPeriodLabel(e.target.value)}
                placeholder="مثال: خرداد ۱۴۰۴ تا خرداد ۱۴۰۵"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#EA580C] focus:bg-white"
              />
            </div>

            <div>
              <JalaliDatePicker
                label="تاریخ شروع دوره (شمسی)"
                value={newStartDate}
                onChange={(d) => setNewStartDate(d)}
                placeholder="1404/03/01"
                maxDate={newEndDate}
                showHumanPreview={true}
                clearable={false}
              />
            </div>

            <div>
              <JalaliDatePicker
                label="تاریخ پایان دوره (شمسی)"
                value={newEndDate}
                onChange={(d) => setNewEndDate(d)}
                placeholder="1405/03/01"
                minDate={newStartDate}
                showHumanPreview={true}
                clearable={false}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                توضیحات دوره تحصیلی
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="توضیحات یا یادداشت‌های مربوط به این دوره..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#EA580C] focus:bg-white"
              />
            </div>
          </div>

          {/* Options for Data Initialization */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">
              نحوه شروع سال جدید و انتقال داده‌ها:
            </span>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={keepStudents}
                onChange={(e) => setKeepStudents(e.target.checked)}
                className="mt-0.5 text-[#EA580C] rounded focus:ring-0 focus:outline-hidden"
              />
              <div>
                <span className="text-xs font-semibold text-slate-700 block">
                  حفظ پرونده و اطلاعات پایه دانش‌آموزان در سال جدید
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  دفترچه اسامی، اطلاعات تماس و اولیای دانش‌آموزان حفظ شده اما کلیه ثبت‌نام‌ها خالی شده و از صفر شروع می‌شوند.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200/60">
              <input
                type="checkbox"
                checked={keepClasses}
                onChange={(e) => setKeepClasses(e.target.checked)}
                className="mt-0.5 text-[#EA580C] rounded focus:ring-0 focus:outline-hidden"
              />
              <div>
                <span className="text-xs font-semibold text-slate-700 block">
                  حفظ عناوین کلاس‌ها و زنگ‌های آموزشی با ظرفیت خالی
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  کلاس‌ها و زنگ‌های فعلی جهت راحتی کار مجدداً تعریف می‌شوند با ظرفیت آزاد (ثبت‌نام صفر).
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D94816] rounded-lg transition-colors shadow-xs flex items-center gap-2"
            >
              <IconCheck size={16} />
              <span>تأیید بایگانی و شروع دوره جدید</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Academic Year */}
      {editingYear && (
        <Modal
          isOpen={Boolean(editingYear)}
          onClose={() => setEditingYear(null)}
          title="ویرایش مشخصات دوره تحصیلی"
          maxWidth="md"
        >
          <form onSubmit={handleUpdateYear} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                عنوان دوره تحصیلی
              </label>
              <input
                type="text"
                required
                value={editingYear.title}
                onChange={(e) => setEditingYear({ ...editingYear, title: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#EA580C] focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                بازه زمانی دوره (مثلاً خرداد تا خرداد)
              </label>
              <input
                type="text"
                value={editingYear.periodLabel}
                onChange={(e) => setEditingYear({ ...editingYear, periodLabel: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#EA580C] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <JalaliDatePicker
                  label="تاریخ شروع"
                  value={editingYear.startDate}
                  onChange={(d) => setEditingYear({ ...editingYear, startDate: d })}
                  maxDate={editingYear.endDate}
                  clearable={false}
                />
              </div>

              <div>
                <JalaliDatePicker
                  label="تاریخ پایان"
                  value={editingYear.endDate}
                  onChange={(d) => setEditingYear({ ...editingYear, endDate: d })}
                  minDate={editingYear.startDate}
                  clearable={false}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                توضیحات دوره
              </label>
              <textarea
                rows={2}
                value={editingYear.description || ''}
                onChange={(e) => setEditingYear({ ...editingYear, description: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#EA580C] focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingYear(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-lg hover:bg-[#D94816]"
              >
                ذخیره تغییرات
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && handleDeleteYear(deleteTargetId)}
        title="حذف دوره تحصیلی از بایگانی"
        description="آیا از حذف کامل این دوره از آرشیو اطمینان دارید؟ تمام داده‌های بایگانی شده این دوره پاک خواهند شد."
        confirmText="بله، حذف دوره"
        cancelText="انصراف"
        danger={true}
      />
    </>
  );
};
