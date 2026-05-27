import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/admin/skill-drills/import
//
// Imports skill drill JSON per docs/Skill_Drill_Webapp_Brief.md.
// Accepts:
//   - A single drill object: { title, program, semester, concept, ... }
//   - A wrapped array:        { drills: [ {...}, {...} ] }
//   - A bare array:           [ {...}, {...} ]
//
// Upsert key: (lower(name), program, COALESCE(semester, -1)) per the
// partial unique index from migration 20260527_skill_drills_import_support.
// Re-importing the same file is idempotent.
//
// Field mapping (brief → DB column):
//   title              → name
//   duration_minutes   → estimated_duration_minutes
//   program, semester  → same columns
//   category           → category (optional; brief doesn't require it)
//   concept            → drill_data.concept (NOT description — keep
//                        description free for ad-hoc UI editing)
//   students_per_setup → drill_data.students_per_setup
//   equipment[]        → drill_data.equipment
//   setups[]           → drill_data.setups
//   run_steps[]        → drill_data.run_steps
//   instructor_notes   → drill_data.instructor_notes
//
// Requires admin+ role.

interface SetupDef {
  label?: string;
  count?: number;
  items?: string[];
  notes?: string | null;
}

interface ImportDrill {
  title?: string;
  name?: string; // accept either; title wins
  program?: string;
  semester?: number | null;
  category?: string;
  concept?: string;
  duration_minutes?: number;
  estimated_duration_minutes?: number; // accept either name
  students_per_setup?: number;
  instructor_notes?: string;
  equipment?: string[] | string;
  setups?: SetupDef[];
  run_steps?: string[];
  description?: string;
}

const VALID_PROGRAMS = ['emt', 'aemt', 'paramedic', 'all'];

function normalizeDrill(raw: ImportDrill): {
  ok: true;
  row: Record<string, unknown>;
  drill_data: Record<string, unknown>;
} | { ok: false; error: string } {
  const title = (raw.title ?? raw.name ?? '').trim();
  if (!title) return { ok: false, error: 'title (or name) is required' };

  const program = (raw.program ?? '').toLowerCase().trim();
  if (!VALID_PROGRAMS.includes(program)) {
    return { ok: false, error: `program must be one of ${VALID_PROGRAMS.join(', ')}` };
  }

  const concept = (raw.concept ?? '').trim();
  // Concept is recommended but not enforced — brief says synopsis is
  // required, but the import shouldn't reject a drill with no concept
  // (operator can edit it in afterward). Just store empty.

  const duration =
    typeof raw.duration_minutes === 'number'
      ? raw.duration_minutes
      : typeof raw.estimated_duration_minutes === 'number'
        ? raw.estimated_duration_minutes
        : null;

  // Equipment: brief uses array; we store array in drill_data and ALSO
  // join into the legacy `equipment_needed` text column so anywhere
  // that reads the flat text doesn't go blank.
  const equipmentArr = Array.isArray(raw.equipment)
    ? raw.equipment.map(e => String(e).trim()).filter(Boolean)
    : typeof raw.equipment === 'string'
      ? raw.equipment.split('\n').map(s => s.trim()).filter(Boolean)
      : [];

  const setups = Array.isArray(raw.setups)
    ? raw.setups.map((s): Required<SetupDef> => ({
        label: s.label ?? '',
        count: typeof s.count === 'number' ? s.count : 1,
        items: Array.isArray(s.items) ? s.items.map(String) : [],
        notes: s.notes ?? null,
      }))
    : [];

  const runSteps = Array.isArray(raw.run_steps)
    ? raw.run_steps.map(String).filter(Boolean)
    : [];

  const drill_data: Record<string, unknown> = {
    concept,
    students_per_setup: raw.students_per_setup ?? null,
    instructor_notes: raw.instructor_notes ?? null,
    equipment: equipmentArr,
    setups,
    run_steps: runSteps,
  };

  const row: Record<string, unknown> = {
    name: title,
    program,
    semester: typeof raw.semester === 'number' ? raw.semester : null,
    category: raw.category ?? null,
    estimated_duration_minutes: duration,
    equipment_needed: equipmentArr.join('\n') || null,
    instructions: runSteps.join('\n') || null,
    description: raw.description ?? concept ?? null,
    is_active: true,
    source: 'imported',
    drill_data,
    updated_at: new Date().toISOString(),
  };

  return { ok: true, row, drill_data };
}

interface ImportResult {
  index: number;
  title: string;
  id?: string;
  action?: 'inserted' | 'updated';
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 });
    }

    // Unwrap any of the accepted shapes
    let drills: ImportDrill[];
    if (Array.isArray(body)) {
      drills = body as ImportDrill[];
    } else if (body && typeof body === 'object' && Array.isArray((body as { drills?: unknown }).drills)) {
      drills = (body as { drills: ImportDrill[] }).drills;
    } else if (body && typeof body === 'object') {
      drills = [body as ImportDrill]; // single drill
    } else {
      return NextResponse.json({ success: false, error: 'expected drill object, array, or { drills: [...] }' }, { status: 400 });
    }
    if (drills.length === 0) {
      return NextResponse.json({ success: false, error: 'no drills provided' }, { status: 400 });
    }
    if (drills.length > 50) {
      return NextResponse.json({ success: false, error: `too many drills (${drills.length}); cap is 50 per import` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const results: ImportResult[] = [];

    for (let i = 0; i < drills.length; i++) {
      const raw = drills[i];
      const norm = normalizeDrill(raw);
      if (!norm.ok) {
        results.push({ index: i, title: raw.title ?? raw.name ?? '(untitled)', error: norm.error });
        continue;
      }
      const { row } = norm;

      // Upsert by (lower(name), program, semester). PostgREST doesn't
      // expose lower() in upsert conflict targets directly, so we do
      // SELECT-then-UPDATE-or-INSERT manually for correctness.
      const { data: existing } = await supabase
        .from('skill_drills')
        .select('id')
        .ilike('name', String(row.name))
        .eq('program', String(row.program))
        .filter('semester', row.semester == null ? 'is' : 'eq', row.semester == null ? null : String(row.semester))
        .maybeSingle();

      try {
        if (existing?.id) {
          const { data, error } = await supabase
            .from('skill_drills')
            .update(row)
            .eq('id', existing.id)
            .select('id, name')
            .single();
          if (error) throw error;
          results.push({ index: i, title: data.name, id: data.id, action: 'updated' });
        } else {
          const { data, error } = await supabase
            .from('skill_drills')
            .insert({ ...row, created_by: user.email })
            .select('id, name')
            .single();
          if (error) throw error;
          results.push({ index: i, title: data.name, id: data.id, action: 'inserted' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ index: i, title: String(row.name ?? '(untitled)'), error: message });
      }
    }

    const inserted = results.filter(r => r.action === 'inserted');
    const updated = results.filter(r => r.action === 'updated');
    const failed = results.filter(r => r.error);

    return NextResponse.json({
      success: failed.length === 0,
      message: `Inserted ${inserted.length}, updated ${updated.length}` + (failed.length > 0 ? `, failed ${failed.length}` : '') + ` of ${drills.length}`,
      total: drills.length,
      insertedCount: inserted.length,
      updatedCount: updated.length,
      failedCount: failed.length,
      results,
    });
  } catch (error) {
    console.error('skill-drills import error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 },
    );
  }
}
