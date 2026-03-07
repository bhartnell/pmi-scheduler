'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; isPositive: boolean };
  icon?: React.ElementType;
  color?: string;
}

const COLOR_MAP: Record<string, { iconBg: string; iconText: string }> = {
  blue: { iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconText: 'text-blue-600 dark:text-blue-400' },
  green: { iconBg: 'bg-green-100 dark:bg-green-900/30', iconText: 'text-green-600 dark:text-green-400' },
  purple: { iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconText: 'text-purple-600 dark:text-purple-400' },
  orange: { iconBg: 'bg-orange-100 dark:bg-orange-900/30', iconText: 'text-orange-600 dark:text-orange-400' },
  red: { iconBg: 'bg-red-100 dark:bg-red-900/30', iconText: 'text-red-600 dark:text-red-400' },
  cyan: { iconBg: 'bg-cyan-100 dark:bg-cyan-900/30', iconText: 'text-cyan-600 dark:text-cyan-400' },
  amber: { iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconText: 'text-amber-600 dark:text-amber-400' },
};

export default function StatCard({ label, value, trend, icon: Icon, color = 'blue' }: StatCardProps) {
  const colors = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
        {Icon && (
          <div className={`p-1.5 rounded-lg ${colors.iconBg}`}>
            <Icon className={`w-4 h-4 ${colors.iconText}`} />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          {trend.isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          )}
          <span
            className={`text-xs font-medium ${
              trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
        </div>
      )}
    </div>
  );
}
