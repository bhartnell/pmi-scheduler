import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/dashboard/next-cert-day?today=YYYY-MM-DD
 *
 * Read-only. The next non-archived lab day that is an AHA certification day
 * (cert_course acls/pals) or an NREMT testing day, on or after `today`
 * (client-local date, so the count matches the viewer's calendar).
 * Powers "days to the next cert day" in the home stat bar.
 */
export async function GET(request: Request) {
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;

  const today = new URL(request.url).searchParams.get('today');
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return NextResponse.json({ success: false, error: 'today=YYYY-MM-DD required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('lab_days')
      .select('id, date, title, cert_course, is_nremt_testing')
      .eq('is_archived', false)
      .gte('date', today)
      .or('cert_course.not.is.null,is_nremt_testing.eq.true')
      .order('date', { ascending: true })
      .limit(1);
    if (error) throw error;

    const next = data?.[0] ?? null;
    return NextResponse.json({ success: true, next });
  } catch (error) {
    console.error('Error fetching next cert day:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch next cert day' }, { status: 500 });
  }
}
