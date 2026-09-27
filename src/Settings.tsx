/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { FieldSettings, PaymentPlanTemplate } from './types';

const STORAGE_KEY = 'helli_field_settings_v1';
const GRADES_STORAGE_KEY = 'helli_grades_list_v1';
const PLANS_STORAGE_KEY = 'helli_payment_plans_v1';

export const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  firstName: true,
  lastName: true,
  fatherName: true,
  nationalId: true,
  grade: true,
  gpa: true,
  school: true,
  phones: true,
};

export const DEFAULT_GRADES: string[] = ['ششم', 'هفتم', 'هشتم', 'نهم'];

export const DEFAULT_PAYMENT_PLANS: PaymentPlanTemplate[] = [
  {
    id: 'plan-cash',
    title: 'تسویه کامل نقدی (بدون کارمزد)',
    description: 'پرداخت یکجای کل مبلغ شهریه بدون هیچ‌گونه سود یا کارمزد اضافی (۱۰۰٪ نقدی)',
    feePercent: 0,
    downPaymentPercent: 100,
    intervalMonths: 0,
    installmentsCount: 0,
    installmentsConfig: [],
    isDefault: true,
  },
  {
    id: 'plan-3m-standard',
    title: 'پلن ۳ ماهه استاندارد (بدون کارمزد)',
    description: '۳۰٪ بیعانه اولیه نقدی + ۳ قسط مساوی ماهانه (مجموع ۱۰۰٪ شهریه بدون سود)',
    feePercent: 0,
    downPaymentPercent: 30,
    intervalMonths: 1,
    installmentsCount: 3,
    installmentsConfig: [
      { id: 'cfg-1', title: 'قسط اول (ماه اول)', percent: 23.33, dueMonthOffset: 1 },
      { id: 'cfg-2', title: 'قسط دوم (ماه دوم)', percent: 23.33, dueMonthOffset: 2 },
      { id: 'cfg-3', title: 'قسط سوم (ماه سوم)', percent: 23.34, dueMonthOffset: 3 },
    ],
  },
  {
    id: 'plan-bimonthly-7',
    title: 'پلن سفارشی دو ماه یکبار (کارمزد ۷٪)',
    description: '۳۵٪ بیعانه اولیه + ۲ قسط هر دو ماه یکبار (هر قسط ۳۶٪، مجموع پرداختی ۱۰۷٪)',
    feePercent: 7,
    downPaymentPercent: 35,
    intervalMonths: 2,
    installmentsCount: 2,
    installmentsConfig: [
      { id: 'cfg-bm-1', title: 'قسط اول (پایان ماه دوم)', percent: 36, dueMonthOffset: 2 },
      { id: 'cfg-bm-2', title: 'قسط دوم (پایان ماه چهارم)', percent: 36, dueMonthOffset: 4 },
    ],
  },
  {
    id: 'plan-6m-5',
    title: 'پلن ۶ ماهه جامع (کارمزد ۵٪)',
    description: '۲۵٪ بیعانه اولیه + ۵ قسط ماهانه هر کدام ۱۶٪ (مجموع پرداختی ۱۰۵٪)',
    feePercent: 5,
    downPaymentPercent: 25,
    intervalMonths: 1,
    installmentsCount: 5,
    installmentsConfig: [
      { id: 'cfg-6m-1', title: 'قسط اول (ماه اول)', percent: 16, dueMonthOffset: 1 },
      { id: 'cfg-6m-2', title: 'قسط دوم (ماه دوم)', percent: 16, dueMonthOffset: 2 },
      { id: 'cfg-6m-3', title: 'قسط سوم (ماه سوم)', percent: 16, dueMonthOffset: 3 },
      { id: 'cfg-6m-4', title: 'قسط چهارم (ماه چهارم)', percent: 16, dueMonthOffset: 4 },
      { id: 'cfg-6m-5', title: 'قسط پنجم (ماه پنجم)', percent: 16, dueMonthOffset: 5 },
    ],
  },
];

interface SettingsContextValue {
  fieldSettings: FieldSettings;
  updateFieldSetting: (field: keyof FieldSettings, isRequired: boolean) => void;
  resetFieldSettings: () => void;
  saveFieldSettings: (newSettings: FieldSettings) => void;
  grades: string[];
  addGrade: (name: string) => { success: boolean; message: string };
  removeGrade: (name: string) => { success: boolean; message: string };
  reorderGrades: (newGrades: string[]) => void;
  resetGrades: () => void;
  paymentPlans: PaymentPlanTemplate[];
  addPaymentPlan: (plan: PaymentPlanTemplate) => void;
  updatePaymentPlan: (plan: PaymentPlanTemplate) => void;
  deletePaymentPlan: (planId: string) => void;
  resetPaymentPlans: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useFieldSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useFieldSettings must be used within SettingsProvider');
  }
  return ctx;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fieldSettings, setFieldSettings] = useState<FieldSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_FIELD_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error loading settings', e);
    }
    return DEFAULT_FIELD_SETTINGS;
  });

  const [grades, setGrades] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(GRADES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading grades', e);
    }
    return DEFAULT_GRADES;
  });

  const [paymentPlans, setPaymentPlans] = useState<PaymentPlanTemplate[]>(() => {
    try {
      const stored = localStorage.getItem(PLANS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading payment plans', e);
    }
    return DEFAULT_PAYMENT_PLANS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fieldSettings));
    } catch (e) {
      console.error('Error saving settings', e);
    }
  }, [fieldSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(GRADES_STORAGE_KEY, JSON.stringify(grades));
    } catch (e) {
      console.error('Error saving grades', e);
    }
  }, [grades]);

  useEffect(() => {
    try {
      localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(paymentPlans));
    } catch (e) {
      console.error('Error saving payment plans', e);
    }
  }, [paymentPlans]);

  const updateFieldSetting = (field: keyof FieldSettings, isRequired: boolean) => {
    setFieldSettings((prev) => ({ ...prev, [field]: isRequired }));
  };

  const saveFieldSettings = (newSettings: FieldSettings) => {
    setFieldSettings(newSettings);
  };

  const resetFieldSettings = () => {
    setFieldSettings(DEFAULT_FIELD_SETTINGS);
  };

  const addGrade = (name: string): { success: boolean; message: string } => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: 'نام پایه تحصیلی نمی‌تواند خالی باشد' };
    }
    if (grades.includes(trimmed)) {
      return { success: false, message: `پایه تحصیلی «${trimmed}» از قبل وجود دارد` };
    }
    setGrades((prev) => [...prev, trimmed]);
    return { success: true, message: `پایه تحصیلی «${trimmed}» با موفقیت افزوده شد` };
  };

  const removeGrade = (name: string): { success: boolean; message: string } => {
    if (grades.length <= 1) {
      return { success: false, message: 'حداقل یک پایه تحصیلی در سامانه باید فعال باشد' };
    }
    setGrades((prev) => prev.filter((g) => g !== name));
    return { success: true, message: `پایه «${name}» با موفقیت حذف شد` };
  };

  const reorderGrades = (newGrades: string[]) => {
    setGrades(newGrades);
  };

  const resetGrades = () => {
    setGrades(DEFAULT_GRADES);
  };

  const addPaymentPlan = (plan: PaymentPlanTemplate) => {
    setPaymentPlans((prev) => [...prev, plan]);
  };

  const updatePaymentPlan = (plan: PaymentPlanTemplate) => {
    setPaymentPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
  };

  const deletePaymentPlan = (planId: string) => {
    setPaymentPlans((prev) => prev.filter((p) => p.id !== planId));
  };

  const resetPaymentPlans = () => {
    setPaymentPlans(DEFAULT_PAYMENT_PLANS);
  };

  return (
    <SettingsContext.Provider
      value={{
        fieldSettings,
        updateFieldSetting,
        resetFieldSettings,
        saveFieldSettings,
        grades,
        addGrade,
        removeGrade,
        reorderGrades,
        resetGrades,
        paymentPlans,
        addPaymentPlan,
        updatePaymentPlan,
        deletePaymentPlan,
        resetPaymentPlans,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const FieldSettingsProvider = SettingsProvider;

