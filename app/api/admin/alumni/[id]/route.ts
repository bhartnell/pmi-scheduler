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

const ALUMNI_SELECT = `
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
`;

// ---------------------------------------------------------------------------
// GET /api/admin/alumni/[id]
// Returns a single alumni record.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: alumni, error } = await supabase
      .from('alumni')
      .select(ALUMNI_SELECT)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Alumni record not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, alumni });
  } catch (error) {
    console.error('Error fetching alumni:', error);
    return NextResponse.json({ error: 'Failed to fetch alumni record' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/alumni/[id]
//
// Body: any subset of alumni fields.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;

    const supabase = getSupabaseAdmin();

    // Verify record exists
    const { data: existing, error: existsError } = await supabase
      .from('alumni')
      .select('id')
      .eq('id', id)
      .single();

    if (existsError || !existing) {
      return NextResponse.json({ error: 'Alumni record not found' }, { status: 404 });
    }

    // Build update payload from allowed fields
    const ALLOWED_FIELDS = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'graduation_date',
      'cohort_id',
      'employment_status',
      'employer',
      'job_title',
      'continuing_education',
      'notes',
      'student_id',
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        const value = body[field];
        // Trim string fields, keep null/empty as null
        if (typeof value === 'string') {
          updates[field] = value.trim() === '' ? null : value.trim();
        } else {
          updates[field] = value ?? null;
        }
      }
    }

    const { data: alumni, error } = await supabase
      .from('alumni')
      .update(updates)
      .eq('id', id)
      .select(ALUMNI_SELECT)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, alumni });
  } catch (error) {
    console.error('Error updating alumni:', error);
    return NextResponse.json({ error: 'Failed to update alumni record' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/alumni/[id]
//
// Permanently removes the alumni record.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('alumni').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting alumni:', error);
    return NextResponse.json({ error: 'Failed to delete alumni record' }, { status: 500 });
  }
}
