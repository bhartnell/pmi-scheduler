import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    // 1. Fetch clinical sites
    const { data: sites } = await supabase
      .from('clinical_sites')
      .select('id, name, abbreviation, system, is_active')
      .eq('is_active', true)
      .order('name');

    const siteList = sites || [];

    // 2. Fetch clinical rotations (student assignments to sites)
    const { data: rotations } = await supabase
      .from('clinical_rotations')
      .select('id, student_id, site_id, rotation_date, status');

    // Count rotations per site and unique students per site
    const siteStats: Record<string, { rotations: number; students: Set<string>; dates: string[] }> = {};
    (rotations || []).forEach((r: any) => {
      if (!siteStats[r.site_id]) {
        siteStats[r.site_id] = { rotations: 0, students: new Set(), dates: [] };
      }
      siteStats[r.site_id].rotations++;
      siteStats[r.site_id].students.add(r.student_id);
      if (r.rotation_date) siteStats[r.site_id].dates.push(r.rotation_date);
    });

    // 3. Fetch clinical hours from student_clinical_hours
    const { data: clinicalHours } = await supabase
      .from('student_clinical_hours')
      .select('student_id, hours, site_name, category');

    // Hours by site (using site_name as key since clinical hours may not have site_id)
    const hoursBySiteName: Record<string, number> = {};
    let totalClinicalHours = 0;
    const uniqueStudentsWithHours = new Set<string>();

    (clinicalHours || []).forEach((h: any) => {
      const siteName = h.site_name || h.category || 'Unknown';
      hoursBySiteName[siteName] = (hoursBySiteName[siteName] || 0) + (h.hours || 0);
      totalClinicalHours += h.hours || 0;
      uniqueStudentsWithHours.add(h.student_id);
    });

    // 4. Build site usage data
    const siteUsage = siteList.map((site: any) => {
      const stats = siteStats[site.id] || { rotations: 0, students: new Set(), dates: [] };
      return {
        id: site.id,
        name: site.name,
        abbreviation: site.abbreviation,
        system: site.system,
        rotation_count: stats.rotations,
        student_count: stats.students.size,
        last_rotation: stats.dates.length > 0 ? stats.dates.sort().reverse()[0] : null,
      };
    });

    // 5. Hours by site for chart
    const hoursBySiteArray = Object.entries(hoursBySiteName)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours);

    // 6. Internship pipeline (from student_internships)
    const { data: internships } = await supabase
      .from('student_internships')
      .select('id, current_phase, status');

    const phaseCounts: Record<string, number> = {};
    (internships || []).forEach((i: any) => {
      const phase = i.current_phase || i.status || 'unknown';
      phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
    });

    const internshipPipeline = Object.entries(phaseCounts)
      .map(([phase, count]) => ({
        phase: formatPhase(phase),
        count,
      }))
      .sort((a, b) => {
        const order = ['Pre-Internship', 'Phase 1', 'Phase 2', 'Completed', 'Extended', 'Withdrawn'];
        return order.indexOf(a.phase) - order.indexOf(b.phase);
      });

    // 7. Summary stats
    const activeStudents = uniqueStudentsWithHours.size;
    const avgHoursPerStudent =
      activeStudents > 0 ? Math.round((totalClinicalHours / activeStudents) * 10) / 10 : 0;

    const response = NextResponse.json({
      success: true,
      total_sites: siteList.length,
      active_students: activeStudents,
      avg_hours_per_student: avgHoursPerStudent,
      total_clinical_hours: Math.round(totalClinicalHours * 10) / 10,
      site_usage: siteUsage.sort((a, b) => b.rotation_count - a.rotation_count),
      hours_by_site: hoursBySiteArray,
      internship_pipeline: internshipPipeline,
    });

    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Error generating clinical placements report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

function formatPhase(phase: string): string {
  const map: Record<string, string> = {
    pre_internship: 'Pre-Internship',
    phase_1_mentorship: 'Phase 1',
    phase_2_evaluation: 'Phase 2',
    completed: 'Completed',
    extended: 'Extended',
    withdrawn: 'Withdrawn',
    not_started: 'Not Started',
    in_progress: 'In Progress',
    on_track: 'On Track',
    at_risk: 'At Risk',
  };
  return map[phase] || phase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
