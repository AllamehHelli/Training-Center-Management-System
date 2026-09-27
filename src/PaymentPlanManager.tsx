/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFieldSettings } from './Settings';
import { PaymentPlanTemplate, PlanInstallmentConfig } from './types';
import { Modal, ConfirmModal, useToast, Field } from './ui';
import {
  toPersianDigits,
  formatToman,
  formatNumber,
  toEnglishDigits,
} from './utils';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconCheck,
  IconPercent,
  IconAlert,
  IconRefresh,
} from './icons';

export const PaymentPlanManager: React.FC = () => {
  const { paymentPlans, addPaymentPlan, updatePaymentPlan, deletePaymentPlan, resetPaymentPlans } =
    useFieldSettings();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PaymentPlanTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFeePercent, setFormFeePercent] = useState<number>(7);
  const [formDownPaymentPercent, setFormDownPaymentPercent] = useState<number>(35);
  const [formIntervalMonths, setFormIntervalMonths] = useState<number>(2);
  const [formInstallmentsCount, setFormInstallmentsCount] = useState<number>(2);
  const [formInstallmentConfigs, setFormInstallmentConfigs] = useState<PlanInstallmentConfig[]>([
    { id: 'cfg-1', title: 'قسط اول (پایان ماه دوم)', percent: 36, dueMonthOffset: 2 },
    { id: 'cfg-2', title: 'قسط دوم (پایان ماه چهارم)', percent: 36, dueMonthOffset: 4 },
  ]);
  const [formError, setFormError] = useState('');

  // Simulation calculator state
  const [simTuition, setSimTuition] = useState<number>(10000000);

  const openForm = (plan?: PaymentPlanTemplate) => {
    setFormError('');
    if (plan) {
      setEditingPlan(plan);
      setFormTitle(plan.title);
      setFormDesc(plan.description || '');
      setFormFeePercent(plan.feePercent);
      setFormDownPaymentPercent(plan.downPaymentPercent);
      setFormIntervalMonths(plan.intervalMonths || 1);
      setFormInstallmentsCount(plan.installmentsCount);
      setFormInstallmentConfigs(plan.installmentsConfig.map((c) => ({ ...c })));
    } else {
      setEditingPlan(null);
      setFormTitle('');
      setFormDesc('');
      setFormFeePercent(7);
      setFormDownPaymentPercent(35);
      setFormIntervalMonths(2);
      setFormInstallmentsCount(2);
      setFormInstallmentConfigs([
        { id: `cfg-${Date.now()}-1`, title: 'قسط اول (پایان ماه دوم)', percent: 36, dueMonthOffset: 2 },
        { id: `cfg-${Date.now()}-2`, title: 'قسط دوم (پایان ماه چهارم)', percent: 36, dueMonthOffset: 4 },
      ]);
    }
    setIsModalOpen(true);
  };

  // When count or interval changes, re-generate configs if requested
  const handleRegenerateConfigs = (count: number, interval: number, downPercent: number, fee: number) => {
    if (count <= 0) {
      setFormInstallmentConfigs([]);
      return;
    }
    const targetTotal = 100 + fee;
    const remainingPercent = Math.max(0, targetTotal - downPercent);
    const equalShare = Number((remainingPercent / count).toFixed(2));

    const newConfigs: PlanInstallmentConfig[] = [];
    for (let i = 1; i <= count; i++) {
      const offset = i * interval;
      // Put tiny remainder difference on last installment
      const isLast = i === count;
      const share = isLast
        ? Number((remainingPercent - equalShare * (count - 1)).toFixed(2))
        : equalShare;

      newConfigs.push({
        id: `cfg-${Date.now()}-${i}`,
        title: `قسط ${toPersianDigits(i)} (ماه ${toPersianDigits(offset)})`,
        percent: share,
        dueMonthOffset: offset,
      });
    }
    setFormInstallmentConfigs(newConfigs);
  };

  const handleUpdateConfigPercent = (id: string, newPercent: number) => {
    setFormInstallmentConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, percent: newPercent } : c))
    );
  };

  const handleUpdateConfigOffset = (id: string, newOffset: number) => {
    setFormInstallmentConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, dueMonthOffset: newOffset } : c))
    );
  };

  const handleUpdateConfigTitle = (id: string, newTitle: string) => {
    setFormInstallmentConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
  };

  // Validation calculations
  const totalInstallmentPercent = formInstallmentConfigs.reduce((sum, c) => sum + (c.percent || 0), 0);
  const totalCalculatedPercent = Number((formDownPaymentPercent + totalInstallmentPercent).toFixed(2));
  const expectedTotalPercent = 100 + formFeePercent;
  const isPercentBalanced = Math.abs(totalCalculatedPercent - expectedTotalPercent) < 0.1;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formTitle.trim()) {
      setFormError('لطفاً عنوان پلن پرداخت را وارد کنید');
      return;
    }

    if (formInstallmentsCount > 0 && !isPercentBalanced) {
      setFormError(
        `مجموع درصدها (${toPersianDigits(totalCalculatedPercent)}٪) با درصد نهایی مورد انتظار (${toPersianDigits(
          expectedTotalPercent
        )}٪ = ۱۰۰٪ + ${toPersianDigits(formFeePercent)}٪ کارمزد) برابر نیست.`
      );
      return;
    }

    const newPlan: PaymentPlanTemplate = {
      id: editingPlan ? editingPlan.id : `plan-${Date.now()}`,
      title: formTitle.trim(),
      description: formDesc.trim(),
      feePercent: formFeePercent,
      downPaymentPercent: formDownPaymentPercent,
      intervalMonths: formIntervalMonths,
      installmentsCount: formInstallmentsCount,
      installmentsConfig: formInstallmentConfigs,
    };

    if (editingPlan) {
      updatePaymentPlan(newPlan);
      showToast(`پلن «${newPlan.title}» با موفقیت ویرایش شد`, 'success');
    } else {
      addPaymentPlan(newPlan);
      showToast(`پلن پرداخت جدید «${newPlan.title}» افزوده شد`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    deletePaymentPlan(id);
    showToast('پلن پرداخت حذف شد', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-heading text-[#0A3528]">مدیریت پلن‌های پرداخت و تقسیط مالی</h2>
          <p className="text-xs text-slate-500 mt-1">
            تعریف الگوهای پرداخت اقساطی منعطف، درصدهای بیعانه اولیه، سود/کارمزد و بازه‌های زمانی پرداخت (ماهانه، دو ماه یکبار و...)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetPaymentPlans();
              showToast('پلن‌های پرداخت به الگوهای پیش‌فرض بازنشانی شدند', 'info');
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <IconRefresh size={14} />
            <span>بازنشانی پلن‌ها</span>
          </button>
          <button
            type="button"
            onClick={() => openForm()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-lg hover:bg-[#D94816] transition-colors shadow-xs"
          >
            <IconPlus size={16} />
            <span>تعریف پلن پرداخت جدید</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {paymentPlans.map((plan) => {
          const totalPct = 100 + plan.feePercent;
          return (
            <div
              key={plan.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
            >
              <div>
                {/* Title & Actions */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-base font-bold text-[#162E6E] leading-tight">
                      {plan.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0E7C5B]">
                        {plan.feePercent === 0
                          ? 'بدون کارمزد (۰٪)'
                          : `کارمزد/سود: +${toPersianDigits(plan.feePercent)}٪`}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">
                        مجموع: {toPersianDigits(totalPct)}٪
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openForm(plan)}
                      className="p-1.5 text-slate-400 hover:text-[#0E7C5B] hover:bg-slate-100 rounded-lg transition-colors"
                      title="ویرایش پلن"
                    >
                      <IconEdit size={16} />
                    </button>
                    {!plan.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(plan.id)}
                        className="p-1.5 text-slate-400 hover:text-[#D64545] hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف پلن"
                      >
                        <IconTrash size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {plan.description && (
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    {plan.description}
                  </p>
                )}

                {/* Breakdown List */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                    <span className="text-slate-600 font-medium">بیعانه / پیش‌پرداخت اولیه:</span>
                    <strong className="text-[#0E7C5B]">
                      {toPersianDigits(plan.downPaymentPercent)}٪
                    </strong>
                  </div>

                  {plan.installmentsCount === 0 ? (
                    <div className="text-slate-500 text-[11px]">تسویه ۱۰۰٪ در زمان ثبت‌نام</div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-semibold text-slate-600">
                        اقساط ({toPersianDigits(plan.installmentsCount)} قسط ·{' '}
                        {plan.intervalMonths === 1
                          ? 'ماهانه'
                          : plan.intervalMonths === 2
                          ? 'دو ماه یکبار'
                          : `هر ${toPersianDigits(plan.intervalMonths)} ماه`}):
                      </div>
                      <div className="space-y-1 pr-1">
                        {plan.installmentsConfig.map((cfg, i) => (
                          <div
                            key={cfg.id || i}
                            className="flex items-center justify-between text-[11px] text-slate-600 bg-white p-1.5 rounded-lg border border-slate-200/60"
                          >
                            <span>{cfg.title}</span>
                            <span className="font-bold text-[#0A3528]">
                              {toPersianDigits(cfg.percent)}٪
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sample Simulation */}
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>نمونه برای شهریه ۱۰ میلیون:</span>
                <span className="font-bold text-[#0A3528]">
                  {formatToman((10000000 * totalPct) / 100)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Modal: Add / Edit Payment Plan                                 */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlan ? 'ویرایش پلن پرداخت اقساطی' : 'تعریف پلن پرداخت اقساطی جدید'}
        maxWidth="3xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-[#D64545] rounded-xl text-xs flex items-center gap-2">
              <IconAlert size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <Field label="عنوان پلن پرداخت" required>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="مثلاً: پلن سه ماهه با کارمزد ۷٪ (دو ماه یکبار)"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              />
            </Field>

            {/* Fee / Interest Rate */}
            <Field
              label="درصد سود یا کارمزد پلن (٪)"
              required
              hint="صفر برای پلن‌های بدون کارمزد، مثلاً ۷٪"
            >
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={formFeePercent}
                  onChange={(e) => {
                    const fee = Number(e.target.value) || 0;
                    setFormFeePercent(fee);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white text-right"
                />
              </div>
            </Field>

            {/* Down Payment Percent */}
            <Field label="درصد بیعانه اولیه / پیش‌پرداخت (٪)" required hint="مثلاً ۳۵٪">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={formDownPaymentPercent}
                onChange={(e) => {
                  const dp = Number(e.target.value) || 0;
                  setFormDownPaymentPercent(dp);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white text-right"
              />
            </Field>

            {/* Interval in Months */}
            <Field label="دوره بازپرداخت اقساط" required>
              <select
                value={formIntervalMonths}
                onChange={(e) => {
                  const intv = Number(e.target.value) || 1;
                  setFormIntervalMonths(intv);
                  handleRegenerateConfigs(formInstallmentsCount, intv, formDownPaymentPercent, formFeePercent);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
              >
                <option value={1}>ماهانه (هر ۱ ماه یک قسط)</option>
                <option value={2}>دو ماه یکبار (هر ۲ ماه یک قسط)</option>
                <option value={3}>فصلی (هر ۳ ماه یک قسط)</option>
                <option value={4}>هر ۴ ماه یک قسط</option>
                <option value={6}>شش ماهه (نیم‌سال)</option>
              </select>
            </Field>

            {/* Installments Count */}
            <div>
              <Field label="تعداد اقساط (به جز بیعانه)" required hint="صفر برای تسویه نقدی">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="36"
                    value={formInstallmentsCount}
                    onChange={(e) => {
                      const count = Number(e.target.value) || 0;
                      setFormInstallmentsCount(count);
                      handleRegenerateConfigs(count, formIntervalMonths, formDownPaymentPercent, formFeePercent);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white text-center"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleRegenerateConfigs(
                        formInstallmentsCount,
                        formIntervalMonths,
                        formDownPaymentPercent,
                        formFeePercent
                      )
                    }
                    className="px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg shrink-0"
                    title="محاسبه و تقسیم مساوی درصدها"
                  >
                    توزیع خودکار
                  </button>
                </div>
              </Field>
            </div>

            {/* Description */}
            <div>
              <Field label="توضیحات پلن (اختیاری)">
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="شرایط ویژه، دوره بازپرداخت و..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0E7C5B] focus:bg-white"
                />
              </Field>
            </div>
          </div>

          {/* Installment Percentages & Due Offsets Editor */}
          {formInstallmentsCount > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-[#0A3528]">
                    تنظیم تفکیکی درصد و سررسید هر قسط
                  </label>
                  <span className="text-[11px] text-slate-500 block">
                    می‌توانید درصد پرداختی هر قسط را به صورت دستی یا سفارشی تعیین فرمایید
                  </span>
                </div>
                <div
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                    isPercentBalanced
                      ? 'bg-emerald-50 text-[#0E7C5B] border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}
                >
                  <span>مجموع درصدها:</span>
                  <span>{toPersianDigits(totalCalculatedPercent)}٪</span>
                  <span>از {toPersianDigits(expectedTotalPercent)}٪</span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto p-1">
                {formInstallmentConfigs.map((cfg, index) => (
                  <div
                    key={cfg.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center text-xs"
                  >
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">عنوان قسط:</label>
                      <input
                        type="text"
                        value={cfg.title}
                        onChange={(e) => handleUpdateConfigTitle(cfg.id, e.target.value)}
                        className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-md focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">درصد از شهریه پایه (٪):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cfg.percent}
                        onChange={(e) => handleUpdateConfigPercent(cfg.id, Number(e.target.value) || 0)}
                        className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-md focus:outline-hidden text-center font-bold text-[#0A3528]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">سررسید (چند ماه پس از ثبت‌نام):</label>
                      <input
                        type="number"
                        min="1"
                        max="36"
                        value={cfg.dueMonthOffset}
                        onChange={(e) => handleUpdateConfigOffset(cfg.id, Number(e.target.value) || 1)}
                        className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-md focus:outline-hidden text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Simulation Box */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs space-y-2.5">
            <div className="flex items-center justify-between font-bold text-[#0A3528]">
              <span>پیش‌نمایش زنده محاسبه برای شهریه نمونه:</span>
              <div className="flex items-center gap-1.5 font-normal">
                <span className="text-[11px] text-slate-500">مبلغ شهریه:</span>
                <input
                  type="number"
                  step="1000000"
                  value={simTuition}
                  onChange={(e) => setSimTuition(Number(e.target.value) || 0)}
                  className="w-28 px-2 py-0.5 bg-white border border-slate-200 rounded text-center text-xs"
                />
                <span>تومان</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-400 block">شهریه پایه:</span>
                <strong className="text-slate-800">{formatToman(simTuition)}</strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-400 block">
                  کارمزد ({toPersianDigits(formFeePercent)}٪):
                </span>
                <strong className="text-amber-800">
                  {formatToman((simTuition * formFeePercent) / 100)}
                </strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-400 block">کل قرارداد:</span>
                <strong className="text-[#0A3528]">
                  {formatToman((simTuition * expectedTotalPercent) / 100)}
                </strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-400 block">
                  بیعانه ({toPersianDigits(formDownPaymentPercent)}٪):
                </span>
                <strong className="text-[#0E7C5B]">
                  {formatToman((simTuition * formDownPaymentPercent) / 100)}
                </strong>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0E7C5B] rounded-lg hover:bg-[#0A3528] transition-colors shadow-xs"
            >
              {editingPlan ? 'ذخیره تغییرات پلن' : 'ثبت پلن پرداخت'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="حذف پلن پرداخت"
        description="آیا از حذف این پلن پرداخت اطمینان دارید؟"
        confirmText="بله، حذف پلن"
        cancelText="انصراف"
      />
    </div>
  );
};
