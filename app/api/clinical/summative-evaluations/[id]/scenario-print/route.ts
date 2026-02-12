import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Export scenario as printable HTML
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: evaluationId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch evaluation with scenario info
    const { data: evaluation, error } = await supabase
      .from('summative_evaluations')
      .select(`
        *,
        scenario:summative_scenarios(
          id,
          scenario_number,
          title,
          description,
          patient_presentation,
          expected_interventions,
          linked_scenario_id
        ),
        cohort:cohorts(id, cohort_number, program:programs(name, abbreviation))
      `)
      .eq('id', evaluationId)
      .single();

    if (error) throw error;

    if (!evaluation) {
      return NextResponse.json({ success: false, error: 'Evaluation not found' }, { status: 404 });
    }

    // If there's a linked scenario, fetch its full details
    let linkedScenario = null;
    if (evaluation.scenario?.linked_scenario_id) {
      const { data: scenario } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', evaluation.scenario.linked_scenario_id)
        .single();

      linkedScenario = scenario;
    }

    // Generate the printable HTML
    const html = generateScenarioPrintHTML(evaluation, linkedScenario);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Error exporting scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to export scenario' }, { status: 500 });
  }
}

function generateScenarioPrintHTML(evaluation: any, linkedScenario: any): string {
  const scenario = evaluation.scenario;
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper function to render vitals grid
  const renderVitals = (vitals: any) => {
    if (!vitals) return '';
    const items = [];
    if (vitals.bp) items.push(`<td><strong>BP:</strong> ${vitals.bp}</td>`);
    if (vitals.hr) items.push(`<td><strong>HR:</strong> ${vitals.hr}</td>`);
    if (vitals.rr) items.push(`<td><strong>RR:</strong> ${vitals.rr}</td>`);
    if (vitals.spo2) items.push(`<td><strong>SpO2:</strong> ${vitals.spo2}%</td>`);
    if (vitals.temp) items.push(`<td><strong>Temp:</strong> ${vitals.temp}°F</td>`);
    if (vitals.bgl || vitals.glucose) items.push(`<td><strong>BGL:</strong> ${vitals.bgl || vitals.glucose}</td>`);
    if (vitals.gcs) items.push(`<td><strong>GCS:</strong> ${vitals.gcs}</td>`);
    if (vitals.etco2) items.push(`<td><strong>ETCO2:</strong> ${vitals.etco2}</td>`);

    if (items.length === 0) return '';

    return `<table class="vitals-table"><tr>${items.join('')}</tr></table>`;
  };

  // Build sections
  let content = '';

  // Dispatch Information
  if (linkedScenario?.dispatch_time || linkedScenario?.dispatch_location || linkedScenario?.dispatch_notes) {
    content += `
      <div class="section dispatch-section">
        <h3>DISPATCH INFORMATION</h3>
        <div class="info-grid">
          ${linkedScenario.dispatch_time ? `<div><strong>Time:</strong> ${linkedScenario.dispatch_time}</div>` : ''}
          ${linkedScenario.dispatch_location ? `<div><strong>Location:</strong> ${linkedScenario.dispatch_location}</div>` : ''}
        </div>
        ${linkedScenario.dispatch_notes ? `<p><strong>Notes:</strong> ${linkedScenario.dispatch_notes}</p>` : ''}
      </div>
    `;
  }

  // Patient Information
  if (linkedScenario) {
    content += `
      <div class="section">
        <h3>PATIENT INFORMATION</h3>
        <div class="info-grid">
          ${linkedScenario.patient_name ? `<div><strong>Name:</strong> ${linkedScenario.patient_name}</div>` : ''}
          ${linkedScenario.patient_age ? `<div><strong>Age:</strong> ${linkedScenario.patient_age} years</div>` : ''}
          ${linkedScenario.patient_sex ? `<div><strong>Sex:</strong> ${linkedScenario.patient_sex}</div>` : ''}
          ${linkedScenario.patient_weight ? `<div><strong>Weight:</strong> ${linkedScenario.patient_weight}</div>` : ''}
        </div>
        ${linkedScenario.chief_complaint ? `<p class="chief-complaint"><strong>Chief Complaint:</strong> ${linkedScenario.chief_complaint}</p>` : ''}
      </div>
    `;
  }

  // Medical History, Medications, Allergies
  if (linkedScenario?.medical_history?.length || linkedScenario?.medications?.length || linkedScenario?.allergies) {
    content += `
      <div class="section">
        <h3>MEDICAL HISTORY</h3>
        <div class="three-column">
          ${linkedScenario.medical_history?.length ? `
            <div>
              <strong>Past Medical History:</strong>
              <ul>${linkedScenario.medical_history.map((h: string) => `<li>${h}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${linkedScenario.medications?.length ? `
            <div>
              <strong>Medications:</strong>
              <ul>${linkedScenario.medications.map((m: string) => `<li>${m}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${linkedScenario.allergies ? `
            <div class="allergies">
              <strong>Allergies:</strong> ${linkedScenario.allergies}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Initial Vitals
  if (linkedScenario?.initial_vitals && Object.values(linkedScenario.initial_vitals).some((v: any) => v)) {
    content += `
      <div class="section vitals-section">
        <h3>INITIAL VITALS</h3>
        ${renderVitals(linkedScenario.initial_vitals)}
      </div>
    `;
  }

  // SAMPLE History
  if (linkedScenario?.sample_history && Object.values(linkedScenario.sample_history).some((v: any) => v)) {
    content += `
      <div class="section sample-section">
        <h3>SAMPLE HISTORY</h3>
        <table class="sample-table">
          ${linkedScenario.sample_history.signs_symptoms ? `<tr><td><strong>S - Signs/Symptoms:</strong></td><td>${linkedScenario.sample_history.signs_symptoms}</td></tr>` : ''}
          ${linkedScenario.allergies ? `<tr><td><strong>A - Allergies:</strong></td><td>${linkedScenario.allergies}</td></tr>` : ''}
          ${linkedScenario.medications?.length ? `<tr><td><strong>M - Medications:</strong></td><td>${linkedScenario.medications.join(', ')}</td></tr>` : ''}
          ${linkedScenario.medical_history?.length ? `<tr><td><strong>P - Past Medical History:</strong></td><td>${linkedScenario.medical_history.join(', ')}</td></tr>` : ''}
          ${linkedScenario.sample_history.last_oral_intake ? `<tr><td><strong>L - Last Oral Intake:</strong></td><td>${linkedScenario.sample_history.last_oral_intake}</td></tr>` : ''}
          ${linkedScenario.sample_history.events_leading ? `<tr><td><strong>E - Events Leading:</strong></td><td>${linkedScenario.sample_history.events_leading}</td></tr>` : ''}
        </table>
      </div>
    `;
  }

  // OPQRST
  if (linkedScenario?.opqrst && Object.values(linkedScenario.opqrst).some((v: any) => v)) {
    content += `
      <div class="section opqrst-section">
        <h3>OPQRST (Pain Assessment)</h3>
        <table class="opqrst-table">
          ${linkedScenario.opqrst.onset ? `<tr><td><strong>O - Onset:</strong></td><td>${linkedScenario.opqrst.onset}</td></tr>` : ''}
          ${linkedScenario.opqrst.provocation ? `<tr><td><strong>P - Provocation:</strong></td><td>${linkedScenario.opqrst.provocation}</td></tr>` : ''}
          ${linkedScenario.opqrst.quality ? `<tr><td><strong>Q - Quality:</strong></td><td>${linkedScenario.opqrst.quality}</td></tr>` : ''}
          ${linkedScenario.opqrst.radiation ? `<tr><td><strong>R - Radiation:</strong></td><td>${linkedScenario.opqrst.radiation}</td></tr>` : ''}
          ${linkedScenario.opqrst.severity ? `<tr><td><strong>S - Severity:</strong></td><td>${linkedScenario.opqrst.severity}</td></tr>` : ''}
          ${linkedScenario.opqrst.time_onset ? `<tr><td><strong>T - Time:</strong></td><td>${linkedScenario.opqrst.time_onset}</td></tr>` : ''}
        </table>
      </div>
    `;
  }

  // Primary Assessment X/A/E
  if (linkedScenario?.assessment_x || linkedScenario?.assessment_a || linkedScenario?.assessment_e || linkedScenario?.general_impression) {
    content += `
      <div class="section assessment-section">
        <h3>PRIMARY ASSESSMENT (XABCDE)</h3>
        <table class="assessment-table">
          ${linkedScenario.assessment_x ? `<tr><td><strong>X - Hemorrhage Control:</strong></td><td>${linkedScenario.assessment_x}</td></tr>` : ''}
          ${linkedScenario.assessment_a ? `<tr><td><strong>A - Airway:</strong></td><td>${linkedScenario.assessment_a}</td></tr>` : ''}
          ${linkedScenario.assessment_e ? `<tr><td><strong>E - Expose/Environment:</strong></td><td>${linkedScenario.assessment_e}</td></tr>` : ''}
          ${linkedScenario.general_impression ? `<tr><td><strong>General Impression:</strong></td><td>${linkedScenario.general_impression}</td></tr>` : ''}
        </table>
      </div>
    `;
  }

  // Phases with vitals
  if (linkedScenario?.phases?.length) {
    content += `
      <div class="section phases-section">
        <h3>SCENARIO PHASES</h3>
        ${linkedScenario.phases.map((phase: any, idx: number) => `
          <div class="phase">
            <h4>Phase ${idx + 1}: ${phase.name || `Phase ${idx + 1}`}</h4>
            ${phase.vitals ? renderVitals(phase.vitals) : ''}
            ${phase.presentation_notes ? `<p><strong>Presentation:</strong> ${phase.presentation_notes}</p>` : ''}
            ${phase.expected_actions?.length ? `
              <div>
                <strong>Expected Actions:</strong>
                <ul>${phase.expected_actions.map((a: string) => `<li>${a}</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${phase.instructor_cues ? `<p class="instructor-cue"><strong>Instructor Cue:</strong> ${phase.instructor_cues}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // Critical Actions
  if (linkedScenario?.critical_actions?.length) {
    content += `
      <div class="section critical-section">
        <h3>CRITICAL ACTIONS (Must Perform)</h3>
        <ul class="critical-list">
          ${linkedScenario.critical_actions.map((action: string) => `<li>${action}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Instructor Notes
  if (linkedScenario?.instructor_notes) {
    content += `
      <div class="section instructor-section">
        <h3>INSTRUCTOR NOTES</h3>
        <p>${linkedScenario.instructor_notes}</p>
      </div>
    `;
  }

  // Basic scenario info fallback (if no linked scenario)
  if (!linkedScenario) {
    if (scenario?.description) {
      content += `
        <div class="section">
          <h3>DESCRIPTION</h3>
          <p>${scenario.description}</p>
        </div>
      `;
    }
    if (scenario?.patient_presentation) {
      content += `
        <div class="section">
          <h3>PATIENT PRESENTATION</h3>
          <p>${scenario.patient_presentation}</p>
        </div>
      `;
    }
    if (scenario?.expected_interventions?.length) {
      content += `
        <div class="section">
          <h3>EXPECTED INTERVENTIONS</h3>
          <ul>${scenario.expected_interventions.map((i: string) => `<li>${i}</li>`).join('')}</ul>
        </div>
      `;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Scenario #${scenario?.scenario_number} - ${scenario?.title || linkedScenario?.title}</title>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { font-size: 11pt; }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #000;
      background: #fff;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }

    .no-print {
      margin-bottom: 20px;
      text-align: center;
    }

    .no-print button {
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      margin: 0 5px;
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }

    .header h1 {
      font-size: 20px;
      margin-bottom: 5px;
    }

    .header h2 {
      font-size: 16px;
      font-weight: normal;
      color: #333;
    }

    .meta-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      padding: 10px;
      background: #f5f5f5;
      border: 1px solid #ddd;
    }

    .section {
      margin-bottom: 20px;
      padding: 15px;
      border: 1px solid #ccc;
      background: #fafafa;
    }

    .section h3 {
      font-size: 14px;
      text-transform: uppercase;
      border-bottom: 2px solid #333;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    .dispatch-section {
      background: #f0f0f0;
      border-color: #999;
    }

    .vitals-section {
      background: #e6f3ff;
      border-color: #0066cc;
    }

    .vitals-section h3 {
      color: #0066cc;
      border-color: #0066cc;
    }

    .vitals-table {
      width: 100%;
      border-collapse: collapse;
    }

    .vitals-table td {
      padding: 8px 12px;
      border: 1px solid #ccc;
      background: #fff;
      text-align: center;
    }

    .sample-section {
      background: #e6ffe6;
      border-color: #006600;
    }

    .sample-section h3 {
      color: #006600;
      border-color: #006600;
    }

    .opqrst-section {
      background: #f3e6ff;
      border-color: #660099;
    }

    .opqrst-section h3 {
      color: #660099;
      border-color: #660099;
    }

    .assessment-section {
      background: #e6ffff;
      border-color: #006666;
    }

    .assessment-section h3 {
      color: #006666;
      border-color: #006666;
    }

    .sample-table,
    .opqrst-table,
    .assessment-table {
      width: 100%;
      border-collapse: collapse;
    }

    .sample-table td,
    .opqrst-table td,
    .assessment-table td {
      padding: 6px 10px;
      border: 1px solid #ccc;
      vertical-align: top;
    }

    .sample-table td:first-child,
    .opqrst-table td:first-child,
    .assessment-table td:first-child {
      width: 200px;
      background: #f9f9f9;
    }

    .critical-section {
      background: #ffe6e6;
      border: 2px solid #cc0000;
    }

    .critical-section h3 {
      color: #cc0000;
      border-color: #cc0000;
    }

    .critical-list li {
      margin-left: 20px;
      padding: 3px 0;
      font-weight: bold;
    }

    .instructor-section {
      background: #fff8e6;
      border-color: #cc7700;
    }

    .instructor-section h3 {
      color: #cc7700;
      border-color: #cc7700;
    }

    .phases-section .phase {
      margin-bottom: 15px;
      padding: 10px;
      background: #fff;
      border: 1px solid #ddd;
    }

    .phases-section .phase h4 {
      font-size: 13px;
      margin-bottom: 10px;
      color: #333;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .three-column {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }

    ul {
      margin-left: 20px;
    }

    li {
      margin-bottom: 3px;
    }

    .allergies {
      color: #cc0000;
      font-weight: bold;
    }

    .chief-complaint {
      font-size: 14px;
      margin-top: 10px;
      padding: 10px;
      background: #fff;
      border-left: 4px solid #cc0000;
    }

    .instructor-cue {
      margin-top: 10px;
      padding: 8px;
      background: #fff8e6;
      border-left: 3px solid #cc7700;
      font-style: italic;
    }

    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button onclick="window.close()">Close</button>
  </div>

  <div class="header">
    <h1>PIMA MEDICAL INSTITUTE</h1>
    <h2>Scenario #${scenario?.scenario_number}: ${scenario?.title || linkedScenario?.title}</h2>
  </div>

  <div class="meta-info">
    <div><strong>Date:</strong> ${formatDate(evaluation.evaluation_date)}</div>
    <div><strong>Examiner:</strong> ${evaluation.examiner_name}</div>
    ${evaluation.location ? `<div><strong>Location:</strong> ${evaluation.location}</div>` : ''}
    ${evaluation.cohort ? `<div><strong>Cohort:</strong> ${evaluation.cohort.program?.abbreviation || ''} ${evaluation.cohort.cohort_number}</div>` : ''}
  </div>

  ${content}

  <div class="footer">
    Printed: ${new Date().toLocaleString()} | For instructor reference only
  </div>
</body>
</html>
  `;
}
