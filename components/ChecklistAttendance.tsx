'use client';

import { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Plus,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
} from 'lucide-react';

/**
 * Checklist attendance widget.
 *
 * Repurposed from FieldTripAttendance (renamed 2026-04-18). Instead of
 * scoping to field trips, this is a general-purpose cohort checklist:
 * "NREMT Documentation", "End of Semester Skills Review", "Equipment
 * Inspection", "Sheep Pluck Lab" — whatever the instructor types.
 *
 * One checklist per row, per-student attendance/completion tracking
 * via the single-toggle grid. The name is user-defined free text and
 * is shown prominently in both list and detail views.
 */

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Checklist {
  id: string;
  name: string;
  date: string;
  location: string | null;
  description: string | null;
}

interface AttendanceRecord {
  student_id: string;
  attended: boolean;
}

interface ChecklistAttendanceProps {
  cohortId: string;
  students: Student[];
}

export default function ChecklistAttendance({
  cohortId,
  students,
}: ChecklistAttendanceProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(
    null
  );
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [newChecklist, setNewChecklist] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    description: '',
  });

  useEffect(() => {
    fetchChecklists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId]);

  useEffect(() => {
    if (selectedChecklist) {
      fetchAttendance(selectedChecklist.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChecklist]);

  const fetchChecklists = async () => {
    try {
      const res = await fetch(
        `/api/lab-management/checklists?cohortId=${cohortId}`
      );
      const data = await res.json();
      if (data.success) {
        const list: Checklist[] = data.checklists || data.fieldTrips || [];
        setChecklists(list);
        if (list.length > 0 && !selectedChecklist) {
          setSelectedChecklist(list[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async (checklistId: string) => {
    try {
      const res = await fetch(
        `/api/lab-management/checklists/attendance?checklistId=${checklistId}`
      );
      const data = await res.json();
      if (data.success) {
        const map = new Map<string, boolean>();
        (data.attendance || []).forEach((a: AttendanceRecord) => {
          map.set(a.student_id, a.attended);
        });
        setAttendance(map);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const toggleAttendance = async (studentId: string) => {
    if (!selectedChecklist) return;

    const currentValue = attendance.get(studentId) || false;
    const newValue = !currentValue;

    setAttendance((prev) => {
      const next = new Map(prev);
      next.set(studentId, newValue);
      return next;
    });

    try {
      const res = await fetch('/api/lab-management/checklists/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_id: selectedChecklist.id,
          student_id: studentId,
          attended: newValue,
        }),
      });

      if (!res.ok) {
        setAttendance((prev) => {
          const next = new Map(prev);
          next.set(studentId, currentValue);
          return next;
        });
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      setAttendance((prev) => {
        const next = new Map(prev);
        next.set(studentId, currentValue);
        return next;
      });
    }
  };

  const markAllComplete = async () => {
    if (!selectedChecklist) return;
    setSaving(true);

    const newAttendance = students.map((s) => ({
      student_id: s.id,
      attended: true,
    }));

    try {
      const res = await fetch('/api/lab-management/checklists/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_id: selectedChecklist.id,
          attendance: newAttendance,
        }),
      });

      if (res.ok) {
        const map = new Map<string, boolean>();
        newAttendance.forEach((a) => map.set(a.student_id, true));
        setAttendance(map);
      }
    } catch (error) {
      console.error('Error marking all complete:', error);
    } finally {
      setSaving(false);
    }
  };

  const createChecklist = async () => {
    if (!newChecklist.name.trim() || !newChecklist.date) return;
    setSaving(true);

    try {
      const res = await fetch('/api/lab-management/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: cohortId,
          ...newChecklist,
        }),
      });

      const data = await res.json();
      const created: Checklist | null = data.checklist || data.fieldTrip;
      if (data.success && created) {
        setChecklists((prev) => [created, ...prev]);
        setSelectedChecklist(created);
        setShowCreateForm(false);
        setNewChecklist({
          name: '',
          date: new Date().toISOString().split('T')[0],
          location: '',
          description: '',
        });
      }
    } catch (error) {
      console.error('Error creating checklist:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const completedCount = Array.from(attendance.values()).filter(Boolean).length;
  const totalStudents = students.length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div
        className="p-4 border-b dark:border-gray-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ClipboardCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Checklists
          </h3>
          {selectedChecklist && (
            <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {selectedChecklist.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto mr-2 flex-shrink-0 whitespace-nowrap">
                {completedCount}/{totalStudents} complete
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateForm(true);
              setExpanded(true);
            }}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded"
            title="Create new checklist"
          >
            <Plus className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          {/* Create form */}
          {showCreateForm && (
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-purple-800 dark:text-purple-300">
                  New checklist
                </h4>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                >
                  <X className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </button>
              </div>
              <div className="space-y-3">
                {/* Name field — prominent, full-width so it's visibly the primary input */}
                <div>
                  <label className="block text-xs font-medium text-purple-800 dark:text-purple-300 mb-1">
                    Checklist name
                  </label>
                  <input
                    type="text"
                    value={newChecklist.name}
                    onChange={(e) =>
                      setNewChecklist((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g., NREMT Documentation, Sheep Pluck Lab, Equipment Inspection"
                    autoFocus
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-purple-800 dark:text-purple-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={newChecklist.date}
                      onChange={(e) =>
                        setNewChecklist((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-purple-800 dark:text-purple-300 mb-1">
                      Location (optional)
                    </label>
                    <input
                      type="text"
                      value={newChecklist.location}
                      onChange={(e) =>
                        setNewChecklist((prev) => ({
                          ...prev,
                          location: e.target.value,
                        }))
                      }
                      placeholder="Lab room, clinic, etc."
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-purple-800 dark:text-purple-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newChecklist.description}
                    onChange={(e) =>
                      setNewChecklist((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="What does this checklist track?"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={createChecklist}
                    disabled={saving || !newChecklist.name.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {saving ? 'Creating...' : 'Create checklist'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Picker + action */}
          {checklists.length > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <select
                  value={selectedChecklist?.id || ''}
                  onChange={(e) => {
                    const c = checklists.find((x) => x.id === e.target.value);
                    setSelectedChecklist(c || null);
                  }}
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
                >
                  {checklists.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {formatDate(c.date)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={markAllComplete}
                  disabled={saving}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1 whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  Mark all complete
                </button>
              </div>

              {/* Prominent name + description banner for the selected checklist
                  so the user never has to guess which list they're marking. */}
              {selectedChecklist && (
                <div className="mb-4 px-3 py-2 bg-gray-50 dark:bg-gray-700/40 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-base font-semibold text-gray-900 dark:text-white">
                    {selectedChecklist.name}
                  </div>
                  {selectedChecklist.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {selectedChecklist.description}
                    </div>
                  )}
                </div>
              )}

              {/* Attendance grid */}
              {selectedChecklist && (
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 divide-x divide-y dark:divide-gray-700">
                    {students.map((student) => {
                      const isDone = attendance.get(student.id) || false;
                      return (
                        <button
                          key={student.id}
                          onClick={() => toggleAttendance(student.id)}
                          className={`p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                            isDone
                              ? 'bg-green-50 dark:bg-green-900/20'
                              : 'bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isDone
                                  ? 'bg-green-600 border-green-600 text-white'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {isDone && <Check className="w-3 h-3" />}
                            </div>
                            <span
                              className={`text-sm font-medium truncate ${
                                isDone
                                  ? 'text-green-800 dark:text-green-300'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {student.last_name}, {student.first_name[0]}.
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary */}
              {selectedChecklist && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(selectedChecklist.date)}
                    </span>
                    {selectedChecklist.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {selectedChecklist.location}
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      completedCount === totalStudents
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {completedCount}/{totalStudents} students complete
                    {completedCount === totalStudents && ' ✓'}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <ClipboardCheck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400 mb-3">
                No checklists yet
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Create first checklist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
