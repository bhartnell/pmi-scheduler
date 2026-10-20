import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// DELETE — revoke a specific session (sets is_revoked = true)
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

    // Verify the session belongs to this user before revoking
    const { data: target, error: fetchError } = await supabase
      .from('user_sessions')
      .select('id, session_token')
      .eq('id', id)
      .eq('user_email', session.user.email)
      .eq('is_revoked', false)
      .single();

    if (fetchError || !target) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { error: revokeError } = await supabase
      .from('user_sessions')
      .update({ is_revoked: true })
      .eq('id', id)
      .eq('user_email', session.user.email);

    if (revokeError) throw revokeError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to revoke session';
    console.error(`DELETE /api/settings/sessions/${id} error:`, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
