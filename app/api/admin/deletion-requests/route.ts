import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { data, error } = await supabase
      .from('deletion_requests')
      .select(`
        *,
        requester:lab_users!deletion_requests_requested_by_fkey(id, name, email)
      `)
      .order('requested_at', { ascending: false });

    if (error) throw error;

    // Transform data to match expected interface
    const requests = (data || []).map(req => ({
      id: req.id,
      item_type: req.item_type,
      item_id: req.item_id,
      item_name: req.item_name,
      reason: req.reason,
      requested_by: req.requested_by,
      requester_name: req.requester?.name || 'Unknown',
      requested_at: req.requested_at,
      status: req.status
    }));

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error('Error fetching deletion requests:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const { item_type, item_id, item_name, reason } = body;

    if (!item_type || !item_id || !item_name) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('deletion_requests')
      .insert({
        item_type,
        item_id,
        item_name,
        reason: reason || '',
        requested_by: user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    console.error('Error creating deletion request:', error);
    return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('superadmin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !['approve', 'deny'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
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

    // Update the status
    const newStatus = action === 'approve' ? 'approved' : 'denied';
    const { error: updateError } = await supabase
      .from('deletion_requests')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // If approved, actually delete the item
    if (action === 'approve') {
      const tableMap: Record<string, string> = {
        'scenario': 'scenarios',
        'student': 'students',
        'cohort': 'cohorts',
        'station': 'lab_stations',
        'lab_day': 'lab_days',
        'certification': 'certifications',
        'ce_record': 'ce_records'
      };

      const tableName = tableMap[deletionRequest.item_type];
      if (tableName) {
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('id', deletionRequest.item_id);

        if (deleteError) {
          console.error('Error deleting item:', deleteError);
        }
      }
    }

    // Audit log the deletion request action
    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: action === 'approve' ? 'delete' : 'update',
      resourceType: 'user',
      resourceId: deletionRequest.item_id,
      resourceDescription: `Deletion request ${action}: ${deletionRequest.item_type} "${deletionRequest.item_name}"`,
      metadata: { deletionRequestId: requestId, itemType: deletionRequest.item_type, decision: action },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing deletion request:', error);
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
  }
}
