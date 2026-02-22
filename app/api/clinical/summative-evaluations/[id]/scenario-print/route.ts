import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

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

    const supabase = getSupabaseAdmin();

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
      { label: 'ETCO2', value: vitals.etco2 },
      { label: 'Temp', value: vitals.temp ? `${vitals.temp}°F` : null },
      { label: 'BGL', value: vitals.bgl || vitals.glucose },
      { label: 'GCS', value: vitals.gcs },
      { label: 'Rhythm', value: vitals.rhythm || vitals.ekg }
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

  // 5c. SAMPLE History - Always show complete format
  const sampleS = linkedScenario?.sample_history?.signs_symptoms || linkedScenario?.chief_complaint || '—';
  const sampleA = linkedScenario?.allergies || 'NKDA';
  const sampleM = linkedScenario?.medications?.length ? linkedScenario.medications.join(', ') : 'None';
  const sampleP = linkedScenario?.medical_history?.length ? linkedScenario.medical_history.join(', ') : 'None';
  const sampleL = linkedScenario?.sample_history?.last_oral_intake || '—';
  const sampleE = linkedScenario?.sample_history?.events_leading || '—';

  // 5d. OPQRST
  const hasOpqrst = linkedScenario?.opqrst && Object.values(linkedScenario.opqrst).some((v: any) => v);

  // Always show SAMPLE, optionally show OPQRST
  content += `
    <div class="section">
      <h3>HISTORY TAKING</h3>
      <div class="secondary-grid">
  `;

  // Always show complete SAMPLE
  content += `
      <div class="sample-box">
        <h4>SAMPLE History</h4>
        <table class="history-table">
          <tr><td><strong>S</strong></td><td>Signs/Symptoms</td><td>${sampleS}</td></tr>
          <tr><td><strong>A</strong></td><td>Allergies</td><td>${sampleA}</td></tr>
          <tr><td><strong>M</strong></td><td>Medications</td><td>${sampleM}</td></tr>
          <tr><td><strong>P</strong></td><td>Past Medical Hx</td><td>${sampleP}</td></tr>
          <tr><td><strong>L</strong></td><td>Last Oral Intake</td><td>${sampleL}</td></tr>
          <tr><td><strong>E</strong></td><td>Events Leading</td><td>${sampleE}</td></tr>
        </table>
      </div>
  `;

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
  // 7. SCENARIO PHASES (Progression) - Each phase in its own box
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
          <div class="phase-box">
            <div class="phase-header">
              <span class="phase-number">PHASE ${idx + 1}</span>
              ${displayTitle ? `<span class="phase-title">${displayTitle}</span>` : ''}
            </div>
            <div class="phase-content">
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
      body {
        font-size: 11pt;
        margin: 0.5in 0.75in 0.5in 0.5in !important;
        padding: 0 !important;
      }
      .section { page-break-inside: avoid; }
      .phase-box { page-break-inside: avoid; }
      /* Force print backgrounds where supported */
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @page {
      margin: 0.5in 0.75in 0.5in 0.5in;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in 0.75in 0.5in 0.5in;
    }

    .no-print {
      margin-bottom: 15px;
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
      padding-bottom: 12px;
      margin-bottom: 15px;
    }

    .header h1 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
      color: #000;
    }

    .header h2 {
      font-size: 14px;
      font-weight: bold;
      color: #000;
    }

    /* Standard Section Styling - HIGH CONTRAST B&W */
    .section {
      margin-bottom: 12px;
      padding: 10px;
      border: 1px solid #000;
      background: #fff;
    }

    .section h3 {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      border-bottom: 2px solid #000;
      padding-bottom: 3px;
      margin-bottom: 8px;
      color: #000;
    }

    .section h4 {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 6px;
      color: #000;
    }

    /* INITIAL VITALS - Prominent thick border */
    .vitals-section {
      border: 2px solid #000;
      background: #f5f5f5;
    }

    .vitals-section h3 {
      font-size: 12px;
      color: #000;
    }

    .vitals-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }

    .vitals-table th {
      padding: 4px 8px;
      border: 1px solid #000;
      background: #e0e0e0;
      font-weight: bold;
      text-align: center;
      font-size: 10px;
      color: #000;
    }

    .vitals-table td {
      padding: 6px 8px;
      border: 1px solid #000;
      background: #fff;
      text-align: center;
      font-size: 12px;
      font-weight: bold;
      color: #000;
    }

    /* CRITICAL ACTIONS - Prominent thick border */
    .critical-section {
      border: 2px solid #000;
      background: #f5f5f5;
    }

    .critical-section h3 {
      font-size: 12px;
      color: #000;
    }

    .critical-list {
      margin-left: 18px;
    }

    .critical-list li {
      padding: 3px 0;
      font-weight: bold;
      font-size: 11px;
      color: #000;
    }

    /* Instructor Notes - TOP (Read First!) */
    .instructor-section-top {
      background: #fff3cd;
      border: 3px solid #000;
      margin-bottom: 15px;
    }

    /* PRINT-SAFE: Instructor Notes header */
    .instructor-section-top h3 {
      background: #e0e0e0;
      color: #000;
      border: 2px solid #000;
      padding: 5px 10px;
      margin: -10px -10px 10px -10px;
      font-size: 12px;
    }

    /* Presentation Box */
    .presentation-box {
      margin-top: 8px;
      padding: 6px;
      background: #f5f5f5;
      border-left: 3px solid #000;
    }

    /* Primary Assessment Section */
    .primary-section {
      border: 2px solid #000;
    }

    /* XABCDE Labels - PRINT-SAFE (no background dependency) */
    .xabcde-label {
      width: 28px;
      font-weight: bold;
      font-size: 13px;
      text-align: center;
      background: #e0e0e0;
      color: #000;
      border: 2px solid #000;
    }

    .avpu-row {
      margin-top: 8px;
      padding: 6px;
      background: #f5f5f5;
      display: flex;
      gap: 25px;
      color: #000;
    }

    /* EKG Inline */
    .ekg-inline {
      margin-top: 8px;
      padding: 6px;
      background: #f8f8f8;
      border-left: 3px solid #000;
      color: #000;
    }

    /* Debrief Section */
    .debrief-section {
      background: #f5f5f5;
      border: 2px solid #000;
    }

    .debrief-list {
      margin-left: 18px;
    }

    .debrief-list li {
      padding: 2px 0;
      color: #000;
    }

    /* Assessment Tables - HIGH CONTRAST */
    .assessment-table,
    .history-table {
      width: 100%;
      border-collapse: collapse;
    }

    .assessment-table td,
    .history-table td {
      padding: 4px 6px;
      border: 1px solid #000;
      vertical-align: top;
      color: #000;
    }

    /* PRINT-SAFE: Letter labels (S, A, M, P, L, E, O, Q, R, T) */
    .assessment-table td:first-child,
    .history-table td:first-child {
      width: 28px;
      font-weight: bold;
      text-align: center;
      background: #e0e0e0;
      color: #000;
      border: 2px solid #000;
    }

    .history-table td:nth-child(2) {
      width: 110px;
      background: #f5f5f5;
      color: #000;
    }

    /* Secondary Assessment Grid */
    .secondary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .sample-box,
    .opqrst-box {
      border: 1px solid #000;
      padding: 8px;
      background: #fafafa;
    }

    /* Info Grids */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      color: #000;
    }

    .three-column {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      color: #000;
    }

    /* Chief Complaint emphasis */
    .chief-complaint {
      font-size: 12px;
      margin-top: 8px;
      padding: 6px;
      background: #f5f5f5;
      border-left: 3px solid #000;
      color: #000;
    }

    .dispatch-notes {
      margin-top: 6px;
      padding: 5px;
      background: #f8f8f8;
      color: #000;
    }

    /* Allergies emphasis */
    .allergies-box {
      font-weight: bold;
      padding: 5px;
      border: 2px solid #000;
      background: #f5f5f5;
      color: #000;
    }

    /* Lists */
    ul {
      margin-left: 18px;
      color: #000;
    }

    li {
      margin-bottom: 2px;
      color: #000;
    }

    /* PHASES SECTION - Each phase in its own box */
    .phases-section {
      border: none;
      padding: 0;
    }

    .phases-section > h3 {
      border: none;
      border-bottom: 2px solid #000;
      padding: 0 0 4px 0;
      margin-bottom: 10px;
    }

    /* Individual Phase Box - no continuous vertical lines */
    .phase-box {
      border: 2px solid #000;
      margin-bottom: 10px;
      background: #fff;
    }

    .phase-box:last-child {
      margin-bottom: 0;
    }

    .phase-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      background: #f0f0f0;
      border-bottom: 1px solid #000;
    }

    /* PRINT-SAFE: Phase number badges */
    .phase-number {
      font-weight: bold;
      font-size: 12px;
      background: #e0e0e0;
      color: #000;
      border: 2px solid #000;
      padding: 2px 8px;
    }

    .phase-title {
      font-weight: bold;
      font-size: 12px;
      color: #000;
    }

    .phase-content {
      padding: 10px;
    }

    .phase-trigger {
      margin-bottom: 8px;
      padding: 5px;
      background: #f5f5f5;
      border-left: 3px solid #000;
      color: #000;
    }

    .phase-vitals {
      margin-bottom: 8px;
    }

    .phase-presentation {
      margin-bottom: 8px;
      padding: 5px;
      background: #f8f8f8;
      color: #000;
    }

    .phase-actions {
      margin-bottom: 8px;
      color: #000;
    }

    .phase-actions ul {
      margin-top: 3px;
    }

    .phase-cues {
      margin-top: 8px;
      padding: 5px;
      background: #f5f5f5;
      border-left: 3px solid #000;
      font-style: italic;
      color: #000;
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

  ${content}
</body>
</html>
  `;
}
