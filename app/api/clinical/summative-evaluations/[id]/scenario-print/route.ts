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

    const supabase = getSupabase();

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

  // Helper function to render vitals as a horizontal table row
  const renderVitalsRow = (vitals: any) => {
    if (!vitals) return '';

    // Standard vitals labels and values
    const vitalItems = [
      { label: 'BP', value: vitals.bp },
      { label: 'HR', value: vitals.hr },
      { label: 'RR', value: vitals.rr },
      { label: 'SpO2', value: vitals.spo2 ? `${vitals.spo2}%` : null },
      { label: 'Temp', value: vitals.temp ? `${vitals.temp}°F` : null },
      { label: 'BGL', value: vitals.bgl || vitals.glucose },
      { label: 'GCS', value: vitals.gcs },
      { label: 'ETCO2', value: vitals.etco2 }
    ].filter(v => v.value);

    if (vitalItems.length === 0) return '';

    return `
      <table class="vitals-table">
        <tr class="vitals-header">${vitalItems.map(v => `<th>${v.label}</th>`).join('')}</tr>
        <tr class="vitals-values">${vitalItems.map(v => `<td>${v.value}</td>`).join('')}</tr>
      </table>
    `;
  };

  // Build sections in INSTRUCTOR-FOCUSED order
  // Instructor reads these BEFORE running the scenario
  let content = '';

  // ============================================================
  // 1. INSTRUCTOR NOTES (TOP - READ FIRST!)
  // Brief case summary, initial vitals to program, key tips
  // ============================================================
  if (linkedScenario?.instructor_notes) {
    content += `
      <div class="section instructor-section-top">
        <h3>⚡ INSTRUCTOR NOTES (READ FIRST)</h3>
        <p>${linkedScenario.instructor_notes}</p>
      </div>
    `;
  }

  // ============================================================
  // 2. DISPATCH INFORMATION
  // Time, Location, Chief Complaint, Dispatch Notes
  // ============================================================
  if (linkedScenario?.dispatch_time || linkedScenario?.dispatch_location || linkedScenario?.dispatch_notes || linkedScenario?.chief_complaint) {
    content += `
      <div class="section">
        <h3>DISPATCH INFORMATION</h3>
        <div class="info-grid">
          ${linkedScenario.dispatch_time ? `<div><strong>Time:</strong> ${linkedScenario.dispatch_time}</div>` : ''}
          ${linkedScenario.dispatch_location ? `<div><strong>Location:</strong> ${linkedScenario.dispatch_location}</div>` : ''}
        </div>
        ${linkedScenario.chief_complaint ? `<p class="chief-complaint"><strong>Chief Complaint:</strong> ${linkedScenario.chief_complaint}</p>` : ''}
        ${linkedScenario.dispatch_notes ? `<p class="dispatch-notes"><strong>Dispatch Notes:</strong> ${linkedScenario.dispatch_notes}</p>` : ''}
      </div>
    `;
  }

  // ============================================================
  // 3. PATIENT INFORMATION & SCENE
  // Name, Age, Sex, Weight, Presentation, Scene Info
  // ============================================================
  const hasPatientInfo = linkedScenario?.patient_name || linkedScenario?.patient_age ||
                         linkedScenario?.patient_sex || linkedScenario?.patient_weight ||
                         linkedScenario?.general_impression || scenario?.patient_presentation;

  if (hasPatientInfo) {
    content += `
      <div class="section">
        <h3>PATIENT INFORMATION & SCENE</h3>
        <div class="info-grid">
          ${linkedScenario?.patient_name ? `<div><strong>Name:</strong> ${linkedScenario.patient_name}</div>` : ''}
          ${linkedScenario?.patient_age ? `<div><strong>Age:</strong> ${linkedScenario.patient_age} years</div>` : ''}
          ${linkedScenario?.patient_sex ? `<div><strong>Sex:</strong> ${linkedScenario.patient_sex}</div>` : ''}
          ${linkedScenario?.patient_weight ? `<div><strong>Weight:</strong> ${linkedScenario.patient_weight}</div>` : ''}
        </div>
        ${linkedScenario?.general_impression ? `<p class="presentation-box"><strong>Presentation:</strong> ${linkedScenario.general_impression}</p>` : ''}
        ${scenario?.patient_presentation ? `<p class="presentation-box"><strong>Scene:</strong> ${scenario.patient_presentation}</p>` : ''}
      </div>
    `;
  }

  // ============================================================
  // 4. PRIMARY ASSESSMENT (XABCDE)
  // X, A, B, C, D (with GCS/Pupils), E, then AVPU, General Impression
  // ============================================================
  const hasXabcde = linkedScenario?.assessment_x || linkedScenario?.assessment_a || linkedScenario?.assessment_b ||
                   linkedScenario?.assessment_c || linkedScenario?.assessment_d || linkedScenario?.assessment_e;
  const hasPrimaryAssessment = hasXabcde || linkedScenario?.avpu || linkedScenario?.gcs || linkedScenario?.pupils;

  if (hasPrimaryAssessment) {
    // Build D - Disability line with GCS and pupils if present
    let disabilityLine = linkedScenario?.assessment_d || '';
    if (linkedScenario?.gcs) {
      disabilityLine += disabilityLine ? ` | GCS: ${linkedScenario.gcs}` : `GCS: ${linkedScenario.gcs}`;
    }
    if (linkedScenario?.pupils) {
      disabilityLine += disabilityLine ? ` | Pupils: ${linkedScenario.pupils}` : `Pupils: ${linkedScenario.pupils}`;
    }

    content += `
      <div class="section primary-section">
        <h3>PRIMARY ASSESSMENT (XABCDE)</h3>
        <table class="assessment-table">
          ${linkedScenario?.assessment_x ? `<tr><td class="xabcde-label">X</td><td><strong>Hemorrhage Control:</strong></td><td>${linkedScenario.assessment_x}</td></tr>` : ''}
          ${linkedScenario?.assessment_a ? `<tr><td class="xabcde-label">A</td><td><strong>Airway:</strong></td><td>${linkedScenario.assessment_a}</td></tr>` : ''}
          ${linkedScenario?.assessment_b ? `<tr><td class="xabcde-label">B</td><td><strong>Breathing:</strong></td><td>${linkedScenario.assessment_b}</td></tr>` : ''}
          ${linkedScenario?.assessment_c ? `<tr><td class="xabcde-label">C</td><td><strong>Circulation:</strong></td><td>${linkedScenario.assessment_c}</td></tr>` : ''}
          ${disabilityLine ? `<tr><td class="xabcde-label">D</td><td><strong>Disability:</strong></td><td>${disabilityLine}</td></tr>` : ''}
          ${linkedScenario?.assessment_e ? `<tr><td class="xabcde-label">E</td><td><strong>Expose/Environment:</strong></td><td>${linkedScenario.assessment_e}</td></tr>` : ''}
        </table>
        <div class="avpu-row">
          ${linkedScenario?.avpu ? `<span><strong>AVPU:</strong> ${linkedScenario.avpu}</span>` : ''}
        </div>
      </div>
    `;
  }

  // ============================================================
  // 5. SECONDARY ASSESSMENT (grouped section)
  // 5a. Vital Signs, 5b. Medical History, 5c. SAMPLE, 5d. OPQRST, 5e. EKG, 5f. Secondary Survey
  // ============================================================

  // 5a. VITAL SIGNS
  const hasVitals = linkedScenario?.initial_vitals && Object.values(linkedScenario.initial_vitals).some((v: any) => v);
  const hasEkg = linkedScenario?.ekg_findings && Object.values(linkedScenario.ekg_findings).some((v: any) => v);

  if (hasVitals || hasEkg) {
    content += `
      <div class="section vitals-section">
        <h3>VITAL SIGNS</h3>
        ${hasVitals ? renderVitalsRow(linkedScenario.initial_vitals) : ''}
        ${hasEkg ? `
          <div class="ekg-inline">
            <strong>EKG:</strong> ${linkedScenario.ekg_findings.rhythm || 'Sinus rhythm'}
            ${linkedScenario.ekg_findings.twelve_lead ? ` | <strong>12-Lead:</strong> ${linkedScenario.ekg_findings.twelve_lead}` : ', unremarkable'}
          </div>
        ` : ''}
      </div>
    `;
  }

  // 5b. MEDICAL HISTORY (PMH, Medications, Allergies)
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
            <div class="allergies-box">
              <strong>Allergies:</strong> ${linkedScenario.allergies}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 5c. SAMPLE History
  const hasSample = linkedScenario?.sample_history && Object.values(linkedScenario.sample_history).some((v: any) => v);

  // 5d. OPQRST
  const hasOpqrst = linkedScenario?.opqrst && Object.values(linkedScenario.opqrst).some((v: any) => v);

  if (hasSample || hasOpqrst) {
    content += `
      <div class="section">
        <h3>HISTORY TAKING</h3>
        <div class="secondary-grid">
    `;

    if (hasSample) {
      const sampleS = linkedScenario.sample_history.signs_symptoms;
      const sampleA = linkedScenario.sample_history.allergies || linkedScenario.allergies;
      const sampleM = linkedScenario.sample_history.medications || (linkedScenario.medications?.length ? linkedScenario.medications.join(', ') : null);
      const sampleP = linkedScenario.sample_history.past_medical_history || (linkedScenario.medical_history?.length ? linkedScenario.medical_history.join(', ') : null);
      const sampleL = linkedScenario.sample_history.last_oral_intake;
      const sampleE = linkedScenario.sample_history.events_leading;

      content += `
          <div class="sample-box">
            <h4>SAMPLE History</h4>
            <table class="history-table">
              ${sampleS ? `<tr><td><strong>S</strong></td><td>Signs/Symptoms</td><td>${sampleS}</td></tr>` : ''}
              ${sampleA ? `<tr><td><strong>A</strong></td><td>Allergies</td><td>${sampleA}</td></tr>` : ''}
              ${sampleM ? `<tr><td><strong>M</strong></td><td>Medications</td><td>${sampleM}</td></tr>` : ''}
              ${sampleP ? `<tr><td><strong>P</strong></td><td>Past Medical Hx</td><td>${sampleP}</td></tr>` : ''}
              ${sampleL ? `<tr><td><strong>L</strong></td><td>Last Oral Intake</td><td>${sampleL}</td></tr>` : ''}
              ${sampleE ? `<tr><td><strong>E</strong></td><td>Events Leading</td><td>${sampleE}</td></tr>` : ''}
            </table>
          </div>
      `;
    }

    if (hasOpqrst) {
      content += `
          <div class="opqrst-box">
            <h4>OPQRST (Pain Assessment)</h4>
            <table class="history-table">
              ${linkedScenario.opqrst.onset ? `<tr><td><strong>O</strong></td><td>Onset</td><td>${linkedScenario.opqrst.onset}</td></tr>` : ''}
              ${linkedScenario.opqrst.provocation ? `<tr><td><strong>P</strong></td><td>Provocation</td><td>${linkedScenario.opqrst.provocation}</td></tr>` : ''}
              ${linkedScenario.opqrst.quality ? `<tr><td><strong>Q</strong></td><td>Quality</td><td>${linkedScenario.opqrst.quality}</td></tr>` : ''}
              ${linkedScenario.opqrst.radiation ? `<tr><td><strong>R</strong></td><td>Radiation</td><td>${linkedScenario.opqrst.radiation}</td></tr>` : ''}
              ${linkedScenario.opqrst.severity ? `<tr><td><strong>S</strong></td><td>Severity</td><td>${linkedScenario.opqrst.severity}</td></tr>` : ''}
              ${linkedScenario.opqrst.time_onset ? `<tr><td><strong>T</strong></td><td>Time</td><td>${linkedScenario.opqrst.time_onset}</td></tr>` : ''}
            </table>
          </div>
      `;
    }

    content += `
        </div>
      </div>
    `;
  }

  // 5e. SECONDARY SURVEY (Physical exam body regions)
  const hasSecondarySurvey = linkedScenario?.secondary_survey &&
    Object.values(linkedScenario.secondary_survey).some((v: any) => v);

  if (hasSecondarySurvey) {
    const survey = linkedScenario.secondary_survey;
    content += `
      <div class="section">
        <h3>SECONDARY SURVEY (Physical Exam)</h3>
        <table class="assessment-table">
          ${survey.head ? `<tr><td><strong>Head:</strong></td><td>${survey.head}</td></tr>` : ''}
          ${survey.neck ? `<tr><td><strong>Neck:</strong></td><td>${survey.neck}</td></tr>` : ''}
          ${survey.chest ? `<tr><td><strong>Chest:</strong></td><td>${survey.chest}</td></tr>` : ''}
          ${survey.abdomen ? `<tr><td><strong>Abdomen:</strong></td><td>${survey.abdomen}</td></tr>` : ''}
          ${survey.back ? `<tr><td><strong>Back:</strong></td><td>${survey.back}</td></tr>` : ''}
          ${survey.pelvis ? `<tr><td><strong>Pelvis:</strong></td><td>${survey.pelvis}</td></tr>` : ''}
          ${survey.extremities ? `<tr><td><strong>Extremities:</strong></td><td>${survey.extremities}</td></tr>` : ''}
        </table>
      </div>
    `;
  }

  // ============================================================
  // 6. CRITICAL ACTIONS (Must Perform - PROMINENT BOX)
  // ============================================================
  if (linkedScenario?.critical_actions?.length) {
    content += `
      <div class="section critical-section">
        <h3>✓ CRITICAL ACTIONS (Must Perform)</h3>
        <ul class="critical-list">
          ${linkedScenario.critical_actions.map((action: string) => `<li>${action}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // ============================================================
  // 7. SCENARIO PHASES (Progression)
  // ============================================================
  if (linkedScenario?.phases?.length) {
    content += `
      <div class="section phases-section">
        <h3>SCENARIO PHASES</h3>
        ${linkedScenario.phases.map((phase: any, idx: number) => {
          const phaseName = phase.name || phase.title || '';
          const isDefaultName = /^Phase \d+$/i.test(phaseName);
          const displayTitle = isDefaultName ? '' : phaseName;
          return `
          <div class="phase">
            <div class="phase-header">
              <span class="phase-number">PHASE ${idx + 1}</span>
              ${displayTitle ? `<span class="phase-title">${displayTitle}</span>` : ''}
            </div>
            ${phase.trigger ? `
              <div class="phase-trigger">
                <strong>Trigger:</strong> ${phase.trigger}
              </div>
            ` : ''}
            ${phase.vitals ? `
              <div class="phase-vitals">
                ${renderVitalsRow(phase.vitals)}
              </div>
            ` : ''}
            ${phase.presentation || phase.presentation_notes ? `
              <div class="phase-presentation">
                <strong>Presentation:</strong> ${phase.presentation || phase.presentation_notes}
              </div>
            ` : ''}
            ${phase.expected_actions?.length ? `
              <div class="phase-actions">
                <strong>Expected Actions:</strong>
                <ul>${phase.expected_actions.map((a: string) => `<li>${a}</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${phase.instructor_cues || phase.cues ? `
              <div class="phase-cues">
                <strong>Instructor Cues:</strong> <em>${phase.instructor_cues || phase.cues}</em>
              </div>
            ` : ''}
          </div>
        `;
        }).join('')}
      </div>
    `;
  }

  // ============================================================
  // 8. DEBRIEF DISCUSSION POINTS (at end)
  // ============================================================
  if (linkedScenario?.debrief_points?.length) {
    content += `
      <div class="section debrief-section">
        <h3>DEBRIEF DISCUSSION POINTS</h3>
        <ul class="debrief-list">
          ${linkedScenario.debrief_points.map((point: string) => `<li>${point}</li>`).join('')}
        </ul>
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
      .section { page-break-inside: avoid; }
      .phase { page-break-inside: avoid; }
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
      background: #333;
      color: #fff;
      border: none;
      border-radius: 4px;
    }

    .no-print button:hover {
      background: #555;
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }

    .header h1 {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
      text-transform: uppercase;
    }

    .header h2 {
      font-size: 16px;
      font-weight: bold;
    }

    .meta-info {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 15px;
      padding: 10px;
      background: #f0f0f0;
      border: 1px solid #000;
    }

    /* Standard Section Styling - B&W Optimized */
    .section {
      margin-bottom: 15px;
      padding: 12px;
      border: 1px solid #000;
      background: #fff;
    }

    .section h3 {
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      border-bottom: 2px solid #000;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }

    .section h4 {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    /* INITIAL VITALS - Prominent thick border */
    .vitals-section {
      border: 3px solid #000;
      background: #f0f0f0;
    }

    .vitals-section h3 {
      font-size: 14px;
    }

    .vitals-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    .vitals-table th {
      padding: 6px 10px;
      border: 1px solid #000;
      background: #e0e0e0;
      font-weight: bold;
      text-align: center;
      font-size: 11px;
    }

    .vitals-table td {
      padding: 8px 10px;
      border: 1px solid #000;
      background: #fff;
      text-align: center;
      font-size: 14px;
      font-weight: bold;
    }

    /* CRITICAL ACTIONS - Prominent thick border */
    .critical-section {
      border: 3px solid #000;
      background: #f0f0f0;
    }

    .critical-section h3 {
      font-size: 14px;
    }

    .critical-list {
      margin-left: 20px;
    }

    .critical-list li {
      padding: 4px 0;
      font-weight: bold;
      font-size: 12px;
    }

    /* Instructor Notes - TOP (Read First!) */
    .instructor-section-top {
      background: #fff3cd;
      border: 3px solid #000;
      margin-bottom: 20px;
    }

    .instructor-section-top h3 {
      background: #000;
      color: #fff;
      padding: 6px 10px;
      margin: -12px -12px 12px -12px;
      border-bottom: none;
    }

    /* Presentation Box */
    .presentation-box {
      margin-top: 10px;
      padding: 8px;
      background: #f0f0f0;
      border-left: 4px solid #000;
    }

    /* Primary Assessment Section */
    .primary-section {
      border: 2px solid #000;
    }

    .xabcde-label {
      width: 30px;
      font-weight: bold;
      font-size: 14px;
      text-align: center;
      background: #333;
      color: #fff;
    }

    .avpu-row {
      margin-top: 10px;
      padding: 8px;
      background: #f0f0f0;
      display: flex;
      gap: 30px;
    }

    /* EKG Inline */
    .ekg-inline {
      margin-top: 10px;
      padding: 8px;
      background: #f8f8f8;
      border-left: 3px solid #666;
    }

    /* Instructor Notes (legacy) */
    .instructor-section {
      background: #f8f8f8;
      border-style: dashed;
    }

    /* Debrief Section */
    .debrief-section {
      background: #f5f5f5;
      border: 2px solid #666;
    }

    .debrief-list {
      margin-left: 20px;
    }

    .debrief-list li {
      padding: 3px 0;
    }

    /* Assessment Tables */
    .assessment-table,
    .history-table {
      width: 100%;
      border-collapse: collapse;
    }

    .assessment-table td,
    .history-table td {
      padding: 5px 8px;
      border: 1px solid #000;
      vertical-align: top;
    }

    .assessment-table td:first-child,
    .history-table td:first-child {
      width: 30px;
      font-weight: bold;
      text-align: center;
      background: #f0f0f0;
    }

    .history-table td:nth-child(2) {
      width: 120px;
      background: #f8f8f8;
    }

    /* Secondary Assessment Grid */
    .secondary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    .sample-box,
    .opqrst-box {
      border: 1px solid #000;
      padding: 10px;
      background: #fafafa;
    }

    /* Info Grids */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .three-column {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    /* Chief Complaint emphasis */
    .chief-complaint {
      font-size: 13px;
      margin-top: 10px;
      padding: 8px;
      background: #f0f0f0;
      border-left: 4px solid #000;
    }

    .dispatch-notes {
      margin-top: 8px;
      padding: 6px;
      background: #f8f8f8;
    }

    /* Allergies emphasis */
    .allergies-box {
      font-weight: bold;
      padding: 6px;
      border: 2px solid #000;
      background: #f0f0f0;
    }

    /* Lists */
    ul {
      margin-left: 20px;
    }

    li {
      margin-bottom: 3px;
    }

    /* PHASES SECTION */
    .phases-section {
      border: 2px solid #000;
    }

    .phase {
      margin-bottom: 0;
      padding: 12px;
      border-bottom: 2px solid #000;
    }

    .phase:last-child {
      border-bottom: none;
    }

    .phase-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #ccc;
    }

    .phase-number {
      font-weight: bold;
      font-size: 13px;
      background: #000;
      color: #fff;
      padding: 2px 8px;
    }

    .phase-title {
      font-weight: bold;
      font-size: 13px;
    }

    .phase-trigger {
      margin-bottom: 8px;
      padding: 6px;
      background: #f0f0f0;
      border-left: 3px solid #000;
    }

    .phase-vitals {
      margin-bottom: 10px;
    }

    .phase-presentation {
      margin-bottom: 8px;
      padding: 6px;
      background: #f8f8f8;
    }

    .phase-actions {
      margin-bottom: 8px;
    }

    .phase-actions ul {
      margin-top: 4px;
    }

    .phase-cues {
      margin-top: 8px;
      padding: 6px;
      background: #f0f0f0;
      border-left: 3px solid #666;
      font-style: italic;
    }

    /* Footer */
    .footer {
      margin-top: 25px;
      text-align: center;
      font-size: 10px;
      color: #666;
      border-top: 1px solid #000;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button onclick="window.close()">Close</button>
  </div>

  <div class="header">
    <h1>PIMA MEDICAL INSTITUTE - PARAMEDIC PROGRAM</h1>
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
    Printed: ${new Date().toLocaleString()} | FOR INSTRUCTOR REFERENCE ONLY
  </div>
</body>
</html>
  `;
}
