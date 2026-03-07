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
// GET /api/cases - List cases with filters
//
// Query params:
//   category, subcategory, difficulty, program, visibility, search,
//   created_by, is_published, sort, order, limit, offset
//
// Instructor+: sees all published + own cases + community cases
// Student: sees only published/official cases + cases assigned to cohort
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const difficulty = searchParams.get('difficulty');
    const program = searchParams.get('program');
    const visibility = searchParams.get('visibility');
    const search = searchParams.get('search');
    const createdBy = searchParams.get('created_by');
    const isPublished = searchParams.get('is_published');
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const isInstructor = hasMinRole(currentUser.role, 'instructor');
    const isStudent = currentUser.role === 'student';

    // Build query
    let query = supabase
      .from('case_studies')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Role-based visibility filtering
    if (isStudent) {
      // Students see only published/official cases
      query = query.or('is_published.eq.true,visibility.eq.official');
    } else if (isInstructor) {
      // Instructors see published, community, official, and their own private cases
      if (createdBy === 'me' || createdBy === currentUser.id) {
        // "My Cases" tab - show all of this user's cases
        query = query.eq('created_by', currentUser.id);
      } else if (visibility === 'official') {
        query = query.eq('visibility', 'official');
      } else if (visibility === 'community') {
        query = query.eq('visibility', 'community');
      } else {
        // Default: show published + community + official + own private cases
        query = query.or(
          `is_published.eq.true,visibility.eq.official,visibility.eq.community,created_by.eq.${currentUser.id}`
        );
      }
    }

    // Apply filters
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (subcategory && subcategory !== 'all') {
      query = query.eq('subcategory', subcategory);
    }

    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', difficulty);
    }

    if (program) {
      query = query.contains('applicable_programs', [program]);
    }

    if (isPublished === 'true') {
      query = query.eq('is_published', true);
    } else if (isPublished === 'false') {
      query = query.eq('is_published', false);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,chief_complaint.ilike.%${search}%`
      );
    }

    // Sorting
    const validSortFields = ['title', 'created_at', 'difficulty', 'usage_count', 'community_rating', 'estimated_duration_minutes'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const ascending = order === 'asc';
    query = query.order(sortField, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // For students, also check assigned cases via case_assignments
    let assignedCaseIds: string[] = [];
    if (isStudent) {
      try {
        // Find the student record
        const { data: studentRecord } = await supabase
          .from('students')
          .select('id, cohort_id')
          .ilike('email', session.user.email)
          .single();

        if (studentRecord?.cohort_id) {
          const { data: assignments } = await supabase
            .from('case_assignments')
            .select('case_id')
            .eq('cohort_id', studentRecord.cohort_id)
            .eq('is_active', true);

          assignedCaseIds = (assignments || []).map((a: { case_id: string }) => a.case_id);
        }
      } catch {
        // Students table may not have email column, ignore
      }
    }

    return NextResponse.json({
      success: true,
      cases: data || [],
      assignedCaseIds,
      pagination: {
        limit,
        offset,
        total: count || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching cases:', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/cases - Create a new case study
//
// Requires instructor+ role.
// Accepts full case JSON, sets created_by to current user's lab_users id.
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

    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (body.phases !== undefined && !Array.isArray(body.phases)) {
      return NextResponse.json({ error: 'Phases must be an array' }, { status: 400 });
    }

    // Validate difficulty if provided
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (body.difficulty && !validDifficulties.includes(body.difficulty)) {
      return NextResponse.json(
        { error: `Difficulty must be one of: ${validDifficulties.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate visibility if provided
    const validVisibilities = ['private', 'program', 'community', 'official'];
    if (body.visibility && !validVisibilities.includes(body.visibility)) {
      return NextResponse.json(
        { error: `Visibility must be one of: ${validVisibilities.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const caseData = {
      title: body.title.trim(),
      description: body.description || null,
      chief_complaint: body.chief_complaint || null,
      category: body.category || null,
      subcategory: body.subcategory || null,
      difficulty: body.difficulty || 'intermediate',
      applicable_programs: body.applicable_programs || ['Paramedic'],
      estimated_duration_minutes: body.estimated_duration_minutes || 30,
      patient_age: body.patient_age || null,
      patient_sex: body.patient_sex || null,
      patient_weight: body.patient_weight || null,
      patient_medical_history: body.patient_medical_history || [],
      patient_medications: body.patient_medications || [],
      patient_allergies: body.patient_allergies || null,
      dispatch_info: body.dispatch_info || {},
      scene_info: body.scene_info || {},
      phases: body.phases || [],
      variables: body.variables || {},
      learning_objectives: body.learning_objectives || [],
      critical_actions: body.critical_actions || [],
      common_errors: body.common_errors || [],
      debrief_points: body.debrief_points || [],
      equipment_needed: body.equipment_needed || [],
      author: body.author || currentUser.name,
      created_by: currentUser.id,
      visibility: body.visibility || 'private',
      is_published: body.is_published || false,
      generated_by_ai: body.generated_by_ai || false,
      generation_prompt: body.generation_prompt || null,
    };

    const { data: newCase, error: insertError } = await supabase
      .from('case_studies')
      .insert(caseData)
      .select('*')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, case: newCase }, { status: 201 });
  } catch (error) {
    console.error('Error creating case:', error);
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
