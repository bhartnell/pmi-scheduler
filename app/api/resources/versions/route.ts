import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';

// ---------------------------------------------------------------------------
// GET /api/resources/versions?resourceId=<uuid>
//
// Returns all version history entries for a resource.
// Requires instructor+ role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    if (!resourceId) {
      return NextResponse.json({ error: 'resourceId query param is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('resource_versions')
      .select('*')
      .eq('resource_id', resourceId)
      .order('version', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, versions: data ?? [] });
  } catch (error) {
    console.error('Error fetching resource versions:', error);
    return NextResponse.json({ error: 'Failed to fetch resource versions' }, { status: 500 });
  }
}
