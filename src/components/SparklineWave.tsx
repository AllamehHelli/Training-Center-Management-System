/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SparklineWaveProps {
  color?: string;
  variant?: 'pink' | 'purple' | 'blue' | 'coral';
  className?: string;
}

export const SparklineWave: React.FC<SparklineWaveProps> = ({
  variant = 'pink',
  className = '',
}) => {
  const configs = {
    pink: {
      stroke: '#F472B6',
      path: 'M 2 18 C 20 8, 32 32, 52 14 C 70 -2, 85 24, 108 10',
      dot: { cx: 108, cy: 10 },
    },
    purple: {
      stroke: '#A855F7',
      path: 'M 2 20 C 18 10, 34 30, 55 16 C 72 4, 86 22, 108 12',
      dot: { cx: 108, cy: 12 },
    },
    blue: {
      stroke: '#6366F1',
      path: 'M 2 22 C 22 24, 38 12, 58 24 C 76 34, 88 10, 108 14',
      dot: { cx: 108, cy: 14 },
    },
    coral: {
      stroke: '#FB7185',
      path: 'M 2 16 C 18 8, 30 26, 50 14 C 68 2, 82 24, 108 12',
      dot: { cx: 108, cy: 12 },
    },
  };

  const active = configs[variant] || configs.pink;

  return (
    <div className={`relative w-28 h-10 overflow-visible shrink-0 ${className}`}>
      <svg
        viewBox="0 0 114 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <path
          d={active.path}
          stroke={active.stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={active.dot.cx}
          cy={active.dot.cy}
          r="3"
          fill="white"
          stroke={active.stroke}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};
