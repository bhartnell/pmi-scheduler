import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

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
// PUT /api/resources/medications/[id]
//
// Update medication. Requires admin+ role.
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await request.json() as {
      name?: string;
      brand_names?: string[];
      drug_class?: string;
      indications?: string[];
      contraindications?: string[];
      side_effects?: string[];
      routes?: string[];
      adult_dose?: string;
      pediatric_dose?: string;
      onset?: string;
      duration?: string;
      concentration?: string;
      dose_per_kg?: number | null;
      max_dose?: string;
      special_notes?: string;
      is_active?: boolean;
    };

    const supabase = getSupabaseAdmin();

    // Verify medication exists
    const { data: existing, error: fetchError } = await supabase
      .from('medications')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Medication not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.brand_names !== undefined) updates.brand_names = body.brand_names;
    if (body.drug_class !== undefined) updates.drug_class = body.drug_class;
    if (body.indications !== undefined) updates.indications = body.indications;
    if (body.contraindications !== undefined) updates.contraindications = body.contraindications;
    if (body.side_effects !== undefined) updates.side_effects = body.side_effects;
    if (body.routes !== undefined) updates.routes = body.routes;
    if (body.adult_dose !== undefined) updates.adult_dose = body.adult_dose;
    if (body.pediatric_dose !== undefined) updates.pediatric_dose = body.pediatric_dose;
    if (body.onset !== undefined) updates.onset = body.onset;
    if (body.duration !== undefined) updates.duration = body.duration;
    if (body.concentration !== undefined) updates.concentration = body.concentration;
    if (body.dose_per_kg !== undefined) updates.dose_per_kg = body.dose_per_kg;
    if (body.max_dose !== undefined) updates.max_dose = body.max_dose;
    if (body.special_notes !== undefined) updates.special_notes = body.special_notes;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { data, error } = await supabase
      .from('medications')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, medication: data });
  } catch (error) {
    console.error('Error updating medication:', error);
    return NextResponse.json({ error: 'Failed to update medication' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/resources/medications/[id]
//
// Soft-delete medication (set is_active=false). Requires admin+ role.
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('medications')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting medication:', error);
    return NextResponse.json({ error: 'Failed to delete medication' }, { status: 500 });
  }
}
