'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  X,
  Clock,
  Circle,
  Minus,
  Eye,
  RotateCcw,
  Edit2,
  Loader2,
  ChevronDown,
  RefreshCw,
  Users,
  BarChart3,
} from 'lucide-react';

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
  scenario?: { id: string; title: string } | null;
}

interface CellData {
  queueId: string | null;
  status: string; // 'queued' | 'in_progress' | 'completed'
  result: string | null; // 'pass' | 'fail' | 'incomplete'
  evaluationId: string | null;
}

interface IndividualTestingGridProps {
  labDayId: string;
}

export default function IndividualTestingGrid({ labDayId }: IndividualTestingGridProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [stations, setStations] = useState<GridStation[]>([]);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [popoverCell, setPopoverCell] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  const fetchGrid = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/lab-management/student-queue?lab_day_id=${labDayId}`);
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

  // Initial fetch + polling every 12 seconds
  useEffect(() => {
    fetchGrid();
    pollRef.current = setInterval(() => fetchGrid(true), 12000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchGrid]);

  const handleCellClick = async (studentId: string, stationId: string) => {
    const key = `${studentId}_${stationId}`;
    const cell = cells[key];

    // If empty cell, start in_progress
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

    // If completed, show popover
    if (cell.status === 'completed') {
      setPopoverCell(popoverCell === key ? null : key);
      return;
    }

    // If in_progress, also show popover (to allow marking complete/cancelling)
    if (cell.status === 'in_progress') {
      setPopoverCell(popoverCell === key ? null : key);
      return;
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

  const getStationTitle = (station: GridStation) => {
    if (station.custom_title) return station.custom_title;
    if (station.scenario) return station.scenario.title;
    if (station.skill_name) return station.skill_name;
    return `Station ${station.station_number}`;
  };

  // Summary calculations
  const stationSummary = stations.map(station => {
    let completed = 0;
    let passed = 0;
    let failed = 0;
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

  const renderCellContent = (studentId: string, stationId: string) => {
    const key = `${studentId}_${stationId}`;
    const cell = cells[key];
    const isLoading = actionLoading === key;

    if (isLoading) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      );
    }

    if (!cell || !cell.status) {
      return (
        <div className="flex items-center justify-center w-full h-full text-gray-300 hover:text-gray-500 cursor-pointer transition-colors" title="Click to start">
          <Circle className="w-5 h-5" />
        </div>
      );
    }

    if (cell.status === 'in_progress') {
      return (
        <div className="flex items-center justify-center w-full h-full text-amber-500 cursor-pointer" title="In Progress">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
      );
    }

    if (cell.status === 'completed') {
      if (cell.result === 'pass') {
        return (
          <div className="flex items-center justify-center w-full h-full text-green-600 cursor-pointer" title="Pass">
            <Check className="w-5 h-5 stroke-[3]" />
          </div>
        );
      }
      if (cell.result === 'fail') {
        return (
          <div className="flex items-center justify-center w-full h-full text-red-500 cursor-pointer" title="Fail">
            <X className="w-5 h-5 stroke-[3]" />
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center w-full h-full text-gray-400 cursor-pointer" title="Incomplete">
          <Minus className="w-5 h-5" />
        </div>
      );
    }

    return null;
  };

  const renderPopover = (studentId: string, stationId: string) => {
    const key = `${studentId}_${stationId}`;
    if (popoverCell !== key) return null;

    const cell = cells[key];
    if (!cell) return null;

    return (
      <div
        ref={popoverRef}
        className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-[160px]"
      >
        {cell.status === 'in_progress' && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handleOverrideResult(key, 'pass'); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
            >
              <Check className="w-4 h-4" /> Mark Pass
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleOverrideResult(key, 'fail'); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
            >
              <X className="w-4 h-4" /> Mark Fail
            </button>
          </>
        )}
        {cell.status === 'completed' && (
          <>
            {cell.evaluationId && (
              <a
                href={`/skill-sheets/evaluations/${cell.evaluationId}`}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                onClick={(e) => e.stopPropagation()}
              >
                <Eye className="w-4 h-4" /> View Score Sheet
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleNewAttempt(studentId, stationId); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
            >
              <RotateCcw className="w-4 h-4" /> New Attempt
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
            <button
              onClick={(e) => { e.stopPropagation(); handleOverrideResult(key, cell.result === 'pass' ? 'fail' : 'pass'); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
            >
              <Edit2 className="w-4 h-4" /> Override to {cell.result === 'pass' ? 'Fail' : 'Pass'}
            </button>
          </>
        )}
      </div>
    );
  };

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

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Individual Testing
          </h3>
          <button
            onClick={() => fetchGrid(true)}
            className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Overall summary */}
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-sm">
          <span className="font-medium text-blue-800 dark:text-blue-200">
            Students done with all stations: {studentsFullyDone}/{students.length}
          </span>
        </div>

        {students.map(student => {
          const summary = studentSummary.find(s => s.studentId === student.id);
          const pct = summary && summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

          return (
            <div key={student.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {student.last_name}, {student.first_name}
                </h4>
                <span className="text-xs text-gray-500">{summary?.completed}/{summary?.total} stations</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {stations.map(station => {
                  const key = `${student.id}_${station.id}`;
                  const cell = cells[key];

                  return (
                    <div
                      key={station.id}
                      className="relative flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
                      onClick={() => handleCellClick(student.id, station.id)}
                    >
                      <div className="w-6 h-6 flex-shrink-0">
                        {renderCellContent(student.id, station.id)}
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        S{station.station_number}
                      </span>
                      {renderPopover(student.id, station.id)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Individual Testing Grid
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            All stations done: <strong>{studentsFullyDone}/{students.length}</strong>
          </span>
          <button
            onClick={() => fetchGrid(true)}
            className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750">
              <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-750 z-10 min-w-[160px]">
                Student
              </th>
              {stations.map(station => (
                <th
                  key={station.id}
                  className="text-center px-2 py-2 font-medium text-gray-600 dark:text-gray-400 min-w-[80px]"
                  title={getStationTitle(station)}
                >
                  <div className="text-xs leading-tight">
                    <span className="font-semibold">S{station.station_number}</span>
                    <br />
                    <span className="font-normal text-gray-400 dark:text-gray-500 truncate block max-w-[80px]">
                      {getStationTitle(station).substring(0, 12)}
                    </span>
                  </div>
                </th>
              ))}
              <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-gray-400 min-w-[100px]">
                Progress
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, idx) => {
              const summary = studentSummary.find(s => s.studentId === student.id);
              const pct = summary && summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

              return (
                <tr
                  key={student.id}
                  className={`${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-750/50'} hover:bg-blue-50/50 dark:hover:bg-blue-900/10`}
                >
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-inherit z-10">
                    {student.last_name}, {student.first_name}
                  </td>
                  {stations.map(station => (
                    <td
                      key={station.id}
                      className="px-2 py-2 text-center relative"
                      onClick={() => handleCellClick(student.id, station.id)}
                    >
                      <div className="w-8 h-8 mx-auto rounded-lg border border-gray-100 dark:border-gray-700 flex items-center justify-center hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                        {renderCellContent(student.id, station.id)}
                      </div>
                      {renderPopover(student.id, station.id)}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 min-w-[40px] text-right">
                        {summary?.completed}/{summary?.total}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Summary row */}
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-750 border-t-2 border-gray-200 dark:border-gray-600">
              <td className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-750 z-10">
                Summary
              </td>
              {stationSummary.map(s => (
                <td key={s.stationId} className="px-2 py-2 text-center">
                  <div className="text-xs leading-tight">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {s.completed}/{s.total}
                    </span>
                    <br />
                    <span className="text-green-600">{s.passed}P</span>
                    {s.failed > 0 && <span className="text-red-500 ml-1">{s.failed}F</span>}
                  </div>
                </td>
              ))}
              <td className="px-3 py-2 text-center">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {studentsFullyDone}/{students.length} done
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Circle className="w-3.5 h-3.5 text-gray-300" /> Not started</span>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> In progress</span>
        <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600 stroke-[3]" /> Pass</span>
        <span className="flex items-center gap-1"><X className="w-3.5 h-3.5 text-red-500 stroke-[3]" /> Fail</span>
        <span className="flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-gray-400" /> Incomplete</span>
      </div>
    </div>
  );
}
