import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Wide-table columns for compliance docs (matches DB schema)
const DOC_COLUMNS = [
  { key: 'mmr_complete', label: 'mmr' },
  { key: 'vzv_complete', label: 'vzv' },
  { key: 'hep_b_complete', label: 'hepb' },
  { key: 'tdap_complete', label: 'tdap' },
  { key: 'covid_complete', label: 'covid' },
  { key: 'tb_test_1_complete', label: 'tb' },
  { key: 'physical_complete', label: 'physical' },
  { key: 'health_insurance_complete', label: 'insurance' },
  { key: 'bls_complete', label: 'bls' },
  { key: 'flu_shot_complete', label: 'flu' },
  { key: 'hospital_orientation_complete', label: 'hospital_orient' },
  { key: 'background_check_complete', label: 'background' },
  { key: 'drug_test_complete', label: 'drug_test' },
];
const REQUIRED_DOCS = DOC_COLUMNS.map(d => d.label);
const MCE_MODULES = ['airway', 'respiratory', 'cardiovascular', 'trauma', 'medical', 'obstetrics', 'pediatrics', 'geriatrics', 'behavioral', 'toxicology', 'neurology', 'endocrine', 'immunology', 'infectious', 'operations'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: studentId } = await params;

    // Fetch all clinical data in parallel
    const [
      { data: complianceDoc },
      { data: internship },
      { data: clinicalHours },
      { data: mceModules },
    ] = await Promise.all([
      // Wide-table: one row per student with boolean columns
      supabase
        .from('student_compliance_docs')
        .select('*')
        .eq('student_id', studentId)
        .single(),
      supabase
        .from('student_internships')
        .select(`
          id,
          status,
          current_phase,
          phase_1_eval_completed,
          phase_2_eval_completed,
          agencies (name, abbreviation)
        `)
        .eq('student_id', studentId)
        .single(),
      supabase
        .from('student_clinical_hours')
        .select('department, hours, shifts')
        .eq('student_id', studentId),
      supabase
        .from('student_mce_modules')
        .select('module_name, completed')
        .eq('student_id', studentId)
        .eq('completed', true),
    ]);

    // Process compliance docs (wide-table: check each boolean column)
    const completedDocs: string[] = [];
    if (complianceDoc) {
      for (const col of DOC_COLUMNS) {
        if (complianceDoc[col.key] === true) {
          completedDocs.push(col.label);
        }
      }
    }
    const compliancePercent = Math.round((completedDocs.length / REQUIRED_DOCS.length) * 100);

    // Process mCE modules
    const completedMce = mceModules?.map(m => m.module_name) || [];
    const mcePercent = Math.round((completedMce.length / MCE_MODULES.length) * 100);

    // Process clinical hours
    const totalHours = clinicalHours?.reduce((sum, h) => sum + (h.hours || 0), 0) || 0;
    const hoursByDept: Record<string, number> = {};
    clinicalHours?.forEach(h => {
      if (h.department) {
        hoursByDept[h.department] = (hoursByDept[h.department] || 0) + (h.hours || 0);
      }
    });

    // Process internship
    const agencyData = internship?.agencies as unknown as { name: string; abbreviation: string } | null;
    const internshipData = internship ? {
      id: internship.id,
      status: internship.status,
      currentPhase: internship.current_phase,
      agency: agencyData?.name || null,
      phase1Completed: internship.phase_1_eval_completed || false,
      phase2Completed: internship.phase_2_eval_completed || false,
    } : null;

    return NextResponse.json({
      success: true,
      tasks: {
        compliance: {
          completed: completedDocs,
          total: REQUIRED_DOCS.length,
          percent: compliancePercent,
        },
        internship: internshipData,
        clinicalHours: {
          total: totalHours,
          byDepartment: hoursByDept,
        },
        mce: {
          completed: completedMce,
          total: MCE_MODULES.length,
          percent: mcePercent,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching clinical tasks:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clinical tasks' }, { status: 500 });
  }
}
