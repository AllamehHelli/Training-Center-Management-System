/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HI-2 fix: single source of truth for student-form validation.
 * Shared by Students.tsx (add/edit form) and StudentDossierModal.tsx (edit path)
 * so neither route can bypass the rules (national-ID format & uniqueness,
 * phone validity, GPA range 0..20, required fields per Settings fieldSettings).
 */

import { FieldSettings, PhoneNumber, Student } from './types';
import {
  toPersianDigits,
  toEnglishDigits,
  validateIranianMobile,
  validateNationalId,
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
  };
}
