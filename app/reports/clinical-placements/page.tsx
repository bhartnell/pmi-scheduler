'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Hospital,
  Users,
  Clock,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import StatCard from '@/components/reports/StatCard';
import ReportCard from '@/components/reports/ReportCard';

interface SiteUsageRow {
  id: string;
  name: string;
  abbreviation: string;
  system: string | null;
  rotation_count: number;
  student_count: number;
  last_rotation: string | null;
}

interface ReportData {
  total_sites: number;
  active_students: number;
  avg_hours_per_student: number;
  total_clinical_hours: number;
  site_usage: SiteUsageRow[];
  hours_by_site: { name: string; hours: number }[];
  internship_pipeline: { phase: string; count: number }[];
}

export default function ClinicalPlacementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/clinical-placements');
      const data = await res.json();
      if (data.success) {
        setReport(data);
      } else {
        setError(data.error || 'Failed to load report');
      }
    } catch {
      setError('Failed to load report. Please try again.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchReport();
  }, [session, fetchReport]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/reports" className="hover:text-blue-600 dark:hover:text-blue-400">Reports</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Clinical Placements</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Hospital className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical Placements</h1>
              <p className="text-gray-600 dark:text-gray-400">Site utilization, clinical hours, and internship pipeline</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={fetchReport} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && report && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Total Sites" value={report.total_sites} icon={Hospital} color="red" />
              <StatCard label="Active Students" value={report.active_students} icon={Users} color="blue" />
              <StatCard label="Avg Hours/Student" value={report.avg_hours_per_student} icon={Clock} color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ReportCard title="Site Utilization (by rotations)">
                {report.site_usage.filter((s) => s.rotation_count > 0).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.site_usage.filter((s) => s.rotation_count > 0)}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="abbreviation" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: any) => [value, 'Rotations']}
                        labelFormatter={(label: any) => {
                          const site = report.site_usage.find((s) => s.abbreviation === String(label));
                          return site?.name || String(label);
                        }}
                      />
                      <Bar dataKey="rotation_count" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No rotation data</p>
                )}
              </ReportCard>

              <ReportCard title="Hours by Site/Category">
                {report.hours_by_site.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.hours_by_site.slice(0, 15)}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No clinical hours data</p>
                )}
              </ReportCard>
            </div>

            {/* Internship Pipeline */}
            {report.internship_pipeline.length > 0 && (
              <ReportCard title="Internship Pipeline">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {report.internship_pipeline.map((stage) => (
                    <div
                      key={stage.phase}
                      className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{stage.count}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{stage.phase}</p>
                    </div>
                  ))}
                </div>
              </ReportCard>
            )}

            {/* Site Details Table */}
            <ReportCard title="Site Details">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Site</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">System</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Rotations</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Students</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Last Rotation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {report.site_usage.map((site) => (
                      <tr key={site.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white">{site.name}</span>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({site.abbreviation})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm">
                          {site.system || '--'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                          {site.rotation_count}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900 dark:text-white">
                          {site.student_count}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm">
                          {site.last_rotation
                            ? new Date(site.last_rotation + 'T00:00:00').toLocaleDateString()
                            : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          </>
        )}
      </main>
    </div>
  );
}
