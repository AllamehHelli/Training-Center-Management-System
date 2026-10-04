/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useReducer, useEffect, useRef, useState } from 'react';
import {
  Student,
  ClassRoom,
  Registration,
  RegistrationStatus,
  WooSettings,
  SyncLogItem,
  AcademicYear,
  AcademicYearDataSnapshot,
  Teacher,
  Counselor,
} from './types';
import { buildSeedData, migrateLegacyData, maxRegistrationSeq, makeRegistrationCode, getFiveStandardSampleData } from './data';
import { getTodayJalali, migrateSessionTimes } from './utils';
import { ToastType, ToastItem, getGlobalToast } from './ui';
import { IconAlert, IconCheck, IconClose } from './icons';
import { BACKEND_ENABLED, serverApi, syncAction, getToken } from './api';
import { logger } from './logger';

const STORAGE_KEY = 'helli_institute_data_v2';

/**
 * CR-4 (security): session-only WooCommerce consumer credentials.
 *
 * The reducer keeps consumerKey/consumerSecret in memory (so the current
 * render can use them), but they are stripped from every copy written to
 * localStorage and wiped on reload. In an operational deployment the keys
 * should never touch the browser at all — attach them server-side in the
 * proxy configured via `proxyBaseUrl` / VITE_WOO_PROXY_BASE (see HI-5 and
 * docs/SECURITY.md).
 */
export function stripWooCredentials(state: AppState): AppState {
  if (!state.wooSettings) return state;
  if (!state.wooSettings.consumerKey && !state.wooSettings.consumerSecret) return state;
  const { consumerKey: _k, consumerSecret: _s, ...safe } = state.wooSettings;
  return { ...state, wooSettings: safe as WooSettings };
}

/** Whether WooCommerce credentials are currently held in this browser session. */
export function hasWooCredentials(w: WooSettings | undefined): boolean {
  return Boolean(w && (w.consumerKey || w.consumerSecret));
}

/**
 * HI-1: RESET_DATA is a destructive demo-only action that replaces the entire
 * state (including archived academic years) with seed data. It must never be
 * reachable in an operational build, so it is gated behind an explicit env
 * flag in addition to `import.meta.env.DEV`.
 */
export const DEMO_TOOLS_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_TOOLS === 'true';

/** HI-1: key prefix for automatic pre-reset backups kept in localStorage. */
const RESET_BACKUP_PREFIX = 'helli_institute_backup_before_reset_';

/** Current Jalali year used as the prefix of newly issued tracking codes. */
function currentJalaliYearForCodes(): number {
  const jy = parseInt(getTodayJalali().split('/')[0], 10);
  return Number.isFinite(jy) ? jy : 1403;
}

/**
 * HI-1: automatically export the full current dataset (including archives) as
 * a JSON backup file before any reset happens, so the operation stays
 * recoverable instead of permanently destroying records.
 */
export function downloadStateBackup(state: AppState): void {
  try {
    // CR-4: backups are plain files that may leave the machine — never embed
    // WooCommerce credentials in them.
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), version: 2, state: stripWooCredentials(state) });
    // Keep one in-app snapshot too (best-effort; storage may be full).
    try {
      localStorage.setItem(`${RESET_BACKUP_PREFIX}${Date.now()}`, payload);
    } catch {
      /* non-fatal: the downloaded file is the primary safety net */
    }
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `پشتیبان-پیش-از-بازنشانی-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) {
    console.error('Error creating pre-reset backup', e);
  }
}

/**
 * CR-1: Actions that mutate the currently displayed dataset (students /
 * classes / registrations). While an archived academic year is being viewed
 * (viewingYearId !== activeYearId) these actions are rejected at the dispatch
 * layer so historical records can never be altered.
 */
export const MUTATING_ACTION_TYPES: ReadonlySet<AppAction['type']> = new Set<AppAction['type']>([
  'ADD_STUDENT',
  'UPDATE_STUDENT',
  'DELETE_STUDENT',
  'BULK_ADD_STUDENTS',
  'ADD_CLASS',
  'UPDATE_CLASS',
  'DELETE_CLASS',
  'ADD_TEACHER',
  'UPDATE_TEACHER',
  'DELETE_TEACHER',
  'ADD_COUNSELOR',
  'UPDATE_COUNSELOR',
  'DELETE_COUNSELOR',
  'ADD_REGISTRATION',
  'UPDATE_REGISTRATION',
  'UPDATE_REGISTRATION_STATUS',
  'DELETE_REGISTRATION',
  'MARK_INSTALLMENT_PAID',
  'REFUND_INSTALLMENT',
  'RESTORE_FIVE_SAMPLES',
  // CR-3: WooCommerce order sync creates students/registrations too, so it
  // must be blocked while an archived year is being viewed.
  'SYNC_WOO_ORDERS',
]);

export const ARCHIVED_READONLY_MESSAGE =
  'سال تحصیلی در حال مشاهده بایگانی‌شده و فقط‌خواندنی است؛ برای افزودن، ویرایش یا حذف اطلاعات ابتدا به سال فعال بازگردید.';

/**
 * LO-5: clamp each bell's capacity to at least the number of active
 * (non-cancelled) registrations for that bell, and stamp the derived
 * `enrolledCount` on the session so every consumer (cards, pickers, forms)
 * reads one consistent source of truth instead of recomputing it.
 */
function stampEnrolledCounts(cls: ClassRoom, state: AppState): ClassRoom {
  const enrolledFor = (sessionId: string) =>
    state.registrations.filter(
      (r) => r.classId === cls.id && r.sessionId === sessionId && r.status !== 'cancelled'
    ).length;
  return {
    ...cls,
    sessions: cls.sessions.map((s) => {
      const enrolled = enrolledFor(s.id);
      return {
        ...s,
        enrolledCount: enrolled,
        capacity: Math.max(Number(s.capacity) || 0, enrolled),
      };
    }),
  };
}

export interface AppState {
  academicYears: AcademicYear[];
  activeYearId: string;
  viewingYearId: string;
  students: Student[];
  classes: ClassRoom[];
  registrations: Registration[];
  teachers: Teacher[];
  counselors: Counselor[];
  wooSettings: WooSettings;
  /**
   * Global high-water mark for registration tracking codes. It only ever
   * increases — independent of the academic year and of deletions — so a code
   * like T-1405-0007 can never be issued twice, even after starting a new
   * year or deleting the registration that owned it.
   */
  nextRegSeq: number;
}

export type AppAction =
  | { type: 'ADD_STUDENT'; payload: Student }
  | { type: 'UPDATE_STUDENT'; payload: Student }
  | { type: 'DELETE_STUDENT'; payload: string }
  | { type: 'BULK_ADD_STUDENTS'; payload: Student[] }
  | { type: 'ADD_CLASS'; payload: ClassRoom }
  | { type: 'UPDATE_CLASS'; payload: ClassRoom }
  | { type: 'DELETE_CLASS'; payload: string }
  | { type: 'ADD_TEACHER'; payload: Teacher }
  | { type: 'UPDATE_TEACHER'; payload: Teacher }
  | { type: 'DELETE_TEACHER'; payload: string }
  | { type: 'ADD_COUNSELOR'; payload: Counselor }
  | { type: 'UPDATE_COUNSELOR'; payload: Counselor }
  | { type: 'DELETE_COUNSELOR'; payload: string }
  | { type: 'ADD_REGISTRATION'; payload: Registration }
  | { type: 'UPDATE_REGISTRATION_STATUS'; payload: { id: string; status: RegistrationStatus } }
  | { type: 'UPDATE_REGISTRATION'; payload: Registration }
  | { type: 'DELETE_REGISTRATION'; payload: string }
  | { type: 'MARK_INSTALLMENT_PAID'; payload: { regId: string; instId: string; paidAt?: string } }
  | { type: 'REFUND_INSTALLMENT'; payload: { regId: string; instId: string } }
  | { type: 'UPDATE_WOO_SETTINGS'; payload: Partial<WooSettings> }
  | { type: 'ADD_WOO_LOG'; payload: Omit<SyncLogItem, 'id'> }
  | { type: 'SYNC_WOO_PRODUCTS'; payload: ClassRoom[] }
  | { type: 'SYNC_WOO_ORDERS'; payload: { newStudents: Student[]; newRegistrations: Registration[] } }
  | { type: 'RESET_DATA' }
  | { type: 'SET_VIEWING_YEAR'; payload: string }
  | {
      type: 'ARCHIVE_AND_START_NEW_YEAR';
      payload: {
        newYear: {
          id: string;
          title: string;
          shortTitle: string;
          periodLabel: string;
          startDate: string;
          endDate: string;
          description?: string;
        };
        keepStudents: boolean;
        keepClasses: boolean;
      };
    }
  | { type: 'UPDATE_ACADEMIC_YEAR'; payload: Partial<AcademicYear> & { id: string } }
  | { type: 'ADD_ACADEMIC_YEAR'; payload: AcademicYear }
  | { type: 'DELETE_ACADEMIC_YEAR'; payload: string }
  | { type: 'RESTORE_FIVE_SAMPLES' }
  // Server truth replaces the local optimistic copy after login/refresh.
  | { type: 'HYDRATE_FROM_SERVER'; payload: AppState };


function appReducer(state: AppState, action: AppAction): AppState {
  // Server truth wins wholesale on hydrate (login / refresh).
  if (action.type === 'HYDRATE_FROM_SERVER') return action.payload;
  // ------------------------------------------------------------------
  // Tracking-code issuance (global uniqueness fix).
  //
  // Codes are ALWAYS issued here — never by callers — from a persisted
  // monotonic high-water mark (`nextRegSeq`) combined with the current
  // Jalali year. The counter survives year archiving and deletions, so:
  //   * starting a new academic year can no longer restart numbering at
  //     T-101 and collide with last year's archived receipts;
  //   * deleting a registration can no longer cause its code to be reused.
  // A final collision check against every live + archived code is kept as a
  // defensive belt-and-braces guard.
  // ------------------------------------------------------------------
  const allKnownCodes = (): Set<string> => {
    const set = new Set<string>();
    state.registrations.forEach((r) => r.code && set.add(r.code));
    state.academicYears.forEach((y) =>
      (y.archivedData?.registrations || []).forEach((r) => r.code && set.add(r.code))
    );
    return set;
  };

  const issueRegistrationCode = (taken: Set<string>): string => {
    let seq = state.nextRegSeq;
    let code = '';
    do {
      seq += 1;
      code = makeRegistrationCode(currentJalaliYearForCodes(), seq);
    } while (taken.has(code));
    return code;
  };

  switch (action.type) {
    case 'ADD_STUDENT':
      return { ...state, students: [action.payload, ...state.students] };

    case 'UPDATE_STUDENT':
      return {
        ...state,
        students: state.students.map((s) => (s.id === action.payload.id ? action.payload : s)),
      };

    case 'DELETE_STUDENT':
      return {
        ...state,
        students: state.students.filter((s) => s.id !== action.payload),
        registrations: state.registrations.filter((r) => r.studentId !== action.payload),
      };

    case 'BULK_ADD_STUDENTS':
      return { ...state, students: [...action.payload, ...state.students] };

    case 'ADD_CLASS':
      return { ...state, classes: [stampEnrolledCounts(action.payload, state), ...state.classes] };

    case 'UPDATE_CLASS': {
      // LO-5 hard guard: a bell's capacity can never be persisted below the
      // number of active (non-cancelled) registrations for that bell, even if
      // some UI path forgets to validate. The value is clamped up to the
      // enrolled count instead of rejecting the whole save.
      const incoming = stampEnrolledCounts(action.payload, state);
      // ME-2: defensive normalization — never persist a session whose stored
      // start/end times contradict its display `time` string (e.g. an old
      // guessed 16:00–17:30 saved from a stale form state).
      return {
        ...state,
        classes: migrateSessionTimes(
          state.classes.map((c) => (c.id === incoming.id ? incoming : c))
        ),
      };
    }

    case 'DELETE_CLASS':
      return {
        ...state,
        classes: state.classes.filter((c) => c.id !== action.payload),
        registrations: state.registrations.filter((r) => r.classId !== action.payload),
      };

    case 'ADD_REGISTRATION': {
      // Tracking codes are issued centrally here (never by the caller) so the
      // sequence is global, monotonic and collision-free across years/deletes.
      const taken = allKnownCodes();
      const code = issueRegistrationCode(taken);
      const registration: Registration = { ...action.payload, code };
      const seq = parseInt(code.split('-')[2], 10) || state.nextRegSeq;
      return {
        ...state,
        nextRegSeq: Math.max(state.nextRegSeq, seq),
        registrations: [registration, ...state.registrations],
      };
    }

    case 'UPDATE_REGISTRATION_STATUS':
      return {
        ...state,
        registrations: state.registrations.map((r) =>
          r.id === action.payload.id ? { ...r, status: action.payload.status } : r
        ),
      };

    case 'UPDATE_REGISTRATION':
      return {
        ...state,
        registrations: state.registrations.map((r) => (r.id === action.payload.id ? action.payload : r)),
      };

    case 'DELETE_REGISTRATION':
      return {
        ...state,
        registrations: state.registrations.filter((r) => r.id !== action.payload),
      };

    case 'MARK_INSTALLMENT_PAID': {
      const today = action.payload.paidAt || getTodayJalali();
      return {
        ...state,
        registrations: state.registrations.map((r) => {
          if (r.id !== action.payload.regId) return r;
          const updatedInstallments = r.plan.installments.map((inst) =>
            inst.id === action.payload.instId ? { ...inst, paidAt: today } : inst
          );
          return {
            ...r,
            plan: {
              ...r.plan,
              installments: updatedInstallments,
            },
          };
        }),
      };
    }

    case 'REFUND_INSTALLMENT':
      return {
        ...state,
        registrations: state.registrations.map((r) => {
          if (r.id !== action.payload.regId) return r;
          const updatedInstallments = r.plan.installments.map((inst) =>
            inst.id === action.payload.instId ? { ...inst, paidAt: null } : inst
          );
          return {
            ...r,
            plan: {
              ...r.plan,
              installments: updatedInstallments,
            },
          };
        }),
      };

    case 'UPDATE_WOO_SETTINGS':
      return {
        ...state,
        wooSettings: { ...state.wooSettings, ...action.payload },
      };

    case 'ADD_WOO_LOG': {
      const newLogItem: SyncLogItem = {
        id: `log-${Date.now()}-${Math.random()}`,
        ...action.payload,
      };
      return {
        ...state,
        wooSettings: {
          ...state.wooSettings,
          syncLog: [newLogItem, ...state.wooSettings.syncLog].slice(0, 50),
        },
      };
    }

    case 'SYNC_WOO_PRODUCTS':
      return {
        ...state,
        classes: [...action.payload, ...state.classes],
      };

    case 'SYNC_WOO_ORDERS': {
      // CR-3: The reducer is the last line of defense — even if a caller
      // bypasses UI validation, we never import:
      //  - an order whose wooOrderId was already synced (idempotency),
      //  - a student with a duplicate national ID,
      //  - a registration that exceeds the session capacity or duplicates an
      //    existing active registration for the same session.
      const seenOrderIds = new Set(
        state.registrations.map((r) => String(r.wooOrderId)).filter((v) => v !== 'undefined')
      );
      const studentsById = new Map(state.students.map((s) => [s.id, s]));
      const nationalIds = new Set(
        state.students.map((s) => String(s.nationalId).trim()).filter(Boolean)
      );
      const classesById = new Map(state.classes.map((c) => [c.id, c]));

      const newStudentsPayload = action.payload.newStudents || [];
      const newRegistrations = action.payload.newRegistrations || [];
      const rejectedReasons: string[] = [];
      const acceptedRegIds = new Set<string>();
      const acceptedStudentIds = new Set<string>();

      for (const reg of newRegistrations) {
        const orderKey = reg.wooOrderId !== undefined ? String(reg.wooOrderId) : undefined;

        if (orderKey && seenOrderIds.has(orderKey)) {
          rejectedReasons.push(`سفارش #${orderKey} قبلاً همگام شده است`);
          continue;
        }

        const payloadStudent =
          newStudentsPayload.find((s) => s.id === reg.studentId) ||
          studentsById.get(reg.studentId);
        if (!payloadStudent) {
          rejectedReasons.push(`ثبت‌نام ${reg.code}: دانش‌آموز مرتبط یافت نشد`);
          continue;
        }

        const nid = String(payloadStudent.nationalId || '').trim();
        if (!nid || nationalIds.has(nid)) {
          rejectedReasons.push(
            `ثبت‌نام ${reg.code}: کد ملی تکراری یا نامعتبر (${payloadStudent.firstName} ${payloadStudent.lastName})`
          );
          continue;
        }

        const cls = classesById.get(reg.classId);
        const ses = cls?.sessions.find((s) => s.id === reg.sessionId);
        if (!cls || !ses) {
          rejectedReasons.push(`ثبت‌نام ${reg.code}: کلاس یا زنگ برگزاری نامعتبر است`);
          continue;
        }

        const enrolledInSession =
          state.registrations.filter(
            (r) => r.classId === reg.classId && r.sessionId === reg.sessionId && r.status !== 'cancelled'
          ).length +
          // registrations already accepted within this same batch
          [...acceptedRegIds].reduce((acc, id) => {
            const a = newRegistrations.find((r) => r.id === id);
            return a && a.classId === reg.classId && a.sessionId === reg.sessionId ? acc + 1 : acc;
          }, 0);
        if (enrolledInSession >= ses.capacity) {
          rejectedReasons.push(`ثبت‌نام ${reg.code}: ظرفیت زنگ «${ses.label}» تکمیل شده است`);
          continue;
        }

        const duplicate = state.registrations.some(
          (r) =>
            r.studentId === reg.studentId &&
            r.classId === reg.classId &&
            r.sessionId === reg.sessionId &&
            r.status !== 'cancelled'
        );
        if (duplicate) {
          rejectedReasons.push(`ثبت‌نام ${reg.code}: این دانش‌آموز در این زنگ قبلاً ثبت‌نام کرده است`);
          continue;
        }

        acceptedRegIds.add(reg.id);
        acceptedStudentIds.add(payloadStudent.id);
        nationalIds.add(nid);
        if (orderKey) seenOrderIds.add(orderKey);
      }

      const acceptedStudents = newStudentsPayload.filter(
        (s) => acceptedStudentIds.has(s.id) && !studentsById.has(s.id)
      );
      // Tracking codes for imported orders are issued by the same central
      // allocator as manual registrations (global, monotonic, collision-free).
      const wooTaken = allKnownCodes();
      let wooSeq = state.nextRegSeq;
      const acceptedRegistrations = newRegistrations
        .filter((r) => acceptedRegIds.has(r.id))
        .map((r) => {
          wooSeq += 1;
          let code = makeRegistrationCode(currentJalaliYearForCodes(), wooSeq);
          while (wooTaken.has(code)) {
            wooSeq += 1;
            code = makeRegistrationCode(currentJalaliYearForCodes(), wooSeq);
          }
          wooTaken.add(code);
          return { ...r, code };
        });

      if (acceptedStudents.length === 0 && acceptedRegistrations.length === 0) {
        if (rejectedReasons.length > 0) {
          console.warn('SYNC_WOO_ORDERS rejected:', rejectedReasons.join(' | '));
        }
        return state;
      }

      const maxAcceptedSeq = acceptedRegistrations.reduce(
        (acc, r) => Math.max(acc, parseInt(String(r.code).split('-')[2], 10) || 0),
        state.nextRegSeq
      );

      return {
        ...state,
        nextRegSeq: maxAcceptedSeq,
        students: [...acceptedStudents, ...state.students],
        registrations: [...acceptedRegistrations, ...state.registrations],
      };
    }

    case 'RESET_DATA':
      return buildSeedData();

    case 'RESTORE_FIVE_SAMPLES': {
      const five = getFiveStandardSampleData();
      return {
        ...state,
        students: five.students,
        classes: five.classes,
        registrations: five.registrations,
        teachers: five.teachers,
        counselors: five.counselors,
        nextRegSeq: Math.max(state.nextRegSeq || 0, 105),
      };
    }

    case 'SET_VIEWING_YEAR': {
      const targetYearId = action.payload;
      if (targetYearId === state.viewingYearId) return state;

      // CR-1 fix: only the ACTIVE year owns the live working dataset. The
      // displayed data for archived years is an immutable read-only snapshot
      // stored in `archivedData`. We persist the live dataset ONLY into the
      // active year (previously any year being viewed was overwritten with
      // whatever happened to be in memory, permanently corrupting history).
      const updatedYears =
        state.viewingYearId === state.activeYearId
          ? state.academicYears.map((y) =>
              y.id === state.activeYearId
                ? {
                    ...y,
                    archivedData: {
                      students: state.students,
                      classes: state.classes,
                      registrations: state.registrations,
                    },
                  }
                : y
            )
          : state.academicYears;

      // Find target year
      const targetYear = updatedYears.find((y) => y.id === targetYearId);
      if (!targetYear) return { ...state, academicYears: updatedYears };

      if (targetYearId === state.activeYearId) {
        // Restore the live dataset from the active year's own snapshot
        // (falling back to empty collections only if never initialized).
        const live: AcademicYearDataSnapshot = targetYear.archivedData || {
          students: [],
          classes: [],
          registrations: [],
        };
        return {
          ...state,
          academicYears: updatedYears,
          viewingYearId: targetYearId,
          students: live.students || [],
          classes: live.classes || [],
          registrations: live.registrations || [],
        };
      }

      // Archived year: load its historical snapshot strictly read-only.
      const snapshot = targetYear.archivedData || {
        students: [],
        classes: [],
        registrations: [],
      };

      return {
        ...state,
        academicYears: updatedYears,
        viewingYearId: targetYearId,
        students: snapshot.students || [],
        classes: snapshot.classes || [],
        registrations: snapshot.registrations || [],
      };
    }

    case 'ARCHIVE_AND_START_NEW_YEAR': {
      const { newYear, keepStudents, keepClasses } = action.payload;
      const today = getTodayJalali();

      // Current active year is marked archived with its current snapshot
      const updatedYears = state.academicYears.map((y) => {
        if (y.id === state.activeYearId) {
          return {
            ...y,
            isActive: false,
            isArchived: true,
            archivedAt: today,
            archivedData: {
              students: state.students,
              classes: state.classes,
              registrations: state.registrations,
            },
          };
        }
        return { ...y, isActive: false };
      });

      const fullNewYear: AcademicYear = {
        id: newYear.id || `ay-${Date.now()}`,
        title: newYear.title,
        shortTitle: newYear.shortTitle,
        periodLabel: newYear.periodLabel,
        startDate: newYear.startDate,
        endDate: newYear.endDate,
        isActive: true,
        isArchived: false,
        description: newYear.description || '',
      };

      const newStudents = keepStudents ? state.students.map((s) => ({ ...s })) : [];
      const newClasses = keepClasses
        ? state.classes.map((c) => ({
            ...c,
            sessions: c.sessions.map((s) => ({ ...s })),
          }))
        : [];
      const newRegistrations: Registration[] = [];

      return {
        ...state,
        academicYears: [fullNewYear, ...updatedYears],
        activeYearId: fullNewYear.id,
        viewingYearId: fullNewYear.id,
        students: newStudents,
        classes: newClasses,
        registrations: newRegistrations,
      };
    }

    case 'UPDATE_ACADEMIC_YEAR': {
      const updated = state.academicYears.map((y) =>
        y.id === action.payload.id ? { ...y, ...action.payload } : y
      );
      return { ...state, academicYears: updated };
    }

    case 'ADD_ACADEMIC_YEAR': {
      return {
        ...state,
        academicYears: [action.payload, ...state.academicYears],
      };
    }

    case 'DELETE_ACADEMIC_YEAR': {
      if (action.payload === state.activeYearId) return state;
      const updated = state.academicYears.filter((y) => y.id !== action.payload);
      return {
        ...state,
        academicYears: updated,
        viewingYearId: state.viewingYearId === action.payload ? state.activeYearId : state.viewingYearId,
      };
    }

    case 'ADD_TEACHER':
      return { ...state, teachers: [action.payload, ...state.teachers] };

    case 'UPDATE_TEACHER': {
      const updatedTeachers = state.teachers.map((t) =>
        t.id === action.payload.id ? action.payload : t
      );
      const updatedClasses = state.classes.map((c) =>
        c.teacherId === action.payload.id ? { ...c, teacher: `${action.payload.firstName} ${action.payload.lastName}` } : c
      );
      return { ...state, teachers: updatedTeachers, classes: updatedClasses };
    }

    case 'DELETE_TEACHER':
      return {
        ...state,
        teachers: state.teachers.filter((t) => t.id !== action.payload),
        classes: state.classes.map((c) =>
          c.teacherId === action.payload ? { ...c, teacherId: undefined } : c
        ),
      };

    case 'ADD_COUNSELOR':
      return { ...state, counselors: [action.payload, ...state.counselors] };

    case 'UPDATE_COUNSELOR': {
      const updatedCounselors = state.counselors.map((cn) =>
        cn.id === action.payload.id ? action.payload : cn
      );
      const updatedStudents = state.students.map((s) =>
        s.counselorId === action.payload.id
          ? { ...s, counselorName: `${action.payload.firstName} ${action.payload.lastName}` }
          : s
      );
      return { ...state, counselors: updatedCounselors, students: updatedStudents };
    }

    case 'DELETE_COUNSELOR':
      return {
        ...state,
        counselors: state.counselors.filter((cn) => cn.id !== action.payload),
        students: state.students.map((s) =>
          s.counselorId === action.payload ? { ...s, counselorId: undefined, counselorName: undefined } : s
        ),
      };

    default:
      return state;
  }
}

export interface AppContextValue {
  state: AppState;
  /**
   * CR-1: guarded dispatch — mutating actions (students/classes/registrations/
   * payments) are rejected while an archived year is being viewed. Use this
   * everywhere instead of the raw reducer dispatch.
   */
  dispatch: React.Dispatch<AppAction>;
  activeAcademicYear: AcademicYear | undefined;
  viewingAcademicYear: AcademicYear | undefined;
  isViewingArchived: boolean;
  switchAcademicYear: (yearId: string) => void;
  getStudentById: (id: string) => Student | undefined;
  getClassById: (id: string) => ClassRoom | undefined;
  getSessionById: (classId: string, sessionId: string) => { session: any; classRoom: ClassRoom } | null;
  getStudentRegistrations: (studentId: string) => Registration[];
  getClassRegistrations: (classId: string) => Registration[];
  getSessionEnrolledCount: (classId: string, sessionId: string) => number;
  getSessionRemainingCapacity: (classId: string, sessionId: string) => number;
  getTeacherById: (id: string) => Teacher | undefined;
  getCounselorById: (id: string) => Counselor | undefined;
  getTeacherClasses: (teacherId: string) => ClassRoom[];
  getCounselorStudents: (counselorId: string) => Student[];
  /**
   * Global uniqueness fix: preview of the tracking code that WILL be issued by
   * the next ADD_REGISTRATION / accepted Woo order. Display-only — actual
   * issuance happens atomically inside the reducer so two concurrent forms can
   * never claim the same number.
   */
  peekNextRegistrationCode: () => string;
}


const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{
  children: React.ReactNode;
  showToast?: (message: string, type?: ToastType, title?: string) => void;
}> = ({ children, showToast: showToastProp }) => {
  const [state, rawDispatch] = useReducer(appReducer, undefined, () => {
    let loaded: AppState | null = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        loaded = migrateLegacyData(parsed);
      }
    } catch (e) {
      console.error('Error loading institute data from localStorage', e);
    }
    if (!loaded) loaded = buildSeedData();

    // Defensive high-water-mark sync: even a state that never went through
    // migrateLegacyData (e.g. corrupted payload) must have nextRegSeq >= every
    // code that currently exists live or in any archived snapshot.
    const observedMax = maxRegistrationSeq([
      ...loaded.registrations.map((r) => r.code),
      ...loaded.academicYears.flatMap(
        (y) => y.archivedData?.registrations?.map((r) => r.code) || []
      ),
    ]);
    return { ...loaded, nextRegSeq: Math.max(loaded.nextRegSeq || 0, observedMax) };
  });

  // Keep a live ref to the current state so the guarded dispatch can read
  // viewingYearId/activeYearId without re-creating on every render.
  const stateRef = useRef(state);
  const hasAutoSeededRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Toast function injected from outside (ToastProvider wraps AppProvider).
  const externalToastRef = useRef(showToastProp);
  useEffect(() => {
    externalToastRef.current = showToastProp;
  }, [showToastProp]);

  // Internal fallback toast (rendered inside the provider tree) so the guard
  // always has a way to surface errors even if no external toast is provided.
  const [internalToasts, setInternalToasts] = useState<ToastItem[]>([]);
  const internalShowToast = (message: string, type: ToastType = 'info', title?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setInternalToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setInternalToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };
  const notify = (message: string, type: ToastType = 'error') => {
    // Priority: explicit prop > global ToastProvider instance > internal fallback host.
    if (externalToastRef.current) externalToastRef.current(message, type);
    else if (getGlobalToast()) getGlobalToast()!(message, type);
    else internalShowToast(message, type);
  };

  /**
   * CR-1: Guarded dispatch layer. Any action that mutates the displayed
   * dataset is refused while viewing a year other than the active one, so
   * archived historical records (including financial ones) can never be
   * permanently altered.
   */
  const dispatch = (action: AppAction) => {
    const cur = stateRef.current;
    if (MUTATING_ACTION_TYPES.has(action.type) && cur.viewingYearId !== cur.activeYearId) {
      notify(ARCHIVED_READONLY_MESSAGE, 'error');
      return;
    }
    // HI-1: hard guard against destructive resets. The action is refused in
    // production builds unless demo tools are explicitly enabled via env flag,
    // and even then a full JSON backup is downloaded before the reset runs.
    if (action.type === 'RESET_DATA') {
      if (!DEMO_TOOLS_ENABLED) {
        notify('بازنشانی داده‌ها در نسخه عملیاتی غیرفعال است.', 'error');
        return;
      }
      downloadStateBackup(cur);
    }
    rawDispatch(action);

    // Backend sync (production mode): when VITE_API_BASE is set, every
    // mutating action is mirrored to the REST API after it has been applied
    // locally. The reducer keeps its guards as the first validation layer;
    // the server re-validates everything (second defense layer). On failure
    // we surface an error toast — the local optimistic copy will be replaced
    // by server truth on the next load/refresh.
    if (BACKEND_ENABLED && MUTATING_ACTION_TYPES.has(action.type)) {
      // Composite year rollover: archive the outgoing (currently active) year
      // and register the new one server-side. The reducer already computed
      // state.activeYearId BEFORE this action, so we read it from stateRef.
      if (action.type === 'ARCHIVE_AND_START_NEW_YEAR') {
        const p = action.payload as { newYear?: { id: string; title?: string; shortTitle?: string; periodLabel?: string } };
        const archivedYearId = cur.activeYearId;
        const label = p.newYear?.periodLabel || p.newYear?.title || p.newYear?.shortTitle || '';
        void (async () => {
          if (archivedYearId) await serverApi.post(`/years/${archivedYearId}/archive`, {});
          if (p.newYear?.id) await serverApi.post('/years', { id: p.newYear.id, label });
        })().catch((e: Error) => notify(`خطا در بایگانی/شروع سال سمت سرور: ${e.message}`, 'error'));
        return;
      }
      if (action.type === 'RESTORE_FIVE_SAMPLES') {
        void serverApi.seedSamples()
          .then(() => logger.info('SYNC', '۵ داده نمونه استاندارد با موفقیت در دیتابیس سرور بارگذاری شد.'))
          .catch((e: Error) => logger.warn('SYNC', `ذخیره نمونه‌ها روی سرور: ${e.message}`));
        return;
      }
      // Installment pay/refund have installment-scoped REST routes; mirror
      // them through the custom event consumed by the listener below.
      if (action.type === 'MARK_INSTALLMENT_PAID' || action.type === 'REFUND_INSTALLMENT') {
        const p = action.payload as { regId: string; instId: string; paidAt?: string };
        window.dispatchEvent(new CustomEvent('helli:payment-event', {
          detail: {
            regId: p.regId, instId: p.instId,
            kind: action.type === 'MARK_INSTALLMENT_PAID' ? 'pay' : 'refund',
            paidDate: p.paidAt || '',
          },
        }));
        return;
      }
      void syncAction(action as { type: string; payload?: any }).catch((e: Error & { status?: number }) => {
        console.error('backend sync failed:', action.type, e);
        logger.error('SYNC', `شکست همگام‌سازی ${action.type}: ${e.message}`, { action, error: e }, { status: e.status });
        notify(
          e.status === 409 ? 'ثبت تکراری رد شد. صفحه را بازخوانی کنید.'
          : e.status === 423 ? 'این سال تحصیلی بایگانی شده و فقط‌خواندنی است.'
          : e.status === 401 ? 'جلسه تمام شده است؛ دوباره وارد شوید.'
          : e.status === 403 ? (e.message || 'دسترسی غیرمجاز (۴۰۳): نقش حساب کاربری شما اجازه ذخیره در سرور را ندارد.')
          : `خطا در ذخیره‌سازی سمت سرور: ${e.message}`,
          'error'
        );
      });
    }
  };

  // Payment events need their dedicated server routes (installment-scoped),
  // so they are handled through a custom DOM event fired by Finance/Registrations
  // alongside the reducer action. This keeps the reducer pure.
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { regId: string; instId: string; kind: 'pay' | 'refund'; paidDate?: string };
      const path = `/registrations/${d.regId}/installments/${d.instId}/${d.kind === 'pay' ? 'pay' : 'refund'}`;
      void serverApi.post(path, { paidDate: d.paidDate || '' }).catch((e: Error & { status?: number }) => {
        logger.error('SYNC', `خطای ثبت پرداخت سمت سرور: ${e.message}`, { path, error: e }, { status: e.status, url: path });
        notify(e.status === 423 ? 'این سال بایگانی‌شده و فقط‌خواندنی است.' : `خطا در ثبت پرداخت سمت سرور: ${e.message}`, 'error');
      });
    };
    window.addEventListener('helli:payment-event', handler);
    return () => window.removeEventListener('helli:payment-event', handler);
  }, []);

  // Server-state hydration: AuthGate fetches GET /api/state after login and
  // broadcasts it here so the whole app switches from the local optimistic
  // copy to the database truth (multi-user consistency).
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    const onServerState = (ev: Event) => {
      const st = (ev as CustomEvent).detail as any;
      // The reducer keeps archived snapshots inside academicYears[].archivedData.
      const yearsWithArchive = (st.academicYears || []).map((y: any) => ({
        ...y,
        archivedData: st.archivedData?.[y.id] ?? y.archivedData ?? null,
      }));

      const incomingStudents = Array.isArray(st.students) ? st.students : [];
      const incomingClasses = Array.isArray(st.classes) ? st.classes : [];
      const incomingRegs = Array.isArray(st.registrations) ? st.registrations : [];

      const isServerEmpty = incomingStudents.length === 0 && incomingClasses.length === 0 && incomingRegs.length === 0;
      let finalStudents = incomingStudents;
      let finalClasses = incomingClasses;
      let finalRegs = incomingRegs;
      let finalTeachers = (st.teachers && Array.isArray(st.teachers) && st.teachers.length > 0) ? st.teachers : stateRef.current.teachers || [];
      let finalCounselors = (st.counselors && Array.isArray(st.counselors) && st.counselors.length > 0) ? st.counselors : stateRef.current.counselors || [];

      if (isServerEmpty) {
        logger.info('SYSTEM', 'پایگاه داده سرور خالی بود؛ ۵ داده نمونه استاندارد برای بررسی عملکرد سیستم بارگذاری شد.');
        const five = getFiveStandardSampleData();
        finalStudents = five.students;
        finalClasses = five.classes;
        finalRegs = five.registrations;
        finalTeachers = five.teachers;
        finalCounselors = five.counselors;

        // ذخیره نمونه‌ها در دیتابیس در صورت لزوم (حداکثر یک‌بار در نشست برای پیشگیری از لوپ)
        if (!hasAutoSeededRef.current) {
          hasAutoSeededRef.current = true;
          void serverApi.seedSamples()
            .then(() => {
              logger.info('SYNC', '۵ داده نمونه استاندارد با موفقیت در پایگاه داده سرور ثبت شد.');
            })
            .catch((err: any) => {
              logger.warn('SYNC', `ثبت اولیه نمونه‌ها روی دیتابیس با تاخیر مواجه شد: ${err?.message || ''}`);
            });
        }
      }

      rawDispatch({
        type: 'HYDRATE_FROM_SERVER',
        payload: {
          academicYears: yearsWithArchive,
          activeYearId: st.activeYearId || '',
          viewingYearId: st.viewingYearId || st.activeYearId || '',
          students: finalStudents,
          classes: finalClasses,
          registrations: finalRegs,
          teachers: finalTeachers,
          counselors: finalCounselors,
          wooSettings: { ...(stateRef.current.wooSettings || {} as any), ...(st.settings?.wooPublic || {}) },
          nextRegSeq: Math.max(Number(st.nextRegSeq || 0), isServerEmpty ? 105 : 0),
        } as AppState,
      });
    };
    window.addEventListener('helli:server-state', onServerState);
    if (getToken()) {
      serverApi.getState()
        .then((st) => onServerState({ detail: st } as any))
        .catch((err) => console.warn('AppProvider direct state fetch error:', err));
    }
    return () => window.removeEventListener('helli:server-state', onServerState);
  }, []);

  useEffect(() => {
    try {
      // CR-4: WooCommerce consumer keys are session-only — strip them from
      // everything written to localStorage so a shared/locked machine never
      // retains the store credentials after the tab is closed.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripWooCredentials(state)));
    } catch (e) {
      console.error('Error saving institute data to localStorage', e);
    }
  }, [state]);

  const getStudentById = (id: string) => state.students.find((s) => s.id === id);

  const getClassById = (id: string) => state.classes.find((c) => c.id === id);

  const getSessionById = (classId: string, sessionId: string) => {
    const classRoom = state.classes.find((c) => c.id === classId);
    if (!classRoom) return null;
    const session = classRoom.sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    return { session, classRoom };
  };

  const getStudentRegistrations = (studentId: string) =>
    state.registrations.filter((r) => r.studentId === studentId);

  const getClassRegistrations = (classId: string) =>
    state.registrations.filter((r) => r.classId === classId && r.status !== 'cancelled');

  const getSessionEnrolledCount = (classId: string, sessionId: string) => {
    return state.registrations.filter(
      (r) => r.classId === classId && r.sessionId === sessionId && r.status !== 'cancelled'
    ).length;
  };

  const getSessionRemainingCapacity = (classId: string, sessionId: string) => {
    const sessionInfo = getSessionById(classId, sessionId);
    if (!sessionInfo) return 0;
    const enrolled = getSessionEnrolledCount(classId, sessionId);
    return Math.max(0, sessionInfo.session.capacity - enrolled);
  };

  const getTeacherById = (id: string) => state.teachers.find((t) => t.id === id);
  const getCounselorById = (id: string) => state.counselors.find((c) => c.id === id);
  const getTeacherClasses = (teacherId: string) => state.classes.filter((c) => c.teacherId === teacherId);
  const getCounselorStudents = (counselorId: string) => state.students.filter((s) => s.counselorId === counselorId);

  // Display-only preview of the next tracking code. The authoritative number
  // is allocated inside the reducer at dispatch time (see ADD_REGISTRATION).
  const peekNextRegistrationCode = () => {
    const taken = new Set<string>();
    state.registrations.forEach((r) => r.code && taken.add(r.code));
    state.academicYears.forEach((y) =>
      (y.archivedData?.registrations || []).forEach((r) => r.code && taken.add(r.code))
    );
    let seq = state.nextRegSeq;
    let code = '';
    do {
      seq += 1;
      code = makeRegistrationCode(currentJalaliYearForCodes(), seq);
    } while (taken.has(code));
    return code;
  };

  const activeAcademicYear =
    state.academicYears.find((y) => y.id === state.activeYearId) || state.academicYears[0];
  const viewingAcademicYear =
    state.academicYears.find((y) => y.id === state.viewingYearId) || activeAcademicYear;
  const isViewingArchived =
    Boolean(viewingAcademicYear && (viewingAcademicYear.id !== activeAcademicYear?.id || viewingAcademicYear.isArchived));

  const switchAcademicYear = (yearId: string) => {
    dispatch({ type: 'SET_VIEWING_YEAR', payload: yearId });
  };

  const removeInternalToast = (id: string) =>
    setInternalToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        activeAcademicYear,
        viewingAcademicYear,
        isViewingArchived,
        switchAcademicYear,
        getStudentById,
        getClassById,
        getSessionById,
        getStudentRegistrations,
        getClassRegistrations,
        getSessionEnrolledCount,
        getSessionRemainingCapacity,
        getTeacherById,
        getCounselorById,
        getTeacherClasses,
        getCounselorStudents,
        peekNextRegistrationCode,
      }}
    >
      {children}

      {/* Fallback toast host for the CR-1 guarded-dispatch rejections when no
          external showToast prop is injected. */}
      {internalToasts.length > 0 && (
        <div className="fixed bottom-5 left-5 z-[70] flex flex-col gap-2 pointer-events-none max-w-sm w-full" dir="rtl">
          {internalToasts.map((toast) => {
            let bgClass = 'bg-[#0A3528] text-white border-emerald-600';
            let icon = <IconCheck size={18} className="text-emerald-400" />;
            if (toast.type === 'error') {
              bgClass = 'bg-[#451010] text-white border-red-500';
              icon = <IconAlert size={18} className="text-red-400" />;
            } else if (toast.type === 'info') {
              bgClass = 'bg-[#18314F] text-white border-sky-500';
              icon = <IconCheck size={18} className="text-sky-300" />;
            }
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl border text-sm ${bgClass}`}
              >
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1">
                  {toast.title && <div className="font-semibold text-xs mb-0.5 opacity-90">{toast.title}</div>}
                  <div className="text-sm leading-snug">{toast.message}</div>
                </div>
                <button
                  onClick={() => removeInternalToast(toast.id)}
                  className="opacity-70 hover:opacity-100 p-0.5 shrink-0 transition-opacity"
                  aria-label="بستن"
                >
                  <IconClose size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AppContext.Provider>
  );

};

export const useAppStore = () => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppStore must be used within AppProvider');
  }
  return ctx;
};
