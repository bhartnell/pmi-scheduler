import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

const VALID_CATEGORIES = ['Equipment', 'Consumables', 'Instructor Pay', 'External', 'Other'];

// GET /api/lab-management/costs
// List cost items filtered by lab_day_id, cohort_id, or date range
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const labDayId = searchParams.get('lab_day_id');
    const cohortId = searchParams.get('cohort_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (labDayId) {
      // Simple fetch for a specific lab day
      const { data, error } = await supabase
        .from('lab_day_costs')
        .select('*')
        .eq('lab_day_id', labDayId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, items: data || [] });
    }

    // Cohort/date range query — joins through lab_days
    let query = supabase
      .from('lab_day_costs')
      .select(`
        *,
        lab_day:lab_days(
          id,
          date,
          title,
          cohort_id,
          cohort:cohorts(
            id,
            cohort_number,
            program:programs(name, abbreviation)
          )
        )
      `)
      .order('created_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    let items = data || [];

    // Apply cohort filter
    if (cohortId) {
      items = items.filter((item) => item.lab_day?.cohort_id === cohortId);
    }

    // Apply date range filters
    if (startDate) {
      items = items.filter((item) => item.lab_day?.date >= startDate);
    }
    if (endDate) {
      items = items.filter((item) => item.lab_day?.date <= endDate);
    }

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching lab costs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch costs' }, { status: 500 });
  }
}

// POST /api/lab-management/costs
// Add a new cost line item
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { lab_day_id, category, description, amount } = body;

    if (!lab_day_id) {
      return NextResponse.json({ error: 'lab_day_id is required' }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_day_costs')
      .insert({
        lab_day_id,
        category,
        description: description.trim(),
        amount: parsedAmount,
        created_by: session.user.email,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Error creating cost item:', error);
    return NextResponse.json({ success: false, error: 'Failed to create cost item' }, { status: 500 });
  }
}
