// PUBLIC: No auth required — anonymous click tracking
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { link_id, source } = body;

    if (!link_id) {
      return NextResponse.json({ error: 'link_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const user_agent = request.headers.get('user-agent') || null;
    const referrer = request.headers.get('referer') || null;

    const { error } = await supabase.from('link_clicks').insert({
      link_id,
      source: source || null,
      referrer,
      user_agent,
    });

    if (error) {
      console.error('Failed to log link click:', error);
      return NextResponse.json({ error: 'Failed to log click' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Link click tracking error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
