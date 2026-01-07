import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const difficulty = searchParams.get('difficulty');
  const program = searchParams.get('program');
  const search = searchParams.get('search');
  const activeOnly = searchParams.get('activeOnly') !== 'false';

  try {
    let query = supabase
      .from('scenarios')
      .select('*')
      .order('title');

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
      query = query.or(`title.ilike.%${search}%,category.ilike.%${search}%,chief_complaint.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, scenarios: data });
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch scenarios' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('scenarios')
      .insert({
        title: body.title,
        applicable_programs: body.applicable_programs || ['EMT', 'AEMT', 'Paramedic'],
        category: body.category,
        subcategory: body.subcategory || null,
        difficulty: body.difficulty || 'intermediate',
        dispatch_time: body.dispatch_time || null,
        dispatch_location: body.dispatch_location || null,
        chief_complaint: body.chief_complaint || null,
        dispatch_notes: body.dispatch_notes || null,
        patient_name: body.patient_name || null,
        patient_age: body.patient_age || null,
        patient_sex: body.patient_sex || null,
        patient_weight: body.patient_weight || null,
        medical_history: body.medical_history || [],
        medications: body.medications || [],
        allergies: body.allergies || null,
        general_impression: body.general_impression || null,
        environment_notes: body.environment_notes || null,
        assessment_x: body.assessment_x || null,
        assessment_a: body.assessment_a || null,
        assessment_b: body.assessment_b || null,
        assessment_c: body.assessment_c || null,
        assessment_d: body.assessment_d || null,
        assessment_e: body.assessment_e || null,
        avpu: body.avpu || null,
        initial_vitals: body.initial_vitals || null,
        sample_history: body.sample_history || null,
        opqrst: body.opqrst || null,
        phases: body.phases || [],
        learning_objectives: body.learning_objectives || [],
        critical_actions: body.critical_actions || [],
        debrief_points: body.debrief_points || [],
        instructor_notes: body.instructor_notes || null,
        equipment_needed: body.equipment_needed || [],
        medications_to_administer: body.medications_to_administer || [],
        estimated_duration: body.estimated_duration || null,
        documentation_required: body.documentation_required || false,
        platinum_required: body.platinum_required || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, scenario: data });
  } catch (error) {
    console.error('Error creating scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to create scenario' }, { status: 500 });
  }
}
