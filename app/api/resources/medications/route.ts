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
// GET /api/resources/medications
//
// Query params:
//   ?search=epinephrine   - search name, generic_name, indications
//   ?class=Cardiac        - filter by drug_class
//   ?id=<uuid>            - get single medication
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const drugClass = searchParams.get('class');
    const id = searchParams.get('id');

    // Single medication lookup
    if (id) {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Medication not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, medication: data });
    }

    let query = supabase
      .from('medications')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (drugClass && drugClass !== 'all') {
      query = query.ilike('drug_class', `%${drugClass}%`);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,drug_class.ilike.%${search}%,generic_name.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    // Client-side filter for indications text search
    let medications = data ?? [];
    if (search) {
      const lowerSearch = search.toLowerCase();
      medications = medications.filter((med) => {
        if (med.name.toLowerCase().includes(lowerSearch)) return true;
        if (med.drug_class?.toLowerCase().includes(lowerSearch)) return true;
        if (med.generic_name?.toLowerCase().includes(lowerSearch)) return true;
        if (med.indications?.toLowerCase().includes(lowerSearch)) return true;
        if (med.notes?.toLowerCase().includes(lowerSearch)) return true;
        return false;
      });
    }

    // Get distinct drug classes for filter UI
    const { data: classData } = await supabase
      .from('medications')
      .select('drug_class')
      .eq('is_active', true);

    const drugClasses = [...new Set((classData ?? []).map((m) => m.drug_class))].sort();

    return NextResponse.json({
      success: true,
      medications,
      drugClasses,
      total: medications.length,
    });
  } catch (error) {
    console.error('Error fetching medications:', error);
    return NextResponse.json({ error: 'Failed to fetch medications' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/resources/medications
//
// Create a new medication. Requires admin+ role.
// Body uses the corrected schema:
//   name, generic_name, drug_class, indications (TEXT), contraindications (TEXT),
//   side_effects (TEXT), dosing (JSONB), routes (TEXT[]), notes, is_active
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      name: string;
      generic_name?: string;
      drug_class: string;
      indications?: string;
      contraindications?: string;
      side_effects?: string;
      dosing?: Record<string, unknown>;
      routes?: string[];
      notes?: string;
    };

    if (!body.name || !body.drug_class) {
      return NextResponse.json({ error: 'name and drug_class are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('medications')
      .insert({
        name: body.name,
        generic_name: body.generic_name || null,
        drug_class: body.drug_class,
        indications: body.indications || null,
        contraindications: body.contraindications || null,
        side_effects: body.side_effects || null,
        dosing: body.dosing || null,
        routes: body.routes || null,
        notes: body.notes || null,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, medication: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating medication:', error);
    return NextResponse.json({ error: 'Failed to create medication' }, { status: 500 });
  }
}
