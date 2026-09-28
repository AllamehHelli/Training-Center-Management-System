/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconAlert, IconCheck, IconInfo } from './icons';
import { toPersianDigits, formatNumber } from './utils';

// -------------------------------------------------------------
// Toast Notification System
// -------------------------------------------------------------
export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// CR-1: module-level stable reference to the active toast function, so layers
// created *above* AppProvider in the tree (like the guarded dispatch) can
// surface messages without a hook. Set by ToastProvider on mount.
let globalShowToast: ((message: string, type?: ToastType, title?: string) => void) | null = null;

export const getGlobalToast = () => globalShowToast;

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: ToastType = 'info', title?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    globalShowToast = showToast;
    return () => {
      if (globalShowToast === showToast) globalShowToast = null;
    };
  });

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => {
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
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl border text-sm transition-all duration-300 transform translate-y-0 opacity-100 ${bgClass}`}
            >
              <div className="mt-0.5 shrink-0">{icon}</div>
              <div className="flex-1">
                {toast.title && <div className="font-semibold text-xs mb-0.5 opacity-90">{toast.title}</div>}
                <div className="text-sm leading-snug">{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 p-0.5 shrink-0 transition-opacity"
                aria-label="بستن"
              >
                <IconClose size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

// -------------------------------------------------------------
// Animated Counter
// -------------------------------------------------------------
export const Counter: React.FC<{ value: number; duration?: number; isCurrency?: boolean }> = ({
  value,
  duration = 800,
  isCurrency = false,
}) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = current;
    const targetValue = value;

    if (startValue === targetValue) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const nextVal = Math.round(startValue + (targetValue - startValue) * ease);
      setCurrent(nextVal);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [value, duration]);

  return <span className="tabular-nums font-semibold">{formatNumber(current)}</span>;
};

// -------------------------------------------------------------
// Modal Dialog
// -------------------------------------------------------------
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '2xl',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative bg-white w-full ${maxWidthClass} rounded-3xl shadow-2xl border border-neutral-200/80 overflow-hidden transform transition-all my-8 z-10 flex flex-col max-h-[90vh]`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <h3 className="text-xl font-heading text-neutral-900 font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"
            aria-label="بستن"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Confirm Modal
// -------------------------------------------------------------
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'تأیید و ادامه',
  cancelText = 'انصراف',
  danger = true,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2 text-xs font-medium text-white rounded-full transition-colors shadow-2xs ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-neutral-900 hover:bg-neutral-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// -------------------------------------------------------------
// Avatar Component
// -------------------------------------------------------------
export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' }> = ({
  name,
  size = 'md',
}) => {
  const getInitials = (n: string) => {
    if (!n) return 'ع';
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`;
    }
    return n.slice(0, 2);
  };

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size];

  // Deterministic color from name
  const colors = [
    'bg-emerald-700 text-emerald-100',
    'bg-[#0A3528] text-emerald-200',
    'bg-[#3E7CB1] text-sky-100',
    'bg-[#96579E] text-purple-100',
    'bg-[#E9A13B] text-amber-950',
    'bg-teal-700 text-teal-100',
  ];
  const charCode = name.charCodeAt(0) || 0;
  const colorClass = colors[charCode % colors.length];

  return (
    <div
      className={`${sizeClasses} ${colorClass} rounded-full font-semibold flex items-center justify-center shrink-0 select-none shadow-xs`}
    >
      {getInitials(name)}
    </div>
  );
};

// -------------------------------------------------------------
// Form Field Container
// -------------------------------------------------------------
interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  required,
  error,
  children,
  className = '',
  hint,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
        <span>{label}</span>
        {required && <span className="text-[#D64545] font-bold">*</span>}
      </label>
      {children}
      {hint && !error && <span className="text-[11px] text-slate-500">{hint}</span>}
      {error && <span className="text-xs text-[#D64545] leading-tight mt-0.5">{error}</span>}
    </div>
  );
};

// -------------------------------------------------------------
// Capacity / Progress Bar
// -------------------------------------------------------------
export const ProgressBar: React.FC<{
  current: number;
  max: number;
  colorClass?: string;
  showText?: boolean;
}> = ({ current, max, colorClass = 'bg-[#0E7C5B]', showText = true }) => {
  const percent = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;

  return (
    <div className="w-full">
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showText && (
        <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1 tabular-nums font-medium">
          <span>{toPersianDigits(percent)}٪</span>
          <span>
            {toPersianDigits(current)} از {toPersianDigits(max)}
          </span>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Info Tooltip / Popover (دکمه اطلاعات و توضیحات راهنما با هاور و کلیک)
// -------------------------------------------------------------
// Info Tooltip / Popover (دکمه اطلاعات و توضیحات راهنما با هاور و کلیک، بهینه‌شده برای مانیتورهای کوچک)
// -------------------------------------------------------------
export interface InfoTooltipProps {
  content: React.ReactNode;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  size?: number;
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  title,
  position = 'bottom',
  size = 15,
  className = '',
  buttonClassName = '',
  ariaLabel = 'توضیحات و راهنمای بیشتر',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'top' | 'bottom';
    arrowLeft: number;
  }>({
    top: 0,
    left: 0,
    width: 300,
    placement: 'bottom',
    arrowLeft: 150,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Responsive width clamped to viewport
    const tooltipWidth = Math.min(320, Math.max(260, vw - 24));

    // Vertical placement logic:
    // If rect.top < 210, we CANNOT place it above (it would go off-screen at the top!).
    // If vh - rect.bottom < 210 and rect.top >= 210, place it on top.
    // Otherwise, default to position prop or bottom.
    let place: 'top' | 'bottom' = 'bottom';
    if (rect.top < 210) {
      place = 'bottom';
    } else if (vh - rect.bottom < 210 && rect.top >= 210) {
      place = 'top';
    } else {
      place = position === 'top' ? 'top' : 'bottom';
    }

    let top = 0;
    if (place === 'top') {
      top = rect.top - 8;
    } else {
      top = rect.bottom + 8;
    }

    // Horizontal placement logic:
    const triggerCenterX = rect.left + rect.width / 2;
    let left = triggerCenterX - tooltipWidth / 2;

    const minLeft = 12;
    const maxLeft = vw - tooltipWidth - 12;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    // Arrow alignment relative to tooltip container
    const arrowLeft = Math.max(16, Math.min(triggerCenterX - left, tooltipWidth - 16));

    setCoords({
      top,
      left,
      width: tooltipWidth,
      placement: place,
      arrowLeft,
    });
  };

  const handleOpen = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      handleOpen();
    }
  };

  // Recalculate on scroll / resize while open and handle outside click
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
    >
      <button
        type="button"
        onClick={handleToggle}
        onFocus={handleOpen}
        onBlur={handleClose}
        className={`inline-flex items-center justify-center text-slate-400 hover:text-[#EA580C] focus:text-[#EA580C] p-0.5 rounded-full transition-colors cursor-help focus:outline-hidden ${buttonClassName}`}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <span className="sr-only">{ariaLabel}</span>
        <IconInfo size={size} className="shrink-0" />
      </button>

      {isOpen && isMounted && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          dir="rtl"
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleClose}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            transform: coords.placement === 'top' ? 'translateY(-100%)' : 'none',
            zIndex: 99999,
          }}
          className="p-3 bg-slate-900/95 text-slate-100 rounded-xl shadow-2xl border border-slate-700/80 backdrop-blur-md text-xs leading-relaxed pointer-events-auto transition-opacity animate-in fade-in duration-150 select-text max-h-[75vh] flex flex-col"
        >
          {title && (
            <div className="font-heading font-semibold text-orange-400 pb-1.5 mb-1.5 border-b border-slate-700/70 flex items-center justify-between text-xs shrink-0">
              <span className="flex items-center gap-1.5 truncate">
                <IconInfo size={13} className="text-orange-400 shrink-0" />
                <span className="truncate">{title}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition-colors text-xs shrink-0 mr-1"
                aria-label="بستن راهنما"
              >
                ✕
              </button>
            </div>
          )}
          <div className="text-[11.5px] text-slate-200 leading-relaxed overflow-y-auto space-y-1">
            {content}
          </div>
          {/* Arrow */}
          <div
            style={{ left: `${coords.arrowLeft}px` }}
            className={`absolute w-0 h-0 border-4 pointer-events-none -translate-x-1/2 ${
              coords.placement === 'top'
                ? 'top-full border-t-slate-900 border-x-transparent border-b-transparent'
                : 'bottom-full border-b-slate-900 border-x-transparent border-t-transparent'
            }`}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

