import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
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
// GET /api/admin/program-requirements
//
// Query params:
//   ?program=Paramedic          - filter by program (optional)
//   ?includeHistory=true        - include all historical rows (default: false)
//
// Without includeHistory, returns only the most-recent effective row for each
// (program, requirement_type, department) combination.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const program = searchParams.get('program');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    // Always fetch all rows sorted by program / type / department / date desc
    let query = supabase
      .from('program_requirements')
      .select(
        `id, program, requirement_type, department, required_value,
         effective_date, notes, created_at,
         created_by, lab_users!program_requirements_created_by_fkey(id, name, email)`
      )
      .order('program', { ascending: true })
      .order('requirement_type', { ascending: true })
      .order('department', { ascending: true, nullsFirst: true })
      .order('effective_date', { ascending: false });

    if (program) {
      query = query.eq('program', program);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (includeHistory) {
      return NextResponse.json({ success: true, requirements: data ?? [] });
    }

    // Deduplicate: keep only the first (most-recent) row per unique key
    const seen = new Set<string>();
    const current: typeof data = [];
    for (const row of data ?? []) {
      const key = `${row.program}|${row.requirement_type}|${row.department ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        current.push(row);
      }
    }

    return NextResponse.json({ success: true, requirements: current });
  } catch (error) {
    console.error('Error fetching program requirements:', error);
    return NextResponse.json({ error: 'Failed to fetch program requirements' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/program-requirements
//
// Creates a NEW row (version-history approach – never updates existing rows).
// Body: { program, requirement_type, department?, required_value, effective_date?, notes? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      program: string;
      requirement_type: string;
      department?: string | null;
      required_value: number;
      effective_date?: string;
      notes?: string;
    };

    const { program, requirement_type, department, required_value, effective_date, notes } = body;

    if (!program || !requirement_type || required_value === undefined || required_value === null) {
      return NextResponse.json(
        { error: 'program, requirement_type, and required_value are required' },
        { status: 400 }
      );
    }

    const validPrograms = ['Paramedic', 'AEMT', 'EMT'];
    if (!validPrograms.includes(program)) {
      return NextResponse.json({ error: `program must be one of: ${validPrograms.join(', ')}` }, { status: 400 });
    }

    const validTypes = ['clinical_hours', 'skills_count', 'scenarios_count'];
    if (!validTypes.includes(requirement_type)) {
      return NextResponse.json(
        { error: `requirement_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('program_requirements')
      .insert({
        program,
        requirement_type,
        department: department ?? null,
        required_value,
        effective_date: effective_date ?? new Date().toISOString().split('T')[0],
        created_by: currentUser.id,
        notes: notes ?? null,
      })
      .select(
        `id, program, requirement_type, department, required_value,
         effective_date, notes, created_at,
         created_by, lab_users!program_requirements_created_by_fkey(id, name, email)`
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, requirement: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating program requirement:', error);
    return NextResponse.json({ error: 'Failed to create program requirement' }, { status: 500 });
  }
}
