import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Helper: resolve the calling user's role
async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

// GET /api/admin/dashboard-defaults
// Returns all role-based default layouts. Admin only.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getCallerRole(session.user.email);
    if (!role || !hasMinRole(role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('dashboard_layout_defaults')
      .select('id, role, layout, updated_by, updated_at')
      .order('role');

    if (error) throw error;

    return NextResponse.json({ success: true, defaults: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch defaults';
    console.error('Error fetching dashboard defaults:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/admin/dashboard-defaults
// Body: { role: string, layout: object }
// Upserts the default layout for a role. Admin only.
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.role || typeof body.role !== 'string') {
      return NextResponse.json({ error: 'role is required' }, { status: 400 });
    }
    if (!body.layout || typeof body.layout !== 'object') {
      return NextResponse.json({ error: 'layout is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('dashboard_layout_defaults')
      .upsert(
        {
          role: body.role,
          layout: body.layout,
          updated_by: session.user.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'role', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, default: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save default';
    console.error('Error saving dashboard default:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
