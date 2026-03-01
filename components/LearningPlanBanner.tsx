'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

interface Props {
  studentId: string;
}

export default function LearningPlanBanner({ studentId }: Props) {
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/learning-plan`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.plan && json.plan.status === 'active') {
        setHasActivePlan(true);
      }
    } catch (err) {
      console.error('[LearningPlanBanner] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  if (loading || !hasActivePlan) return null;

  return (
    <div className="rounded-lg p-4 mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 flex-shrink-0 text-indigo-500 dark:text-indigo-400" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">
            This student has an active learning plan.{' '}
          </span>
          <Link
            href={`/lab-management/students/${studentId}/learning-plan`}
            className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 underline hover:no-underline"
          >
            View learning plan
          </Link>
        </div>
      </div>
    </div>
  );
}
