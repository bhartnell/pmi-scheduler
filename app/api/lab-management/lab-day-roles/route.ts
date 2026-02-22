import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

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
    // Accept both labDayId and lab_day_id for compatibility
    const labDayId = searchParams.get('labDayId') || searchParams.get('lab_day_id');

    if (!labDayId) {
      return NextResponse.json({ success: true, roles: [] }); // Return empty array instead of error to prevent retry loops
    }

    const supabase = getSupabaseAdmin();

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
  } catch (error: any) {
    console.error('Error fetching lab day roles:', error);
    // Handle table not existing gracefully
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({ success: true, roles: [], tableExists: false });
    }
    return NextResponse.json({ success: true, roles: [] }); // Return empty array to prevent retry loops
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

    const supabase = getSupabaseAdmin();

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

// DELETE - Remove role assignment(s)
// Supports: ?id=<roleId> to delete a single role
//           ?lab_day_id=<labDayId> to delete ALL roles for a lab day
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('id');
    const labDayId = searchParams.get('lab_day_id') || searchParams.get('labDayId');

    const supabase = getSupabaseAdmin();

    if (roleId) {
      // Delete a single role by ID
      const { error } = await supabase
        .from('lab_day_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
    } else if (labDayId) {
      // Delete ALL roles for a lab day (used by edit page before re-inserting)
      const { error } = await supabase
        .from('lab_day_roles')
        .delete()
        .eq('lab_day_id', labDayId);

      if (error) throw error;
    } else {
      return NextResponse.json({ success: false, error: 'Either id or lab_day_id is required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing role:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove role' }, { status: 500 });
  }
}
