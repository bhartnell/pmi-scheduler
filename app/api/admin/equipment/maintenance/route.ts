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
// GET /api/admin/equipment/maintenance
//
// Query params:
//   ?equipment_id=  - filter by equipment (optional)
//   ?status=        - filter by status: scheduled|completed|overdue|cancelled (optional)
//   ?from=          - ISO date, filter scheduled_date >= from (optional)
//   ?to=            - ISO date, filter scheduled_date <= to (optional)
//   ?upcoming_days= - number, return records with next_due_date within N days (optional)
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
    const equipmentId = searchParams.get('equipment_id');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const upcomingDays = searchParams.get('upcoming_days');

    let query = supabase
      .from('equipment_maintenance')
      .select(`
        *,
        equipment:equipment_id (id, name, category, location, condition)
      `)
      .order('scheduled_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (equipmentId) {
      query = query.eq('equipment_id', equipmentId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (from) {
      query = query.gte('scheduled_date', from);
    }

    if (to) {
      query = query.lte('scheduled_date', to);
    }

    if (upcomingDays) {
      const days = parseInt(upcomingDays, 10);
      if (!isNaN(days)) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        query = query.lte('next_due_date', futureDate.toISOString().split('T')[0]);
        query = query.not('next_due_date', 'is', null);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    // Count overdue records (scheduled but past their scheduled_date)
    const today = new Date().toISOString().split('T')[0];
    const { count: overdueCount } = await supabase
      .from('equipment_maintenance')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .lt('scheduled_date', today);

    return NextResponse.json({
      success: true,
      records: data ?? [],
      overdueCount: overdueCount ?? 0,
    });
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    return NextResponse.json({ error: 'Failed to fetch maintenance records' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/equipment/maintenance
//
// Body: { equipment_id, maintenance_type, description?, scheduled_date?,
//         completed_date?, completed_by?, next_due_date?, cost?, status?,
//         notes? }
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
      equipment_id: string;
      maintenance_type: string;
      description?: string | null;
      scheduled_date?: string | null;
      completed_date?: string | null;
      completed_by?: string | null;
      next_due_date?: string | null;
      cost?: number | null;
      status?: string;
      notes?: string | null;
    };

    const { equipment_id, maintenance_type } = body;

    if (!equipment_id || !maintenance_type) {
      return NextResponse.json(
        { error: 'equipment_id and maintenance_type are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify the equipment exists
    const { data: equipment, error: equipError } = await supabase
      .from('equipment')
      .select('id, name')
      .eq('id', equipment_id)
      .single();

    if (equipError || !equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const record = {
      equipment_id,
      maintenance_type: maintenance_type.trim(),
      description: body.description ?? null,
      scheduled_date: body.scheduled_date ?? null,
      completed_date: body.completed_date ?? null,
      completed_by: body.completed_by ?? (body.status === 'completed' ? currentUser.email : null),
      next_due_date: body.next_due_date ?? null,
      cost: body.cost ?? null,
      status: body.status ?? 'scheduled',
      notes: body.notes ?? null,
    };

    const { data, error } = await supabase
      .from('equipment_maintenance')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    // If completing maintenance, update the equipment's last_maintenance and next_maintenance fields
    if (body.status === 'completed' && body.completed_date) {
      await supabase
        .from('equipment')
        .update({
          last_maintenance: body.completed_date,
          next_maintenance: body.next_due_date ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', equipment_id);
    }

    return NextResponse.json({ success: true, record: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance record:', error);
    return NextResponse.json({ error: 'Failed to create maintenance record' }, { status: 500 });
  }
}
