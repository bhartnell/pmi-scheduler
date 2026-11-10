import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

// Per-student scenario control for a hand-loaded OSCE roster.
//
// GET  - roster rows with their assessment (if any) + active scenario letters.
// PUT  { schedule_id, scenario } - set/change one student's scenario. Creates the
//      osce_assessments row (student_name exactly as the roster stores it, day and
//      date from the block, slot_number = the roster slot within the block) or
//      updates it while it has no evaluator scores. A scored row is locked.
// POST { action: 'fill_empty' } - apply the event's osce_day_scenarios round-robin
//      ONLY to rows that still have no assessment. Nothing is assigned automatically;
//      the admin UI asks for a confirm first.
//
// slot_number: osce_student_schedule.slot_number is per block (generate-roster and
// the reorder route number from 1 within each block), and the assessment copies it.
// The evaluator dashboard orders by block, then the roster slot, so numbering that
// is per-event (the spring hand-load, 1-19) orders the same way.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const [{ data: roster }, { data: assessments }, { data: scenarios }] = await Promise.all([
      supabase.from('osce_student_schedule').select('id, student_name, time_block_id, slot_number').eq('event_id', id),
      supabase.from('osce_assessments').select('id, student_name, scenario').eq('event_id', id),
      supabase.from('osce_scenarios').select('scenario_letter, title').eq('is_active', true).order('scenario_letter'),
    ]);
    const ids = (assessments || []).map((a) => a.id);
    const scored = new Set<string>();
    if (ids.length > 0) {
      const { data: scores } = await supabase.from('osce_evaluator_scores').select('assessment_id').in('assessment_id', ids);
      for (const s of scores || []) scored.add(s.assessment_id);
    }
    const byName = new Map((assessments || []).map((a) => [a.student_name.trim().toUpperCase(), a]));
    const rows = (roster || []).map((r) => {
      const a = byName.get(r.student_name.trim().toUpperCase());
      return {
        schedule_id: r.id,
        student_name: r.student_name,
        time_block_id: r.time_block_id,
        slot_number: r.slot_number,
        assessment: a ? { id: a.id, scenario: a.scenario, locked: scored.has(a.id) } : null,
      };
    });
    return NextResponse.json({
      success: true,
      rows,
      scenarios: (scenarios || []).map((s) => ({ letter: s.scenario_letter, title: s.title })),
    });
  } catch (err) {
    console.error('student-scenarios GET:', err);
    return NextResponse.json({ success: false, error: 'Failed to load' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { schedule_id, scenario } = await req.json();
    if (!schedule_id || typeof scenario !== 'string' || !/^[A-F]$/.test(scenario)) {
      return NextResponse.json({ success: false, error: 'schedule_id and a scenario letter are required' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from('osce_student_schedule')
      .select('id, student_name, time_block_id, slot_number')
      .eq('id', schedule_id)
      .eq('event_id', id)
      .maybeSingle();
    if (!row) return NextResponse.json({ success: false, error: 'Student not found on this event' }, { status: 404 });
    const { data: block } = await supabase
      .from('osce_time_blocks')
      .select('day_number, date')
      .eq('id', row.time_block_id)
      .eq('event_id', id)
      .maybeSingle();
    if (!block) return NextResponse.json({ success: false, error: 'Time block not found' }, { status: 404 });
    const { data: active } = await supabase.from('osce_scenarios').select('scenario_letter').eq('scenario_letter', scenario).eq('is_active', true).maybeSingle();
    if (!active) return NextResponse.json({ success: false, error: 'Unknown or inactive scenario' }, { status: 400 });

    const { data: existing } = await supabase
      .from('osce_assessments')
      .select('id, scenario')
      .eq('event_id', id)
      .ilike('student_name', row.student_name.trim());
    if (existing && existing.length > 1) {
      return NextResponse.json({ success: false, error: 'More than one assessment matches this student; fix it by hand.' }, { status: 409 });
    }
    if (existing && existing.length === 1) {
      const { count } = await supabase.from('osce_evaluator_scores').select('id', { count: 'exact', head: true }).eq('assessment_id', existing[0].id);
      if ((count || 0) > 0) {
        return NextResponse.json({ success: false, error: 'This student already has scores, so the scenario is locked.' }, { status: 409 });
      }
      const { error } = await supabase
        .from('osce_assessments')
        .update({ scenario, day_number: block.day_number, assessment_date: block.date, slot_number: row.slot_number })
        .eq('id', existing[0].id);
      if (error) throw error;
      await logAuditEvent({ user: { email: auth.user.email, role: auth.user.role }, action: 'update', resourceType: 'scenario_assessment', resourceId: existing[0].id, resourceDescription: `OSCE scenario ${existing[0].scenario} -> ${scenario} for ${row.student_name}` });
      return NextResponse.json({ success: true, created: false });
    }
    const { data: created, error } = await supabase
      .from('osce_assessments')
      .insert({ event_id: id, student_name: row.student_name, scenario, slot_number: row.slot_number, day_number: block.day_number, assessment_date: block.date })
      .select('id')
      .single();
    if (error) throw error;
    await logAuditEvent({ user: { email: auth.user.email, role: auth.user.role }, action: 'create', resourceType: 'scenario_assessment', resourceId: created.id, resourceDescription: `OSCE scenario ${scenario} assigned to ${row.student_name}` });
    return NextResponse.json({ success: true, created: true });
  } catch (err) {
    console.error('student-scenarios PUT:', err);
    return NextResponse.json({ success: false, error: 'Failed to save scenario' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { action } = await req.json();
    if (action !== 'fill_empty') return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const [{ data: roster }, { data: blocks }, { data: assessments }, { data: dayRows }] = await Promise.all([
      supabase.from('osce_student_schedule').select('id, student_name, time_block_id, slot_number').eq('event_id', id),
      supabase.from('osce_time_blocks').select('id, day_number, date, sort_order').eq('event_id', id),
      supabase.from('osce_assessments').select('student_name').eq('event_id', id),
      supabase.from('osce_day_scenarios').select('day_number, scenario').eq('event_id', id),
    ]);
    const blockById = new Map((blocks || []).map((b) => [b.id, b]));
    const have = new Set((assessments || []).map((a) => a.student_name.trim().toUpperCase()));
    const byDay = new Map<number, string[]>();
    for (const r of dayRows || []) byDay.set(r.day_number, [...(byDay.get(r.day_number) || []), r.scenario]);
    const empty = (roster || [])
      .filter((r) => !have.has(r.student_name.trim().toUpperCase()) && blockById.has(r.time_block_id))
      .sort((a, b) => {
        const ba = blockById.get(a.time_block_id)!, bb = blockById.get(b.time_block_id)!;
        return ba.day_number - bb.day_number || (ba.sort_order ?? 0) - (bb.sort_order ?? 0) || a.slot_number - b.slot_number;
      });
    const cursor = new Map<number, number>();
    const inserts: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const r of empty) {
      const b = blockById.get(r.time_block_id)!;
      const list = byDay.get(b.day_number);
      if (!list || list.length === 0) { skipped++; continue; }
      const c = cursor.get(b.day_number) || 0;
      cursor.set(b.day_number, c + 1);
      inserts.push({ event_id: id, student_name: r.student_name, scenario: list[c % list.length], slot_number: r.slot_number, day_number: b.day_number, assessment_date: b.date });
    }
    if (inserts.length > 0) {
      const { error } = await supabase.from('osce_assessments').insert(inserts);
      if (error) throw error;
      await logAuditEvent({ user: { email: auth.user.email, role: auth.user.role }, action: 'create', resourceType: 'scenario_assessment', resourceId: id, resourceDescription: `OSCE fill-empty: ${inserts.length} assessments from day scenarios` });
    }
    return NextResponse.json({ success: true, created: inserts.length, skippedNoDayScenarios: skipped });
  } catch (err) {
    console.error('student-scenarios POST:', err);
    return NextResponse.json({ success: false, error: 'Failed to fill' }, { status: 500 });
  }
}
