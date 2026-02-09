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
  RotateCcw,
  Wand2,
  X,
  AlertCircle,
  Download,
  FlipVertical
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
  const [generating, setGenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [dragSource, setDragSource] = useState<{ table: number; seat: number } | 'unassigned' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ student: Student; x: number; y: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  const [generationStats, setGenerationStats] = useState<any>(null);
  const [isFlipped, setIsFlipped] = useState(false); // Flip orientation - false = instructor view (front at top), true = student view (front at bottom)

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

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

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

    // Get the student currently at target seat (if any)
    const existingStudent = getStudentAtSeat(tableNumber, seatPosition, isOverflow);

    // Start with all assignments except the dragged student
    let newAssignments = assignments.filter(a => a.student_id !== draggedStudent.id);
    let newUnassigned = [...unassignedStudents];

    // Handle SWAP or DISPLACEMENT
    if (existingStudent) {
      // Remove existing student from target seat
      newAssignments = newAssignments.filter(
        a => !(a.table_number === tableNumber && a.seat_position === seatPosition && a.is_overflow === isOverflow)
      );

      // If dragged student came from a seat, SWAP them
      if (dragSource && dragSource !== 'unassigned') {
        const sourceTable = dragSource.table;
        const sourceSeat = dragSource.seat;

        // Find source row (for regular tables)
        const sourceRow = sourceTable === 0 ? 5 : sourceTable <= 2 ? 1 : sourceTable <= 4 ? 2 : sourceTable <= 6 ? 3 : 4;
        const sourceIsOverflow = sourceTable === 0;

        // Put displaced student in dragged student's original seat
        newAssignments.push({
          student_id: existingStudent.id,
          table_number: sourceTable,
          seat_position: sourceSeat,
          row_number: sourceRow,
          is_overflow: sourceIsOverflow,
          student: existingStudent,
        });
      } else {
        // Dragged from unassigned - move displaced student to unassigned
        if (!newUnassigned.find(s => s.id === existingStudent.id)) {
          newUnassigned.push(existingStudent);
        }
      }
    }

    // Place dragged student at target seat
    newAssignments.push({
      student_id: draggedStudent.id,
      table_number: tableNumber,
      seat_position: seatPosition,
      row_number: rowNumber,
      is_overflow: isOverflow,
      student: draggedStudent,
    });

    // Remove dragged student from unassigned if it was there
    newUnassigned = newUnassigned.filter(s => s.id !== draggedStudent.id);

    setAssignments(newAssignments);
    setUnassignedStudents(newUnassigned);
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

  const handleContextMenu = (e: React.MouseEvent, student: Student) => {
    e.preventDefault();
    setContextMenu({ student, x: e.clientX, y: e.clientY });
  };

  const handleUnassignFromContextMenu = (student: Student) => {
    // Remove from assignments
    setAssignments(assignments.filter(a => a.student_id !== student.id));

    // Add to unassigned
    if (!unassignedStudents.find(s => s.id === student.id)) {
      setUnassignedStudents([...unassignedStudents, student]);
    }

    setHasChanges(true);
    setContextMenu(null);
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

  const handleDownloadPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('seating-chart-printable');

    if (!element) {
      alert('Could not find printable content');
      return;
    }

    // Temporarily show print-only elements and hide screen-only elements
    const printHiddenElements = element.querySelectorAll('.print\\:hidden');
    const printBlockElements = element.querySelectorAll('.print\\:block');

    printHiddenElements.forEach(el => (el as HTMLElement).style.display = 'none');
    printBlockElements.forEach(el => (el as HTMLElement).style.display = 'block');

    const cohortName = `${chart?.cohort.program.abbreviation}-G${chart?.cohort.cohort_number}`;
    const date = new Date().toISOString().split('T')[0];

    const options = {
      margin: 0.5,
      filename: `seating-chart-${cohortName}-${date}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        logging: false
      },
      jsPDF: { unit: 'in' as const, format: 'letter', orientation: 'landscape' as const }
    };

    try {
      await html2pdf().set(options).from(element).save();
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('PDF generation completed with warnings. Check the downloaded file.');
    } finally {
      // Restore visibility
      printHiddenElements.forEach(el => (el as HTMLElement).style.display = '');
      printBlockElements.forEach(el => (el as HTMLElement).style.display = '');
    }
  };

  const handleGenerate = async () => {
    if (!confirm('This will replace current seat assignments with auto-generated seating. Continue?')) {
      return;
    }

    setGenerating(true);
    setWarnings([]);
    setGenerationStats(null);

    try {
      const res = await fetch(`/api/seating/charts/${chartId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (data.success) {
        // Convert generated assignments to include student data
        const allStudents = [...unassignedStudents, ...assignments.map(a => a.student).filter(Boolean) as Student[]];
        const studentMap = new Map(allStudents.map(s => [s.id, s]));

        const newAssignments: Assignment[] = data.assignments.map((a: any) => ({
          ...a,
          student: studentMap.get(a.student_id),
        }));

        // Find unassigned students
        const assignedIds = new Set(newAssignments.map(a => a.student_id));
        const newUnassigned = allStudents.filter(s => !assignedIds.has(s.id));

        setAssignments(newAssignments);
        setUnassignedStudents(newUnassigned);
        setWarnings(data.warnings || []);
        setGenerationStats(data.stats);
        setHasChanges(true);

        if (data.warnings?.length > 0) {
          setShowWarnings(true);
        }
      } else {
        alert('Failed to generate seating: ' + data.error);
      }
    } catch (error) {
      console.error('Error generating seating:', error);
      alert('Failed to generate seating');
    }

    setGenerating(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !chart) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Chart Not Found</h2>
          <Link href="/lab-management/seating/charts" className="text-blue-600 dark:text-blue-400 hover:underline">
            Back to Charts
          </Link>
        </div>
      </div>
    );
  }

  // Build table layout: 4 rows, 2 tables per row
  const baseRows = [
    { row: 1, tables: [1, 2], zone: 'Front (Audio)' },
    { row: 2, tables: [3, 4], zone: 'Middle (Visual)' },
    { row: 3, tables: [5, 6], zone: 'Middle (Visual)' },
    { row: 4, tables: [7, 8], zone: 'Back (Kinesthetic)' },
  ];

  // Reverse row ORDER only (not left/right within rows) when flipped (student view)
  const rows = isFlipped ? [...baseRows].reverse() : baseRows;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 print:bg-white">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm print:shadow-none">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 print:hidden">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/seating/charts" className="hover:text-blue-600 dark:hover:text-blue-400">Seating Charts</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">{chart.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg print:hidden">
                <Layout className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{chart.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {chart.cohort.program.abbreviation} Group {chart.cohort.cohort_number} • {chart.classroom.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
              >
                <Wand2 className="w-4 h-4" />
                {generating ? 'Generating...' : 'Auto-Generate'}
              </button>
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className={`inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 ${isFlipped ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' : ''}`}
                title={isFlipped ? 'Student View (front at bottom)' : 'Instructor View (front at top)'}
              >
                <FlipVertical className="w-4 h-4" />
                {isFlipped ? 'Student View' : 'Instructor View'}
              </button>
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main id="seating-chart-printable" className="max-w-7xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
        {/* Print Header - Only visible when printing */}
        <div className="hidden print:block mb-6">
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-3">
            <div>
              <h1 className="text-2xl font-bold">{chart?.name || 'Seating Chart'}</h1>
              <p className="text-gray-600">
                {chart?.cohort.program.abbreviation} Group {chart?.cohort.cohort_number} • {chart?.classroom.name}
              </p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Printed: {new Date().toLocaleDateString()}</p>
              <p>{assignments.length} students seated</p>
            </div>
          </div>
          {/* Print Legend */}
          <div className="mt-3 flex gap-4 text-xs">
            <span className="font-medium">Learning Styles:</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-blue-500 text-white rounded flex items-center justify-center text-xs">A</span> Audio</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-green-500 text-white rounded flex items-center justify-center text-xs">V</span> Visual</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-orange-500 text-white rounded flex items-center justify-center text-xs">K</span> Kinesthetic</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-purple-500 text-white rounded flex items-center justify-center text-xs">S</span> Social</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 bg-gray-500 text-white rounded flex items-center justify-center text-xs">I</span> Independent</span>
          </div>
        </div>

        {/* Warnings Panel */}
        {warnings.length > 0 && showWarnings && (
          <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 print:hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">Generation Warnings ({warnings.length})</h3>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-700 dark:text-yellow-400">
                    {warnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setShowWarnings(false)}
                className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {generationStats && (
              <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700 text-xs text-yellow-700 dark:text-yellow-400">
                <span className="font-medium">Stats:</span> {generationStats.placed}/{generationStats.totalStudents} placed •
                {generationStats.inOverflow} in overflow •
                {generationStats.agencyConflicts} agency conflicts •
                {generationStats.avoidanceConflicts} avoidance conflicts
              </div>
            )}
          </div>
        )}

        {/* Toggle warnings button if hidden */}
        {warnings.length > 0 && !showWarnings && (
          <button
            onClick={() => setShowWarnings(true)}
            className="mb-4 text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 flex items-center gap-1 print:hidden"
          >
            <AlertCircle className="w-4 h-4" />
            Show {warnings.length} warning(s)
          </button>
        )}

        <div className="flex gap-6 print:block">
          {/* Classroom Layout */}
          <div className="flex-1">
            {/* Front of Room Label - at top when not flipped */}
            {!isFlipped && (
              <div className="text-center mb-4 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-lg font-medium print:bg-gray-200 print:text-gray-800">
                FRONT OF ROOM (Instructor)
              </div>
            )}

            {/* Back of Room Label - at top when flipped */}
            {isFlipped && (
              <div className="text-center mb-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-lg font-medium print:bg-gray-100 print:text-gray-800">
                BACK OF ROOM
              </div>
            )}

            {/* Overflow Seats - at back of room (top when flipped, bottom when not flipped) */}
            {isFlipped && (
              <div className="mb-6">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Overflow Seating (Back Wall)
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 print:shadow-none print:border">
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3].map((seat) => {
                      const student = getStudentAtSeat(0, seat, true);
                      const ls = student ? getLearningStyle(student.id) : null;

                      return (
                        <div
                          key={seat}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(0, seat, 5, true)}
                          className={`w-24 h-36 print:h-auto rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-1 transition-colors ${
                            student
                              ? 'border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                          }`}
                        >
                          {student ? (
                            <div
                              draggable
                              onDragStart={() => handleDragStart(student, { table: 0, seat })}
                              onContextMenu={(e) => handleContextMenu(e, student)}
                              className="w-full h-full flex flex-col items-center justify-center cursor-move"
                            >
                              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 mb-1">
                                {student.photo_url ? (
                                  <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-300 text-xs font-medium">
                                    {student.first_name[0]}{student.last_name[0]}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs print:text-sm font-medium text-gray-900 dark:text-white print:text-black text-center truncate print:whitespace-normal w-full">
                                {student.first_name}
                              </div>
                              <div className="text-xs print:text-sm text-gray-500 dark:text-gray-400 print:text-black text-center truncate print:whitespace-normal w-full">
                                {student.last_name}
                              </div>
                              <div className="flex gap-0.5 mt-1 print:hidden">
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
            )}

            {/* Tables Grid */}
            <div className="space-y-4">
              {rows.map(({ row, tables, zone }) => (
                <div key={row}>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 print:text-gray-600">Row {row} - {zone}</div>
                  <div className="flex gap-8 justify-center">
                    {tables.map((tableNum) => (
                      <div key={tableNum} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 print:shadow-none print:border">
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
                                className={`w-24 h-36 print:h-auto rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-1 transition-colors ${
                                  student
                                    ? 'border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                } ${conflicts.length > 0 ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/30' : ''}`}
                              >
                                {student ? (
                                  <div
                                    draggable
                                    onDragStart={() => handleDragStart(student, { table: tableNum, seat })}
                                    onContextMenu={(e) => handleContextMenu(e, student)}
                                    className="w-full h-full flex flex-col items-center justify-center cursor-move"
                                  >
                                    {/* Photo or Initials */}
                                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 mb-1 flex-shrink-0">
                                      {student.photo_url ? (
                                        <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-300 text-xs font-medium">
                                          {student.first_name[0]}{student.last_name[0]}
                                        </div>
                                      )}
                                    </div>

                                    {/* Name */}
                                    <div className="text-xs print:text-sm font-medium text-gray-900 dark:text-white print:text-black text-center truncate print:whitespace-normal w-full">
                                      {student.first_name}
                                    </div>
                                    <div className="text-xs print:text-sm text-gray-500 dark:text-gray-400 print:text-black text-center truncate print:whitespace-normal w-full">
                                      {student.last_name}
                                    </div>

                                    {/* Badges */}
                                    <div className="flex gap-0.5 mt-1 print:hidden">
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

            {/* Overflow Seats - at back of room (bottom when not flipped) */}
            {!isFlipped && (
              <div className="mt-6">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Overflow Seating (Back Wall)
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 print:shadow-none print:border">
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3].map((seat) => {
                      const student = getStudentAtSeat(0, seat, true);
                      const ls = student ? getLearningStyle(student.id) : null;

                      return (
                        <div
                          key={seat}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(0, seat, 5, true)}
                          className={`w-24 h-36 print:h-auto rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-1 transition-colors ${
                            student
                              ? 'border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                          }`}
                        >
                          {student ? (
                            <div
                              draggable
                              onDragStart={() => handleDragStart(student, { table: 0, seat })}
                              onContextMenu={(e) => handleContextMenu(e, student)}
                              className="w-full h-full flex flex-col items-center justify-center cursor-move"
                            >
                              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 mb-1">
                                {student.photo_url ? (
                                  <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-300 text-xs font-medium">
                                    {student.first_name[0]}{student.last_name[0]}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs print:text-sm font-medium text-gray-900 dark:text-white print:text-black text-center truncate print:whitespace-normal w-full">
                                {student.first_name}
                              </div>
                              <div className="text-xs print:text-sm text-gray-500 dark:text-gray-400 print:text-black text-center truncate print:whitespace-normal w-full">
                                {student.last_name}
                              </div>
                              <div className="flex gap-0.5 mt-1 print:hidden">
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
            )}

            {/* Front of Room Label - at bottom when flipped (student view) */}
            {isFlipped && (
              <div className="text-center mt-6 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-lg font-medium print:bg-gray-200 print:text-gray-800">
                FRONT OF ROOM (Instructor)
              </div>
            )}

            {/* Back of Room Label - at bottom when not flipped */}
            {!isFlipped && (
              <div className="text-center mt-6 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-lg font-medium print:bg-gray-100 print:text-gray-800">
                BACK OF ROOM
              </div>
            )}
          </div>

          {/* Unassigned Students Sidebar */}
          <div className="w-64 flex-shrink-0 print:hidden">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDropToUnassigned}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-4"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Unassigned ({unassignedStudents.length})
              </h3>

              {unassignedStudents.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
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
                        className="flex items-center gap-2 p-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-move"
                      >
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-300 text-xs">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {student.first_name} {student.last_name}
                          </div>
                          {student.agency && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{student.agency}</div>
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
              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Legend</h4>
                <div className="grid grid-cols-2 gap-1 text-xs dark:text-gray-300">
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleUnassignFromContextMenu(contextMenu.student)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Unassign {contextMenu.student.first_name} {contextMenu.student.last_name}
          </button>
        </div>
      )}
    </div>
  );
}
