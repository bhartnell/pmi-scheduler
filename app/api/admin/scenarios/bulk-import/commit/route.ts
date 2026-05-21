import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// POST /api/admin/scenarios/bulk-import/commit
//
// Accepts an array of validated (parsed) scenarios and inserts/updates them
// in the database.
//
// Dedup strategy (added 2026-05-21 after a "COPD vs CHF" duplicate landed
// because title matched but duration differed):
//   1. If the JSON entry has an `id` UUID matching an existing scenario,
//      UPDATE that row in place. Highest-confidence match.
//   2. Otherwise, case-insensitive + trimmed title match. If exactly one
//      row matches, UPDATE it. If MULTIPLE match, UPDATE the most recently
//      modified one and surface a `multiple_matches` warning.
//   3. Otherwise, INSERT a new row.
//
// Each result row reports `matched_by` ('id' | 'title' | 'none') and
// `action` ('updated' | 'inserted') so the UI can show what happened.
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const scenarios = body.scenarios;

    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return NextResponse.json({ error: 'No scenarios provided' }, { status: 400 });
    }

    if (scenarios.length > 200) {
      return NextResponse.json({ error: `Too many scenarios (${scenarios.length}). Maximum is 200 per import.` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    type Result = {
      index: number;
      title: string;
      id?: string;
      action?: 'updated' | 'inserted';
      matched_by?: 'id' | 'title' | 'none';
      multiple_matches?: number; // count of additional title matches we DIDN'T touch
      error?: string;
    };
    const results: Result[] = [];

    // Simple UUID regex — bulk import's parser doesn't validate id
    // shape, so we sanity-check here before issuing a UUID lookup that
    // would otherwise throw an "invalid input syntax for type uuid"
    // error from Postgres.
    const isUuid = (v: unknown): v is string =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      try {
        // Validate required field
        if (!scenario.title?.trim()) {
          results.push({ index: i, title: '(untitled)', error: 'Title is required' });
          continue;
        }

        // Build the row payload. Same shape for insert OR update —
        // we just choose the operation based on the dedup lookup
        // below.
        const rowData = {
          title: scenario.title.trim(),
          category: scenario.category || null,
          subcategory: scenario.subcategory || null,
          difficulty: (scenario.difficulty || 'intermediate').toLowerCase(),
          estimated_duration: scenario.estimated_duration || null,
          applicable_programs: scenario.applicable_programs || ['EMT', 'AEMT', 'Paramedic'],
          dispatch_time: scenario.dispatch_time || null,
          dispatch_location: scenario.dispatch_location || null,
          chief_complaint: scenario.chief_complaint || null,
          dispatch_notes: scenario.dispatch_notes || null,
          patient_name: scenario.patient_name || null,
          patient_age: scenario.patient_age || null,
          patient_sex: scenario.patient_sex || null,
          patient_weight: scenario.patient_weight || null,
          medical_history: scenario.medical_history || [],
          medications: scenario.medications || [],
          allergies: scenario.allergies || null,
          sample_history: scenario.sample_history || {},
          instructor_notes: scenario.instructor_notes || null,
          learning_objectives: scenario.learning_objectives || [],
          phases: scenario.phases || [],
          critical_actions: scenario.critical_actions || [],
          debrief_points: scenario.debrief_points || [],
          initial_vitals: scenario.initial_vitals || null,
          general_impression: scenario.general_impression || null,
          ekg_findings: scenario.ekg_findings || null,
          is_active: scenario.is_active !== false,
        };

        // ── Dedup lookup ────────────────────────────────────────
        // Step 1: id match. Highest confidence — if the JSON came
        //         from our exporter it includes the original UUID.
        let existingId: string | null = null;
        let matchedBy: 'id' | 'title' | 'none' = 'none';
        let multipleMatches = 0;

        if (isUuid(scenario.id)) {
          const { data: byId } = await supabase
            .from('scenarios')
            .select('id')
            .eq('id', scenario.id)
            .maybeSingle();
          if (byId?.id) {
            existingId = byId.id;
            matchedBy = 'id';
          }
        }

        // Step 2: case-insensitive + trimmed title match. Postgres
        //         `ilike` already handles case; trim is handled in
        //         JS since both sides may have padding.
        if (!existingId) {
          const normalizedTitle = scenario.title.trim();
          // Fetch ALL active matches so we can detect ambiguity AND
          // pick the most-recently-modified one. Filter on title via
          // `ilike` (exact title, case-insensitive) — not a wildcard
          // match, since fuzzy title matching is too dangerous in a
          // bulk-import path.
          const { data: byTitle } = await supabase
            .from('scenarios')
            .select('id, title, updated_at')
            .ilike('title', normalizedTitle)
            .order('updated_at', { ascending: false });
          // Defense in depth: re-filter on trimmed-equality client side
          // because ilike is locale-sensitive in ways that can vary
          // per-collation.
          const trimmedMatches = (byTitle ?? []).filter(
            r => (r.title ?? '').trim().toLowerCase() === normalizedTitle.toLowerCase(),
          );
          if (trimmedMatches.length >= 1) {
            existingId = trimmedMatches[0].id; // most recently updated
            matchedBy = 'title';
            multipleMatches = trimmedMatches.length - 1;
          }
        }

        // ── Apply ──────────────────────────────────────────────
        if (existingId) {
          const { data, error } = await supabase
            .from('scenarios')
            .update({ ...rowData, updated_at: new Date().toISOString() })
            .eq('id', existingId)
            .select('id, title')
            .single();
          if (error) {
            console.error(`Error updating scenario "${scenario.title}":`, error);
            results.push({ index: i, title: scenario.title, error: error.message });
          } else {
            results.push({
              index: i,
              title: data.title,
              id: data.id,
              action: 'updated',
              matched_by: matchedBy,
              ...(multipleMatches > 0 ? { multiple_matches: multipleMatches } : {}),
            });
          }
        } else {
          const { data, error } = await supabase
            .from('scenarios')
            .insert(rowData)
            .select('id, title')
            .single();
          if (error) {
            console.error(`Error inserting scenario "${scenario.title}":`, error);
            results.push({ index: i, title: scenario.title, error: error.message });
          } else {
            results.push({
              index: i,
              title: data.title,
              id: data.id,
              action: 'inserted',
              matched_by: 'none',
            });
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error processing scenario at index ${i}:`, err);
        results.push({ index: i, title: scenario.title || '(untitled)', error: message });
      }
    }

    const imported = results.filter(r => r.id);
    const inserted = results.filter(r => r.action === 'inserted');
    const updated = results.filter(r => r.action === 'updated');
    const failed = results.filter(r => r.error);
    const ambiguous = results.filter(r => (r.multiple_matches ?? 0) > 0);

    return NextResponse.json({
      success: failed.length === 0,
      message:
        `Inserted ${inserted.length}, updated ${updated.length}` +
        (failed.length > 0 ? `, failed ${failed.length}` : '') +
        ` of ${scenarios.length} scenarios`,
      total: scenarios.length,
      importedCount: imported.length,
      insertedCount: inserted.length,
      updatedCount: updated.length,
      failedCount: failed.length,
      imported,
      failed: failed.length > 0 ? failed : undefined,
      // Surfaces "we picked the most recent of N matches" so the
      // operator can verify they hit the right row when titles
      // collide across cohorts.
      ambiguous: ambiguous.length > 0 ? ambiguous : undefined,
    });
  } catch (error: unknown) {
    console.error('Error committing bulk import:', error);
    const message = error instanceof Error ? error.message : 'Failed to commit import';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
