import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';
import { normalizeQuestionType, CANONICAL_QUESTION_TYPES } from '@/lib/question-types';

// ---------------------------------------------------------------------------
// Helper - resolve current user from session email
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
// POST /api/cases/import - Import a case from raw JSON
//
// Validates the JSON structure, creates a new case record.
// Requires instructor+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Title is required and must be a non-empty string' }, { status: 400 });
    }

    if (body.phases !== undefined && !Array.isArray(body.phases)) {
      return NextResponse.json({ error: 'Phases must be an array' }, { status: 400 });
    }

    // Validate difficulty if provided
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (body.difficulty && !validDifficulties.includes(body.difficulty as string)) {
      return NextResponse.json(
        { error: `Difficulty must be one of: ${validDifficulties.join(', ')}` },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Normalise question types in phases & collect warnings
    // -----------------------------------------------------------------------
    const typeWarnings: string[] = [];
    if (Array.isArray(body.phases)) {
      for (const phase of body.phases as Array<Record<string, unknown>>) {
        if (!Array.isArray(phase.questions)) continue;
        for (const q of phase.questions as Array<Record<string, unknown>>) {
          if (!q.type || typeof q.type !== 'string') continue;
          const canonical = normalizeQuestionType(q.type as string);
          if (canonical) {
            // Auto-map to canonical type
            if (q.type !== canonical) {
              typeWarnings.push(`"${q.type}" → "${canonical}"`);
              q.type = canonical;
            }
          } else {
            // Unknown type — leave it but warn
            typeWarnings.push(
              `"${q.type}" is not a recognised question type (supported: ${CANONICAL_QUESTION_TYPES.join(', ')})`
            );
          }
        }
      }
    }

    const supabase = getSupabaseAdmin();

    // Build insert data - map JSON fields to DB columns
    const caseData = {
      title: (body.title as string).trim(),
      description: (body.description as string) || null,
      chief_complaint: (body.chief_complaint as string) || null,
      category: (body.category as string) || null,
      subcategory: (body.subcategory as string) || null,
      difficulty: (body.difficulty as string) || 'intermediate',
      applicable_programs: (body.applicable_programs as string[]) || ['Paramedic'],
      estimated_duration_minutes: (body.estimated_duration_minutes as number) || 30,
      patient_age: (body.patient_age as string) || null,
      patient_sex: (body.patient_sex as string) || null,
      patient_weight: (body.patient_weight as string) || null,
      patient_medical_history: (body.patient_medical_history as string[]) || [],
      patient_medications: (body.patient_medications as string[]) || [],
      patient_allergies: (body.patient_allergies as string) || null,
      dispatch_info: body.dispatch_info || {},
      scene_info: body.scene_info || {},
      phases: body.phases || [],
      variables: body.variables || {},
      learning_objectives: (body.learning_objectives as string[]) || [],
      critical_actions: (body.critical_actions as string[]) || [],
      common_errors: (body.common_errors as string[]) || [],
      debrief_points: (body.debrief_points as string[]) || [],
      equipment_needed: (body.equipment_needed as string[]) || [],
      author: (body.author as string) || currentUser.name,
      created_by: currentUser.id,
      visibility: 'private' as const,
      is_published: false,
      generated_by_ai: (body.generated_by_ai as boolean) || false,
      generation_prompt: (body.generation_prompt as string) || null,
    };

    const { data: imported, error: insertError } = await supabase
      .from('case_studies')
      .insert(caseData)
      .select('*')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      case: imported,
      ...(typeWarnings.length > 0 && {
        type_warnings: typeWarnings,
        message: `Import successful. ${typeWarnings.length} question type(s) were normalised or flagged.`,
      }),
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing case:', error);
    return NextResponse.json({ error: 'Failed to import case' }, { status: 500 });
  }
}
