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
// PUT /api/admin/equipment/maintenance/[id]
//
// Update a maintenance record. Supports marking as completed.
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await request.json() as {
      maintenance_type?: string;
      description?: string | null;
      scheduled_date?: string | null;
      completed_date?: string | null;
      completed_by?: string | null;
      next_due_date?: string | null;
      cost?: number | null;
      status?: string;
      notes?: string | null;
    };

    const supabase = getSupabaseAdmin();

    // Verify the record exists
    const { data: existing, error: fetchError } = await supabase
      .from('equipment_maintenance')
      .select('id, equipment_item_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 });
    }

    const allowed = [
      'maintenance_type', 'description', 'scheduled_date', 'completed_date',
      'completed_by', 'next_due_date', 'cost', 'status', 'notes',
    ];

    const safeUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of allowed) {
      if (key in body) {
        safeUpdates[key] = (body as Record<string, unknown>)[key];
      }
    }

    // Auto-fill completed_by when marking as completed
    if (body.status === 'completed' && !body.completed_by) {
      safeUpdates.completed_by = currentUser.email;
    }

    const { data, error } = await supabase
      .from('equipment_maintenance')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    // Sync equipment last/next maintenance dates when completing
    if (body.status === 'completed') {
      const completedDate = body.completed_date ?? new Date().toISOString().split('T')[0];
      await supabase
        .from('equipment')
        .update({
          last_maintenance: completedDate,
          next_maintenance: body.next_due_date ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.equipment_item_id);
    }

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('Error updating maintenance record:', error);
    return NextResponse.json({ error: 'Failed to update maintenance record' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/equipment/maintenance/[id]
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('equipment_maintenance')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting maintenance record:', error);
    return NextResponse.json({ error: 'Failed to delete maintenance record' }, { status: 500 });
  }
}
