import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { getInstructorAvailability } from '@/lib/lvfr-availability';

// POST /api/lvfr-aemt/planner/availability/reseed
// Re-generates all calculated availability rows in lvfr_aemt_instructor_availability
// for the 30 course days (Jul 7 - Sep 10, Tue/Wed/Thu).
// Only updates rows with source = 'shift_calc' or 'imported'; manual_override rows are preserved.
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Get all course days
  const { data: courseDays, error: daysError } = await supabase
    .from('lvfr_aemt_course_days')
    .select('date, day_number')
    .order('date');

  if (daysError) {
    return NextResponse.json({ error: `Failed to fetch course days: ${daysError.message}` }, { status: 500 });
  }

  if (!courseDays || courseDays.length === 0) {
    return NextResponse.json({ error: 'No course days found' }, { status: 404 });
  }

  // 2. Get known instructors (Jimi, Trevor, Ben + any others)
  const { data: instructors, error: instError } = await supabase
    .from('lab_users')
    .select('id, name, email')
    .in('role', ['instructor', 'admin', 'superadmin', 'lead_instructor'])
    .eq('is_active', true);

  if (instError) {
    return NextResponse.json({ error: `Failed to fetch instructors: ${instError.message}` }, { status: 500 });
  }

  // 3. Delete existing calculated rows (preserve manual_override)
  const { error: deleteError } = await supabase
    .from('lvfr_aemt_instructor_availability')
    .delete()
    .in('source', ['shift_calc', 'imported']);

  if (deleteError) {
    return NextResponse.json({ error: `Failed to clear old rows: ${deleteError.message}` }, { status: 500 });
  }

  // 4. Generate new availability rows from calculation functions
  const rows: Array<{
    instructor_id: string;
    date: string;
    am1_available: boolean;
    mid_available: boolean;
    pm1_available: boolean;
    pm2_available: boolean;
    status: string;
    notes: string;
    source: string;
  }> = [];

  for (const day of courseDays) {
    const dateStr = typeof day.date === 'string' ? day.date.split('T')[0] : day.date;

    for (const inst of instructors || []) {
      const result = getInstructorAvailability(inst.name, new Date(dateStr + 'T12:00:00'));
      if (result) {
        rows.push({
          instructor_id: inst.id,
          date: dateStr,
          am1_available: result.blocks.am1,
          mid_available: result.blocks.mid,
          pm1_available: result.blocks.pm1,
          pm2_available: result.blocks.pm2,
          status: result.status,
          notes: result.notes,
          source: 'shift_calc',
        });
      }
    }
  }

  // 5. Upsert rows in batches (Supabase has a row limit per request)
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error: upsertError } = await supabase
      .from('lvfr_aemt_instructor_availability')
      .upsert(batch, { onConflict: 'instructor_id,date' });

    if (upsertError) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${upsertError.message}`);
    } else {
      inserted += batch.length;
    }
  }

  // 6. Verify
  const { count } = await supabase
    .from('lvfr_aemt_instructor_availability')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    success: errors.length === 0,
    inserted,
    total_rows: count,
    course_days: courseDays.length,
    instructors_processed: (instructors || []).filter(i => {
      const name = i.name.toLowerCase();
      return name.includes('jimi') || name.includes('trevor') || name.includes('ben') || name.includes('hartnell');
    }).length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Reseeded ${inserted} availability rows for ${courseDays.length} course days. Manual overrides preserved.`,
  });
}
