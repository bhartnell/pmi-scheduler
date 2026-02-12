import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Use service role key for server-side operations to bypass RLS
// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, scenario: data });
  } catch (error) {
    console.error('Error fetching scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch scenario' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabase();

    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Basic info
    if (body.title !== undefined) updateData.title = body.title;
    if (body.applicable_programs !== undefined) updateData.applicable_programs = body.applicable_programs;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty.toLowerCase();
    if (body.estimated_duration !== undefined) updateData.estimated_duration = body.estimated_duration;
    
    // Quick reference
    if (body.instructor_notes !== undefined) updateData.instructor_notes = body.instructor_notes;
    if (body.learning_objectives !== undefined) updateData.learning_objectives = body.learning_objectives;
    
    // Dispatch
    if (body.dispatch_time !== undefined) updateData.dispatch_time = body.dispatch_time;
    if (body.dispatch_location !== undefined) updateData.dispatch_location = body.dispatch_location;
    if (body.chief_complaint !== undefined) updateData.chief_complaint = body.chief_complaint;
    if (body.dispatch_notes !== undefined) updateData.dispatch_notes = body.dispatch_notes;
    
    // Patient
    if (body.patient_name !== undefined) updateData.patient_name = body.patient_name;
    if (body.patient_age !== undefined) updateData.patient_age = body.patient_age;
    if (body.patient_sex !== undefined) updateData.patient_sex = body.patient_sex;
    if (body.patient_weight !== undefined) updateData.patient_weight = body.patient_weight;
    if (body.medical_history !== undefined) updateData.medical_history = body.medical_history;
    if (body.medications !== undefined) updateData.medications = body.medications;
    if (body.allergies !== undefined) updateData.allergies = body.allergies;

    // Primary Assessment - XABCDE
    if (body.assessment_x !== undefined) updateData.assessment_x = body.assessment_x;
    if (body.assessment_a !== undefined) updateData.assessment_a = body.assessment_a;
    if (body.assessment_e !== undefined) updateData.assessment_e = body.assessment_e;
    if (body.general_impression !== undefined) updateData.general_impression = body.general_impression;

    // SAMPLE History (scenario-level)
    if (body.sample_history !== undefined) updateData.sample_history = body.sample_history;

    // OPQRST (scenario-level)
    if (body.opqrst !== undefined) updateData.opqrst = body.opqrst;

    // Phases
    if (body.phases !== undefined) {
      updateData.phases = body.phases;
      // Also update legacy initial_vitals for compatibility
      if (body.phases.length > 0) {
        updateData.initial_vitals = body.phases[0].vitals || null;
        updateData.general_impression = body.phases[0].presentation_notes || null;
      }
    }
    
    // Grading
    if (body.critical_actions !== undefined) updateData.critical_actions = body.critical_actions;
    if (body.debrief_points !== undefined) updateData.debrief_points = body.debrief_points;
    
    // Status
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabase
      .from('scenarios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating scenario:', error);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        details: error.details || null
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, scenario: data });
  } catch (error: any) {
    console.error('Error updating scenario:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update scenario' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabase();

    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if scenario is used in any lab stations
    const { count } = await supabase
      .from('lab_stations')
      .select('*', { count: 'exact', head: true })
      .eq('scenario_id', id);

    if (count && count > 0) {
      // Soft delete - just mark as inactive
      const { error } = await supabase
        .from('scenarios')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({ 
        success: true, 
        message: 'Scenario marked as inactive (used in lab schedules)' 
      });
    }

    // Hard delete if not used
    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete scenario' }, { status: 500 });
  }
}
