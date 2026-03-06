import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper - resolve current user
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// POST /api/admin/scenarios/bulk-import/commit
//
// Accepts an array of validated (parsed) scenarios and inserts them into the
// database. Returns success/failure counts per scenario.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const scenarios = body.scenarios;

    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return NextResponse.json({ error: 'No scenarios provided' }, { status: 400 });
    }

    if (scenarios.length > 200) {
      return NextResponse.json({ error: `Too many scenarios (${scenarios.length}). Maximum is 200 per import.` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const results: { index: number; title: string; id?: string; error?: string }[] = [];

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      try {
        // Validate required field
        if (!scenario.title?.trim()) {
          results.push({ index: i, title: '(untitled)', error: 'Title is required' });
          continue;
        }

        // Build the insert data matching the existing scenario creation pattern
        const insertData = {
          title: scenario.title.trim(),
          category: scenario.category || null,
          subcategory: scenario.subcategory || null,
          difficulty: (scenario.difficulty || 'intermediate').toLowerCase(),
          estimated_duration: scenario.estimated_duration || null,
          applicable_programs: scenario.applicable_programs || ['EMT', 'AEMT', 'Paramedic'],
          dispatch_time: scenario.dispatch_time || null,
          dispatch_location: scenario.dispatch_location || null,
          chief_complaint: scenario.chief_complaint || null,
          dispatch_notes: scenario.dispatch_notes || null,
          patient_name: scenario.patient_name || null,
          patient_age: scenario.patient_age || null,
          patient_sex: scenario.patient_sex || null,
          patient_weight: scenario.patient_weight || null,
          medical_history: scenario.medical_history || [],
          medications: scenario.medications || [],
          allergies: scenario.allergies || null,
          sample_history: scenario.sample_history || {},
          instructor_notes: scenario.instructor_notes || null,
          learning_objectives: scenario.learning_objectives || [],
          phases: scenario.phases || [],
          critical_actions: scenario.critical_actions || [],
          debrief_points: scenario.debrief_points || [],
          initial_vitals: scenario.initial_vitals || null,
          general_impression: scenario.general_impression || null,
          ekg_findings: scenario.ekg_findings || null,
          is_active: scenario.is_active !== false,
        };

        const { data, error } = await supabase
          .from('scenarios')
          .insert(insertData)
          .select('id, title')
          .single();

        if (error) {
          console.error(`Error inserting scenario "${scenario.title}":`, error);
          results.push({ index: i, title: scenario.title, error: error.message });
        } else {
          results.push({ index: i, title: data.title, id: data.id });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error processing scenario at index ${i}:`, err);
        results.push({ index: i, title: scenario.title || '(untitled)', error: message });
      }
    }

    const imported = results.filter(r => r.id);
    const failed = results.filter(r => r.error);

    return NextResponse.json({
      success: failed.length === 0,
      message: `Imported ${imported.length} of ${scenarios.length} scenarios`,
      total: scenarios.length,
      importedCount: imported.length,
      failedCount: failed.length,
      imported,
      failed: failed.length > 0 ? failed : undefined,
    });
  } catch (error: unknown) {
    console.error('Error committing bulk import:', error);
    const message = error instanceof Error ? error.message : 'Failed to commit import';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
