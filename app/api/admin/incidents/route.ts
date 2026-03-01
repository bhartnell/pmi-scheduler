import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/incidents
//
// Query params:
//   ?status=   - filter by status: open|investigating|resolved|closed (optional)
//   ?severity= - filter by severity: minor|moderate|major|critical (optional)
//   ?from=     - ISO date, filter incident_date >= from (optional)
//   ?to=       - ISO date, filter incident_date <= to (optional)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const severityFilter = searchParams.get('severity');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase
      .from('incidents')
      .select('*')
      .order('incident_date', { ascending: false })
      .order('created_at', { ascending: false });

    const validStatuses = ['open', 'investigating', 'resolved', 'closed'];
    if (statusFilter && validStatuses.includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const validSeverities = ['minor', 'moderate', 'major', 'critical'];
    if (severityFilter && validSeverities.includes(severityFilter)) {
      query = query.eq('severity', severityFilter);
    }

    if (from) {
      query = query.gte('incident_date', from);
    }

    if (to) {
      query = query.lte('incident_date', to);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Summary counts for stats
    const { data: allStatuses, error: countError } = await supabase
      .from('incidents')
      .select('status, severity');

    if (countError) throw countError;

    const stats = {
      open: 0,
      investigating: 0,
      resolved: 0,
      closed: 0,
      minor: 0,
      moderate: 0,
      major: 0,
      critical: 0,
    };

    for (const row of allStatuses ?? []) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats]++;
      }
      if (row.severity in stats) {
        stats[row.severity as keyof typeof stats]++;
      }
    }

    return NextResponse.json({
      success: true,
      incidents: data ?? [],
      stats,
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/incidents
//
// Body: { incident_date, incident_time?, location, severity?, description,
//         people_involved?, actions_taken?, follow_up_required?,
//         follow_up_notes?, witness_statements? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      incident_date: string;
      incident_time?: string | null;
      location: string;
      severity?: string;
      description: string;
      people_involved?: string | null;
      actions_taken?: string | null;
      follow_up_required?: boolean;
      follow_up_notes?: string | null;
      witness_statements?: string | null;
    };

    const { incident_date, location, description } = body;

    if (!incident_date || !location?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'incident_date, location, and description are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const record = {
      incident_date,
      incident_time: body.incident_time ?? null,
      location: location.trim(),
      severity: body.severity ?? 'minor',
      description: description.trim(),
      people_involved: body.people_involved?.trim() ?? null,
      actions_taken: body.actions_taken?.trim() ?? null,
      follow_up_required: body.follow_up_required ?? false,
      follow_up_notes: body.follow_up_notes?.trim() ?? null,
      witness_statements: body.witness_statements?.trim() ?? null,
      status: 'open',
      reported_by: currentUser.email,
    };

    const { data, error } = await supabase
      .from('incidents')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, incident: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}
