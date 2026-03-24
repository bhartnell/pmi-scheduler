import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

interface ProposedAssignment {
  shift_id: string;
  student_id: string;
  score: number;
  shift_date: string;
  shift_type: string | null;
}

// POST /api/clinical/ride-alongs/auto-assign — smart-assign students to open shifts
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { cohort_id, semester_id, confirm } = body;

    // 1. Get all open shifts
    let shiftQuery = supabase
      .from('ride_along_shifts')
      .select(`
        *,
        assignments:ride_along_assignments(id, student_id, status)
      `)
      .eq('status', 'open')
      .order('shift_date');

    if (cohort_id) shiftQuery = shiftQuery.eq('cohort_id', cohort_id);
    if (semester_id) shiftQuery = shiftQuery.eq('semester_id', semester_id);

    const { data: shifts, error: shiftErr } = await shiftQuery;
    if (shiftErr) throw shiftErr;

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ success: true, proposed: [], message: 'No open shifts found' });
    }

    // 2. Get all student availability
    let availQuery = supabase
      .from('ride_along_availability')
      .select('*');

    if (cohort_id) availQuery = availQuery.eq('cohort_id', cohort_id);
    if (semester_id) availQuery = availQuery.eq('semester_id', semester_id);

    const { data: availability, error: availErr } = await availQuery;
    if (availErr) throw availErr;

    if (!availability || availability.length === 0) {
      return NextResponse.json({ success: true, proposed: [], message: 'No student availability records found' });
    }

    // 3. Get existing assignments count per student (for even distribution)
    const studentIds = availability.map(a => a.student_id);
    const { data: existingAssignments } = await supabase
      .from('ride_along_assignments')
      .select('student_id')
      .in('student_id', studentIds)
      .neq('status', 'cancelled');

    const assignmentCounts: Record<string, number> = {};
    for (const a of existingAssignments || []) {
      assignmentCounts[a.student_id] = (assignmentCounts[a.student_id] || 0) + 1;
    }

    // 4. Score each student-shift pair
    const proposed: ProposedAssignment[] = [];
    // Track new assignments during this run for even distribution
    const newAssignmentCounts: Record<string, number> = {};

    for (const shift of shifts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingShiftAssignments = (shift.assignments as any[]) || [];
      const activeAssignments = existingShiftAssignments.filter(
        (a: { status: string }) => a.status !== 'cancelled'
      );
      const slotsAvailable = (shift.max_students || 1) - activeAssignments.length;
      if (slotsAvailable <= 0) continue;

      const alreadyAssignedStudents = new Set(
        activeAssignments.map((a: { student_id: string }) => a.student_id)
      );

      // Score candidates
      const candidates: Array<{ studentId: string; score: number }> = [];

      for (const avail of availability) {
        if (alreadyAssignedStudents.has(avail.student_id)) continue;

        let score = 0;
        const shiftDate = shift.shift_date;
        const shiftDayOfWeek = new Date(shiftDate + 'T00:00:00').getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[shiftDayOfWeek];

        // Check unavailable dates
        const unavailDates = avail.unavailable_dates || [];
        if (unavailDates.includes(shiftDate)) continue; // Skip unavailable

        // Check available days (JSONB: { monday: true, tuesday: false, ... })
        const availDays = avail.available_days || {};
        if (typeof availDays === 'object' && availDays[dayName] === true) {
          score += 3;
        } else if (typeof availDays === 'object' && availDays[dayName] === false) {
          continue; // Explicitly unavailable
        } else {
          score += 1; // No preference stated, neutral
        }

        // Check preferred shift type
        const prefTypes = avail.preferred_shift_type || [];
        if (shift.shift_type && prefTypes.includes(shift.shift_type)) {
          score += 2;
        }

        // Check preferred dates
        const prefDates = avail.preferred_dates || [];
        if (prefDates.includes(shiftDate)) {
          score += 3;
        }

        // Penalize students with more existing assignments (even distribution)
        const totalExisting = (assignmentCounts[avail.student_id] || 0) + (newAssignmentCounts[avail.student_id] || 0);
        score -= totalExisting;

        candidates.push({ studentId: avail.student_id, score });
      }

      // Sort by score descending, take top N
      candidates.sort((a, b) => b.score - a.score);
      const selected = candidates.slice(0, slotsAvailable);

      for (const c of selected) {
        proposed.push({
          shift_id: shift.id,
          student_id: c.studentId,
          score: c.score,
          shift_date: shift.shift_date,
          shift_type: shift.shift_type,
        });
        newAssignmentCounts[c.studentId] = (newAssignmentCounts[c.studentId] || 0) + 1;
      }
    }

    // 5. If confirm=true, create the assignments
    if (confirm && proposed.length > 0) {
      const inserts = proposed.map(p => ({
        shift_id: p.shift_id,
        student_id: p.student_id,
        status: 'assigned' as const,
        assigned_by: user.id,
      }));

      const { data: created, error: insertErr } = await supabase
        .from('ride_along_assignments')
        .insert(inserts)
        .select();

      if (insertErr) throw insertErr;

      // Update shift statuses
      for (const shift of shifts) {
        const assignedToShift = proposed.filter(p => p.shift_id === shift.id).length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingCount = ((shift.assignments as any[]) || []).filter(
          (a: { status: string }) => a.status !== 'cancelled'
        ).length;
        if (existingCount + assignedToShift >= (shift.max_students || 1)) {
          await supabase
            .from('ride_along_shifts')
            .update({ status: 'filled' })
            .eq('id', shift.id);
        }
      }

      return NextResponse.json({
        success: true,
        confirmed: true,
        assignments: created || [],
        count: (created || []).length,
      });
    }

    // Return preview
    return NextResponse.json({
      success: true,
      confirmed: false,
      proposed,
      count: proposed.length,
    });
  } catch (error) {
    console.error('Error auto-assigning ride-alongs:', error);
    return NextResponse.json({ success: false, error: 'Failed to auto-assign' }, { status: 500 });
  }
}
