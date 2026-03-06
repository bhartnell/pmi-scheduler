import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');

    if (auth instanceof NextResponse) return auth;

    const { user, session } = auth;

    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const internshipId = request.nextUrl.searchParams.get('internship_id');
    if (!internshipId) {
      return NextResponse.json(
        { success: false, error: 'internship_id is required' },
        { status: 400 }
      );
    }

    const { data: tokens, error } = await supabase
      .from('preceptor_eval_tokens')
      .select('*')
      .eq('internship_id', internshipId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, tokens: tokens || [] });
  } catch (error) {
    console.error('Error fetching preceptor eval tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}
