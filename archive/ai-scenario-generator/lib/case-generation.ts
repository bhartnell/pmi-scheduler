// ---------------------------------------------------------------------------
// Shared Case Generation Logic
// ---------------------------------------------------------------------------
// Used by both single and bulk generation endpoints. Handles prompt building,
// Anthropic API calls, JSON parsing, validation, and database insertion.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateCaseJson, type ValidationError } from '@/lib/case-validation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaseBrief {
  category?: string;
  subcategory?: string;
  difficulty?: string;
  programs?: string[];
  scenario?: string;
  special_instructions?: string;
}

export interface GenerationResult {
  success: boolean;
  caseId?: string;
  title?: string;
  validationErrors: ValidationError[];
  rawJson?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Default master prompt (fallback when no DB template is found)
// ---------------------------------------------------------------------------

const DEFAULT_MASTER_PROMPT = `You are an EMS Case Study Generator for a paramedic education platform. Your job is to generate clinically accurate, educationally sound case studies in a specific JSON format.

## YOUR OUTPUT FORMAT

You output ONLY valid JSON. No markdown code fences, no commentary before or after. Just the JSON object. One case per request unless told otherwise.

## CLINICAL ACCURACY STANDARDS

Every case you generate MUST adhere to these standards:

### Vital Signs — Realistic Ranges
- **BP:** Systolic 60-240, Diastolic 30-140. Must be physiologically consistent (systolic always > diastolic by at least 20mmHg, pulse pressure appropriate for condition)
- **HR:** 0-220. Must match clinical presentation (tachy with shock, brady with heart blocks, etc.)
- **RR:** 0-60. Must correlate with respiratory distress level
- **SpO2:** 0-100%. Must match respiratory status and oxygen therapy
- **ETCO2:** 0-100mmHg. Normal 35-45. Must correlate with ventilation status
- **Glucose:** 0-600mg/dL. Must match diabetic presentation if applicable
- **Temp:** 85-108°F. Must match infectious/environmental presentation
- **GCS:** 3-15. Must match neuro status (breakdown E+V+M should be consistent)
- **Pupils:** Must match neuro/tox presentation (PERRL, fixed/dilated, pinpoint, unequal)

### Vitals Must Change Appropriately Across Phases
- If patient is deteriorating: vitals should worsen (increasing HR, decreasing BP, etc.)
- If treatment is working: vitals should improve
- Changes should be realistic in magnitude (BP doesn't drop 80 points between phases without explanation)

### Medication Dosing — Use Current Standards
- Aspirin: 324-325mg PO chewed (ACS)
- Nitroglycerin: 0.4mg SL q5min x3 (contraindications: SBP<100, RV infarct, PDE5 inhibitors)
- Epinephrine (cardiac arrest): 1mg IV/IO q3-5min
- Epinephrine (anaphylaxis): 0.3-0.5mg IM (adult), 0.15mg IM (peds <30kg)
- Amiodarone: 300mg IV/IO first dose, 150mg second dose (VF/pVT)
- Albuterol: 2.5mg nebulized (adult), may repeat
- Naloxone: 0.4-2mg IV/IM/IN, titrate to respirations
- Dextrose: D10 or D50 per protocol, glucose-based dosing
- Midazolam: 2-5mg IV/IM for seizure
- Diphenhydramine: 25-50mg IV/IM (allergic reaction)
- Adenosine: 6mg rapid IVP, then 12mg (SVT)
- Atropine: 0.5mg IV q3-5min, max 3mg (symptomatic bradycardia)
- Always reference "per local protocol" when dosing may vary regionally

### Protocol References
- Follow current AHA ACLS/PALS/BLS guidelines
- Follow PHTLS principles for trauma
- Follow NREMT cognitive and psychomotor objectives
- Follow NRP guidelines for neonatal cases
- Follow NAEMSP position statements where applicable

### Program-Level Appropriateness
- EMT cases: BLS interventions only
- AEMT cases: Add IV access, fluid bolus, some medications
- Paramedic cases: Full ALS scope

## JSON SCHEMA

Generate cases matching this EXACT structure:

{
  "title": "STRING — Descriptive, unique. Format: 'Chief Complaint - Specific Diagnosis'",
  "description": "STRING — One sentence: age, sex, chief complaint",
  "chief_complaint": "STRING — Primary complaint",
  "category": "STRING — One of: cardiac, respiratory, trauma, medical, ob, peds, behavioral, environmental",
  "subcategory": "STRING",
  "difficulty": "STRING — One of: beginner, intermediate, advanced",
  "applicable_programs": ["ARRAY of: 'EMT', 'AEMT', 'Paramedic'"],
  "estimated_duration_minutes": NUMBER,
  "patient": { "age": NUMBER, "sex": "STRING", "weight_kg": NUMBER },
  "dispatch": { "call_type": "STRING", "location": "STRING", "additional_info": "STRING" },
  "scene": { "safety": "STRING", "environment": "STRING", "bystanders": "STRING", "first_impression": "STRING" },
  "phases": [
    {
      "id": "STRING — format: phase-N",
      "phase_number": NUMBER,
      "title": "STRING",
      "presentation": "STRING — Second person narrative",
      "vitals": { "bp": "STRING", "hr": "STRING", "rr": "STRING", "spo2": "STRING", "etco2": "STRING", "ekg_rhythm": "STRING", "glucose": "STRING", "temp": "STRING", "gcs": "STRING", "pupils": "STRING", "pain": "STRING" },
      "physical_findings": ["ARRAY of STRING"],
      "questions": [
        {
          "id": "STRING — format: qN-N",
          "question_type": "STRING — multiple_choice, select_all, free_text, numeric, ordered_list",
          "question_text": "STRING",
          "options": ["ARRAY"],
          "correct_answer": "STRING or NUMBER",
          "correct_answers": ["ARRAY — for select_all"],
          "correct_order": ["ARRAY — for ordered_list"],
          "acceptable_range": [NUMBER, NUMBER],
          "sample_answer": "STRING — for free_text",
          "grading_rubric": ["ARRAY — for free_text"],
          "explanation": "STRING — 2-4 sentences explaining WHY",
          "points": NUMBER,
          "time_limit_seconds": NUMBER,
          "hints": ["ARRAY"]
        }
      ],
      "transition_text": "STRING"
    }
  ],
  "learning_objectives": ["ARRAY — 3-5"],
  "critical_actions": ["ARRAY — 3-6"],
  "common_errors": ["ARRAY — 3-6"],
  "debrief_points": ["ARRAY — 3-5"]
}

### Question Design Rules
1. Every case must have at least 2 question types
2. Multiple choice: Always 4 options
3. Select all: 5-6 options, 3-4 correct
4. Free text: Include sample_answer AND grading_rubric
5. Numeric: Include acceptable_range
6. Ordered list: 4-6 items
7. Explanations must teach — explain clinical reasoning
8. Points scale: Scene safety/assessment = 5-10 pts, Critical interventions = 15-20 pts, Supporting knowledge = 10 pts

### Phase Design Rules
1. Minimum 3 phases per case
2. Each phase must have 2-4 questions
3. Presentation text should be vivid and specific
4. Vitals should evolve across phases
5. Physical findings should be specific and relevant
6. Transition text bridges the narrative

### Difficulty Calibration
- Beginner: Classic textbook, 2-3 phases, 2-3 questions per phase
- Intermediate: One complicating factor, 3 phases, 2-4 questions per phase
- Advanced: Atypical/complex, 3-4 phases, 3-4 questions per phase`;

// ---------------------------------------------------------------------------
// Fetch prompt template from DB (with fallback)
// ---------------------------------------------------------------------------

export async function fetchPromptTemplate(): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ai_prompt_templates')
      .select('prompt_text')
      .eq('name', 'case_generation_master')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.prompt_text) {
      return DEFAULT_MASTER_PROMPT;
    }

    return data.prompt_text as string;
  } catch {
    return DEFAULT_MASTER_PROMPT;
  }
}

// ---------------------------------------------------------------------------
// Build full prompt from template + brief
// ---------------------------------------------------------------------------

function buildPromptWithBrief(template: string, brief: CaseBrief): string {
  const briefParts: string[] = [];
  if (brief.category) briefParts.push(`Category: ${brief.category}`);
  if (brief.subcategory) briefParts.push(`Subcategory: ${brief.subcategory}`);
  if (brief.difficulty) briefParts.push(`Difficulty: ${brief.difficulty}`);
  if (brief.programs && brief.programs.length > 0) {
    briefParts.push(`Applicable Programs: ${brief.programs.join(', ')}`);
  }
  if (brief.scenario) briefParts.push(`Scenario Description: ${brief.scenario}`);
  if (brief.special_instructions) briefParts.push(`Special Instructions: ${brief.special_instructions}`);

  const briefBlock = briefParts.length > 0
    ? `\n\n## CASE BRIEF\n\n${briefParts.join('\n')}`
    : '';

  return `${template}${briefBlock}\n\nGenerate the case now. Output ONLY valid JSON.`;
}

// ---------------------------------------------------------------------------
// Strip markdown fences from AI response
// ---------------------------------------------------------------------------

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Map AI-generated JSON structure to case_studies DB columns
// ---------------------------------------------------------------------------

function mapGeneratedToDbRecord(generated: Record<string, unknown>): Record<string, unknown> {
  const patient = generated.patient as Record<string, unknown> | undefined;
  const dispatch = generated.dispatch as Record<string, unknown> | undefined;
  const scene = generated.scene as Record<string, unknown> | undefined;

  return {
    title: generated.title,
    description: generated.description,
    chief_complaint: generated.chief_complaint,
    category: generated.category,
    subcategory: generated.subcategory,
    difficulty: generated.difficulty,
    applicable_programs: generated.applicable_programs,
    estimated_duration_minutes: generated.estimated_duration_minutes || 30,
    patient_age: patient?.age != null ? String(patient.age) : null,
    patient_sex: patient?.sex || null,
    patient_weight: patient?.weight_kg != null ? String(patient.weight_kg) : null,
    dispatch_info: dispatch || {},
    scene_info: scene || {},
    phases: generated.phases || [],
    learning_objectives: generated.learning_objectives || [],
    critical_actions: generated.critical_actions || [],
    common_errors: generated.common_errors || [],
    debrief_points: generated.debrief_points || [],
    is_published: false,
    is_active: true,
    generated_by_ai: true,
    visibility: 'private',
  };
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

export async function generateSingleCase(
  brief: CaseBrief,
  promptTemplate: string,
  createdBy?: string
): Promise<GenerationResult> {
  // 1. Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      validationErrors: [],
      error: 'ANTHROPIC_API_KEY is not configured',
    };
  }

  // 2. Build the full prompt
  const fullPrompt = buildPromptWithBrief(promptTemplate, brief);

  // 3. Call Anthropic API
  let rawText: string;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: fullPrompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return {
        success: false,
        validationErrors: [],
        error: 'No text content in AI response',
      };
    }

    rawText = stripMarkdownFences(textContent.text);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown Anthropic API error';
    return {
      success: false,
      validationErrors: [],
      error: `Anthropic API call failed: ${errMsg}`,
    };
  }

  // 4. Parse JSON response
  let generatedCase: Record<string, unknown>;
  try {
    generatedCase = JSON.parse(rawText);
  } catch {
    return {
      success: false,
      validationErrors: [],
      rawJson: rawText.substring(0, 2000),
      error: 'Failed to parse AI response as JSON',
    };
  }

  // 5. Validate
  const validationErrors = validateCaseJson(generatedCase);
  const hasErrors = validationErrors.some((e) => e.severity === 'error');

  if (hasErrors) {
    return {
      success: false,
      title: typeof generatedCase.title === 'string' ? generatedCase.title : undefined,
      validationErrors,
      rawJson: rawText.substring(0, 2000),
      error: 'Generated case failed validation',
    };
  }

  // 6. Save to DB as draft
  try {
    const supabase = getSupabaseAdmin();
    const dbRecord = mapGeneratedToDbRecord(generatedCase);

    if (createdBy) {
      dbRecord.created_by = createdBy;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('case_studies')
      .insert(dbRecord)
      .select('id, title')
      .single();

    if (insertError) {
      return {
        success: false,
        title: typeof generatedCase.title === 'string' ? generatedCase.title : undefined,
        validationErrors,
        rawJson: rawText.substring(0, 2000),
        error: `Database insert failed: ${insertError.message}`,
      };
    }

    return {
      success: true,
      caseId: inserted.id,
      title: inserted.title,
      validationErrors, // May contain warnings
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown database error';
    return {
      success: false,
      title: typeof generatedCase.title === 'string' ? generatedCase.title : undefined,
      validationErrors,
      rawJson: rawText.substring(0, 2000),
      error: `Database error: ${errMsg}`,
    };
  }
}
