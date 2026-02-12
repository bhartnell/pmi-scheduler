import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { isDirector } from '@/lib/endorsements';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// POST - Confirm or decline a signup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signupId: string }> }
) {
  const { id: shiftId, signupId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Check if user is a director or admin
    const userIsDirector = await isDirector(currentUser.id);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    if (!userIsDirector && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Only directors can confirm/decline signups' }, { status: 403 });
    }

    const body = await request.json();
    const { action, reason } = body;

    if (action !== 'confirm' && action !== 'decline') {
      return NextResponse.json({ success: false, error: 'Action must be "confirm" or "decline"' }, { status: 400 });
    }

    if (action === 'decline' && !reason) {
      return NextResponse.json({ success: false, error: 'Reason is required when declining' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get signup with shift info
    const { data: signup, error: fetchError } = await supabase
      .from('shift_signups')
      .select(`
        *,
        instructor:instructor_id(id, name, email),
        shift:shift_id(id, title, date, start_time, end_time)
      `)
      .eq('id', signupId)
      .eq('shift_id', shiftId)
      .single();

    if (fetchError || !signup) {
      return NextResponse.json({ success: false, error: 'Signup not found' }, { status: 404 });
    }

    if (signup.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot ${action} a signup that is already ${signup.status}` },
        { status: 400 }
      );
    }

    // Update signup
    const updateData: Record<string, unknown> = {
      status: action === 'confirm' ? 'confirmed' : 'declined',
      confirmed_by: currentUser.id,
      confirmed_at: new Date().toISOString(),
    };

    if (action === 'decline') {
      updateData.declined_reason = reason;
    }

    const { data: updated, error } = await supabase
      .from('shift_signups')
      .update(updateData)
      .eq('id', signupId)
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .single();

    if (error) throw error;

    // TODO: Notify instructor of confirmation/decline

    return NextResponse.json({ success: true, signup: updated });
  } catch (error) {
    console.error('Error updating signup:', error);
    return NextResponse.json({ success: false, error: 'Failed to update signup' }, { status: 500 });
  }
}
