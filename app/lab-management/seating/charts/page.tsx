'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Layout,
  Plus,
  Edit2,
  Trash2,
  Home,
  Filter,
  Eye,
  Check,
  Calendar
} from 'lucide-react';
import { canManageContent, type Role } from '@/lib/permissions';

interface Chart {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  cohort: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string };
  };
  classroom: {
    id: string;
    name: string;
  };
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { name: string; abbreviation: string };
}

function SeatingChartsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCohortId = searchParams.get('cohortId');

  const [charts, setCharts] = useState<Chart[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCohort, setSelectedCohort] = useState<string>(initialCohortId || '');
  const [creating, setCreating] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchCharts();
    }
  }, [session, selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchCharts = async () => {
    setLoading(true);
    try {
      const url = selectedCohort
        ? `/api/seating/charts?cohortId=${selectedCohort}`
        : '/api/seating/charts';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCharts(data.charts || []);
      }
    } catch (error) {
      console.error('Error fetching charts:', error);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!selectedCohort) {
      alert('Please select a cohort first');
      return;
    }

    setCreating(true);
    try {
      const cohort = cohorts.find(c => c.id === selectedCohort);
      const res = await fetch('/api/seating/charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: selectedCohort,
          name: `${cohort?.program.abbreviation} ${cohort?.cohort_number} Seating`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/lab-management/seating/charts/${data.chart.id}`);
      } else {
        alert('Failed to create chart: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating chart:', error);
      alert('Failed to create chart');
    }
    setCreating(false);
  };

  const handleDelete = async (chartId: string) => {
    if (!confirm('Are you sure you want to delete this seating chart?')) return;

    try {
      const res = await fetch(`/api/seating/charts/${chartId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        setCharts(charts.filter(c => c.id !== chartId));
      }
    } catch (error) {
      console.error('Error deleting chart:', error);
    }
  };

  const handleSetActive = async (chartId: string) => {
    try {
      const res = await fetch(`/api/seating/charts/${chartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });

      const data = await res.json();
      if (data.success) {
        setCharts(charts.map(c => ({
          ...c,
          is_active: c.id === chartId,
        })));
      }
    } catch (error) {
      console.error('Error setting active:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Seating Charts</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Layout className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seating Charts</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage classroom seating arrangements</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !selectedCohort}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              <Plus className="w-5 h-5" />
              {creating ? 'Creating...' : 'New Chart'}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 min-w-[200px]"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.program.abbreviation} Group {c.cohort_number}
                </option>
              ))}
            </select>
          </div>
          {!selectedCohort && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Select a cohort to create a new chart</p>
          )}
        </div>

        {/* Charts List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {charts.length === 0 ? (
            <div className="p-8 text-center">
              <Layout className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {selectedCohort ? 'No seating charts for this cohort' : 'No seating charts created yet'}
              </p>
              {selectedCohort && (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Create First Chart
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {charts.map((chart) => (
                <div
                  key={chart.id}
                  className={`p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${chart.is_active ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${chart.is_active ? 'bg-green-100 dark:bg-green-900/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <Layout className={`w-5 h-5 ${chart.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{chart.name}</span>
                        {chart.is_active && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 text-xs rounded font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-3">
                        <span>{chart.cohort.program.abbreviation} Group {chart.cohort.cohort_number}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(chart.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/lab-management/seating/charts/${chart.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Link>
                    {!chart.is_active && (
                      <button
                        onClick={() => handleSetActive(chart.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                      >
                        <Check className="w-4 h-4" />
                        Set Active
                      </button>
                    )}
                    {userRole && canManageContent(userRole) && (
                      <button
                        onClick={() => handleDelete(chart.id)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SeatingChartsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SeatingChartsContent />
    </Suspense>
  );
}
