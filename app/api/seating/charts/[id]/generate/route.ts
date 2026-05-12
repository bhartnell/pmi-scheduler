import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * POST /api/seating/charts/[id]/generate
 *
 * Auto-generates seating assignments for a chart. The placement
 * algorithm is shared between the default (Main Classroom) layout
 * and the Suite 1 preset — we enumerate the room's seats from the
 * chart's classroom layout_config, tag each seat with semantic
 * properties (rowZone, columnZone, isCorner), then place students
 * by learning style into seats that best match.
 *
 * Algorithm (per the LVFR seating spec):
 *   STEP 1  Auditory                  → Row 1 center columns
 *   STEP 2  Kinesthetic                → Back row outside corners
 *           Kinesthetic + Social       → back center
 *           Kinesthetic + Independent  → back corner
 *   STEP 3  Visual + Independent       → far left/right cols, rows 1-3
 *   STEP 4  Visual + Social            → center cols, rows 1-4
 *   Audio   + Independent              → middle row, outskirt col
 *   Audio   + Social                   → middle row, center col
 *   Unassessed / fallback              → any remaining seat
 *
 * Constraints preserved across both layouts:
 *   - Same-agency students aren't placed at the same "table"
 *     (synthetic tables for Suite 1: row*10 + side, so this still
 *     means "students sharing a left-or-right row section").
 *   - Avoidance preferences ("prefer_near"/"avoid" pairs).
 *   - Overflow seats only exist for layouts that declare them
 *     (default: 3, Suite 1: 0).
 */

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

// ── Seat enumeration ─────────────────────────────────────────────
// Each physical seat carries the metadata the placement algorithm
// uses to score it for a given student. `table_number` /
// `seat_position` / `row_number` round-trip into the seat_assignments
// schema unchanged.

interface SeatSpec {
  row: number;
  table_number: number;
  seat_position: number;
  side: 'left' | 'right';
  rowZone: 'front' | 'middle' | 'back';
  columnZone: 'center' | 'outskirt';
  isCorner: boolean;
}

interface LayoutSpec {
  preset: 'default' | 'suite_1';
  seats: SeatSpec[];
  overflowSeats: number; // # of overflow chairs at the back wall
}

/** Build the seat list for the default 4-row × 2-table × 3-seat layout. */
function defaultLayout(): LayoutSpec {
  const seats: SeatSpec[] = [];
  const layoutRows: Array<{ row: number; tables: [number, number]; rowZone: 'front' | 'middle' | 'back' }> = [
    { row: 1, tables: [1, 2], rowZone: 'front' },
    { row: 2, tables: [3, 4], rowZone: 'middle' },
    { row: 3, tables: [5, 6], rowZone: 'middle' },
    { row: 4, tables: [7, 8], rowZone: 'back' },
  ];
  for (const r of layoutRows) {
    const [leftTable, rightTable] = r.tables;
    for (let s = 1; s <= 3; s++) {
      // 3-seat tables: seat 1 is the aisle-side seat on the left
      // table (outskirt = window/wall side, seat 1 on left, seat 3
      // on right table). Inside this 3-seat unit, seat 2 is always
      // the center seat.
      seats.push({
        row: r.row,
        table_number: leftTable,
        seat_position: s,
        side: 'left',
        rowZone: r.rowZone,
        columnZone: s === 1 ? 'outskirt' : 'center',
        isCorner: r.rowZone === 'back' && s === 1,
      });
      seats.push({
        row: r.row,
        table_number: rightTable,
        seat_position: s,
        side: 'right',
        rowZone: r.rowZone,
        columnZone: s === 3 ? 'outskirt' : 'center',
        isCorner: r.rowZone === 'back' && s === 3,
      });
    }
  }
  return { preset: 'default', seats, overflowSeats: 3 };
}

/** Build the seat list for the Suite 1 preset from layout_config.rows. */
function suite1Layout(rows: Array<{ row: number; left: number; right: number; zone?: string }>): LayoutSpec {
  const seats: SeatSpec[] = [];
  const maxRow = Math.max(...rows.map(r => r.row));
  for (const r of rows) {
    const rowZone: 'front' | 'middle' | 'back' =
      r.row === 1 ? 'front' : r.row === maxRow ? 'back' : 'middle';

    // Left section: seat 1 is the leftmost (window side) → outskirt.
    for (let i = 1; i <= r.left; i++) {
      seats.push({
        row: r.row,
        table_number: r.row * 10 + 1,
        seat_position: i,
        side: 'left',
        rowZone,
        columnZone: i === 1 ? 'outskirt' : 'center',
        isCorner: rowZone === 'back' && i === 1,
      });
    }
    // Right section: highest-numbered seat is the rightmost (wall
    // side) → outskirt.
    for (let i = 1; i <= r.right; i++) {
      seats.push({
        row: r.row,
        table_number: r.row * 10 + 2,
        seat_position: i,
        side: 'right',
        rowZone,
        columnZone: i === r.right ? 'outskirt' : 'center',
        isCorner: rowZone === 'back' && i === r.right,
      });
    }
  }
  return { preset: 'suite_1', seats, overflowSeats: 0 };
}

function buildLayout(layoutConfig: unknown): LayoutSpec {
  const cfg = (layoutConfig ?? {}) as { preset?: string; rows?: unknown };
  if (cfg.preset === 'suite_1' && Array.isArray(cfg.rows)) {
    return suite1Layout(cfg.rows as Array<{ row: number; left: number; right: number; zone?: string }>);
  }
  return defaultLayout();
}

// ── Placement algorithm ──────────────────────────────────────────

function generateSeating(
  students: Student[],
  learningStyles: LearningStyle[],
  preferences: Preference[],
  layout: LayoutSpec,
): { assignments: Assignment[]; warnings: string[]; stats: Record<string, unknown> } {
  const warnings: string[] = [];
  const assignments: Assignment[] = [];

  const styleMap = new Map<string, LearningStyle>();
  for (const ls of learningStyles) styleMap.set(ls.student_id, ls);

  // Same-agency-at-same-table check operates on table_number. For
  // Suite 1 a "table" is a row+side (synthetic table_number), which
  // is still semantically "students seated together within arm's
  // reach" — exactly the rule the agency separation tries to enforce.
  const agencyPerTable = new Map<number, Set<string>>();
  for (const seat of layout.seats) {
    if (!agencyPerTable.has(seat.table_number)) {
      agencyPerTable.set(seat.table_number, new Set());
    }
  }

  // Build avoid map (bidirectional).
  const avoidMap = new Map<string, Set<string>>();
  for (const p of preferences) {
    if (p.preference_type !== 'avoid') continue;
    if (!avoidMap.has(p.student_id)) avoidMap.set(p.student_id, new Set());
    if (!avoidMap.has(p.other_student_id)) avoidMap.set(p.other_student_id, new Set());
    avoidMap.get(p.student_id)!.add(p.other_student_id);
    avoidMap.get(p.other_student_id)!.add(p.student_id);
  }

  const seatKey = (s: SeatSpec) => `${s.table_number}-${s.seat_position}`;
  const takenSeats = new Set<string>();
  const studentPlaced = new Set<string>();
  const studentToSeat = new Map<string, SeatSpec>();

  const hasAgencyConflict = (student: Student, seat: SeatSpec) =>
    !!student.agency && (agencyPerTable.get(seat.table_number)?.has(student.agency) ?? false);

  const hasAvoidanceConflict = (studentId: string, seat: SeatSpec) => {
    const avoids = avoidMap.get(studentId);
    if (!avoids) return false;
    // Check every taken seat in the same table for a student we
    // should avoid. Cheaper than rebuilding by-table lists.
    for (const [otherSid, otherSeat] of studentToSeat) {
      if (otherSeat.table_number === seat.table_number && avoids.has(otherSid)) return true;
    }
    return false;
  };

  const placeAt = (student: Student, seat: SeatSpec) => {
    takenSeats.add(seatKey(seat));
    studentPlaced.add(student.id);
    studentToSeat.set(student.id, seat);
    if (student.agency) agencyPerTable.get(seat.table_number)!.add(student.agency);
    assignments.push({
      student_id: student.id,
      table_number: seat.table_number,
      seat_position: seat.seat_position,
      row_number: seat.row,
      is_overflow: false,
    });
  };

  /**
   * Try to seat `student` in the first available seat from `seatsPriority`.
   * Two passes: first respecting agency conflicts, then ignoring them
   * if no seat is free (so a student never ends up in overflow purely
   * because of an agency overlap).
   */
  const trySeat = (student: Student, seatsPriority: SeatSpec[]): boolean => {
    for (const seat of seatsPriority) {
      if (takenSeats.has(seatKey(seat))) continue;
      if (hasAgencyConflict(student, seat)) continue;
      if (hasAvoidanceConflict(student.id, seat)) continue;
      placeAt(student, seat);
      return true;
    }
    // Fallback: relax agency constraint.
    for (const seat of seatsPriority) {
      if (takenSeats.has(seatKey(seat))) continue;
      if (hasAvoidanceConflict(student.id, seat)) continue;
      placeAt(student, seat);
      return true;
    }
    return false;
  };

  // ── Bucket students by (primary, social) combination ────────────
  const audio: Student[] = [];
  const audioIndependent: Student[] = [];
  const audioSocial: Student[] = [];
  const visualIndependent: Student[] = [];
  const visualSocial: Student[] = [];
  const kinestheticCorner: Student[] = []; // independent variant
  const kinestheticCenter: Student[] = []; // social or unspecified
  const unassessed: Student[] = [];

  for (const s of students) {
    const ls = styleMap.get(s.id);
    const p = ls?.primary_style ?? null;
    const soc = ls?.social_style ?? null;
    if (p === 'audio') {
      // First 1-2 auditory go to front center; remainder split by
      // social style per the spec's tie-breaker rules.
      if (soc === 'independent') audioIndependent.push(s);
      else if (soc === 'social') audioSocial.push(s);
      else audio.push(s);
    } else if (p === 'kinesthetic') {
      if (soc === 'independent') kinestheticCorner.push(s);
      else kinestheticCenter.push(s);
    } else if (p === 'visual') {
      if (soc === 'independent') visualIndependent.push(s);
      else visualSocial.push(s);
    } else {
      unassessed.push(s);
    }
  }

  // ── Build named seat lists used by the placement steps ──────────
  const all = layout.seats;
  const byRow = (...zones: SeatSpec['rowZone'][]) => all.filter(s => zones.includes(s.rowZone));
  const front = byRow('front');
  const middle = byRow('middle');
  const back = byRow('back');

  const center = (xs: SeatSpec[]) => xs.filter(s => s.columnZone === 'center');
  const outskirt = (xs: SeatSpec[]) => xs.filter(s => s.columnZone === 'outskirt');

  const frontCenter = center(front);
  const middleOutskirt = outskirt(middle);
  const middleCenter = center(middle);
  const backCenter = center(back);
  const backCorners = back.filter(s => s.isCorner);
  // Independent visual: rows 1-3 outermost columns ("far left and
  // far right"). For default this is rows 1-3 (back is row 4). For
  // Suite 1 this is rows 1-3 (middle = 3-4, back = 5).
  const independentVisualTarget = all.filter(s => s.row <= 3 && s.columnZone === 'outskirt');
  // Social visual: center seats in non-back rows.
  const socialVisualTarget = all.filter(s => s.rowZone !== 'back' && s.columnZone === 'center');

  // ── STEP 1 — Auditory students (place first) ────────────────────
  // Front-row center seats first; overflow into middle center if the
  // front row fills up (e.g. >2 auditory students).
  for (const s of audio) trySeat(s, [...frontCenter, ...middleCenter]);

  // ── STEP 2 — Kinesthetic students ────────────────────────────────
  // Back row first; within the back row, independent variant
  // prefers corners while social variant prefers center.
  for (const s of kinestheticCorner) trySeat(s, [...backCorners, ...back, ...middle]);
  for (const s of kinestheticCenter) trySeat(s, [...backCenter, ...back, ...middle]);

  // ── STEP 3 — Visual + Independent ────────────────────────────────
  for (const s of visualIndependent) {
    trySeat(s, [...independentVisualTarget, ...middleOutskirt, ...outskirt(all)]);
  }

  // ── Auditory hybrids (middle row variants) ──────────────────────
  // Per the tie-breaker rules — these fall into the middle row
  // (between front and back) before Step 4 fills the remaining
  // central seats.
  for (const s of audioIndependent) trySeat(s, [...middleOutskirt, ...outskirt(all), ...frontCenter]);
  for (const s of audioSocial) trySeat(s, [...middleCenter, ...frontCenter]);

  // ── STEP 4 — Visual + Social (fill remaining center seats) ─────
  for (const s of visualSocial) trySeat(s, [...socialVisualTarget, ...center(all), ...all]);

  // ── Unassessed students: any remaining seat ─────────────────────
  for (const s of unassessed) trySeat(s, all);

  // ── Final pass: any still-unplaced students go to overflow ─────
  // Overflow only exists in layouts that declare it (default = 3,
  // Suite 1 = 0). Beyond that capacity → warning, not silently lost.
  const stillUnplaced = students.filter(st => !studentPlaced.has(st.id));
  let overflowUsed = 0;
  for (const s of stillUnplaced) {
    if (overflowUsed >= layout.overflowSeats) break;
    assignments.push({
      student_id: s.id,
      table_number: 0,
      seat_position: overflowUsed + 1,
      row_number: layout.preset === 'suite_1' ? 6 : 5, // distinct from real rows
      is_overflow: true,
    });
    studentPlaced.add(s.id);
    overflowUsed++;
  }

  const finalUnplaced = students.filter(s => !studentPlaced.has(s.id));
  if (finalUnplaced.length > 0) {
    warnings.push(
      `${finalUnplaced.length} student(s) could not be placed — room capacity is ${layout.seats.length + layout.overflowSeats} seats.`,
    );
  }

  // ── Post-hoc warnings: agency + avoidance ──────────────────────
  for (const a of assignments) {
    if (a.is_overflow) continue;
    const student = students.find(s => s.id === a.student_id);
    if (!student) continue;

    // Avoidance check
    const avoids = avoidMap.get(student.id);
    if (avoids) {
      const tablemates = assignments.filter(
        x => !x.is_overflow && x.table_number === a.table_number && x.student_id !== student.id,
      );
      for (const tm of tablemates) {
        if (avoids.has(tm.student_id)) {
          const other = students.find(s => s.id === tm.student_id);
          warnings.push(`Conflict: ${student.first_name} should avoid ${other?.first_name} but seated at same table`);
        }
      }
    }
  }

  // Agency conflict check (one warning per student per table).
  const flaggedAgency = new Set<string>();
  for (const a of assignments) {
    if (a.is_overflow) continue;
    const student = students.find(s => s.id === a.student_id);
    if (!student?.agency) continue;
    const tag = `${student.id}:${a.table_number}`;
    if (flaggedAgency.has(tag)) continue;
    const tablemates = assignments.filter(
      x => !x.is_overflow && x.table_number === a.table_number && x.student_id !== student.id,
    );
    for (const tm of tablemates) {
      const other = students.find(s => s.id === tm.student_id);
      if (other?.agency === student.agency) {
        warnings.push(`${student.first_name} ${student.last_name} placed at table with same agency (${student.agency})`);
        flaggedAgency.add(tag);
        break;
      }
    }
  }

  const stats = {
    totalStudents: students.length,
    placed: studentPlaced.size,
    unplaced: finalUnplaced.length,
    inOverflow: assignments.filter(a => a.is_overflow).length,
    agencyConflicts: warnings.filter(w => w.includes('same agency')).length,
    avoidanceConflicts: warnings.filter(w => w.includes('should avoid')).length,
    layoutPreset: layout.preset,
    roomCapacity: layout.seats.length + layout.overflowSeats,
    byLearningStyle: {
      audio: audio.length + audioIndependent.length + audioSocial.length,
      visual: visualIndependent.length + visualSocial.length,
      kinesthetic: kinestheticCorner.length + kinestheticCenter.length,
      unassessed: unassessed.length,
    },
  };

  return { assignments, warnings, stats };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chartId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    // Pull the chart + its classroom so we can branch on layout_config.
    const { data: chart, error: chartError } = await supabase
      .from('seating_charts')
      .select(`
        *,
        cohort:cohorts(id),
        classroom:classrooms(id, name, layout_config)
      `)
      .eq('id', chartId)
      .single();

    if (chartError || !chart) {
      return NextResponse.json({ success: false, error: 'Chart not found' }, { status: 404 });
    }

    const cohortId = chart.cohort.id;
    const layout = buildLayout(chart.classroom?.layout_config);

    // Get all active students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, agency')
      .eq('cohort_id', cohortId)
      .eq('status', 'active');

    if (studentsError) throw studentsError;

    const studentIds = students?.map(s => s.id) || [];
    const { data: learningStyles, error: lsError } = await supabase
      .from('student_learning_styles')
      .select('student_id, primary_style, social_style')
      .in('student_id', studentIds);

    if (lsError) throw lsError;

    const { data: preferences } = await supabase
      .from('seating_preferences')
      .select('student_id, other_student_id, preference_type')
      .or(`student_id.in.(${studentIds.join(',')}),other_student_id.in.(${studentIds.join(',')})`);

    const result = generateSeating(
      students || [],
      learningStyles || [],
      preferences || [],
      layout,
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
