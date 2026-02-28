import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// POST /api/admin/broadcast
// Resolves the audience, creates user_notifications for each recipient,
// records the broadcast in broadcast_history, and returns the send count.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify admin role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      message,
      audience_type,
      audience_filter,
      notification_type = 'in_app',
      priority = 'normal',
      link_url,
      scheduled_for,
    } = body;

    if (!title || !message || !audience_type) {
      return NextResponse.json(
        { error: 'title, message, and audience_type are required' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // Resolve audience to a list of emails
    // -------------------------------------------------------------------------
    let recipientEmails: string[] = [];

    if (audience_type === 'all') {
      const { data: users } = await supabase
        .from('lab_users')
        .select('email')
        .eq('is_active', true)
        .not('role', 'eq', 'pending');
      recipientEmails = (users || []).map((u: { email: string }) => u.email);
    } else if (audience_type === 'roles') {
      const roles: string[] = audience_filter?.roles || [];
      if (roles.length === 0) {
        return NextResponse.json({ error: 'No roles selected' }, { status: 400 });
      }
      const { data: users } = await supabase
        .from('lab_users')
        .select('email')
        .in('role', roles)
        .eq('is_active', true);
      recipientEmails = (users || []).map((u: { email: string }) => u.email);
    } else if (audience_type === 'cohort') {
      // Cohort audience: find all students belonging to the selected cohorts
      const cohortIds: string[] = audience_filter?.cohort_ids || [];
      if (cohortIds.length === 0) {
        return NextResponse.json({ error: 'No cohorts selected' }, { status: 400 });
      }
      // Students are stored in the students table; their user email may differ.
      // We join through students -> lab_users by email.
      const { data: students } = await supabase
        .from('students')
        .select('email')
        .in('cohort_id', cohortIds)
        .not('email', 'is', null);
      const studentEmails = (students || [])
        .map((s: { email: string | null }) => s.email)
        .filter(Boolean) as string[];
      // Cross-reference with active lab_users to get confirmed accounts
      if (studentEmails.length > 0) {
        const { data: users } = await supabase
          .from('lab_users')
          .select('email')
          .in('email', studentEmails)
          .eq('is_active', true);
        recipientEmails = (users || []).map((u: { email: string }) => u.email);
      }
    } else if (audience_type === 'individual') {
      const emails: string[] = audience_filter?.user_emails || [];
      if (emails.length === 0) {
        return NextResponse.json({ error: 'No users selected' }, { status: 400 });
      }
      recipientEmails = emails;
    } else {
      return NextResponse.json({ error: 'Invalid audience_type' }, { status: 400 });
    }

    // Deduplicate
    recipientEmails = [...new Set(recipientEmails.map(e => e.toLowerCase()))];

    if (recipientEmails.length === 0) {
      return NextResponse.json({ error: 'No recipients found for the selected audience' }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // Map priority to notification type value
    // -------------------------------------------------------------------------
    // priority: 'normal' -> type 'general'
    // priority: 'important' -> type 'general' (styled amber on frontend)
    // priority: 'urgent' -> type 'general' (styled red on frontend)
    // We encode priority in the category/type metadata via the message or use
    // a dedicated approach. Per the spec, we store priority in broadcast_history
    // and include it in notification title for urgency signaling.
    const notifType = 'general';
    const notifCategory = 'system';

    // Build notification title prefix based on priority
    let finalTitle = title;
    if (priority === 'urgent') {
      finalTitle = `[URGENT] ${title}`;
    } else if (priority === 'important') {
      finalTitle = `[IMPORTANT] ${title}`;
    }

    // -------------------------------------------------------------------------
    // Insert notifications for in-app delivery
    // -------------------------------------------------------------------------
    const recipientCount = recipientEmails.length;

    if (notification_type === 'in_app' || notification_type === 'both') {
      // Batch insert in chunks of 500 to avoid payload limits
      const CHUNK_SIZE = 500;
      for (let i = 0; i < recipientEmails.length; i += CHUNK_SIZE) {
        const chunk = recipientEmails.slice(i, i + CHUNK_SIZE);
        const records = chunk.map(email => ({
          user_email: email,
          title: finalTitle,
          message,
          type: notifType,
          category: notifCategory,
          link_url: link_url || null,
          reference_type: 'broadcast',
        }));

        const { error: insertError } = await supabase
          .from('user_notifications')
          .insert(records);

        if (insertError) {
          console.error('Error inserting notifications chunk:', insertError);
          // Continue with remaining chunks
        }
      }
    }

    // Email delivery is logged but not implemented inline
    // (email queue / SMTP integration would go here).
    // The broadcast_history record captures the intent.

    // -------------------------------------------------------------------------
    // Record in broadcast_history
    // -------------------------------------------------------------------------
    const { data: historyRecord, error: historyError } = await supabase
      .from('broadcast_history')
      .insert({
        title,
        message,
        audience_type,
        audience_filter: audience_filter || null,
        notification_type,
        priority,
        recipient_count: recipientCount,
        sent_by: session.user.email,
        link_url: link_url || null,
        scheduled_for: scheduled_for || null,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error saving broadcast history:', historyError);
      // Don't fail the whole request for this
    }

    return NextResponse.json({
      success: true,
      recipient_count: recipientCount,
      broadcast_id: historyRecord?.id || null,
    });
  } catch (error: any) {
    console.error('Error sending broadcast:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to send broadcast' },
      { status: 500 }
    );
  }
}

// GET /api/admin/broadcast
// Returns info about a single broadcast (not history - history has its own route)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Return the list of available cohorts and users for audience selection
    const [cohortsResult, usersResult] = await Promise.all([
      supabase
        .from('cohorts')
        .select('id, name, program:programs(name, abbreviation)')
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('lab_users')
        .select('id, name, email, role')
        .eq('is_active', true)
        .not('role', 'eq', 'pending')
        .order('name', { ascending: true }),
    ]);

    return NextResponse.json({
      success: true,
      cohorts: cohortsResult.data || [],
      users: usersResult.data || [],
    });
  } catch (error: any) {
    console.error('Error fetching broadcast options:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch options' },
      { status: 500 }
    );
  }
}
