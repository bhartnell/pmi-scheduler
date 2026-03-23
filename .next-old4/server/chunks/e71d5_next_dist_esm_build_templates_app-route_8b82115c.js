module.exports=[518674,t=>{"use strict";var e=t.i(356292),s=t.i(511587),i=t.i(658158),n=t.i(385772),o=t.i(755949),r=t.i(68611),a=t.i(722194),d=t.i(570712),l=t.i(268070),p=t.i(375339),c=t.i(663426),g=t.i(962412),u=t.i(413713),h=t.i(569873),m=t.i(413654),b=t.i(193695);t.i(689710);var x=t.i(770056),v=t.i(876908),f=t.i(859727),$=t.i(84039);async function _(t,{params:e}){let{id:s}=await e;try{let t=await (0,$.requireAuth)("instructor");if(t instanceof v.NextResponse)return t;let{user:e}=t,i=(0,f.getSupabaseAdmin)(),{data:n,error:o}=await i.from("summative_evaluations").select(`
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
      `).eq("id",s).single();if(o)throw o;if(!n)return v.NextResponse.json({success:!1,error:"Evaluation not found"},{status:404});let r=null;if(n.scenario?.linked_scenario_id){let{data:t}=await i.from("scenarios").select("*").eq("id",n.scenario.linked_scenario_id).single();r=t}let a=function(t,e){let s=t.scenario,i=t=>{if(!t)return"";let e=[{label:"BP",value:t.bp},{label:"HR",value:t.hr},{label:"RR",value:t.rr},{label:"SpO2",value:t.spo2?`${t.spo2}%`:null},{label:"ETCO2",value:t.etco2},{label:"Temp",value:t.temp?`${t.temp}\xb0F`:null},{label:"BGL",value:t.bgl||t.glucose},{label:"GCS",value:t.gcs},{label:"Rhythm",value:t.ekg_rhythm||t.rhythm||t.ekg}].filter(t=>t.value);return 0===e.length?"":`
      <table class="vitals-table">
        <tr class="vitals-header">${e.map(t=>`<th>${t.label}</th>`).join("")}</tr>
        <tr class="vitals-values">${e.map(t=>`<td>${t.value}</td>`).join("")}</tr>
      </table>
    `},n="";if(e?.instructor_notes&&(n+=`
      <div class="section instructor-section-top">
        <h3>⚡ INSTRUCTOR NOTES (READ FIRST)</h3>
        <p>${e.instructor_notes}</p>
      </div>
    `),(e?.dispatch_time||e?.dispatch_location||e?.dispatch_notes||e?.chief_complaint)&&(n+=`
      <div class="section">
        <h3>DISPATCH INFORMATION</h3>
        <div class="info-grid">
          ${e.dispatch_time?`<div><strong>Time:</strong> ${e.dispatch_time}</div>`:""}
          ${e.dispatch_location?`<div><strong>Location:</strong> ${e.dispatch_location}</div>`:""}
        </div>
        ${e.chief_complaint?`<p class="chief-complaint"><strong>Chief Complaint:</strong> ${e.chief_complaint}</p>`:""}
        ${e.dispatch_notes?`<p class="dispatch-notes"><strong>Dispatch Notes:</strong> ${e.dispatch_notes}</p>`:""}
      </div>
    `),(e?.patient_name||e?.patient_age||e?.patient_sex||e?.patient_weight||e?.general_impression||s?.patient_presentation)&&(n+=`
      <div class="section">
        <h3>PATIENT INFORMATION & SCENE</h3>
        <div class="info-grid">
          ${e?.patient_name?`<div><strong>Name:</strong> ${e.patient_name}</div>`:""}
          ${e?.patient_age?`<div><strong>Age:</strong> ${e.patient_age} years</div>`:""}
          ${e?.patient_sex?`<div><strong>Sex:</strong> ${e.patient_sex}</div>`:""}
          ${e?.patient_weight?`<div><strong>Weight:</strong> ${e.patient_weight}</div>`:""}
        </div>
        ${e?.general_impression?`<p class="presentation-box"><strong>Presentation:</strong> ${e.general_impression}</p>`:""}
        ${s?.patient_presentation?`<p class="presentation-box"><strong>Scene:</strong> ${s.patient_presentation}</p>`:""}
      </div>
    `),e?.assessment_x||e?.assessment_a||e?.assessment_b||e?.assessment_c||e?.assessment_d||e?.assessment_e||e?.avpu||e?.gcs||e?.pupils){let t=e?.assessment_d||"";e?.gcs&&(t+=t?` | GCS: ${e.gcs}`:`GCS: ${e.gcs}`),e?.pupils&&(t+=t?` | Pupils: ${e.pupils}`:`Pupils: ${e.pupils}`),n+=`
      <div class="section primary-section">
        <h3>PRIMARY ASSESSMENT (XABCDE)</h3>
        <table class="assessment-table">
          ${e?.assessment_x?`<tr><td class="xabcde-label">X</td><td><strong>Hemorrhage Control:</strong></td><td>${e.assessment_x}</td></tr>`:""}
          ${e?.assessment_a?`<tr><td class="xabcde-label">A</td><td><strong>Airway:</strong></td><td>${e.assessment_a}</td></tr>`:""}
          ${e?.assessment_b?`<tr><td class="xabcde-label">B</td><td><strong>Breathing:</strong></td><td>${e.assessment_b}</td></tr>`:""}
          ${e?.assessment_c?`<tr><td class="xabcde-label">C</td><td><strong>Circulation:</strong></td><td>${e.assessment_c}</td></tr>`:""}
          ${t?`<tr><td class="xabcde-label">D</td><td><strong>Disability:</strong></td><td>${t}</td></tr>`:""}
          ${e?.assessment_e?`<tr><td class="xabcde-label">E</td><td><strong>Expose/Environment:</strong></td><td>${e.assessment_e}</td></tr>`:""}
        </table>
        <div class="avpu-row">
          ${e?.avpu?`<span><strong>AVPU:</strong> ${e.avpu}</span>`:""}
        </div>
      </div>
    `}let o=e?.initial_vitals&&Object.values(e.initial_vitals).some(t=>t),r=e?.ekg_findings&&Object.values(e.ekg_findings).some(t=>t);(o||r)&&(n+=`
      <div class="section vitals-section">
        <h3>VITAL SIGNS</h3>
        ${o?i(e.initial_vitals):""}
        ${r?`
          <div class="ekg-inline">
            <strong>EKG:</strong> ${e.ekg_findings.rhythm||"Sinus rhythm"}
            ${e.ekg_findings.twelve_lead?` | <strong>12-Lead:</strong> ${e.ekg_findings.twelve_lead}`:", unremarkable"}
          </div>
        `:""}
      </div>
    `),(e?.medical_history?.length||e?.medications?.length||e?.allergies)&&(n+=`
      <div class="section">
        <h3>MEDICAL HISTORY</h3>
        <div class="three-column">
          ${e.medical_history?.length?`
            <div>
              <strong>Past Medical History:</strong>
              <ul>${e.medical_history.map(t=>`<li>${t}</li>`).join("")}</ul>
            </div>
          `:""}
          ${e.medications?.length?`
            <div>
              <strong>Medications:</strong>
              <ul>${e.medications.map(t=>`<li>${t}</li>`).join("")}</ul>
            </div>
          `:""}
          ${e.allergies?`
            <div class="allergies-box">
              <strong>Allergies:</strong> ${e.allergies}
            </div>
          `:""}
        </div>
      </div>
    `);let a=e?.sample_history?.signs_symptoms||e?.chief_complaint||"—",d=e?.allergies||"NKDA",l=e?.medications?.length?e.medications.join(", "):"None",p=e?.medical_history?.length?e.medical_history.join(", "):"None",c=e?.sample_history?.last_oral_intake||"—",g=e?.sample_history?.events_leading||"—",u=e?.opqrst&&Object.values(e.opqrst).some(t=>t);if(n+=`
    <div class="section">
      <h3>HISTORY TAKING</h3>
      <div class="secondary-grid">
  
      <div class="sample-box">
        <h4>SAMPLE History</h4>
        <table class="history-table">
          <tr><td><strong>S</strong></td><td>Signs/Symptoms</td><td>${a}</td></tr>
          <tr><td><strong>A</strong></td><td>Allergies</td><td>${d}</td></tr>
          <tr><td><strong>M</strong></td><td>Medications</td><td>${l}</td></tr>
          <tr><td><strong>P</strong></td><td>Past Medical Hx</td><td>${p}</td></tr>
          <tr><td><strong>L</strong></td><td>Last Oral Intake</td><td>${c}</td></tr>
          <tr><td><strong>E</strong></td><td>Events Leading</td><td>${g}</td></tr>
        </table>
      </div>
  `,u&&(n+=`
        <div class="opqrst-box">
          <h4>OPQRST (Pain Assessment)</h4>
          <table class="history-table">
            ${e.opqrst.onset?`<tr><td><strong>O</strong></td><td>Onset</td><td>${e.opqrst.onset}</td></tr>`:""}
            ${e.opqrst.provocation?`<tr><td><strong>P</strong></td><td>Provocation</td><td>${e.opqrst.provocation}</td></tr>`:""}
            ${e.opqrst.quality?`<tr><td><strong>Q</strong></td><td>Quality</td><td>${e.opqrst.quality}</td></tr>`:""}
            ${e.opqrst.radiation?`<tr><td><strong>R</strong></td><td>Radiation</td><td>${e.opqrst.radiation}</td></tr>`:""}
            ${e.opqrst.severity?`<tr><td><strong>S</strong></td><td>Severity</td><td>${e.opqrst.severity}</td></tr>`:""}
            ${e.opqrst.time_onset?`<tr><td><strong>T</strong></td><td>Time</td><td>${e.opqrst.time_onset}</td></tr>`:""}
          </table>
        </div>
    `),n+=`
      </div>
    </div>
  `,e?.secondary_survey&&Object.values(e.secondary_survey).some(t=>t)){let t=e.secondary_survey;n+=`
      <div class="section">
        <h3>SECONDARY SURVEY (Physical Exam)</h3>
        <table class="assessment-table">
          ${t.head?`<tr><td><strong>Head:</strong></td><td>${t.head}</td></tr>`:""}
          ${t.neck?`<tr><td><strong>Neck:</strong></td><td>${t.neck}</td></tr>`:""}
          ${t.chest?`<tr><td><strong>Chest:</strong></td><td>${t.chest}</td></tr>`:""}
          ${t.abdomen?`<tr><td><strong>Abdomen:</strong></td><td>${t.abdomen}</td></tr>`:""}
          ${t.back?`<tr><td><strong>Back:</strong></td><td>${t.back}</td></tr>`:""}
          ${t.pelvis?`<tr><td><strong>Pelvis:</strong></td><td>${t.pelvis}</td></tr>`:""}
          ${t.extremities?`<tr><td><strong>Extremities:</strong></td><td>${t.extremities}</td></tr>`:""}
        </table>
      </div>
    `}return e?.critical_actions?.length&&(n+=`
      <div class="section critical-section">
        <h3>✓ CRITICAL ACTIONS (Must Perform)</h3>
        <ul class="critical-list">
          ${e.critical_actions.map(t=>`<li>${t}</li>`).join("")}
        </ul>
      </div>
    `),e?.phases?.length&&(n+=`
      <div class="section phases-section">
        <h3>SCENARIO PHASES</h3>
        ${e.phases.map((t,e)=>{let s=t.name||t.title||"",n=/^Phase \d+$/i.test(s)?"":s;return`
          <div class="phase-box">
            <div class="phase-header">
              <span class="phase-number">PHASE ${e+1}</span>
              ${n?`<span class="phase-title">${n}</span>`:""}
            </div>
            <div class="phase-content">
              ${t.trigger?`
                <div class="phase-trigger">
                  <strong>Trigger:</strong> ${t.trigger}
                </div>
              `:""}
              ${t.vitals?`
                <div class="phase-vitals">
                  ${i(t.vitals)}
                </div>
              `:""}
              ${t.presentation||t.presentation_notes?`
                <div class="phase-presentation">
                  <strong>Presentation:</strong> ${t.presentation||t.presentation_notes}
                </div>
              `:""}
              ${t.expected_actions?.length?`
                <div class="phase-actions">
                  <strong>Expected Actions:</strong>
                  <ul>${t.expected_actions.map(t=>`<li>${t}</li>`).join("")}</ul>
                </div>
              `:""}
              ${t.instructor_cues||t.cues?`
                <div class="phase-cues">
                  <strong>Instructor Cues:</strong> <em>${t.instructor_cues||t.cues}</em>
                </div>
              `:""}
            </div>
          </div>
        `}).join("")}
      </div>
    `),e?.debrief_points?.length&&(n+=`
      <div class="section debrief-section">
        <h3>DEBRIEF DISCUSSION POINTS</h3>
        <ul class="debrief-list">
          ${e.debrief_points.map(t=>`<li>${t}</li>`).join("")}
        </ul>
      </div>
    `),!e&&(s?.description&&(n+=`
        <div class="section">
          <h3>DESCRIPTION</h3>
          <p>${s.description}</p>
        </div>
      `),s?.patient_presentation&&(n+=`
        <div class="section">
          <h3>PATIENT PRESENTATION</h3>
          <p>${s.patient_presentation}</p>
        </div>
      `),s?.expected_interventions?.length&&(n+=`
        <div class="section">
          <h3>EXPECTED INTERVENTIONS</h3>
          <ul>${s.expected_interventions.map(t=>`<li>${t}</li>`).join("")}</ul>
        </div>
      `)),`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Scenario #${s?.scenario_number} - ${s?.title||e?.title}</title>
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
    <h2>Scenario #${s?.scenario_number}: ${s?.title||e?.title}</h2>
  </div>

  ${n}
</body>
</html>
  `}(n,r);return new v.NextResponse(a,{headers:{"Content-Type":"text/html; charset=utf-8"}})}catch(t){return console.error("Error exporting scenario:",t),v.NextResponse.json({success:!1,error:"Failed to export scenario"},{status:500})}}t.s(["GET",()=>_],247033);var R=t.i(247033);let E=new e.AppRouteRouteModule({definition:{kind:s.RouteKind.APP_ROUTE,page:"/api/clinical/summative-evaluations/[id]/scenario-print/route",pathname:"/api/clinical/summative-evaluations/[id]/scenario-print",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/.claude/worktrees/focused-goodall/app/api/clinical/summative-evaluations/[id]/scenario-print/route.ts",nextConfigOutput:"standalone",userland:R}),{workAsyncStorage:y,workUnitAsyncStorage:A,serverHooks:S}=E;function T(){return(0,i.patchFetch)({workAsyncStorage:y,workUnitAsyncStorage:A})}async function w(t,e,i){E.isDev&&(0,n.addRequestMeta)(t,"devRequestTimingInternalsEnd",process.hrtime.bigint());let v="/api/clinical/summative-evaluations/[id]/scenario-print/route";v=v.replace(/\/index$/,"")||"/";let f=await E.prepare(t,e,{srcPage:v,multiZoneDraftMode:!1});if(!f)return e.statusCode=400,e.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:$,params:_,nextConfig:R,parsedUrl:y,isDraftMode:A,prerenderManifest:S,routerServerContext:T,isOnDemandRevalidate:w,revalidateOnlyGenerated:C,resolvedPathname:k,clientReferenceManifest:I,serverActionsManifest:P}=f,N=(0,a.normalizeAppPath)(v),O=!!(S.dynamicRoutes[N]||S.routes[k]),q=async()=>((null==T?void 0:T.render404)?await T.render404(t,e,y,!1):e.end("This page could not be found"),null);if(O&&!A){let t=!!S.routes[k],e=S.dynamicRoutes[N];if(e&&!1===e.fallback&&!t){if(R.experimental.adapterPath)return await q();throw new b.NoFallbackError}}let H=null;!O||E.isDev||A||(H="/index"===(H=k)?"/":H);let D=!0===E.isDev||!O,M=O&&!D;P&&I&&(0,r.setManifestsSingleton)({page:v,clientReferenceManifest:I,serverActionsManifest:P});let j=t.method||"GET",L=(0,o.getTracer)(),F=L.getActiveScopeSpan(),U={params:_,prerenderManifest:S,renderOpts:{experimental:{authInterrupts:!!R.experimental.authInterrupts},cacheComponents:!!R.cacheComponents,supportsDynamicResponse:D,incrementalCache:(0,n.getRequestMeta)(t,"incrementalCache"),cacheLifeProfiles:R.cacheLife,waitUntil:i.waitUntil,onClose:t=>{e.on("close",t)},onAfterTaskError:void 0,onInstrumentationRequestError:(e,s,i,n)=>E.onRequestError(t,e,i,n,T)},sharedContext:{buildId:$}},z=new d.NodeNextRequest(t),G=new d.NodeNextResponse(e),B=l.NextRequestAdapter.fromNodeNextRequest(z,(0,l.signalFromNodeResponse)(e));try{let r=async t=>E.handle(B,U).finally(()=>{if(!t)return;t.setAttributes({"http.status_code":e.statusCode,"next.rsc":!1});let s=L.getRootSpanAttributes();if(!s)return;if(s.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${s.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=s.get("next.route");if(i){let e=`${j} ${i}`;t.setAttributes({"next.route":i,"http.route":i,"next.span_name":e}),t.updateName(e)}else t.updateName(`${j} ${v}`)}),a=!!(0,n.getRequestMeta)(t,"minimalMode"),d=async n=>{var o,d;let l=async({previousCacheEntry:s})=>{try{if(!a&&w&&C&&!s)return e.statusCode=404,e.setHeader("x-nextjs-cache","REVALIDATED"),e.end("This page could not be found"),null;let o=await r(n);t.fetchMetrics=U.renderOpts.fetchMetrics;let d=U.renderOpts.pendingWaitUntil;d&&i.waitUntil&&(i.waitUntil(d),d=void 0);let l=U.renderOpts.collectedTags;if(!O)return await (0,g.sendResponse)(z,G,o,U.renderOpts.pendingWaitUntil),null;{let t=await o.blob(),e=(0,u.toNodeOutgoingHttpHeaders)(o.headers);l&&(e[m.NEXT_CACHE_TAGS_HEADER]=l),!e["content-type"]&&t.type&&(e["content-type"]=t.type);let s=void 0!==U.renderOpts.collectedRevalidate&&!(U.renderOpts.collectedRevalidate>=m.INFINITE_CACHE)&&U.renderOpts.collectedRevalidate,i=void 0===U.renderOpts.collectedExpire||U.renderOpts.collectedExpire>=m.INFINITE_CACHE?void 0:U.renderOpts.collectedExpire;return{value:{kind:x.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await t.arrayBuffer()),headers:e},cacheControl:{revalidate:s,expire:i}}}}catch(e){throw(null==s?void 0:s.isStale)&&await E.onRequestError(t,e,{routerKind:"App Router",routePath:v,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:w})},!1,T),e}},p=await E.handleResponse({req:t,nextConfig:R,cacheKey:H,routeKind:s.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:w,revalidateOnlyGenerated:C,responseGenerator:l,waitUntil:i.waitUntil,isMinimalMode:a});if(!O)return null;if((null==p||null==(o=p.value)?void 0:o.kind)!==x.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==p||null==(d=p.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});a||e.setHeader("x-nextjs-cache",w?"REVALIDATED":p.isMiss?"MISS":p.isStale?"STALE":"HIT"),A&&e.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let b=(0,u.fromNodeOutgoingHttpHeaders)(p.value.headers);return a&&O||b.delete(m.NEXT_CACHE_TAGS_HEADER),!p.cacheControl||e.getHeader("Cache-Control")||b.get("Cache-Control")||b.set("Cache-Control",(0,h.getCacheControlHeader)(p.cacheControl)),await (0,g.sendResponse)(z,G,new Response(p.value.body,{headers:b,status:p.value.status||200})),null};F?await d(F):await L.withPropagatedContext(t.headers,()=>L.trace(p.BaseServerSpan.handleRequest,{spanName:`${j} ${v}`,kind:o.SpanKind.SERVER,attributes:{"http.method":j,"http.target":t.url}},d))}catch(e){if(e instanceof b.NoFallbackError||await E.onRequestError(t,e,{routerKind:"App Router",routePath:N,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:w})},!1,T),O)throw e;return await (0,g.sendResponse)(z,G,new Response(null,{status:500})),null}}t.s(["handler",()=>w,"patchFetch",()=>T,"routeModule",()=>E,"serverHooks",()=>S,"workAsyncStorage",()=>y,"workUnitAsyncStorage",()=>A],518674)}];

//# sourceMappingURL=e71d5_next_dist_esm_build_templates_app-route_8b82115c.js.map