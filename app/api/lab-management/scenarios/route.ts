import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// Use service role key for server-side operations to bypass RLS
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const difficulty = searchParams.get('difficulty');
  const program = searchParams.get('program');
  const search = searchParams.get('search');
  const activeOnly = searchParams.get('activeOnly') !== 'false';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('scenarios')
      .select('id, title, chief_complaint, difficulty, category, subcategory, applicable_programs, estimated_duration, is_active, created_at, updated_at', { count: 'exact' })
      .order('title')
      .range(offset, offset + limit - 1);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }

    if (program) {
      query = query.contains('applicable_programs', [program]);
    }

    if (search) {
      const safeSearch = search.replace(/[%_,.()\\/]/g, '');
      query = query.or(`title.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%,chief_complaint.ilike.%${safeSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, scenarios: data, pagination: { limit, offset, total: count || 0 } });
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch scenarios' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Check authentication
    const auth = await requireAuth('instructor');

    if (auth instanceof NextResponse) return auth;

    const { user } = auth;

    const body = await request.json();

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const insertData = {
      title: body.title.trim(),
      applicable_programs: body.applicable_programs || ['EMT', 'AEMT', 'Paramedic'],
      category: body.category || null,
      subcategory: body.subcategory || null,
      difficulty: (body.difficulty || 'intermediate').toLowerCase(),
      estimated_duration: body.estimated_duration || null,

      // Quick reference / instructor summary
      instructor_notes: body.instructor_notes || null,
      learning_objectives: body.learning_objectives || [],

      // Dispatch info
      dispatch_time: body.dispatch_time || null,
      dispatch_location: body.dispatch_location || null,
      chief_complaint: body.chief_complaint || null,
      dispatch_notes: body.dispatch_notes || null,

      // Patient info
      patient_name: body.patient_name || null,
      patient_age: body.patient_age || null,
      patient_sex: body.patient_sex || null,
      patient_weight: body.patient_weight || null,
      medical_history: body.medical_history || [],
      medications: body.medications || [],
      allergies: body.allergies || null,

      // Phases with vitals (stored as JSONB)
      phases: body.phases || [],

      // Primary Assessment (XABCDE)
      assessment_x: body.assessment_x || null,
      assessment_a: body.assessment_a || null,
      assessment_b: body.assessment_b || null,
      assessment_c: body.assessment_c || null,
      assessment_d: body.assessment_d || null,
      assessment_e: body.assessment_e || null,

      // SAMPLE History & OPQRST
      sample_history: body.sample_history || { signs_symptoms: '', last_oral_intake: '', events_leading: '' },
      opqrst: body.opqrst || { onset: '', provocation: '', quality: '', radiation: '', severity: '', time_onset: '' },

      // Secondary Survey & EKG Findings
      secondary_survey: body.secondary_survey || {},
      ekg_findings: body.ekg_findings || (() => {
        // Fallback: sync from phase vitals for backward compatibility
        const phaseVitals = body.phases?.[0]?.vitals;
        if (phaseVitals && (phaseVitals.ekg_rhythm || phaseVitals.twelve_lead_notes)) {
          return {
            rhythm: phaseVitals.ekg_rhythm || null,
            twelve_lead: phaseVitals.twelve_lead_notes || null,
          };
        }
        return null;
      })(),

      // Grading
      critical_actions: body.critical_actions || [],
      debrief_points: body.debrief_points || [],

      // Equipment & Medications
      equipment_needed: body.equipment_needed || [],
      medications_to_administer: body.medications_to_administer || [],

      // Legacy fields (keep for compatibility)
      initial_vitals: body.phases?.[0]?.vitals || null,
      general_impression: body.phases?.[0]?.presentation_notes || null,
    };

    const { data, error } = await supabase
      .from('scenarios')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating scenario:', error);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        details: error.details || null,
        hint: error.hint || null
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, scenario: data });
  } catch (error: any) {
    console.error('Error creating scenario:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create scenario'
    }, { status: 500 });
  }
}
