import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';

/**
 * Cohort graduation (admin+). Reuses the existing per-student 'graduated'
 * status (see /api/students/[id]/graduate) rather than a second "completed"
 * status; no schema change.
 *
 *   GET  -> preview: the students still 'active' that graduating would complete.
 *   POST -> { graduation_date?: "YYYY-MM-DD", undo?: boolean }
 *     graduate: cohorts.status='graduated', is_active=false, end_date=date;
 *               every still-active student becomes 'graduated' with that date
 *               (students who graduated or withdrew earlier are untouched).
 *     undo:     cohort back to active/is_active, end_date cleared; only the
 *               students THIS action graduated (tagged in student_cohort_history
 *               notes) go back to 'active' with graduation_date cleared.
 */

const NOTE_PREFIX = 'Cohort graduation';

async function requireAdmin() {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return { error: auth };
  const supabase = getSupabaseAdmin();
  const { data: caller } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', auth.session.user.email)
    .single();
  if (!caller || !hasMinRole(caller.role, 'admin')) {
    return {
      error: NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 }),
    };
  }
  return { auth, role: caller.role as string, supabase };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;
  const { id: cohortId } = await params;

  const { data: students, error } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')
    .order('last_name');
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, active_students: students ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { auth, role, supabase } = gate;
  const { id: cohortId } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      graduation_date?: string;
      undo?: boolean;
    };
    const date = body.graduation_date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'graduation_date must be YYYY-MM-DD' }, { status: 400 });
    }

    const { data: cohort, error: cohortErr } = await supabase
      .from('cohorts')
      .select('id, cohort_number, status, is_active, end_date, program:programs(abbreviation)')
      .eq('id', cohortId)
      .single();
    if (cohortErr || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    let affected: { id: string; previous_status: string }[] = [];

    if (body.undo) {
      if (cohort.status !== 'graduated') {
        return NextResponse.json({ error: 'Cohort is not graduated' }, { status: 400 });
      }
      // Only students this action graduated, still graduated on the cohort's date.
      const { data: hist } = await supabase
        .from('student_cohort_history')
        .select('student_id')
        .eq('from_cohort_id', cohortId)
        .eq('event_type', 'graduation')
        .like('notes', `${NOTE_PREFIX}%`);
      const ids = [...new Set((hist ?? []).map((h: { student_id: string }) => h.student_id))];
      if (ids.length > 0) {
        const { data: restored, error: restoreErr } = await supabase
          .from('students')
          .update({ status: 'active', graduation_date: null })
          .in('id', ids)
          .eq('cohort_id', cohortId)
          .eq('status', 'graduated')
          .eq('graduation_date', cohort.end_date)
          .select('id');
        if (restoreErr) throw restoreErr;
        affected = (restored ?? []).map((r: { id: string }) => ({ id: r.id, previous_status: 'graduated' }));
        if (affected.length > 0) {
          await supabase
            .from('student_program_enrollments')
            .update({ status: 'active', end_date: null, updated_at: nowIso })
            .in('student_id', affected.map(a => a.id))
            .eq('status', 'graduated')
            .eq('end_date', cohort.end_date);
        }
      }
      const { error: upErr } = await supabase
        .from('cohorts')
        .update({ status: 'active', is_active: true, end_date: null })
        .eq('id', cohortId);
      if (upErr) throw upErr;
    } else {
      if (cohort.status === 'graduated') {
        return NextResponse.json({ error: 'Cohort is already graduated' }, { status: 400 });
      }
      const { data: active, error: actErr } = await supabase
        .from('students')
        .select('id, status')
        .eq('cohort_id', cohortId)
        .eq('status', 'active');
      if (actErr) throw actErr;
      affected = (active ?? []).map((s: { id: string; status: string }) => ({
        id: s.id,
        previous_status: s.status,
      }));

      // Cohort first: if the student update fails the cohort is simply
      // graduated with its roster still active, which the retry/undo covers.
      const { error: upErr } = await supabase
        .from('cohorts')
        .update({ status: 'graduated', is_active: false, end_date: date })
        .eq('id', cohortId);
      if (upErr) throw upErr;

      if (affected.length > 0) {
        const ids = affected.map(a => a.id);
        const { error: stuErr } = await supabase
          .from('students')
          .update({ status: 'graduated', graduation_date: date })
          .in('id', ids)
          .eq('status', 'active');
        if (stuErr) throw stuErr;

        const { error: enrErr } = await supabase
          .from('student_program_enrollments')
          .update({ status: 'graduated', end_date: date, updated_at: nowIso })
          .in('student_id', ids)
          .eq('status', 'active');
        if (enrErr) console.error('[cohort graduate] enrollment close failed', enrErr);

        const { error: histErr } = await supabase.from('student_cohort_history').insert(
          ids.map(studentId => ({
            student_id: studentId,
            from_cohort_id: cohortId,
            to_cohort_id: cohortId,
            previous_status: 'active',
            new_status: 'graduated',
            event_type: 'graduation',
            notes: `${NOTE_PREFIX} ${date}`,
            transferred_by: auth.user.email,
          }))
        );
        if (histErr) console.error('[cohort graduate] history insert failed', histErr);
      }
    }

    try {
      const program = Array.isArray(cohort.program) ? cohort.program[0] : cohort.program;
      await logAuditEvent({
        user: { email: auth.user.email, role },
        action: 'student_group_changed',
        resourceType: 'cohort',
        resourceId: cohortId,
        resourceDescription: `${program?.abbreviation ?? ''} Group ${cohort.cohort_number} ${body.undo ? 'un-graduated' : 'graduated'}`,
        metadata: {
          event_type: body.undo ? 'cohort_ungraduate' : 'cohort_graduate',
          graduation_date: body.undo ? null : date,
          student_count: affected.length,
        },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ success: true, students_affected: affected.length });
  } catch (error) {
    console.error('[cohort graduate] error', error);
    return NextResponse.json({ success: false, error: 'Failed to update cohort' }, { status: 500 });
  }
}
