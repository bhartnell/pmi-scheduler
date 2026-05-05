import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cascadeFromS1Start } from '@/lib/semester-cascade';

/**
 * PUT /api/admin/academic-years/[id]
 *
 * Update an existing academic year. Two modes:
 *
 *   1. recalculate=true with new s1_start_date → wipes and re-derives
 *      all four linked semesters from the cascade (operator confirms
 *      this in a "Recalculate from S1 start" flow).
 *
 *   2. semester_updates[] → update individual linked semester rows
 *      (per-row name / start_date / end_date overrides). Useful for
 *      one-off adjustments without re-running the whole cascade.
 *
 * Body:
 *   { year?: number,
 *     s1_start_date?: string,
 *     notes?: string,
 *     recalculate?: boolean,
 *     semester_updates?: Array<{
 *       id?: string,            // existing pmi_semesters row id
 *       semester_number?: 1|2|3|4,
 *       name?: string,
 *       start_date?: string,
 *       end_date?: string,
 *     }>,
 *   }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: {
    year?: number;
    s1_start_date?: string;
    notes?: string;
    recalculate?: boolean;
    semester_updates?: Array<{
      id?: string;
      semester_number?: 1 | 2 | 3 | 4;
      name?: string;
      start_date?: string;
      end_date?: string;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Update the year row first if any year-level fields changed.
  const yearPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.year !== undefined) yearPatch.year = body.year;
  if (body.s1_start_date !== undefined) yearPatch.s1_start_date = body.s1_start_date;
  if (body.notes !== undefined) yearPatch.notes = body.notes;

  const { data: yearRow, error: yErr } = await supabase
    .from('pmi_academic_years')
    .update(yearPatch)
    .eq('id', id)
    .select('*')
    .single();
  if (yErr || !yearRow) {
    return NextResponse.json(
      { error: yErr?.message || 'Academic year not found' },
      { status: yErr?.code === 'PGRST116' ? 404 : 500 }
    );
  }

  // Mode 1: recalculate. Re-derive all 4 semesters from the
  // (possibly new) s1_start_date and upsert.
  if (body.recalculate) {
    const cascade = cascadeFromS1Start(yearRow.s1_start_date, yearRow.year);
    const rows = cascade.semesters.map(s => ({
      academic_year_id: yearRow.id,
      semester_number: s.number,
      name: s.name,
      start_date: s.start_date,
      end_date: s.end_date,
      is_active: true,
    }));
    const { data: semRows, error: sErr } = await supabase
      .from('pmi_semesters')
      .upsert(rows, { onConflict: 'academic_year_id,semester_number' })
      .select('*');
    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      year: yearRow,
      semesters: (semRows ?? []).sort(
        (a, b) => (a.semester_number ?? 0) - (b.semester_number ?? 0)
      ),
      breaks: cascade.breaks,
      mode: 'recalculate',
    });
  }

  // Mode 2: per-row updates. Operator hand-edited a single semester
  // window — apply just those changes.
  if (body.semester_updates && body.semester_updates.length > 0) {
    const errors: string[] = [];
    for (const u of body.semester_updates) {
      const patch: Record<string, unknown> = {};
      if (u.name !== undefined) patch.name = u.name;
      if (u.start_date !== undefined) patch.start_date = u.start_date;
      if (u.end_date !== undefined) patch.end_date = u.end_date;
      if (Object.keys(patch).length === 0) continue;

      const target = u.id
        ? supabase.from('pmi_semesters').update(patch).eq('id', u.id)
        : supabase
            .from('pmi_semesters')
            .update(patch)
            .eq('academic_year_id', yearRow.id)
            .eq('semester_number', u.semester_number ?? 0);

      const { error: uErr } = await target;
      if (uErr) {
        errors.push(`semester ${u.id ?? `S${u.semester_number}`}: ${uErr.message}`);
      }
    }

    const { data: semRows } = await supabase
      .from('pmi_semesters')
      .select('*')
      .eq('academic_year_id', yearRow.id)
      .order('semester_number', { ascending: true });

    return NextResponse.json({
      success: errors.length === 0,
      year: yearRow,
      semesters: semRows ?? [],
      errors: errors.length > 0 ? errors : undefined,
      mode: 'updates',
    });
  }

  // No semester-level changes — just return the updated year row.
  return NextResponse.json({ success: true, year: yearRow });
}

/**
 * DELETE /api/admin/academic-years/[id]
 *
 * Soft delete: nulls academic_year_id on linked semesters then
 * removes the year anchor row. Linked semester rows themselves are
 * NOT deleted because they may still be referenced by
 * pmi_program_schedules / pmi_schedule_blocks.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // ON DELETE SET NULL on the FK already handles unlinking, but be
  // explicit so the operator sees the count. Supabase wants the
  // count option on the .update() call, not .select().
  const { count: unlinked } = await supabase
    .from('pmi_semesters')
    .update({ academic_year_id: null }, { count: 'exact' })
    .eq('academic_year_id', id);

  const { error: dErr } = await supabase
    .from('pmi_academic_years')
    .delete()
    .eq('id', id);
  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, semesters_unlinked: unlinked ?? 0 });
}
