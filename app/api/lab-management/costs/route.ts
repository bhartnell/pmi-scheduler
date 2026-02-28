import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

const VALID_CATEGORIES = ['Equipment', 'Consumables', 'Instructor Pay', 'External', 'Other'];

async function getAuthenticatedUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return user;
}

// GET /api/lab-management/costs
// List cost items filtered by lab_day_id, cohort_id, or date range
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('lab_day_id');
  const cohortId = searchParams.get('cohort_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  try {
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

    if (cohortId) {
      // Filter through the join — use explicit subquery via RPC or filter after
      // We'll filter in JS since Supabase nested filtering can be tricky
    }

    const { data, error } = await query;
    if (error) throw error;

    let items = data || [];

    // Apply cohort filter
    if (cohortId) {
      items = items.filter((item: any) => item.lab_day?.cohort_id === cohortId);
    }

    // Apply date range filters
    if (startDate) {
      items = items.filter((item: any) => item.lab_day?.date >= startDate);
    }
    if (endDate) {
      items = items.filter((item: any) => item.lab_day?.date <= endDate);
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { lab_day_id, category, description, unit_cost, quantity } = body;

    if (!lab_day_id) {
      return NextResponse.json({ error: 'lab_day_id is required' }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    const parsedCost = parseFloat(unit_cost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      return NextResponse.json({ error: 'unit_cost must be a non-negative number' }, { status: 400 });
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 1) {
      return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_day_costs')
      .insert({
        lab_day_id,
        category,
        description: description?.trim() || null,
        unit_cost: parsedCost,
        quantity: parsedQty,
        added_by: session.user.email,
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
