import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: list all OSCE events
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();

    // Get all events ordered by start_date descending
    const { data: events, error: eventsError } = await supabase
      .from('osce_events')
      .select('*')
      .order('start_date', { ascending: false });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // Get observer counts per event
    const { data: observerCounts, error: obsError } = await supabase
      .from('osce_observers')
      .select('event_id');

    if (obsError) {
      console.error('Error fetching observer counts:', obsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch observer counts' },
        { status: 500 }
      );
    }

    // Get block counts per event
    const { data: blockCounts, error: blockError } = await supabase
      .from('osce_time_blocks')
      .select('event_id');

    if (blockError) {
      console.error('Error fetching block counts:', blockError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch block counts' },
        { status: 500 }
      );
    }

    // Build count maps
    const obsCountMap: Record<string, number> = {};
    if (observerCounts) {
      for (const row of observerCounts) {
        obsCountMap[row.event_id] = (obsCountMap[row.event_id] || 0) + 1;
      }
    }

    const blockCountMap: Record<string, number> = {};
    if (blockCounts) {
      for (const row of blockCounts) {
        blockCountMap[row.event_id] = (blockCountMap[row.event_id] || 0) + 1;
      }
    }

    const eventsWithCounts = (events || []).map((event) => ({
      ...event,
      observer_count: obsCountMap[event.id] || 0,
      block_count: blockCountMap[event.id] || 0,
    }));

    return NextResponse.json({ success: true, events: eventsWithCounts });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Admin: create a new OSCE event
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      title,
      subtitle,
      slug,
      description,
      location,
      start_date,
      end_date,
      max_observers_per_block,
      status,
    } = body;

    if (!title || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: 'Title, start_date, and end_date are required' },
        { status: 400 }
      );
    }

    // Auto-generate slug from title if not provided
    const eventSlug = slug
      ? slug.trim()
      : title
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

    const supabase = getSupabaseAdmin();

    const { data: event, error } = await supabase
      .from('osce_events')
      .insert({
        title: title.trim(),
        subtitle: subtitle?.trim() || null,
        slug: eventSlug,
        description: description?.trim() || null,
        location: location?.trim() || null,
        start_date,
        end_date,
        max_observers_per_block: max_observers_per_block || 4,
        status: status || 'draft',
        created_by: auth.user.email,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation on slug
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'An event with this slug already exists' },
          { status: 409 }
        );
      }
      console.error('Error creating event:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
