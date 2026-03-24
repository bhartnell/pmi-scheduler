'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  X,
  Clock,
  Circle,
  Eye,
  RotateCcw,
  Edit2,
  Loader2,
  RefreshCw,
  Users,
  BarChart3,
  Printer,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface GridStation {
  id: string;
  station_number: number;
  station_type: string;
  custom_title: string | null;
  skill_name: string | null;
  skillSheetId: string | null;
  instructorName: string | null;
  scenario?: { id: string; title: string } | null;
}

interface EvalSummary {
  stepsCompleted: number;
  stepsTotal: number;
  criticalCompleted: number;
  criticalTotal: number;
  evaluatorName: string | null;
}

interface CellData {
  queueId: string | null;
  status: string; // 'queued' | 'in_progress' | 'completed'
  result: string | null; // 'pass' | 'fail' | 'incomplete'
  evaluationId: string | null;
  evalSummary: EvalSummary | null;
}

interface IndividualTestingGridProps {
  labDayId: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IndividualTestingGrid({ labDayId }: IndividualTestingGridProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [stations, setStations] = useState<GridStation[]>([]);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [popoverCell, setPopoverCell] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverCell(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Data fetching ──────────────────────────────────────────────────────

  const sessionExpiredRef = useRef(false);

  const fetchGrid = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/lab-management/student-queue?lab_day_id=${labDayId}`);
      if (res.status === 401) {
        sessionExpiredRef.current = true;
        return;
      }
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
        setStations(data.stations || []);
        setCells(data.cells || {});
      }
    } catch (err) {
      console.error('Error fetching grid:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [labDayId]);

  // Initial fetch + polling every 5 seconds (stops on 401 to avoid wasting invocations)
  useEffect(() => {
    fetchGrid();
    const interval = setInterval(() => {
      if (sessionExpiredRef.current) {
        clearInterval(interval);
        return;
      }
      fetchGrid(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchGrid]);

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleCellClick = async (studentId: string, stationId: string) => {
    const key = `${studentId}_${stationId}`;
    const cell = cells[key];

    // Empty cell → send to station (mark in_progress)
    if (!cell || !cell.status) {
      setActionLoading(key);
      try {
        const res = await fetch('/api/lab-management/student-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lab_day_id: labDayId,
            student_id: studentId,
            station_id: stationId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCells(prev => ({
            ...prev,
            [key]: {
              queueId: data.entry?.id || null,
              status: 'in_progress',
              result: null,
              evaluationId: null,
              evalSummary: null,
            },
          }));
        }
      } catch (err) {
        console.error('Error starting queue entry:', err);
      } finally {
        setActionLoading(null);
      }
      return;
    }

    // Completed or in_progress → show popover
    if (cell.status === 'completed' || cell.status === 'in_progress') {
      setPopoverCell(popoverCell === key ? null : key);
    }
  };

  const handleOverrideResult = async (key: string, result: 'pass' | 'fail') => {
    const cell = cells[key];
    if (!cell?.queueId) return;

    setActionLoading(key);
    try {
      const res = await fetch('/api/lab-management/student-queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cell.queueId,
          status: 'completed',
          result,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCells(prev => ({
          ...prev,
          [key]: { ...prev[key], status: 'completed', result },
        }));
      }
    } catch (err) {
      console.error('Error overriding result:', err);
    } finally {
      setActionLoading(null);
      setPopoverCell(null);
    }
  };

  const handleNewAttempt = async (studentId: string, stationId: string) => {
    const key = `${studentId}_${stationId}`;
    setActionLoading(key);
    try {
      const res = await fetch('/api/lab-management/student-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          student_id: studentId,
          station_id: stationId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCells(prev => ({
          ...prev,
          [key]: {
            queueId: data.entry?.id || null,
            status: 'in_progress',
            result: null,
            evaluationId: null,
            evalSummary: null,
          },
        }));
      }
    } catch (err) {
      console.error('Error creating new attempt:', err);
    } finally {
      setActionLoading(null);
      setPopoverCell(null);
    }
  };

  const handleResetCell = async (studentId: string, stationId: string, hasEvaluation: boolean) => {
    // If cell has an evaluation, confirm first
    if (hasEvaluation) {
      const ok = window.confirm('This will remove the queue entry. The evaluation record will be kept. Continue?');
      if (!ok) return;
    }

    const key = `${studentId}_${stationId}`;
    const cell = cells[key];
    setActionLoading(key);
    try {
      const res = await fetch('/api/lab-management/student-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          cell?.queueId
            ? { id: cell.queueId }
            : { lab_day_id: labDayId, student_id: studentId, station_id: stationId }
        ),
      });
      const data = await res.json();
      if (data.success) {
        setCells(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    } catch (err) {
      console.error('Error resetting cell:', err);
    } finally {
      setActionLoading(null);
      setPopoverCell(null);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────

  const getStationTitle = (station: GridStation) => {
    if (station.custom_title) return station.custom_title;
    if (station.scenario) return station.scenario.title;
    if (station.skill_name) return station.skill_name;
    return `Station ${station.station_number}`;
  };

  const formatInstructor = (name: string | null) => {
    if (!name) return null;
    // "Benjamin Hartnell" → "B. Hartnell"
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}. ${parts[parts.length - 1]}`;
    }
    return name;
  };

  // ─── Summary calculations ──────────────────────────────────────────────

  const totalCompleted = Object.values(cells).filter(c => c.status === 'completed').length;
  const totalCells = students.length * stations.length;

  const stationSummary = stations.map(station => {
    let completed = 0, passed = 0, failed = 0;
    for (const student of students) {
      const cell = cells[`${student.id}_${station.id}`];
      if (cell?.status === 'completed') {
        completed++;
        if (cell.result === 'pass') passed++;
        else if (cell.result === 'fail') failed++;
      }
    }
    return { stationId: station.id, completed, passed, failed, total: students.length };
  });

  const studentSummary = students.map(student => {
    let completed = 0;
    for (const station of stations) {
      const cell = cells[`${student.id}_${station.id}`];
      if (cell?.status === 'completed') completed++;
    }
    return { studentId: student.id, completed, total: stations.length };
  });

  const studentsFullyDone = studentSummary.filter(s => s.completed === s.total && s.total > 0).length;

  // ─── Cell rendering ────────────────────────────────────────────────────

  const renderBadge = (studentId: string, stationId: string) => {
    const key = `${studentId}_${stationId}`;
    const cell = cells[key];
    const isLoading = actionLoading === key;

    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
        </span>
      );
    }

    if (!cell || !cell.status) {
      return (
        <button
          onClick={() => handleCellClick(studentId, stationId)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          title="Click to send to station"
        >
          <Circle className="w-4 h-4" />
          <span className="hidden sm:inline">—</span>
        </button>
      );
    }

    if (cell.status === 'in_progress') {
      return (
        <button
          onClick={() => handleCellClick(studentId, stationId)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold bg-amber-500/20 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-400 dark:border-amber-500 cursor-pointer"
          title="In Progress"
        >
          <Clock className="w-4 h-4 animate-pulse" />
          <span className="hidden sm:inline">Testing</span>
        </button>
      );
    }

    if (cell.status === 'completed') {
      if (cell.result === 'pass') {
        return (
          <button
            onClick={() => handleCellClick(studentId, stationId)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold bg-emerald-600 dark:bg-emerald-600 text-white border border-emerald-700 cursor-pointer hover:bg-emerald-700 transition-colors"
            title="Pass"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Pass</span>
          </button>
        );
      }
      if (cell.result === 'fail') {
        return (
          <button
            onClick={() => handleCellClick(studentId, stationId)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold bg-red-600 dark:bg-red-600 text-white border border-red-700 cursor-pointer hover:bg-red-700 transition-colors"
            title="Fail"
          >
            <X className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Fail</span>
          </button>
        );
      }
      // Completed but no pass/fail
      return (
        <button
          onClick={() => handleCellClick(studentId, stationId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer"
          title="Completed"
        >
          <Check className="w-4 h-4" />
          <span className="hidden sm:inline">Done</span>
        </button>
      );
    }

    return null;
  };

  // ─── Popover ────────────────────────────────────────────────────────────

  const renderPopover = (studentId: string, stationId: string) => {
    const key = `${studentId}_${stationId}`;
    if (popoverCell !== key) return null;

    const cell = cells[key];
    if (!cell) return null;

    return (
      <div
        ref={popoverRef}
        className="absolute z-50 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[220px]"
        style={{ top: '100%', left: '50%', transform: 'translateX(-50%)' }}
      >
        {/* Completed popover: show eval summary + actions */}
        {cell.status === 'completed' && (
          <div className="space-y-2">
            {/* Result badge */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
              <span className={`text-sm font-semibold ${cell.result === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                Result: {cell.result === 'pass' ? 'Pass' : 'Fail'}
              </span>
            </div>

            {/* Eval summary */}
            {cell.evalSummary && (
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                {cell.evalSummary.stepsTotal > 0 && (
                  <div>Score: {cell.evalSummary.stepsCompleted}/{cell.evalSummary.stepsTotal} steps</div>
                )}
                {cell.evalSummary.criticalTotal > 0 && (
                  <div>Critical: {cell.evalSummary.criticalCompleted}/{cell.evalSummary.criticalTotal}</div>
                )}
                {cell.evalSummary.evaluatorName && (
                  <div>Evaluator: {cell.evalSummary.evaluatorName}</div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-1 pt-1">
              {cell.evaluationId && (
                <a
                  href={`/api/skill-sheets/evaluations/print?evaluation_id=${cell.evaluationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Eye className="w-4 h-4" /> View Full Score Sheet
                </a>
              )}
              {cell.evaluationId && (
                <a
                  href={`/api/skill-sheets/evaluations/print?evaluation_id=${cell.evaluationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Printer className="w-4 h-4" /> Print Score Sheet
                </a>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleNewAttempt(studentId, stationId); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
              >
                <RotateCcw className="w-4 h-4" /> New Attempt
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              <button
                onClick={(e) => { e.stopPropagation(); handleOverrideResult(key, cell.result === 'pass' ? 'fail' : 'pass'); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
              >
                <Edit2 className="w-4 h-4" /> Override to {cell.result === 'pass' ? 'Fail' : 'Pass'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleResetCell(studentId, stationId, !!cell.evaluationId); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
              >
                <Circle className="w-4 h-4" /> Reset to Not Started
              </button>
            </div>
          </div>
        )}

        {/* In-progress popover: reset, mark pass/fail */}
        {cell.status === 'in_progress' && (
          <div className="space-y-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleResetCell(studentId, stationId, false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            >
              <Circle className="w-4 h-4" /> Reset to Not Started
            </button>
            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Manual override:</p>
            <button
              onClick={(e) => { e.stopPropagation(); handleOverrideResult(key, 'pass'); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
            >
              <Check className="w-4 h-4" /> Mark Pass
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleOverrideResult(key, 'fail'); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
            >
              <X className="w-4 h-4" /> Mark Fail
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Loading / empty states ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-3" />
        <span className="text-gray-500">Loading testing grid...</span>
      </div>
    );
  }

  if (students.length === 0 || stations.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
        <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p>No students or stations available for this lab day.</p>
        <p className="text-sm mt-1">Ensure the cohort has active students and stations are configured.</p>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          Individual Testing Tracker
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            <strong className="text-gray-700 dark:text-gray-300">{totalCompleted}/{totalCells}</strong> complete
          </span>
          <button
            onClick={() => window.open(`/api/skill-sheets/evaluations/batch-print?lab_day_id=${labDayId}`, '_blank')}
            className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
            title="Print all completed evaluations"
          >
            <Printer className="w-3.5 h-3.5" />
            Print All
          </button>
          <button
            onClick={() => fetchGrid(true)}
            className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Column headers: station info */}
          <thead>
            <tr className="border-b-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/80">
              <th className="text-left px-5 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm sticky left-0 bg-gray-50 dark:bg-gray-900/80 z-10 min-w-[220px]">
                Student
              </th>
              {stations.map(station => (
                <th
                  key={station.id}
                  className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400 min-w-[150px]"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-100">
                      Station {station.station_number}
                    </div>
                    <div className="text-xs font-normal text-gray-500 dark:text-gray-400 leading-tight max-w-[150px] mx-auto" title={getStationTitle(station)}>
                      {getStationTitle(station)}
                    </div>
                    {station.instructorName && (
                      <div className="text-[11px] font-medium text-blue-500 dark:text-blue-400">
                        {formatInstructor(station.instructorName)}
                      </div>
                    )}
                  </div>
                </th>
              ))}
              <th className="text-center px-3 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm min-w-[120px]">
                Progress
              </th>
            </tr>
          </thead>

          {/* Student rows */}
          <tbody>
            {students.map((student, idx) => {
              const summary = studentSummary.find(s => s.studentId === student.id);
              const done = summary?.completed || 0;
              const total = summary?.total || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <tr
                  key={student.id}
                  className={`border-b border-gray-100 dark:border-gray-700/50 ${
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800/40' : 'bg-gray-50/80 dark:bg-gray-900/50'
                  } hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors`}
                >
                  {/* Student name — wider, clearer */}
                  <td className={`px-5 py-3 font-semibold text-gray-900 dark:text-gray-100 text-sm sticky left-0 z-10 whitespace-nowrap ${
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800/40' : 'bg-gray-50/80 dark:bg-gray-900/50'
                  }`}>
                    {student.last_name}, {student.first_name}
                  </td>

                  {/* Station cells — distinct cell backgrounds */}
                  {stations.map(station => (
                    <td key={station.id} className="px-2 py-2 text-center relative">
                      <div className="bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors">
                        {renderBadge(student.id, station.id)}
                      </div>
                      {renderPopover(student.id, station.id)}
                    </td>
                  ))}

                  {/* Progress bar */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-16 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            done === total && total > 0 ? 'bg-emerald-500' : done > 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${
                        done === total && total > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {done}/{total}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Summary footer */}
          <tfoot>
            <tr className="bg-gray-100 dark:bg-gray-900/80 border-t-2 border-gray-300 dark:border-gray-600">
              <td className="px-5 py-3 font-bold text-gray-800 dark:text-gray-200 text-sm sticky left-0 bg-gray-100 dark:bg-gray-900/80 z-10">
                Summary
              </td>
              {stationSummary.map(s => (
                <td key={s.stationId} className="px-3 py-3 text-center">
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {s.completed}/{s.total}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{s.passed}P</span>
                      {s.failed > 0 && (
                        <span className="text-red-500 dark:text-red-400 font-semibold ml-1">{s.failed}F</span>
                      )}
                    </div>
                  </div>
                </td>
              ))}
              <td className="px-3 py-3 text-center">
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {studentsFullyDone}/{students.length}
                </div>
                <div className="text-[11px] text-gray-400 dark:text-gray-500">
                  all done
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 dark:bg-gray-800/50 text-gray-400 border border-gray-200 dark:border-gray-700"><Circle className="w-3 h-3" /></span>
          Not started
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-300 dark:border-amber-500"><Clock className="w-3 h-3" /></span>
          In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500"><Check className="w-3 h-3 stroke-[3]" /></span>
          Pass
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 border border-red-300 dark:border-red-500"><X className="w-3 h-3 stroke-[3]" /></span>
          Fail
        </span>
        <span className="ml-auto text-gray-400 dark:text-gray-500">
          All stations complete: <strong>{studentsFullyDone}/{students.length}</strong> students
        </span>
      </div>
    </div>
  );
}
