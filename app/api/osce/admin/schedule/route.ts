import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    // Get all time blocks
    const { data: blocks } = await supabase
      .from('osce_time_blocks')
      .select('*')
      .order('sort_order');

    // Get observers with their blocks
    const { data: observers } = await supabase
      .from('osce_observers')
      .select(`
        id, name, agency, email,
        blocks:osce_observer_blocks(time_block_id)
      `);

    // Get students
    const { data: students } = await supabase
      .from('osce_student_schedule')
      .select('*')
      .order('slot_number');

    // Get agency mappings
    const { data: agencyMappings } = await supabase
      .from('osce_student_agencies')
      .select('*');

    // Build schedule per block
    const schedule = (blocks || []).map(block => {
      const blockObservers = (observers || []).filter(o =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        o.blocks?.some((b: any) => b.time_block_id === block.id)
      ).map(o => ({ id: o.id, name: o.name, agency: o.agency, email: o.email }));

      const blockStudents = (students || []).filter(s =>
        s.time_block_id === block.id
      ).map(s => ({ id: s.id, name: s.student_name, slot: s.slot_number }));

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
