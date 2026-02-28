import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Fetch feedback reports submitted by the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const typeFilter = searchParams.get('type');
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('feedback_reports')
      .select('*')
      .eq('user_email', session.user.email);

    // Type filter
    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('report_type', typeFilter);
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    const reports = data || [];

    // Compute summary stats
    const stats = {
      total: reports.length,
      open: reports.filter(r => r.status === 'new' || r.status === 'read').length,
      in_progress: reports.filter(r => r.status === 'in_progress' || r.status === 'needs_investigation').length,
      resolved: reports.filter(r => r.status === 'resolved' || r.status === 'archived').length,
    };

    return NextResponse.json({ success: true, reports, stats });
  } catch (error: any) {
    console.error('Error fetching user feedback submissions:', error);
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({ success: true, reports: [], stats: { total: 0, open: 0, in_progress: 0, resolved: 0 } });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch submissions' }, { status: 500 });
  }
}
