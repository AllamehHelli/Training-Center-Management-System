/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import logoPng from './assets/logo.png';

interface LogoProps {
  size?: number | string;
  className?: string;
  showText?: boolean;
  textColor?: string;
  variant?: 'full' | 'mark' | 'badge';
}

/**
 * Official Allameh Helli Institute Logo
 * Renders the exact, untampered logo image as provided by the institution without any modification.
 */
export const LogoHelli: React.FC<LogoProps> = ({
  size = 48,
  className = '',
  showText = false,
  textColor = 'text-white',
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Exact official logo image */}
      <img
        src={logoPng}
        alt="لوگوی رسمی موسسه علامه حلی"
        style={{ width: pixelSize, height: pixelSize }}
        className="shrink-0 object-contain select-none transition-transform duration-200 hover:scale-105"
        referrerPolicy="no-referrer"
        loading="eager"
      />

      {/* Brand Text (Optional / Full mode) */}
      {showText && (
        <div className="flex flex-col">
          <span className={`font-heading text-lg font-bold tracking-wide leading-tight ${textColor}`}>
            موسسه علامه حلی
          </span>
          <span className="text-[11px] opacity-75 font-medium leading-none mt-1">
            آموزشگاه تیزهوشان و المپیاد
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Fixed Logo Badge for Sidebar or Headers
 */
export const FixedLogoBadge: React.FC<{
  className?: string;
  isLight?: boolean;
}> = ({ className = '', isLight = false }) => {
  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all ${
        isLight
          ? 'bg-white/95 border border-slate-200/90 shadow-xs'
          : 'bg-[#0A1633]/90 border border-blue-900/40 shadow-xs'
      } ${className}`}
    >
      <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center p-1 shadow-2xs border border-orange-100 shrink-0">
        <LogoHelli size={36} />
      </div>
      <div className="overflow-hidden">
        <div
          className={`font-heading text-base font-bold leading-tight truncate ${
            isLight ? 'text-[#162E6E]' : 'text-white'
          }`}
        >
          موسسه علامه حلی
        </div>
        <div
          className={`text-[10.5px] truncate font-medium mt-0.5 ${
            isLight ? 'text-[#EA580C]' : 'text-orange-300'
          }`}
        >
          سامانه جامع مدیریت و پذیرش
        </div>
      </div>
    </div>
  );
};
