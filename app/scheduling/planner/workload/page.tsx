'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Calendar, RefreshCw, Download,
  Users, Clock, AlertTriangle, BarChart3, ChevronDown, ChevronUp,
  Search, Filter,
} from 'lucide-react';
import type { PmiSemester, PmiInstructorWorkload } from '@/types/semester-planner';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const HEAT_LEVELS = [
  { max: 0, label: 'None', bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-400 dark:text-gray-500' },
  { max: 10, label: 'Light', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
  { max: 20, label: 'Moderate', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
  { max: 30, label: 'Heavy', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  { max: Infinity, label: 'Overloaded', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
];

const OVERLOAD_THRESHOLD = 20;

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function getHeatColor(hours: number): { bg: string; text: string } {
  for (const level of HEAT_LEVELS) {
    if (hours <= level.max) return { bg: level.bg, text: level.text };
  }
  return { bg: HEAT_LEVELS[HEAT_LEVELS.length - 1].bg, text: HEAT_LEVELS[HEAT_LEVELS.length - 1].text };
}

function formatWeekLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

interface InstructorData {
  instructor: { id: string; name: string; email: string };
  weeks: Map<number, PmiInstructorWorkload>;
  totalHours: number;
  avgHours: number;
  maxHours: number;
  programs: string[];
}

function buildInstructorWeekMap(workload: PmiInstructorWorkload[]): Map<string, InstructorData> {
  const map = new Map<string, InstructorData>();

  for (const w of workload) {
    const instrId = w.instructor_id;
    if (!map.has(instrId)) {
      map.set(instrId, {
        instructor: w.instructor || { id: instrId, name: 'Unknown', email: '' },
        weeks: new Map(),
        totalHours: 0,
        avgHours: 0,
        maxHours: 0,
        programs: [],
      });
    }
    const entry = map.get(instrId)!;
    entry.weeks.set(w.week_number, w);
    entry.totalHours += w.total_hours;
    if (w.total_hours > entry.maxHours) entry.maxHours = w.total_hours;

    // Collect unique programs
    for (const p of (w.programs || [])) {
      if (!entry.programs.includes(p)) entry.programs.push(p);
    }
  }

  // Calculate averages
  for (const entry of map.values()) {
    const weekCount = entry.weeks.size;
    entry.avgHours = weekCount > 0 ? Math.round((entry.totalHours / weekCount) * 10) / 10 : 0;
    entry.totalHours = Math.round(entry.totalHours * 10) / 10;
  }

  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SummaryCards
// ═══════════════════════════════════════════════════════════════════════════════

function SummaryCards({
  instructorMap,
  weekNumbers,
  weekDates,
}: {
  instructorMap: Map<string, InstructorData>;
  weekNumbers: number[];
  weekDates: Map<number, string>;
}) {
  const stats = useMemo(() => {
    const instructors = Array.from(instructorMap.values());
    const totalInstructors = instructors.length;

    // Average weekly hours across all instructors
    const allAvgs = instructors.map(i => i.avgHours);
    const overallAvg = totalInstructors > 0
      ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / totalInstructors) * 10) / 10
      : 0;

    // Peak week — highest total hours across all instructors in a single week
    let peakWeek = 0;
    let peakWeekHours = 0;
    for (const wk of weekNumbers) {
      let weekTotal = 0;
      for (const instr of instructors) {
        const w = instr.weeks.get(wk);
        if (w) weekTotal += w.total_hours;
      }
      if (weekTotal > peakWeekHours) {
        peakWeekHours = weekTotal;
        peakWeek = wk;
      }
    }
    const peakWeekLabel = peakWeek > 0 && weekDates.has(peakWeek)
      ? `Wk ${peakWeek} (${formatWeekLabel(weekDates.get(peakWeek)!)})`
      : '—';

    // Max individual — instructor with highest single-week hours
    let maxInstructor = '—';
    let maxHours = 0;
    let maxWeek = 0;
    for (const instr of instructors) {
      for (const [wk, w] of instr.weeks) {
        if (w.total_hours > maxHours) {
          maxHours = w.total_hours;
          maxInstructor = instr.instructor.name;
          maxWeek = wk;
        }
      }
    }
    const maxLabel = maxHours > 0 ? `${maxHours}h in Wk ${maxWeek}` : '—';

    return { totalInstructors, overallAvg, peakWeekLabel, peakWeekHours, maxInstructor, maxLabel };
  }, [instructorMap, weekNumbers, weekDates]);

  const cards = [
    {
      icon: Users,
      label: 'Total Instructors',
      value: stats.totalInstructors,
      sub: `across ${weekNumbers.length} weeks`,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      icon: Clock,
      label: 'Avg Weekly Hours',
      value: stats.overallAvg,
      sub: 'per instructor',
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      icon: AlertTriangle,
      label: 'Peak Week',
      value: stats.peakWeekLabel,
      sub: `${Math.round(stats.peakWeekHours * 10) / 10} total hours`,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      icon: BarChart3,
      label: 'Max Individual',
      value: stats.maxInstructor,
      sub: stats.maxLabel,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-md ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white truncate">{card.value}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// InstructorDetailRow
// ═══════════════════════════════════════════════════════════════════════════════

function InstructorDetailRow({
  data,
  weekNumbers,
  weekDates,
}: {
  data: InstructorData;
  weekNumbers: number[];
  weekDates: Map<number, string>;
}) {
  const maxHoursInAnyWeek = data.maxHours || 1;

  return (
    <tr>
      <td
        colSpan={weekNumbers.length + 3}
        className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700"
      >
        <div className="space-y-3">
          {/* Programs */}
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Programs: </span>
            <span className="text-xs text-gray-700 dark:text-gray-300">
              {data.programs.length > 0 ? data.programs.join(', ') : 'None assigned'}
            </span>
          </div>

          {/* Weekly bar chart */}
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Weekly Hours</span>
            <div className="flex items-end gap-1" style={{ height: '60px' }}>
              {weekNumbers.map(wk => {
                const w = data.weeks.get(wk);
                const hours = w?.total_hours || 0;
                const pct = Math.max((hours / maxHoursInAnyWeek) * 100, 2);
                const isOverloaded = hours > OVERLOAD_THRESHOLD;
                return (
                  <div
                    key={wk}
                    className="flex flex-col items-center flex-1 min-w-0"
                    title={`Wk ${wk} (${weekDates.has(wk) ? formatWeekLabel(weekDates.get(wk)!) : ''}): ${hours}h`}
                  >
                    <div
                      className={`w-full rounded-t ${isOverloaded ? 'bg-red-400 dark:bg-red-500' : 'bg-blue-400 dark:bg-blue-500'}`}
                      style={{ height: `${pct}%`, minHeight: hours > 0 ? '4px' : '0px' }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-0.5">
              {weekNumbers.map(wk => (
                <div key={wk} className="flex-1 min-w-0 text-center">
                  <span className="text-[8px] text-gray-400">{wk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Block counts */}
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Blocks/week: </span>
            <span className="text-xs text-gray-700 dark:text-gray-300">
              {(() => {
                const counts = weekNumbers.map(wk => data.weeks.get(wk)?.block_count || 0);
                const min = Math.min(...counts);
                const max = Math.max(...counts);
                return min === max ? `${min}` : `${min}–${max}`;
              })()}
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HeatMapTable
// ═══════════════════════════════════════════════════════════════════════════════

function HeatMapTable({
  instructors,
  weekNumbers,
  weekDates,
  expandedInstructor,
  onToggleExpand,
}: {
  instructors: InstructorData[];
  weekNumbers: number[];
  weekDates: Map<number, string>;
  expandedInstructor: string | null;
  onToggleExpand: (id: string) => void;
}) {
  if (instructors.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No instructors match the current filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Week number row */}
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[160px]">
                Instructor
              </th>
              {weekNumbers.map(wk => (
                <th key={wk} className="px-1 py-1 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 min-w-[52px]">
                  Wk {wk}
                </th>
              ))}
              <th className="px-2 py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[56px] bg-gray-50 dark:bg-gray-800">
                Total
              </th>
              <th className="px-2 py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[50px] bg-gray-50 dark:bg-gray-800">
                Avg
              </th>
            </tr>
            {/* Date row */}
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-left text-[10px] text-gray-400 dark:text-gray-500" />
              {weekNumbers.map(wk => (
                <th key={wk} className="px-1 py-0.5 text-center text-[9px] text-gray-400 dark:text-gray-500">
                  {weekDates.has(wk) ? formatWeekLabel(weekDates.get(wk)!) : ''}
                </th>
              ))}
              <th className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800" />
              <th className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800" />
            </tr>
          </thead>
          <tbody>
            {instructors.map((instrData) => {
              const isExpanded = expandedInstructor === instrData.instructor.id;
              const isOverloaded = instrData.maxHours > OVERLOAD_THRESHOLD;

              return (
                <React.Fragment key={instrData.instructor.id}>
                  <tr
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 cursor-pointer transition-colors"
                    onClick={() => onToggleExpand(instrData.instructor.id)}
                  >
                    {/* Instructor name (sticky) */}
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-2 border-r border-gray-100 dark:border-gray-700/50">
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                            {instrData.instructor.name}
                            {isOverloaded && (
                              <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                            {instrData.programs.join(', ') || 'No programs'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Week cells */}
                    {weekNumbers.map(wk => {
                      const w = instrData.weeks.get(wk);
                      const hours = w?.total_hours || 0;
                      const heat = getHeatColor(hours);
                      return (
                        <td key={wk} className={`px-1 py-1.5 text-center ${heat.bg}`}>
                          <span className={`text-xs font-medium ${heat.text}`}>
                            {hours > 0 ? hours : '—'}
                          </span>
                        </td>
                      );
                    })}

                    {/* Total */}
                    <td className="px-2 py-1.5 text-center bg-gray-50 dark:bg-gray-800 border-l border-gray-100 dark:border-gray-700/50">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                        {instrData.totalHours}
                      </span>
                    </td>

                    {/* Average */}
                    <td className="px-2 py-1.5 text-center bg-gray-50 dark:bg-gray-800">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {instrData.avgHours}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <InstructorDetailRow
                      data={instrData}
                      weekNumbers={weekNumbers}
                      weekDates={weekDates}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Legend
// ═══════════════════════════════════════════════════════════════════════════════

function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
      <span className="font-medium">Legend:</span>
      {HEAT_LEVELS.map((level, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`w-4 h-3 rounded ${level.bg} border border-gray-200 dark:border-gray-600`} />
          <span>
            {level.label}
            {level.max < Infinity && level.max > 0 ? ` (≤${level.max}h)` : level.max === Infinity ? ` (>${HEAT_LEVELS[HEAT_LEVELS.length - 2].max}h)` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';

export default function WorkloadTrackerPage() {
  // ── Data state ──
  const [semesters, setSemesters] = useState<PmiSemester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [workload, setWorkload] = useState<PmiInstructorWorkload[]>([]);

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showOverloadedOnly, setShowOverloadedOnly] = useState(false);
  const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);

  // ── Computed data ──
  const instructorMap = useMemo(() => buildInstructorWeekMap(workload), [workload]);

  const weekNumbers = useMemo(() => {
    const nums = new Set(workload.map(w => w.week_number));
    return Array.from(nums).sort((a, b) => a - b);
  }, [workload]);

  const weekDates = useMemo(() => {
    const map = new Map<number, string>();
    workload.forEach(w => {
      if (!map.has(w.week_number)) map.set(w.week_number, w.week_start_date);
    });
    return map;
  }, [workload]);

  const filteredInstructors = useMemo(() => {
    let entries = Array.from(instructorMap.values());
    if (filterText) {
      const lower = filterText.toLowerCase();
      entries = entries.filter(e =>
        e.instructor.name.toLowerCase().includes(lower) ||
        e.instructor.email.toLowerCase().includes(lower)
      );
    }
    if (showOverloadedOnly) {
      entries = entries.filter(e => e.maxHours > OVERLOAD_THRESHOLD);
    }
    return entries.sort((a, b) => b.totalHours - a.totalHours);
  }, [instructorMap, filterText, showOverloadedOnly]);

  // ── Data fetching ──
  const fetchWorkload = useCallback(async (semesterId: string) => {
    try {
      const res = await fetch(`/api/scheduling/planner/workload?semester_id=${semesterId}`);
      if (!res.ok) throw new Error('Failed to load workload data');
      const data = await res.json();
      setWorkload(data.workload || []);
    } catch (err) {
      console.error('Fetch workload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workload');
    }
  }, []);

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
        await fetchWorkload(activeSem.id);
      }
    } catch (err) {
      console.error('Fetch data error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fetchWorkload]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const switchSemester = useCallback(async (semId: string) => {
    setSelectedSemesterId(semId);
    setExpandedInstructor(null);
    setFilterText('');
    await fetchWorkload(semId);
  }, [fetchWorkload]);

  const handleRecalculate = useCallback(async () => {
    if (!selectedSemesterId || recalculating) return;
    try {
      setRecalculating(true);
      const res = await fetch('/api/scheduling/planner/workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semester_id: selectedSemesterId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to recalculate');
      }
      // Re-fetch updated workload
      await fetchWorkload(selectedSemesterId);
    } catch (err) {
      console.error('Recalculate error:', err);
      setError(err instanceof Error ? err.message : 'Recalculation failed');
    } finally {
      setRecalculating(false);
    }
  }, [selectedSemesterId, recalculating, fetchWorkload]);

  // ── CSV Export ──
  const handleExportCSV = useCallback(() => {
    if (filteredInstructors.length === 0) return;

    const headers = ['Instructor', 'Email', ...weekNumbers.map(wk => `Wk ${wk}`), 'Total', 'Average'];
    const rows = filteredInstructors.map(instr => {
      const weekCols = weekNumbers.map(wk => {
        const w = instr.weeks.get(wk);
        return w ? String(w.total_hours) : '0';
      });
      return [
        instr.instructor.name,
        instr.instructor.email,
        ...weekCols,
        String(instr.totalHours),
        String(instr.avgHours),
      ];
    });

    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const semName = semesters.find(s => s.id === selectedSemesterId)?.name || 'workload';
    link.href = url;
    link.download = `workload-${semName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredInstructors, weekNumbers, semesters, selectedSemesterId]);

  // ── Toggle expand ──
  const toggleExpand = useCallback((id: string) => {
    setExpandedInstructor(prev => prev === id ? null : id);
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading Workload Tracker...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error && workload.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link
            href="/scheduling/planner"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Planner
          </Link>
        </div>
      </div>
    );
  }

  const selectedSemester = semesters.find(s => s.id === selectedSemesterId);
  const overloadedCount = Array.from(instructorMap.values()).filter(i => i.maxHours > OVERLOAD_THRESHOLD).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/scheduling/planner"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Workload Tracker</h1>
            </div>

            {/* Semester dropdown */}
            <select
              className="ml-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            {/* Recalculate button */}
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {recalculating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Recalculate
            </button>

            {/* Export button */}
            <button
              onClick={handleExportCSV}
              disabled={filteredInstructors.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* ── Empty state ── */}
        {workload.length === 0 && !loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              No workload data yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
              Click &quot;Recalculate&quot; to generate workload data from the current schedule blocks.
              Make sure instructors are assigned to blocks in the planner first.
            </p>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {recalculating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Recalculate Workload
            </button>
          </div>
        ) : workload.length > 0 && (
          <>
            {/* ── Filter bar ── */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search instructor..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                Show overloaded only ({`>${OVERLOAD_THRESHOLD}h/wk`})
              </label>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {filteredInstructors.length} of {instructorMap.size} instructor{instructorMap.size !== 1 ? 's' : ''}
              </span>
            </div>

            {/* ── Summary cards ── */}
            <SummaryCards
              instructorMap={instructorMap}
              weekNumbers={weekNumbers}
              weekDates={weekDates}
            />

            {/* ── Heat map table ── */}
            <HeatMapTable
              instructors={filteredInstructors}
              weekNumbers={weekNumbers}
              weekDates={weekDates}
              expandedInstructor={expandedInstructor}
              onToggleExpand={toggleExpand}
            />

            {/* ── Legend ── */}
            <HeatLegend />

            {/* ── Semester info ── */}
            {selectedSemester && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                {selectedSemester.name}: {selectedSemester.start_date} to {selectedSemester.end_date}
                {workload.length > 0 && ` · Last updated ${new Date(workload[0].updated_at).toLocaleDateString()}`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
