import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { loadAgencyAliases } from '@/lib/agency-aliases';
import { canonicalAgency, agencyMatches } from '@/lib/agency-match';
import { matchOsceStudentName } from '@/lib/osce-student-match';

// GET - Admin: evaluators' agency/student preferences per block, resolved against the cohort's students.agency
// through the agency_aliases map. Read-only; nothing is written back.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: event, error: eventError } = await supabase
      .from('osce_events')
      .select('id, cohort_id')
      .eq('id', id)
      .single();
    if (eventError || !event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    const [blocksRes, observersRes, scheduleRes, aliases] = await Promise.all([
      supabase.from('osce_time_blocks').select('id, label').eq('event_id', id),
      supabase.from('osce_observers')
        .select('id, name, agency, preferred_agency, preferred_student_name, agency_preference_note, osce_observer_blocks(block_id)')
        .eq('event_id', id)
        .eq('agency_preference', true),
      supabase.from('osce_student_schedule').select('student_name, time_block_id').eq('event_id', id),
      loadAgencyAliases(supabase),
    ]);
    if (blocksRes.error || observersRes.error || scheduleRes.error) {
      console.error('agency-matches query error', blocksRes.error, observersRes.error, scheduleRes.error);
      return NextResponse.json({ success: false, error: 'Failed to load OSCE data' }, { status: 500 });
    }

    let students: { id: string; first_name: string; last_name: string; agency: string | null }[] = [];
    if (event.cohort_id) {
      const { data, error } = await supabase
        .from('students').select('id, first_name, last_name, agency').eq('cohort_id', event.cohort_id);
      if (error) {
        console.error('agency-matches students error', error);
        return NextResponse.json({ success: false, error: 'Failed to load students' }, { status: 500 });
      }
      students = data ?? [];
    }

    // Who is scheduled where (display-time name match; free-text OSCE names have no FK to students).
    const blockLabel = new Map((blocksRes.data ?? []).map(b => [b.id as string, b.label as string]));
    const scheduled = (scheduleRes.data ?? []).map(row => {
      const m = students.length ? matchOsceStudentName(row.student_name, students) : null;
      return {
        blockId: row.time_block_id as string,
        name: row.student_name as string,
        student: m?.student ?? null,
        confirmed: m ? m.confidence !== 'surname_ambiguous' : false,
      };
    });

    const requests = (observersRes.data ?? [])
      .filter(o => o.preferred_agency || o.preferred_student_name)
      .map(o => {
        const blockIds = ((o.osce_observer_blocks ?? []) as { block_id: string }[]).map(b => b.block_id);
        const agencyStudents = o.preferred_agency
          ? students.filter(s => agencyMatches(o.preferred_agency as string, canonicalAgency(s.agency, aliases)))
          : [];
        const wanted = new Set(agencyStudents.map(s => s.id));
        const requestedName = (o.preferred_student_name ?? null) as string | null;
        const perBlock = blockIds.map(bid => {
          const here = scheduled.filter(x => x.blockId === bid);
          return {
            block_id: bid,
            block_label: blockLabel.get(bid) ?? bid,
            matching_students: here
              .filter(x => x.student && wanted.has(x.student.id))
              .map(x => ({ name: x.name, confirmed: x.confirmed })),
            requested_student_here: requestedName
              ? here.some(x => x.student && matchOsceStudentName(requestedName, [x.student]))
              : false,
          };
        });
        const satisfied = perBlock.some(b => b.matching_students.length > 0 || b.requested_student_here);
        // Cohort students for the requested agency and where they sit now, so one can be moved into the evaluator's block.
        const candidates = agencyStudents.map(s => {
          const slot = scheduled.find(x => x.student?.id === s.id);
          return { name: `${s.first_name} ${s.last_name}`, scheduled_block: slot ? blockLabel.get(slot.blockId) ?? null : null };
        });
        return {
          observer_id: o.id as string,
          observer_name: o.name as string,
          observer_agency: o.agency as string,
          preferred_agency: (o.preferred_agency ?? null) as string | null,
          preferred_student_name: requestedName,
          note: (o.agency_preference_note ?? null) as string | null,
          blocks: perBlock,
          satisfied,
          agency_student_count: agencyStudents.length,
          candidates,
        };
      });

    return NextResponse.json({
      success: true,
      cohort_linked: !!event.cohort_id,
      awaiting_scheduling: requests.filter(r => !r.satisfied).length,
      requests,
    });
  } catch (error) {
    console.error('Error computing agency matches:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
