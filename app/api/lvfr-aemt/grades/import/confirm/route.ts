import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAgencyRole, canEditLVFR } from '@/lib/permissions';
import { logRecordAccess } from '@/lib/ferpa';
import { logAuditEvent } from '@/lib/audit';

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/grades/import/confirm
//
// Confirm and insert previewed grades from CSV import.
// Body: {
//   grades: [{ student_id, assessment_id, score_percent, questions_correct?, questions_total? }],
//   updateExisting: boolean,
//   studentIdMappings?: [{ csvId: string, studentId: string }]
// }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (isAgencyRole(user.role)) {
    return NextResponse.json({ error: 'Agency roles are read-only' }, { status: 403 });
  }
  if (!canEditLVFR(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { grades, updateExisting, studentIdMappings } = body;

  if (!grades || !Array.isArray(grades) || grades.length === 0) {
    return NextResponse.json({ error: 'grades array is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch all assessments for pass_score lookup
  const { data: assessments } = await supabase
    .from('lvfr_aemt_assessments')
    .select('id, pass_score');
  const passScoreMap = new Map<string, number>();
  for (const a of assessments || []) {
    passScoreMap.set(a.id, a.pass_score ?? 80);
  }

  // Fetch existing grades if not updating
  let existingSet = new Set<string>();
  if (!updateExisting) {
    const { data: existing } = await supabase
      .from('lvfr_aemt_grades')
      .select('student_id, assessment_id');
    for (const e of existing || []) {
      existingSet.add(`${e.student_id}::${e.assessment_id}`);
    }
  }

  const results: { status: 'imported' | 'updated' | 'skipped' | 'failed'; message?: string }[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const grade of grades) {
    const { student_id, assessment_id, score_percent, questions_correct, questions_total } = grade;

    if (!student_id || !assessment_id || score_percent == null) {
      results.push({ status: 'failed', message: 'Missing required fields' });
      failed++;
      continue;
    }

    const passScore = passScoreMap.get(assessment_id) ?? 80;
    const passed = score_percent >= passScore;
    const key = `${student_id}::${assessment_id}`;
    const isExisting = existingSet.has(key);

    if (isExisting && !updateExisting) {
      results.push({ status: 'skipped', message: 'Grade already exists' });
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('lvfr_aemt_grades')
      .upsert(
        {
          student_id,
          assessment_id,
          date_taken: new Date().toISOString().split('T')[0],
          score_percent,
          passed,
          questions_correct: questions_correct || null,
          questions_total: questions_total || null,
          source: 'emstesting_import',
          imported_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,assessment_id' }
      );

    if (error) {
      results.push({ status: 'failed', message: error.message });
      failed++;
    } else if (isExisting) {
      results.push({ status: 'updated' });
      updated++;
    } else {
      results.push({ status: 'imported' });
      imported++;
    }
  }

  // Backfill emstesting_id on students if mappings provided
  if (studentIdMappings && Array.isArray(studentIdMappings)) {
    for (const mapping of studentIdMappings) {
      if (mapping.csvId && mapping.studentId) {
        await supabase
          .from('students')
          .update({ emstesting_id: mapping.csvId })
          .eq('id', mapping.studentId)
          .is('emstesting_id', null); // only set if not already set
      }
    }
  }

  // Audit logging
  logRecordAccess({
    userEmail: user.email,
    userRole: user.role,
    dataType: 'grades',
    action: 'modify',
    route: '/api/lvfr-aemt/grades/import/confirm',
    details: { imported, updated, skipped, failed, total: grades.length },
  }).catch(() => {});

  logAuditEvent({
    user: { id: user.id, email: user.email, role: user.role },
    action: 'create',
    resourceType: 'student',
    resourceDescription: `CSV grade import: ${imported} imported, ${updated} updated, ${skipped} skipped, ${failed} failed`,
    metadata: { imported, updated, skipped, failed, total: grades.length },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    summary: { imported, updated, skipped, failed, total: grades.length },
    results,
  });
}
