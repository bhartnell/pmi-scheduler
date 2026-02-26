import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ─── GET: Check if a specific assignment would exceed capacity ────────────────
// Query params: ?site_id=X&source=agency|clinical_site&date=YYYY-MM-DD&student_count=N
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('site_id');
    const source = searchParams.get('source') || 'agency'; // 'agency' | 'clinical_site'
    const dateParam = searchParams.get('date');
    const additionalCount = parseInt(searchParams.get('student_count') || '1', 10);

    if (!siteId) {
      return NextResponse.json({ success: false, error: 'site_id is required' }, { status: 400 });
    }

    if (!['agency', 'clinical_site'].includes(source)) {
      return NextResponse.json({ success: false, error: 'source must be "agency" or "clinical_site"' }, { status: 400 });
    }

    // ── 1. Fetch the site's capacity settings ─────────────────────────────────
    const table = source === 'agency' ? 'agencies' : 'clinical_sites';
    const { data: site, error: siteError } = await supabase
      .from(table)
      .select('id, name, max_students_per_day, max_students_per_rotation')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    const maxPerDay = site.max_students_per_day ?? 2;

    // ── 2. Count current students for that date ───────────────────────────────
    let currentCount = 0;

    if (source === 'agency') {
      let query = supabase
        .from('student_internships')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', siteId)
        .not('status', 'in', '("completed","withdrawn")');

      if (dateParam) {
        query = query.eq('placement_date', dateParam);
      }

      const { count, error: countError } = await query;
      if (countError) throw countError;
      currentCount = count ?? 0;
    } else {
      // clinical_site: count via site visits
      let query = supabase
        .from('clinical_site_visits')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId);

      if (dateParam) {
        query = query.eq('visit_date', dateParam);
      }

      const { count, error: countError } = await query;
      if (!countError) {
        currentCount = count ?? 0;
      }
    }

    // ── 3. Evaluate capacity ──────────────────────────────────────────────────
    const projected = currentCount + additionalCount;
    const allowed = projected <= maxPerDay;
    const wouldExceed = projected > maxPerDay;

    let message: string;
    if (allowed) {
      message = `OK: ${projected} of ${maxPerDay} student${maxPerDay === 1 ? '' : 's'} (${Math.round((projected / maxPerDay) * 100)}% capacity)`;
    } else {
      const over = projected - maxPerDay;
      message = `Over capacity: would be ${projected} students (max ${maxPerDay}) — ${over} over limit`;
    }

    return NextResponse.json({
      success: true,
      site_id: siteId,
      site_name: site.name,
      source,
      date: dateParam ?? null,
      allowed,
      would_exceed: wouldExceed,
      current: currentCount,
      additional_requested: additionalCount,
      projected,
      max: maxPerDay,
      utilization_percentage: maxPerDay > 0 ? Math.round((projected / maxPerDay) * 100) : 0,
      message,
    });
  } catch (error) {
    console.error('Error checking capacity:', error);
    return NextResponse.json({ success: false, error: 'Failed to check capacity' }, { status: 500 });
  }
}
