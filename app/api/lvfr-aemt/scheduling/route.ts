import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/scheduling
//
// Full coverage grid data — all 30 days with per-instructor availability.
// Instructor+ only (plus agency_liaison/agency_observer for read).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor') &&
      user.role !== 'agency_liaison' &&
      user.role !== 'agency_observer') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const dayNumber = request.nextUrl.searchParams.get('day');

  // Fetch course days
  const { data: days } = await supabase
    .from('lvfr_aemt_course_days')
    .select('day_number, date, day_of_week, week_number, module_id, day_type, title, chapters_covered, has_lab, lab_name, has_exam')
    .order('day_number', { ascending: true });

  // Fetch instructor assignments
  const { data: assignments } = await supabase
    .from('lvfr_aemt_instructor_assignments')
    .select('day_number, date, primary_instructor_id, secondary_instructor_id, additional_instructors, min_instructors, notes');

  // Fetch instructor availability
  let availQuery = supabase
    .from('lvfr_aemt_instructor_availability')
    .select('instructor_id, date, am1_available, mid_available, pm1_available, pm2_available, status, notes, source');

  if (dayNumber) {
    const dayData = (days || []).find(d => d.day_number === parseInt(dayNumber));
    if (dayData) {
      availQuery = availQuery.eq('date', dayData.date);
    }
  }

  const { data: availability } = await availQuery;

  // Fetch LVFR instructors (agency_liaison with lvfr_aemt scope, plus regular instructors)
  const { data: instructors } = await supabase
    .from('lab_users')
    .select('id, name, email, role, agency_affiliation')
    .in('role', ['superadmin', 'admin', 'lead_instructor', 'instructor', 'agency_liaison'])
    .eq('is_active', true);

  // Build assignment map
  const assignmentMap: Record<number, typeof assignments extends (infer T)[] | null ? T : never> = {};
  for (const a of assignments || []) {
    assignmentMap[a.day_number] = a;
  }

  // Build availability map: instructorId → date → availability
  const availMap: Record<string, Record<string, {
    am1: boolean; mid: boolean; pm1: boolean; pm2: boolean; status: string;
  }>> = {};
  for (const a of availability || []) {
    if (!availMap[a.instructor_id]) availMap[a.instructor_id] = {};
    availMap[a.instructor_id][a.date] = {
      am1: a.am1_available,
      mid: a.mid_available,
      pm1: a.pm1_available,
      pm2: a.pm2_available,
      status: a.status,
    };
  }

  // Build coverage grid
  const grid = (days || []).map(day => {
    const assignment = assignmentMap[day.day_number];
    const minInstructors = assignment?.min_instructors || (day.has_lab ? 2 : 1);

    // Count available instructors per block
    const blockCounts = { am1: 0, mid: 0, pm1: 0, pm2: 0 };
    const perInstructor: Record<string, { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean }> = {};

    for (const inst of instructors || []) {
      const avail = availMap[inst.id]?.[day.date];
      if (avail) {
        perInstructor[inst.id] = {
          am1: avail.am1,
          mid: avail.mid,
          pm1: avail.pm1,
          pm2: avail.pm2,
        };
        if (avail.am1) blockCounts.am1++;
        if (avail.mid) blockCounts.mid++;
        if (avail.pm1) blockCounts.pm1++;
        if (avail.pm2) blockCounts.pm2++;
      }
    }

    // Determine row status
    const allBlocksMet = Object.values(blockCounts).every(c => c >= minInstructors);
    const anyBlockZero = Object.values(blockCounts).some(c => c === 0);
    const rowStatus = allBlocksMet ? 'ok' : anyBlockZero ? 'gap' : 'short';

    return {
      ...day,
      assignment,
      minInstructors,
      blockCounts,
      perInstructor,
      rowStatus,
    };
  });

  // Gap summary
  const gaps = grid.filter(g => g.rowStatus !== 'ok');
  const labGaps = gaps.filter(g => g.has_lab);

  return NextResponse.json({
    grid,
    instructors: instructors || [],
    gaps: {
      total: gaps.length,
      labDayGaps: labGaps.length,
      days: gaps.map(g => ({ day_number: g.day_number, date: g.date, status: g.rowStatus, has_lab: g.has_lab })),
    },
  });
}

// ---------------------------------------------------------------------------
// PUT /api/lvfr-aemt/scheduling
//
// Assign instructors to a day.
// Body: { day_number, primary_instructor_id?, secondary_instructor_id?, min_instructors? }
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { day_number, primary_instructor_id, secondary_instructor_id, min_instructors } = body;

  if (!day_number) {
    return NextResponse.json({ error: 'day_number is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Get the day's date
  const { data: dayData } = await supabase
    .from('lvfr_aemt_course_days')
    .select('date')
    .eq('day_number', day_number)
    .single();

  if (!dayData) {
    return NextResponse.json({ error: 'Day not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('lvfr_aemt_instructor_assignments')
    .upsert({
      day_number,
      date: dayData.date,
      primary_instructor_id: primary_instructor_id || null,
      secondary_instructor_id: secondary_instructor_id || null,
      min_instructors: min_instructors || 1,
    }, { onConflict: 'day_number' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/scheduling
//
// Calculate availability from shift patterns and store.
// Body: { instructor_id, pattern_type, pattern_config }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { instructor_id, pattern_type, pattern_config } = body;

  if (!instructor_id || !pattern_type) {
    return NextResponse.json({ error: 'instructor_id and pattern_type are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Save the shift pattern
  const { error: patternError } = await supabase
    .from('lvfr_aemt_shift_patterns')
    .upsert({
      instructor_id,
      pattern_type,
      pattern_config: pattern_config || {},
    });

  if (patternError) {
    return NextResponse.json({ error: patternError.message }, { status: 500 });
  }

  // Calculate availability for all course dates
  const { data: courseDays } = await supabase
    .from('lvfr_aemt_course_days')
    .select('date')
    .order('date', { ascending: true });

  if (!courseDays || courseDays.length === 0) {
    return NextResponse.json({ success: true, message: 'Pattern saved, no course days to calculate' });
  }

  // Dynamically import shift calculator to avoid issues with server-side imports
  const { generateAvailability } = await import('@/lib/shift-calculator');

  const startDate = new Date(courseDays[0].date);
  const endDate = new Date(courseDays[courseDays.length - 1].date);

  const entries = generateAvailability(startDate, endDate, {
    pattern_type: pattern_type as '48_96' | 'weekly' | 'custom' | 'conditional',
    pattern_config: pattern_config || {},
  });

  // Only keep entries for actual course dates
  const courseDateSet = new Set(courseDays.map(d => d.date));
  const courseEntries = entries.filter(e => courseDateSet.has(e.date));

  // Upsert availability entries
  const rows = courseEntries.map(e => ({
    instructor_id,
    date: e.date,
    am1_available: e.am1_available,
    mid_available: e.mid_available,
    pm1_available: e.pm1_available,
    pm2_available: e.pm2_available,
    status: e.status,
    source: 'shift_calc' as const,
  }));

  if (rows.length > 0) {
    const { error: availError } = await supabase
      .from('lvfr_aemt_instructor_availability')
      .upsert(rows, { onConflict: 'instructor_id,date' });

    if (availError) {
      return NextResponse.json({ error: availError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, calculated: rows.length });
}
