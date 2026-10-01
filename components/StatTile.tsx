import React from 'react';

type StatTileProps = {
  label: string;
  value: React.ReactNode;
  /** Tailwind text color classes for the number (e.g. green/red for pass/fail). */
  tone?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Tailwind classes for the icon square (bg + icon color). */
  iconClass?: string;
};

/**
 * Site tile look (same card pattern as the /labs hub tiles: white rounded-xl,
 * shadow-sm, p-5, icon square) sized for a stat so the number stays readable
 * at 75% browser zoom. Reusable for any page that shows headline numbers.
 */
export default function StatTile({ label, value, tone, icon: Icon, iconClass }: StatTileProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 min-h-[88px] flex items-center gap-4">
      {Icon && (
        <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${iconClass || 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div className="min-w-0">
        <div className={`text-3xl font-bold leading-tight ${tone || 'text-gray-900 dark:text-white'}`}>{value}</div>
        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</div>
      </div>
    </div>
  );
}
