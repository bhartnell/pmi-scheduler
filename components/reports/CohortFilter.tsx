'use client';

import { formatCohortNumber } from '@/lib/format-cohort';
import React, { useEffect, useState } from 'react';

interface Cohort {
  id: string;
  cohort_number: number | string;
  program: { abbreviation: string; name: string } | null;
  status?: string;
}

interface CohortFilterProps {
  value: string;
  onChange: (cohortId: string) => void;
  className?: string;
}

export default function CohortFilter({ value, onChange, className = '' }: CohortFilterProps) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCohorts() {
      try {
        const res = await fetch('/api/lab-management/cohorts');
        const data = await res.json();
        if (data.cohorts) {
          setCohorts(data.cohorts);
        } else if (Array.isArray(data)) {
          setCohorts(data);
        }
      } catch {
        console.error('Failed to fetch cohorts');
      }
      setLoading(false);
    }
    fetchCohorts();
  }, []);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Cohort
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
      >
        <option value="">All Cohorts</option>
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.program?.abbreviation || 'PMD'} Cohort {formatCohortNumber(c.cohort_number)}
            {c.status === 'archived' ? ' (Archived)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
