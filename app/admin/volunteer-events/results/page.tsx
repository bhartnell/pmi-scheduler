'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Download,
  Users,
  UserCheck,
  Loader2,
  ArrowLeft,
  Filter,
  ClipboardCheck,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Registration {
  id: string;
  event_id: string;
  name: string;
  email: string;
  phone: string | null;
  volunteer_type: string;
  agency_affiliation: string | null;
  needs_evaluation: boolean;
  evaluation_skill: string | null;
  evaluation_status: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface EventWithRegistrations {
  id: string;
  name: string;
  event_type: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  registrations: Registration[];
  registration_count: number;
}

interface Summary {
  total_unique_volunteers: number;
  total_registrations: number;
  instructor1_count: number;
  general_count: number;
  needs_evaluation: number;
}

const TYPE_LABELS: Record<string, string> = {
  instructor1: 'Instructor 1',
  general: 'General',
  former_student: 'Former Student',
  community: 'Community',
};

const TYPE_STYLES: Record<string, string> = {
  instructor1: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  general: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  former_student: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  community: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

const STATUS_STYLES: Record<string, string> = {
  registered: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  attended: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  no_show: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

export default function VolunteerResultsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<EventWithRegistrations[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchResults = useCallback(async (filter: string) => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?type=${filter}` : '';
      const res = await fetch(`/api/volunteer/results${params}`);
      const data = await res.json();

      if (data.success) {
        setEvents(data.data);
        setSummary(data.summary);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    if (status === 'authenticated') {
      fetchResults(typeFilter);
    }
  }, [status, router, fetchResults, typeFilter]);

  const handleExport = () => {
    const params = typeFilter !== 'all' ? `&type=${typeFilter}` : '';
    window.open(`/api/volunteer/results?format=csv${params}`, '_blank');
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Volunteer Management', href: '/admin/volunteer-events' },
            { label: 'Results' },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/admin/volunteer-events"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Volunteer Results
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 ml-8">
              All registrations across volunteer events
            </p>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.total_unique_volunteers}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Unique Volunteers</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.total_registrations}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Registrations</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-amber-600">{summary.instructor1_count}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Instructor 1</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.general_count}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">General</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.needs_evaluation}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Need Evaluation</div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Filter by type:</span>
          {['all', 'instructor1', 'general', 'former_student', 'community'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                typeFilter === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>

        {/* Per-Event Sections */}
        {events.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            No volunteer events found.
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {event.name}
                      </h3>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex gap-3">
                        <span>
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {event.location && <span>{event.location}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Users className="h-4 w-4" />
                      {event.registration_count} volunteer(s)
                    </div>
                  </div>
                </div>

                {event.registrations.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No registrations for this event.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-gray-600 dark:text-gray-300">
                          <th className="px-4 py-2 font-medium">Name</th>
                          <th className="px-4 py-2 font-medium">Email</th>
                          <th className="px-4 py-2 font-medium">Phone</th>
                          <th className="px-4 py-2 font-medium">Type</th>
                          <th className="px-4 py-2 font-medium">Agency</th>
                          <th className="px-4 py-2 font-medium">Evaluation</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {event.registrations.map((reg) => (
                          <tr key={reg.id} className="text-gray-900 dark:text-white">
                            <td className="px-4 py-2 font-medium">{reg.name}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                              {reg.email}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                              {reg.phone || '-'}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLES[reg.volunteer_type] || ''}`}>
                                {TYPE_LABELS[reg.volunteer_type] || reg.volunteer_type}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                              {reg.agency_affiliation || '-'}
                            </td>
                            <td className="px-4 py-2">
                              {reg.needs_evaluation ? (
                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                  <ClipboardCheck className="h-3 w-3" />
                                  {reg.evaluation_skill || 'Yes'}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[reg.status] || ''}`}>
                                {reg.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
