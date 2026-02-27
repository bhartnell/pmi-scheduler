import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { page_path } = body;

    if (!page_path || typeof page_path !== 'string') {
      return NextResponse.json({ success: false, error: 'page_path is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const userEmail = session.user.email;

    // Rate limit: dedup - don't log the same page for the same user within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('user_activity')
      .select('id')
      .eq('user_email', userEmail)
      .eq('page_path', page_path)
      .gte('created_at', fiveMinutesAgo)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Already logged this page view recently, skip
      return NextResponse.json({ success: true, skipped: true });
    }

    const userAgent = request.headers.get('user-agent') || null;

    const { error } = await supabase.from('user_activity').insert({
      user_email: userEmail,
      page_path,
      user_agent: userAgent,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging user activity:', error);
    return NextResponse.json({ success: false, error: 'Failed to log activity' }, { status: 500 });
  }
}
