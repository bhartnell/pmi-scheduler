import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Helper – resolve current user
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// POST /api/admin/skill-drills/seed
//
// Seeds skill drills from data/s3_skill_drills.json.
// No request body needed — reads from project data file.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST() {
  // Standard auth check (session + admin role)
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentUser = await getCurrentUser(session.user.email);
  if (!currentUser || !canAccessAdmin(currentUser.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const filePath = path.join(process.cwd(), 'data', 's3_skill_drills.json');
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'S3 skill drills data file not found' }, { status: 404 });
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const payload = JSON.parse(raw);
  const { program, semester, skill_drills } = payload;

  const supabase = getSupabaseAdmin();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const drill of skill_drills) {
    try {
      // Map flat fields
      const name = drill.station_name;
      const description = (drill.objective && drill.objective[0]) || drill.station_name;
      const category = drill.category;
      const equipment_needed = drill.equipment || [];
      const estimated_duration =
        drill.duration_per_rotation_minutes || drill.duration_per_student_minutes || 15;
      const format = drill.format;
      const station_id = drill.station_id;

      // Build drill_data JSONB with ALL rich content
      const drill_data: Record<string, unknown> = {};

      // Always include these if present
      const richFields = [
        'objective',
        'roles',
        'student_instructions',
        'instructor_guide',
        'rhythm_cases',
        'case_bank',
        'scenario_cards',
        'key_observations',
        'common_errors',
        'stress_layers',
        'minicode_phase_overlay',
        'question_bank',
        'skills_rotated',
        'completion_criteria',
        'result_options',
        'needs_review_flags',
      ];
      for (const field of richFields) {
        if (drill[field] !== undefined && drill[field] !== null) {
          drill_data[field === 'objective' ? 'objectives' : field] = drill[field];
        }
      }

      // Duration-specific fields
      const durationFields = [
        'cases_per_rotation',
        'rotation_interval_minutes',
        'response_window_seconds',
        'skill_time_limit_minutes',
        'questions_per_attempt',
        'time_target_minutes',
        'cards_per_session',
        'time_target_hemorrhage_control_seconds',
        'time_target_packing_complete_minutes',
        'duration_per_rotation_minutes',
        'duration_per_student_minutes',
      ];
      for (const field of durationFields) {
        if (drill[field] !== undefined) drill_data[field] = drill[field];
      }

      // Check if exists by station_id
      const { data: existing } = await supabase
        .from('skill_drills')
        .select('id')
        .eq('station_id', station_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('skill_drills')
          .update({
            name,
            description,
            category,
            equipment_needed,
            estimated_duration,
            format,
            program,
            semester,
            drill_data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        updated++;
      } else {
        const { error } = await supabase.from('skill_drills').insert({
          name,
          description,
          category,
          equipment_needed,
          estimated_duration,
          instructions: description,
          format,
          program,
          semester,
          station_id,
          drill_data,
          created_by: 'system',
          is_active: true,
        });
        if (error) throw error;
        created++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${drill.station_id}: ${msg}`);
    }
  }

  return NextResponse.json({
    success: true,
    created,
    updated,
    total: skill_drills.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
