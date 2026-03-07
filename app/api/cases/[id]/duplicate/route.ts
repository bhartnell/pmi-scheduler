import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';

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
// POST /api/cases/[id]/duplicate - Clone a case
//
// Creates a copy with title + " (Copy)", visibility=private, created_by=current user.
// Requires instructor+ role.
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch original case
    const { data: original, error: fetchError } = await supabase
      .from('case_studies')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Create the duplicate
    const duplicateData = {
      title: `${original.title} (Copy)`,
      description: original.description,
      chief_complaint: original.chief_complaint,
      category: original.category,
      subcategory: original.subcategory,
      difficulty: original.difficulty,
      applicable_programs: original.applicable_programs,
      estimated_duration_minutes: original.estimated_duration_minutes,
      patient_age: original.patient_age,
      patient_sex: original.patient_sex,
      patient_weight: original.patient_weight,
      patient_medical_history: original.patient_medical_history,
      patient_medications: original.patient_medications,
      patient_allergies: original.patient_allergies,
      dispatch_info: original.dispatch_info,
      scene_info: original.scene_info,
      phases: original.phases,
      variables: original.variables,
      learning_objectives: original.learning_objectives,
      critical_actions: original.critical_actions,
      common_errors: original.common_errors,
      debrief_points: original.debrief_points,
      equipment_needed: original.equipment_needed,
      author: currentUser.name,
      created_by: currentUser.id,
      visibility: 'private' as const,
      is_published: false,
      is_verified: false,
      community_rating: 0,
      usage_count: 0,
      flag_count: 0,
      generated_by_ai: original.generated_by_ai,
      generation_prompt: original.generation_prompt,
    };

    const { data: duplicate, error: insertError } = await supabase
      .from('case_studies')
      .insert(duplicateData)
      .select('*')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, case: duplicate }, { status: 201 });
  } catch (error) {
    console.error('Error duplicating case:', error);
    return NextResponse.json({ error: 'Failed to duplicate case' }, { status: 500 });
  }
}
