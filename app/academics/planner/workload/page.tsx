'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import React from 'react';
import {
  ArrowLeft, Loader2, Calendar, RefreshCw, Download,
  Users, Clock, AlertTriangle, BarChart3, ChevronDown, ChevronUp,
  Search, Filter, X,
} from 'lucide-react';
import type { PmiSemester, PmiInstructorWorkload } from '@/types/semester-planner';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const HEAT_LEVELS = [
  { max: 0, label: 'None', bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-400 dark:text-gray-500' },
  { max: 20, label: 'Normal', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
  { max: 30, label: 'Heavy', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
  { max: Infinity, label: 'Overloaded', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
];

const OVERLOAD_THRESHOLD = 30;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`;
}

interface InstructorData {
  instructor: { id: string; name: string; email: string };
  weeks: Map<number, PmiInstructorWorkload>;
  totalHours: number;
  totalClassHours: number;
  totalLabHours: number;
  totalLvfrHours: number;
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
        totalClassHours: 0,
        totalLabHours: 0,
        totalLvfrHours: 0,
        avgHours: 0,
        maxHours: 0,
        programs: [],
      });
    }
    const entry = map.get(instrId)!;
    entry.weeks.set(w.week_number, w);
    entry.totalHours += w.total_hours;
    entry.totalClassHours += (w.class_hours || 0);
    entry.totalLabHours += (w.lab_hours || 0);
    entry.totalLvfrHours += (w.lvfr_hours || 0);
    if (w.total_hours > entry.maxHours) entry.maxHours = w.total_hours;

    for (const p of (w.programs || [])) {
      if (!entry.programs.includes(p)) entry.programs.push(p);
    }
  }

  for (const entry of map.values()) {
    const weekCount = entry.weeks.size;
    entry.avgHours = weekCount > 0 ? Math.round((entry.totalHours / weekCount) * 10) / 10 : 0;
    entry.totalHours = Math.round(entry.totalHours * 10) / 10;
  }

  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BlockDetail types
// ═══════════════════════════════════════════════════════════════════════════════

interface BlockDetailItem {
  title: string;
  start_time: string;
  end_time: string;
  hours: number;
  day_of_week: number | null;
  date: string | null;
  room: string | null;
  source: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WeekDetailPanel — shown when a cell is clicked
// ═══════════════════════════════════════════════════════════════════════════════

function WeekDetailPanel({
  instructorName,
  weekNumber,
  weekDate,
  semesterId,
  instructorId,
  onClose,
}: {
  instructorName: string;
  weekNumber: number;
  weekDate: string;
  semesterId: string;
  instructorId: string;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<BlockDetailItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [classHours, setClassHours] = useState(0);
  const [labHours, setLabHours] = useState(0);
  const [lvfrHours, setLvfrHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/academics/planner/workload?semester_id=${semesterId}&instructor_id=${instructorId}&week_number=${weekNumber}`
        );
        if (!res.ok) throw new Error('Failed to load detail');
        const data = await res.json();
        if (!cancelled) {
          setDetails(data.details || []);
          setTotalHours(data.totalHours || 0);
          setClassHours(data.classHours || 0);
          setLabHours(data.labHours || 0);
          setLvfrHours(data.lvfrHours || 0);
        }
      } catch (err) {
        console.error('Detail load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [semesterId, instructorId, weekNumber]);

  // Group details by day
  const dayGroups = useMemo(() => {
    const groups = new Map<string, BlockDetailItem[]>();
    for (const d of details) {
      let dayLabel: string;
      if (d.date) {
        const dt = new Date(d.date + 'T00:00:00');
        dayLabel = `${DAY_NAMES[dt.getDay()]} ${d.date}`;
      } else if (d.day_of_week !== null && d.day_of_week !== undefined) {
        dayLabel = DAY_NAMES[d.day_of_week] || `Day ${d.day_of_week}`;
      } else {
        dayLabel = 'Other';
      }
      if (!groups.has(dayLabel)) groups.set(dayLabel, []);
      groups.get(dayLabel)!.push(d);
    }
    return groups;
  }, [details]);

  return (
    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-2">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-medium text-gray-900 dark:text-white text-sm">{instructorName}</span>
          <span className="text-gray-500 dark:text-gray-400 text-sm"> — Week {weekNumber}</span>
          {weekDate && <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">({formatWeekLabel(weekDate)})</span>}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-xs text-gray-500">Loading blocks...</span>
        </div>
      ) : details.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">No blocks found for this week</p>
      ) : (
        <div className="space-y-3">
          {Array.from(dayGroups.entries()).map(([dayLabel, dayDetails]) => (
            <div key={dayLabel}>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{dayLabel}</div>
              <div className="space-y-0.5">
                {dayDetails.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      d.source === 'lab' ? 'bg-emerald-400' :
                      d.source === 'lvfr' ? 'bg-orange-400' :
                      'bg-blue-400'
                    }`} />
                    <span className="text-gray-800 dark:text-gray-200 flex-1 truncate">{d.title}</span>
                    {d.start_time && d.end_time && (
                      <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatTime(d.start_time)}–{formatTime(d.end_time)}
                      </span>
                    )}
                    <span className="text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">{d.hours}h</span>
                    {d.room && <span className="text-gray-400 text-[10px]">({d.room})</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t border-blue-200 dark:border-blue-800 pt-2 flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
              {classHours > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />Classes: {classHours}h
                </span>
              )}
              {labHours > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />Labs: {labHours}h
                </span>
              )}
              {lvfrHours > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />LVFR: {lvfrHours}h
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-gray-900 dark:text-white">Total: {totalHours}h</span>
          </div>
        </div>
      )}
    </div>
  );
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

    const allAvgs = instructors.map(i => i.avgHours);
    const overallAvg = totalInstructors > 0
      ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / totalInstructors) * 10) / 10
      : 0;

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
// InstructorDetailRow — expanded view with bar chart
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
          {/* Hour breakdown summary */}
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Hours by Source</span>
            <div className="flex flex-wrap gap-3">
              {data.totalClassHours > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-gray-700 dark:text-gray-300">Classes: {Math.round(data.totalClassHours * 10) / 10}h</span>
                </div>
              )}
              {data.totalLabHours > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-gray-700 dark:text-gray-300">Labs: {Math.round(data.totalLabHours * 10) / 10}h</span>
                </div>
              )}
              {data.totalLvfrHours > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                  <span className="text-gray-700 dark:text-gray-300">LVFR: {Math.round(data.totalLvfrHours * 10) / 10}h</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Total: {data.totalHours}h</span>
              </div>
            </div>
            {/* Per-program list */}
            <div className="mt-1.5 flex flex-wrap gap-2">
              {data.programs.filter(p => p !== 'Lab' && p !== 'LVFR').map(program => (
                <span key={program} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{program}
                </span>
              ))}
            </div>
          </div>

          {/* Weekly stacked bar chart */}
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Weekly Hours</span>
            <div className="flex items-end gap-1" style={{ height: '60px' }}>
              {weekNumbers.map(wk => {
                const w = data.weeks.get(wk);
                const hours = w?.total_hours || 0;
                const classH = w?.class_hours || 0;
                const labH = w?.lab_hours || 0;
                const lvfrH = w?.lvfr_hours || 0;
                const pct = Math.max((hours / maxHoursInAnyWeek) * 100, 2);
                const classPct = hours > 0 ? (classH / hours) * pct : 0;
                const labPct = hours > 0 ? (labH / hours) * pct : 0;
                const lvfrPct = hours > 0 ? (lvfrH / hours) * pct : 0;
                const breakdownParts: string[] = [];
                if (classH > 0) breakdownParts.push(`Classes: ${classH}h`);
                if (labH > 0) breakdownParts.push(`Labs: ${labH}h`);
                if (lvfrH > 0) breakdownParts.push(`LVFR: ${lvfrH}h`);
                return (
                  <div
                    key={wk}
                    className="flex flex-col items-center flex-1 min-w-0"
                    title={`Wk ${wk} (${weekDates.has(wk) ? formatWeekLabel(weekDates.get(wk)!) : ''}): ${hours}h\n${breakdownParts.join(', ')}`}
                  >
                    <div className="w-full flex flex-col-reverse" style={{ height: `${pct}%`, minHeight: hours > 0 ? '4px' : '0px' }}>
                      {classPct > 0 && <div className="w-full bg-blue-400 dark:bg-blue-500" style={{ height: `${(classPct / pct) * 100}%`, minHeight: '1px' }} />}
                      {labPct > 0 && <div className="w-full bg-emerald-400 dark:bg-emerald-500" style={{ height: `${(labPct / pct) * 100}%`, minHeight: '1px' }} />}
                      {lvfrPct > 0 && <div className="w-full bg-orange-400 dark:bg-orange-500 rounded-t" style={{ height: `${(lvfrPct / pct) * 100}%`, minHeight: '1px' }} />}
                    </div>
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
  selectedCell,
  onCellClick,
  semesterId,
}: {
  instructors: InstructorData[];
  weekNumbers: number[];
  weekDates: Map<number, string>;
  expandedInstructor: string | null;
  onToggleExpand: (id: string) => void;
  selectedCell: { instructorId: string; weekNumber: number } | null;
  onCellClick: (instructorId: string, weekNumber: number) => void;
  semesterId: string;
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
              const hasDetailOpen = selectedCell?.instructorId === instrData.instructor.id;

              return (
                <React.Fragment key={instrData.instructor.id}>
                  <tr
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors"
                  >
                    {/* Instructor name (sticky) */}
                    <td
                      className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-2 border-r border-gray-100 dark:border-gray-700/50 cursor-pointer"
                      onClick={() => onToggleExpand(instrData.instructor.id)}
                    >
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

                    {/* Week cells — clickable for detail */}
                    {weekNumbers.map(wk => {
                      const w = instrData.weeks.get(wk);
                      const hours = w?.total_hours || 0;
                      const classH = w?.class_hours || 0;
                      const labH = w?.lab_hours || 0;
                      const lvfrH = w?.lvfr_hours || 0;
                      const heat = getHeatColor(hours);
                      const isSelected = selectedCell?.instructorId === instrData.instructor.id && selectedCell?.weekNumber === wk;
                      const breakdownParts: string[] = [];
                      if (classH > 0) breakdownParts.push(`Classes: ${classH}h`);
                      if (labH > 0) breakdownParts.push(`Labs: ${labH}h`);
                      if (lvfrH > 0) breakdownParts.push(`LVFR: ${lvfrH}h`);
                      return (
                        <td
                          key={wk}
                          className={`px-1 py-1.5 text-center cursor-pointer transition-all ${heat.bg} ${
                            isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:ring-1 hover:ring-blue-300 hover:ring-inset'
                          }`}
                          title={`Week ${wk}: ${hours}h\n${breakdownParts.join(', ') || 'No hours'}\n${w?.block_count || 0} blocks — Click for detail`}
                          onClick={() => onCellClick(instrData.instructor.id, wk)}
                        >
                          {hours > 0 ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-xs font-medium ${heat.text}`}>
                                {hours}
                              </span>
                              {(labH > 0 || lvfrH > 0) && (
                                <div className="flex gap-px justify-center">
                                  {classH > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                                  {labH > 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                                  {lvfrH > 0 && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className={`text-xs font-medium ${heat.text}`}>—</span>
                          )}
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

                  {/* Expanded bar chart detail */}
                  {isExpanded && (
                    <InstructorDetailRow
                      data={instrData}
                      weekNumbers={weekNumbers}
                      weekDates={weekDates}
                    />
                  )}

                  {/* Week block detail panel — shown below this instructor's row */}
                  {hasDetailOpen && selectedCell && (
                    <tr>
                      <td colSpan={weekNumbers.length + 3} className="px-4 py-0">
                        <WeekDetailPanel
                          instructorName={instrData.instructor.name}
                          weekNumber={selectedCell.weekNumber}
                          weekDate={weekDates.get(selectedCell.weekNumber) || ''}
                          semesterId={semesterId}
                          instructorId={instrData.instructor.id}
                          onClose={() => onCellClick('', 0)}
                        />
                      </td>
                    </tr>
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
    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">Heat:</span>
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
      <div className="flex flex-wrap items-center gap-3 border-l border-gray-200 dark:border-gray-700 pl-4">
        <span className="font-medium">Source:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <span>Classes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span>Labs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
          <span>LVFR</span>
        </div>
      </div>
      <span className="text-[10px] text-gray-400">Click any cell to see block detail</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════════════

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
  const [selectedCell, setSelectedCell] = useState<{ instructorId: string; weekNumber: number } | null>(null);

  // ── Computed data ──
  const instructorMap = useMemo(() => buildInstructorWeekMap(workload), [workload]);

  // Only show weeks that have actual data (at least one instructor with hours > 0)
  const weekNumbers = useMemo(() => {
    const numsWithData = new Set<number>();
    for (const w of workload) {
      if (w.total_hours > 0) numsWithData.add(w.week_number);
    }
    return Array.from(numsWithData).sort((a, b) => a - b);
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
      const res = await fetch(`/api/academics/planner/workload?semester_id=${semesterId}`);
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

      const semRes = await fetch('/api/academics/planner/semesters');
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
    setSelectedCell(null);
    setFilterText('');
    await fetchWorkload(semId);
  }, [fetchWorkload]);

  const handleRecalculate = useCallback(async () => {
    if (!selectedSemesterId || recalculating) return;
    try {
      setRecalculating(true);
      setSelectedCell(null);
      const res = await fetch('/api/academics/planner/workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semester_id: selectedSemesterId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to recalculate');
      }
      const result = await res.json();
      console.log('Recalculate result:', result); // Debug info in console
      await fetchWorkload(selectedSemesterId);
    } catch (err) {
      console.error('Recalculate error:', err);
      setError(err instanceof Error ? err.message : 'Recalculation failed');
    } finally {
      setRecalculating(false);
    }
  }, [selectedSemesterId, recalculating, fetchWorkload]);

  // ── Cell click handler ──
  const handleCellClick = useCallback((instructorId: string, weekNumber: number) => {
    if (!instructorId) {
      setSelectedCell(null);
      return;
    }
    // Toggle: if same cell, close it
    if (selectedCell?.instructorId === instructorId && selectedCell?.weekNumber === weekNumber) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ instructorId, weekNumber });
    }
  }, [selectedCell]);

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
            href="/academics/planner"
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
              href="/academics/planner"
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
                {' · '}{weekNumbers.length} weeks shown
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
              selectedCell={selectedCell}
              onCellClick={handleCellClick}
              semesterId={selectedSemesterId}
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
