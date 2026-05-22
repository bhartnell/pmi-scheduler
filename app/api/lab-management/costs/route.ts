import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// Two-way category mapping. The lab_day_costs table has a CHECK
// constraint that only accepts snake_case values ('equipment',
// 'instructor_pay', etc.), but the client UI and copy here use
// Title Case ('Equipment', 'Instructor Pay'). Without this map,
// every POST violated the CHECK and returned 500 — surfaced
// 2026-05-21 when Ryan tried to log instructor pay.
const DISPLAY_TO_DB: Record<string, string> = {
  'Equipment': 'equipment',
  'Consumables': 'consumables',
  'Instructor Pay': 'instructor_pay',
  'External': 'external',
  'Other': 'other',
};
// Accept either form on input — operators / future clients may
// send the snake_case directly. The reverse map is built from
// the display map so the two never drift.
const VALID_CATEGORY_INPUTS = new Set<string>([
  ...Object.keys(DISPLAY_TO_DB),
  ...Object.values(DISPLAY_TO_DB),
]);
const DB_TO_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(DISPLAY_TO_DB).map(([k, v]) => [v, k]),
);
function normalizeCategoryForDb(input: string): string | null {
  if (!input) return null;
  // Already snake_case → pass through if valid.
  if (input in DB_TO_DISPLAY) return input;
  // Title Case → translate.
  if (input in DISPLAY_TO_DB) return DISPLAY_TO_DB[input];
  return null;
}
function categoryForDisplay(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return DB_TO_DISPLAY[stored] ?? stored; // fall back to the raw value
}
const VALID_CATEGORIES = Object.keys(DISPLAY_TO_DB); // kept for error message readability

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
      // Map stored snake_case → display Title Case before returning.
      const items = (data ?? []).map(it => ({ ...it, category: categoryForDisplay(it.category) }));
      return NextResponse.json({ success: true, items });
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

    let items = (data || []).map(it => ({ ...it, category: categoryForDisplay(it.category) }));

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
    // The lab day page treats costs as a side fetch — a 500 here
    // would render an error banner over the whole page even though
    // the rest of the day's data is fine. Degrade to empty so the
    // page still loads; log so we can dig into the root cause.
    console.error('Error fetching lab costs:', error);
    return NextResponse.json({
      success: true,
      items: [],
      error_code: 'fetch_failed',
      error: error instanceof Error ? error.message : 'Unknown',
    });
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
    if (!category || !VALID_CATEGORY_INPUTS.has(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }
    const dbCategory = normalizeCategoryForDb(category);
    if (!dbCategory) {
      // Defensive — VALID_CATEGORY_INPUTS already filtered this,
      // but make the failure explicit if the map drifts.
      return NextResponse.json(
        { error: `category "${category}" could not be normalized for storage` },
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
        category: dbCategory,
        description: description.trim(),
        amount: parsedAmount,
        created_by: session.user.email,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Translate the stored snake_case value back to the display
    // label the client renders. Keeps the GET/POST/PUT response
    // shapes identical to what the UI was already wired for.
    return NextResponse.json({
      success: true,
      item: { ...data, category: categoryForDisplay(data.category) },
    });
  } catch (error) {
    console.error('Error creating cost item:', error);
    return NextResponse.json({ success: false, error: 'Failed to create cost item' }, { status: 500 });
  }
}
