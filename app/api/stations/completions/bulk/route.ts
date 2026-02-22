import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasMinRole } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

// Helper to get current user with role
async function getCurrentUser(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data: user, error } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();

  if (error || !user) return null;
  return user;
}

interface BulkCompletionItem {
  student_id: string;
  station_id: string;
  result: 'pass' | 'needs_review' | 'incomplete';
  notes?: string;
}

/**
 * POST /api/stations/completions/bulk
 * Log multiple station completions at once
 * Useful for instructors logging multiple students at a station
 * Requires instructor+ role
 *
 * Body: {
 *   completions: BulkCompletionItem[],
 *   lab_day_id?: string,  // Optional: applies to all completions
 *   completed_at?: string  // Optional: applies to all completions
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser(supabase, session.user.email);
    if (!user || !hasMinRole(user.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Instructor access required' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.completions || !Array.isArray(body.completions) || body.completions.length === 0) {
      return NextResponse.json({ success: false, error: 'Completions array is required' }, { status: 400 });
    }

    if (body.completions.length > 50) {
      return NextResponse.json({ success: false, error: 'Maximum 50 completions per request' }, { status: 400 });
    }

    // Validate each completion
    const validResults = ['pass', 'needs_review', 'incomplete'];
    for (let i = 0; i < body.completions.length; i++) {
      const c = body.completions[i];
      if (!c.student_id) {
        return NextResponse.json({ success: false, error: `Completion ${i + 1}: student_id is required` }, { status: 400 });
      }
      if (!c.station_id) {
        return NextResponse.json({ success: false, error: `Completion ${i + 1}: station_id is required` }, { status: 400 });
      }
      if (!c.result || !validResults.includes(c.result)) {
        return NextResponse.json({ success: false, error: `Completion ${i + 1}: valid result is required` }, { status: 400 });
      }
    }

    const completedAt = body.completed_at || new Date().toISOString();

    // Build insert data
    const insertData = body.completions.map((c: BulkCompletionItem) => ({
      student_id: c.student_id,
      station_id: c.station_id,
      result: c.result,
      completed_at: completedAt,
      logged_by: user.id,
      lab_day_id: body.lab_day_id || null,
      notes: c.notes?.trim() || null,
    }));

    const { data: completions, error } = await supabase
      .from('station_completions')
      .insert(insertData)
      .select(`
        *,
        student:students(id, first_name, last_name),
        station:station_pool(id, station_code, station_name, category),
        logged_by_user:lab_users!station_completions_logged_by_fkey(id, name)
      `);

    if (error) {
      console.error('Error logging bulk completions:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      completions,
      count: completions?.length || 0
    });
  } catch (error) {
    console.error('Error logging bulk completions:', error);
    return NextResponse.json({ success: false, error: 'Failed to log completions' }, { status: 500 });
  }
}
