import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user's lab_users record
async function getCurrentUser(email: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

// Check if user can access this certification
async function canAccessCert(certId: string, userId: string, userRole: string): Promise<boolean> {
  if (userRole === 'admin') return true;

  const supabase = getSupabase();
  const { data } = await supabase
    .from('instructor_certifications')
    .select('instructor_id')
    .eq('id', certId)
    .single();

  return data?.instructor_id === userId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('instructor_certifications')
      .select(`
        *,
        instructor:lab_users(id, name, email),
        ce_requirement:ce_requirements(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, certification: data });
  } catch (error) {
    console.error('Error fetching certification:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch certification' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const canAccess = await canAccessCert(id, currentUser.id, currentUser.role);
    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.cert_name !== undefined) updates.cert_name = body.cert_name;
    if (body.cert_number !== undefined) updates.cert_number = body.cert_number;
    if (body.issuing_body !== undefined) updates.issuing_body = body.issuing_body;
    if (body.issue_date !== undefined) updates.issue_date = body.issue_date;
    if (body.expiration_date !== undefined) updates.expiration_date = body.expiration_date;
    if (body.card_image_url !== undefined) updates.card_image_url = body.card_image_url;
    if (body.ce_requirement_id !== undefined) updates.ce_requirement_id = body.ce_requirement_id;

    const { data, error } = await supabase
      .from('instructor_certifications')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        instructor:lab_users(id, name, email),
        ce_requirement:ce_requirements(id, display_name, total_hours_required, cycle_years)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, certification: data });
  } catch (error) {
    console.error('Error updating certification:', error);
    return NextResponse.json({ success: false, error: 'Failed to update certification' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const canAccess = await canAccessCert(id, currentUser.id, currentUser.role);
    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabase
      .from('instructor_certifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting certification:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete certification' }, { status: 500 });
  }
}
