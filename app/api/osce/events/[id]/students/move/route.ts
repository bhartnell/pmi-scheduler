import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { planStudentMove, type MoveTarget } from '@/lib/osce-student-move';

// POST - Admin: move one student to any block/slot of this event (no hard locks, Ben 2026-11-11).
// Body: { scheduleId, blockId, slot?: number, mode?: 'slot' | 'end', swap?: boolean }
// The student's assessment follows (day, date, slot); scenario and scores are untouched.
// The student's calendar invite is NOT re-sent here; the Students tab flags it as not updated.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const body = await request.json();
    const { scheduleId, blockId, slot, mode, swap } = body as {
      scheduleId?: string; blockId?: string; slot?: number; mode?: 'slot' | 'end'; swap?: boolean;
    };
    if (!scheduleId || !blockId) {
      return NextResponse.json({ success: false, error: 'scheduleId and blockId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: blocks } = await supabase
      .from('osce_time_blocks')
      .select('id, day_number, date, label')
      .eq('event_id', id);
    const blockById = new Map((blocks || []).map(b => [b.id, b]));
    const targetBlock = blockById.get(blockId);
    if (!targetBlock) {
      return NextResponse.json({ success: false, error: 'Time block not found for this event' }, { status: 404 });
    }

    const { data: rows } = await supabase
      .from('osce_student_schedule')
      .select('id, student_name, time_block_id, slot_number')
      .eq('event_id', id);
    const all = rows || [];
    const moving = all.find(r => r.id === scheduleId);
    if (!moving) {
      return NextResponse.json({ success: false, error: 'Student not found in this event' }, { status: 404 });
    }

    const target: MoveTarget = mode === 'end'
      ? { mode: 'end', blockId }
      : { mode: 'slot', blockId, slot: Number(slot), swap: swap === true };
    const plan = planStudentMove(all, scheduleId, target);
    if (!plan.ok) {
      return NextResponse.json({ success: false, error: plan.error }, { status: 400 });
    }

    // Run the writes in order; if one fails, put every touched row back where it was.
    const original = new Map(all.map(r => [r.id, { time_block_id: r.time_block_id, slot_number: r.slot_number }]));
    const done: string[] = [];
    for (const w of plan.writes) {
      const { error } = await supabase
        .from('osce_student_schedule')
        .update({ time_block_id: w.time_block_id, slot_number: w.slot_number })
        .eq('id', w.id)
        .eq('event_id', id);
      if (error) {
        for (const rid of [...new Set(done)].reverse()) {
          const o = original.get(rid)!;
          await supabase.from('osce_student_schedule').update(o).eq('id', rid);
        }
        console.error('OSCE move failed, rolled back:', error);
        return NextResponse.json({ success: false, error: 'Move failed and was rolled back' }, { status: 500 });
      }
      done.push(w.id);
    }

    // Assessments follow their student's seat (scored or not). Scenario and scores are never touched.
    const movedIds = [scheduleId, ...(plan.swappedWithId ? [plan.swappedWithId] : [])];
    const { data: after } = await supabase
      .from('osce_student_schedule')
      .select('id, student_name, time_block_id, slot_number')
      .in('id', movedIds);
    const assessmentNotes: string[] = [];
    for (const r of after || []) {
      const blk = blockById.get(r.time_block_id);
      if (!blk) continue;
      const { data: found } = await supabase
        .from('osce_assessments')
        .select('id')
        .eq('event_id', id)
        .ilike('student_name', r.student_name.trim());
      if (found && found.length === 1) {
        await supabase
          .from('osce_assessments')
          .update({ slot_number: r.slot_number, day_number: blk.day_number, assessment_date: blk.date })
          .eq('id', found[0].id);
      } else if (found && found.length > 1) {
        assessmentNotes.push(`${r.student_name}: several assessments match, not updated`);
      }
    }

    // One audit row per moved student (who, student, from, to).
    const label = (bid: string) => blockById.get(bid)?.label || bid;
    for (const r of after || []) {
      const from = original.get(r.id)!;
      await logAuditEvent({
        user: { id: user.id, email: user.email, role: user.role },
        action: 'update',
        resourceType: 'osce_schedule',
        resourceId: r.id,
        resourceDescription: `OSCE student moved: ${r.student_name} from ${label(from.time_block_id)} slot ${from.slot_number} to ${label(r.time_block_id)} slot ${r.slot_number}${r.id !== scheduleId ? ' (swap)' : ''}`,
        metadata: {
          kind: 'osce_student_move',
          event_id: id,
          student_name: r.student_name,
          from: { block_id: from.time_block_id, slot: from.slot_number },
          to: { block_id: r.time_block_id, slot: r.slot_number },
          swapped_with: r.id !== scheduleId ? scheduleId : plan.swappedWithId,
          at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true, to: plan.to, swappedWithId: plan.swappedWithId, notes: assessmentNotes });
  } catch (error) {
    console.error('Error moving student:', error);
    return NextResponse.json({ success: false, error: 'Failed to move student' }, { status: 500 });
  }
}
