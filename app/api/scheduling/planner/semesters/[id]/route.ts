import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * GET /api/scheduling/planner/semesters/[id]
 *
 * Returns the semester row + the list of cohorts currently scheduled
 * in it (joined via pmi_program_schedules) annotated with whether
 * each cohort has a cohort_semester_overrides row for this semester.
 *
 * Powers the "When a semester date changes, which cohorts should I
 * update?" dialog — the UI groups by has_override so the operator
 * can default-select cohorts WITHOUT overrides and consciously opt
 * into changing the cohorts that DO.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: semester, error: sErr } = await supabase
      .from('pmi_semesters')
      .select('*')
      .eq('id', id)
      .single();
    if (sErr || !semester) {
      return NextResponse.json(
        { error: sErr?.message || 'Semester not found' },
        { status: 404 }
      );
    }

    // Find cohorts via pmi_program_schedules (one row per cohort+
    // semester pairing) — the canonical "scheduled in" relationship.
    const { data: schedules, error: pErr } = await supabase
      .from('pmi_program_schedules')
      .select(`
        cohort_id,
        cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
          id, cohort_number,
          program:programs(id, name, abbreviation)
        )
      `)
      .eq('semester_id', id);
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const cohortIds = Array.from(
      new Set((schedules ?? []).map(s => s.cohort_id).filter(Boolean))
    ) as string[];

    let overrideByCohort = new Map<string, { start_date: string; end_date: string }>();
    if (cohortIds.length > 0) {
      const { data: overrides } = await supabase
        .from('cohort_semester_overrides')
        .select('cohort_id, start_date, end_date')
        .eq('semester_id', id)
        .in('cohort_id', cohortIds);
      overrideByCohort = new Map(
        (overrides ?? []).map(o => [
          o.cohort_id as string,
          { start_date: o.start_date as string, end_date: o.end_date as string },
        ])
      );
    }

    const cohortRows = (schedules ?? []).map(s => {
      const cohort = Array.isArray(s.cohort) ? s.cohort[0] : s.cohort;
      const program = cohort
        ? Array.isArray(cohort.program)
          ? cohort.program[0]
          : cohort.program
        : null;
      const override = overrideByCohort.get(s.cohort_id);
      return {
        cohort_id: s.cohort_id,
        cohort_number: cohort?.cohort_number ?? null,
        program_abbreviation: program?.abbreviation ?? null,
        program_name: program?.name ?? null,
        has_override: !!override,
        override_start_date: override?.start_date ?? null,
        override_end_date: override?.end_date ?? null,
      };
    });

    return NextResponse.json({ semester, cohorts: cohortRows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Get semester detail error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.end_date !== undefined) updates.end_date = body.end_date;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const supabase = getSupabaseAdmin();

    let data: unknown = null;
    if (Object.keys(updates).length > 0) {
      const { data: updated, error } = await supabase
        .from('pmi_semesters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      data = updated;
    } else {
      const { data: existing, error } = await supabase
        .from('pmi_semesters')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      data = existing;
    }

    // Per-cohort manual start/stop windows — the mechanism a cohort
    // that runs off the standard calendar (or bridges two semesters
    // by a week or two) uses instead of pinning individual blocks to
    // a specific_date. Upserts rely on the (cohort_id, semester_id)
    // unique constraint, so setting a window twice for the same
    // cohort+semester just updates it. The resolver in
    // lib/planner-semester.ts reads this table first on every block
    // create/update, so this takes effect immediately — no need to
    // touch existing blocks.
    let overridesUpserted = 0;
    let overrideUpsertError: string | null = null;
    if (
      Array.isArray(body.upsert_cohort_overrides) &&
      body.upsert_cohort_overrides.length > 0
    ) {
      const rows = body.upsert_cohort_overrides
        .filter(
          (o: Record<string, unknown>) =>
            o && typeof o.cohort_id === 'string' &&
            typeof o.start_date === 'string' &&
            typeof o.end_date === 'string'
        )
        .map((o: Record<string, unknown>) => ({
          cohort_id: o.cohort_id,
          semester_id: id,
          start_date: o.start_date,
          end_date: o.end_date,
          notes: typeof o.notes === 'string' ? o.notes : null,
          updated_at: new Date().toISOString(),
        }));
      if (rows.length > 0) {
        const { data: upserted, error: uErr } = await supabase
          .from('cohort_semester_overrides')
          .upsert(rows, { onConflict: 'cohort_id,semester_id', count: 'exact' })
          .select('id');
        if (uErr) {
          overrideUpsertError = uErr.message;
        } else {
          overridesUpserted = upserted?.length ?? 0;
        }
      }
    }

    // Optional cascade to cohorts: when the operator changes a
    // semester window AND wants previously-overridden cohorts to
    // pick up the new dates, they pass `delete_cohort_overrides`
    // with the cohort IDs they want re-aligned. The resolver in
    // lib/planner-semester.ts checks cohort_semester_overrides
    // first; deleting the override row makes the cohort fall
    // through to the new pmi_semesters dates without us having to
    // manually rewrite the override row to match.
    let overridesDeleted = 0;
    if (
      Array.isArray(body.delete_cohort_overrides) &&
      body.delete_cohort_overrides.length > 0
    ) {
      const { count, error: dErr } = await supabase
        .from('cohort_semester_overrides')
        .delete({ count: 'exact' })
        .eq('semester_id', id)
        .in('cohort_id', body.delete_cohort_overrides);
      if (dErr) {
        return NextResponse.json(
          { semester: data, override_delete_error: dErr.message },
          { status: 207 } // multi-status — semester saved, cascade partially failed
        );
      }
      overridesDeleted = count ?? 0;
    }

    if (overrideUpsertError) {
      return NextResponse.json(
        {
          semester: data,
          overrides_deleted: overridesDeleted,
          override_upsert_error: overrideUpsertError,
        },
        { status: 207 } // multi-status — semester saved, window upsert partially failed
      );
    }

    return NextResponse.json({
      semester: data,
      overrides_deleted: overridesDeleted,
      overrides_upserted: overridesUpserted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Update semester error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Soft delete
    const { error } = await supabase
      .from('pmi_semesters')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Delete semester error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
