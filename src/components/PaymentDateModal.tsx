/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared "ثبت وصول و پرداخت قسط" modal (HI-4).
 *
 * Single source of truth for recording an installment payment with a Jalali
 * payment date, used by both Finance.tsx and the printable receipt in
 * Registrations.tsx so that the same financial action behaves identically
 * everywhere.
 */

import React, { useState } from 'react';
import { getTodayJalali, formatToman, toPersianDigits } from '../utils';
import { Modal } from '../ui';
import { JalaliDatePicker } from '../JalaliDatePicker';

export interface PaymentDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Student full name (or 'نامشخص'). */
  studentName: string;
  /** Installment title, e.g. "قسط ۲". */
  installmentTitle: string;
  /** Installment amount in Toman. */
  amount: number;
  /** Original due date (Jalali string). */
  dueDate: string;
  /** Called with the chosen Jalali payment date on confirm. */
  onConfirm: (paidAt: string) => void;
}

export const PaymentDateModal: React.FC<PaymentDateModalProps> = ({
  isOpen,
  onClose,
  studentName,
  installmentTitle,
  amount,
  dueDate,
  onConfirm,
}) => {
  const [paymentDate, setPaymentDate] = useState<string>(getTodayJalali());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(paymentDate || getTodayJalali());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ثبت وصول و پرداخت قسط" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span>دانش‌آموز:</span>
            <span className="font-bold text-slate-800">{studentName}</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>عنوان و مبلغ قسط:</span>
            <span className="font-bold text-[#0A3528]">
              {installmentTitle} - {formatToman(amount)}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>تاریخ سررسید اولیه:</span>
            <span className="font-mono text-slate-700">{toPersianDigits(dueDate)}</span>
          </div>
        </div>

        <div>
          <JalaliDatePicker
            label="تاریخ وصول و پرداخت (شمسی)"
            value={paymentDate}
            onChange={(d) => setPaymentDate(d || getTodayJalali())}
            clearable={false}
            required={true}
            showHumanPreview={true}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-[#0E7C5B] hover:bg-[#0A3528] rounded-lg transition-colors shadow-xs"
          >
            تأیید و ثبت وصول
          </button>
        </div>
      </form>
    </Modal>
  );
};
