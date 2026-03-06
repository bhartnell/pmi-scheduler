import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: export observers for this event as CSV
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Get event for filename
    const { data: event } = await supabase
      .from('osce_events')
      .select('slug')
      .eq('id', id)
      .single();

    // Get all observers for this event
    const { data: observers, error: observersError } = await supabase
      .from('osce_observers')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false });

    if (observersError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch observers' },
        { status: 500 }
      );
    }

    if (!observers || observers.length === 0) {
      // Return empty CSV with headers only
      const headers = ['Name', 'Title', 'Agency', 'Email', 'Phone', 'Role', 'Blocks', 'Agency Preference', 'Agency Note', 'Registered'];
      const filename = event?.slug ? `osce-observers-${event.slug}.csv` : 'osce-observers.csv';
      return new NextResponse(headers.join(',') + '\n', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=${filename}`,
        },
      });
    }

    // Get all observer-block assignments with block details for these observers
    const observerIds = observers.map((o) => o.id);
    const { data: observerBlocks, error: blocksError } = await supabase
      .from('osce_observer_blocks')
      .select('observer_id, osce_time_blocks(label, date, start_time, end_time)')
      .in('observer_id', observerIds);

    if (blocksError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch observer blocks' },
        { status: 500 }
      );
    }

    // Group blocks by observer_id
    const blocksByObserver: Record<string, string[]> = {};
    if (observerBlocks) {
      for (const ob of observerBlocks) {
        if (!blocksByObserver[ob.observer_id]) {
          blocksByObserver[ob.observer_id] = [];
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blockData = ob.osce_time_blocks as any;
        if (blockData) {
          blocksByObserver[ob.observer_id].push(
            `${blockData.label} (${blockData.date} ${blockData.start_time}-${blockData.end_time})`
          );
        }
      }
    }

    // Build CSV
    const headers = ['Name', 'Title', 'Agency', 'Email', 'Phone', 'Role', 'Blocks', 'Agency Preference', 'Agency Note', 'Registered'];
    const escapeCSV = (val: string | null | undefined) => {
      if (!val) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = observers.map((obs) => [
      escapeCSV(obs.name),
      escapeCSV(obs.title),
      escapeCSV(obs.agency),
      escapeCSV(obs.email),
      escapeCSV(obs.phone),
      escapeCSV(obs.role),
      escapeCSV((blocksByObserver[obs.id] || []).join('; ')),
      obs.agency_preference ? 'Yes' : 'No',
      escapeCSV(obs.agency_preference_note),
      escapeCSV(obs.created_at ? new Date(obs.created_at).toLocaleDateString() : ''),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = event?.slug ? `osce-observers-${event.slug}.csv` : 'osce-observers.csv';

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error('Error exporting observers:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
