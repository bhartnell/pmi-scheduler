import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: get schedule alignment data for this event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Get all time blocks for this event
    const { data: blocks } = await supabase
      .from('osce_time_blocks')
      .select('*')
      .eq('event_id', id)
      .order('sort_order');

    // Get observers for this event with their blocks
    const { data: observers } = await supabase
      .from('osce_observers')
      .select(`
        id, name, agency, email,
        blocks:osce_observer_blocks(block_id)
      `)
      .eq('event_id', id);

    // Get students for this event
    const { data: students } = await supabase
      .from('osce_student_schedule')
      .select('*')
      .eq('event_id', id)
      .order('slot_number');

    // A student moved after their invite was sent has a stale calendar invite (shown, never auto-fixed).
    const staleSince = new Map<string, string>(); // schedule id -> latest move time
    const sentIds = (students || []).filter(s => s.invite_sent_at).map(s => s.id);
    if (sentIds.length > 0) {
      const { data: moves } = await supabase
        .from('audit_log')
        .select('resource_id, created_at, metadata')
        .eq('resource_type', 'osce_schedule')
        .in('resource_id', sentIds);
      for (const m of moves || []) {
        if (m.metadata?.kind !== 'osce_student_move') continue;
        const prev = staleSince.get(m.resource_id);
        if (!prev || m.created_at > prev) staleSince.set(m.resource_id, m.created_at);
      }
    }

    // Get agency mappings for this event
    const { data: agencyMappings } = await supabase
      .from('osce_student_agencies')
      .select('*')
      .eq('event_id', id);

    // Build schedule per block
    const schedule = (blocks || []).map(block => {
      const blockObservers = (observers || []).filter(o =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        o.blocks?.some((b) => b.block_id === block.id)
      ).map(o => ({ id: o.id, name: o.name, agency: o.agency, email: o.email }));

      const blockStudents = (students || []).filter(s =>
        s.time_block_id === block.id
      ).map(s => {
        const moved = staleSince.get(s.id);
        return {
          id: s.id,
          name: s.student_name,
          slot: s.slot_number,
          invite_stale: !!(moved && s.invite_sent_at && moved > s.invite_sent_at),
        };
      });

      // Find agency matches
      const matches: { studentName: string; observerName: string; agency: string }[] = [];
      for (const student of blockStudents) {
        const studentAgencies = (agencyMappings || []).filter(m =>
          m.student_name.toUpperCase() === student.name.toUpperCase()
        );
        for (const mapping of studentAgencies) {
          const matchingObserver = blockObservers.find(o =>
            o.agency?.toLowerCase().includes(mapping.agency.toLowerCase()) ||
            mapping.agency.toLowerCase().includes(o.agency?.toLowerCase() || '')
          );
          if (matchingObserver) {
            matches.push({
              studentName: student.name,
              observerName: matchingObserver.name,
              agency: mapping.agency
            });
          }
        }
      }

      return {
        ...block,
        observers: blockObservers,
        students: blockStudents,
        matches,
        observerCount: blockObservers.length,
      };
    });

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error('Error fetching OSCE schedule:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
