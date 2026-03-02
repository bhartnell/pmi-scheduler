import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
// Types
// ---------------------------------------------------------------------------

interface OldVitalsEntry {
  phase?: string;
  bp?: string;
  hr?: string;
  pulse?: string;
  rr?: string;
  resp?: string;
  spo2?: string;
  temp?: string;
  gcs?: string;
  gcs_total?: string;
  gcs_e?: string;
  gcs_v?: string;
  gcs_m?: string;
  pupils?: string;
  loc?: string;
  pain?: string;
  ecg?: string;
  ekg?: string;
  ekg_rhythm?: string;
  etco2?: string;
  twelve_lead?: string;
  twelve_lead_notes?: string;
  lung_sounds?: string;
  lungs?: string;
  lung_notes?: string;
  skin?: string;
  jvd?: string;
  edema?: string;
  cap_refill?: string;
  capillary_refill?: string;
  pulse_quality?: string;
  bgl?: string;
  blood_glucose?: string;
  glucose?: string;
  notes?: string;
  presentation?: string;
  presentation_notes?: string;
  expected_actions?: string;
  actions?: string;
  interventions?: string;
  trigger?: string;
  general_impression?: string;
  [key: string]: string | undefined;
}

interface NewVitals {
  // XABCDE
  hemorrhage_control: string;
  airway_status: string;
  expose_findings: string;
  // Core Vitals
  bp: string;
  hr: string;
  rr: string;
  spo2: string;
  temp: string;
  // Neuro
  gcs_total: string;
  gcs_e: string;
  gcs_v: string;
  gcs_m: string;
  pupils: string;
  loc: string;
  pain: string;
  // Cardiac
  ekg_rhythm: string;
  etco2: string;
  twelve_lead_notes: string;
  // Respiratory
  lung_sounds: string;
  lung_notes: string;
  // Circulation
  skin: string;
  jvd: string;
  edema: string;
  capillary_refill: string;
  pulse_quality: string;
  // Labs
  blood_glucose: string;
  // Other
  other_findings: string[];
}

interface NewPhase {
  id: string;
  name: string;
  trigger: string;
  vitals: NewVitals;
  presentation_notes: string;
  expected_actions: string;
  display_order: number;
  onset: string;
  provocation: string;
  quality: string;
  radiation: string;
  severity: string;
  time_onset: string;
  general_impression: string;
}

interface CriticalActionObject {
  id: string;
  description: string;
}

interface TransformDetail {
  id: string;
  title: string;
  status: 'transformed' | 'already_correct' | 'error';
  changes?: string[];
  error?: string;
}

interface TransformResults {
  total_checked: number;
  transformed: number;
  already_correct: number;
  errors: number;
  details: TransformDetail[];
}

// ---------------------------------------------------------------------------
// Vitals mapping helper
// ---------------------------------------------------------------------------

function mapVitalsFromEntry(entry: OldVitalsEntry): NewVitals {
  return {
    // XABCDE - empty for old format entries
    hemorrhage_control: '',
    airway_status: '',
    expose_findings: '',
    // Core Vitals
    bp: entry.bp || '',
    hr: entry.hr || entry.pulse || '',
    rr: entry.rr || entry.resp || '',
    spo2: entry.spo2 || '',
    temp: entry.temp || '',
    // Neuro
    gcs_total: entry.gcs || entry.gcs_total || '',
    gcs_e: entry.gcs_e || '',
    gcs_v: entry.gcs_v || '',
    gcs_m: entry.gcs_m || '',
    pupils: entry.pupils || '',
    loc: entry.loc || '',
    pain: entry.pain || '',
    // Cardiac
    ekg_rhythm: entry.ecg || entry.ekg || entry.ekg_rhythm || '',
    etco2: entry.etco2 || '',
    twelve_lead_notes: entry.twelve_lead || entry.twelve_lead_notes || '',
    // Respiratory
    lung_sounds: entry.lung_sounds || entry.lungs || '',
    lung_notes: entry.lung_notes || '',
    // Circulation
    skin: entry.skin || '',
    jvd: entry.jvd || '',
    edema: entry.edema || '',
    capillary_refill: entry.cap_refill || entry.capillary_refill || '',
    pulse_quality: entry.pulse_quality || '',
    // Labs
    blood_glucose: entry.bgl || entry.blood_glucose || entry.glucose || '',
    // Other
    other_findings: [],
  };
}

// ---------------------------------------------------------------------------
// Check if a scenario needs transformation
// ---------------------------------------------------------------------------

function scenarioNeedsTransformation(scenario: Record<string, unknown>): {
  needs: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  const phases = scenario.phases;
  const hasPhases = Array.isArray(phases) && phases.length > 0;

  // Check for old-format phases (phase_number instead of name)
  if (hasPhases && Array.isArray(phases)) {
    const firstPhase = phases[0] as Record<string, unknown>;
    if (firstPhase && typeof firstPhase === 'object') {
      if (firstPhase.phase_number !== undefined && !firstPhase.name) {
        reasons.push('Phases use old format (phase_number instead of name)');
      }
    }
  }

  // Check if phases are missing but other data exists
  if (!hasPhases) {
    const vitals = scenario.vitals;
    const initialVitals = scenario.initial_vitals;
    if (Array.isArray(vitals) && vitals.length > 0) {
      reasons.push('Has vitals array but no phases - needs conversion');
    } else if (initialVitals && typeof initialVitals === 'object' && !Array.isArray(initialVitals) && Object.keys(initialVitals as object).length > 0) {
      reasons.push('Has initial_vitals object but no phases - needs single phase creation');
    }
  }

  // Check if critical_actions are strings instead of objects
  const criticalActions = scenario.critical_actions;
  if (Array.isArray(criticalActions) && criticalActions.length > 0 && typeof criticalActions[0] === 'string') {
    reasons.push('critical_actions are strings (should be {id, description} objects)');
  }

  return { needs: reasons.length > 0, reasons };
}

// ---------------------------------------------------------------------------
// Transform a single scenario
// ---------------------------------------------------------------------------

function transformScenario(
  scenario: Record<string, unknown>,
  currentUserEmail: string
): {
  newPhases: NewPhase[] | null;
  newInitialVitals: NewVitals | null;
  newCriticalActions: CriticalActionObject[] | null;
  legacyData: Record<string, unknown>;
  changes: string[];
} {
  const changes: string[] = [];
  const now = Date.now();

  // Build legacy backup
  const legacyData: Record<string, unknown> = {
    original_phases: scenario.phases ?? null,
    original_initial_vitals: scenario.initial_vitals ?? null,
    original_vitals: scenario.vitals ?? null,
    original_critical_actions: scenario.critical_actions ?? null,
    transformed_at: new Date().toISOString(),
    transformed_by: currentUserEmail,
  };

  let newPhases: NewPhase[] | null = null;
  let newInitialVitals: NewVitals | null = null;
  let newCriticalActions: CriticalActionObject[] | null = null;

  const phases = scenario.phases as unknown[] | null | undefined;
  const hasPhases = Array.isArray(phases) && phases.length > 0;

  // --- Fix old-format phases (phase_number -> name) ---
  if (hasPhases && Array.isArray(phases)) {
    const firstPhase = phases[0] as Record<string, unknown>;
    if (firstPhase && typeof firstPhase === 'object' && firstPhase.phase_number !== undefined && !firstPhase.name) {
      newPhases = (phases as Record<string, unknown>[]).map((p, index) => {
        const phaseName = typeof p.phase_number === 'number'
          ? (index === 0 ? 'Initial Presentation' : `Phase ${p.phase_number}`)
          : (index === 0 ? 'Initial Presentation' : `Phase ${index + 1}`);
        const vitalsEntry = (p.vitals && typeof p.vitals === 'object') ? p.vitals as OldVitalsEntry : {};
        return {
          id: (p.id as string) || `phase-${now}-${index}`,
          name: phaseName,
          trigger: index === 0 ? 'On arrival' : (p.trigger as string) || '',
          vitals: mapVitalsFromEntry(vitalsEntry),
          presentation_notes: (p.presentation_notes as string) || (p.notes as string) || '',
          expected_actions: (p.expected_actions as string) || (p.actions as string) || '',
          display_order: index,
          onset: (p.onset as string) || '',
          provocation: (p.provocation as string) || '',
          quality: (p.quality as string) || '',
          radiation: (p.radiation as string) || '',
          severity: (p.severity as string) || '',
          time_onset: (p.time_onset as string) || '',
          general_impression: (p.general_impression as string) || '',
        };
      });
      changes.push(`Converted ${newPhases.length} phase(s) from old format (phase_number -> name)`);
    }
  }

  // --- Convert old vitals array to phases ---
  if (!hasPhases) {
    const vitalsArray = scenario.vitals as OldVitalsEntry[] | null | undefined;
    const initialVitals = scenario.initial_vitals as OldVitalsEntry | null | undefined;

    if (Array.isArray(vitalsArray) && vitalsArray.length > 0) {
      // Transform vitals array entries into phases
      newPhases = vitalsArray.map((entry, index) => ({
        id: `phase-${now}-${index}`,
        name: entry.phase || (index === 0 ? 'Initial Presentation' : `Phase ${index + 1}`),
        trigger: index === 0 ? 'On arrival' : (entry.trigger || ''),
        vitals: mapVitalsFromEntry(entry),
        presentation_notes: entry.notes || entry.presentation || entry.presentation_notes || '',
        expected_actions: entry.interventions || entry.expected_actions || entry.actions || '',
        display_order: index,
        onset: '',
        provocation: '',
        quality: '',
        radiation: '',
        severity: '',
        time_onset: '',
        general_impression: entry.general_impression || '',
      }));
      changes.push(`Converted vitals array (${newPhases.length} entries) to phases`);

      // Set initial_vitals from the first phase
      newInitialVitals = newPhases[0].vitals;
      changes.push('Set initial_vitals from first converted phase');
    } else if (initialVitals && typeof initialVitals === 'object' && !Array.isArray(initialVitals)) {
      // Create a single phase from initial_vitals
      newPhases = [
        {
          id: `phase-${now}-0`,
          name: 'Initial Presentation',
          trigger: 'On arrival',
          vitals: mapVitalsFromEntry(initialVitals),
          presentation_notes: (scenario.general_impression as string) || '',
          expected_actions: '',
          display_order: 0,
          onset: '',
          provocation: '',
          quality: '',
          radiation: '',
          severity: '',
          time_onset: '',
          general_impression: (scenario.general_impression as string) || '',
        },
      ];
      changes.push('Created single phase from initial_vitals object');
    }
  }

  // --- Fix critical_actions format ---
  const criticalActions = scenario.critical_actions;
  if (Array.isArray(criticalActions) && criticalActions.length > 0 && typeof criticalActions[0] === 'string') {
    newCriticalActions = (criticalActions as string[]).map((desc, i) => ({
      id: `critical-${now}-${i}`,
      description: typeof desc === 'string' ? desc : String(desc),
    }));
    changes.push(`Converted ${newCriticalActions.length} critical_action(s) from strings to objects`);
  }

  return { newPhases, newInitialVitals, newCriticalActions, legacyData, changes };
}

// ---------------------------------------------------------------------------
// GET /api/admin/scenarios/transform
//
// Preview which scenarios need transformation and what would change.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: scenarios, error } = await supabase
      .from('scenarios')
      .select('id, title, phases, initial_vitals, vitals, critical_actions, general_impression, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json({
        success: true,
        preview: {
          total_checked: 0,
          needs_transformation: 0,
          already_correct: 0,
          scenarios: [],
        },
      });
    }

    const preview: Array<{
      id: string;
      title: string;
      needs_transformation: boolean;
      reasons: string[];
      created_at: string;
    }> = [];

    for (const scenario of scenarios) {
      const { needs, reasons } = scenarioNeedsTransformation(scenario as Record<string, unknown>);
      preview.push({
        id: scenario.id as string,
        title: (scenario.title as string) || '(untitled)',
        needs_transformation: needs,
        reasons,
        created_at: scenario.created_at as string,
      });
    }

    const needsTransformation = preview.filter(p => p.needs_transformation);
    const alreadyCorrect = preview.filter(p => !p.needs_transformation);

    return NextResponse.json({
      success: true,
      preview: {
        total_checked: scenarios.length,
        needs_transformation: needsTransformation.length,
        already_correct: alreadyCorrect.length,
        scenarios: preview,
      },
    });
  } catch (error) {
    console.error('Error previewing scenario transformation:', error);
    return NextResponse.json({ error: 'Failed to preview scenario transformation' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/scenarios/transform
//
// Execute transformation of scenarios to new format.
// Body: { scenarioIds?: string[], transformAll?: boolean, dryRun?: boolean }
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body: { scenarioIds?: string[]; transformAll?: boolean; dryRun?: boolean } =
      await request.json();
    const { scenarioIds, transformAll, dryRun } = body;

    if (!transformAll && (!scenarioIds || !Array.isArray(scenarioIds) || scenarioIds.length === 0)) {
      return NextResponse.json(
        { error: 'Provide scenarioIds array or set transformAll to true' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch target scenarios
    let query = supabase
      .from('scenarios')
      .select('id, title, phases, initial_vitals, vitals, critical_actions, general_impression, created_at');

    if (!transformAll && scenarioIds) {
      query = query.in('id', scenarioIds);
    }

    const { data: scenarios, error: fetchError } = await query.order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json({
        success: true,
        results: {
          total_checked: 0,
          transformed: 0,
          already_correct: 0,
          errors: 0,
          details: [],
        } satisfies TransformResults,
      });
    }

    const results: TransformResults = {
      total_checked: scenarios.length,
      transformed: 0,
      already_correct: 0,
      errors: 0,
      details: [],
    };

    for (const scenario of scenarios) {
      const scenarioRecord = scenario as Record<string, unknown>;
      const { needs, reasons } = scenarioNeedsTransformation(scenarioRecord);

      if (!needs) {
        results.already_correct++;
        results.details.push({
          id: scenario.id as string,
          title: (scenario.title as string) || '(untitled)',
          status: 'already_correct',
        });
        continue;
      }

      try {
        const { newPhases, newInitialVitals, newCriticalActions, legacyData, changes } =
          transformScenario(scenarioRecord, currentUser.email);

        if (dryRun) {
          // Dry run - report what would change without saving
          results.transformed++;
          results.details.push({
            id: scenario.id as string,
            title: (scenario.title as string) || '(untitled)',
            status: 'transformed',
            changes: [`[DRY RUN] Would apply: ${reasons.join('; ')}`, ...changes],
          });
          continue;
        }

        // Build the update payload
        const updatePayload: Record<string, unknown> = {
          legacy_data: legacyData,
          updated_at: new Date().toISOString(),
        };

        if (newPhases !== null) {
          updatePayload.phases = newPhases;
        }

        if (newInitialVitals !== null) {
          updatePayload.initial_vitals = newInitialVitals;
        }

        if (newCriticalActions !== null) {
          updatePayload.critical_actions = newCriticalActions;
        }

        const { error: updateError } = await supabase
          .from('scenarios')
          .update(updatePayload)
          .eq('id', scenario.id as string);

        if (updateError) throw updateError;

        results.transformed++;
        results.details.push({
          id: scenario.id as string,
          title: (scenario.title as string) || '(untitled)',
          status: 'transformed',
          changes,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors++;
        results.details.push({
          id: scenario.id as string,
          title: (scenario.title as string) || '(untitled)',
          status: 'error',
          error: msg,
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error transforming scenarios:', error);
    return NextResponse.json({ error: 'Failed to transform scenarios' }, { status: 500 });
  }
}
