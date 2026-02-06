'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Calendar, ChevronRight, Timer } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface StationAssignment {
  id: string;
  station_number: number;
  custom_title: string | null;
  scenario: {
    id: string;
    title: string;
    category: string;
  } | null;
  lab_day: {
    id: string;
    date: string;
    start_time: string | null;
    cohort: {
      cohort_number: number;
      program: { abbreviation: string };
    };
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

function formatTime(timeString: string | null): string | null {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function isUrgent(dateString: string): boolean {
  const date = new Date(dateString + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === today.toDateString() || date.toDateString() === tomorrow.toDateString();
}

function isToday(dateString: string): boolean {
  const date = new Date(dateString + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return date.toDateString() === today.toDateString();
}

export default function MyLabsWidget() {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState<StationAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchAssignments = async () => {
      try {
        const res = await fetch(`/api/lab-management/stations?instructor=${session.user?.email}&upcoming=true`);
        if (res.ok) {
          const data = await res.json();
          setAssignments((data.stations || []).slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch assignments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [session?.user?.email]);

  return (
    <WidgetCard
      title="My Upcoming Labs"
      icon={<Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />}
      viewAllLink="/lab-management/schedule"
      viewAllText="View Schedule"
      loading={loading}
    >
      {assignments.length === 0 ? (
        <WidgetEmpty
          icon={<Calendar className="w-10 h-10 mx-auto" />}
          message="No upcoming lab assignments"
        />
      ) : (
        <div className="space-y-2">
          {assignments.map(assignment => {
            const labIsToday = isToday(assignment.lab_day.date);
            return (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <Link
                  href={`/lab-management/grade/station/${assignment.id}`}
                  className="flex-1 min-w-0 hover:opacity-80"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      isUrgent(assignment.lab_day.date)
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {formatDate(assignment.lab_day.date)}
                    </span>
                    {assignment.lab_day.start_time && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(assignment.lab_day.start_time)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 truncate">
                    {assignment.custom_title || assignment.scenario?.title || `Station ${assignment.station_number}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {assignment.lab_day.cohort.program.abbreviation} Group {assignment.lab_day.cohort.cohort_number} - Station {assignment.station_number}
                  </p>
                </Link>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {labIsToday && (
                    <Link
                      href={`/lab-management/schedule/${assignment.lab_day.id}`}
                      className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                      title="Open lab with timer"
                    >
                      <Timer className="w-4 h-4" />
                    </Link>
                  )}
                  <Link
                    href={`/lab-management/grade/station/${assignment.id}`}
                    className="p-1 text-gray-400"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
