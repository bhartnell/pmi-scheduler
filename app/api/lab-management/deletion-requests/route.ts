import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Helper to get user by email
async function getUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

// Helper to check if requester is admin
async function isRequesterAdmin(email: string): Promise<boolean> {
  const user = await getUserByEmail(email);
  return user?.role === 'admin';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('deletion_requests')
      .select(`
        *,
        requester:lab_users!requested_by(id, name, email),
        reviewer:lab_users!reviewed_by(id, name, email)
      `)
      .order('requested_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, requests: data });
  } catch (error) {
    console.error('Error fetching deletion requests:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch deletion requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { table_name, record_id, record_title, reason } = body;

    if (!table_name || !record_id) {
      return NextResponse.json({
        success: false,
        error: 'table_name and record_id are required'
      }, { status: 400 });
    }

    // Get requester's lab_users ID
    const requester = await getUserByEmail(session.user.email);

    const { data, error } = await supabase
      .from('deletion_requests')
      .insert({
        table_name,
        record_id,
        record_title: record_title || null,
        reason: reason || null,
        requested_by: requester?.id || null,
        status: 'pending'
      })
      .select(`
        *,
        requester:lab_users!requested_by(id, name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    console.error('Error creating deletion request:', error);
    return NextResponse.json({ success: false, error: 'Failed to create deletion request' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if requester is admin
    const isAdmin = await isRequesterAdmin(session.user.email);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { requestId, action } = body; // action: 'approve' | 'deny'

    if (!requestId || !action) {
      return NextResponse.json({
        success: false,
        error: 'requestId and action are required'
      }, { status: 400 });
    }

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'action must be "approve" or "deny"'
      }, { status: 400 });
    }

    // Get the deletion request
    const { data: deletionRequest, error: fetchError } = await supabase
      .from('deletion_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !deletionRequest) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Get reviewer's lab_users ID
    const reviewer = await getUserByEmail(session.user.email);

    // If approving, delete the actual record
    if (action === 'approve') {
      const { error: deleteError } = await supabase
        .from(deletionRequest.table_name)
        .delete()
        .eq('id', deletionRequest.record_id);

      if (deleteError) {
        console.error('Error deleting record:', deleteError);
        return NextResponse.json({
          success: false,
          error: `Failed to delete record from ${deletionRequest.table_name}`
        }, { status: 500 });
      }
    }

    // Update the deletion request status
    const { data, error } = await supabase
      .from('deletion_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'denied',
        reviewed_by: reviewer?.id || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select(`
        *,
        requester:lab_users!requested_by(id, name, email),
        reviewer:lab_users!reviewed_by(id, name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    console.error('Error updating deletion request:', error);
    return NextResponse.json({ success: false, error: 'Failed to update deletion request' }, { status: 500 });
  }
}
