import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// POST - Admin: cohort-scoped roster generation, replacing the manual-SQL
// setup this ticket exists to eliminate (Task Handoff Queue "OSCE event
// creation in the UI — make it repeatable per cohort"). Auto-populates the
// event's cohort roster into osce_student_schedule (even split across time
// blocks, respecting per-block capacity derived from
// osce_events.minutes_per_student) and generates the matching
// osce_assessments rows using the event's osce_day_scenarios assignment.
//
// Guarded against re-running onto an event that already has a schedule —
// this is a one-shot initial-setup action, not a diffing/merge tool. Clear
// the existing osce_student_schedule / osce_assessments rows for the event
// first (via the Students tab or directly) if you need to regenerate.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: eventId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: event, error: eventErr } = await supabase
      .from('osce_events')
      .select('id, cohort_id, minutes_per_student')
      .eq('id', eventId)
      .single();
    if (eventErr || !event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }
    if (!event.cohort_id) {
      return NextResponse.json({ success: false, error: 'Set a cohort for this event in Settings first' }, { status: 400 });
    }

    const { count: existingCount } = await supabase
      .from('osce_student_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    if ((existingCount || 0) > 0) {
      return NextResponse.json({
        success: false,
        error: 'This event already has a generated schedule. Clear the existing Students/Results data first to regenerate.',
      }, { status: 409 });
    }

    const { data: students, error: studentsErr } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', event.cohort_id)
      .eq('status', 'active')
      .order('last_name');
    if (studentsErr) throw studentsErr;
    if (!students || students.length === 0) {
      return NextResponse.json({ success: false, error: 'No active students found in this cohort' }, { status: 400 });
    }

    const { data: blocks, error: blocksErr } = await supabase
      .from('osce_time_blocks')
      .select('id, day_number, date, start_time, end_time, sort_order')
      .eq('event_id', eventId)
      .order('day_number')
      .order('sort_order');
    if (blocksErr) throw blocksErr;
    if (!blocks || blocks.length === 0) {
      return NextResponse.json({ success: false, error: 'Add time blocks for this event first' }, { status: 400 });
    }

    const { data: dayScenarioRows, error: scenariosErr } = await supabase
      .from('osce_day_scenarios')
      .select('day_number, scenario')
      .eq('event_id', eventId);
    if (scenariosErr) throw scenariosErr;

    const scenariosByDay = new Map<number, string[]>();
    for (const row of dayScenarioRows || []) {
      const list = scenariosByDay.get(row.day_number) || [];
      list.push(row.scenario);
      scenariosByDay.set(row.day_number, list);
    }
    const daysWithBlocks = Array.from(new Set(blocks.map(b => b.day_number)));
    for (const day of daysWithBlocks) {
      if (!scenariosByDay.get(day)?.length) {
        return NextResponse.json({
          success: false,
          error: `Assign at least one scenario to Day ${day} before generating`,
        }, { status: 400 });
      }
    }

    // Per-block capacity: block duration ÷ minutes-per-student, minimum 1.
    const blockCapacities = blocks.map(b => ({
      ...b,
      capacity: Math.max(1, Math.floor(minutesBetween(b.start_time, b.end_time) / event.minutes_per_student)),
      filled: 0,
    }));
    const totalCapacity = blockCapacities.reduce((sum, b) => sum + b.capacity, 0);
    if (totalCapacity < students.length) {
      return NextResponse.json({
        success: false,
        error: `Not enough capacity: ${totalCapacity} slot${totalCapacity !== 1 ? 's' : ''} across all blocks for ${students.length} students. Add more time blocks or lower minutes-per-student.`,
      }, { status: 400 });
    }

    // Round-robin distribution across blocks, respecting each block's capacity.
    const scheduleRows: { event_id: string; time_block_id: string; student_name: string; slot_number: number; day_number: number; date: string }[] = [];
    let blockCursor = 0;
    for (const student of students) {
      let attempts = 0;
      while (blockCapacities[blockCursor].filled >= blockCapacities[blockCursor].capacity) {
        blockCursor = (blockCursor + 1) % blockCapacities.length;
        attempts++;
        if (attempts > blockCapacities.length) break; // shouldn't happen given the totalCapacity check above
      }
      const block = blockCapacities[blockCursor];
      block.filled += 1;
      scheduleRows.push({
        event_id: eventId,
        time_block_id: block.id,
        student_name: `${student.first_name} ${student.last_name}`,
        slot_number: block.filled,
        day_number: block.day_number,
        date: block.date,
      });
      blockCursor = (blockCursor + 1) % blockCapacities.length;
    }

    const { error: insertScheduleErr } = await supabase
      .from('osce_student_schedule')
      .insert(scheduleRows.map(r => ({
        event_id: r.event_id,
        time_block_id: r.time_block_id,
        student_name: r.student_name,
        slot_number: r.slot_number,
      })));
    if (insertScheduleErr) throw insertScheduleErr;

    // Assign scenarios round-robin within each day so the day's scenario set
    // is spread as evenly as possible across that day's students.
    const scenarioCursorByDay = new Map<number, number>();
    const assessmentRows = scheduleRows.map(r => {
      const dayScenarios = scenariosByDay.get(r.day_number)!;
      const cursor = scenarioCursorByDay.get(r.day_number) || 0;
      scenarioCursorByDay.set(r.day_number, cursor + 1);
      return {
        event_id: eventId,
        student_name: r.student_name,
        scenario: dayScenarios[cursor % dayScenarios.length],
        slot_number: r.slot_number,
        day_number: r.day_number,
        assessment_date: r.date,
      };
    });

    const { error: insertAssessmentsErr } = await supabase.from('osce_assessments').insert(assessmentRows);
    if (insertAssessmentsErr) throw insertAssessmentsErr;

    return NextResponse.json({
      success: true,
      studentsScheduled: scheduleRows.length,
      blocksUsed: blockCapacities.filter(b => b.filled > 0).length,
      assessmentsCreated: assessmentRows.length,
    });
  } catch (error) {
    console.error('Error generating OSCE roster:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate roster' }, { status: 500 });
  }
}
