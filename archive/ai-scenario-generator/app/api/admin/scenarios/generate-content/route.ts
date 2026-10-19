import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateContentRequest {
  scenario_id: string;
  fields_to_generate: string[];
  preview?: boolean; // default true
}

// Allowed fields for generation
const ALLOWED_FIELDS = [
  'phases',
  'sample_history',
  'opqrst',
  'secondary_survey',
  'debrief_points',
  'learning_objectives',
] as const;

type GeneratableField = (typeof ALLOWED_FIELDS)[number];

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory)
// ---------------------------------------------------------------------------

const lastGenerationByUser = new Map<string, number>();
const MIN_INTERVAL_MS = 6000; // 6 seconds between requests (10/min)

function checkRateLimit(userEmail: string): string | null {
  const now = Date.now();
  const last = lastGenerationByUser.get(userEmail);
  if (last && now - last < MIN_INTERVAL_MS) {
    const waitSec = Math.ceil((MIN_INTERVAL_MS - (now - last)) / 1000);
    return `Rate limited. Please wait ${waitSec} more second(s) before generating again.`;
  }
  return null;
}

function recordGeneration(userEmail: string) {
  lastGenerationByUser.set(userEmail, Date.now());
  // Clean up old entries every 50 calls
  if (lastGenerationByUser.size > 50) {
    const cutoff = Date.now() - MIN_INTERVAL_MS * 2;
    for (const [email, ts] of lastGenerationByUser) {
      if (ts < cutoff) lastGenerationByUser.delete(email);
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

function buildFieldDescription(field: GeneratableField): string {
  switch (field) {
    case 'phases':
      return `"phases": An array of 3-4 phase objects representing clinical progression (initial presentation -> intervention response -> transport/resolution). Each phase:
{
  "id": "phase-1", // unique ID like "phase-1", "phase-2", etc.
  "name": "Initial Presentation", // descriptive name
  "trigger": "Description of what triggers transition to this phase",
  "presentation_notes": "Detailed description of patient presentation in this phase, including instructor cues",
  "expected_actions": ["Action 1 the student should take", "Action 2", ...],
  "vitals": {
    "bp_systolic": 120,
    "bp_diastolic": 80,
    "pulse": 88,
    "respiratory_rate": 18,
    "spo2": 97,
    "etco2": 38,
    "temperature": "98.6",
    "skin": "Warm, dry, pink",
    "pupils": "PERRL 4mm",
    "gcs": 15,
    "ekg_rhythm": "Normal Sinus Rhythm"
  },
  "display_order": 0 // 0-indexed
}`;
    case 'sample_history':
      return `"sample_history": A SAMPLE history object:
{
  "signs_symptoms": "Detailed signs and symptoms the patient is presenting with",
  "allergies": "Patient allergies or NKDA",
  "medications": "Current medications the patient takes",
  "past_medical_history": "Relevant past medical history",
  "last_oral_intake": "When and what the patient last ate/drank",
  "events_leading": "Events leading up to the emergency"
}`;
    case 'opqrst':
      return `"opqrst": An OPQRST pain assessment object:
{
  "onset": "When and how the symptoms began",
  "provocation": "What makes it better or worse",
  "quality": "Description of the pain/symptom quality",
  "radiation": "Where the pain radiates to, if applicable",
  "severity": "Pain severity on 1-10 scale with description",
  "time_onset": "Specific time of onset"
}`;
    case 'secondary_survey':
      return `"secondary_survey": A head-to-toe secondary survey object:
{
  "head": "Head/face findings",
  "neck": "Neck findings including JVD, tracheal deviation",
  "chest": "Chest findings including breath sounds, chest wall",
  "abdomen": "Abdominal findings including quadrant tenderness",
  "pelvis": "Pelvic findings",
  "extremities": "Extremity findings including pulses, motor/sensory",
  "posterior": "Posterior/back findings"
}`;
    case 'debrief_points':
      return `"debrief_points": An array of 4-6 strings, each being a discussion point for post-scenario debriefing. Focus on key learning moments, decision points, and areas for improvement.`;
    case 'learning_objectives':
      return `"learning_objectives": An array of 3-5 strings, each being a specific, measurable learning objective for this scenario. Use action verbs (demonstrate, identify, perform, etc.)`;
    default:
      return '';
  }
}

function buildPrompt(
  scenario: Record<string, unknown>,
  fieldsToGenerate: GeneratableField[]
): string {
  // Extract scenario data safely
  const title = (scenario.title as string) || 'Untitled';
  const category = (scenario.category as string) || 'Medical';
  const chiefComplaint = (scenario.chief_complaint as string) || 'Not specified';
  const patientName = (scenario.patient_name as string) || 'John Doe';
  const patientAge = scenario.patient_age ?? 'Unknown';
  const patientSex = (scenario.patient_sex as string) || 'Unknown';
  const medicalHistory = (scenario.medical_history as string) || 'None noted';
  const medications = (scenario.medications as string) || 'None noted';
  const allergies = (scenario.allergies as string) || 'NKDA';

  // Format initial vitals
  let vitalsStr = 'Not available';
  const vitals = scenario.initial_vitals as Record<string, unknown> | null;
  if (vitals && typeof vitals === 'object') {
    const parts: string[] = [];
    if (vitals.bp) parts.push(`BP ${vitals.bp}`);
    if (vitals.hr || vitals.pulse) parts.push(`HR ${vitals.hr || vitals.pulse}`);
    if (vitals.rr || vitals.respiratory_rate) parts.push(`RR ${vitals.rr || vitals.respiratory_rate}`);
    if (vitals.spo2) parts.push(`SpO2 ${vitals.spo2}%`);
    if (vitals.etco2) parts.push(`EtCO2 ${vitals.etco2}`);
    if (vitals.gcs) parts.push(`GCS ${vitals.gcs}`);
    if (vitals.ekg_rhythm) parts.push(`EKG: ${vitals.ekg_rhythm}`);
    if (parts.length > 0) vitalsStr = parts.join(', ');
  }

  // Format critical actions
  let criticalActionsStr = 'Not specified';
  const criticalActions = scenario.critical_actions;
  if (Array.isArray(criticalActions) && criticalActions.length > 0) {
    if (typeof criticalActions[0] === 'string') {
      criticalActionsStr = criticalActions.join('; ');
    } else if (typeof criticalActions[0] === 'object' && criticalActions[0] !== null) {
      criticalActionsStr = criticalActions
        .map((a: Record<string, unknown>) => a.description || a.action || JSON.stringify(a))
        .join('; ');
    }
  }

  // Build the field descriptions
  const fieldDescriptions = fieldsToGenerate
    .map(f => buildFieldDescription(f))
    .join('\n\n');

  return `You are an experienced paramedic educator creating scenario content for EMS students.

Given this clinical scenario:
- Title: ${title}
- Category: ${category}
- Chief Complaint: ${chiefComplaint}
- Patient: ${patientName}, ${patientAge}yo ${patientSex}
- Medical History: ${medicalHistory}
- Medications: ${medications}
- Allergies: ${allergies}
- Initial Vitals: ${vitalsStr}
- Critical Actions: ${criticalActionsStr}

Generate the following fields in valid JSON format:

${fieldDescriptions}

Requirements:
- Phases should show clinical progression (initial presentation -> intervention response -> transport/resolution)
- Vitals in each phase should change realistically based on the condition and interventions
- SAMPLE history should be consistent with the chief complaint and demographics
- Include realistic instructor cues and decision points
- All medications should have correct dosages for paramedic scope
- EKG findings should be appropriate for the cardiac rhythm
- Content should be clinically accurate and educational

Return ONLY valid JSON with the requested fields as top-level keys. No explanation text, no markdown code blocks.`;
}

// ---------------------------------------------------------------------------
// GET /api/admin/scenarios/generate-content?pending_review=true
// Returns IDs of scenarios with pending_review status
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const pendingReview = searchParams.get('pending_review');

    if (pendingReview === 'true') {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('scenarios')
        .select('id')
        .eq('content_review_status', 'pending_review');

      if (error) {
        // If column doesn't exist yet, return empty
        return NextResponse.json({ ids: [] });
      }

      return NextResponse.json({
        ids: (data || []).map((s: { id: string }) => s.id),
      });
    }

    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  } catch {
    return NextResponse.json({ ids: [] });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/scenarios/generate-content
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body: GenerateContentRequest = await request.json();
    const { scenario_id, fields_to_generate, preview = true } = body;

    // Validate inputs
    if (!scenario_id) {
      return NextResponse.json(
        { success: false, error: 'scenario_id is required' },
        { status: 400 }
      );
    }

    if (!fields_to_generate || !Array.isArray(fields_to_generate) || fields_to_generate.length === 0) {
      return NextResponse.json(
        { success: false, error: 'fields_to_generate must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate field names
    const invalidFields = fields_to_generate.filter(
      f => !ALLOWED_FIELDS.includes(f as GeneratableField)
    );
    if (invalidFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid fields: ${invalidFields.join(', ')}. Allowed: ${ALLOWED_FIELDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimitError = checkRateLimit(auth.user.email);
    if (rateLimitError) {
      return NextResponse.json(
        { success: false, error: rateLimitError },
        { status: 429 }
      );
    }

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the scenario
    const { data: scenario, error: fetchError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenario_id)
      .single();

    if (fetchError || !scenario) {
      return NextResponse.json(
        { success: false, error: 'Scenario not found' },
        { status: 404 }
      );
    }

    const record = scenario as Record<string, unknown>;

    // Filter out fields that already have content (never overwrite non-empty fields)
    const fieldsNeedingGeneration = fields_to_generate.filter(field => {
      const val = record[field];
      if (val === null || val === undefined) return true;
      if (typeof val === 'string' && val.trim() === '') return true;
      if (Array.isArray(val) && val.length === 0) return true;
      if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val as Record<string, unknown>).length === 0) return true;
      return false;
    }) as GeneratableField[];

    if (fieldsNeedingGeneration.length === 0) {
      return NextResponse.json({
        success: true,
        preview,
        skipped_fields: fields_to_generate,
        message: 'All requested fields already have content. No generation needed.',
        generated: {},
      });
    }

    // Build the prompt
    const prompt = buildPrompt(record, fieldsNeedingGeneration);

    // Call Anthropic API
    recordGeneration(auth.user.email);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content from response
    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { success: false, error: 'No text content in AI response' },
        { status: 500 }
      );
    }

    // Parse JSON response - strip any markdown code blocks if present
    let rawText = textContent.text.trim();
    if (rawText.startsWith('```json')) {
      rawText = rawText.slice(7);
    } else if (rawText.startsWith('```')) {
      rawText = rawText.slice(3);
    }
    if (rawText.endsWith('```')) {
      rawText = rawText.slice(0, -3);
    }
    rawText = rawText.trim();

    let generatedContent: Record<string, unknown>;
    try {
      generatedContent = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response as JSON', raw_response: rawText.substring(0, 500) },
        { status: 500 }
      );
    }

    // Filter generated content to only include requested fields
    const filteredContent: Record<string, unknown> = {};
    for (const field of fieldsNeedingGeneration) {
      if (generatedContent[field] !== undefined) {
        filteredContent[field] = generatedContent[field];
      }
    }

    const skippedFields = fields_to_generate.filter(f => !fieldsNeedingGeneration.includes(f as GeneratableField));

    if (preview) {
      // Return generated content without saving
      return NextResponse.json({
        success: true,
        preview: true,
        scenario_id,
        scenario_title: record.title,
        generated: filteredContent,
        fields_generated: Object.keys(filteredContent),
        skipped_fields: skippedFields,
        skipped_reason: skippedFields.length > 0 ? 'Fields already have content' : undefined,
      });
    }

    // Apply: save to database
    const updatePayload: Record<string, unknown> = {
      ...filteredContent,
      ai_generated_fields: [
        ...((record.ai_generated_fields as string[]) || []),
        ...Object.keys(filteredContent).filter(
          f => !((record.ai_generated_fields as string[]) || []).includes(f)
        ),
      ],
      content_review_status: 'pending_review',
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('scenarios')
      .update(updatePayload)
      .eq('id', scenario_id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to save: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preview: false,
      scenario_id,
      scenario_title: record.title,
      generated: filteredContent,
      fields_generated: Object.keys(filteredContent),
      skipped_fields: skippedFields,
      skipped_reason: skippedFields.length > 0 ? 'Fields already have content' : undefined,
      content_review_status: 'pending_review',
    });
  } catch (error) {
    console.error('Error in generate-content:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to generate content: ${message}` },
      { status: 500 }
    );
  }
}
