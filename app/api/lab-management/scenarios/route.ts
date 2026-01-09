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
        category: body.category || null,
        subcategory: body.subcategory || null,
        difficulty: body.difficulty || 'intermediate',
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
        
        // Grading
        critical_actions: body.critical_actions || [],
        debrief_points: body.debrief_points || [],
        
        // Legacy fields (keep for compatibility)
        initial_vitals: body.phases?.[0]?.vitals || null,
        general_impression: body.phases?.[0]?.presentation_notes || null,
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
