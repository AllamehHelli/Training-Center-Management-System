/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StudentGrade = 'ششم' | 'هفتم' | 'هشتم' | 'نهم' | string;

export interface PhoneNumber {
  id: string;
  label: string; // e.g. پدر، مادر، ولی، منزل، دانش‌آموز
  number: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  nationalId: string; // 10 digits
  phones: PhoneNumber[];
  grade: StudentGrade;
  gpa: number; // 0 to 20
  school: string;
  createdAt: string; // Jalali or ISO
}

export type SessionKind = 'even' | 'odd' | 'custom';

export interface ClassSession {
  id: string;
  kind: SessionKind;
  label: string; // e.g. زنگ صبح زوج، زنگ عصر فرد
  days: string;  // e.g. شنبه، دوشنبه، چهارشنبه
  time: string;  // e.g. ۱۶:۰۰ الی ۱۷:۳۰
  startTime?: string; // e.g. 16:00
  endTime?: string;   // e.g. 17:30
  durationMinutes?: number; // e.g. 90
  capacity: number;
}

export interface ClassRoom {
  id: string;
  name: string;
  grade: StudentGrade;
  teacher: string;
  sessions: ClassSession[];
  tuition: number; // in Tomans
}

export interface Installment {
  id: string;
  title: string; // e.g. پیش‌پرداخت، قسط ۱، قسط ۲
  amount: number;
  dueDate: string; // Jalali YYYY/MM/DD
  paidAt: string | null; // Jalali YYYY/MM/DD or null
  percent?: number; // e.g. 35%
}

export interface PlanInstallmentConfig {
  id: string;
  title: string;
  percent: number; // percentage of tuition (e.g. 36%)
  dueMonthOffset: number; // e.g. 1, 2, 4 months after start
}

export interface PaymentPlanTemplate {
  id: string;
  title: string; // e.g. "پلن سه ماهه با کارمزد ۷٪ (دو ماه یکبار)"
  description?: string;
  feePercent: number; // e.g. 7%
  downPaymentPercent: number; // e.g. 35%
  intervalMonths: number; // 1, 2, 3...
  installmentsCount: number; // e.g. 2
  installmentsConfig: PlanInstallmentConfig[];
  isDefault?: boolean;
}

export interface PaymentPlan {
  templateId?: string;
  templateTitle?: string;
  months: number; // 0 = cash (نقدی)
  feePercent?: number;
  feeAmount?: number;
  baseAmount?: number;
  totalAmount?: number;
  downPayment?: number;
  installments: Installment[];
}

export type RegistrationStatus = 'pending' | 'approved' | 'cancelled';

export interface Registration {
  id: string;
  code: string; // T-101, T-102, ...
  studentId: string;
  classId: string;
  sessionId: string;
  status: RegistrationStatus;
  amount: number; // Tuition after discount
  discount: number;
  plan: PaymentPlan;
  date: string; // Jalali date
  notes?: string;
  wooOrderId?: number | string; // CR-3: WooCommerce order number (idempotency key)
  wooOrderSyncedAt?: string; // Jalali date the order was imported
}

export interface FieldSettings {
  firstName: boolean;
  lastName: boolean;
  fatherName: boolean;
  nationalId: boolean;
  grade: boolean;
  gpa: boolean;
  school: boolean;
  phones: boolean;
}

export interface SyncLogItem {
  id: string;
  time: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface WooSettings {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  isConnected: boolean;
  lastSync?: string;
  syncLog: SyncLogItem[];
}

export interface AcademicYearDataSnapshot {
  students: Student[];
  classes: ClassRoom[];
  registrations: Registration[];
}

export interface AcademicYear {
  id: string;
  title: string; // e.g. "سال تحصیلی ۱۴۰۳-۱۴۰۴"
  shortTitle: string; // e.g. "۱۴۰۳-۱۴۰۴"
  periodLabel: string; // e.g. "خرداد ۱۴۰۳ تا خرداد ۱۴۰۴"
  startDate: string; // e.g. "1403/03/01"
  endDate: string; // e.g. "1404/03/01"
  isActive: boolean; // Is it the ongoing active academic year?
  isArchived: boolean;
  archivedAt?: string;
  description?: string;
  archivedData?: AcademicYearDataSnapshot;
}

