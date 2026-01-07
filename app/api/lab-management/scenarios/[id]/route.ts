// app/api/lab-management/scenarios/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, scenario: data });
  } catch (error) {
    console.error('Error fetching scenario:', error);
    return NextResponse.json({ success: false, error: 'Scenario not found' }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Build update object with only provided fields
    const updateData: any = { updated_at: new Date().toISOString() };
    
    const allowedFields = [
      'title', 'applicable_programs', 'category', 'subcategory', 'difficulty',
      'dispatch_time', 'dispatch_location', 'chief_complaint', 'dispatch_notes',
      'patient_name', 'patient_age', 'patient_sex', 'patient_weight',
      'medical_history', 'medications', 'allergies',
      'general_impression', 'environment_notes',
      'assessment_x', 'assessment_a', 'assessment_b', 'assessment_c', 'assessment_d', 'assessment_e', 'avpu',
      'initial_vitals', 'sample_history', 'opqrst', 'phases',
      'learning_objectives', 'critical_actions', 'debrief_points', 'instructor_notes',
      'equipment_needed', 'medications_to_administer', 'estimated_duration',
      'documentation_required', 'platinum_required', 'is_active'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('scenarios')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, scenario: data });
  } catch (error) {
    console.error('Error updating scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to update scenario' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if scenario is used in any lab stations
    const { count } = await supabase
      .from('lab_stations')
      .select('*', { count: 'exact', head: true })
      .eq('scenario_id', params.id);

    if (count && count > 0) {
      // Soft delete - mark as inactive instead
      const { error } = await supabase
        .from('scenarios')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', params.id);

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
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Scenario deleted successfully' });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete scenario' }, { status: 500 });
  }
}
