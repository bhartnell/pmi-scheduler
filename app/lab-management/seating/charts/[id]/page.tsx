'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Layout,
  Home,
  Save,
  Trash2,
  AlertTriangle,
  Users,
  Printer,
  RotateCcw
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  agency: string | null;
  photo_url: string | null;
}

interface Assignment {
  id?: string;
  student_id: string;
  table_number: number;
  seat_position: number;
  row_number: number;
  is_overflow: boolean;
  student?: Student;
}

interface LearningStyle {
  student_id: string;
  primary_style: string;
  social_style: string;
}

interface Preference {
  student_id: string;
  other_student_id: string;
  preference_type: 'avoid' | 'prefer_near';
}

interface Chart {
  id: string;
  name: string;
  is_active: boolean;
  cohort: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string };
  };
  classroom: {
    id: string;
    name: string;
    rows: number;
    tables_per_row: number;
    seats_per_table: number;
    layout_config: any;
  };
}

const STYLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  audio: { bg: 'bg-blue-500', text: 'text-white', label: 'A' },
  visual: { bg: 'bg-green-500', text: 'text-white', label: 'V' },
  kinesthetic: { bg: 'bg-orange-500', text: 'text-white', label: 'K' },
  social: { bg: 'bg-purple-500', text: 'text-white', label: 'S' },
  independent: { bg: 'bg-gray-500', text: 'text-white', label: 'I' },
};

export default function SeatingChartBuilderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const chartId = params.id as string;

  const [chart, setChart] = useState<Chart | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [learningStyles, setLearningStyles] = useState<LearningStyle[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [dragSource, setDragSource] = useState<{ table: number; seat: number } | 'unassigned' | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && chartId) {
      fetchChart();
    }
  }, [session, chartId]);

  const fetchChart = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seating/charts/${chartId}`);
      const data = await res.json();
      if (data.success) {
        setChart(data.chart);
        setAssignments(data.assignments || []);
        setUnassignedStudents(data.unassignedStudents || []);
        setLearningStyles(data.learningStyles || []);
        setPreferences(data.preferences || []);
      }
    } catch (error) {
      console.error('Error fetching chart:', error);
    }
    setLoading(false);
  };

  const getLearningStyle = useCallback((studentId: string) => {
    return learningStyles.find(ls => ls.student_id === studentId);
  }, [learningStyles]);

  const getConflicts = useCallback((studentId: string, tableNumber: number) => {
    const conflicts: string[] = [];
    const studentPrefs = preferences.filter(
      p => p.student_id === studentId || p.other_student_id === studentId
    );

    // Get other students at same table
    const tableAssignments = assignments.filter(a => a.table_number === tableNumber && a.student_id !== studentId);

    for (const pref of studentPrefs) {
      if (pref.preference_type === 'avoid') {
        const otherStudentId = pref.student_id === studentId ? pref.other_student_id : pref.student_id;
        if (tableAssignments.some(a => a.student_id === otherStudentId)) {
          conflicts.push('Should avoid tablemate');
        }
      }
    }

    return conflicts;
  }, [preferences, assignments]);

  const getStudentAtSeat = useCallback((tableNumber: number, seatPosition: number, isOverflow: boolean = false) => {
    const assignment = assignments.find(
      a => a.table_number === tableNumber && a.seat_position === seatPosition && a.is_overflow === isOverflow
    );
    return assignment?.student || null;
  }, [assignments]);

  const handleDragStart = (student: Student, source: { table: number; seat: number } | 'unassigned') => {
    setDraggedStudent(student);
    setDragSource(source);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (tableNumber: number, seatPosition: number, rowNumber: number, isOverflow: boolean = false) => {
    if (!draggedStudent) return;

    // Remove student from previous position
    let newAssignments = assignments.filter(a => a.student_id !== draggedStudent.id);

    // Remove any student currently in target seat
    const existingStudent = getStudentAtSeat(tableNumber, seatPosition, isOverflow);
    if (existingStudent) {
      newAssignments = newAssignments.filter(
        a => !(a.table_number === tableNumber && a.seat_position === seatPosition && a.is_overflow === isOverflow)
      );
      // Add displaced student to unassigned
      if (!unassignedStudents.find(s => s.id === existingStudent.id)) {
        setUnassignedStudents([...unassignedStudents, existingStudent]);
      }
    }

    // Add new assignment
    newAssignments.push({
      student_id: draggedStudent.id,
      table_number: tableNumber,
      seat_position: seatPosition,
      row_number: rowNumber,
      is_overflow: isOverflow,
      student: draggedStudent,
    });

    setAssignments(newAssignments);

    // Remove from unassigned if it was there
    setUnassignedStudents(unassignedStudents.filter(s => s.id !== draggedStudent.id));

    setHasChanges(true);
    setDraggedStudent(null);
    setDragSource(null);
  };

  const handleDropToUnassigned = () => {
    if (!draggedStudent || dragSource === 'unassigned') return;

    // Remove from assignments
    setAssignments(assignments.filter(a => a.student_id !== draggedStudent.id));

    // Add to unassigned
    if (!unassignedStudents.find(s => s.id === draggedStudent.id)) {
      setUnassignedStudents([...unassignedStudents, draggedStudent]);
    }

    setHasChanges(true);
    setDraggedStudent(null);
    setDragSource(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/seating/charts/${chartId}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: assignments.map(a => ({
            student_id: a.student_id,
            table_number: a.table_number,
            seat_position: a.seat_position,
            row_number: a.row_number,
            is_overflow: a.is_overflow,
            is_manual_override: true,
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setHasChanges(false);
        alert('Seating chart saved!');
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    }
    setSaving(false);
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all seat assignments?')) return;

    // Move all assigned students to unassigned
    const assignedStudents = assignments.map(a => a.student).filter(Boolean) as Student[];
    setUnassignedStudents([...unassignedStudents, ...assignedStudents]);
    setAssignments([]);
    setHasChanges(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !chart) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Chart Not Found</h2>
          <Link href="/lab-management/seating/charts" className="text-blue-600 hover:underline">
            Back to Charts
          </Link>
        </div>
      </div>
    );
  }

  // Build table layout: 4 rows, 2 tables per row
  const rows = [
    { row: 1, tables: [1, 2], zone: 'Front (Audio)' },
    { row: 2, tables: [3, 4], zone: 'Middle (Visual)' },
    { row: 3, tables: [5, 6], zone: 'Middle (Visual)' },
    { row: 4, tables: [7, 8], zone: 'Back (Kinesthetic)' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 print:bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm print:shadow-none">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2 print:hidden">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/seating/charts" className="hover:text-blue-600">Seating Charts</Link>
            <ChevronRight className="w-4 h-4" />
            <span>{chart.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg print:hidden">
                <Layout className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{chart.name}</h1>
                <p className="text-sm text-gray-600">
                  {chart.cohort.program.abbreviation} Group {chart.cohort.cohort_number} • {chart.classroom.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 print:p-0">
        <div className="flex gap-6 print:block">
          {/* Classroom Layout */}
          <div className="flex-1">
            {/* Front of Room Label */}
            <div className="text-center mb-4 py-2 bg-gray-800 text-white rounded-lg font-medium print:bg-gray-200 print:text-gray-800">
              FRONT OF ROOM (Instructor)
            </div>

            {/* Tables Grid */}
            <div className="space-y-4">
              {rows.map(({ row, tables, zone }) => (
                <div key={row}>
                  <div className="text-xs text-gray-500 mb-1 print:text-gray-600">Row {row} - {zone}</div>
                  <div className="flex gap-8 justify-center">
                    {tables.map((tableNum) => (
                      <div key={tableNum} className="bg-white rounded-lg shadow p-3 print:shadow-none print:border">
                        <div className="text-xs text-gray-400 text-center mb-2">Table {tableNum}</div>
                        <div className="flex gap-2">
                          {[1, 2, 3].map((seat) => {
                            const student = getStudentAtSeat(tableNum, seat);
                            const ls = student ? getLearningStyle(student.id) : null;
                            const conflicts = student ? getConflicts(student.id, tableNum) : [];

                            return (
                              <div
                                key={seat}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(tableNum, seat, row)}
                                className={`w-24 h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-1 transition-colors ${
                                  student
                                    ? 'border-solid border-gray-300 bg-gray-50'
                                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                } ${conflicts.length > 0 ? 'border-red-400 bg-red-50' : ''}`}
                              >
                                {student ? (
                                  <div
                                    draggable
                                    onDragStart={() => handleDragStart(student, { table: tableNum, seat })}
                                    className="w-full h-full flex flex-col items-center justify-center cursor-move"
                                  >
                                    {/* Photo or Initials */}
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mb-1 flex-shrink-0">
                                      {student.photo_url ? (
                                        <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-medium">
                                          {student.first_name[0]}{student.last_name[0]}
                                        </div>
                                      )}
                                    </div>

                                    {/* Name */}
                                    <div className="text-xs font-medium text-gray-900 text-center truncate w-full">
                                      {student.first_name}
                                    </div>
                                    <div className="text-xs text-gray-500 text-center truncate w-full">
                                      {student.last_name}
                                    </div>

                                    {/* Badges */}
                                    <div className="flex gap-0.5 mt-1">
                                      {ls?.primary_style && (
                                        <span className={`w-4 h-4 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.primary_style]?.bg} ${STYLE_BADGES[ls.primary_style]?.text}`}>
                                          {STYLE_BADGES[ls.primary_style]?.label}
                                        </span>
                                      )}
                                      {ls?.social_style && (
                                        <span className={`w-4 h-4 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.social_style]?.bg} ${STYLE_BADGES[ls.social_style]?.text}`}>
                                          {STYLE_BADGES[ls.social_style]?.label}
                                        </span>
                                      )}
                                      {conflicts.length > 0 && (
                                        <span className="w-4 h-4 rounded bg-red-500 text-white text-xs flex items-center justify-center" title={conflicts.join(', ')}>
                                          !
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Empty</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Overflow Seats */}
            <div className="mt-6">
              <div className="text-xs text-gray-500 mb-2">Overflow Seating (Back Wall)</div>
              <div className="bg-white rounded-lg shadow p-3 print:shadow-none print:border">
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3].map((seat) => {
                    const student = getStudentAtSeat(0, seat, true);
                    const ls = student ? getLearningStyle(student.id) : null;

                    return (
                      <div
                        key={seat}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(0, seat, 5, true)}
                        className={`w-24 h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-1 transition-colors ${
                          student
                            ? 'border-solid border-gray-300 bg-gray-50'
                            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        {student ? (
                          <div
                            draggable
                            onDragStart={() => handleDragStart(student, { table: 0, seat })}
                            className="w-full h-full flex flex-col items-center justify-center cursor-move"
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mb-1">
                              {student.photo_url ? (
                                <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-medium">
                                  {student.first_name[0]}{student.last_name[0]}
                                </div>
                              )}
                            </div>
                            <div className="text-xs font-medium text-gray-900 text-center truncate w-full">
                              {student.first_name}
                            </div>
                            <div className="text-xs text-gray-500 text-center truncate w-full">
                              {student.last_name}
                            </div>
                            <div className="flex gap-0.5 mt-1">
                              {ls?.primary_style && (
                                <span className={`w-4 h-4 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.primary_style]?.bg} ${STYLE_BADGES[ls.primary_style]?.text}`}>
                                  {STYLE_BADGES[ls.primary_style]?.label}
                                </span>
                              )}
                              {ls?.social_style && (
                                <span className={`w-4 h-4 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.social_style]?.bg} ${STYLE_BADGES[ls.social_style]?.text}`}>
                                  {STYLE_BADGES[ls.social_style]?.label}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Overflow {seat}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Unassigned Students Sidebar */}
          <div className="w-64 flex-shrink-0 print:hidden">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDropToUnassigned}
              className="bg-white rounded-lg shadow p-4 sticky top-4"
            >
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                Unassigned ({unassignedStudents.length})
              </h3>

              {unassignedStudents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  All students are seated
                </p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {unassignedStudents.map((student) => {
                    const ls = getLearningStyle(student.id);
                    return (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={() => handleDragStart(student, 'unassigned')}
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-move"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {student.first_name} {student.last_name}
                          </div>
                          {student.agency && (
                            <div className="text-xs text-gray-500 truncate">{student.agency}</div>
                          )}
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          {ls?.primary_style && (
                            <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.primary_style]?.bg} ${STYLE_BADGES[ls.primary_style]?.text}`}>
                              {STYLE_BADGES[ls.primary_style]?.label}
                            </span>
                          )}
                          {ls?.social_style && (
                            <span className={`w-5 h-5 rounded text-xs flex items-center justify-center ${STYLE_BADGES[ls.social_style]?.bg} ${STYLE_BADGES[ls.social_style]?.text}`}>
                              {STYLE_BADGES[ls.social_style]?.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Legend</h4>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-blue-500"></span>
                    <span>Audio</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-green-500"></span>
                    <span>Visual</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-orange-500"></span>
                    <span>Kinesthetic</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-purple-500"></span>
                    <span>Social</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-gray-500"></span>
                    <span>Independent</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-red-500"></span>
                    <span>Conflict</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
