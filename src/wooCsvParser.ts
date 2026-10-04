/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ماژول اختصاصی پردازش و تحلیل خروجی سفارشات ووکامرس موسسه علامه حلی
 * منطبق بر ماتریس ۴ گانه وصولی، مطالبات معوق، درآمد آتی و اقلام مستثنی
 * با تضمین تفکیک دوره‌ها با علامت (-) و تجمیع هوشمند اقساط بدون رکورد تکراری (Idempotent)
 */

import Papa from 'papaparse';
import { Student, ClassRoom, Registration, Installment, StudentGrade } from './types';
import { toEnglishDigits, toPersianDigits } from './utils';

export type WooFinancialCategory = 'realized' | 'overdue' | 'future' | 'excluded';

export interface WooStatusMeta {
  category: WooFinancialCategory;
  label: string;
  badgeClass: string;
  isPaid: boolean;
}

/**
 * ماتریس تحلیل وضعیت‌های مالی ووکامرس طبق دستورالعمل موسسه
 * 
 * ✅ وصولی (نقد محقق‌شده): تکمیل شده، در حال انجام، تقریباً پرداخت شده
 * 🔴 مطالبات معوق (پیگیری فوری): وضعیت «در انتظار پرداخت قسط»
 * 🟡 درآمد آتی پیش‌بینی‌شده: «زمان‌بندی شده» (اقساط سررسید نشده)
 * ⚪ اقلام مستثنی (صفر وصولی): سفارش‌های «لغو شده» و «مسترد شده»
 */
export function categorizeWooStatus(rawStatus: string): WooStatusMeta {
  const s = (rawStatus || '').trim().toLowerCase();

  // ۱. وصولی (نقد محقق‌شده)
  if (
    s.includes('تکمیل') ||
    s.includes('completed') ||
    s.includes('در حال انجام') ||
    s.includes('processing') ||
    s.includes('تقریبا پرداخت') ||
    s.includes('تقریباً پرداخت') ||
    s.includes('partially-paid') ||
    s.includes('partial')
  ) {
    return {
      category: 'realized',
      label: 'وصولی (نقد محقق‌شده)',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      isPaid: true,
    };
  }

  // ۲. مطالبات معوق (پیگیری فوری)
  if (
    s.includes('در انتظار پرداخت') ||
    s.includes('قسط') ||
    s.includes('معوق') ||
    s.includes('overdue') ||
    s.includes('pending-installment')
  ) {
    return {
      category: 'overdue',
      label: 'مطالبات معوق (پیگیری فوری)',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      isPaid: false,
    };
  }

  // ۳. درآمد آتی پیش‌بینی‌شده
  if (
    s.includes('زمان‌بندی') ||
    s.includes('زمان بندی') ||
    s.includes('scheduled') ||
    s.includes('future')
  ) {
    return {
      category: 'future',
      label: 'درآمد آتی پیش‌بینی‌شده',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
      isPaid: false,
    };
  }

  // ۴. اقلام مستثنی (صفر وصولی)
  if (
    s.includes('لغو') ||
    s.includes('cancelled') ||
    s.includes('canceled') ||
    s.includes('مسترد') ||
    s.includes('refunded') ||
    s.includes('failed') ||
    s.includes('ناموفق')
  ) {
    return {
      category: 'excluded',
      label: 'اقلام مستثنی (صفر وصولی)',
      badgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-200/80',
      isPaid: false,
    };
  }

  // پیش‌فرض ایمن
  return {
    category: 'future',
    label: rawStatus || 'در انتظار پرداخت',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
    isPaid: false,
  };
}

export interface WooParsedOrderRow {
  orderId: string;
  orderDate: string; // e.g. "۱۴۰۶/۰۲/۰۲ ۰۰:۰۰"
  jalaliDate: string; // "۱۴۰۶/۰۲/۰۲"
  rawStatus: string;
  category: WooFinancialCategory;
  categoryLabel: string;
  amount: number;
  fullName: string;
  mobile: string;
  cleanMobile: string;
  nationalId: string;
  cleanNationalId: string;
  gradeRaw: string;
  normalizedGrade: StudentGrade;
  birthDate: string;
  rawItems: string;
  courses: string[];
}

export interface WooSyncFinancialSummary {
  realizedAmount: number; // وصولی نقد
  realizedCount: number;
  overdueAmount: number; // مطالبات معوق
  overdueCount: number;
  futureAmount: number; // درآمد آتی
  futureCount: number;
  excludedAmount: number; // اقلام مستثنی
  excludedCount: number;
  totalOrdersCount: number;
  totalUniqueStudents: number;
  totalUniqueCourses: number;
}

export interface WooSyncPreviewResult {
  rows: WooParsedOrderRow[];
  summary: WooSyncFinancialSummary;
  studentsToUpsert: Student[];
  classesToUpsert: ClassRoom[];
  registrationsToUpsert: Registration[];
  warnings: string[];
}

/**
 * نرمال‌سازی عنوان پایه تحصیلی
 */
export function normalizeGrade(gradeStr?: string): StudentGrade {
  const g = (gradeStr || '').trim();
  if (g.includes('چهارم') || g.includes('4')) return 'چهارم';
  if (g.includes('پنجم') || g.includes('5')) return 'پنجم';
  if (g.includes('ششم') || g.includes('6')) return 'ششم';
  if (g.includes('هفتم') || g.includes('7')) return 'هفتم';
  if (g.includes('هشتم') || g.includes('8')) return 'هشتم';
  if (g.includes('نهم') || g.includes('9')) return 'نهم';
  if (g.includes('دهم') || g.includes('10')) return 'دهم';
  if (g.includes('یازدهم') || g.includes('11')) return 'یازدهم';
  if (g.includes('دوازدهم') || g.includes('12')) return 'دوازدهم';
  return 'ششم'; // پیش‌فرض برای تیزهوشان
}

/**
 * تمیزکاری نام دوره و حذف عبارات زائد مانند (تعداد: 1)
 */
export function cleanCourseTitle(title: string): string {
  return title
    .replace(/\(تعداد:\s*\d+\)/gi, '')
    .replace(/\|\s*تعداد\s*:\s*\d+/gi, '')
    .replace(/\|\s*تعداد\s*:\s*[۰-۹]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * تفکیک ستون اقلام سفارش به دوره‌های مستقل در صورت وجود پکیج چندتایی با علامت (-)
 * مثال:
 * دوره فیزیک پایه نهم | سمپاد پلاس (تعداد: 1) - دوره شیمی پایه نهم | سمپاد پلاس (تعداد: 1) - دوره ریاضی پایه نهم | سمپاد پلاس (تعداد: 1)
 */
export function splitOrderItems(rawItems: string): string[] {
  if (!rawItems) return ['دوره آموزشی نامشخص'];

  // تفکیک بر اساس خط تیره محصور در فاصله یا خط تیره ساده
  const parts = rawItems.split(/\s*-\s*|\s*–\s*|\s*—\s*/);
  const cleaned = parts
    .map(p => cleanCourseTitle(p))
    .filter(p => p.length >= 2);

  return cleaned.length > 0 ? cleaned : [cleanCourseTitle(rawItems)];
}

/**
 * نرمال‌سازی نام کامل جهت تطبیق هوشمند اسامی چند سیلابی
 */
export function normalizeFullName(name: string): string {
  return (name || '')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // حذف نیم‌فاصله‌های نامرئی برای مقایسه کلید
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * پارس و اعتبارسنجی فایل اکسل/CSV ووکامرس
 */
export function parseWooCommerceOrdersCsv(
  csvText: string,
  activeYearId: string,
  existingStudents: Student[],
  existingRegistrations: Registration[],
  existingClasses: ClassRoom[]
): WooSyncPreviewResult {
  const parsed = Papa.parse<Record<string, any>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^["'\s]+|["'\s]+$/g, '').trim(),
  });

  const rows: WooParsedOrderRow[] = [];
  const warnings: string[] = [];

  const summary: WooSyncFinancialSummary = {
    realizedAmount: 0,
    realizedCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    futureAmount: 0,
    futureCount: 0,
    excludedAmount: 0,
    excludedCount: 0,
    totalOrdersCount: 0,
    totalUniqueStudents: 0,
    totalUniqueCourses: 0,
  };

  // نگاشت دانش‌آموزان با کلید ترکیبی: کد ملی یا در صورت نبود، نام نرمال‌شده
  const studentMap = new Map<string, {
    key: string;
    fullName: string;
    mobile: string;
    nationalId: string;
    grade: StudentGrade;
    birthDate: string;
  }>();

  const courseSet = new Set<string>();

  // نگاشت برای تجمیع سفارش‌ها به ازای هر (دانش‌آموز + دوره)
  interface OrderItemRecord {
    orderId: string;
    orderDate: string;
    jalaliDate: string;
    rawStatus: string;
    category: WooFinancialCategory;
    isPaid: boolean;
    amount: number;
    courseName: string;
    studentKey: string;
  }

  const enrollmentMap = new Map<string, OrderItemRecord[]>(); // key: `${studentKey}:::${courseName}`

  parsed.data.forEach((row, idx) => {
    // خواندن شماره سفارش
    const orderId = toEnglishDigits(String(row['شماره سفارش'] || row['order_id'] || row['id'] || idx + 1)).trim();
    if (!orderId) return;

    const orderDateRaw = String(row['تاریخ سفارش'] || row['order_date'] || row['date'] || '').trim();
    const jalaliDate = orderDateRaw.split(/\s+/)[0] || '';
    const rawStatus = String(row['وضعیت'] || row['status'] || 'نامشخص').trim();
    const statusMeta = categorizeWooStatus(rawStatus);

    const amountStr = toEnglishDigits(String(row['مبلغ کل'] || row['total'] || row['amount'] || 0)).replace(/[^\d.-]/g, '');
    const totalAmount = Math.max(0, parseInt(amountStr, 10) || 0);

    const fullNameRaw = String(row['نام و خانوادگی'] || row['billing_name'] || row['name'] || '').trim();
    const fullName = fullNameRaw || 'دانش‌آموز';
    const mobileRaw = toEnglishDigits(String(row['موبایل'] || row['billing_phone'] || row['phone'] || '')).trim();
    const cleanMobile = mobileRaw.replace(/\D/g, '');

    const nidRaw = toEnglishDigits(String(row['کد ملی'] || row['national_id'] || row['nid'] || '')).trim();
    let cleanNid = nidRaw.replace(/\D/g, '');
    if (cleanNid.length > 0 && cleanNid.length < 10 && cleanNid.length >= 8) {
      cleanNid = cleanNid.padStart(10, '0');
    }

    // ایجاد کلید یکتا برای دانش‌آموز: ترجیحاً کد ملی؛ اگر نبود، نام نرمال‌شده
    const studentUniqueKey = cleanNid || (normalizeFullName(fullName) ? `name-${normalizeFullName(fullName)}` : `row-${orderId}`);

    const gradeRaw = String(row['پایه تحصیلی'] || row['grade'] || '').trim();
    const normalizedGrade = normalizeGrade(gradeRaw);
    const birthDateRaw = toEnglishDigits(String(row['تاریخ تولد'] || row['birth_date'] || '')).trim();
    const birthDate = birthDateRaw !== '-' ? birthDateRaw : '';

    const rawItems = String(row['اقلام سفارش'] || row['items'] || row['courses'] || 'دوره آموزشی').trim();
    const courses = splitOrderItems(rawItems);

    // محاسبه آمار مالی
    summary.totalOrdersCount++;
    if (statusMeta.category === 'realized') {
      summary.realizedAmount += totalAmount;
      summary.realizedCount++;
    } else if (statusMeta.category === 'overdue') {
      summary.overdueAmount += totalAmount;
      summary.overdueCount++;
    } else if (statusMeta.category === 'future') {
      summary.futureAmount += totalAmount;
      summary.futureCount++;
    } else {
      summary.excludedAmount += totalAmount;
      summary.excludedCount++;
    }

    rows.push({
      orderId,
      orderDate: orderDateRaw,
      jalaliDate,
      rawStatus,
      category: statusMeta.category,
      categoryLabel: statusMeta.label,
      amount: totalAmount,
      fullName,
      mobile: mobileRaw,
      cleanMobile,
      nationalId: nidRaw,
      cleanNationalId: cleanNid,
      gradeRaw,
      normalizedGrade,
      birthDate,
      rawItems,
      courses,
    });

    if (studentUniqueKey) {
      if (!studentMap.has(studentUniqueKey)) {
        studentMap.set(studentUniqueKey, {
          key: studentUniqueKey,
          fullName,
          mobile: cleanMobile,
          nationalId: cleanNid,
          grade: normalizedGrade,
          birthDate,
        });
      } else {
        const ex = studentMap.get(studentUniqueKey)!;
        if (!ex.birthDate && birthDate) ex.birthDate = birthDate;
        if (!ex.mobile && cleanMobile) ex.mobile = cleanMobile;
        if (!ex.nationalId && cleanNid) ex.nationalId = cleanNid;
        if (fullName && fullName.length > ex.fullName.length) ex.fullName = fullName;
      }
    }

    // تفکیک مبالغ در صورت وجود چند درس در سفارش (تسهیم بیعانه تجمیع‌شده بین دوره‌ها)
    const amountPerCourse = courses.length > 0 ? Math.round(totalAmount / courses.length) : totalAmount;

    courses.forEach((cName) => {
      courseSet.add(cName);
      if (studentUniqueKey) {
        const key = `${studentUniqueKey}:::${cName}`;
        if (!enrollmentMap.has(key)) {
          enrollmentMap.set(key, []);
        }
        enrollmentMap.get(key)!.push({
          orderId,
          orderDate: orderDateRaw,
          jalaliDate,
          rawStatus,
          category: statusMeta.category,
          isPaid: statusMeta.isPaid,
          amount: amountPerCourse,
          courseName: cName,
          studentKey: studentUniqueKey,
        });
      }
    });
  });

  summary.totalUniqueStudents = studentMap.size;
  summary.totalUniqueCourses = courseSet.size;

  // ۱. ساخت یا به‌روزرسانی لیست دانش‌آموزان
  const studentsToUpsert: Student[] = [];
  const existingStudentByNid = new Map<string, Student>();
  const existingStudentByName = new Map<string, Student>();

  existingStudents.forEach((s) => {
    const n = toEnglishDigits(s.nationalId || '').trim();
    if (n) existingStudentByNid.set(n, s);
    const fullN = normalizeFullName(`${s.firstName} ${s.lastName}`);
    if (fullN) existingStudentByName.set(fullN, s);
  });

  studentMap.forEach((sData, sKey) => {
    // تطبیق با دانش‌آموز موجود بر اساس کد ملی یا نام کامل
    let existing = sData.nationalId ? existingStudentByNid.get(sData.nationalId) : undefined;
    if (!existing) {
      existing = existingStudentByName.get(normalizeFullName(sData.fullName));
    }

    if (existing) {
      // به‌روزرسانی مشخصات موجود بدون تخریب سایر داده‌ها
      studentsToUpsert.push({
        ...existing,
        // نگهداری کل نام و نام خانوادگی به صورت کامل در firstName تا اسامی چند سیلابی مخدوش نشوند
        firstName: sData.fullName,
        lastName: '',
        nationalId: existing.nationalId || sData.nationalId,
        phones: sData.mobile
          ? [{ id: `p-${existing.id}`, label: 'موبایل ووکامرس', number: sData.mobile }]
          : existing.phones,
        grade: sData.grade || existing.grade,
        birthDate: sData.birthDate || existing.birthDate,
      });
    } else {
      // ایجاد دانش‌آموز جدید با شناسه پایدار
      const studentId = sData.nationalId
        ? `std-woo-${sData.nationalId}`
        : `std-woo-${sKey.replace(/[^a-zA-Z0-9-]/g, '') || Math.random().toString(36).substring(2, 9)}`;

      studentsToUpsert.push({
        id: studentId,
        firstName: sData.fullName,
        lastName: '',
        fatherName: '', // در ثبت‌نام تکمیلی وارد خواهد شد
        nationalId: sData.nationalId,
        school: 'تیزهوشان',
        gpa: 20,
        phones: sData.mobile ? [{ id: `p-${studentId}`, label: 'موبایل ووکامرس', number: sData.mobile }] : [],
        grade: sData.grade,
        birthDate: sData.birthDate,
        createdAt: new Date().toISOString().slice(0, 10),
      });
    }
  });

  // ۲. ساخت یا تطبیق کلاس‌ها (Classes/Courses)
  const classesToUpsert: ClassRoom[] = [];
  const existingClassByName = new Map<string, ClassRoom>();
  existingClasses.forEach((c) => {
    existingClassByName.set(c.name.trim().toLowerCase(), c);
  });

  courseSet.forEach((cName) => {
    const key = cName.trim().toLowerCase();
    let cls = existingClassByName.get(key);
    if (!cls) {
      const grade = normalizeGrade(cName);
      cls = {
        id: `cls-woo-${encodeURIComponent(cName.slice(0, 25)).replace(/%/g, '').toLowerCase()}`,
        name: cName,
        grade,
        teacher: 'مدرس دوره ووکامرس',
        tuition: 0,
        sessions: [
          {
            id: `ses-woo-main`,
            kind: 'even',
            label: 'زنگ ثبت‌نام آنلاین ووکامرس',
            days: 'جلسات آنلاین / حضوری',
            time: 'طبق تقویم دوره',
            capacity: 500, // ظرفیت گسترده برای ثبت‌نام‌های آنلاین
          }
        ],
      };
      classesToUpsert.push(cls);
      existingClassByName.set(key, cls);
    }
  });

  // ۳. تجمیع ثبت‌نام‌ها و تولید دقیق دفترچه اقساط
  const registrationsToUpsert: Registration[] = [];

  enrollmentMap.forEach((orderList, key) => {
    const [sKey, courseName] = key.split(':::');
    const sData = studentMap.get(sKey);
    if (!sData) return;

    // یافتن شیء دانش‌آموز تولیدشده یا موجود
    const student = studentsToUpsert.find((s) =>
      (sData.nationalId && s.nationalId === sData.nationalId) ||
      normalizeFullName(s.firstName) === normalizeFullName(sData.fullName)
    );
    if (!student) return;

    const classObj = existingClassByName.get(courseName.trim().toLowerCase()) || classesToUpsert[0];
    const classId = classObj ? classObj.id : 'cls-default';

    // بررسی ثبت‌نام قبلی دانش‌آموز در این دوره (تطبیق بر اساس studentId و classId یا عنوان در یادداشت)
    const existingReg = existingRegistrations.find(
      (r) => r.studentId === student.id && (r.classId === classId || r.notes?.includes(courseName))
    );

    // سورت کلیه سفارش‌های مربوط به این دوره بر اساس شناسه و تاریخ
    const sortedOrders = [...orderList].sort((a, b) => a.orderId.localeCompare(b.orderId));

    // تولید اقساط متناظر با تک‌تک سفارش‌های ووکامرس
    // به طوری که هر سفارش معادل یک قسط مستقل در پرونده باشد
    const installments: Installment[] = [];
    let totalRealized = 0;
    let totalNonExcluded = 0;
    let hasRealized = false;
    let hasOverdue = false;

    sortedOrders.forEach((ord, i) => {
      if (ord.category !== 'excluded') {
        totalNonExcluded += ord.amount;
      }
      if (ord.isPaid) {
        totalRealized += ord.amount;
        hasRealized = true;
      }
      if (ord.category === 'overdue') {
        hasOverdue = true;
      }

      installments.push({
        id: `inst-woo-${ord.orderId}`,
        title: `قسط ${toPersianDigits(i + 1)} (سفارش #${toPersianDigits(ord.orderId)})`,
        amount: ord.amount,
        dueDate: ord.jalaliDate || '۱۴۰۵/۰۷/۰۱',
        paidAt: ord.isPaid ? (ord.jalaliDate || '۱۴۰۵/۰۷/۰۱') : null,
      });
    });

    // اگر ثبت‌نام از قبل وجود داشت، اقساط قبلی را نیز در صورت عدم همپوشانی ادغام می‌کنیم
    if (existingReg?.plan?.installments) {
      existingReg.plan.installments.forEach((oldInst) => {
        if (!installments.some((ni) => ni.id === oldInst.id)) {
          installments.push(oldInst);
          if (oldInst.paidAt) {
            totalRealized += oldInst.amount;
          }
          totalNonExcluded += oldInst.amount;
        }
      });
    }

    const regId = existingReg?.id || `reg-woo-${student.id}-${orderList[0].orderId}`;
    const trackingCode = existingReg?.code || `T-WC${orderList[0].orderId}`;

    // تعیین وضعیت پرونده بر اساس وضعیت مالی
    const regStatus = hasRealized ? 'approved' : (hasOverdue ? 'pending' : 'pending');

    const reg: Registration = {
      id: regId,
      code: trackingCode,
      studentId: student.id,
      classId,
      sessionId: classObj?.sessions?.[0]?.id || 'ses-woo-main',
      status: regStatus,
      amount: totalNonExcluded || (orderList[0]?.amount ?? 0),
      discount: 0,
      plan: {
        months: Math.max(1, installments.length),
        downPayment: totalRealized,
        installments,
      },
      date: orderList[0]?.jalaliDate || '۱۴۰۵/۰۷/۰۱',
      notes: `ثبت‌نام آنلاین ووکامرس: دوره ${courseName} (شامل ${toPersianDigits(installments.length)} قسط)`,
      wooOrderId: orderList[0]?.orderId,
      wooOrderSyncedAt: new Date().toISOString().slice(0, 10),
    };

    registrationsToUpsert.push(reg);
  });

  return {
    rows,
    summary,
    studentsToUpsert,
    classesToUpsert,
    registrationsToUpsert,
    warnings,
  };
}
