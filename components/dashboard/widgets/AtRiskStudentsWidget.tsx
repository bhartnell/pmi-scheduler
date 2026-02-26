'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AlertTriangle, UserX, CheckCircle } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface AtRiskStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  cohort_id: string;
  cohort_label: string;
  total_labs: number;
  total_absences: number;
  consecutive_misses: number;
  attendance_pct: number;
  last_attended_date: string | null;
  risk_level: 'warning' | 'critical';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getRiskStyles(riskLevel: 'warning' | 'critical'): {
  row: string;
  badge: string;
  label: string;
} {
  if (riskLevel === 'critical') {
    return {
      row: 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10',
      badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
      label: 'Critical',
    };
  }
  return {
    row: 'border-yellow-200 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-900/10',
    badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
    label: 'Warning',
  };
}

export default function AtRiskStudentsWidget() {
  const { data: session } = useSession();
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAtRiskStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/lab-management/attendance/at-risk');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.at_risk_students || []);
      }
    } catch (error) {
      console.error('Failed to fetch at-risk students:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetchAtRiskStudents();
  }, [session?.user?.email, fetchAtRiskStudents]);

  const displayed = students.slice(0, 5);
  const totalCount = students.length;

  return (
    <WidgetCard
      title="Attendance Alerts"
      icon={<AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
      viewAllLink="/lab-management/students"
      viewAllText="View Students"
      loading={loading}
    >
      {students.length === 0 ? (
        <WidgetEmpty
          icon={<CheckCircle className="w-10 h-10 mx-auto text-green-500 dark:text-green-400" />}
          message="No at-risk students — attendance looks good!"
        />
      ) : (
        <div className="space-y-2">
          {totalCount > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Showing 5 of {totalCount} at-risk students
            </p>
          )}
          {displayed.map((student) => {
            const style = getRiskStyles(student.risk_level);
            return (
              <div
                key={student.student_id}
                className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border ${style.row}`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <UserX className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500" />
                  <div className="min-w-0">
                    <Link
                      href={`/lab-management/students/${student.student_id}`}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:underline truncate block"
                    >
                      {student.first_name} {student.last_name}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {student.cohort_label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {student.total_absences} absence{student.total_absences !== 1 ? 's' : ''}
                      {student.consecutive_misses >= 2 && (
                        <span className="ml-1">
                          &middot; {student.consecutive_misses} consecutive
                        </span>
                      )}
                      {' '}&middot; {student.attendance_pct}% present
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Last attended: {formatDate(student.last_attended_date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap mt-0.5 ${style.badge}`}
                >
                  {style.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
