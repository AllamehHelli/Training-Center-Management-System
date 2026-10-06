/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HI-2 fix: single source of truth for student-form validation.
 * Shared by Students.tsx (add/edit form) and StudentDossierModal.tsx (edit path)
 * so neither route can bypass the rules (national-ID format & uniqueness,
 * phone validity, GPA range 0..20, required fields per Settings fieldSettings).
 */

import Papa from 'papaparse';
import { FieldSettings, PhoneNumber, Student } from './types';
import {
  toPersianDigits,
  toEnglishDigits,
  validateIranianMobile,
  validateNationalId,
  getTodayJalali,
} from './utils';

export interface StudentFormInput {
  firstName: string;
  lastName: string;
  fatherName: string;
  nationalId: string;
  grade: string;
  gpa: string | number; // raw input value (string) or existing numeric value
  school: string;
  phones: PhoneNumber[];
  counselorId?: string;
  counselorName?: string;
}

/**
 * HI-3 fix: grade list lives in localStorage (see Settings.tsx GRADES_STORAGE_KEY).
 * This module must not import from Settings.tsx (circular-import risk with the
 * component tree), so we read the same source of truth directly, falling back
 * to DEFAULT_GRADES when nothing was stored yet.
 */
const GRADES_STORAGE_KEY = 'helli_grades_list_v1';
const DEFAULT_GRADES_FALLBACK = ['ششم', 'هفتم', 'هشتم', 'نهم'];

export function getAvailableGrades(): string[] {
  try {
    const stored = localStorage.getItem(GRADES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((g) => typeof g === 'string')) {
        return parsed;
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_GRADES_FALLBACK;
}

/**
 * Validates a student form payload against the given field settings.
 * @param input raw (untrimmed / possibly Persian-digit) form values
 * @param fieldSettings which fields are mandatory (from Settings provider)
 * @param students existing students (for national-ID uniqueness check)
 * @param editingStudentId id of the student being edited (excluded from uniqueness check)
 * @returns map of field-name -> localized error message; empty map means valid
 */
export function validateStudent(
  input: StudentFormInput,
  fieldSettings: FieldSettings,
  students: Student[],
  editingStudentId?: string | null
): Record<string, string> {
  const errors: Record<string, string> = {};

  // Required text fields according to fieldSettings
  if (fieldSettings.firstName && !input.firstName.trim()) {
    errors.firstName = 'نام کوچک دانش‌آموز الزامی است';
  }
  if (fieldSettings.lastName && !input.lastName.trim()) {
    errors.lastName = 'نام خانوادگی الزامی است';
  }
  if (fieldSettings.fatherName && !input.fatherName.trim()) {
    errors.fatherName = 'نام پدر الزامی است';
  }

  // National ID: format + checksum + uniqueness
  if (fieldSettings.nationalId) {
    const nidCheck = validateNationalId(input.nationalId);
    if (!nidCheck.isValid) {
      errors.nationalId = nidCheck.message;
    } else {
      const cleanNid = toEnglishDigits(input.nationalId).trim();
      const dup = students.find(
        (s) => s.nationalId === cleanNid && s.id !== editingStudentId
      );
      if (dup) {
        errors.nationalId = 'کد ملی وارد شده قبلاً برای دانش‌آموز دیگری ثبت شده است';
      }
    }
  }

  // GPA: must be a number in [0, 20] when the field is enabled.
  // Note: 0 is a legitimate value and must NOT be treated as "empty".
  if (fieldSettings.gpa) {
    const gpaNum =
      typeof input.gpa === 'number' ? input.gpa : parseFloat(toEnglishDigits(String(input.gpa)));
    if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 20) {
      errors.gpa = 'معدل باید عددی بین ۰ تا ۲۰ باشد';
    }
  }

  // School
  if (fieldSettings.school && !input.school.trim()) {
    errors.school = 'نام مدرسه فعلی الزامی است';
  }

  // HI-3 fix: grade must be one of the grades defined in Settings
  // (previously the bulk CSV path accepted any arbitrary grade string).
  const availableGrades = getAvailableGrades();
  if (!input.grade || !input.grade.trim()) {
    errors.grade = 'پایه تحصیلی الزامی است';
  } else if (!availableGrades.includes(input.grade.trim())) {
    errors.grade = `پایه تحصیلی «${input.grade.trim()}» در فهرست پایه‌های تعریف‌شده در تنظیمات وجود ندارد`;
  }

  // Phones: at least one when enabled, and every provided number must be valid
  if (fieldSettings.phones) {
    if (!input.phones || input.phones.length === 0) {
      errors.phones = 'حداقل یک شماره تماس الزامی است';
    } else {
      let phoneErr = '';
      for (let i = 0; i < input.phones.length; i++) {
        const ph = input.phones[i];
        const check = validateIranianMobile(ph.number);
        if (!check.isValid) {
          phoneErr = `ردیف ${toPersianDigits(i + 1)} (${ph.label}): ${check.message}`;
          break;
        }
      }
      if (phoneErr) errors.phones = phoneErr;
    }
  }

  return errors;
}

/** Build a cleaned Student object from a validated form input. */
export function buildStudentFromInput(
  input: StudentFormInput,
  base: Pick<Student, 'id' | 'createdAt'> & Partial<Student>
): Student {
  const gpaNum =
    typeof input.gpa === 'number' ? input.gpa : parseFloat(toEnglishDigits(String(input.gpa)));
  return {
    ...(base as Student),
    id: base.id,
    createdAt: base.createdAt,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    fatherName: input.fatherName.trim(),
    nationalId: toEnglishDigits(input.nationalId).trim(),
    grade: input.grade as Student['grade'],
    // HI-2 fix: keep a legitimate 0 instead of falling back via `||`
    gpa: isNaN(gpaNum) ? (typeof base.gpa === 'number' ? base.gpa : 20) : gpaNum,
    school: input.school.trim(),
    phones: (input.phones || [])
      .filter((p) => p.number.trim().length > 0)
      .map((p) => ({ ...p, number: toEnglishDigits(p.number).trim() })),
    counselorId: input.counselorId ? input.counselorId.trim() : (base.counselorId || undefined),
    counselorName: input.counselorName ? input.counselorName.trim() : (base.counselorName || undefined),
  };
}

// ---------------------------------------------------------------------------
// HI-3 fix: bulk CSV import — proper RFC-4180 parsing (PapaParse) + the same
// validation rules as the single-student form, plus duplicate detection both
// against existing students and within the file itself. Rejected rows are
// reported per-line before anything is committed to the store.
// ---------------------------------------------------------------------------

export const BULK_CSV_HEADERS = [
  'نام',
  'نام خانوادگی',
  'نام پدر',
  'کد ملی',
  'پایه',
  'معدل',
  'مدرسه',
  'شماره همراه',
];

export interface BulkRowResult {
  /** 1-based line number shown to the user (header excluded from data lines). */
  lineNo: number;
  input: StudentFormInput;
  errors: string[]; // empty => row is ready to import
}

export interface BulkCsvReport {
  totalDataRows: number;
  validCount: number;
  invalidCount: number;
  results: BulkRowResult[];
  /** fatal, file-level problems (empty header, wrong columns, parse errors…) */
  fileErrors: string[];
}

/** Normalize a Persian/Arabic-text header cell for tolerant matching. */
function normalizeHeader(h: string): string {
  return String(h || '')
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/[\u200c]/g, ' ') // ZWNJ -> space
    .replace(/\s+/g, ' ');
}

const HEADER_ALIASES: Record<string, keyof Omit<StudentFormInput, 'phones'> | 'phone' | 'fullName'> = {
  'نام': 'firstName',
  'نام کوچک': 'firstName',
  'نام خانوادگی': 'lastName',
  'نام و خانوادگی': 'fullName',
  'نام کامل': 'fullName',
  'نام دانش‌آموز': 'fullName',
  'نام دانش آموز': 'fullName',
  'دانش‌آموز': 'fullName',
  'دانش آموز': 'fullName',
  'billing_name': 'fullName',
  'name': 'fullName',
  'نام پدر': 'fatherName',
  'father_name': 'fatherName',
  'کد ملی': 'nationalId',
  'کدملی': 'nationalId',
  'شماره ملی': 'nationalId',
  'کد ملی دانش آموز': 'nationalId',
  'national_id': 'nationalId',
  'nationalid': 'nationalId',
  'nid': 'nationalId',
  'پایه': 'grade',
  'پایه تحصیلی': 'grade',
  'grade': 'grade',
  'معدل': 'gpa',
  'gpa': 'gpa',
  'مدرسه': 'school',
  'نام مدرسه': 'school',
  'school': 'school',
  'شماره همراه': 'phone',
  'موبایل': 'phone',
  'شماره موبایل': 'phone',
  'تلفن همراه': 'phone',
  'تلفن': 'phone',
  'همراه': 'phone',
  'phone': 'phone',
  'mobile': 'phone',
  'billing_phone': 'phone',
};

/**
 * Parse & validate a bulk CSV text WITHOUT committing anything.
 * Uses PapaParse so quoted values containing commas/newlines survive intact.
 */
export function parseAndValidateBulkCSV(
  text: string,
  fieldSettings: FieldSettings,
  existingStudents: Student[],
  extraReservedNationalIds: string[] = []
): BulkCsvReport {
  const report: BulkCsvReport = {
    totalDataRows: 0,
    validCount: 0,
    invalidCount: 0,
    results: [],
    fileErrors: [],
  };

  if (!text || !text.trim()) {
    report.fileErrors.push('متن فایل خالی است.');
    return report;
  }

  const parsed = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: 'greedy',
    delimiter: ',',
  });

  if (parsed.errors.length > 0) {
    for (const err of parsed.errors.slice(0, 5)) {
      report.fileErrors.push(`خطای تجزیه فایل در سطر ${toPersianDigits(String((err.row ?? 0) + 1))}: ${err.message}`);
    }
  }

  const rows = (parsed.data as unknown as string[][]).filter(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== '')
  );

  if (rows.length === 0) {
    report.fileErrors.push('هیچ ردیف داده‌ای در فایل یافت نشد.');
    return report;
  }

  // Map header names -> column indexes (tolerant to ordering & aliases)
  const header = rows[0].map(normalizeHeader);
  const colIndex: Partial<Record<keyof Omit<StudentFormInput, 'phones'> | 'phone' | 'fullName', number>> = {};
  header.forEach((h, idx) => {
    const key = HEADER_ALIASES[h];
    if (key && colIndex[key] === undefined) colIndex[key] = idx;
  });

  const hasSeparateNames = colIndex['firstName'] !== undefined && colIndex['lastName'] !== undefined;
  const hasFullName = colIndex['fullName'] !== undefined;

  if (!hasSeparateNames && !hasFullName) {
    report.fileErrors.push('سطر عنوان فایل باید حداقل ستون‌های «نام» و «نام خانوادگی» (یا «نام و خانوادگی») را داشته باشد.');
    return report;
  }
  if (colIndex['phone'] === undefined) {
    report.fileErrors.push('ستون «شماره همراه» یا «موبایل» در سطر عنوان فایل یافت نشد.');
    return report;
  }

  const cell = (row: string[], key: keyof typeof colIndex): string => {
    const i = colIndex[key];
    return i === undefined ? '' : String(row[i] ?? '').trim();
  };

  // Uniqueness pool: existing DB students + reserved ids supplied by caller
  const seenNids = new Set<string>(extraReservedNationalIds);

  const dataRows = rows.slice(1);
  dataRows.forEach((row, idx) => {
    const lineNo = idx + 2; // +1 for 0-based, +1 because the header occupies line 1
    report.totalDataRows += 1;

    let firstName = cell(row, 'firstName');
    let lastName = cell(row, 'lastName');

    if ((!firstName || !lastName) && hasFullName) {
      const full = cell(row, 'fullName');
      if (full) {
        const parts = full.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          firstName = parts[0];
          lastName = '';
        } else if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
      }
    }

    const input: StudentFormInput = {
      firstName,
      lastName,
      fatherName: cell(row, 'fatherName'),
      nationalId: cell(row, 'nationalId'),
      grade: cell(row, 'grade') || 'هفتم',
      gpa: cell(row, 'gpa') || '20.00',
      school: cell(row, 'school') || 'تیزهوشان',
      phones: [{ id: `p-bulk-${lineNo}`, label: 'همراه', number: cell(row, 'phone') }],
    };

    // Same shared rules as the single-student form (HI-2 module), checked
    // against existing students…
    const fieldErrors = validateStudent(input, fieldSettings, existingStudents);
    const errors = Object.values(fieldErrors);

    // …plus in-file duplicate detection on the national ID.
    const cleanNid = toEnglishDigits(input.nationalId).trim();
    if (cleanNid && !errors.some((e) => e.includes('کد ملی'))) {
      if (seenNids.has(cleanNid)) {
        errors.push('کد ملی این سطر با سطر تکراری دیگری در همان فایل است');
      } else {
        seenNids.add(cleanNid);
      }
    }

    if (errors.length === 0) report.validCount += 1;
    else report.invalidCount += 1;

    report.results.push({ lineNo, input, errors });
  });

  if (report.totalDataRows === 0) {
    report.fileErrors.push('لطفاً حداقل یک ردیف داده وارد نمایید.');
  }

  return report;
}

/** Convert validated bulk rows into Student objects ready for BULK_ADD_STUDENTS. */
export function buildStudentsFromBulkResults(
  results: BulkRowResult[],
  batchId: string
): Student[] {
  return results
    .filter((r) => r.errors.length === 0)
    .map((r) =>
      buildStudentFromInput(r.input, {
        id: `std-${batchId}-${r.lineNo}`,
        createdAt: getTodayJalali(),
      })
    );
}
