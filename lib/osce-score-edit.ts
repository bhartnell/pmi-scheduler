// OSCE: edit-after-submit support (Ben 2026-11-11, "no hard locks").
// Pure helpers (diffing, field whitelist) plus audit + lookup helpers. No schema change:
// post-submit edits are recorded in audit_log (resource_type 'osce_score').

export const OSCE_EDIT_KIND = 'osce_edit_after_submit';

// Columns an evaluator may never change through the score PUT.
const PROTECTED_FIELDS = ['id', 'assessment_id', 'evaluator_name', 'created_at', 'updated_at', 'submitted_at', 'edit_after_submit'];

export function stripProtectedFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!PROTECTED_FIELDS.includes(k)) out[k] = v;
  }
  return out;
}

const norm = (v: unknown) => (v === undefined || v === null || v === '' ? null : v);

export type FieldChange = { old: unknown; new: unknown };

/** Fields in `incoming` whose value differs from `existing` (null and '' count as equal). */
export function diffScoreFields(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (norm(existing[k]) !== norm(v)) changes[k] = { old: norm(existing[k]), new: norm(v) };
  }
  return changes;
}

export async function logOsceEditAfterSubmit(args: {
  assessmentId: string;
  studentName?: string | null;
  evaluatorName: string;
  event: 'field_edit' | 'resubmit';
  changes: Record<string, FieldChange>;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit'); // lazy: keeps the pure helpers unit-testable
  const fieldList = Object.keys(args.changes).join(', ');
  await logAuditEvent({
    user: { role: 'osce_evaluator' },
    action: 'update',
    resourceType: 'osce_score',
    resourceId: args.assessmentId,
    resourceDescription:
      `OSCE score ${args.event === 'resubmit' ? 're-submitted' : 'edited'} after submit by ${args.evaluatorName}` +
      (args.studentName ? ` for ${args.studentName}` : '') +
      (fieldList ? ` (${fieldList})` : ''),
    metadata: {
      kind: OSCE_EDIT_KIND,
      event: args.event,
      assessment_id: args.assessmentId,
      student_name: args.studentName ?? null,
      evaluator_name: args.evaluatorName,
      at: new Date().toISOString(),
      changes: args.changes,
    },
  });
}

export interface EditLogEntry {
  evaluator_name: string;
  at: string;
  event: string;
  changes: Record<string, FieldChange>;
}

/** assessment_id -> edit-after-submit entries (oldest first). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadEditLog(supabase: any, assessmentIds: string[]): Promise<Map<string, EditLogEntry[]>> {
  const map = new Map<string, EditLogEntry[]>();
  if (assessmentIds.length === 0) return map;
  const { data } = await supabase
    .from('audit_log')
    .select('resource_id, metadata, created_at')
    .eq('resource_type', 'osce_score')
    .in('resource_id', assessmentIds)
    .order('created_at', { ascending: true });
  for (const row of data || []) {
    const m = row.metadata;
    if (!m || m.kind !== OSCE_EDIT_KIND) continue;
    const list = map.get(row.resource_id) || [];
    list.push({ evaluator_name: m.evaluator_name, at: m.at || row.created_at, event: m.event, changes: m.changes || {} });
    map.set(row.resource_id, list);
  }
  return map;
}
