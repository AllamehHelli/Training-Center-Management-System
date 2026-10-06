/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, ClassRoom, Registration, WooSettings, AcademicYear, SyncLogItem, Teacher, Counselor } from './types';
import { getTodayJalali, addMonthsJalali, migrateSessionTimes } from './utils';

/**
 * ME/CR fix — tracking-code sequence helpers.
 *
 * A registration tracking code has the shape T-<jalali-year>-<4-digit seq>.
 * The sequence is GLOBAL and monotonic: it never rewinds when a year is
 * archived or a registration is deleted, so codes stay unique forever.
 */
const REG_CODE_RE = /^T-(\d{4})-(\d+)$/;

/** Largest sequence number found in a list of codes (0 when none match). */
export function maxRegistrationSeq(codes: Array<string | undefined>): number {
  let max = 0;
  for (const code of codes) {
    const m = REG_CODE_RE.exec(String(code || ''));
    if (m) max = Math.max(max, parseInt(m[2], 10) || 0);
  }
  return max;
}

/** Build the canonical code for a given jalali year + global sequence. */
export function makeRegistrationCode(jalaliYear: number, seq: number): string {
  return `T-${jalaliYear}-${String(seq).padStart(4, '0')}`;
}

/**
 * One-time re-keying of legacy short codes (`T-101`, `T-102`, …) to the new
 * global format. Codes that already match the new pattern are left untouched.
 * `jalaliYear` is the year stamped onto migrated legacy codes.
 */
export function normalizeRegistrationCodes<T extends { code?: string; wooOrderId?: number | string }>(
  regs: T[],
  jalaliYear: number
): T[] {
  return regs.map((r, idx) => {
    const code = String(r.code || '');
    if (REG_CODE_RE.test(code)) return r;
    // WooCommerce imports used `T-WC<orderId>` — keep them stable & unique.
    if (code.startsWith('T-WC')) return r;
    const num = /^T-(\d+)$/.exec(code);
    const seq = num ? 100 + parseInt(num[1], 10) : 100 + idx;
    return { ...r, code: makeRegistrationCode(jalaliYear, seq) };
  });
}

export const seedTeachers: Teacher[] = [
  {
    id: 'tch-1',
    firstName: 'علیرضا',
    lastName: 'میرزایی',
    nationalId: '0012345678',
    phone: '09121110001',
    email: 'dr.mirzaei@helli.ir',
    specialty: 'ریاضی و هندسه تیزهوشان',
    degree: 'دکتری ریاضی کاربردی دانشگاه صنعتی شریف',
    notes: 'مدرس باسابقه المپیاد ریاضی و آزمون‌های ورودی سمپاد با بیش از ۱۵ سال سابقه',
    isActive: true,
    createdAt: '1403/01/15',
  },
  {
    id: 'tch-2',
    firstName: 'آرش',
    lastName: 'معتمدی',
    nationalId: '0023456789',
    phone: '09122220002',
    email: 'motamedi@helli.ir',
    specialty: 'فیزیک پیشرفته و المپیاد',
    degree: 'کارشناسی ارشد فیزیک ذرات دانشگاه تهران',
    notes: 'سرگروه فیزیک تیزهوشان و طراح آزمون‌های آزمایشی کشوری',
    isActive: true,
    createdAt: '1403/01/20',
  },
  {
    id: 'tch-3',
    firstName: 'مسعود',
    lastName: 'صادقلو',
    nationalId: '0034567890',
    phone: '09123330003',
    email: 'sadeghloo@helli.ir',
    specialty: 'ادبیات، درک مطلب و هوش کلامی',
    degree: 'کارشناسی ارشد زبان و ادبیات فارسی دانشگاه علامه طباطبایی',
    notes: 'مولف کتاب‌های کمک‌آموزشی تیزهوشان و مدرس دوره‌های تقویت استعداد تحلیلی',
    isActive: true,
    createdAt: '1403/02/01',
  },
  {
    id: 'tch-4',
    firstName: 'نیما',
    lastName: 'بهرامی',
    nationalId: '0045678901',
    phone: '09124440004',
    email: 'bahrami@helli.ir',
    specialty: 'شیمی و زیست‌شناسی المپیاد',
    degree: 'دکتری بیوشیمی دانشگاه علوم پزشکی تهران',
    notes: 'مدرس دوره‌های آمادگی مرحله اول و دوم المپیادهای علمی کشور',
    isActive: true,
    createdAt: '1403/02/10',
  },
  {
    id: 'tch-5',
    firstName: 'امیرحسام',
    lastName: 'حسینی',
    nationalId: '0056789012',
    phone: '09125550005',
    email: 'a.hosseini@helli.ir',
    specialty: 'ترکیبیات و هوش المپیاد ریاضی',
    degree: 'کارشناسی علوم کامپیوتر دانشگاه شریف (مدال طلای کشوری)',
    notes: 'مدال طلای المپیاد ریاضی کشوری و مدرس تخصصی مباحث ترکیبیات و نظریه اعداد',
    isActive: true,
    createdAt: '1403/02/15',
  },
];

export const seedCounselors: Counselor[] = [
  {
    id: 'cns-1',
    firstName: 'فرهاد',
    lastName: 'سلیمانی',
    nationalId: '0067890123',
    phone: '09126660001',
    email: 'soleimani@helli.ir',
    specialty: 'برنامه‌ریزی جامع تیزهوشان و هدایت تحصیلی',
    grades: ['هفتم', 'هشتم', 'نهم'],
    maxCapacity: 35,
    notes: 'دکتری روانشناسی تربیتی و مشاور ارشد موسسه با تمرکز بر مدیریت استرس و راهبردهای یادگیری',
    isActive: true,
    createdAt: '1403/01/10',
  },
  {
    id: 'cns-2',
    firstName: 'مریم',
    lastName: 'کاظمی',
    nationalId: '0078901234',
    phone: '09127770002',
    email: 'kazemi@helli.ir',
    specialty: 'مشاوره پایه ششم و آزمون ورودی هفتم',
    grades: ['ششم', 'هفتم'],
    maxCapacity: 30,
    notes: 'کارشناسی ارشد مشاوره تحصیلی و متخصص آمادگی روانی و آزمون‌های ورودی مدارس استعدادهای درخشان',
    isActive: true,
    createdAt: '1403/01/12',
  },
  {
    id: 'cns-3',
    firstName: 'بهنام',
    lastName: 'احمدی',
    nationalId: '0089012345',
    phone: '09128880003',
    email: 'ahmadi@helli.ir',
    specialty: 'مشاوره تخصصی مسیر المپیاد و نخبگان',
    grades: ['هشتم', 'نهم'],
    maxCapacity: 25,
    notes: 'مشاور انگیزشی و تخصصی دانش‌پژوهان المپیادهای علمی سمپاد',
    isActive: true,
    createdAt: '1403/01/18',
  },
];

export function buildSeedData(): {
  students: Student[];
  classes: ClassRoom[];
  registrations: Registration[];
  teachers: Teacher[];
  counselors: Counselor[];
  wooSettings: WooSettings;
  academicYears: AcademicYear[];
  activeYearId: string;
  viewingYearId: string;
  /** ME fix: global tracking-code counter (see AppState.nextRegSeq). */
  nextRegSeq: number;
} {
  const today = getTodayJalali();

  // 12 Iranian Gifted Students
  const students: Student[] = [
    {
      id: 'std-1',
      firstName: 'آرتین',
      lastName: 'حسینی',
      fatherName: 'محمدرضا',
      nationalId: '0021345678',
      phones: [
        { id: 'p1-1', label: 'پدر', number: '09121112233' },
        { id: 'p1-2', label: 'مادر', number: '09124445566' },
      ],
      grade: 'نهم',
      gpa: 19.95,
      school: 'مدرسه شهید بهشتی',
      counselorId: 'cns-1',
      counselorName: 'فرهاد سلیمانی',
      createdAt: '1403/06/10',
    },
    {
      id: 'std-2',
      firstName: 'سارینا',
      lastName: 'صادقی',
      fatherName: 'علیرضا',
      nationalId: '0019876543',
      phones: [
        { id: 'p2-1', label: 'مادر', number: '09123334455' },
        { id: 'p2-2', label: 'منزل', number: '09127778899' },
      ],
      grade: 'نهم',
      gpa: 20.0,
      school: 'فرزانگان ۱',
      counselorId: 'cns-1',
      counselorName: 'فرهاد سلیمانی',
      createdAt: '1403/06/12',
    },
    {
      id: 'std-3',
      firstName: 'کیان',
      lastName: 'فرهمند',
      fatherName: 'بهروز',
      nationalId: '0034567891',
      phones: [
        { id: 'p3-1', label: 'پدر', number: '09351234567' },
      ],
      grade: 'هشتم',
      gpa: 19.78,
      school: 'علامه حلی ۱',
      counselorId: 'cns-1',
      counselorName: 'فرهاد سلیمانی',
      createdAt: '1403/06/15',
    },
    {
      id: 'std-4',
      firstName: 'رزا',
      lastName: 'رادپور',
      fatherName: 'کامران',
      nationalId: '0045678902',
      phones: [
        { id: 'p4-1', label: 'مادر', number: '09198765432' },
        { id: 'p4-2', label: 'دانش‌آموز', number: '09301239876' },
      ],
      grade: 'هشتم',
      gpa: 19.85,
      school: 'فرزانگان ۲',
      counselorId: 'cns-1',
      counselorName: 'فرهاد سلیمانی',
      createdAt: '1403/06/18',
    },
    {
      id: 'std-5',
      firstName: 'پارسا',
      lastName: 'کریمی',
      fatherName: 'جواد',
      nationalId: '0056789013',
      phones: [
        { id: 'p5-1', label: 'پدر', number: '09128889900' },
      ],
      grade: 'هفتم',
      gpa: 19.9,
      school: 'علامه حلی ۳',
      counselorId: 'cns-2',
      counselorName: 'مریم کاظمی',
      createdAt: '1403/06/20',
    },
    {
      id: 'std-6',
      firstName: 'هستی',
      lastName: 'نامداری',
      fatherName: 'حامد',
      nationalId: '0067890124',
      phones: [
        { id: 'p6-1', label: 'مادر', number: '09125556677' },
        { id: 'p6-2', label: 'پدر', number: '09122223344' },
      ],
      grade: 'هفتم',
      gpa: 20.0,
      school: 'فرزانگان ۳',
      counselorId: 'cns-2',
      counselorName: 'مریم کاظمی',
      createdAt: '1403/06/22',
    },
    {
      id: 'std-7',
      firstName: 'دانیال',
      lastName: 'فراهانی',
      fatherName: 'مهدی',
      nationalId: '0078901235',
      phones: [
        { id: 'p7-1', label: 'پدر', number: '09361112222' },
      ],
      grade: 'ششم',
      gpa: 19.65,
      school: 'دبستان معرفت نو',
      counselorId: 'cns-2',
      counselorName: 'مریم کاظمی',
      createdAt: '1403/06/25',
    },
    {
      id: 'std-8',
      firstName: 'یلدا',
      lastName: 'موسوی',
      fatherName: 'سید مجتبی',
      nationalId: '0089012346',
      phones: [
        { id: 'p8-1', label: 'مادر', number: '09124443322' },
      ],
      grade: 'ششم',
      gpa: 19.92,
      school: 'دبستان روشنگر',
      counselorId: 'cns-2',
      counselorName: 'مریم کاظمی',
      createdAt: '1403/06/26',
    },
    {
      id: 'std-9',
      firstName: 'ماهان',
      lastName: 'بختیاری',
      fatherName: 'سهراب',
      nationalId: '0090123457',
      phones: [
        { id: 'p9-1', label: 'پدر', number: '09126667788' },
        { id: 'p9-2', label: 'منزل', number: '09129990011' },
      ],
      grade: 'نهم',
      gpa: 19.5,
      school: 'علامه حلی ۵',
      counselorId: 'cns-3',
      counselorName: 'بهنام احمدی',
      createdAt: '1403/07/01',
    },
    {
      id: 'std-10',
      firstName: 'نورا',
      lastName: 'افشار',
      fatherName: 'فرهاد',
      nationalId: '0101234568',
      phones: [
        { id: 'p10-1', label: 'مادر', number: '09191114455' },
      ],
      grade: 'هشتم',
      gpa: 19.8,
      school: 'فرزانگان ۵',
      counselorId: 'cns-3',
      counselorName: 'بهنام احمدی',
      createdAt: '1403/07/02',
    },
    {
      id: 'std-11',
      firstName: 'امیرعلی',
      lastName: 'تهرانی',
      fatherName: 'امید',
      nationalId: '0112345679',
      phones: [
        { id: 'p11-1', label: 'پدر', number: '09378889977' },
      ],
      grade: 'هفتم',
      gpa: 19.4,
      school: 'شهید بهشتی ۲',
      counselorId: 'cns-3',
      counselorName: 'بهنام احمدی',
      createdAt: '1403/07/03',
    },
    {
      id: 'std-12',
      firstName: 'ثنا',
      lastName: 'حیدری',
      fatherName: 'پژمان',
      nationalId: '0123456780',
      phones: [
        { id: 'p12-1', label: 'مادر', number: '09127776655' },
      ],
      grade: 'ششم',
      gpa: 20.0,
      school: 'دبستان مهرآیین',
      counselorId: 'cns-3',
      counselorName: 'بهنام احمدی',
      createdAt: '1403/07/04',
    },
  ];

  // 6 Classes with distinct sessions (even, odd, custom)
  const classes: ClassRoom[] = [
    {
      id: 'cls-1',
      name: 'هوش تحلیلی و استعداد تحلیلی نهم',
      grade: 'نهم',
      teacherId: 'tch-1',
      teacher: 'دکتر علیرضا میرزایی',
      tuition: 14500000,
      sessions: [
        {
          id: 'ses-1-even',
          kind: 'even',
          label: 'زنگ عصر روزهای زوج (شنبه، دوشنبه، چهارشنبه)',
          days: 'شنبه، دوشنبه، چهارشنبه',
          time: '۱۶:۰۰ الی ۱۷:۳۰',
          capacity: 25,
        },
        {
          id: 'ses-1-odd',
          kind: 'odd',
          label: 'زنگ عصر روزهای فرد (یکشنبه، سه‌شنبه، پنجشنبه)',
          days: 'یکشنبه، سه‌شنبه، پنجشنبه',
          time: '۱۷:۴۵ الی ۱۹:۱۵',
          capacity: 25,
        },
      ],
    },
    {
      id: 'cls-2',
      name: 'ریاضیات پیشرفته و المپیاد هشتم',
      grade: 'هشتم',
      teacherId: 'tch-2',
      teacher: 'مهندس آرش معتمدی',
      tuition: 13800000,
      sessions: [
        {
          id: 'ses-2-even',
          kind: 'even',
          label: 'زنگ عصر روزهای زوج',
          days: 'شنبه، دوشنبه، چهارشنبه',
          time: '۱۷:۴۵ الی ۱۹:۱۵',
          capacity: 20,
        },
        {
          id: 'ses-2-odd',
          kind: 'odd',
          label: 'زنگ عصر روزهای فرد',
          days: 'یکشنبه، سه‌شنبه، پنجشنبه',
          time: '۱۶:۰۰ الی ۱۷:۳۰',
          capacity: 20,
        },
        {
          id: 'ses-2-custom',
          kind: 'custom',
          label: 'زنگ تخصصی پنجشنبه‌ها (فشرده)',
          days: 'پنجشنبه',
          time: '۰۹:۰۰ الی ۱۳:۰۰',
          capacity: 15,
        },
      ],
    },
    {
      id: 'cls-3',
      name: 'علوم تجربی تیزهوشان هفتم (فیزیک و زیست)',
      grade: 'هفتم',
      teacherId: 'tch-4',
      teacher: 'دکتر نیما بهرامی',
      tuition: 12500000,
      sessions: [
        {
          id: 'ses-3-even',
          kind: 'even',
          label: 'زنگ عصر روزهای زوج',
          days: 'شنبه، دوشنبه، چهارشنبه',
          time: '۱۶:۰۰ الی ۱۷:۳۰',
          capacity: 22,
        },
        {
          id: 'ses-3-odd',
          kind: 'odd',
          label: 'زنگ عصر روزهای فرد',
          days: 'یکشنبه، سه‌شنبه، پنجشنبه',
          time: '۱۷:۴۵ الی ۱۹:۱۵',
          capacity: 22,
        },
      ],
    },
    {
      id: 'cls-4',
      name: 'جامع تیزهوشان ششم (ورودی هفتم علامه حلی)',
      grade: 'ششم',
      teacherId: 'tch-1',
      teacher: 'دکتر علیرضا میرزایی',
      tuition: 16000000,
      sessions: [
        {
          id: 'ses-4-even',
          kind: 'even',
          label: 'زنگ روزهای زوج (صبح)',
          days: 'شنبه، دوشنبه، چهارشنبه',
          time: '۱۰:۰۰ الی ۱۲:۰۰',
          capacity: 28,
        },
        {
          id: 'ses-4-odd',
          kind: 'odd',
          label: 'زنگ روزهای فرد (عصر)',
          days: 'یکشنبه، سه‌شنبه، پنجشنبه',
          time: '۱۵:۰۰ الی ۱۷:۰۰',
          capacity: 28,
        },
      ],
    },
    {
      id: 'cls-5',
      name: 'ادبیات و درک مطلب پیشرفته نهم',
      grade: 'نهم',
      teacherId: 'tch-3',
      teacher: 'استاد مسعود صادقلو',
      tuition: 9500000,
      sessions: [
        {
          id: 'ses-5-even',
          kind: 'even',
          label: 'زنگ اختصاصی دوشنبه و چهارشنبه',
          days: 'شنبه، دوشنبه، چهارشنبه',
          time: '۱۸:۰۰ الی ۱۹:۳۰',
          capacity: 20,
        },
      ],
    },
    {
      id: 'cls-6',
      name: 'هندسه و ترکیبیات المپیاد ریاضی',
      grade: 'هشتم',
      teacherId: 'tch-5',
      teacher: 'مهندس امیرحسام حسینی',
      tuition: 11000000,
      sessions: [
        {
          id: 'ses-6-custom',
          kind: 'custom',
          label: 'کارگاه فشرده پنجشنبه و جمعه',
          days: 'پنجشنبه، جمعه',
          time: '۱۰:۰۰ الی ۱۳:۰۰',
          capacity: 18,
        },
      ],
    },
  ];

  // 16 Registrations with diverse plans (cash, 3, 6, 9-month plans)
  const registrations: Registration[] = [
    {
      id: 'reg-1',
      code: 'T-1403-0201',
      studentId: 'std-1',
      classId: 'cls-1',
      sessionId: 'ses-1-even',
      status: 'approved',
      amount: 14500000,
      discount: 1000000,
      plan: {
        months: 3,
        downPayment: 4500000,
        installments: [
          { id: 'inst-1-0', title: 'پیش‌پرداخت', amount: 4500000, dueDate: '1403/06/10', paidAt: '1403/06/10' },
          { id: 'inst-1-1', title: 'قسط ۱', amount: 3000000, dueDate: '1403/07/10', paidAt: '1403/07/09' },
          { id: 'inst-1-2', title: 'قسط ۲', amount: 3000000, dueDate: '1403/08/10', paidAt: null },
          { id: 'inst-1-3', title: 'قسط ۳', amount: 3000000, dueDate: '1403/09/10', paidAt: null },
        ],
      },
      date: '1403/06/10',
      notes: 'تخفیف ثبت‌نام زودهنگام تیزهوشان اعمال شد',
    },
    {
      id: 'reg-2',
      code: 'T-1403-0202',
      studentId: 'std-2',
      classId: 'cls-1',
      sessionId: 'ses-1-even',
      status: 'approved',
      amount: 14500000,
      discount: 0,
      plan: {
        months: 0, // Cash
        downPayment: 14500000,
        installments: [
          { id: 'inst-2-cash', title: 'تسویه کامل نقدی', amount: 14500000, dueDate: '1403/06/12', paidAt: '1403/06/12' },
        ],
      },
      date: '1403/06/12',
      notes: 'پرداخت نقدی کارت‌خوان موسسه',
    },
    {
      id: 'reg-3',
      code: 'T-1403-0203',
      studentId: 'std-3',
      classId: 'cls-2',
      sessionId: 'ses-2-even',
      status: 'approved',
      amount: 13800000,
      discount: 800000,
      plan: {
        months: 6,
        downPayment: 4000000,
        installments: [
          { id: 'inst-3-0', title: 'پیش‌پرداخت', amount: 4000000, dueDate: '1403/06/15', paidAt: '1403/06/15' },
          { id: 'inst-3-1', title: 'قسط ۱', amount: 1500000, dueDate: '1403/07/15', paidAt: '1403/07/14' },
          { id: 'inst-3-2', title: 'قسط ۲', amount: 1500000, dueDate: '1403/08/15', paidAt: null },
          { id: 'inst-3-3', title: 'قسط ۳', amount: 1500000, dueDate: '1403/09/15', paidAt: null },
          { id: 'inst-3-4', title: 'قسط ۴', amount: 1500000, dueDate: '1403/10/15', paidAt: null },
          { id: 'inst-3-5', title: 'قسط ۵', amount: 1500000, dueDate: '1403/11/15', paidAt: null },
          { id: 'inst-3-6', title: 'قسط ۶', amount: 1500000, dueDate: '1403/12/15', paidAt: null },
        ],
      },
      date: '1403/06/15',
    },
    {
      id: 'reg-4',
      code: 'T-1403-0204',
      studentId: 'std-4',
      classId: 'cls-2',
      sessionId: 'ses-2-odd',
      status: 'approved',
      amount: 13800000,
      discount: 0,
      plan: {
        months: 3,
        downPayment: 3800000,
        installments: [
          { id: 'inst-4-0', title: 'پیش‌پرداخت', amount: 3800000, dueDate: '1403/06/18', paidAt: '1403/06/18' },
          // Intentionally overdue installment
          { id: 'inst-4-1', title: 'قسط ۱', amount: 3333333, dueDate: '1403/07/01', paidAt: null },
          { id: 'inst-4-2', title: 'قسط ۲', amount: 3333333, dueDate: '1403/08/01', paidAt: null },
          { id: 'inst-4-3', title: 'قسط ۳', amount: 3333334, dueDate: '1403/09/01', paidAt: null },
        ],
      },
      date: '1403/06/18',
      notes: 'پیگیری پیامکی جهت قسط ۱ انجام شود',
    },
    {
      id: 'reg-5',
      code: 'T-1403-0205',
      studentId: 'std-5',
      classId: 'cls-3',
      sessionId: 'ses-3-even',
      status: 'approved',
      amount: 12500000,
      discount: 500000,
      plan: {
        months: 3,
        downPayment: 3000000,
        installments: [
          { id: 'inst-5-0', title: 'پیش‌پرداخت', amount: 3000000, dueDate: '1403/06/20', paidAt: '1403/06/20' },
          { id: 'inst-5-1', title: 'قسط ۱', amount: 3000000, dueDate: '1403/07/20', paidAt: null },
          { id: 'inst-5-2', title: 'قسط ۲', amount: 3000000, dueDate: '1403/08/20', paidAt: null },
          { id: 'inst-5-3', title: 'قسط ۳', amount: 3000000, dueDate: '1403/09/20', paidAt: null },
        ],
      },
      date: '1403/06/20',
    },
    {
      id: 'reg-6',
      code: 'T-1403-0206',
      studentId: 'std-6',
      classId: 'cls-3',
      sessionId: 'ses-3-odd',
      status: 'approved',
      amount: 12500000,
      discount: 0,
      plan: {
        months: 0,
        downPayment: 12500000,
        installments: [
          { id: 'inst-6-cash', title: 'تسویه کامل نقدی', amount: 12500000, dueDate: '1403/06/22', paidAt: '1403/06/22' },
        ],
      },
      date: '1403/06/22',
    },
    {
      id: 'reg-7',
      code: 'T-1403-0207',
      studentId: 'std-7',
      classId: 'cls-4',
      sessionId: 'ses-4-even',
      status: 'approved',
      amount: 16000000,
      discount: 1000000,
      plan: {
        months: 6,
        downPayment: 5000000,
        installments: [
          { id: 'inst-7-0', title: 'پیش‌پرداخت', amount: 5000000, dueDate: '1403/06/25', paidAt: '1403/06/25' },
          // Another overdue installment
          { id: 'inst-7-1', title: 'قسط ۱', amount: 1666666, dueDate: '1403/07/02', paidAt: null },
          { id: 'inst-7-2', title: 'قسط ۲', amount: 1666666, dueDate: '1403/08/02', paidAt: null },
          { id: 'inst-7-3', title: 'قسط ۳', amount: 1666666, dueDate: '1403/09/02', paidAt: null },
          { id: 'inst-7-4', title: 'قسط ۴', amount: 1666666, dueDate: '1403/10/02', paidAt: null },
          { id: 'inst-7-5', title: 'قسط ۵', amount: 1666666, dueDate: '1403/11/02', paidAt: null },
          { id: 'inst-7-6', title: 'قسط ۶', amount: 1666670, dueDate: '1403/12/02', paidAt: null },
        ],
      },
      date: '1403/06/25',
    },
    {
      id: 'reg-8',
      code: 'T-1403-0208',
      studentId: 'std-8',
      classId: 'cls-4',
      sessionId: 'ses-4-odd',
      status: 'approved',
      amount: 16000000,
      discount: 0,
      plan: {
        months: 3,
        downPayment: 4000000,
        installments: [
          { id: 'inst-8-0', title: 'پیش‌پرداخت', amount: 4000000, dueDate: '1403/06/26', paidAt: '1403/06/26' },
          { id: 'inst-8-1', title: 'قسط ۱', amount: 4000000, dueDate: '1403/07/26', paidAt: null },
          { id: 'inst-8-2', title: 'قسط ۲', amount: 4000000, dueDate: '1403/08/26', paidAt: null },
          { id: 'inst-8-3', title: 'قسط ۳', amount: 4000000, dueDate: '1403/09/26', paidAt: null },
        ],
      },
      date: '1403/06/26',
    },
    {
      id: 'reg-9',
      code: 'T-1403-0209',
      studentId: 'std-9',
      classId: 'cls-5',
      sessionId: 'ses-5-even',
      status: 'pending', // Queue item
      amount: 9500000,
      discount: 500000,
      plan: {
        months: 3,
        downPayment: 3000000,
        installments: [
          { id: 'inst-9-0', title: 'پیش‌پرداخت', amount: 3000000, dueDate: '1403/07/01', paidAt: null },
          { id: 'inst-9-1', title: 'قسط ۱', amount: 2000000, dueDate: '1403/08/01', paidAt: null },
          { id: 'inst-9-2', title: 'قسط ۲', amount: 2000000, dueDate: '1403/09/01', paidAt: null },
          { id: 'inst-9-3', title: 'قسط ۳', amount: 2000000, dueDate: '1403/10/01', paidAt: null },
        ],
      },
      date: '1403/07/01',
      notes: 'ثبت‌نام آنلاین از وب‌سایت در انتظار بررسی مدارک',
    },
    {
      id: 'reg-10',
      code: 'T-1403-0210',
      studentId: 'std-10',
      classId: 'cls-6',
      sessionId: 'ses-6-custom',
      status: 'pending', // Queue item
      amount: 11000000,
      discount: 0,
      plan: {
        months: 0,
        downPayment: 11000000,
        installments: [
          { id: 'inst-10-cash', title: 'تسویه کامل نقدی', amount: 11000000, dueDate: '1403/07/02', paidAt: null },
        ],
      },
      date: '1403/07/02',
      notes: 'فیش واریزی در انتظار تأیید حسابداری',
    },
    {
      id: 'reg-11',
      code: 'T-1403-0211',
      studentId: 'std-11',
      classId: 'cls-3',
      sessionId: 'ses-3-even',
      status: 'approved',
      amount: 12500000,
      discount: 500000,
      plan: {
        months: 3,
        downPayment: 4000000,
        installments: [
          { id: 'inst-11-0', title: 'پیش‌پرداخت', amount: 4000000, dueDate: '1403/07/03', paidAt: '1403/07/03' },
          { id: 'inst-11-1', title: 'قسط ۱', amount: 2666666, dueDate: '1403/08/03', paidAt: null },
          { id: 'inst-11-2', title: 'قسط ۲', amount: 2666666, dueDate: '1403/09/03', paidAt: null },
          { id: 'inst-11-3', title: 'قسط ۳', amount: 2666668, dueDate: '1403/10/03', paidAt: null },
        ],
      },
      date: '1403/07/03',
    },
    {
      id: 'reg-12',
      code: 'T-1403-0212',
      studentId: 'std-12',
      classId: 'cls-4',
      sessionId: 'ses-4-even',
      status: 'pending',
      amount: 16000000,
      discount: 1000000,
      plan: {
        months: 6,
        downPayment: 5000000,
        installments: [
          { id: 'inst-12-0', title: 'پیش‌پرداخت', amount: 5000000, dueDate: '1403/07/04', paidAt: null },
          { id: 'inst-12-1', title: 'قسط ۱', amount: 1666666, dueDate: '1403/08/04', paidAt: null },
          { id: 'inst-12-2', title: 'قسط ۲', amount: 1666666, dueDate: '1403/09/04', paidAt: null },
          { id: 'inst-12-3', title: 'قسط ۳', amount: 1666666, dueDate: '1403/10/04', paidAt: null },
          { id: 'inst-12-4', title: 'قسط ۴', amount: 1666666, dueDate: '1403/11/04', paidAt: null },
          { id: 'inst-12-5', title: 'قسط ۵', amount: 1666666, dueDate: '1403/12/04', paidAt: null },
          { id: 'inst-12-6', title: 'قسط ۶', amount: 1666670, dueDate: '1404/01/04', paidAt: null },
        ],
      },
      date: '1403/07/04',
      notes: 'نیازمند تماس تلفنی جهت تعیین زنگ ترجیحی',
    },
    {
      id: 'reg-13',
      code: 'T-1403-0213',
      studentId: 'std-1',
      classId: 'cls-5',
      sessionId: 'ses-5-even',
      status: 'approved',
      amount: 9500000,
      discount: 500000,
      plan: {
        months: 0,
        downPayment: 9000000,
        installments: [
          { id: 'inst-13-cash', title: 'تسویه کامل نقدی', amount: 9000000, dueDate: '1403/06/11', paidAt: '1403/06/11' },
        ],
      },
      date: '1403/06/11',
      notes: 'دوره دوم دانش‌آموز آرتین حسینی',
    },
    {
      id: 'reg-14',
      code: 'T-1403-0214',
      studentId: 'std-3',
      classId: 'cls-6',
      sessionId: 'ses-6-custom',
      status: 'approved',
      amount: 11000000,
      discount: 0,
      plan: {
        months: 3,
        downPayment: 5000000,
        installments: [
          { id: 'inst-14-0', title: 'پیش‌پرداخت', amount: 5000000, dueDate: '1403/06/16', paidAt: '1403/06/16' },
          { id: 'inst-14-1', title: 'قسط ۱', amount: 2000000, dueDate: '1403/07/16', paidAt: '1403/07/15' },
          { id: 'inst-14-2', title: 'قسط ۲', amount: 2000000, dueDate: '1403/08/16', paidAt: null },
          { id: 'inst-14-3', title: 'قسط ۳', amount: 2000000, dueDate: '1403/09/16', paidAt: null },
        ],
      },
      date: '1403/06/16',
    },
    {
      id: 'reg-15',
      code: 'T-1403-0215',
      studentId: 'std-5',
      classId: 'cls-2',
      sessionId: 'ses-2-custom',
      status: 'cancelled',
      amount: 13800000,
      discount: 0,
      plan: {
        months: 0,
        downPayment: 13800000,
        installments: [
          { id: 'inst-15-cash', title: 'تسویه کامل نقدی', amount: 13800000, dueDate: '1403/06/21', paidAt: null },
        ],
      },
      date: '1403/06/21',
      notes: 'به علت تداخل با کلاس مدرسه انصراف داده شد',
    },
    {
      id: 'reg-16',
      code: 'T-1403-0216',
      studentId: 'std-2',
      classId: 'cls-5',
      sessionId: 'ses-5-even',
      status: 'approved',
      amount: 9500000,
      discount: 500000,
      plan: {
        months: 3,
        downPayment: 3000000,
        installments: [
          { id: 'inst-16-0', title: 'پیش‌پرداخت', amount: 3000000, dueDate: '1403/06/14', paidAt: '1403/06/14' },
          { id: 'inst-16-1', title: 'قسط ۱', amount: 2000000, dueDate: '1403/07/14', paidAt: '1403/07/13' },
          { id: 'inst-16-2', title: 'قسط ۲', amount: 2000000, dueDate: '1403/08/14', paidAt: null },
          { id: 'inst-16-3', title: 'قسط ۳', amount: 2000000, dueDate: '1403/09/14', paidAt: null },
        ],
      },
      date: '1403/06/14',
    },
  ];

  // NOTE: never ship real WooCommerce consumer keys in seed data.
  // Credentials must be entered by the admin at runtime (ideally via a
  // server-side proxy — see VITE_WOO_PROXY_BASE / HI-5).
  const wooSettings: WooSettings = {
    url: '',
    consumerKey: '',
    consumerSecret: '',
    isConnected: false,
    lastSync: '',
    syncLog: [
      {
        id: 'log-1',
        time: '1403/07/04 ۱۰:۳۰',
        message: 'همگام‌سازی خودکار سفارش‌های اخیر ووکامرس انجام شد (۲ سفارش جدید).',
        type: 'success',
      },
      {
        id: 'log-2',
        time: '1403/07/03 ۱۸:۱۵',
        message: 'بررسی وضعیت محصولات و زنگ‌های فعال با موفقیت انجام شد.',
        type: 'info',
      },
    ],
  };

  const academicYears: AcademicYear[] = [
    {
      id: 'ay-1403-1404',
      title: 'سال تحصیلی ۱۴۰۳-۱۴۰۴ (خرداد تا خرداد)',
      shortTitle: '۱۴۰۳-۱۴۰۴',
      periodLabel: 'خرداد ۱۴۰۳ تا خرداد ۱۴۰۴',
      startDate: '1403/03/01',
      endDate: '1404/03/01',
      isActive: true,
      isArchived: false,
      description: 'دوره آموزشی فعال سال تحصیلی جاری آموزشگاه - ثبت‌نام‌ها و زنگ‌های فعال',
    },
    {
      id: 'ay-1402-1403',
      title: 'سال تحصیلی ۱۴۰۲-۱۴۰۳ (بایگانی شده)',
      shortTitle: '۱۴۰۲-۱۴۰۳',
      periodLabel: 'خرداد ۱۴۰۲ تا خرداد ۱۴۰۳',
      startDate: '1402/03/01',
      endDate: '1403/03/01',
      isActive: false,
      isArchived: true,
      archivedAt: '1403/03/01',
      description: 'دوره آموزشی خاتمه یافته سال قبل - آرشیو جهت بررسی سوابق پرونده‌ها و حسابرسی',
      archivedData: {
        students: students.slice(0, 6),
        classes: classes.slice(0, 3),
        registrations: registrations.slice(0, 8),
      },
    },
  ];

  // ME-2 fix companion: seed sessions only carry the Persian display string
  // (`time`); run the same migration here so startTime/endTime/durationMinutes
  // are derived from the real time range (e.g. ۰۹:۰۰–۱۳:۰۰) instead of a
  // fixed guess.
  //
  // LO-5 companion: sample capacities must never be below the number of active
  // registrations for that bell, otherwise opening the edit form would show a
  // capacity that the reducer has to clamp on first save. Raise any such
  // capacity to the enrolled count (cancelled registrations don't occupy a
  // seat).
  const enrolledByBell = new Map<string, number>();
  for (const r of registrations) {
    if (r.status === 'cancelled') continue;
    const key = `${r.classId}::${r.sessionId}`;
    enrolledByBell.set(key, (enrolledByBell.get(key) || 0) + 1);
  }
  const seedClasses: ClassRoom[] = migrateSessionTimes(classes).map((c) => ({
    ...c,
    sessions: c.sessions.map((s) => {
      const enrolled = enrolledByBell.get(`${c.id}::${s.id}`) || 0;
      return { ...s, capacity: Math.max(s.capacity, enrolled), enrolledCount: enrolled };
    }),
  }));
  //
  // nextRegSeq seeds at the highest sequence used by the sample data so the
  // first newly issued code can never collide with an existing one.
  const allSeedCodes = [
    ...registrations.map((r) => r.code),
    ...academicYears.flatMap((y) => y.archivedData?.registrations?.map((r) => r.code) || []),
  ];
  return {
    students,
    classes: seedClasses,
    registrations,
    teachers: seedTeachers,
    counselors: seedCounselors,
    wooSettings,
    academicYears,
    activeYearId: 'ay-1403-1404',
    viewingYearId: 'ay-1403-1404',
    nextRegSeq: maxRegistrationSeq(allSeedCodes),
  };
}

// -------------------------------------------------------------
// Auto-Migration for Legacy Data in localStorage
// -------------------------------------------------------------
export function migrateLegacyData(parsed: any): {
  students: Student[];
  classes: ClassRoom[];
  registrations: Registration[];
  teachers: Teacher[];
  counselors: Counselor[];
  wooSettings: WooSettings;
  academicYears: AcademicYear[];
  activeYearId: string;
  viewingYearId: string;
  nextRegSeq: number;
} {
  const seed = buildSeedData();

  // LO-5 companion (archived snapshots): apply the same session-time backfill
  // and capacity clamp to archived year data so historical records never show
  // a bell whose capacity is below its enrolled count. The registrations used
  // for the clamp are the snapshot's own ones (falling back to the live list
  // when an archive predates per-year snapshots).
  const clampArchivedClasses = (classes: ClassRoom[], regs?: Registration[]): ClassRoom[] => {
    const sourceRegs = Array.isArray(regs) ? regs : migratedRegistrations;
    return migrateSessionTimes(classes).map((c) => ({
      ...c,
      sessions: c.sessions.map((s) => {
        const enrolled = sourceRegs.filter(
          (r) => r.classId === c.id && r.sessionId === s.id && r.status !== 'cancelled'
        ).length;
        return { ...s, capacity: Math.max(s.capacity, enrolled), enrolledCount: enrolled };
      }),
    }));
  };


  // 1. Students migration
  let migratedStudents: Student[] = [];
  if (Array.isArray(parsed?.students)) {
    migratedStudents = parsed.students.map((s: any, idx: number) => {
      let phones = s.phones;
      if (!phones || !Array.isArray(phones)) {
        // Old single phone field
        const rawPhone = s.phone || s.mobile || '09120000000';
        phones = [{ id: `p-${s.id || idx}-mig`, label: 'همراه', number: rawPhone }];
      }
      return {
        ...s,
        id: s.id || `std-${idx + 1}`,
        firstName: s.firstName || 'بدون نام',
        lastName: s.lastName !== undefined ? s.lastName : 'نامشخص',
        fatherName: s.fatherName || '',
        nationalId: s.nationalId || '0000000000',
        phones,
        grade: s.grade || 'هفتم',
        gpa: typeof s.gpa === 'number' ? s.gpa : 20.0,
        school: s.school || 'نامشخص',
        birthDate: s.birthDate || undefined,
        counselorId: s.counselorId || undefined,
        counselorName: s.counselorName || undefined,
        createdAt: s.createdAt || getTodayJalali(),
      };
    });
  } else {
    migratedStudents = seed.students;
  }

  // 2. Classes migration
  let migratedClasses: ClassRoom[] = [];
  if (Array.isArray(parsed?.classes)) {
    migratedClasses = parsed.classes.map((c: any, idx: number) => {
      let sessions = c.sessions;
      if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        sessions = [
          {
            id: `ses-${c.id || idx}-even`,
            kind: 'even',
            label: 'زنگ روزهای زوج (شنبه، دوشنبه، چهارشنبه)',
            days: 'شنبه، دوشنبه، چهارشنبه',
            time: '۱۶:۰۰ الی ۱۷:۳۰',
            capacity: c.capacity || 25,
          },
          {
            id: `ses-${c.id || idx}-odd`,
            kind: 'odd',
            label: 'زنگ روزهای فرد (یکشنبه، سه‌شنبه، پنجشنبه)',
            days: 'یکشنبه، سه‌شنبه، پنجشنبه',
            time: '۱۷:۴۵ الی ۱۹:۱۵',
            capacity: c.capacity || 25,
          },
        ];
      }
      return {
        id: c.id || `cls-${idx + 1}`,
        name: c.name || 'کلاس عمومی',
        grade: c.grade || 'هفتم',
        teacher: c.teacher || 'استاد مدعو',
        tuition: typeof c.tuition === 'number' ? c.tuition : 10000000,
        sessions,
      };
    });
  } else {
    migratedClasses = seed.classes;
  }

  // 3. Registrations migration
  let migratedRegistrations: Registration[] = [];
  if (Array.isArray(parsed?.registrations)) {
    migratedRegistrations = parsed.registrations.map((r: any, idx: number) => {
      // Find matching class
      const targetClass = migratedClasses.find((cls) => cls.id === r.classId) || migratedClasses[0];
      const sessionId = r.sessionId || targetClass?.sessions?.[0]?.id || 'ses-default';

      let plan = r.plan;
      if (!plan || !Array.isArray(plan.installments)) {
        // Construct single cash plan
        plan = {
          months: 0,
          downPayment: r.amount || targetClass?.tuition || 10000000,
          installments: [
            {
              id: `inst-mig-${r.id || idx}`,
              title: 'تسویه کامل نقدی',
              amount: r.amount || targetClass?.tuition || 10000000,
              dueDate: r.date || getTodayJalali(),
              paidAt: r.status === 'approved' ? (r.date || getTodayJalali()) : null,
            },
          ],
        };
      }

      return {
        id: r.id || `reg-${idx + 1}`,
        // Legacy short codes (`T-101`) are re-keyed to the global format in a
        // later pass (see normalizeRegistrationCodes below).
        code: r.code || '',
        studentId: r.studentId || migratedStudents[0]?.id || 'std-1',
        classId: r.classId || targetClass?.id || 'cls-1',
        sessionId,
        status: r.status || 'approved',
        amount: typeof r.amount === 'number' ? r.amount : (targetClass?.tuition || 10000000),
        discount: typeof r.discount === 'number' ? r.discount : 0,
        plan,
        date: r.date || getTodayJalali(),
        notes: r.notes || '',
      };
    });
  } else {
    migratedRegistrations = seed.registrations;
  }

  // ME-2: one-time migration — backfill startTime/endTime (and durationMinutes)
  // for sessions that only carry the Persian display string, so edit forms and
  // capacity/duration logic never fall back to a guessed 16:00–17:30.
  // LO-5 companion: raise any sample/legacy capacity that is below the number
  // of active registrations for that bell, so stored data can never show zero
  // or negative remaining seats.
  migratedClasses = migrateSessionTimes(migratedClasses).map((c) => ({
    ...c,
    sessions: c.sessions.map((s) => {
      const enrolled = migratedRegistrations.filter(
        (r) => r.classId === c.id && r.sessionId === s.id && r.status !== 'cancelled'
      ).length;
      return { ...s, capacity: Math.max(s.capacity, enrolled), enrolledCount: enrolled };
    }),
  }));

  let wooSettings = parsed?.wooSettings || seed.wooSettings;

  // CR-4 (security): older builds persisted the WooCommerce consumer key and
  // secret in plain text inside localStorage. Wipe them on load — credentials
  // are session-only now and must be re-entered by the admin (or, better,
  // moved to the server-side proxy). Idempotent: runs only when present.
  if (wooSettings && (wooSettings.consumerKey || wooSettings.consumerSecret)) {
    wooSettings = { ...wooSettings, consumerKey: '', consumerSecret: '' };
  }

  // HI-5 companion: mirror the last successful sync into the log once, so the
  // "همگام‌سازی" section has an auditable history even when it was previously
  // only reflected in wooSettings.lastSync. Idempotent via deterministic ids.
  if (wooSettings?.lastSync) {
    const syncLog: SyncLogItem[] = Array.isArray(wooSettings.syncLog) ? [...wooSettings.syncLog] : [];
    const logId = `log-autosync-${wooSettings.lastSync}`;
    if (!syncLog.some((l: SyncLogItem) => l && l.id === logId)) {
      syncLog.unshift({
        id: logId,
        time: String(wooSettings.lastSync),
        message: 'همگام‌سازی خودکار سفارش‌های ووکامرس با موفقیت انجام شد.',
        type: 'success',
      });
      wooSettings = { ...wooSettings, syncLog };
    }
  }

  let academicYears: AcademicYear[] = [];
  if (Array.isArray(parsed?.academicYears) && parsed.academicYears.length > 0) {
    academicYears = parsed.academicYears;
  } else {
    academicYears = seed.academicYears;
  }

  // ME-2 + LO-5: apply the session-time backfill AND the capacity clamp to
  // archived year snapshots so historical class records show/edit the correct
  // bell times and never a capacity below the snapshot's enrolled count.
  academicYears = academicYears.map((y: any) => {
    if (!y || !y.archivedData || !Array.isArray(y.archivedData.classes)) return y;
    const migratedArchivedClasses = clampArchivedClasses(
      y.archivedData.classes,
      y.archivedData.registrations
    );
    return { ...y, archivedData: { ...y.archivedData, classes: migratedArchivedClasses } };
  });

  // ---------------------------------------------------------------------
  // Tracking-code migration (global uniqueness fix):
  //   * re-key legacy `T-1xx` codes (live list AND every archived snapshot)
  //     to the canonical `T-<jalali-year>-<seq>` format,
  //   * then derive nextRegSeq from EVERY code that has ever existed —
  //     including deleted ones via the persisted high-water mark — so new
  //     codes can never collide with history or rewind after archiving.
  // ---------------------------------------------------------------------
  const todayParts = getTodayJalali().split('/');
  const currentJalaliYear = parseInt(todayParts[0], 10) || 1403;

  academicYears = academicYears.map((y: any) => {
    if (!y || !y.archivedData || !Array.isArray(y.archivedData.registrations)) return y;
    const fixed = normalizeRegistrationCodes(y.archivedData.registrations, currentJalaliYear);
    if (fixed.every((r, i) => r.code === y.archivedData.registrations[i].code)) return y;
    return { ...y, archivedData: { ...y.archivedData, registrations: fixed } };
  });
  migratedRegistrations = normalizeRegistrationCodes(migratedRegistrations, currentJalaliYear);

  const persistedSeq = Number(parsed?.nextRegSeq);
  const observedMaxSeq = maxRegistrationSeq([
    ...migratedRegistrations.map((r) => r.code),
    ...academicYears.flatMap(
      (y) => y.archivedData?.registrations?.map((r) => r.code) || []
    ),
  ]);
  const nextRegSeq = Math.max(
    Number.isFinite(persistedSeq) ? persistedSeq : 0,
    observedMaxSeq,
    seed.nextRegSeq
  );

  const activeYearId = parsed?.activeYearId || 'ay-1403-1404';
  const viewingYearId = parsed?.viewingYearId || activeYearId;

  return {
    students: migratedStudents,
    classes: migratedClasses,
    registrations: migratedRegistrations,
    teachers: Array.isArray(parsed?.teachers) && parsed.teachers.length > 0 ? parsed.teachers : seed.teachers,
    counselors: Array.isArray(parsed?.counselors) && parsed.counselors.length > 0 ? parsed.counselors : seed.counselors,
    wooSettings,
    academicYears,
    activeYearId,
    viewingYearId,
    nextRegSeq,
  };
}

/**
 * دریافت دقیق ۵ رکورد نمونه استاندارد موسسه علامه حلی
 * شامل ۵ دانش‌آموز، ۵ کلاس، ۵ ثبت‌نام همراه با دفترچه اقساط، مدرسین و مشاورین
 */
export function getFiveStandardSampleData(): {
  students: Student[];
  classes: ClassRoom[];
  registrations: Registration[];
  teachers: Teacher[];
  counselors: Counselor[];
} {
  const seed = buildSeedData();
  return {
    students: seed.students.slice(0, 5),
    classes: seed.classes.slice(0, 5),
    registrations: seed.registrations.slice(0, 5),
    teachers: seed.teachers.slice(0, 5),
    counselors: seed.counselors.slice(0, 3),
  };
}

