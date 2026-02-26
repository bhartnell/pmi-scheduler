'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, XCircle, MessageSquare } from 'lucide-react';

interface AttendanceData {
  total_absences: number;
  consecutive_misses: number;
  attendance_pct: number;
  last_attended_date: string | null;
  risk_level: 'warning' | 'critical' | null;
}

interface Props {
  studentId: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AttendanceAlertBanner({ studentId }: Props) {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAttendanceData = useCallback(async () => {
    try {
      // Fetch all attendance records for this student from the at-risk endpoint
      // We call without cohort filter, then filter client-side by student_id
      const res = await fetch('/api/lab-management/attendance/at-risk');
      if (!res.ok) return;
      const json = await res.json();
      const students: Array<{
        student_id: string;
        total_absences: number;
        consecutive_misses: number;
        attendance_pct: number;
        last_attended_date: string | null;
        risk_level: 'warning' | 'critical';
      }> = json.at_risk_students || [];

      const match = students.find((s) => s.student_id === studentId);
      if (match) {
        setData({
          total_absences: match.total_absences,
          consecutive_misses: match.consecutive_misses,
          attendance_pct: match.attendance_pct,
          last_attended_date: match.last_attended_date,
          risk_level: match.risk_level,
        });
      } else {
        setData(null);
      }
    } catch (err) {
      console.error('[AttendanceAlertBanner] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  // Don't render anything while loading or if no issue
  if (loading || !data || !data.risk_level) return null;

  const isCritical = data.risk_level === 'critical';

  const containerClass = isCritical
    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
    : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';

  const iconClass = isCritical
    ? 'text-red-500 dark:text-red-400'
    : 'text-yellow-500 dark:text-yellow-400';

  const badgeClass = isCritical
    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
    : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300';

  const linkClass = isCritical
    ? 'text-red-700 dark:text-red-300 underline hover:no-underline font-medium'
    : 'text-yellow-700 dark:text-yellow-300 underline hover:no-underline font-medium';

  return (
    <div className={`rounded-lg p-4 mb-4 ${containerClass}`}>
      <div className="flex items-start gap-3">
        {isCritical ? (
          <XCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconClass}`} />
        ) : (
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconClass}`} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm">
              {isCritical ? 'Critical Attendance Issue' : 'Attendance Warning'}
            </h4>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeClass}`}>
              {isCritical ? 'Critical' : 'Warning'}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="font-medium">{data.total_absences}</span>
              <span className="ml-1 opacity-80">
                absence{data.total_absences !== 1 ? 's' : ''}
              </span>
            </div>
            {data.consecutive_misses >= 2 && (
              <div>
                <span className="font-medium">{data.consecutive_misses}</span>
                <span className="ml-1 opacity-80">consecutive</span>
              </div>
            )}
            <div>
              <span className="font-medium">{data.attendance_pct}%</span>
              <span className="ml-1 opacity-80">attendance</span>
            </div>
            <div>
              <span className="opacity-80">Last seen: </span>
              <span className="font-medium">{formatDate(data.last_attended_date)}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1 text-sm">
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
            <Link
              href={`/lab-management/students/${studentId}?tab=communications`}
              className={linkClass}
            >
              Document follow-up in communication log
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
