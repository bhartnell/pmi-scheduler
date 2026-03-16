'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Download, Users, AlertTriangle, Search,
  Calendar, Filter, Clock, Building2, Stethoscope, Shield,
} from 'lucide-react';
import type { PmiSemester, PmiInstructorWorkload } from '@/types/semester-planner';

const OVERLOAD_THRESHOLD = 30;

interface InstructorSummary {
  id: string;
  name: string;
  email: string;
  classHours: number;
  labHours: number;
  lvfrHours: number;
  shiftHours: number;
  otherHours: number;
  totalHours: number;
  weekCount: number;
  avgWeeklyHours: number;
  isOverloaded: boolean;
}

function buildSummaries(workload: PmiInstructorWorkload[]): InstructorSummary[] {
  const map = new Map<string, InstructorSummary>();

  for (const w of workload) {
    const id = w.instructor_id;
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: w.instructor?.name || 'Unknown',
        email: w.instructor?.email || '',
        classHours: 0,
        labHours: 0,
        lvfrHours: 0,
        shiftHours: 0,
        otherHours: 0,
        totalHours: 0,
        weekCount: 0,
        avgWeeklyHours: 0,
        isOverloaded: false,
      });
    }
    const entry = map.get(id)!;
    entry.totalHours += w.total_hours;
    entry.weekCount = Math.max(entry.weekCount, 1);

    // Categorize based on programs array
    // Note: the workload record has total_hours for ALL programs that week,
    // and programs[] is the list of program names. We approximate by dividing
    // evenly among programs (since we don't have per-program hour breakdowns).
    const programs = w.programs || [];
    const programCount = programs.length || 1;
    const hoursPerProgram = w.total_hours / programCount;

    for (const p of programs) {
      if (p === 'Lab') {
        entry.labHours += hoursPerProgram;
      } else if (p === 'LVFR') {
        entry.lvfrHours += hoursPerProgram;
      } else if (p === 'Shift') {
        entry.shiftHours += hoursPerProgram;
      } else {
        entry.classHours += hoursPerProgram;
      }
    }
    if (programs.length === 0) {
      entry.otherHours += w.total_hours;
    }
  }

  // Calculate averages
  for (const entry of map.values()) {
    // Count unique weeks
    const weeks = new Set(workload.filter(w => w.instructor_id === entry.id).map(w => w.week_number));
    entry.weekCount = weeks.size;
    entry.avgWeeklyHours = entry.weekCount > 0 ? Math.round((entry.totalHours / entry.weekCount) * 10) / 10 : 0;
    entry.isOverloaded = entry.avgWeeklyHours > OVERLOAD_THRESHOLD;
    // Round all hours
    entry.classHours = Math.round(entry.classHours * 10) / 10;
    entry.labHours = Math.round(entry.labHours * 10) / 10;
    entry.lvfrHours = Math.round(entry.lvfrHours * 10) / 10;
    entry.shiftHours = Math.round(entry.shiftHours * 10) / 10;
    entry.otherHours = Math.round(entry.otherHours * 10) / 10;
    entry.totalHours = Math.round(entry.totalHours * 10) / 10;
  }

  return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
}

export default function AdminInstructorWorkloadPage() {
  const [semesters, setSemesters] = useState<PmiSemester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [workload, setWorkload] = useState<PmiInstructorWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showOverloadedOnly, setShowOverloadedOnly] = useState(false);

  const summaries = useMemo(() => buildSummaries(workload), [workload]);

  const filtered = useMemo(() => {
    let result = summaries;
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(lower) || s.email.toLowerCase().includes(lower));
    }
    if (showOverloadedOnly) {
      result = result.filter(s => s.isOverloaded);
    }
    return result;
  }, [summaries, filterText, showOverloadedOnly]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const semRes = await fetch('/api/scheduling/planner/semesters');
      if (!semRes.ok) throw new Error('Failed to load semesters');
      const semData = await semRes.json();
      const sems: PmiSemester[] = semData.semesters || [];
      setSemesters(sems);

      if (sems.length > 0) {
        const activeSem = sems.find(s => s.is_active) || sems[0];
        setSelectedSemesterId(activeSem.id);
        const wRes = await fetch(`/api/scheduling/planner/workload?semester_id=${activeSem.id}`);
        if (wRes.ok) {
          const wData = await wRes.json();
          setWorkload(wData.workload || []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const switchSemester = useCallback(async (semId: string) => {
    setSelectedSemesterId(semId);
    try {
      const res = await fetch(`/api/scheduling/planner/workload?semester_id=${semId}`);
      if (res.ok) {
        const data = await res.json();
        setWorkload(data.workload || []);
      }
    } catch {}
  }, []);

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) return;
    const headers = ['Instructor', 'Email', 'Classes', 'Labs', 'LVFR', 'Shifts', 'Other', 'Total (semester)', 'Avg/Week'];
    const rows = filtered.map(s => [
      s.name, s.email,
      s.classHours > 0 ? `${s.classHours}` : '—',
      s.labHours > 0 ? `${s.labHours}` : '—',
      s.lvfrHours > 0 ? `${s.lvfrHours}` : '—',
      s.shiftHours > 0 ? `${s.shiftHours}` : '—',
      s.otherHours > 0 ? `${s.otherHours}` : '—',
      `${s.totalHours}`,
      `${s.avgWeeklyHours}`,
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const semName = semesters.find(s => s.id === selectedSemesterId)?.name || 'workload';
    link.href = url;
    link.download = `instructor-workload-${semName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filtered, semesters, selectedSemesterId]);

  const overloadedCount = summaries.filter(s => s.isOverloaded).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading workload data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </Link>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Instructor Workload Overview</h1>
            </div>
            <select
              className="ml-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5"
              value={selectedSemesterId}
              onChange={(e) => switchSemester(e.target.value)}
            >
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>{sem.name}</option>
              ))}
            </select>
            {overloadedCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                {overloadedCount} overloaded
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/scheduling/planner/workload"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Calendar className="w-3.5 h-3.5" />
              Heat Map View
            </Link>
            <button
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search instructor..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showOverloadedOnly}
              onChange={(e) => setShowOverloadedOnly(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500"
            />
            <Filter className="w-3.5 h-3.5" />
            Overloaded only (&gt;{OVERLOAD_THRESHOLD}h/wk)
          </label>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} of {summaries.length} instructors
          </span>
        </div>

        {/* Summary Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Instructor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-1"><Building2 className="w-3.5 h-3.5" /> Classes</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-1"><Stethoscope className="w-3.5 h-3.5" /> Labs</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-1"><Shield className="w-3.5 h-3.5" /> LVFR</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5" /> Shifts</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50">
                    <div className="flex items-center justify-center gap-1 font-semibold">Total</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50">
                    Avg/Week
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No instructors match the current filters
                    </td>
                  </tr>
                ) : filtered.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                            {s.name}
                            {s.isOverloaded && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={s.classHours > 0 ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-300 dark:text-gray-600'}>
                        {s.classHours > 0 ? `${s.classHours}h` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={s.labHours > 0 ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-300 dark:text-gray-600'}>
                        {s.labHours > 0 ? `${s.labHours}h` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={s.lvfrHours > 0 ? 'text-orange-700 dark:text-orange-400 font-medium' : 'text-gray-300 dark:text-gray-600'}>
                        {s.lvfrHours > 0 ? `${s.lvfrHours}h` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={s.shiftHours > 0 ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-300 dark:text-gray-600'}>
                        {s.shiftHours > 0 ? `${s.shiftHours}h` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center bg-gray-50 dark:bg-gray-700/30">
                      <span className="font-semibold text-gray-900 dark:text-white">{s.totalHours}h</span>
                    </td>
                    <td className={`px-4 py-3 text-center bg-gray-50 dark:bg-gray-700/30 font-medium ${
                      s.avgWeeklyHours > OVERLOAD_THRESHOLD ? 'text-red-600 dark:text-red-400' :
                      s.avgWeeklyHours > 20 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {s.avgWeeklyHours}h/wk
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info */}
        {semesters.find(s => s.id === selectedSemesterId) && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            {semesters.find(s => s.id === selectedSemesterId)?.name} ·
            {' '}Showing {workload.length > 0 ? `${summaries.length} instructors across ${new Set(workload.map(w => w.week_number)).size} weeks` : 'no data'}
            {' '}· <Link href="/scheduling/planner/workload" className="text-blue-500 hover:underline">View weekly heat map →</Link>
          </p>
        )}
      </div>
    </div>
  );
}
