import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface LabDayRole {
  id: string;
  lab_day_id: string;
  instructor_id: string;
  role: 'lab_lead' | 'roamer' | 'observer';
  notes: string | null;
  created_at: string;
  instructor?: {
    id: string;
    name: string;
    email: string;
  };
}

// GET - Fetch roles for a lab day
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const labDayId = searchParams.get('labDayId');

    if (!labDayId) {
      return NextResponse.json({ success: false, error: 'Lab day ID required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: roles, error } = await supabase
      .from('lab_day_roles')
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .eq('lab_day_id', labDayId)
      .order('role', { ascending: true });

    if (error) throw error;

    // Process to handle Supabase FK returns
    const processedRoles = (roles || []).map(role => ({
      ...role,
      instructor: Array.isArray(role.instructor) ? role.instructor[0] : role.instructor
    }));

    return NextResponse.json({ success: true, roles: processedRoles });
  } catch (error) {
    console.error('Error fetching lab day roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch roles' }, { status: 500 });
  }
}

// POST - Add a role assignment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lab_day_id, instructor_id, role, notes } = body;

    if (!lab_day_id || !instructor_id || !role) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!['lab_lead', 'roamer', 'observer'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if role already exists
    const { data: existing } = await supabase
      .from('lab_day_roles')
      .select('id')
      .eq('lab_day_id', lab_day_id)
      .eq('instructor_id', instructor_id)
      .eq('role', role)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Role already assigned' }, { status: 409 });
    }

    const { data: newRole, error } = await supabase
      .from('lab_day_roles')
      .insert({
        lab_day_id,
        instructor_id,
        role,
        notes: notes || null
      })
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .single();

    if (error) throw error;

    // Process FK return
    const processedRole = {
      ...newRole,
      instructor: Array.isArray(newRole.instructor) ? newRole.instructor[0] : newRole.instructor
    };

    return NextResponse.json({ success: true, role: processedRole });
  } catch (error) {
    console.error('Error adding role:', error);
    return NextResponse.json({ success: false, error: 'Failed to add role' }, { status: 500 });
  }
}

// DELETE - Remove a role assignment
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('id');

    if (!roleId) {
      return NextResponse.json({ success: false, error: 'Role ID required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('lab_day_roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing role:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove role' }, { status: 500 });
  }
}
