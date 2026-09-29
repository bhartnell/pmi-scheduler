import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * ACLS skills-station capture (Airway Management, Adult BLS, Peds BLS).
 *
 * Writes the existing, previously-unused `pals_skill_completions` table
 * (cert_course-scoped, one row per student per skill). Attestation-level:
 * pass / fail / remediated + verifier + initials/number. No schema change.
 *
 * GET  ?studentIds=a,b,c&certCourse=acls  → { completions[] }
 * POST { certCourse?, skillKey, marks: [{ studentId, status, remediationNotes? }] }
 *      Upserts on (student_id, skill_key, cert_course). The verifier is always
 *      the authenticated instructor (never client-supplied); initials/number
 *      come from their lab_users profile.
 */

const SKILLS = ['airway_management', 'adult_bls', 'peds_bls'] as const;
const COURSES = ['acls', 'pals'] as const;
const STATUSES = ['pass', 'fail', 'remediated'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const certCourse = sp.get('certCourse') || 'acls';
  const studentIds = (sp.get('studentIds') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!(COURSES as readonly string[]).includes(certCourse)) {
    return NextResponse.json({ success: false, error: 'invalid certCourse' }, { status: 400 });
  }
  if (!studentIds.length) return NextResponse.json({ success: true, completions: [] });

  const { data, error } = await getSupabaseAdmin()
    .from('pals_skill_completions')
    .select('id, student_id, skill_key, cert_course, status, verified_by, verified_at, instructor_initials, instructor_number, remediation_notes')
    .eq('cert_course', certCourse)
    .in('student_id', studentIds);
  if (error) {
    console.error('skill-completions GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to load skill completions' }, { status: 500 });
  }
  return NextResponse.json({ success: true, completions: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  const certCourse = body.certCourse || 'acls';
  const skillKey = body.skillKey;
  const marks: any[] = Array.isArray(body.marks) ? body.marks : [];
  if (!(COURSES as readonly string[]).includes(certCourse)) {
    return NextResponse.json({ success: false, error: 'invalid certCourse' }, { status: 400 });
  }
  if (!(SKILLS as readonly string[]).includes(skillKey)) {
    return NextResponse.json({ success: false, error: 'invalid skillKey' }, { status: 400 });
  }
  if (!marks.length || marks.length > 100) {
    return NextResponse.json({ success: false, error: 'marks must have 1-100 entries' }, { status: 400 });
  }
  for (const m of marks) {
    if (!m?.studentId || !(STATUSES as readonly string[]).includes(m.status)) {
      return NextResponse.json({ success: false, error: 'each mark needs studentId and a valid status' }, { status: 400 });
    }
    if (m.status !== 'pass' && !String(m.remediationNotes || '').trim()) {
      return NextResponse.json({ success: false, error: 'remediationNotes required for fail/remediated' }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from('lab_users')
    .select('name, aha_instructor_number')
    .eq('id', user.id)
    .single();
  const initials = (profile?.name || user.name || '')
    .split(/\s+/).filter(Boolean).map((p: string) => p[0].toUpperCase()).join('').slice(0, 4) || null;
  const now = new Date().toISOString();

  const rows = marks.map((m) => ({
    student_id: m.studentId,
    skill_key: skillKey,
    cert_course: certCourse,
    status: m.status,
    verified_by: user.id,
    verified_at: now,
    instructor_initials: initials,
    instructor_number: profile?.aha_instructor_number || null,
    remediation_notes: m.status === 'pass' ? null : String(m.remediationNotes).trim(),
    updated_at: now,
  }));

  const { data, error } = await supabase
    .from('pals_skill_completions')
    .upsert(rows, { onConflict: 'student_id,skill_key,cert_course' })
    .select('id, student_id, skill_key, cert_course, status, verified_by, verified_at, instructor_initials, instructor_number, remediation_notes');
  if (error) {
    console.error('skill-completions POST failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to save skill completions' }, { status: 500 });
  }
  return NextResponse.json({ success: true, completions: data || [] });
}
