import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/adv-cert/record-flags?cohortId=...
// Read-only. Lists megacode attempts for a cohort whose record is INCOMPLETE
// (overall set, a segment unmarked) or CONTRADICTORY (overall pass, a segment
// failed). Used to offer resolve-now / proceed-anyway before an AHA export.
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const cohortId = request.nextUrl.searchParams.get('cohortId');
  if (!cohortId) {
    return NextResponse.json({ success: false, error: 'cohortId is required' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data: days, error: dErr } = await supabase
      .from('lab_days').select('id, date').eq('cohort_id', cohortId);
    if (dErr) throw dErr;
    const dayIds = (days || []).map((d) => d.id);
    if (!dayIds.length) return NextResponse.json({ success: true, flagged: [] });

    const { data: att, error } = await supabase
      .from('adv_cert_test_attempts')
      .select(`id, lab_day_id, overall_result,
        team_lead:students!adv_cert_test_attempts_team_lead_id_fkey(first_name, last_name),
        scenario:scenarios!adv_cert_test_attempts_scenario_id_fkey(case_code, name:title),
        segment_results:adv_cert_segment_results(result)`)
      .in('lab_day_id', dayIds);
    if (error) throw error;

    const dateById = new Map((days || []).map((d) => [d.id, d.date]));
    const flagged = (att || []).flatMap((a: any) => {
      const segs: { result: string | null }[] = a.segment_results || [];
      const unmarked = segs.filter((s) => s.result == null).length;
      const failed = segs.filter((s) => s.result === 'fail').length;
      const flags: string[] = [];
      if (a.overall_result && unmarked > 0) flags.push('incomplete');
      if (a.overall_result === 'pass' && failed > 0) flags.push('contradictory');
      if (!flags.length) return [];
      const tl = Array.isArray(a.team_lead) ? a.team_lead[0] : a.team_lead;
      const sc = Array.isArray(a.scenario) ? a.scenario[0] : a.scenario;
      return [{
        id: a.id,
        date: dateById.get(a.lab_day_id) ?? null,
        team_lead: tl ? `${tl.first_name} ${tl.last_name}` : null,
        scenario: sc?.case_code || sc?.name || null,
        overall_result: a.overall_result,
        flags,
        segments_unmarked: unmarked,
      }];
    });
    return NextResponse.json({ success: true, flagged });
  } catch (error) {
    console.error('Error loading record flags:', error);
    return NextResponse.json({ success: false, error: 'Failed to load record flags' }, { status: 500 });
  }
}
