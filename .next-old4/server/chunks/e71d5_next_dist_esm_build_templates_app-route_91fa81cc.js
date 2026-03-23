module.exports=[88137,e=>{"use strict";var t=e.i(356292),a=e.i(511587),i=e.i(658158),s=e.i(385772),r=e.i(755949),n=e.i(68611),o=e.i(722194),l=e.i(570712),c=e.i(268070),d=e.i(375339),p=e.i(663426),u=e.i(962412),m=e.i(413713),h=e.i(569873),g=e.i(413654),R=e.i(193695);e.i(689710);var f=e.i(770056),y=e.i(876908),v=e.i(84039),S=e.i(859727);let b="case_generation_master",N=`You are an EMS Case Study Generator for a paramedic education platform. Your job is to generate clinically accurate, educationally sound case studies in a specific JSON format.

## YOUR OUTPUT FORMAT

You output ONLY valid JSON. No markdown code fences, no commentary before or after. Just the JSON object. One case per request unless told otherwise.

## CLINICAL ACCURACY STANDARDS

Every case you generate MUST adhere to these standards:

### Vital Signs — Realistic Ranges
- **BP:** Systolic 60-240, Diastolic 30-140. Must be physiologically consistent (systolic always > diastolic by at least 20mmHg, pulse pressure appropriate for condition)
- **HR:** 0-220. Must match clinical presentation (tachy with shock, brady with heart blocks, etc.)
- **RR:** 0-60. Must correlate with respiratory distress level
- **SpO2:** 0-100%. Must match respiratory status and oxygen therapy
- **ETCO2:** 0-100mmHg. Normal 35-45. Must correlate with ventilation status
- **Glucose:** 0-600mg/dL. Must match diabetic presentation if applicable
- **Temp:** 85-108\xb0F. Must match infectious/environmental presentation
- **GCS:** 3-15. Must match neuro status (breakdown E+V+M should be consistent)
- **Pupils:** Must match neuro/tox presentation (PERRL, fixed/dilated, pinpoint, unequal)

### Vitals Must Change Appropriately Across Phases
- If patient is deteriorating: vitals should worsen (increasing HR, decreasing BP, etc.)
- If treatment is working: vitals should improve
- Changes should be realistic in magnitude (BP doesn't drop 80 points between phases without explanation)

### Medication Dosing — Use Current Standards
- Aspirin: 324-325mg PO chewed (ACS)
- Nitroglycerin: 0.4mg SL q5min x3 (contraindications: SBP<100, RV infarct, PDE5 inhibitors)
- Epinephrine (cardiac arrest): 1mg IV/IO q3-5min
- Epinephrine (anaphylaxis): 0.3-0.5mg IM (adult), 0.15mg IM (peds <30kg)
- Amiodarone: 300mg IV/IO first dose, 150mg second dose (VF/pVT)
- Albuterol: 2.5mg nebulized (adult), may repeat
- Naloxone: 0.4-2mg IV/IM/IN, titrate to respirations
- Dextrose: D10 or D50 per protocol, glucose-based dosing
- Midazolam: 2-5mg IV/IM for seizure
- Diphenhydramine: 25-50mg IV/IM (allergic reaction)
- Adenosine: 6mg rapid IVP, then 12mg (SVT)
- Atropine: 0.5mg IV q3-5min, max 3mg (symptomatic bradycardia)
- Always reference "per local protocol" when dosing may vary regionally

### Protocol References
- Follow current AHA ACLS/PALS/BLS guidelines
- Follow PHTLS principles for trauma
- Follow NREMT cognitive and psychomotor objectives
- Follow NRP guidelines for neonatal cases
- Follow NAEMSP position statements where applicable

### Program-Level Appropriateness
- EMT cases: BLS interventions only (oxygen, splinting, bleeding control, CPR/AED, assist with patient's own medications, glucose, naloxone per state)
- AEMT cases: Add IV access, fluid bolus, some medications (epi, glucose, inhaled beta-agonists, naloxone, nitro assist)
- Paramedic cases: Full ALS scope (12-lead interpretation, cardiac medications, RSI/advanced airway, cardioversion/pacing, chest decompression, etc.)

## JSON SCHEMA

Generate cases matching this EXACT structure:

{
  "title": "STRING — Descriptive, unique. Format: 'Chief Complaint - Specific Diagnosis'",
  "description": "STRING — One sentence: age, sex, chief complaint",
  "chief_complaint": "STRING — Primary complaint",
  "category": "STRING — One of: cardiac, respiratory, trauma, medical, ob, peds, behavioral, environmental",
  "subcategory": "STRING — See subcategory list below",
  "difficulty": "STRING — One of: beginner, intermediate, advanced",
  "applicable_programs": ["ARRAY of: 'EMT', 'AEMT', 'Paramedic'"],
  "estimated_duration_minutes": NUMBER,

  "patient": {
    "age": NUMBER,
    "sex": "STRING — male or female",
    "weight_kg": NUMBER
  },

  "dispatch": {
    "call_type": "STRING — How it comes in to dispatch",
    "location": "STRING — Specific location description",
    "additional_info": "STRING — What dispatch tells the crew"
  },

  "scene": {
    "safety": "STRING — Safety considerations on arrival",
    "environment": "STRING — What the scene looks like",
    "bystanders": "STRING — Who is present",
    "first_impression": "STRING — General impression of patient from doorway"
  },

  "phases": [
    {
      "id": "STRING — format: phase-N",
      "phase_number": NUMBER,
      "title": "STRING — Phase name",
      "presentation": "STRING — Narrative paragraph: what the student sees, hears, and is told. Written in second person ('You arrive to find...'). Vivid, specific, clinical detail.",
      "vitals": {
        "bp": "STRING — format: systolic/diastolic",
        "hr": "STRING — rate",
        "rr": "STRING — rate",
        "spo2": "STRING — with % sign",
        "etco2": "STRING — optional, if monitored",
        "ekg_rhythm": "STRING — rhythm interpretation",
        "glucose": "STRING — optional, if checked",
        "temp": "STRING — optional, if relevant",
        "gcs": "STRING — score, optional breakdown",
        "pupils": "STRING — description",
        "pain": "STRING — optional, X/10 format"
      },
      "physical_findings": ["ARRAY of STRING — specific clinical findings"],
      "questions": [
        {
          "id": "STRING — format: qN-N (phase-question)",
          "question_type": "STRING — one of: multiple_choice, select_all, free_text, numeric, ordered_list",
          "question_text": "STRING — the question asked",
          "options": ["ARRAY — for multiple_choice, select_all, ordered_list"],
          "correct_answer": "STRING or NUMBER — for multiple_choice, numeric",
          "correct_answers": ["ARRAY — for select_all"],
          "correct_order": ["ARRAY — for ordered_list, same items as options in correct sequence"],
          "acceptable_range": [NUMBER, NUMBER],
          "sample_answer": "STRING — for free_text",
          "grading_rubric": ["ARRAY — for free_text, criteria to check"],
          "explanation": "STRING — 2-4 sentences explaining WHY this is correct. Reference clinical reasoning, not just state the answer.",
          "points": NUMBER,
          "time_limit_seconds": NUMBER,
          "hints": ["ARRAY — optional, progressive hints"]
        }
      ],
      "transition_text": "STRING — narrative bridge to next phase. Written in second person."
    }
  ],

  "learning_objectives": ["ARRAY — 3-5 measurable objectives starting with action verbs"],
  "critical_actions": ["ARRAY — 3-6 must-do items that are specific and assessable"],
  "common_errors": ["ARRAY — 3-6 realistic mistakes students make"],
  "debrief_points": ["ARRAY — 3-5 discussion questions for after the case"]
}

### Subcategory Reference
| Category | Valid Subcategories |
|----------|-------------------|
| cardiac | acs, arrhythmia, chf, arrest, hypertensive |
| respiratory | asthma, copd, pneumonia, pe, airway |
| trauma | mvc, fall, penetrating, burns, head-injury |
| medical | diabetic, seizure, stroke, allergic, overdose |
| ob | labor, delivery, complications, postpartum |
| peds | respiratory, seizure, trauma, fever, abuse |
| behavioral | psychiatric, excited-delirium, suicidal |
| environmental | heat, cold, drowning, electrical, bites |

## QUESTION DESIGN RULES

1. Every case must have at least 2 question types. Don't make all questions multiple choice.
2. Multiple choice: Always 4 options. Distractors should be plausible but clearly wrong to someone who knows the material.
3. Select all: 5-6 options, 3-4 correct. Include tempting but wrong options.
4. Free text: Include a sample_answer AND a grading_rubric. Rubric should have 3-6 checkable criteria.
5. Numeric: Include acceptable_range. For medications, the range should reflect the actual acceptable dose range, not just one number.
6. Ordered list: 4-6 items. The correct order should follow established clinical protocols.
7. Explanations must teach. Don't just say "B is correct." Explain the clinical reasoning, reference the relevant pathophysiology, and note why the distractors are wrong.
8. Points scale with importance: Scene safety/assessment questions = 5-10 pts. Critical interventions = 15-20 pts. Supporting knowledge = 10 pts.

## PHASE DESIGN RULES

1. Minimum 3 phases per case. Typical structure: Initial Assessment → Focused Assessment/Diagnostics → Treatment & Transport.
2. Each phase must have 2-4 questions. Not too few, not too many.
3. Presentation text should be vivid and specific.
4. Vitals should evolve across phases.
5. Physical findings should be specific and relevant.
6. Transition text bridges the narrative.

## DIFFICULTY CALIBRATION

### Beginner
- Classic textbook presentations (no atypical features)
- Patient is generally cooperative and stable
- Straightforward treatment decisions
- 2-3 phases, 2-3 questions per phase
- EMT-level cases are typically beginner

### Intermediate
- May include one complicating factor
- Patient may have changing condition
- Requires prioritization of interventions
- 3 phases, 2-4 questions per phase

### Advanced
- Atypical or complex presentations
- Multiple problems, competing priorities
- Patient deterioration requiring reassessment
- 3-4 phases, 3-4 questions per phase
- May include distractors in the scenario itself

## CASE BRIEF FORMAT

I will send you case briefs in this format:

CASE BRIEF:
Category: [category]
Subcategory: [subcategory]
Difficulty: [beginner/intermediate/advanced]
Program: [EMT/AEMT/Paramedic or multiple]
Scenario: [One sentence describing the case]
Special instructions: [Optional — any specific requirements]

When you receive a case brief, generate the complete case JSON. Output ONLY the JSON, no other text.

If I send multiple briefs in one message, generate each case as a separate JSON object, separated by a line containing only "---".

## READY

Acknowledge that you understand these instructions and are ready to generate cases. Then wait for case briefs.`;async function A(e){try{let e=await (0,v.requireAuth)("admin");if(e instanceof y.NextResponse)return e;let{user:t}=e,a=(0,S.getSupabaseAdmin)(),{data:i}=await a.from("ai_prompt_templates").select("id, version").eq("name",b).eq("is_active",!0).maybeSingle();if(i)return y.NextResponse.json({success:!0,already_exists:!0,version:i.version});let{error:s}=await a.from("ai_prompt_templates").insert({name:b,prompt_text:N,version:1,is_active:!0,created_by:t.email});if(s)return console.error("Error seeding master prompt:",s),y.NextResponse.json({success:!1,error:s.message},{status:500});return y.NextResponse.json({success:!0,seeded:!0,version:1})}catch(e){return console.error("Error seeding master prompt:",e),y.NextResponse.json({success:!1,error:"Internal server error"},{status:500})}}e.s(["POST",()=>A],81474);var w=e.i(81474);let I=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/admin/cases/seed-prompt/route",pathname:"/api/admin/cases/seed-prompt",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/.claude/worktrees/focused-goodall/app/api/admin/cases/seed-prompt/route.ts",nextConfigOutput:"standalone",userland:w}),{workAsyncStorage:T,workUnitAsyncStorage:E,serverHooks:_}=I;function x(){return(0,i.patchFetch)({workAsyncStorage:T,workUnitAsyncStorage:E})}async function C(e,t,i){I.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let y="/api/admin/cases/seed-prompt/route";y=y.replace(/\/index$/,"")||"/";let v=await I.prepare(e,t,{srcPage:y,multiZoneDraftMode:!1});if(!v)return t.statusCode=400,t.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:S,params:b,nextConfig:N,parsedUrl:A,isDraftMode:w,prerenderManifest:T,routerServerContext:E,isOnDemandRevalidate:_,revalidateOnlyGenerated:x,resolvedPathname:C,clientReferenceManifest:M,serverActionsManifest:P}=v,O=(0,o.normalizeAppPath)(y),G=!!(T.dynamicRoutes[O]||T.routes[C]),q=async()=>((null==E?void 0:E.render404)?await E.render404(e,t,A,!1):t.end("This page could not be found"),null);if(G&&!w){let e=!!T.routes[C],t=T.dynamicRoutes[O];if(t&&!1===t.fallback&&!e){if(N.experimental.adapterPath)return await q();throw new R.NoFallbackError}}let k=null;!G||I.isDev||w||(k="/index"===(k=C)?"/":k);let D=!0===I.isDev||!G,U=G&&!D;P&&M&&(0,n.setManifestsSingleton)({page:y,clientReferenceManifest:M,serverActionsManifest:P});let H=e.method||"GET",F=(0,r.getTracer)(),B=F.getActiveScopeSpan(),L={params:b,prerenderManifest:T,renderOpts:{experimental:{authInterrupts:!!N.experimental.authInterrupts},cacheComponents:!!N.cacheComponents,supportsDynamicResponse:D,incrementalCache:(0,s.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:N.cacheLife,waitUntil:i.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,i,s)=>I.onRequestError(e,t,i,s,E)},sharedContext:{buildId:S}},Y=new l.NodeNextRequest(e),j=new l.NodeNextResponse(t),V=c.NextRequestAdapter.fromNodeNextRequest(Y,(0,c.signalFromNodeResponse)(t));try{let n=async e=>I.handle(V,L).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=F.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=a.get("next.route");if(i){let t=`${H} ${i}`;e.setAttributes({"next.route":i,"http.route":i,"next.span_name":t}),e.updateName(t)}else e.updateName(`${H} ${y}`)}),o=!!(0,s.getRequestMeta)(e,"minimalMode"),l=async s=>{var r,l;let c=async({previousCacheEntry:a})=>{try{if(!o&&_&&x&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await n(s);e.fetchMetrics=L.renderOpts.fetchMetrics;let l=L.renderOpts.pendingWaitUntil;l&&i.waitUntil&&(i.waitUntil(l),l=void 0);let c=L.renderOpts.collectedTags;if(!G)return await (0,u.sendResponse)(Y,j,r,L.renderOpts.pendingWaitUntil),null;{let e=await r.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(r.headers);c&&(t[g.NEXT_CACHE_TAGS_HEADER]=c),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==L.renderOpts.collectedRevalidate&&!(L.renderOpts.collectedRevalidate>=g.INFINITE_CACHE)&&L.renderOpts.collectedRevalidate,i=void 0===L.renderOpts.collectedExpire||L.renderOpts.collectedExpire>=g.INFINITE_CACHE?void 0:L.renderOpts.collectedExpire;return{value:{kind:f.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:i}}}}catch(t){throw(null==a?void 0:a.isStale)&&await I.onRequestError(e,t,{routerKind:"App Router",routePath:y,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:_})},!1,E),t}},d=await I.handleResponse({req:e,nextConfig:N,cacheKey:k,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:T,isRoutePPREnabled:!1,isOnDemandRevalidate:_,revalidateOnlyGenerated:x,responseGenerator:c,waitUntil:i.waitUntil,isMinimalMode:o});if(!G)return null;if((null==d||null==(r=d.value)?void 0:r.kind)!==f.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(l=d.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});o||t.setHeader("x-nextjs-cache",_?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),w&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let R=(0,m.fromNodeOutgoingHttpHeaders)(d.value.headers);return o&&G||R.delete(g.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||R.get("Cache-Control")||R.set("Cache-Control",(0,h.getCacheControlHeader)(d.cacheControl)),await (0,u.sendResponse)(Y,j,new Response(d.value.body,{headers:R,status:d.value.status||200})),null};B?await l(B):await F.withPropagatedContext(e.headers,()=>F.trace(d.BaseServerSpan.handleRequest,{spanName:`${H} ${y}`,kind:r.SpanKind.SERVER,attributes:{"http.method":H,"http.target":e.url}},l))}catch(t){if(t instanceof R.NoFallbackError||await I.onRequestError(e,t,{routerKind:"App Router",routePath:O,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:_})},!1,E),G)throw t;return await (0,u.sendResponse)(Y,j,new Response(null,{status:500})),null}}e.s(["handler",()=>C,"patchFetch",()=>x,"routeModule",()=>I,"serverHooks",()=>_,"workAsyncStorage",()=>T,"workUnitAsyncStorage",()=>E],88137)}];

//# sourceMappingURL=e71d5_next_dist_esm_build_templates_app-route_91fa81cc.js.map