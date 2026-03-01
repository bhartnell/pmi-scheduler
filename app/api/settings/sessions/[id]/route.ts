import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// DELETE — revoke (delete) a specific session
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the session belongs to this user before deleting
    const { data: target, error: fetchError } = await supabase
      .from('user_sessions')
      .select('id, is_current')
      .eq('id', id)
      .eq('user_email', session.user.email)
      .single();

    if (fetchError || !target) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (target.is_current) {
      return NextResponse.json(
        { error: 'Cannot revoke your current session. Sign out instead.' },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from('user_sessions')
      .delete()
      .eq('id', id)
      .eq('user_email', session.user.email);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to revoke session';
    console.error(`DELETE /api/settings/sessions/${id} error:`, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
