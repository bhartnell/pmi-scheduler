import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasMinRole, canManageContent } from '@/lib/permissions';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user with role
async function getCurrentUser(supabase: ReturnType<typeof getSupabase>, email: string) {
  const { data: user, error } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();

  if (error || !user) return null;
  return user;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/stations/pool/[id]
 * Get a single station with completion details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabase();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: station, error } = await supabase
      .from('station_pool')
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        created_by_user:lab_users!station_pool_created_by_fkey(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 });
      }
      throw error;
    }

    // Get completion stats for this station
    const { data: completions, error: completionsError } = await supabase
      .from('station_completions')
      .select(`
        id,
        result,
        completed_at,
        notes,
        student:students(id, first_name, last_name),
        logged_by_user:lab_users!station_completions_logged_by_fkey(id, name)
      `)
      .eq('station_id', id)
      .order('completed_at', { ascending: false });

    // Get stats summary
    const stats = { pass: 0, needs_review: 0, incomplete: 0, total: 0 };
    if (completions) {
      completions.forEach((c: { result: string }) => {
        stats[c.result as 'pass' | 'needs_review' | 'incomplete']++;
        stats.total++;
      });
    }

    return NextResponse.json({
      success: true,
      station: {
        ...station,
        completions: completions || [],
        completion_stats: stats
      }
    });
  } catch (error) {
    console.error('Error fetching station:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch station' }, { status: 500 });
  }
}

/**
 * PATCH /api/stations/pool/[id]
 * Update a station in the pool
 * Requires instructor+ role
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabase();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser(supabase, session.user.email);
    if (!user || !hasMinRole(user.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};

    if (body.station_code !== undefined) {
      if (!body.station_code?.trim()) {
        return NextResponse.json({ success: false, error: 'Station code cannot be empty' }, { status: 400 });
      }
      // Check for duplicate station code (excluding current station)
      const { data: existing } = await supabase
        .from('station_pool')
        .select('id')
        .eq('station_code', body.station_code.trim())
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json({ success: false, error: 'Station code already exists' }, { status: 400 });
      }
      updateData.station_code = body.station_code.trim();
    }

    if (body.station_name !== undefined) {
      if (!body.station_name?.trim()) {
        return NextResponse.json({ success: false, error: 'Station name cannot be empty' }, { status: 400 });
      }
      updateData.station_name = body.station_name.trim();
    }

    if (body.category !== undefined) updateData.category = body.category;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.semester !== undefined) updateData.semester = body.semester;
    if (body.cohort_id !== undefined) updateData.cohort_id = body.cohort_id || null;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;

    const { data: station, error } = await supabase
      .from('station_pool')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        created_by_user:lab_users!station_pool_created_by_fkey(id, name)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, station });
  } catch (error) {
    console.error('Error updating station:', error);
    return NextResponse.json({ success: false, error: 'Failed to update station' }, { status: 500 });
  }
}

/**
 * DELETE /api/stations/pool/[id]
 * Archive a station (soft delete by setting is_active = false)
 * Requires admin+ role
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabase();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser(supabase, session.user.email);
    if (!user || !hasMinRole(user.role, 'admin')) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from('station_pool')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Station archived successfully' });
  } catch (error) {
    console.error('Error archiving station:', error);
    return NextResponse.json({ success: false, error: 'Failed to archive station' }, { status: 500 });
  }
}
