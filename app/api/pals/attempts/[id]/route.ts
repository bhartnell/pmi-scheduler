import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getPalsAttemptRecord } from '@/lib/pals';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

// GET /api/pals/attempts/[id] -> read-only record of one PALS attempt with its steps
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const record = await getPalsAttemptRecord(id);
    if (!record) return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...record });
  } catch (error) {
    console.error('Error loading PALS attempt record:', error);
    return NextResponse.json({ success: false, error: 'Failed to load attempt' }, { status: 500 });
  }
}

const EDIT_FIELDS = ['result', 'watch', 'watch_note', 'performance_notes', 'remediation_notes'] as const;
const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// PATCH /api/pals/attempts/[id] -> instructor+ edits result, watch, watch note, performance and
// remediation notes of a saved attempt. Criterion results are not editable here. Each edit is
// written to the audit log with who, when, and before/after values.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const supabase = getSupabaseAdmin();
    const { data: before, error: bErr } = await supabase
      .from('pals_test_attempts')
      .select('id, result, watch, watch_note, performance_notes, remediation_notes, remediation_due_at, attempted_at')
      .eq('id', id)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!before) return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 });

    const update: Record<string, unknown> = {};
    if ('result' in body) {
      if (body.result !== 'PASS' && body.result !== 'NR') return NextResponse.json({ success: false, error: 'result must be PASS or NR' }, { status: 400 });
      update.result = body.result;
    }
    if ('watch' in body) update.watch = body.watch === true;
    if ('watch_note' in body) update.watch_note = clean(body.watch_note);
    if ('performance_notes' in body) update.performance_notes = clean(body.performance_notes);
    if ('remediation_notes' in body) update.remediation_notes = clean(body.remediation_notes);

    const finalResult = (update.result as string | undefined) ?? before.result;
    const finalWatch = 'watch' in update ? update.watch : before.watch;
    // Watch is a pass-but-watch flag: only meaningful on PASS; note only when watch is on.
    if (finalResult !== 'PASS') { update.watch = false; update.watch_note = null; }
    else if (!finalWatch) { update.watch_note = null; }
    // NR -> PASS ends the remediation clock; PASS -> NR restarts a 30-day clock.
    if (before.result === 'NR' && finalResult === 'PASS') update.remediation_due_at = null;
    if (before.result === 'PASS' && finalResult === 'NR' && !before.remediation_due_at) {
      update.remediation_due_at = new Date(Date.now() + 30 * 86400000).toISOString();
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ success: false, error: 'Nothing to change' }, { status: 400 });

    const { error: uErr } = await supabase.from('pals_test_attempts').update(update).eq('id', id);
    if (uErr) throw uErr;

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of [...EDIT_FIELDS, 'remediation_due_at'] as const) {
      if (k in update && (before as any)[k] !== update[k]) changed[k] = { from: (before as any)[k], to: update[k] };
    }
    await logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'update',
      resourceType: 'scenario_assessment',
      resourceId: id,
      resourceDescription: `PALS attempt edited from record page (${Object.keys(changed).join(', ') || 'no field change'})`,
      metadata: { module: 'pals', phase: 'edit', changed },
    });

    const record = await getPalsAttemptRecord(id);
    return NextResponse.json({ success: true, ...record, edited_by: user.name, edited_at: new Date().toISOString() });
  } catch (error) {
    console.error('Error editing PALS attempt:', error);
    return NextResponse.json({ success: false, error: 'Failed to save edit' }, { status: 500 });
  }
}
