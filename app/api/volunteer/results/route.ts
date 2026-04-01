import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/volunteer/results — admin results with registrations grouped by event
// Supports ?format=csv for CSV export
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const typeFilter = searchParams.get('type'); // instructor1, general, etc.

    // Fetch all events
    const { data: events, error: eventsErr } = await supabase
      .from('volunteer_events')
      .select('*')
      .order('date', { ascending: true });

    if (eventsErr) throw eventsErr;

    // Fetch all registrations
    let regQuery = supabase
      .from('volunteer_registrations')
      .select('*')
      .order('created_at', { ascending: true });

    if (typeFilter && typeFilter !== 'all') {
      regQuery = regQuery.eq('volunteer_type', typeFilter);
    }

    const { data: registrations, error: regErr } = await regQuery;
    if (regErr) throw regErr;

    // Group registrations by event
    const regsByEvent: Record<string, Array<Record<string, unknown>>> = {};
    for (const reg of registrations || []) {
      if (!regsByEvent[reg.event_id]) {
        regsByEvent[reg.event_id] = [];
      }
      regsByEvent[reg.event_id].push(reg);
    }

    // Build grouped results
    const results = (events || []).map((event: Record<string, unknown>) => ({
      ...event,
      registrations: regsByEvent[event.id as string] || [],
      registration_count: (regsByEvent[event.id as string] || []).length,
    }));

    // Summary stats
    const allRegs = registrations || [];
    const uniqueEmails = new Set(allRegs.map((r: Record<string, unknown>) => r.email));
    const instructor1Count = allRegs.filter((r: Record<string, unknown>) => r.volunteer_type === 'instructor1').length;
    const needsEvaluation = allRegs.filter((r: Record<string, unknown>) => r.needs_evaluation === true).length;

    const summary = {
      total_unique_volunteers: uniqueEmails.size,
      total_registrations: allRegs.length,
      instructor1_count: instructor1Count,
      general_count: allRegs.length - instructor1Count,
      needs_evaluation: needsEvaluation,
    };

    // CSV export
    if (format === 'csv') {
      const csvRows: string[] = [];
      csvRows.push('Event,Date,Name,Email,Phone,Type,Agency,Needs Evaluation,Evaluation Skill,Status,Notes');

      for (const event of results) {
        for (const reg of event.registrations as Array<Record<string, unknown>>) {
          const row = [
            `"${(event.name as string || '').replace(/"/g, '""')}"`,
            event.date as string,
            `"${(reg.name as string || '').replace(/"/g, '""')}"`,
            reg.email as string,
            reg.phone as string || '',
            reg.volunteer_type as string,
            `"${(reg.agency_affiliation as string || '').replace(/"/g, '""')}"`,
            reg.needs_evaluation ? 'Yes' : 'No',
            reg.evaluation_skill as string || '',
            reg.status as string,
            `"${(reg.notes as string || '').replace(/"/g, '""')}"`,
          ];
          csvRows.push(row.join(','));
        }
      }

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="volunteer-registrations-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: results, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
