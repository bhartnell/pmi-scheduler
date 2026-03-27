import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST - Public: validate an event PIN and return evaluator list
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Event code is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Find an active event matching this PIN
    const { data: event, error: eventError } = await supabase
      .from('osce_events')
      .select('id, title, subtitle, slug, start_date, end_date, status')
      .eq('event_pin', pin.trim())
      .in('status', ['open', 'closed'])
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { valid: false, error: 'Invalid event code' },
        { status: 404 }
      );
    }

    // Get observers for this event (registered evaluators)
    const { data: observers } = await supabase
      .from('osce_observers')
      .select('id, name, title, agency, role')
      .eq('event_id', event.id)
      .order('name');

    // Get faculty/instructors from lab_users
    const { data: faculty } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .in('role', ['admin', 'instructor', 'lead_instructor', 'superadmin'])
      .order('name');

    // Build evaluator list: observers first, then faculty
    interface Evaluator {
      id: string;
      name: string;
      label: string;
      role: string;
      source: 'observer' | 'faculty';
    }

    const evaluators: Evaluator[] = [];

    // Add observers
    if (observers) {
      for (const obs of observers) {
        const roleLabel = obs.role === 'md' ? 'Medical Director'
          : obs.role === 'faculty' ? 'Faculty'
          : obs.agency || 'Observer';
        evaluators.push({
          id: obs.id,
          name: obs.name,
          label: `${obs.name} (${roleLabel})`,
          role: obs.role || 'agency',
          source: 'observer',
        });
      }
    }

    // Add faculty (avoiding duplicates by name)
    const observerNames = new Set(evaluators.map(e => e.name.toLowerCase()));
    if (faculty) {
      for (const f of faculty) {
        if (!observerNames.has(f.name.toLowerCase())) {
          const roleLabel = f.role === 'admin' || f.role === 'superadmin' ? 'Faculty' : 'Faculty';
          evaluators.push({
            id: f.id,
            name: f.name,
            label: `${f.name} (${roleLabel})`,
            role: 'faculty',
            source: 'faculty',
          });
        }
      }
    }

    return NextResponse.json({
      valid: true,
      event: {
        id: event.id,
        title: event.title,
        subtitle: event.subtitle,
        start_date: event.start_date,
        end_date: event.end_date,
      },
      evaluators,
    });
  } catch (err) {
    console.error('Error validating PIN:', err);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
