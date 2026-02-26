import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Helper to get current user with role
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/announcements
//
// Query params:
//   ?active=true  - filter to currently active announcements (default: false = all)
//   ?audience=all - filter by target_audience (optional)
//
// Returns announcements with read status for the current user.
// Admin+ gets all announcements with read counts.
// Others get active/relevant announcements only.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const audienceFilter = searchParams.get('audience');
    const isAdmin = hasMinRole(currentUser.role, 'admin');

    // For admin view: return all announcements with read counts
    if (isAdmin && !activeOnly) {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (audienceFilter) {
        query = query.eq('target_audience', audienceFilter);
      }

      const { data: announcements, error } = await query;
      if (error) throw error;

      // Get read counts for each announcement
      const announcementIds = (announcements ?? []).map((a) => a.id);
      let readCounts: Record<string, number> = {};

      if (announcementIds.length > 0) {
        const { data: reads } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .in('announcement_id', announcementIds);

        for (const read of reads ?? []) {
          readCounts[read.announcement_id] = (readCounts[read.announcement_id] || 0) + 1;
        }
      }

      // Get current user's read status
      const { data: myReads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_email', currentUser.email);

      const myReadSet = new Set((myReads ?? []).map((r) => r.announcement_id));

      const result = (announcements ?? []).map((a) => ({
        ...a,
        read_count: readCounts[a.id] || 0,
        is_read: myReadSet.has(a.id),
      }));

      return NextResponse.json({ success: true, announcements: result });
    }

    // For regular users or active-only dashboard view: filter active announcements
    const now = new Date().toISOString();
    let query = supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', now)
      .order('priority', { ascending: false })
      .order('starts_at', { ascending: false });

    // ends_at is null OR ends_at >= now
    // Supabase doesn't support OR with null easily, so we filter client-side below

    const { data: announcements, error } = await query;
    if (error) throw error;

    // Filter: ends_at is null or ends_at >= now
    const filtered = (announcements ?? []).filter((a) => {
      if (a.ends_at === null) return true;
      return new Date(a.ends_at) >= new Date(now);
    });

    // Get current user's read status
    const announcementIds = filtered.map((a) => a.id);
    let myReadSet = new Set<string>();

    if (announcementIds.length > 0) {
      const { data: myReads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_email', currentUser.email)
        .in('announcement_id', announcementIds);

      myReadSet = new Set((myReads ?? []).map((r) => r.announcement_id));
    }

    const result = filtered.map((a) => ({
      ...a,
      is_read: myReadSet.has(a.id),
    }));

    return NextResponse.json({ success: true, announcements: result });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/announcements
// Create a new announcement (admin+ only)
// Body: { title, body, priority, target_audience, starts_at?, ends_at? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      title: string;
      body: string;
      priority: 'info' | 'warning' | 'critical';
      target_audience: 'all' | 'instructors' | 'students';
      starts_at?: string;
      ends_at?: string;
    };

    const { title, body: bodyText, priority, target_audience, starts_at, ends_at } = body;

    if (!title || !bodyText || !priority || !target_audience) {
      return NextResponse.json(
        { error: 'title, body, priority, and target_audience are required' },
        { status: 400 }
      );
    }

    const validPriorities = ['info', 'warning', 'critical'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const validAudiences = ['all', 'instructors', 'students'];
    if (!validAudiences.includes(target_audience)) {
      return NextResponse.json({ error: 'Invalid target_audience' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        body: bodyText,
        priority,
        target_audience,
        starts_at: starts_at ?? new Date().toISOString(),
        ends_at: ends_at ?? null,
        is_active: true,
        created_by: currentUser.email,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, announcement: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/announcements
// Update an announcement (admin+ only)
// Body: { id, title?, body?, priority?, target_audience?, starts_at?, ends_at?, is_active? }
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      id: string;
      title?: string;
      body?: string;
      priority?: 'info' | 'warning' | 'critical';
      target_audience?: 'all' | 'instructors' | 'students';
      starts_at?: string;
      ends_at?: string | null;
      is_active?: boolean;
    };

    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('announcements')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, announcement: data });
  } catch (error) {
    console.error('Error updating announcement:', error);
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/announcements
// Delete an announcement (admin+ only)
// Body: { id }
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as { id: string };
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 });
  }
}
