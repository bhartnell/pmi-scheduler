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
//   ?search=epinephrine   - search name, brand_names, indications
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
      // Search across name, drug_class, and indications array
      query = query.or(
        `name.ilike.%${search}%,drug_class.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    // Client-side filter for indications array search (Supabase doesn't support ilike on arrays easily)
    let medications = data ?? [];
    if (search) {
      const lowerSearch = search.toLowerCase();
      medications = medications.filter((med) => {
        if (med.name.toLowerCase().includes(lowerSearch)) return true;
        if (med.drug_class.toLowerCase().includes(lowerSearch)) return true;
        if (med.brand_names?.some((b: string) => b.toLowerCase().includes(lowerSearch))) return true;
        if (med.indications?.some((i: string) => i.toLowerCase().includes(lowerSearch))) return true;
        if (med.special_notes?.toLowerCase().includes(lowerSearch)) return true;
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
      brand_names?: string[];
      drug_class: string;
      indications?: string[];
      contraindications?: string[];
      side_effects?: string[];
      routes?: string[];
      adult_dose?: string;
      pediatric_dose?: string;
      onset?: string;
      duration?: string;
      concentration?: string;
      dose_per_kg?: number;
      max_dose?: string;
      special_notes?: string;
    };

    if (!body.name || !body.drug_class) {
      return NextResponse.json({ error: 'name and drug_class are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('medications')
      .insert({
        name: body.name,
        brand_names: body.brand_names || null,
        drug_class: body.drug_class,
        indications: body.indications || null,
        contraindications: body.contraindications || null,
        side_effects: body.side_effects || null,
        routes: body.routes || null,
        adult_dose: body.adult_dose || null,
        pediatric_dose: body.pediatric_dose || null,
        onset: body.onset || null,
        duration: body.duration || null,
        concentration: body.concentration || null,
        dose_per_kg: body.dose_per_kg || null,
        max_dose: body.max_dose || null,
        special_notes: body.special_notes || null,
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
