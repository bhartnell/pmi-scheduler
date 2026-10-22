'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Calendar, ChevronRight, Timer } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface MyLabStation {
  id: string;
  station_number: number;
  title: string | null;
  instructor_name: string | null;
  is_mine: boolean;
}

interface MyLabDay {
  id: string;
  date: string;
  title: string | null;
  section_label: string | null;
  start_time: string | null;
  cohort_number: number | null;
  program: string | null;
  stations: MyLabStation[];
}

function localDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
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
  return dateString === localDateString(new Date());
}

export default function MyLabsWidget() {
  const { data: session } = useSession();
  const [labDays, setLabDays] = useState<MyLabDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchLabs = async () => {
      try {
        const res = await fetch(`/api/lab-management/my-labs?today=${localDateString(new Date())}`);
        if (res.ok) {
          const data = await res.json();
          setLabDays(data.labDays || []);
        }
      } catch (error) {
        console.error('Failed to fetch labs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLabs();
  }, [session?.user?.email]);

  // Today's lab days pinned first, then the rest in date order
  const todayDays = labDays.filter(d => isToday(d.date));
  const laterDays = labDays.filter(d => !isToday(d.date));

  const dayLabel = (d: MyLabDay) =>
    [d.program && d.cohort_number != null ? `${d.program} Group ${d.cohort_number}` : null, d.title || d.section_label]
      .filter(Boolean)
      .join(' - ') || 'Lab day';

  return (
    <WidgetCard
      title="My Upcoming Labs"
      icon={<Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />}
      viewAllLink="/labs/schedule"
      viewAllText="View Schedule"
      loading={loading}
    >
      {labDays.length === 0 ? (
        <WidgetEmpty
          icon={<Calendar className="w-10 h-10 mx-auto" />}
          message="No lab days scheduled in the next 7 days"
        />
      ) : (
        <div className="space-y-3">
          {todayDays.map(day => (
            <div key={day.id} className="rounded-lg border border-green-300 dark:border-green-700 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      Today
                    </span>
                    {day.start_time && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(day.start_time)}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 truncate">{dayLabel(day)}</p>
                </div>
                <Link
                  href={`/labs/schedule/${day.id}`}
                  className="flex items-center gap-1 min-h-[44px] px-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 text-sm flex-shrink-0"
                  title="Open lab with timer"
                >
                  <Timer className="w-4 h-4" />
                  Open lab
                </Link>
              </div>
              {day.stations.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No stations set up yet for this lab day.</p>
              ) : (
                <div className="grid grid-cols-2 max-md:grid-cols-1 gap-2">
                  {day.stations.map(st => (
                    <div
                      key={st.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${
                        st.is_mine
                          ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          Station {st.station_number}{st.is_mine ? ' (yours)' : ''}
                          {st.title ? ` - ${st.title}` : ''}
                        </p>
                        {st.instructor_name && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{st.instructor_name}</p>
                        )}
                      </div>
                      <Link
                        href={`/labs/grade/station/${st.id}`}
                        className="min-h-[44px] flex items-center px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex-shrink-0"
                      >
                        Grade
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {laterDays.map(day => (
            <Link
              key={day.id}
              href={`/labs/schedule/${day.id}`}
              className="flex items-center justify-between min-h-[44px] p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    isUrgent(day.date)
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {formatDate(day.date)}
                  </span>
                  {day.start_time && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(day.start_time)}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 truncate">{dayLabel(day)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
