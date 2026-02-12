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

// Get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
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

    // Verify ownership
    const { data: entry } = await supabase
      .from('teaching_log')
      .select('instructor_id')
      .eq('id', id)
      .single();

    if (!entry) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 });
    }

    if (entry.instructor_id !== currentUser.id && currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabase
      .from('teaching_log')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting teaching entry:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete teaching entry' }, { status: 500 });
  }
}
