import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  agency: string | null;
}

interface LearningStyle {
  student_id: string;
  primary_style: 'audio' | 'visual' | 'kinesthetic' | null;
  social_style: 'social' | 'independent' | null;
}

interface Preference {
  student_id: string;
  other_student_id: string;
  preference_type: 'avoid' | 'prefer_near';
}

interface Assignment {
  student_id: string;
  table_number: number;
  seat_position: number;
  row_number: number;
  is_overflow: boolean;
}

// Classroom layout configuration
// Row 1 (Front - Audio): Tables 1 (left), 2 (right)
// Row 2 (Middle - Visual): Tables 3 (left), 4 (right)
// Row 3 (Middle - Visual): Tables 5 (left), 6 (right)
// Row 4 (Back - Kinesthetic): Tables 7 (left), 8 (right)
// Overflow: 3 seats at back wall

const LAYOUT = {
  rows: [
    { row: 1, tables: [1, 2], style: 'audio' },
    { row: 2, tables: [3, 4], style: 'visual' },
    { row: 3, tables: [5, 6], style: 'visual' },
    { row: 4, tables: [7, 8], style: 'kinesthetic' },
  ],
  seatsPerTable: 3,
  overflowSeats: 3,
  leftTables: [1, 3, 5, 7],  // Independent learners prefer left
  rightTables: [2, 4, 6, 8], // Social learners prefer right
};

function generateSeating(
  students: Student[],
  learningStyles: LearningStyle[],
  preferences: Preference[]
): { assignments: Assignment[]; warnings: string[]; stats: any } {
  const warnings: string[] = [];
  const assignments: Assignment[] = [];

  // Create lookup maps
  const styleMap = new Map<string, LearningStyle>();
  learningStyles.forEach(ls => styleMap.set(ls.student_id, ls));

  // Group students by learning style and agency
  const audioStudents: Student[] = [];
  const visualStudents: Student[] = [];
  const kinestheticStudents: Student[] = [];
  const unassessedStudents: Student[] = [];

  students.forEach(student => {
    const ls = styleMap.get(student.id);
    if (!ls?.primary_style) {
      unassessedStudents.push(student);
    } else if (ls.primary_style === 'audio') {
      audioStudents.push(student);
    } else if (ls.primary_style === 'visual') {
      visualStudents.push(student);
    } else if (ls.primary_style === 'kinesthetic') {
      kinestheticStudents.push(student);
    }
  });

  // Track which seats are filled
  const seatMap = new Map<string, string>(); // "table-seat" -> studentId
  const studentPlaced = new Set<string>();

  // Track agencies per table to avoid same agency at same table
  const agencyPerTable = new Map<number, Set<string>>();
  for (let t = 1; t <= 8; t++) {
    agencyPerTable.set(t, new Set());
  }

  // Build conflict map
  const avoidMap = new Map<string, Set<string>>();
  preferences.filter(p => p.preference_type === 'avoid').forEach(p => {
    if (!avoidMap.has(p.student_id)) avoidMap.set(p.student_id, new Set());
    if (!avoidMap.has(p.other_student_id)) avoidMap.set(p.other_student_id, new Set());
    avoidMap.get(p.student_id)!.add(p.other_student_id);
    avoidMap.get(p.other_student_id)!.add(p.student_id);
  });

  // Helper to check if placing student at table creates agency conflict
  const hasAgencyConflict = (student: Student, tableNum: number): boolean => {
    if (!student.agency) return false;
    return agencyPerTable.get(tableNum)?.has(student.agency) || false;
  };

  // Helper to check if placing student at table creates avoidance conflict
  const hasAvoidanceConflict = (studentId: string, tableNum: number): boolean => {
    const avoidSet = avoidMap.get(studentId);
    if (!avoidSet) return false;

    // Check if any student at this table should be avoided
    for (let seat = 1; seat <= 3; seat++) {
      const key = `${tableNum}-${seat}`;
      const existingStudentId = seatMap.get(key);
      if (existingStudentId && avoidSet.has(existingStudentId)) {
        return true;
      }
    }
    return false;
  };

  // Helper to get available seats at a table
  const getAvailableSeats = (tableNum: number): number[] => {
    const available: number[] = [];
    for (let seat = 1; seat <= 3; seat++) {
      if (!seatMap.has(`${tableNum}-${seat}`)) {
        available.push(seat);
      }
    }
    return available;
  };

  // Helper to place student at table
  const placeStudent = (student: Student, tableNum: number, seatNum: number, rowNum: number) => {
    const key = `${tableNum}-${seatNum}`;
    seatMap.set(key, student.id);
    studentPlaced.add(student.id);

    if (student.agency) {
      agencyPerTable.get(tableNum)!.add(student.agency);
    }

    assignments.push({
      student_id: student.id,
      table_number: tableNum,
      seat_position: seatNum,
      row_number: rowNum,
      is_overflow: false,
    });
  };

  // Helper to sort students by social preference
  // Independent -> left tables, Social -> right tables
  const sortBySocialPreference = (studentList: Student[]): { left: Student[], right: Student[], neutral: Student[] } => {
    const left: Student[] = [];
    const right: Student[] = [];
    const neutral: Student[] = [];

    studentList.forEach(student => {
      const ls = styleMap.get(student.id);
      if (ls?.social_style === 'independent') {
        left.push(student);
      } else if (ls?.social_style === 'social') {
        right.push(student);
      } else {
        neutral.push(student);
      }
    });

    return { left, right, neutral };
  };

  // Place students in their preferred rows based on learning style
  const placeStudentGroup = (
    studentList: Student[],
    preferredTables: number[],
    rowNum: number
  ) => {
    const { left, right, neutral } = sortBySocialPreference(studentList);

    // Get left and right tables from preferred tables
    const leftTables = preferredTables.filter(t => LAYOUT.leftTables.includes(t));
    const rightTables = preferredTables.filter(t => LAYOUT.rightTables.includes(t));

    // Place independent learners on left side tables
    for (const student of left) {
      if (studentPlaced.has(student.id)) continue;

      let placed = false;
      // Try left tables first
      for (const tableNum of leftTables) {
        const availableSeats = getAvailableSeats(tableNum);
        if (availableSeats.length === 0) continue;
        if (hasAgencyConflict(student, tableNum)) continue;
        if (hasAvoidanceConflict(student.id, tableNum)) continue;

        placeStudent(student, tableNum, availableSeats[0], rowNum);
        placed = true;
        break;
      }

      // Fall back to right tables if needed
      if (!placed) {
        for (const tableNum of rightTables) {
          const availableSeats = getAvailableSeats(tableNum);
          if (availableSeats.length === 0) continue;
          if (hasAgencyConflict(student, tableNum)) continue;
          if (hasAvoidanceConflict(student.id, tableNum)) continue;

          placeStudent(student, tableNum, availableSeats[0], rowNum);
          placed = true;
          break;
        }
      }
    }

    // Place social learners on right side tables
    for (const student of right) {
      if (studentPlaced.has(student.id)) continue;

      let placed = false;
      // Try right tables first
      for (const tableNum of rightTables) {
        const availableSeats = getAvailableSeats(tableNum);
        if (availableSeats.length === 0) continue;
        if (hasAgencyConflict(student, tableNum)) continue;
        if (hasAvoidanceConflict(student.id, tableNum)) continue;

        placeStudent(student, tableNum, availableSeats[0], rowNum);
        placed = true;
        break;
      }

      // Fall back to left tables if needed
      if (!placed) {
        for (const tableNum of leftTables) {
          const availableSeats = getAvailableSeats(tableNum);
          if (availableSeats.length === 0) continue;
          if (hasAgencyConflict(student, tableNum)) continue;
          if (hasAvoidanceConflict(student.id, tableNum)) continue;

          placeStudent(student, tableNum, availableSeats[0], rowNum);
          placed = true;
          break;
        }
      }
    }

    // Place neutral students in any available seat
    for (const student of neutral) {
      if (studentPlaced.has(student.id)) continue;

      let placed = false;
      for (const tableNum of preferredTables) {
        const availableSeats = getAvailableSeats(tableNum);
        if (availableSeats.length === 0) continue;
        if (hasAgencyConflict(student, tableNum)) continue;
        if (hasAvoidanceConflict(student.id, tableNum)) continue;

        placeStudent(student, tableNum, availableSeats[0], rowNum);
        placed = true;
        break;
      }
    }
  };

  // Phase 1: Place students in their preferred learning style rows
  // Audio learners -> Row 1 (tables 1, 2)
  placeStudentGroup(audioStudents, [1, 2], 1);

  // Visual learners -> Rows 2-3 (tables 3, 4, 5, 6)
  placeStudentGroup(visualStudents, [3, 4, 5, 6], 2);

  // Kinesthetic learners -> Row 4 (tables 7, 8)
  placeStudentGroup(kinestheticStudents, [7, 8], 4);

  // Phase 2: Place remaining students (those who couldn't fit in preferred rows)
  const remainingStudents = [...audioStudents, ...visualStudents, ...kinestheticStudents, ...unassessedStudents]
    .filter(s => !studentPlaced.has(s.id));

  // Try to place in any available seat, respecting agency and avoidance constraints
  for (const student of remainingStudents) {
    let placed = false;

    // Try all tables in order
    for (let tableNum = 1; tableNum <= 8 && !placed; tableNum++) {
      const availableSeats = getAvailableSeats(tableNum);
      if (availableSeats.length === 0) continue;

      // Try to avoid agency conflicts but allow if necessary
      if (!hasAgencyConflict(student, tableNum) && !hasAvoidanceConflict(student.id, tableNum)) {
        const rowNum = tableNum <= 2 ? 1 : tableNum <= 4 ? 2 : tableNum <= 6 ? 3 : 4;
        placeStudent(student, tableNum, availableSeats[0], rowNum);
        placed = true;
      }
    }

    // If still not placed, allow agency conflicts
    if (!placed) {
      for (let tableNum = 1; tableNum <= 8 && !placed; tableNum++) {
        const availableSeats = getAvailableSeats(tableNum);
        if (availableSeats.length === 0) continue;
        if (!hasAvoidanceConflict(student.id, tableNum)) {
          const rowNum = tableNum <= 2 ? 1 : tableNum <= 4 ? 2 : tableNum <= 6 ? 3 : 4;
          placeStudent(student, tableNum, availableSeats[0], rowNum);
          placed = true;
          if (hasAgencyConflict(student, tableNum)) {
            warnings.push(`${student.first_name} ${student.last_name} placed at table with same agency (${student.agency})`);
          }
        }
      }
    }
  }

  // Phase 3: Place remaining students in overflow seats
  const stillUnplaced = students.filter(s => !studentPlaced.has(s.id));

  for (let i = 0; i < stillUnplaced.length && i < 3; i++) {
    const student = stillUnplaced[i];
    assignments.push({
      student_id: student.id,
      table_number: 0,
      seat_position: i + 1,
      row_number: 5,
      is_overflow: true,
    });
    studentPlaced.add(student.id);
  }

  // Any students still unplaced get added to warnings
  const finalUnplaced = students.filter(s => !studentPlaced.has(s.id));
  if (finalUnplaced.length > 0) {
    warnings.push(`${finalUnplaced.length} student(s) could not be placed (max capacity exceeded)`);
  }

  // Check for avoidance conflicts in final assignments
  for (const assignment of assignments) {
    if (assignment.is_overflow) continue;

    const studentAvoids = avoidMap.get(assignment.student_id);
    if (!studentAvoids) continue;

    // Find other students at same table
    const tablemates = assignments.filter(
      a => a.table_number === assignment.table_number &&
           a.student_id !== assignment.student_id &&
           !a.is_overflow
    );

    for (const tablemate of tablemates) {
      if (studentAvoids.has(tablemate.student_id)) {
        const student = students.find(s => s.id === assignment.student_id);
        const other = students.find(s => s.id === tablemate.student_id);
        warnings.push(`Conflict: ${student?.first_name} should avoid ${other?.first_name} but seated at same table`);
      }
    }
  }

  // Build stats
  const stats = {
    totalStudents: students.length,
    placed: studentPlaced.size,
    unplaced: finalUnplaced.length,
    inOverflow: assignments.filter(a => a.is_overflow).length,
    agencyConflicts: warnings.filter(w => w.includes('same agency')).length,
    avoidanceConflicts: warnings.filter(w => w.includes('should avoid')).length,
    byLearningStyle: {
      audio: audioStudents.length,
      visual: visualStudents.length,
      kinesthetic: kinestheticStudents.length,
      unassessed: unassessedStudents.length,
    },
  };

  return { assignments, warnings, stats };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chartId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get chart details with cohort
    const { data: chart, error: chartError } = await supabase
      .from('seating_charts')
      .select(`
        *,
        cohort:cohorts(id)
      `)
      .eq('id', chartId)
      .single();

    if (chartError || !chart) {
      return NextResponse.json({ success: false, error: 'Chart not found' }, { status: 404 });
    }

    const cohortId = chart.cohort.id;

    // Get all active students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, agency')
      .eq('cohort_id', cohortId)
      .eq('status', 'active');

    if (studentsError) throw studentsError;

    // Get learning styles for cohort students
    const studentIds = students?.map(s => s.id) || [];
    const { data: learningStyles, error: lsError } = await supabase
      .from('student_learning_styles')
      .select('student_id, primary_style, social_style')
      .in('student_id', studentIds);

    if (lsError) throw lsError;

    // Get seating preferences
    const { data: preferences, error: prefError } = await supabase
      .from('seating_preferences')
      .select('student_id, other_student_id, preference_type')
      .or(`student_id.in.(${studentIds.join(',')}),other_student_id.in.(${studentIds.join(',')})`);

    // Generate seating
    const result = generateSeating(
      students || [],
      learningStyles || [],
      preferences || []
    );

    return NextResponse.json({
      success: true,
      assignments: result.assignments,
      warnings: result.warnings,
      stats: result.stats,
    });
  } catch (error) {
    console.error('Error generating seating:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate seating' }, { status: 500 });
  }
}
