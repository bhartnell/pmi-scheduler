import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Score category definitions for the rubric
const SCORE_CATEGORIES = [
  {
    key: 'leadership_scene_score',
    label: 'Leadership and Scene Management',
    levels: [
      'Does not take charge of the scene; fails to address safety or manage resources',
      'Takes some initiative but leadership is inconsistent; safety addressed partially',
      'Assumes leadership role appropriately; addresses safety and manages resources adequately',
      'Demonstrates excellent leadership; proactively ensures safety and efficiently manages all resources'
    ]
  },
  {
    key: 'patient_assessment_score',
    label: 'Patient Assessment',
    levels: [
      'Assessment is incomplete or disorganized; misses critical findings',
      'Performs basic assessment but lacks thoroughness; some findings missed',
      'Performs complete systematic assessment; identifies most significant findings',
      'Performs comprehensive, organized assessment; identifies all significant findings quickly'
    ]
  },
  {
    key: 'patient_management_score',
    label: 'Patient Management',
    levels: [
      'Interventions inappropriate or absent; may cause harm',
      'Some appropriate interventions but treatment plan incomplete or delayed',
      'Provides appropriate interventions in timely manner; treatment plan adequate',
      'Provides optimal interventions; anticipates needs and adapts treatment as needed'
    ]
  },
  {
    key: 'interpersonal_score',
    label: 'Interpersonal Relations',
    levels: [
      'Communication ineffective or unprofessional; fails to build rapport',
      'Communication adequate but could improve; some difficulty with team or patient',
      'Communicates effectively with patient, family, and team; professional demeanor',
      'Exceptional communication skills; builds strong rapport; excellent team coordination'
    ]
  },
  {
    key: 'integration_score',
    label: 'Integration (Field Impression & Transport)',
    levels: [
      'Unable to formulate field impression; transport decision inappropriate',
      'Field impression partially correct; transport decision acceptable but not optimal',
      'Accurate field impression; appropriate transport decision based on findings',
      'Comprehensive field impression with differential; optimal transport decision with clear rationale'
    ]
  }
];

const CRITICAL_CRITERIA = [
  { key: 'critical_fails_mandatory', label: 'Fails Mandatory Actions' },
  { key: 'critical_harmful_intervention', label: 'Harmful Intervention' },
  { key: 'critical_unprofessional', label: 'Unprofessional Behavior' }
];

// GET - Export evaluation as HTML (for printing as PDF)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: evaluationId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get student ID from query params (optional - if not provided, export all)
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');

    // Fetch evaluation with all data
    const { data: evaluation, error } = await supabase
      .from('summative_evaluations')
      .select(`
        *,
        scenario:summative_scenarios(id, scenario_number, title, description, patient_presentation),
        cohort:cohorts(id, cohort_number, program:programs(name, abbreviation)),
        scores:summative_evaluation_scores(
          id,
          student_id,
          student:students(id, first_name, last_name),
          leadership_scene_score,
          patient_assessment_score,
          patient_management_score,
          interpersonal_score,
          integration_score,
          total_score,
          critical_criteria_failed,
          critical_fails_mandatory,
          critical_harmful_intervention,
          critical_unprofessional,
          critical_criteria_notes,
          passed,
          start_time,
          end_time,
          examiner_notes,
          feedback_provided,
          grading_complete,
          graded_at
        )
      `)
      .eq('id', evaluationId)
      .single();

    if (error) throw error;

    if (!evaluation) {
      return NextResponse.json({ success: false, error: 'Evaluation not found' }, { status: 404 });
    }

    // Filter scores if studentId provided
    let scores = evaluation.scores || [];
    if (studentId) {
      scores = scores.filter((s: any) => s.student_id === studentId);
    }

    // Generate HTML for each student
    const htmlPages = scores.map((score: any) => generateStudentPDF(evaluation, score));

    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Summative Evaluation - ${evaluation.scenario?.title}</title>
  <style>
    @media print {
      .page-break { page-break-after: always; }
      .page { page-break-inside: avoid; }
    }

    /* Ensure each student page starts on a new page */
    .page:not(:first-child) {
      page-break-before: always;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }

    .page {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }

    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }

    .header h1 {
      font-size: 16px;
      margin-bottom: 5px;
    }

    .header h2 {
      font-size: 14px;
      font-weight: normal;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 15px;
      font-size: 11px;
    }

    .info-row {
      display: flex;
      gap: 5px;
    }

    .info-label {
      font-weight: bold;
      min-width: 80px;
    }

    .rubric-section {
      margin-bottom: 15px;
    }

    .rubric-title {
      font-weight: bold;
      font-size: 12px;
      background: #f0f0f0;
      padding: 5px;
      border: 1px solid #000;
      border-bottom: none;
    }

    .rubric-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .rubric-table th,
    .rubric-table td {
      border: 1px solid #000;
      padding: 4px;
      text-align: left;
      vertical-align: top;
    }

    .rubric-table th {
      background: #e0e0e0;
      font-weight: bold;
      text-align: center;
      width: 25%;
    }

    .rubric-table td.selected {
      background: #e8e8e8;
      font-weight: bold;
      border: 2px solid #000;
    }

    /* B&W friendly score marker */
    .score-marker {
      font-family: monospace;
      font-weight: bold;
      font-size: 12px;
      margin-right: 3px;
    }

    .critical-section {
      border: 2px solid #000;
      padding: 10px;
      margin-bottom: 15px;
    }

    .critical-title {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .critical-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 5px;
    }

    /* B&W friendly checkbox text */
    .checkbox-text {
      font-family: monospace;
      font-weight: bold;
      font-size: 14px;
    }

    .total-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background: #f0f0f0;
      border: 2px solid #000;
      margin-bottom: 15px;
    }

    .total-score {
      font-size: 24px;
      font-weight: bold;
    }

    .pass-fail {
      font-size: 18px;
      font-weight: bold;
      padding: 5px 15px;
      border: 2px solid;
    }

    .pass-fail.pass {
      background: #fff;
      border-color: #000;
      color: #000;
    }

    .pass-fail.pass::before {
      content: "✓ ";
    }

    .pass-fail.fail {
      background: #e8e8e8;
      border-color: #000;
      color: #000;
    }

    .pass-fail.fail::before {
      content: "✗ ";
    }

    .notes-section {
      margin-top: 15px;
    }

    .notes-title {
      font-weight: bold;
      margin-bottom: 5px;
    }

    .notes-content {
      border: 1px solid #ccc;
      padding: 8px;
      min-height: 40px;
      background: #fafafa;
    }

    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 30px;
    }

    .signature-line {
      border-top: 1px solid #000;
      padding-top: 5px;
      margin-top: 30px;
    }

    .no-print {
      margin-bottom: 20px;
      text-align: center;
    }

    @media print {
      .no-print { display: none; }
      .page { padding: 0.3in; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>
  ${htmlPages.join('<div class="page-break"></div>')}
</body>
</html>
    `;

    return new NextResponse(fullHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Error exporting evaluation:', error);
    return NextResponse.json({ success: false, error: 'Failed to export evaluation' }, { status: 500 });
  }
}

function generateStudentPDF(evaluation: any, score: any): string {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const student = score.student;
  const scenario = evaluation.scenario;

  // Calculate total score from individual scores if total_score is null
  const calculatedTotal = (
    (score.leadership_scene_score || 0) +
    (score.patient_assessment_score || 0) +
    (score.patient_management_score || 0) +
    (score.interpersonal_score || 0) +
    (score.integration_score || 0)
  );
  const totalScore = score.total_score ?? calculatedTotal;

  // Generate rubric sections with B&W friendly markers
  const rubricSections = SCORE_CATEGORIES.map(category => {
    const scoreValue = score[category.key] as number | null;

    return `
      <div class="rubric-section">
        <div class="rubric-title">${category.label}</div>
        <table class="rubric-table">
          <thead>
            <tr>
              <th>0 - Unsatisfactory</th>
              <th>1 - Needs Improvement</th>
              <th>2 - Satisfactory</th>
              <th>3 - Excellent</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              ${category.levels.map((desc, idx) => `
                <td class="${scoreValue === idx ? 'selected' : ''}">
                  <span class="score-marker">${scoreValue === idx ? '[X]' : '[ ]'}</span>
                  <strong>${idx}</strong> - ${desc}
                </td>
              `).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  // Generate critical criteria section with B&W friendly checkboxes
  const criticalSection = `
    <div class="critical-section">
      <div class="critical-title">CRITICAL CRITERIA (Any checked = Automatic Fail)</div>
      ${CRITICAL_CRITERIA.map(criteria => {
        const isChecked = score[criteria.key] || false;
        return `
          <div class="critical-item">
            <span class="checkbox-text">${isChecked ? '[X]' : '[ ]'}</span>
            <span>${criteria.label}</span>
          </div>
        `;
      }).join('')}
      ${score.critical_criteria_notes ? `
        <div style="margin-top: 10px; font-style: italic;">
          Notes: ${score.critical_criteria_notes}
        </div>
      ` : ''}
    </div>
  `;

  // Determine pass/fail based on score and critical criteria
  const hasCriticalFail = score.critical_criteria_failed || score.critical_fails_mandatory || score.critical_harmful_intervention || score.critical_unprofessional;
  const calculatedPassed = !hasCriticalFail && totalScore >= 12; // 80% of 15
  const passed = score.passed ?? calculatedPassed;
  const passFailClass = passed === true ? 'pass' : 'fail';
  const passFailText = passed === true ? 'PASS' : 'FAIL';

  return `
    <div class="page">
      <div class="header">
        <h1>PIMA MEDICAL INSTITUTE</h1>
        <h2>Program Summative Scenario Evaluation</h2>
      </div>

      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Candidate:</span>
          <span>${student?.first_name} ${student?.last_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span>${formatDate(evaluation.evaluation_date)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Scenario:</span>
          <span>#${scenario?.scenario_number} - ${scenario?.title}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Examiner:</span>
          <span>${evaluation.examiner_name}</span>
        </div>
        ${evaluation.cohort ? `
        <div class="info-row">
          <span class="info-label">Cohort:</span>
          <span>${evaluation.cohort.program?.abbreviation || ''} ${evaluation.cohort.cohort_number}</span>
        </div>
        ` : ''}
        ${evaluation.location ? `
        <div class="info-row">
          <span class="info-label">Location:</span>
          <span>${evaluation.location}</span>
        </div>
        ` : ''}
      </div>

      ${rubricSections}

      ${criticalSection}

      <div class="total-section">
        <div>
          <strong>Total Score:</strong>
          <span class="total-score">${totalScore} / 15</span>
          <span style="margin-left: 20px; color: #666;">
            (${Math.round((totalScore / 15) * 100)}% - Pass ≥ 80%)
          </span>
        </div>
        <div class="pass-fail ${passFailClass}">${passFailText}</div>
      </div>

      ${score.feedback_provided ? `
      <div class="notes-section">
        <div class="notes-title">Feedback for Student:</div>
        <div class="notes-content">${score.feedback_provided}</div>
      </div>
      ` : ''}

      ${score.examiner_notes ? `
      <div class="notes-section">
        <div class="notes-title">Examiner Notes:</div>
        <div class="notes-content">${score.examiner_notes}</div>
      </div>
      ` : ''}

      <div class="signature-section">
        <div>
          <div class="signature-line">Examiner Signature</div>
        </div>
        <div>
          <div class="signature-line">Date</div>
        </div>
      </div>
    </div>
  `;
}
