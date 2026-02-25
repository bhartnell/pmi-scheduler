import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// POST /api/lab-management/lab-days/[id]/checkin-token
// Generate (or regenerate) a unique check-in token for this lab day and enable check-in
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  // Check role — must be instructor or above
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify the lab day exists
  const { data: labDay, error: labDayError } = await supabase
    .from('lab_days')
    .select('id')
    .eq('id', labDayId)
    .single();

  if (labDayError || !labDay) {
    return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
  }

  // Generate a new UUID token using crypto.randomUUID()
  const token = crypto.randomUUID();

  const { data, error } = await supabase
    .from('lab_days')
    .update({
      checkin_token: token,
      checkin_enabled: true,
    })
    .eq('id', labDayId)
    .select('id, checkin_token, checkin_enabled')
    .single();

  if (error) {
    console.error('Error generating check-in token:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }

  return NextResponse.json({ success: true, checkin_token: data.checkin_token, checkin_enabled: data.checkin_enabled });
}

// DELETE /api/lab-management/lab-days/[id]/checkin-token
// Disable check-in for this lab day (sets checkin_enabled=false, keeps token for audit)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  // Check role — must be instructor or above
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('lab_days')
    .update({ checkin_enabled: false })
    .eq('id', labDayId);

  if (error) {
    console.error('Error disabling check-in:', error);
    return NextResponse.json({ error: 'Failed to disable check-in' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
