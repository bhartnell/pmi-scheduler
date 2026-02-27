import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { notifyAdminsNewFeedback, notifyFeedbackResolved } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';

// Create Supabase client inside handlers to ensure env vars are available
// GET - List all feedback reports (for admin view)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    const role = currentUser?.role || 'pending';
    if (!['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const reportType = searchParams.get('type');
    const priority = searchParams.get('priority');
    const reporter = searchParams.get('reporter');
    const showArchived = searchParams.get('showArchived') === 'true';
    const sortBy = searchParams.get('sortBy') || 'priority';
    const limit = parseInt(searchParams.get('limit') || '500');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('feedback_reports')
      .select('*', { count: 'exact' });

    // Exclude archived by default — filter by status rather than archived_at for robustness
    if (!showArchived) {
      query = query.neq('status', 'archived');
    }

    // Auto-archive resolved items > 7 days old
    // Do this as a side effect on GET for simplicity — wrapped in try/catch so it never breaks the GET
    if (!showArchived) {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        await supabase
          .from('feedback_reports')
          .update({ status: 'archived', archived_at: new Date().toISOString() })
          .eq('status', 'resolved')
          .is('archived_at', null)
          .lt('updated_at', sevenDaysAgo.toISOString());
      } catch (archiveErr) {
        console.error('Auto-archive side effect failed (non-fatal):', archiveErr);
      }
    }

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Type filter
    if (reportType && reportType !== 'all') {
      query = query.eq('report_type', reportType);
    }

    // Priority filter
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    // Reporter filter
    if (reporter && reporter !== 'all') {
      query = query.eq('user_email', reporter);
    }

    // Sorting
    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sortBy === 'priority') {
      query = query
        .order('priority', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
    } else if (sortBy === 'status') {
      query = query
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });
    } else {
      // Default: priority
      query = query
        .order('priority', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
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
// Accepts both application/json (backward compat) and multipart/form-data (for screenshot uploads)
export async function POST(request: NextRequest) {
  // Rate limit: 5 submissions per minute per IP
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success: rateLimitOk } = rateLimit(`feedback:${ip}`, 5, 60000);
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();

    let report_type: string;
    let description: string;
    let page_url: string | null;
    let user_agent: string | null;
    let screenshotFile: File | null = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Parse FormData (new path - supports screenshot upload)
      const formData = await request.formData();
      description = (formData.get('description') as string) || '';
      report_type = (formData.get('report_type') as string) || 'other';
      page_url = (formData.get('page_url') as string) || null;
      user_agent = (formData.get('user_agent') as string) || null;
      const fileField = formData.get('screenshot');
      if (fileField && typeof fileField !== 'string') {
        screenshotFile = fileField as File;
      }
    } else {
      // Parse JSON (legacy path - backward compatible)
      const body = await request.json();
      description = body.description || '';
      report_type = body.report_type || 'other';
      page_url = body.page_url || null;
      user_agent = body.user_agent || null;
    }

    if (!description?.trim()) {
      return NextResponse.json({ success: false, error: 'Description is required' }, { status: 400 });
    }

    // Insert the feedback record first so we have the ID for the storage path
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

    // Upload screenshot if provided
    if (screenshotFile && screenshotFile.size > 0) {
      try {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(screenshotFile.type)) {
          console.warn('Screenshot upload skipped: invalid file type', screenshotFile.type);
        } else if (screenshotFile.size > 5 * 1024 * 1024) {
          console.warn('Screenshot upload skipped: file too large', screenshotFile.size);
        } else {
          const bytes = await screenshotFile.arrayBuffer();
          const buffer = Buffer.from(bytes);

          // Use feedback ID as folder so files stay organized
          const fileName = `${data.id}/${Date.now()}-${screenshotFile.name}`;

          const { error: uploadError } = await supabase
            .storage
            .from('feedback-screenshots')
            .upload(fileName, buffer, { contentType: screenshotFile.type });

          if (uploadError) {
            // Log but do not fail the request - screenshot is optional
            console.error('Screenshot upload failed (non-fatal):', uploadError);
          } else {
            const { data: urlData } = supabase
              .storage
              .from('feedback-screenshots')
              .getPublicUrl(fileName);

            const screenshotUrl = urlData.publicUrl;

            // Update the record with the screenshot URL
            const { error: updateError } = await supabase
              .from('feedback_reports')
              .update({ screenshot_url: screenshotUrl })
              .eq('id', data.id);

            if (updateError) {
              console.error('Failed to save screenshot URL (non-fatal):', updateError);
            } else {
              // Reflect the URL in the returned record
              data.screenshot_url = screenshotUrl;
            }
          }
        }
      } catch (uploadErr) {
        // Screenshot failures are non-fatal - the feedback was already saved
        console.error('Screenshot processing error (non-fatal):', uploadErr);
      }
    }

    // Notify admins about new feedback
    try {
      await notifyAdminsNewFeedback({
        feedbackId: data.id,
        title: description.trim().substring(0, 100),
        type: report_type || 'other',
        submittedBy: session?.user?.email || 'anonymous',
      });
    } catch (notifyError) {
      // Don't fail the request if notification fails
      console.error('Failed to send feedback notification:', notifyError);
    }

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
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    const role = currentUser?.role || 'pending';
    if (!['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, resolution_notes, priority } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Report ID is required' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};

    if (status) {
      updateData.status = status;

      // Handle status-specific updates
      if (status === 'read') {
        updateData.read_at = new Date().toISOString();
        // read_by stores the admin's email who first viewed it
        updateData.read_by = session.user.email;
      } else if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = session.user.email;
      } else if (status === 'archived') {
        updateData.archived_at = new Date().toISOString();
      }
    }

    if (resolution_notes !== undefined) {
      updateData.resolution_notes = resolution_notes;
    }

    if (priority) {
      updateData.priority = priority;
    }

    // Add updated_at for auto-archive tracking
    updateData.updated_at = new Date().toISOString();

    // Get the report first to check for status change and get reporter email
    const { data: currentReport } = await supabase
      .from('feedback_reports')
      .select('status, user_email, description')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('feedback_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Notify reporter if feedback was resolved
    if (status === 'resolved' && currentReport?.status !== 'resolved' && currentReport?.user_email) {
      try {
        await notifyFeedbackResolved(currentReport.user_email, {
          feedbackId: id,
          title: currentReport.description?.substring(0, 100) || 'Your feedback',
        });
      } catch (notifyError) {
        console.error('Failed to send resolution notification:', notifyError);
      }
    }

    return NextResponse.json({ success: true, report: data });
  } catch (error: any) {
    console.error('Error updating feedback:', error);
    console.error('PATCH error details:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update feedback' }, { status: 500 });
  }
}
