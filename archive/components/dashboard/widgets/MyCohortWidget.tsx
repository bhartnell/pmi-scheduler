'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { GraduationCap, Users, ChevronRight } from 'lucide-react';
import WidgetCard from '../WidgetCard';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

interface CohortData {
  hasCohort: boolean;
  cohort?: {
    id: string;
    cohort_number: string;
    is_active: boolean;
    program: {
      id: string;
      name: string;
      abbreviation: string;
    };
  };
  students?: Student[];
  studentCount?: number;
}

export default function MyCohortWidget() {
  const { data: session } = useSession();
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email) return;

    fetch('/api/users/me/cohort-roster')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  // Don't render anything if no primary cohort is set
  if (!loading && (!data || !data.hasCohort)) {
    return null;
  }

  const cohortLabel = data?.cohort
    ? `${data.cohort.program?.abbreviation || ''} Group ${data.cohort.cohort_number}`.trim()
    : 'My Cohort';

  return (
    <WidgetCard
      title={`My Cohort \u2014 ${cohortLabel}`}
      icon={<GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
      headerAction={
        data?.studentCount !== undefined ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              <Users className="w-3 h-3" />
              {data.studentCount}
            </span>
            {data?.cohort && (
              <Link
                href={`/academics/students?cohort=${data.cohort.id}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : undefined
      }
      loading={loading}
    >
      {data?.students && data.students.length > 0 ? (
        <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1">
          {data.students.map(student => (
            <Link
              key={student.id}
              href={`/academics/students/${student.id}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
            >
              <span className="text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {student.last_name}, {student.first_name}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-400" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No active students in this cohort.
        </p>
      )}
    </WidgetCard>
  );
}
