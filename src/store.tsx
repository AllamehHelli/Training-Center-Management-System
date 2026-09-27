/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import {
  Student,
  ClassRoom,
  Registration,
  RegistrationStatus,
  WooSettings,
  SyncLogItem,
  AcademicYear,
} from './types';
import { buildSeedData, migrateLegacyData } from './data';
import { getTodayJalali } from './utils';

const STORAGE_KEY = 'helli_institute_data_v2';

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

    case 'SYNC_WOO_ORDERS':
      return {
        ...state,
        students: [...action.payload.newStudents, ...state.students],
        registrations: [...action.payload.newRegistrations, ...state.registrations],
      };

    case 'RESET_DATA':
      return buildSeedData();

    case 'SET_VIEWING_YEAR': {
      const targetYearId = action.payload;
      if (targetYearId === state.viewingYearId) return state;

      // 1. Snapshot current displayed dataset into currently viewed year's archivedData
      const updatedYears = state.academicYears.map((y) => {
        if (y.id === state.viewingYearId) {
          return {
            ...y,
            archivedData: {
              students: state.students,
              classes: state.classes,
              registrations: state.registrations,
            },
          };
        }
        return y;
      });

      // 2. Find target year
      const targetYear = updatedYears.find((y) => y.id === targetYearId);
      if (!targetYear) return { ...state, academicYears: updatedYears };

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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, undefined, () => {
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
