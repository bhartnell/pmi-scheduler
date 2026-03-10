import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { normalizeQuestionType } from '@/lib/question-types';

// ---------------------------------------------------------------------------
// Helper — resolve current user from session email
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
// GET /api/cases/[id]
//
// Fetch a single case study by ID. Accessible to any authenticated user,
// but critical_actions are hidden from students.
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: caseStudy, error } = await supabase
      .from('case_studies')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    // Check access: owner can always see their own; published/community/official are public;
    // private cases require ownership or admin role
    const isOwner = caseStudy.created_by === currentUser.id;
    const isInstructor = hasMinRole(currentUser.role, 'instructor');
    const isPublic = caseStudy.is_published || ['community', 'official'].includes(caseStudy.visibility);

    if (!isOwner && !isPublic && !hasMinRole(currentUser.role, 'admin')) {
      // Program visibility: instructors can see
      if (caseStudy.visibility === 'program' && isInstructor) {
        // ok
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Hide critical_actions from students
    const isStudent = currentUser.role === 'student';
    const responseCase = { ...caseStudy };
    if (isStudent) {
      responseCase.critical_actions = [];
      responseCase.common_errors = [];
      responseCase.instructor_only = true;
    }

    return NextResponse.json({
      success: true,
      case: responseCase,
      userRole: currentUser.role,
      isOwner,
    });
  } catch (error) {
    console.error('Error fetching case study:', error);
    return NextResponse.json({ error: 'Failed to fetch case study' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/cases/[id]
//
// Update a case study. Only the case owner or admin+ can update.
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Check case exists and user has edit permission
    const { data: existing, error: fetchError } = await supabase
      .from('case_studies')
      .select('id, created_by')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    const isOwner = existing.created_by === currentUser.id;
    if (!isOwner && !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Only the case author or admin can edit' }, { status: 403 });
    }

    const body = await request.json();

    // Build update object — only allow known fields
    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'title', 'description', 'chief_complaint', 'category', 'subcategory',
      'difficulty', 'applicable_programs', 'estimated_duration_minutes',
      'patient_age', 'patient_sex', 'patient_weight', 'patient_medical_history',
      'patient_medications', 'patient_allergies',
      'dispatch_info', 'scene_info', 'phases', 'variables',
      'learning_objectives', 'critical_actions', 'common_errors',
      'debrief_points', 'equipment_needed',
      'visibility', 'is_published', 'author',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Normalise question types when phases are updated
    if (updates.phases && Array.isArray(updates.phases)) {
      for (const phase of updates.phases as Array<Record<string, unknown>>) {
        if (!Array.isArray(phase.questions)) continue;
        for (const q of phase.questions as Array<Record<string, unknown>>) {
          if (q.type && typeof q.type === 'string') {
            const canonical = normalizeQuestionType(q.type as string);
            if (canonical) q.type = canonical;
          }
        }
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('case_studies')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, case: data });
  } catch (error) {
    console.error('Error updating case study:', error);
    return NextResponse.json({ error: 'Failed to update case study' }, { status: 500 });
  }
}
