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
  Trash2,
} from 'lucide-react';
import { findMinimumPoints } from '@/lib/nremt-instructions';

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

interface SkillColumn {
  skillName: string;
  stationIds: string[];
  skillSheetId: string | null;
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
  teamRole: string | null;
}

interface IndividualTestingGridProps {
  labDayId: string;
  isNremtTesting?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IndividualTestingGrid({ labDayId, isNremtTesting = false }: IndividualTestingGridProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [stations, setStations] = useState<GridStation[]>([]);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [skillColumns, setSkillColumns] = useState<SkillColumn[]>([]);
  const [skillCells, setSkillCells] = useState<Record<string, CellData>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [popoverCell, setPopoverCell] = useState<string | null>(null);
  const [confirmResetKey, setConfirmResetKey] = useState<string | null>(null);
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
        setSkillColumns(data.skillColumns || []);
        setSkillCells(data.skillCells || {});
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

  // ─── Helpers: find a station for a skill ────────────────────────────────

  /** Pick the first station that runs a given skill (for queue actions) */
  const findStationForSkill = (skillName: string): GridStation | null => {
    const col = skillColumns.find(c => c.skillName === skillName);
    if (!col) return null;
    return stations.find(s => col.stationIds.includes(s.id)) || null;
  };

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleSkillCellClick = (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    // Toggle popover for any cell — never auto-create records
    setPopoverCell(popoverCell === key ? null : key);
  };

  const handleOverrideResult = async (key: string, result: 'pass' | 'fail') => {
    const cell = skillCells[key];
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
        setSkillCells(prev => ({
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

  const handleNewAttempt = async (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    const station = findStationForSkill(skillName);
    if (!station) return;
    setActionLoading(key);
    try {
      const res = await fetch('/api/lab-management/student-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          student_id: studentId,
          station_id: station.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSkillCells(prev => ({
          ...prev,
          [key]: {
            queueId: data.entry?.id || null,
            status: 'in_progress',
            result: null,
            evaluationId: null,
            evalSummary: null,
            teamRole: null,
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

  const handleResetToNotStarted = async (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    const cell = skillCells[key];
    if (!cell) return;

    setActionLoading(key);
    try {
      // Delete the evaluation record if one exists
      if (cell.evaluationId) {
        const col = skillColumns.find(c => c.skillName === skillName);
        const skillSheetId = col?.skillSheetId;
        if (skillSheetId) {
          await fetch(`/api/skill-sheets/${skillSheetId}/evaluations?evaluation_id=${cell.evaluationId}`, {
            method: 'DELETE',
          });
        }
      }

      // Delete the queue entry if one exists
      if (cell.queueId) {
        await fetch('/api/lab-management/student-queue', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cell.queueId }),
        });
      }

      // Reset cell to empty (not started)
      setSkillCells(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    } catch (err) {
      console.error('Error resetting evaluation:', err);
    } finally {
      setActionLoading(null);
      setPopoverCell(null);
      setConfirmResetKey(null);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Abbreviate a skill name for column headers */
  const abbreviateSkill = (name: string): string => {
    // Common abbreviations for NREMT skills
    const abbrevMap: Record<string, string> = {
      'Cardiac Arrest Management / AED': 'Cardiac Arrest',
      'Patient Assessment - Medical': 'Medical Assess.',
      'Patient Assessment - Trauma': 'Trauma Assess.',
      'Spinal Immobilization (Supine Patient)': 'Spinal (Supine)',
      'Spinal Immobilization (Seated Patient)': 'Spinal (Seated)',
      'BVM Ventilation of an Apneic Adult Patient': 'BVM',
      'Oxygen Administration by Non-Rebreather Mask': 'O2/NRB',
      'Bleeding Control/Shock Management': 'Bleeding Ctrl',
      'Joint Immobilization': 'Joint Immob.',
      'Long Bone Immobilization': 'Long Bone Immob.',
    };
    return abbrevMap[name] || name;
  };

  // ─── Summary calculations (skill-based) ────────────────────────────────

  const totalCompleted = Object.values(skillCells).filter(c => c.status === 'completed').length;
  const totalCells = students.length * skillColumns.length;

  const skillSummary = skillColumns.map(col => {
    let completed = 0, passed = 0, failed = 0;
    for (const student of students) {
      const cell = skillCells[`${student.id}_${col.skillName}`];
      if (cell?.status === 'completed') {
        completed++;
        if (cell.result === 'pass') passed++;
        else if (cell.result === 'fail') failed++;
      }
    }
    return { skillName: col.skillName, completed, passed, failed, total: students.length };
  });

  const studentSummary = students.map(student => {
    let completed = 0;
    for (const col of skillColumns) {
      const cell = skillCells[`${student.id}_${col.skillName}`];
      if (cell?.status === 'completed') completed++;
    }
    return { studentId: student.id, completed, total: skillColumns.length };
  });

  const studentsFullyDone = studentSummary.filter(s => s.completed === s.total && s.total > 0).length;

  // ─── Cell rendering (skill-based) ───────────────────────────────────────

  const renderBadge = (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    const cell = skillCells[key];
    const isLoading = actionLoading === key;

    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin" />
        </span>
      );
    }

    if (!cell || !cell.status) {
      return (
        <button
          onClick={() => handleSkillCellClick(studentId, skillName)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-300 border border-transparent dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          title="Click to send to station"
        >
          <Circle className="w-4 h-4" />
          <span className="hidden sm:inline">Not Started</span>
        </button>
      );
    }

    if (cell.status === 'in_progress') {
      return (
        <button
          onClick={() => handleSkillCellClick(studentId, skillName)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-700 cursor-pointer"
          title="In Progress"
        >
          <Clock className="w-4 h-4 animate-pulse" />
          <span className="hidden sm:inline">In Progress</span>
        </button>
      );
    }

    if (cell.status === 'completed') {
      const teamIcon = cell.teamRole ? (
        <span title={`Team: ${cell.teamRole}`}>
          <Users className="w-3 h-3 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
        </span>
      ) : null;

      if (cell.result === 'pass') {
        return (
          <button
            onClick={() => handleSkillCellClick(studentId, skillName)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-700 cursor-pointer"
            title={cell.teamRole ? `Pass (Team ${cell.teamRole})` : 'Pass'}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            {teamIcon}
            <span className="hidden sm:inline">Pass</span>
          </button>
        );
      }
      if (cell.result === 'fail') {
        return (
          <button
            onClick={() => handleSkillCellClick(studentId, skillName)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-200 border border-red-200 dark:border-red-700 cursor-pointer"
            title={cell.teamRole ? `Fail (Team ${cell.teamRole})` : 'Fail'}
          >
            <X className="w-4 h-4 stroke-[3]" />
            {teamIcon}
            <span className="hidden sm:inline">Fail</span>
          </button>
        );
      }
      // Completed but no pass/fail
      return (
        <button
          onClick={() => handleSkillCellClick(studentId, skillName)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-200 cursor-pointer"
          title="Completed"
        >
          <Check className="w-4 h-4" />
          {teamIcon}
          <span className="hidden sm:inline">Done</span>
        </button>
      );
    }

    return null;
  };

  // ─── Popover ────────────────────────────────────────────────────────────

  const renderPopover = (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    if (popoverCell !== key) return null;

    const cell = skillCells[key];
    const minPoints = findMinimumPoints(skillName);

    // Not started — no cell or no status
    if (!cell || !cell.status) {
      return (
        <div
          ref={popoverRef}
          className="absolute z-50 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[220px]"
          style={{ top: '100%', left: '50%', transform: 'translateX(-50%)' }}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">No evaluation recorded yet</p>
        </div>
      );
    }

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
            {cell.evalSummary ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                {cell.evalSummary.stepsTotal > 0 && (
                  <div>
                    Score: {cell.evalSummary.stepsCompleted} pts
                    {minPoints !== null && <> &mdash; Minimum required: {minPoints} pts</>}
                  </div>
                )}
                {cell.evalSummary.criticalTotal > 0 && (
                  <div>Critical: {cell.evalSummary.criticalCompleted}/{cell.evalSummary.criticalTotal}</div>
                )}
                {cell.evalSummary.evaluatorName && (
                  <div>Evaluator: {cell.evalSummary.evaluatorName}</div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">No evaluation recorded yet</p>
            )}

            {/* Actions */}
            <div className="space-y-1 pt-1">
              {cell.evaluationId && (
                <a
                  href={`/student/skill-evaluations/${cell.evaluationId}`}
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
                onClick={(e) => { e.stopPropagation(); handleNewAttempt(studentId, skillName); }}
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
            </div>
          </div>
        )}

        {/* In-progress popover: mark pass/fail + reset */}
        {cell.status === 'in_progress' && (
          <div className="space-y-1">
            {cell.evalSummary ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 mb-2">
                {cell.evalSummary.stepsTotal > 0 && (
                  <div>
                    Score: {cell.evalSummary.stepsCompleted} pts
                    {minPoints !== null && <> &mdash; Minimum required: {minPoints} pts</>}
                  </div>
                )}
                {cell.evalSummary.evaluatorName && (
                  <div>Evaluator: {cell.evalSummary.evaluatorName}</div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">No evaluation recorded yet</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Manual override:</p>
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
            {/* Reset to Not Started — only for in-progress with no submitted result */}
            {!cell.result && (
              <>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                {confirmResetKey === key ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      Remove this in-progress evaluation? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResetToNotStarted(studentId, skillName); }}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmResetKey(null); }}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmResetKey(key); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" /> Reset to Not Started
                  </button>
                )}
              </>
            )}
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden xl:w-full">
      {/* NREMT banner */}
      {isNremtTesting && (
        <div className="bg-red-600 text-white text-center py-1.5 text-sm font-bold">
          NREMT Psychomotor Testing &mdash; Final Evaluations Only
        </div>
      )}
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
            onClick={() => fetchGrid(true)}
            className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto max-w-full">
        <table className="w-full" style={{ minWidth: `${180 + skillColumns.length * 140 + 80}px` }}>
          {/* Column headers: skill names */}
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-800/70 z-10 min-w-[140px] max-w-[180px]" style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>
                Student
              </th>
              {skillColumns.map(col => {
                const abbreviated = abbreviateSkill(col.skillName);
                const isLong = abbreviated.length > 15;
                return (
                  <th
                    key={col.skillName}
                    className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400 min-w-[140px]"
                  >
                    <div className="space-y-0.5">
                      <div
                        className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px] mx-auto"
                        title={col.skillName}
                      >
                        {isLong ? `${abbreviated.slice(0, 15)}…` : abbreviated}
                      </div>
                      {!isNremtTesting && col.stationIds.length > 1 && (
                        <div className="text-[11px] font-normal text-blue-500 dark:text-blue-400">
                          {col.stationIds.length} stations
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400 min-w-[80px]">
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

              return (
                <tr
                  key={student.id}
                  className={`border-b border-gray-100 dark:border-gray-700/50 ${
                    idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/40'
                  } hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors`}
                >
                  {/* Student name */}
                  <td
                    className={`px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 text-sm sticky left-0 z-10 whitespace-nowrap min-w-[140px] max-w-[180px] overflow-hidden text-ellipsis ${
                      idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800'
                    }`}
                    style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}
                    title={`${student.last_name}, ${student.first_name}`}
                  >
                    {student.last_name}, {student.first_name.charAt(0)}.
                  </td>

                  {/* Skill cells */}
                  {skillColumns.map(col => (
                    <td key={col.skillName} className="px-3 py-2 text-center relative">
                      {renderBadge(student.id, col.skillName)}
                      {renderPopover(student.id, col.skillName)}
                    </td>
                  ))}

                  {/* Progress indicator */}
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center justify-center text-sm font-mono font-semibold px-2 py-0.5 rounded ${
                      done === total && total > 0
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      [{done}/{total}]
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Summary footer */}
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-800/70 border-t-2 border-gray-200 dark:border-gray-600">
              <td className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300 text-sm sticky left-0 bg-gray-50 dark:bg-gray-800/70 z-10 min-w-[140px] max-w-[180px]" style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>
                Summary
              </td>
              {skillSummary.map(s => (
                <td key={s.skillName} className="px-3 py-2.5 text-center">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {s.completed}/{s.total} done
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="text-green-600 dark:text-green-300">{s.passed} pass</span>
                      {s.failed > 0 && (
                        <span className="text-red-500 dark:text-red-300 ml-1">{s.failed} fail</span>
                      )}
                    </div>
                  </div>
                </td>
              ))}
              <td className="px-3 py-2.5 text-center">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-200">
                  {studentsFullyDone}/{students.length}
                </div>
                <div className="text-[11px] text-gray-400 dark:text-gray-400">
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
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-300 border border-transparent dark:border-gray-600"><Circle className="w-3 h-3" /></span>
          Not started
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-200"><Clock className="w-3 h-3" /></span>
          In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-200"><Check className="w-3 h-3 stroke-[3]" /></span>
          Pass
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-200"><X className="w-3 h-3 stroke-[3]" /></span>
          Fail
        </span>
        <span className="ml-auto text-gray-400 dark:text-gray-400">
          All skills complete: <strong>{studentsFullyDone}/{students.length}</strong> students
        </span>
      </div>
    </div>
  );
}
