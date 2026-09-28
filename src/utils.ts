/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Installment, PaymentPlan, PaymentPlanTemplate } from './types';


// Convert English numbers to Persian numerals
export function toPersianDigits(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return '';
  const str = String(n);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

// Convert Persian digits to English numerals for parsing
export function toEnglishDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

// Format numbers with comma separation and Persian digits
export function formatNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return '۰';
  const num = typeof n === 'number' ? n : parseFloat(toEnglishDigits(String(n)));
  if (isNaN(num)) return '۰';
  const parts = Math.round(num).toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toPersianDigits(parts.join('.'));
}

// Format Toman currency
export function formatToman(amount: number | string | undefined | null): string {
  return `${formatNumber(amount)} تومان`;
}

// Calculate class duration from start and end time (e.g. 16:00 to 17:30)
export function calculateClassDuration(startTime: string, endTime: string): {
  minutes: number;
  formatted: string;
  isValid: boolean;
} {
  const cleanStart = toEnglishDigits(startTime).trim();
  const cleanEnd = toEnglishDigits(endTime).trim();

  const startParts = cleanStart.split(':').map((p) => parseInt(p, 10));
  const endParts = cleanEnd.split(':').map((p) => parseInt(p, 10));

  if (
    startParts.length !== 2 ||
    endParts.length !== 2 ||
    isNaN(startParts[0]) ||
    isNaN(startParts[1]) ||
    isNaN(endParts[0]) ||
    isNaN(endParts[1])
  ) {
    return { minutes: 0, formatted: 'نامشخص', isValid: false };
  }

  const startTotalMinutes = startParts[0] * 60 + startParts[1];
  let endTotalMinutes = endParts[0] * 60 + endParts[1];

  if (endTotalMinutes <= startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }

  const diffMinutes = endTotalMinutes - startTotalMinutes;
  if (diffMinutes <= 0 || diffMinutes > 720) {
    return { minutes: 0, formatted: 'نامعتبر', isValid: false };
  }

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;

  let formatted = '';
  if (hours > 0 && mins > 0) {
    formatted = `${toPersianDigits(hours)} ساعت و ${toPersianDigits(mins)} دقیقه`;
  } else if (hours > 0) {
    formatted = `${toPersianDigits(hours)} ساعت`;
  } else {
    formatted = `${toPersianDigits(mins)} دقیقه`;
  }

  return {
    minutes: diffMinutes,
    formatted,
    isValid: true,
  };
}

// Mobile phone validation
export function validateIranianMobile(input: string): { isValid: boolean; message: string } {

  const cleaned = toEnglishDigits(input).trim().replace(/[\s-]/g, '');
  if (!cleaned) {
    return { isValid: false, message: 'شماره موبایل الزامی است' };
  }
  if (!/^09\d*$/.test(cleaned)) {
    if (!cleaned.startsWith('09')) {
      return { isValid: false, message: 'شماره باید با ۰۹ شروع شود' };
    }
  }
  if (cleaned.length < 11) {
    return {
      isValid: false,
      message: `شماره باید ۱۱ رقم باشد (الان ${toPersianDigits(cleaned.length)} رقم)`,
    };
  }
  if (cleaned.length > 11) {
    return {
      isValid: false,
      message: `شماره بیش از ۱۱ رقم است (الان ${toPersianDigits(cleaned.length)} رقم)`,
    };
  }
  if (!/^09[0-9]{9}$/.test(cleaned)) {
    return { isValid: false, message: 'فرمت شماره نامعتبر است' };
  }
  return { isValid: true, message: '' };
}

// National ID validation
export function validateNationalId(input: string): { isValid: boolean; message: string } {
  const cleaned = toEnglishDigits(input).trim();
  if (!cleaned) {
    return { isValid: false, message: 'کد ملی الزامی است' };
  }
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, message: 'کد ملی فقط باید شامل اعداد باشد' };
  }
  if (cleaned.length !== 10) {
    return {
      isValid: false,
      message: `کد ملی باید دقیقاً ۱۰ رقم باشد (الان ${toPersianDigits(cleaned.length)} رقم)`,
    };
  }

  // Check repeating digits like 1111111111
  if (/^(\d)\1{9}$/.test(cleaned)) {
    return { isValid: false, message: 'کد ملی نامعتبر است' };
  }

  const check = parseInt(cleaned[9], 10);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i], 10) * (10 - i);
  }
  const rem = sum % 11;
  const valid = (rem < 2 && check === rem) || (rem >= 2 && check === 11 - rem);

  if (!valid) {
    return { isValid: false, message: 'کد ملی با الگوریتم استاندارد همخوانی ندارد' };
  }

  return { isValid: true, message: '' };
}

// -------------------------------------------------------------
// Accurate Jalali <-> Gregorian Date Algorithms
// -------------------------------------------------------------
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy: number;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 0; gm < 13; gm++) {
    const v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return [gy, gm, gd];
}

// HI-6: "today" must be computed from the real system clock.
// The previous implementation returned a hardcoded constant ('1403-07-06'), which made every
// overdue calculation (isOverdue/daysOverdue), default dates, date-range presets and calendar
// year options silently wrong in production.
// For demos/tests you may pin the value via the VITE_DEMO_TODAY env variable (format YYYY/MM/DD);
// it is validated with parseJalaliDate and ignored if malformed.
let demoTodayWarned = false;
export function getTodayJalali(): string {
  const demoToday = (import.meta as any)?.env?.VITE_DEMO_TODAY as string | undefined;
  if (demoToday) {
    const parsed = parseJalaliDate(demoToday);
    if (parsed) {
      return formatJalaliDate(parsed.year, parsed.month, parsed.day);
    }
    if (!demoTodayWarned && typeof console !== 'undefined') {
      demoTodayWarned = true;
      console.warn(
        `VITE_DEMO_TODAY="${demoToday}" is not a valid Jalali date (expected YYYY/MM/DD). Falling back to the real system date.`
      );
    }
  }
  const d = new Date();
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return formatJalaliDate(jy, jm, jd);
}

// Academic year (Persian calendar) containing a Jalali date. The Iranian school
// year starts in Mehr (month 7): 1404/05/20 -> «۱۴۰۳-۱۴۰۴», 1404/08/01 -> «۱۴۰۴-۱۴۰۵».
export function jalaliAcademicYearParts(jy: number, jm: number): [number, number] {
  const startYear = jm >= 7 ? jy : jy - 1;
  return [startYear, startYear + 1];
}

export function jalaliAcademicYearLabel(dateStr?: string): string {
  const parsed = parseJalaliDate(dateStr || getTodayJalali());
  if (!parsed) return '';
  const [s, e] = jalaliAcademicYearParts(parsed.year, parsed.month);
  return `${toPersianDigits(s)}-${toPersianDigits(e)}`;
}

export const PERSIAN_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const PERSIAN_DAY_NAMES = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

export const PERSIAN_DAY_SHORT_NAMES = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// Check if a Jalali year is a leap year (سال کبیسه ۳۰ روزه اسفند)
export function isLeapJalaliYear(jy: number): boolean {
  const [gy, gm, gd] = jalaliToGregorian(jy, 12, 30);
  const [backJy, backJm, backJd] = gregorianToJalali(gy, gm, gd);
  return backJy === jy && backJm === 12 && backJd === 30;
}

// Get exact number of days in a Jalali month (1-6: 31, 7-11: 30, 12: 29 or 30 if leap)
export function getDaysInJalaliMonth(year: number, month: number): number {
  if (month >= 1 && month <= 6) return 31;
  if (month >= 7 && month <= 11) return 30;
  if (month === 12) return isLeapJalaliYear(year) ? 30 : 29;
  return 30;
}

// Get day of week for the 1st day of a Jalali month (0: شنبه, 1: یکشنبه, ..., 6: جمعه)
export function getFirstDayOfJalaliMonth(year: number, month: number): number {
  const [gy, gm, gd] = jalaliToGregorian(year, month, 1);
  const d = new Date(gy, gm - 1, gd, 12, 0, 0);
  return (d.getDay() + 1) % 7;
}

// Get day of week for any Jalali date (0: شنبه, 1: یکشنبه, ..., 6: جمعه)
export function getJalaliDayOfWeek(year: number, month: number, day: number): number {
  const [gy, gm, gd] = jalaliToGregorian(year, month, day);
  const d = new Date(gy, gm - 1, gd, 12, 0, 0);
  return (d.getDay() + 1) % 7;
}

// Format date parts into YYYY/MM/DD
export function formatJalaliDate(year: number, month: number, day: number): string {
  const sm = month < 10 ? `0${month}` : `${month}`;
  const sd = day < 10 ? `0${day}` : `${day}`;
  return `${year}/${sm}/${sd}`;
}

// Parse a Jalali string YYYY/MM/DD or YYYY-MM-DD
export function parseJalaliDate(
  str: string | undefined | null
): { year: number; month: number; day: number } | null {
  if (!str) return null;
  const eng = toEnglishDigits(str).trim();
  const parts = eng.split(/[/\\-]/).map((p) => parseInt(p, 10));
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  const [year, month, day] = parts;
  if (year < 1300 || year > 1500) return null;
  if (month < 1 || month > 12) return null;
  const maxDays = getDaysInJalaliMonth(year, month);
  if (day < 1 || day > maxDays) return null;
  return { year, month, day };
}

// Validate a Jalali date string
export function isValidJalaliDate(str: string): boolean {
  return parseJalaliDate(str) !== null;
}

export function formatJalaliHuman(jalaliStr: string): string {
  if (!jalaliStr) return '';
  const parsed = parseJalaliDate(jalaliStr);
  if (!parsed) return jalaliStr;
  const { year, month, day } = parsed;
  const monthName = PERSIAN_MONTH_NAMES[month - 1] || '';
  const dayOfWeek = getJalaliDayOfWeek(year, month, day);
  const dayName = PERSIAN_DAY_NAMES[dayOfWeek] || '';
  return `${dayName}، ${toPersianDigits(day)} ${monthName} ${toPersianDigits(year)}`;
}

// Add months to a Jalali string YYYY/MM/DD
export function addMonthsJalali(jalaliStr: string, monthsToAdd: number): string {
  const parsed = parseJalaliDate(jalaliStr);
  if (!parsed) return jalaliStr;
  let { year, month, day } = parsed;

  month += monthsToAdd;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }

  // Adjust day for months with less days respecting leap years!
  const maxDays = getDaysInJalaliMonth(year, month);
  if (day > maxDays) day = maxDays;

  return formatJalaliDate(year, month, day);
}

// Add or subtract exact days to a Jalali date string YYYY/MM/DD
export function addDaysJalali(jalaliStr: string, days: number): string {
  const parsed = parseJalaliDate(jalaliStr);
  if (!parsed) return jalaliStr;
  const [gy, gm, gd] = jalaliToGregorian(parsed.year, parsed.month, parsed.day);
  const d = new Date(gy, gm - 1, gd, 12, 0, 0);
  d.setDate(d.getDate() + days);
  const [ny, nm, nd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return formatJalaliDate(ny, nm, nd);
}

// Convert Jalali string to Date object for comparison
export function jalaliToDate(jalaliStr: string): Date {
  const eng = toEnglishDigits(jalaliStr);
  const parts = eng.split('/').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || isNaN(parts[0])) return new Date();
  const [gy, gm, gd] = jalaliToGregorian(parts[0], parts[1], parts[2]);
  return new Date(gy, gm - 1, gd, 12, 0, 0);
}

// Check if an installment is overdue
export function isOverdue(dueDate: string, paidAt: string | null): boolean {
  if (paidAt) return false;
  const today = getTodayJalali();
  return dueDate < today;
}

// Calculate days overdue
export function daysOverdue(dueDate: string): number {
  const today = getTodayJalali();
  if (dueDate >= today) return 0;
  const d1 = jalaliToDate(dueDate);
  const d2 = jalaliToDate(today);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// -------------------------------------------------------------
// Installment Plan Builder
// -------------------------------------------------------------
export function buildPlan(
  tuition: number,
  discount: number,
  downPayment: number,
  months: number,
  startDate?: string
): PaymentPlan {
  const netAmount = Math.max(0, tuition - discount);
  const baseDate = startDate || getTodayJalali();

  // Cash payment (نقدی)
  if (months <= 0) {
    return {
      months: 0,
      downPayment: netAmount,
      installments: [
        {
          id: `inst-${Date.now()}-cash`,
          title: 'تسویه کامل نقدی',
          amount: netAmount,
          dueDate: baseDate,
          paidAt: null,
        },
      ],
    };
  }

  // Installment plan
  const sanitizedDown = Math.min(downPayment, netAmount);
  const remaining = netAmount - sanitizedDown;
  const perMonth = Math.floor(remaining / months);
  const installments: Installment[] = [];

  if (sanitizedDown > 0) {
    installments.push({
      id: `inst-${Date.now()}-0`,
      title: 'پیش‌پرداخت',
      amount: sanitizedDown,
      dueDate: baseDate,
      paidAt: null,
    });
  }

  for (let i = 1; i <= months; i++) {
    // Distribute remainder on the last installment
    const isLast = i === months;
    const amount = isLast ? remaining - perMonth * (months - 1) : perMonth;
    installments.push({
      id: `inst-${Date.now()}-${i}`,
      title: `قسط ${toPersianDigits(i)}`,
      amount,
      dueDate: addMonthsJalali(baseDate, i),
      paidAt: null,
    });
  }

  return {
    months,
    downPayment: sanitizedDown,
    installments,
  };
}

// -------------------------------------------------------------
// Installment Plan Builder from Template
// -------------------------------------------------------------
export function buildPlanFromTemplate(
  template: PaymentPlanTemplate,
  tuition: number,
  discount: number,
  startDate?: string
): PaymentPlan {
  const baseAmount = Math.max(0, tuition - discount);
  const baseDate = startDate || getTodayJalali();

  // If cash or 0 installments
  if (template.installmentsCount === 0 || template.installmentsConfig.length === 0) {
    const feeAmount = Math.round((baseAmount * template.feePercent) / 100);
    const totalAmount = baseAmount + feeAmount;
    return {
      templateId: template.id,
      templateTitle: template.title,
      months: 0,
      feePercent: template.feePercent,
      feeAmount,
      baseAmount,
      totalAmount,
      downPayment: totalAmount,
      installments: [
        {
          id: `inst-${Date.now()}-cash`,
          title: 'تسویه کامل نقدی',
          amount: totalAmount,
          dueDate: baseDate,
          paidAt: null,
          percent: 100 + template.feePercent,
        },
      ],
    };
  }

  const feeAmount = Math.round((baseAmount * template.feePercent) / 100);
  const totalAmount = baseAmount + feeAmount;

  // Down payment calculation
  const downPaymentAmount = Math.round((baseAmount * template.downPaymentPercent) / 100);
  const installments: Installment[] = [];

  if (downPaymentAmount > 0) {
    installments.push({
      id: `inst-${Date.now()}-dp`,
      title: `بیعانه اولیه (${toPersianDigits(template.downPaymentPercent)}٪)`,
      amount: downPaymentAmount,
      dueDate: baseDate,
      paidAt: null,
      percent: template.downPaymentPercent,
    });
  }

  // Calculate installments from config
  template.installmentsConfig.forEach((cfg, idx) => {
    const amount = Math.round((baseAmount * cfg.percent) / 100);
    const offset = cfg.dueMonthOffset || (idx + 1) * template.intervalMonths;
    const dueDate = addMonthsJalali(baseDate, offset);
    installments.push({
      id: `inst-${Date.now()}-${idx + 1}`,
      title: cfg.title || `قسط ${toPersianDigits(idx + 1)} (${toPersianDigits(cfg.percent)}٪)`,
      amount,
      dueDate,
      paidAt: null,
      percent: cfg.percent,
    });
  });

  const lastOffset = template.installmentsConfig[template.installmentsConfig.length - 1]?.dueMonthOffset ||
    template.installmentsCount * template.intervalMonths;

  return {
    templateId: template.id,
    templateTitle: template.title,
    months: lastOffset,
    feePercent: template.feePercent,
    feeAmount,
    baseAmount,
    totalAmount,
    downPayment: downPaymentAmount,
    installments,
  };
}

// -------------------------------------------------------------
// CSV Export & Import Utilities
// -------------------------------------------------------------
export function downloadCSV(filename: string, content: string) {
  // UTF-8 BOM for Persian characters in Excel
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
