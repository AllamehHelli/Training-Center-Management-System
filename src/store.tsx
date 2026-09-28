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
} from './types';
import { buildSeedData, migrateLegacyData } from './data';
import { getTodayJalali } from './utils';
import { ToastType, ToastItem, getGlobalToast } from './ui';
import { IconAlert, IconCheck, IconClose } from './icons';

const STORAGE_KEY = 'helli_institute_data_v2';

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
  'ADD_REGISTRATION',
  'UPDATE_REGISTRATION',
  'UPDATE_REGISTRATION_STATUS',
  'DELETE_REGISTRATION',
  'MARK_INSTALLMENT_PAID',
  'REFUND_INSTALLMENT',
  // CR-3: WooCommerce order sync creates students/registrations too, so it
  // must be blocked while an archived year is being viewed.
  'SYNC_WOO_ORDERS',
]);

export const ARCHIVED_READONLY_MESSAGE =
  'سال تحصیلی در حال مشاهده بایگانی‌شده و فقط‌خواندنی است؛ برای افزودن، ویرایش یا حذف اطلاعات ابتدا به سال فعال بازگردید.';

export interface AppState {
  academicYears: AcademicYear[];
  activeYearId: string;
  viewingYearId: string;
  students: Student[];
  classes: ClassRoom[];
  registrations: Registration[];
  wooSettings: WooSettings;
}

export type AppAction =
  | { type: 'ADD_STUDENT'; payload: Student }
  | { type: 'UPDATE_STUDENT'; payload: Student }
  | { type: 'DELETE_STUDENT'; payload: string }
  | { type: 'BULK_ADD_STUDENTS'; payload: Student[] }
  | { type: 'ADD_CLASS'; payload: ClassRoom }
  | { type: 'UPDATE_CLASS'; payload: ClassRoom }
  | { type: 'DELETE_CLASS'; payload: string }
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
  | { type: 'DELETE_ACADEMIC_YEAR'; payload: string };


function appReducer(state: AppState, action: AppAction): AppState {
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
      return { ...state, classes: [action.payload, ...state.classes] };

    case 'UPDATE_CLASS':
      return {
        ...state,
        classes: state.classes.map((c) => (c.id === action.payload.id ? action.payload : c)),
      };

    case 'DELETE_CLASS':
      return {
        ...state,
        classes: state.classes.filter((c) => c.id !== action.payload),
        registrations: state.registrations.filter((r) => r.classId !== action.payload),
      };

    case 'ADD_REGISTRATION':
      return { ...state, registrations: [action.payload, ...state.registrations] };

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
      const acceptedRegistrations = newRegistrations.filter((r) => acceptedRegIds.has(r.id));

      if (acceptedStudents.length === 0 && acceptedRegistrations.length === 0) {
        if (rejectedReasons.length > 0) {
          console.warn('SYNC_WOO_ORDERS rejected:', rejectedReasons.join(' | '));
        }
        return state;
      }

      return {
        ...state,
        students: [...acceptedStudents, ...state.students],
        registrations: [...acceptedRegistrations, ...state.registrations],
      };
    }

    case 'RESET_DATA':
      return buildSeedData();

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
}


const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{
  children: React.ReactNode;
  showToast?: (message: string, type?: ToastType, title?: string) => void;
}> = ({ children, showToast: showToastProp }) => {
  const [state, rawDispatch] = useReducer(appReducer, undefined, () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return migrateLegacyData(parsed);
      }
    } catch (e) {
      console.error('Error loading institute data from localStorage', e);
    }
    return buildSeedData();
  });

  // Keep a live ref to the current state so the guarded dispatch can read
  // viewingYearId/activeYearId without re-creating on every render.
  const stateRef = useRef(state);
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
    rawDispatch(action);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
