import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Expected JSON format for scenario import
interface ImportedPhase {
  name: string;
  trigger?: string;
  presentation_notes?: string;
  expected_actions?: string | string[];
  general_impression?: string;
  vitals?: {
    bp?: string;
    hr?: string;
    rr?: string;
    spo2?: string;
    temp?: string;
    gcs_total?: string;
    gcs_e?: string;
    gcs_v?: string;
    gcs_m?: string;
    pupils?: string;
    loc?: string;
    pain?: string;
    ekg_rhythm?: string;
    etco2?: string;
    lung_sounds?: string;
    lung_notes?: string;
    skin?: string;
    blood_glucose?: string;
    twelve_lead_notes?: string;
    [key: string]: any;
  };
  // OPQRST for symptom assessment
  onset?: string;
  provocation?: string;
  quality?: string;
  radiation?: string;
  severity?: string;
  time_onset?: string;
}

interface ImportedScenario {
  title: string;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  estimated_duration?: number;
  applicable_programs?: string[];

  // Dispatch
  dispatch_time?: string;
  dispatch_location?: string;
  chief_complaint?: string;
  dispatch_notes?: string;

  // Patient
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  patient_weight?: string;

  // SAMPLE History (scenario-level only)
  medical_history?: string | string[];
  medications?: string | string[];
  allergies?: string;
  signs_symptoms?: string;
  last_oral_intake?: string;
  events_leading?: string;

  // Instructor notes
  instructor_notes?: string;
  learning_objectives?: string[];

  // Phases
  phases?: ImportedPhase[];

  // Grading
  critical_actions?: string[];
  debrief_points?: string[];
}

// POST - Import one or more scenarios from JSON
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Accept either a single scenario or an array
    const scenarios: ImportedScenario[] = Array.isArray(body) ? body : [body];

    if (scenarios.length === 0) {
      return NextResponse.json({ success: false, error: 'No scenarios provided' }, { status: 400 });
    }

    const results: { title: string; id?: string; error?: string }[] = [];

    for (const imported of scenarios) {
      try {
        // Validate required fields
        if (!imported.title?.trim()) {
          results.push({ title: 'Unknown', error: 'Title is required' });
          continue;
        }

        // Convert string arrays to proper arrays
        const toArray = (val: string | string[] | undefined): string[] => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          return val.split(',').map(s => s.trim()).filter(Boolean);
        };

        // Build phases with proper structure
        const phases = (imported.phases || []).map((phase, index) => ({
          id: `phase-${Date.now()}-${index}`,
          name: phase.name || (index === 0 ? 'Initial Presentation' : `Phase ${index + 1}`),
          trigger: phase.trigger || (index === 0 ? 'On arrival' : ''),
          presentation_notes: phase.presentation_notes || '',
          expected_actions: Array.isArray(phase.expected_actions)
            ? phase.expected_actions.join('\n')
            : (phase.expected_actions || ''),
          general_impression: phase.general_impression || '',
          display_order: index,
          vitals: {
            bp: phase.vitals?.bp || '',
            hr: phase.vitals?.hr || '',
            rr: phase.vitals?.rr || '',
            spo2: phase.vitals?.spo2 || '',
            temp: phase.vitals?.temp || '',
            gcs_total: phase.vitals?.gcs_total || '',
            gcs_e: phase.vitals?.gcs_e || '',
            gcs_v: phase.vitals?.gcs_v || '',
            gcs_m: phase.vitals?.gcs_m || '',
            pupils: phase.vitals?.pupils || '',
            loc: phase.vitals?.loc || '',
            pain: phase.vitals?.pain || '',
            ekg_rhythm: phase.vitals?.ekg_rhythm || '',
            etco2: phase.vitals?.etco2 || '',
            lung_sounds: phase.vitals?.lung_sounds || '',
            lung_notes: phase.vitals?.lung_notes || '',
            skin: phase.vitals?.skin || '',
            blood_glucose: phase.vitals?.blood_glucose || '',
            twelve_lead_notes: phase.vitals?.twelve_lead_notes || '',
            hemorrhage_control: phase.vitals?.hemorrhage_control || '',
            airway_status: phase.vitals?.airway_status || '',
            expose_findings: phase.vitals?.expose_findings || '',
            jvd: phase.vitals?.jvd || '',
            edema: phase.vitals?.edema || '',
            capillary_refill: phase.vitals?.capillary_refill || '',
            pulse_quality: phase.vitals?.pulse_quality || '',
            other_findings: phase.vitals?.other_findings || []
          },
          // OPQRST
          onset: phase.onset || '',
          provocation: phase.provocation || '',
          quality: phase.quality || '',
          radiation: phase.radiation || '',
          severity: phase.severity || '',
          time_onset: phase.time_onset || ''
        }));

        // Build the scenario data
        const scenarioData = {
          title: imported.title.trim(),
          category: imported.category || null,
          subcategory: imported.subcategory || null,
          difficulty: (imported.difficulty || 'intermediate').toLowerCase(),
          estimated_duration: imported.estimated_duration || null,
          applicable_programs: imported.applicable_programs || ['EMT', 'AEMT', 'Paramedic'],

          // Dispatch
          dispatch_time: imported.dispatch_time || null,
          dispatch_location: imported.dispatch_location || null,
          chief_complaint: imported.chief_complaint || null,
          dispatch_notes: imported.dispatch_notes || null,

          // Patient
          patient_name: imported.patient_name || null,
          patient_age: imported.patient_age || null,
          patient_sex: imported.patient_sex || null,
          patient_weight: imported.patient_weight || null,

          // SAMPLE History
          medical_history: toArray(imported.medical_history),
          medications: toArray(imported.medications),
          allergies: imported.allergies || null,
          sample_history: {
            signs_symptoms: imported.signs_symptoms || '',
            last_oral_intake: imported.last_oral_intake || '',
            events_leading: imported.events_leading || ''
          },

          // Instructor
          instructor_notes: imported.instructor_notes || null,
          learning_objectives: imported.learning_objectives || [],

          // Phases
          phases: phases,

          // Grading
          critical_actions: (imported.critical_actions || []).map((desc, i) => ({
            id: `critical-${Date.now()}-${i}`,
            description: desc
          })),
          debrief_points: imported.debrief_points || [],

          // Legacy compatibility
          initial_vitals: phases[0]?.vitals || null,
          general_impression: phases[0]?.presentation_notes || null,

          // Status
          is_active: true
        };

        const { data, error } = await supabase
          .from('scenarios')
          .insert(scenarioData)
          .select('id, title')
          .single();

        if (error) {
          console.error('Error inserting scenario:', error);
          results.push({ title: imported.title, error: error.message });
        } else {
          results.push({ title: data.title, id: data.id });
        }
      } catch (err: any) {
        console.error('Error processing scenario:', err);
        results.push({ title: imported.title || 'Unknown', error: err.message });
      }
    }

    const successful = results.filter(r => r.id);
    const failed = results.filter(r => r.error);

    return NextResponse.json({
      success: failed.length === 0,
      message: `Imported ${successful.length} of ${scenarios.length} scenarios`,
      imported: successful,
      failed: failed.length > 0 ? failed : undefined
    });
  } catch (error: any) {
    console.error('Error importing scenarios:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to import scenarios'
    }, { status: 500 });
  }
}
