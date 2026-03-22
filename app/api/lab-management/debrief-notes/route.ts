import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/lab-management/debrief-notes
// Cross-lab-day debrief notes for semester review
// Query params: startDate, endDate, cohortId, category
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const cohortId = searchParams.get('cohortId');
  const category = searchParams.get('category');

  const supabase = getSupabaseAdmin();

  try {
    let query = supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        week_number,
        day_number,
        cohort_id,
        cohort:cohorts(id, cohort_number, program:programs(abbreviation)),
        debrief_notes:lab_day_debrief_notes(id, author_name, category, content, created_at)
      `)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data: labDays, error } = await query;

    if (error) {
      if ((error as Error).message?.includes('does not exist')) {
        return NextResponse.json({ success: true, labDays: [] });
      }
      throw error;
    }

    // Filter lab days that have notes, and optionally filter by category
    let filtered = (labDays || []).filter((ld) => {
      const notes = ld.debrief_notes || [];
      if (notes.length === 0) return false;
      if (category) {
        return notes.some((n) => n.category === category);
      }
      return true;
    });

    // If category filter, also filter the notes within each lab day
    if (category) {
      filtered = filtered.map((ld) => ({
        ...ld,
        debrief_notes: (ld.debrief_notes || []).filter((n) => n.category === category),
      }));
    }

    return NextResponse.json({ success: true, labDays: filtered });
  } catch (error: unknown) {
    const msg = error instanceof Error ? (error as Error).message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: true, labDays: [] });
    }
    console.error('Error fetching cross-lab debrief notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch debrief notes' },
      { status: 500 }
    );
  }
}
