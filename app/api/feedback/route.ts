import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Use service role key to bypass RLS for feedback submission
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// GET - List all feedback reports (for admin view)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const reportType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('feedback_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (reportType && reportType !== 'all') {
      query = query.eq('report_type', reportType);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      reports: data || [],
      total: count,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Error fetching feedback:', error);
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({ success: true, reports: [], total: 0, tableExists: false });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

// POST - Submit new feedback
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await request.json();

    const { report_type, description, page_url, user_agent } = body;

    if (!description?.trim()) {
      return NextResponse.json({ success: false, error: 'Description is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('feedback_reports')
      .insert({
        report_type: report_type || 'other',
        description: description.trim(),
        page_url: page_url || null,
        user_email: session?.user?.email || 'anonymous',
        user_agent: user_agent || null,
        status: 'new'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, report: data });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    console.error('Error details:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });

    // Check if table doesn't exist
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({
        success: false,
        error: 'Feedback table not configured. Please run the migration.',
        tableExists: false
      }, { status: 500 });
    }

    // Check for RLS policy violation
    if (error?.code === '42501' || error?.message?.includes('policy')) {
      return NextResponse.json({
        success: false,
        error: 'Permission denied. Check RLS policies or service role key.',
        details: error?.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to submit feedback',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}

// PATCH - Update feedback status (for admins)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, resolution_notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Report ID is required' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};

    if (status) {
      updateData.status = status;
      if (status === 'resolved' || status === 'wont_fix') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = session.user.email;
      }
    }

    if (resolution_notes !== undefined) {
      updateData.resolution_notes = resolution_notes;
    }

    const { data, error } = await supabase
      .from('feedback_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, report: data });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json({ success: false, error: 'Failed to update feedback' }, { status: 500 });
  }
}
