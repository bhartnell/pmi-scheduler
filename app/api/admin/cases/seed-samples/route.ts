import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import sampleCases from '@/data/case-studies/sample-cases.json';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();

    const results: { title: string; status: string; id?: string; error?: string }[] = [];

    for (const caseData of sampleCases) {
      // Check if a case with the same title already exists
      const { data: existing } = await supabase
        .from('case_studies')
        .select('id')
        .eq('title', caseData.title)
        .eq('visibility', 'official')
        .maybeSingle();

      const caseRecord = {
        title: caseData.title,
        description: caseData.description,
        chief_complaint: caseData.chief_complaint,
        category: caseData.category,
        subcategory: caseData.subcategory,
        difficulty: caseData.difficulty,
        applicable_programs: caseData.applicable_programs,
        estimated_duration_minutes: caseData.estimated_duration_minutes,
        patient_age: caseData.patient_age,
        patient_sex: caseData.patient_sex,
        patient_weight: caseData.patient_weight,
        patient_medical_history: caseData.patient_medical_history,
        patient_medications: caseData.patient_medications,
        patient_allergies: caseData.patient_allergies,
        dispatch_info: caseData.dispatch_info,
        scene_info: caseData.scene_info,
        phases: caseData.phases,
        learning_objectives: caseData.learning_objectives,
        critical_actions: caseData.critical_actions,
        common_errors: caseData.common_errors,
        debrief_points: caseData.debrief_points,
        equipment_needed: caseData.equipment_needed,
        visibility: 'official' as const,
        is_published: true,
        is_active: true,
        is_verified: true,
        author: user.name || user.email,
        created_by: user.id,
        generated_by_ai: false,
      };

      if (existing) {
        // Update existing case
        const { data, error } = await supabase
          .from('case_studies')
          .update({
            ...caseRecord,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (error) {
          results.push({ title: caseData.title, status: 'error', error: error.message });
        } else {
          results.push({ title: caseData.title, status: 'updated', id: data.id });
        }
      } else {
        // Insert new case
        const { data, error } = await supabase
          .from('case_studies')
          .insert(caseRecord)
          .select('id')
          .single();

        if (error) {
          results.push({ title: caseData.title, status: 'error', error: error.message });
        } else {
          results.push({ title: caseData.title, status: 'created', id: data.id });
        }
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const errors = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: errors === 0,
      message: `Seeded ${created} new cases, updated ${updated} existing cases${errors > 0 ? `, ${errors} errors` : ''}`,
      results,
    });
  } catch (error) {
    console.error('Error seeding sample cases:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
