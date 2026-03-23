module.exports=[149922,e=>{"use strict";var t=e.i(356292),a=e.i(511587),i=e.i(658158),n=e.i(385772),s=e.i(755949),r=e.i(68611),o=e.i(722194),l=e.i(570712),d=e.i(268070),c=e.i(375339),p=e.i(663426),u=e.i(962412),m=e.i(413713),f=e.i(569873),g=e.i(413654),v=e.i(193695);e.i(689710);var h=e.i(770056),b=e.i(876908),x=e.i(859727),_=e.i(84039);let y=[{key:"leadership_scene_score",label:"Leadership and Scene Management",levels:["Does not take charge of the scene; fails to address safety or manage resources","Takes some initiative but leadership is inconsistent; safety addressed partially","Assumes leadership role appropriately; addresses safety and manages resources adequately","Demonstrates excellent leadership; proactively ensures safety and efficiently manages all resources"]},{key:"patient_assessment_score",label:"Patient Assessment",levels:["Assessment is incomplete or disorganized; misses critical findings","Performs basic assessment but lacks thoroughness; some findings missed","Performs complete systematic assessment; identifies most significant findings","Performs comprehensive, organized assessment; identifies all significant findings quickly"]},{key:"patient_management_score",label:"Patient Management",levels:["Interventions inappropriate or absent; may cause harm","Some appropriate interventions but treatment plan incomplete or delayed","Provides appropriate interventions in timely manner; treatment plan adequate","Provides optimal interventions; anticipates needs and adapts treatment as needed"]},{key:"interpersonal_score",label:"Interpersonal Relations",levels:["Communication ineffective or unprofessional; fails to build rapport","Communication adequate but could improve; some difficulty with team or patient","Communicates effectively with patient, family, and team; professional demeanor","Exceptional communication skills; builds strong rapport; excellent team coordination"]},{key:"integration_score",label:"Integration (Field Impression & Transport)",levels:["Unable to formulate field impression; transport decision inappropriate","Field impression partially correct; transport decision acceptable but not optimal","Accurate field impression; appropriate transport decision based on findings","Comprehensive field impression with differential; optimal transport decision with clear rationale"]}],w=[{key:"critical_fails_mandatory",label:"Fails Mandatory Actions"},{key:"critical_harmful_intervention",label:"Harmful Intervention"},{key:"critical_unprofessional",label:"Unprofessional Behavior"}];async function R(e,{params:t}){let{id:a}=await t;try{let t=(0,x.getSupabaseAdmin)(),i=await (0,_.requireAuth)("instructor");if(i instanceof b.NextResponse)return i;let{user:n}=i,s=e.nextUrl.searchParams.get("studentId"),{data:r,error:o}=await t.from("summative_evaluations").select(`
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
      `).eq("id",a).single();if(o)throw o;if(!r)return b.NextResponse.json({success:!1,error:"Evaluation not found"},{status:404});let l=r.scores||[];s&&(l=l.filter(e=>e.student_id===s));let d=l.map(e=>{var t,a,i;let n,s,o,l,d,c,p,u;return t=r,n=(a=e).student,s=t.scenario,o=(a.leadership_scene_score||0)+(a.patient_assessment_score||0)+(a.patient_management_score||0)+(a.interpersonal_score||0)+(a.integration_score||0),l=a.total_score??o,d=y.map(e=>{let t=a[e.key];return`
      <div class="rubric-section">
        <div class="rubric-title">${e.label}</div>
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
              ${e.levels.map((e,a)=>`
                <td class="${t===a?"selected":""}">
                  <span class="score-marker">${t===a?"[X]":"[ ]"}</span>
                  <strong>${a}</strong> - ${e}
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>
      </div>
    `}).join(""),c=`
    <div class="critical-section">
      <div class="critical-title">CRITICAL CRITERIA (Any checked = Automatic Fail)</div>
      ${w.map(e=>{let t=a[e.key]||!1;return`
          <div class="critical-item">
            <span class="checkbox-text">${t?"[X]":"[ ]"}</span>
            <span>${e.label}</span>
          </div>
        `}).join("")}
      ${a.critical_criteria_notes?`
        <div style="margin-top: 10px; font-style: italic;">
          Notes: ${a.critical_criteria_notes}
        </div>
      `:""}
    </div>
  `,p=a.critical_criteria_failed||a.critical_fails_mandatory||a.critical_harmful_intervention||a.critical_unprofessional,u=a.passed??(!p&&l>=12),`
    <div class="page">
      <div class="header">
        <h1>PIMA MEDICAL INSTITUTE</h1>
        <h2>Program Summative Scenario Evaluation</h2>
      </div>

      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Candidate:</span>
          <span>${n?.first_name} ${n?.last_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span>${!(i=t.evaluation_date)?"":new Date(i.includes("T")?i:i+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Scenario:</span>
          <span>#${s?.scenario_number} - ${s?.title}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Examiner:</span>
          <span>${t.examiner_name}</span>
        </div>
        ${t.cohort?`
        <div class="info-row">
          <span class="info-label">Cohort:</span>
          <span>${t.cohort.program?.abbreviation||""} ${t.cohort.cohort_number}</span>
        </div>
        `:""}
        ${t.location?`
        <div class="info-row">
          <span class="info-label">Location:</span>
          <span>${t.location}</span>
        </div>
        `:""}
      </div>

      ${d}

      ${c}

      <div class="total-section">
        <div>
          <strong>Total Score:</strong>
          <span class="total-score">${l} / 15</span>
          <span style="margin-left: 20px; color: #666;">
            (${Math.round(l/15*100)}% - Pass ≥ 80%)
          </span>
        </div>
        <div class="pass-fail ${!0===u?"pass":"fail"}">${!0===u?"PASS":"FAIL"}</div>
      </div>

      ${a.feedback_provided?`
      <div class="notes-section">
        <div class="notes-title">Feedback for Student:</div>
        <div class="notes-content">${a.feedback_provided}</div>
      </div>
      `:""}

      ${a.examiner_notes?`
      <div class="notes-section">
        <div class="notes-title">Examiner Notes:</div>
        <div class="notes-content">${a.examiner_notes}</div>
      </div>
      `:""}

      <div class="signature-section">
        <div>
          <div class="signature-line">Examiner Signature</div>
        </div>
        <div>
          <div class="signature-line">Date</div>
        </div>
      </div>
    </div>
  `}),c=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Summative Evaluation - ${r.scenario?.title}</title>
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
  ${d.join('<div class="page-break"></div>')}
</body>
</html>
    `;return new b.NextResponse(c,{headers:{"Content-Type":"text/html; charset=utf-8"}})}catch(e){return console.error("Error exporting evaluation:",e),b.NextResponse.json({success:!1,error:"Failed to export evaluation"},{status:500})}}e.s(["GET",()=>R],524376);var E=e.i(524376);let k=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/clinical/summative-evaluations/[id]/export/route",pathname:"/api/clinical/summative-evaluations/[id]/export",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/.claude/worktrees/focused-goodall/app/api/clinical/summative-evaluations/[id]/export/route.ts",nextConfigOutput:"standalone",userland:E}),{workAsyncStorage:C,workUnitAsyncStorage:A,serverHooks:$}=k;function P(){return(0,i.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:A})}async function T(e,t,i){k.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let b="/api/clinical/summative-evaluations/[id]/export/route";b=b.replace(/\/index$/,"")||"/";let x=await k.prepare(e,t,{srcPage:b,multiZoneDraftMode:!1});if(!x)return t.statusCode=400,t.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:_,params:y,nextConfig:w,parsedUrl:R,isDraftMode:E,prerenderManifest:C,routerServerContext:A,isOnDemandRevalidate:$,revalidateOnlyGenerated:P,resolvedPathname:T,clientReferenceManifest:S,serverActionsManifest:I}=x,N=(0,o.normalizeAppPath)(b),U=!!(C.dynamicRoutes[N]||C.routes[T]),D=async()=>((null==A?void 0:A.render404)?await A.render404(e,t,R,!1):t.end("This page could not be found"),null);if(U&&!E){let e=!!C.routes[T],t=C.dynamicRoutes[N];if(t&&!1===t.fallback&&!e){if(w.experimental.adapterPath)return await D();throw new v.NoFallbackError}}let O=null;!U||k.isDev||E||(O="/index"===(O=T)?"/":O);let q=!0===k.isDev||!U,H=U&&!q;I&&S&&(0,r.setManifestsSingleton)({page:b,clientReferenceManifest:S,serverActionsManifest:I});let M=e.method||"GET",F=(0,s.getTracer)(),z=F.getActiveScopeSpan(),j={params:y,prerenderManifest:C,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:q,incrementalCache:(0,n.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:w.cacheLife,waitUntil:i.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,i,n)=>k.onRequestError(e,t,i,n,A)},sharedContext:{buildId:_}},L=new l.NodeNextRequest(e),B=new l.NodeNextResponse(t),K=d.NextRequestAdapter.fromNodeNextRequest(L,(0,d.signalFromNodeResponse)(t));try{let r=async e=>k.handle(K,j).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=F.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==c.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=a.get("next.route");if(i){let t=`${M} ${i}`;e.setAttributes({"next.route":i,"http.route":i,"next.span_name":t}),e.updateName(t)}else e.updateName(`${M} ${b}`)}),o=!!(0,n.getRequestMeta)(e,"minimalMode"),l=async n=>{var s,l;let d=async({previousCacheEntry:a})=>{try{if(!o&&$&&P&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await r(n);e.fetchMetrics=j.renderOpts.fetchMetrics;let l=j.renderOpts.pendingWaitUntil;l&&i.waitUntil&&(i.waitUntil(l),l=void 0);let d=j.renderOpts.collectedTags;if(!U)return await (0,u.sendResponse)(L,B,s,j.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(s.headers);d&&(t[g.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==j.renderOpts.collectedRevalidate&&!(j.renderOpts.collectedRevalidate>=g.INFINITE_CACHE)&&j.renderOpts.collectedRevalidate,i=void 0===j.renderOpts.collectedExpire||j.renderOpts.collectedExpire>=g.INFINITE_CACHE?void 0:j.renderOpts.collectedExpire;return{value:{kind:h.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:i}}}}catch(t){throw(null==a?void 0:a.isStale)&&await k.onRequestError(e,t,{routerKind:"App Router",routePath:b,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:$})},!1,A),t}},c=await k.handleResponse({req:e,nextConfig:w,cacheKey:O,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:$,revalidateOnlyGenerated:P,responseGenerator:d,waitUntil:i.waitUntil,isMinimalMode:o});if(!U)return null;if((null==c||null==(s=c.value)?void 0:s.kind)!==h.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(l=c.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});o||t.setHeader("x-nextjs-cache",$?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),E&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let v=(0,m.fromNodeOutgoingHttpHeaders)(c.value.headers);return o&&U||v.delete(g.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||v.get("Cache-Control")||v.set("Cache-Control",(0,f.getCacheControlHeader)(c.cacheControl)),await (0,u.sendResponse)(L,B,new Response(c.value.body,{headers:v,status:c.value.status||200})),null};z?await l(z):await F.withPropagatedContext(e.headers,()=>F.trace(c.BaseServerSpan.handleRequest,{spanName:`${M} ${b}`,kind:s.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},l))}catch(t){if(t instanceof v.NoFallbackError||await k.onRequestError(e,t,{routerKind:"App Router",routePath:N,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:$})},!1,A),U)throw t;return await (0,u.sendResponse)(L,B,new Response(null,{status:500})),null}}e.s(["handler",()=>T,"patchFetch",()=>P,"routeModule",()=>k,"serverHooks",()=>$,"workAsyncStorage",()=>C,"workUnitAsyncStorage",()=>A],149922)}];

//# sourceMappingURL=e71d5_next_dist_esm_build_templates_app-route_75135ca1.js.map