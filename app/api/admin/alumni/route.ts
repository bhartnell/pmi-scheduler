import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
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
// GET /api/admin/alumni
//
// Query params:
//   - search: partial name/email match
//   - cohort_id: filter by cohort
//   - employment_status: filter by status
//
// Returns all alumni with cohort info.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const cohortId = searchParams.get('cohort_id') ?? '';
    const employmentStatus = searchParams.get('employment_status') ?? '';

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('alumni')
      .select(`
        id,
        student_id,
        first_name,
        last_name,
        email,
        phone,
        graduation_date,
        cohort_id,
        employment_status,
        employer,
        job_title,
        continuing_education,
        notes,
        created_at,
        updated_at,
        cohort:cohorts(id, name, program)
      `)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (employmentStatus) {
      query = query.eq('employment_status', employmentStatus);
    }

    const { data: alumni, error } = await query;

    if (error) throw error;

    // Apply search filter in-memory (name or email partial match)
    const filtered = search
      ? (alumni ?? []).filter((a: any) => {
          const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
          const emailLower = (a.email ?? '').toLowerCase();
          const q = search.toLowerCase();
          return fullName.includes(q) || emailLower.includes(q);
        })
      : (alumni ?? []);

    return NextResponse.json({ success: true, alumni: filtered, total: filtered.length });
  } catch (error) {
    console.error('Error fetching alumni:', error);
    return NextResponse.json({ error: 'Failed to fetch alumni' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/alumni
//
// Body: {
//   first_name, last_name, email?, phone?, graduation_date?,
//   cohort_id?, employment_status?, employer?, job_title?,
//   continuing_education?, notes?, student_id?
// }
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      graduation_date?: string;
      cohort_id?: string;
      employment_status?: string;
      employer?: string;
      job_title?: string;
      continuing_education?: string;
      notes?: string;
      student_id?: string;
    };

    const { first_name, last_name } = body;

    if (!first_name?.trim() || !last_name?.trim()) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: alumni, error } = await supabase
      .from('alumni')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: body.email?.trim() ?? null,
        phone: body.phone?.trim() ?? null,
        graduation_date: body.graduation_date ?? null,
        cohort_id: body.cohort_id ?? null,
        employment_status: body.employment_status ?? 'unknown',
        employer: body.employer?.trim() ?? null,
        job_title: body.job_title?.trim() ?? null,
        continuing_education: body.continuing_education?.trim() ?? null,
        notes: body.notes?.trim() ?? null,
        student_id: body.student_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .select(`
        id,
        student_id,
        first_name,
        last_name,
        email,
        phone,
        graduation_date,
        cohort_id,
        employment_status,
        employer,
        job_title,
        continuing_education,
        notes,
        created_at,
        updated_at,
        cohort:cohorts(id, name, program)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, alumni }, { status: 201 });
  } catch (error) {
    console.error('Error creating alumni:', error);
    return NextResponse.json({ error: 'Failed to create alumni record' }, { status: 500 });
  }
}
