'use client';

import React from 'react';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

function getPresetDates(preset: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: string;

  switch (preset) {
    case 'this_week': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = 0
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      start = monday.toISOString().split('T')[0];
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      break;
    }
    case 'this_semester': {
      // Semesters: Jan-May, Jun-Aug, Sep-Dec
      const month = now.getMonth();
      if (month >= 0 && month <= 4) {
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      } else if (month >= 5 && month <= 7) {
        start = new Date(now.getFullYear(), 5, 1).toISOString().split('T')[0];
      } else {
        start = new Date(now.getFullYear(), 8, 1).toISOString().split('T')[0];
      }
      break;
    }
    case 'this_year': {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      break;
    }
    default:
      start = end;
  }

  return { start, end };
}

export default function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangeFilterProps) {
  const handlePreset = (preset: string) => {
    const { start, end } = getPresetDates(preset);
    onStartDateChange(start);
    onEndDateChange(end);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[140px]">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Start Date
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <div className="min-w-[140px]">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          End Date
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'this_week', label: 'This Week' },
          { key: 'this_month', label: 'This Month' },
          { key: 'this_semester', label: 'This Semester' },
          { key: 'this_year', label: 'This Year' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className="px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
