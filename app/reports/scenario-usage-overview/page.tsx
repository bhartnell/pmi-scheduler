'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  BookOpen,
  Layers,
  Tag,
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import StatCard from '@/components/reports/StatCard';
import ReportCard from '@/components/reports/ReportCard';

interface ReportData {
  total_scenarios: number;
  active_scenarios: number;
  categories_used: number;
  top_by_usage: { id: string; name: string; category: string; difficulty: string; usage_count: number; last_used: string | null }[];
  difficulty_distribution: { name: string; value: number }[];
  category_distribution: { name: string; count: number }[];
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function ScenarioUsageOverviewPage() {
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
      const res = await fetch('/api/reports/scenario-usage-overview');
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
            <span className="text-gray-900 dark:text-white">Scenario Usage</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <BookOpen className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scenario Usage</h1>
              <p className="text-gray-600 dark:text-gray-400">Usage counts, difficulty distribution, and category coverage</p>
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
              <StatCard label="Total Scenarios" value={report.total_scenarios} icon={BookOpen} color="orange" />
              <StatCard label="Active Scenarios" value={report.active_scenarios} icon={Layers} color="green" />
              <StatCard label="Categories Used" value={report.categories_used} icon={Tag} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ReportCard title="Top 20 Scenarios by Usage">
                {report.top_by_usage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={report.top_by_usage} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={160}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip />
                      <Bar dataKey="usage_count" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No usage data</p>
                )}
              </ReportCard>

              <ReportCard title="Difficulty Distribution">
                {report.difficulty_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={report.difficulty_distribution}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, value }) => `${name} (${value})`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {report.difficulty_distribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No difficulty data</p>
                )}
              </ReportCard>
            </div>

            <ReportCard title="Category Coverage">
              {report.category_distribution.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Category</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Scenario Count</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {report.category_distribution.map((cat) => {
                        const pct = report.total_scenarios > 0 ? Math.round((cat.count / report.total_scenarios) * 100) : 0;
                        return (
                          <tr key={cat.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                              <span className="px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">
                                {cat.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-900 dark:text-white font-bold">{cat.count}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 max-w-[120px] bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div className="h-2 rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No category data</p>
              )}
            </ReportCard>
          </>
        )}
      </main>
    </div>
  );
}
