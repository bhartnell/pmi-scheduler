import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const REQUIRED_DOCS = ['mmr', 'vzv', 'hepb', 'tdap', 'covid', 'tb', 'physical', 'insurance', 'bls', 'flu', 'hospital_orient', 'background', 'drug_test'];
const MCE_MODULES = ['airway', 'respiratory', 'cardiovascular', 'trauma', 'medical', 'obstetrics', 'pediatrics', 'geriatrics', 'behavioral', 'toxicology', 'neurology', 'endocrine', 'immunology', 'infectious', 'operations'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: studentId } = await params;

    // Fetch all clinical data in parallel
    const [
      { data: complianceDocs },
      { data: internship },
      { data: clinicalHours },
      { data: mceModules },
    ] = await Promise.all([
      supabase
        .from('student_compliance_docs')
        .select('doc_type, completed')
        .eq('student_id', studentId)
        .eq('completed', true),
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

    // Process compliance docs
    const completedDocs = complianceDocs?.map(d => d.doc_type) || [];
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
