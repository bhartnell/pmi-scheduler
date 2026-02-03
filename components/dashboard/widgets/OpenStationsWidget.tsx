'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { AlertCircle, UserPlus } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface OpenStation {
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

function isUrgent(dateString: string): boolean {
  const date = new Date(dateString + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === today.toDateString() || date.toDateString() === tomorrow.toDateString();
}

export default function OpenStationsWidget() {
  const { data: session } = useSession();
  const [stations, setStations] = useState<OpenStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpenStations = async () => {
      try {
        const res = await fetch('/api/lab-management/stations?open=true&upcoming=true');
        if (res.ok) {
          const data = await res.json();
          setStations((data.stations || []).slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch open stations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOpenStations();
  }, []);

  const claimStation = async (stationId: string) => {
    if (!session?.user) return;
    setClaiming(stationId);
    try {
      const res = await fetch(`/api/lab-management/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_name: session.user.name || '',
          instructor_email: session.user.email || '',
        }),
      });

      if (res.ok) {
        setStations(prev => prev.filter(s => s.id !== stationId));
      }
    } catch (error) {
      console.error('Failed to claim station:', error);
    }
    setClaiming(null);
  };

  return (
    <WidgetCard
      title="Open Stations"
      icon={<AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
      viewAllLink="/lab-management/schedule"
      viewAllText="View All"
      loading={loading}
    >
      {stations.length === 0 ? (
        <WidgetEmpty
          icon={<AlertCircle className="w-10 h-10 mx-auto" />}
          message="All stations have instructors assigned!"
        />
      ) : (
        <div className="space-y-2">
          {stations.map(station => (
            <div
              key={station.id}
              className={`p-3 rounded-lg border ${
                isUrgent(station.lab_day.date)
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium inline-block px-2 py-0.5 rounded mb-1 ${
                    isUrgent(station.lab_day.date)
                      ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                      : 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300'
                  }`}>
                    {formatDate(station.lab_day.date)}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {station.custom_title || station.scenario?.title || `Station ${station.station_number}`}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {station.lab_day.cohort.program.abbreviation} Group {station.lab_day.cohort.cohort_number}
                  </p>
                </div>
                <button
                  onClick={() => claimStation(station.id)}
                  disabled={claiming === station.id}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {claiming === station.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                  ) : (
                    <UserPlus className="w-3 h-3" />
                  )}
                  Claim
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
