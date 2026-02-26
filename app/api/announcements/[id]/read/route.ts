import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// POST /api/announcements/[id]/read
// Mark an announcement as read for the current user
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Announcement ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Upsert - safe to call multiple times
    const { error } = await supabase
      .from('announcement_reads')
      .upsert(
        {
          announcement_id: id,
          user_email: session.user.email,
          read_at: new Date().toISOString(),
        },
        { onConflict: 'announcement_id,user_email' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking announcement as read:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
