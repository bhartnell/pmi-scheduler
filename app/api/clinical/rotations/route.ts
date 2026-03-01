import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function requireRole(minRole: string) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('role, email')
    .ilike('email', session.user.email)
    .single();

  if (!user || !hasMinRole(user.role, minRole as any)) {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, session };
}

// ─── GET: List rotation assignments ──────────────────────────────────────────
// Query params: cohort_id, site_id, start_date, end_date
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole('lead_instructor');
    if (auth.error) return auth.error;

    const supabase = getSupabaseAdmin();
    const { searchParams } = request.nextUrl;

    const cohortId = searchParams.get('cohort_id');
    const siteId = searchParams.get('site_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Build base query joining student and site info
    let query = supabase
      .from('clinical_rotations')
      .select(`
        id,
        student_id,
        site_id,
        rotation_date,
        shift_type,
        status,
        notes,
        assigned_by,
        created_at,
        updated_at,
        student:students(id, first_name, last_name, cohort_id),
        site:clinical_sites(id, name, abbreviation, system, max_students_per_day)
      `)
      .order('rotation_date', { ascending: true })
      .order('student_id', { ascending: true });

    if (siteId) {
      query = query.eq('site_id', siteId);
    }
    if (startDate) {
      query = query.gte('rotation_date', startDate);
    }
    if (endDate) {
      query = query.lte('rotation_date', endDate);
    }

    const { data: rotations, error } = await query;
    if (error) throw error;

    // If cohort filter, narrow down to students in that cohort
    let filtered = rotations || [];
    if (cohortId) {
      filtered = filtered.filter((r: any) => r.student?.cohort_id === cohortId);
    }

    return NextResponse.json({ success: true, rotations: filtered });
  } catch (error) {
    console.error('Error fetching rotations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch rotations' }, { status: 500 });
  }
}

// ─── POST: Create or update a rotation assignment ─────────────────────────────
// Body: { student_id, site_id, rotation_date, shift_type?, status?, notes?, assigned_by? }
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole('lead_instructor');
    if (auth.error) return auth.error;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { student_id, site_id, rotation_date, shift_type, status, notes } = body;

    if (!student_id || !site_id || !rotation_date) {
      return NextResponse.json(
        { success: false, error: 'student_id, site_id, and rotation_date are required' },
        { status: 400 }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rotation_date)) {
      return NextResponse.json(
        { success: false, error: 'rotation_date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Check site capacity: count existing rotations for this site on this date
    const { data: existingForSite, error: capacityError } = await supabase
      .from('clinical_rotations')
      .select('id, student_id')
      .eq('site_id', site_id)
      .eq('rotation_date', rotation_date)
      .neq('student_id', student_id); // exclude current student (for updates)

    if (capacityError) throw capacityError;

    // Get site capacity
    const { data: site } = await supabase
      .from('clinical_sites')
      .select('max_students_per_day, name')
      .eq('id', site_id)
      .single();

    const maxPerDay = site?.max_students_per_day ?? 2;
    const currentCount = (existingForSite || []).length;

    if (currentCount >= maxPerDay) {
      return NextResponse.json(
        {
          success: false,
          error: `Site is at capacity (${maxPerDay} students/day). Currently has ${currentCount} assigned.`,
          conflict: 'capacity_exceeded',
        },
        { status: 409 }
      );
    }

    // Upsert: if student already has a rotation on that date, update it
    const { data: rotation, error } = await supabase
      .from('clinical_rotations')
      .upsert(
        {
          student_id,
          site_id,
          rotation_date,
          shift_type: shift_type || 'day',
          status: status || 'scheduled',
          notes: notes || null,
          assigned_by: auth.session?.user?.email || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,rotation_date' }
      )
      .select(`
        id, student_id, site_id, rotation_date, shift_type, status, notes, assigned_by, created_at, updated_at,
        student:students(id, first_name, last_name, cohort_id),
        site:clinical_sites(id, name, abbreviation, system, max_students_per_day)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, rotation });
  } catch (error: any) {
    console.error('Error creating rotation:', error);
    // Unique constraint = same student, same date (different site attempted)
    if (error?.code === '23505') {
      return NextResponse.json(
        {
          success: false,
          error: 'Student is already assigned to a rotation on this date.',
          conflict: 'date_conflict',
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: 'Failed to create rotation' }, { status: 500 });
  }
}
