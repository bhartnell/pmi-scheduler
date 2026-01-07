// app/api/lab-management/scenarios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const program = searchParams.get('program');
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

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
      query = query.or(`title.ilike.%${search}%,chief_complaint.ilike.%${search}%,category.ilike.%${search}%`);
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
    
    // Extract fields
    const {
      title,
      applicable_programs,
      category,
      subcategory,
      difficulty,
      dispatch_time,
      dispatch_location,
      chief_complaint,
      dispatch_notes,
      patient_name,
      patient_age,
      patient_sex,
      patient_weight,
      medical_history,
      medications,
      allergies,
      general_impression,
      environment_notes,
      assessment_x,
      assessment_a,
      assessment_b,
      assessment_c,
      assessment_d,
      assessment_e,
      avpu,
      initial_vitals,
      sample_history,
      opqrst,
      phases,
      learning_objectives,
      critical_actions,
      debrief_points,
      instructor_notes,
      equipment_needed,
      medications_to_administer,
      estimated_duration,
      documentation_required,
      platinum_required,
      created_by,
    } = body;

    if (!title || !category) {
      return NextResponse.json(
        { success: false, error: 'Title and category are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('scenarios')
      .insert({
        title,
        applicable_programs: applicable_programs || ['EMT', 'AEMT', 'Paramedic'],
        category,
        subcategory: subcategory || null,
        difficulty: difficulty || 'intermediate',
        dispatch_time: dispatch_time || null,
        dispatch_location: dispatch_location || null,
        chief_complaint: chief_complaint || null,
        dispatch_notes: dispatch_notes || null,
        patient_name: patient_name || null,
        patient_age: patient_age || null,
        patient_sex: patient_sex || null,
        patient_weight: patient_weight || null,
        medical_history: medical_history || [],
        medications: medications || [],
        allergies: allergies || null,
        general_impression: general_impression || null,
        environment_notes: environment_notes || null,
        assessment_x: assessment_x || null,
        assessment_a: assessment_a || null,
        assessment_b: assessment_b || null,
        assessment_c: assessment_c || null,
        assessment_d: assessment_d || null,
        assessment_e: assessment_e || null,
        avpu: avpu || null,
        initial_vitals: initial_vitals || null,
        sample_history: sample_history || null,
        opqrst: opqrst || null,
        phases: phases || null,
        learning_objectives: learning_objectives || [],
        critical_actions: critical_actions || [],
        debrief_points: debrief_points || [],
        instructor_notes: instructor_notes || null,
        equipment_needed: equipment_needed || [],
        medications_to_administer: medications_to_administer || [],
        estimated_duration: estimated_duration || null,
        documentation_required: documentation_required || false,
        platinum_required: platinum_required || false,
        created_by: created_by || null,
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
