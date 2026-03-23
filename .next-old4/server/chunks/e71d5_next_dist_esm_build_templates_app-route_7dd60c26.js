module.exports=[744424,e=>{"use strict";var t=e.i(356292),a=e.i(511587),n=e.i(658158),r=e.i(385772),s=e.i(755949),i=e.i(68611),o=e.i(722194),l=e.i(570712),d=e.i(268070),u=e.i(375339),c=e.i(663426),_=e.i(962412),p=e.i(413713),m=e.i(569873),g=e.i(413654),h=e.i(193695);e.i(689710);var f=e.i(770056),b=e.i(876908),y=e.i(859727),v=e.i(443603),R=e.i(84039);async function k(e){let t=(0,y.getSupabaseAdmin)(),{data:a}=await t.from("lab_users").select("role").ilike("email",e).single();return a?.role??null}let w=[{key:"mmr_complete",label:"MMR"},{key:"vzv_complete",label:"Varicella (VZV)"},{key:"hep_b_complete",label:"Hepatitis B"},{key:"tdap_complete",label:"Tdap"},{key:"covid_complete",label:"COVID-19"},{key:"tb_test_1_complete",label:"TB Test"},{key:"physical_complete",label:"Physical Exam"},{key:"health_insurance_complete",label:"Health Insurance"},{key:"bls_complete",label:"BLS Certification"},{key:"flu_shot_complete",label:"Flu Shot"},{key:"hospital_orientation_complete",label:"Hospital Orientation"},{key:"background_check_complete",label:"Background Check"},{key:"drug_test_complete",label:"Drug Test"}];async function x(e,{params:t}){let a=await (0,R.requireAuth)("instructor");if(a instanceof b.NextResponse)return a;let{user:n,session:r}=a,s=await k(r.user.email);if(!s||!(0,v.hasMinRole)(s,"instructor"))return b.NextResponse.json({error:"Forbidden"},{status:403});let{id:i}=await t;try{let e=(0,y.getSupabaseAdmin)(),[{data:t,error:a},{data:n},{data:r},{data:s},{data:o},{data:l},{data:d},{data:u},{data:c}]=await Promise.all([e.from("students").select(`
          id,
          first_name,
          last_name,
          email,
          photo_url,
          status,
          agency,
          student_id,
          prior_cert_level,
          years_ems_experience,
          created_at,
          cohort:cohorts!students_cohort_id_fkey(
            id,
            cohort_number,
            start_date,
            expected_end_date,
            program:programs(name, abbreviation)
          )
        `).eq("id",i).single(),e.from("skill_signoffs").select(`
          id,
          signed_off_at,
          signed_off_by,
          revoked_at,
          skill:skills!skill_id(id, name, category)
        `).eq("student_id",i).is("revoked_at",null).order("signed_off_at",{ascending:!0}),e.from("scenario_assessments").select(`
          id,
          overall_score,
          created_at,
          lab_day_id,
          lab_day:lab_days(date, week_number, day_number),
          station:lab_stations!lab_station_id(
            station_number,
            scenario:scenarios(title, category)
          ),
          grader:lab_users!graded_by(name)
        `).eq("team_lead_id",i).order("created_at",{ascending:!0}),e.from("summative_evaluation_scores").select(`
          id,
          total_score,
          passed,
          grading_complete,
          graded_at,
          leadership_scene_score,
          patient_assessment_score,
          patient_management_score,
          interpersonal_score,
          integration_score,
          critical_criteria_failed,
          evaluation:summative_evaluations!evaluation_id(
            evaluation_date,
            examiner_name,
            scenario:summative_scenarios!scenario_id(title, scenario_number)
          )
        `).eq("student_id",i).order("graded_at",{ascending:!0}),e.from("lab_day_attendance").select(`
          id,
          status,
          notes,
          marked_at,
          lab_day:lab_days!lab_day_id(id, date, week_number, day_number)
        `).eq("student_id",i).order("marked_at",{ascending:!0}),e.from("student_compliance_docs").select("*").eq("student_id",i).single(),e.from("student_compliance_records").select(`
          id,
          status,
          expiration_date,
          verified_at,
          doc_type:compliance_document_types!doc_type_id(name, is_required, expiration_months)
        `).eq("student_id",i).order("doc_type_id"),e.from("student_clinical_hours").select("department, hours, shifts").eq("student_id",i),e.from("team_lead_log").select(`
          id,
          date,
          lab_day:lab_days!lab_day_id(date, week_number, day_number),
          lab_station:lab_stations!lab_station_id(station_number, station_type)
        `).eq("student_id",i).order("date",{ascending:!0})]);if(a||!t)return b.NextResponse.json({error:"Student not found"},{status:404});let _=(n||[]).map(e=>{let t=e.skill;return{id:e.id,skill_name:t?.name||"Unknown Skill",skill_category:t?.category||null,signed_off_at:e.signed_off_at,signed_off_by:e.signed_off_by}}),p=(r||[]).map(e=>{var t;let a=e.station,n=e.grader,r=e.lab_day;return{id:e.id,scenario_title:a?.scenario?.title||`Station ${a?.station_number||"?"}`,scenario_category:a?.scenario?.category||null,date:r?.date||e.created_at,week_number:r?.week_number||null,day_number:r?.day_number||null,score:e.overall_score,grade:null==(t=e.overall_score)?"N/A":t>=4?"A":t>=3?"B":t>=2?"C":t>=1?"D":"F",instructor:n?.name||"Unknown"}}),m=p.filter(e=>null!==e.score),g=m.length>0?m.reduce((e,t)=>e+(t.score||0),0)/m.length:null,h=(s||[]).map(e=>{let t=e.evaluation;return{id:e.id,scenario_title:t?.scenario?.title||`Scenario ${t?.scenario?.scenario_number||"?"}`,scenario_number:t?.scenario?.scenario_number||null,evaluation_date:t?.evaluation_date||null,examiner_name:t?.examiner_name||"Unknown",total_score:e.total_score,passed:e.passed,grading_complete:e.grading_complete,graded_at:e.graded_at,scores:{leadership_scene:e.leadership_scene_score,patient_assessment:e.patient_assessment_score,patient_management:e.patient_management_score,interpersonal:e.interpersonal_score,integration:e.integration_score},critical_criteria_failed:e.critical_criteria_failed}}),f=(o||[]).map(e=>{let t=e.lab_day;return{id:e.id,lab_day_date:t?.date||null,week_number:t?.week_number||null,day_number:t?.day_number||null,status:e.status,notes:e.notes,marked_at:e.marked_at}}),v={total:f.length,present:f.filter(e=>"present"===e.status).length,absent:f.filter(e=>"absent"===e.status).length,excused:f.filter(e=>"excused"===e.status).length,late:f.filter(e=>"late"===e.status).length,records:f},R=[];d&&d.length>0?R=d.map(e=>{let t=e.doc_type;return{name:t?.name||"Unknown Document",status:e.status,expiration_date:e.expiration_date,is_required:t?.is_required??!0}}):l&&(R=w.map(e=>({name:e.label,status:!0===l[e.key]?"complete":"missing",expiration_date:null,is_required:!0})));let k={total:R.length,complete:R.filter(e=>"complete"===e.status).length,missing:R.filter(e=>"missing"===e.status).length,expiring:R.filter(e=>"expiring"===e.status).length,expired:R.filter(e=>"expired"===e.status).length,items:R},x=(u||[]).reduce((e,t)=>e+(t.hours||0),0),E={};(u||[]).forEach(e=>{e.department&&(E[e.department]={hours:(E[e.department]?.hours||0)+(e.hours||0),shifts:(E[e.department]?.shifts||0)+(e.shifts||0)})});let C={totalHours:x,totalShifts:(u||[]).reduce((e,t)=>e+(t.shifts||0),0),byDepartment:E},A=(c||[]).length;return b.NextResponse.json({success:!0,portfolio:{student:t,generatedAt:new Date().toISOString(),skills:{total:_.length,items:_},scenarios:{total:p.length,averageScore:g,items:p},summativeEvaluations:{total:h.length,passed:h.filter(e=>!0===e.passed).length,items:h},attendance:v,compliance:k,clinicalHours:C,teamLeadCount:A}})}catch(e){return console.error("Error fetching student portfolio:",e),b.NextResponse.json({success:!1,error:"Failed to fetch portfolio"},{status:500})}}e.s(["GET",()=>x],327705);var E=e.i(327705);let C=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/lab-management/students/[id]/portfolio/route",pathname:"/api/lab-management/students/[id]/portfolio",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/.claude/worktrees/focused-goodall/app/api/lab-management/students/[id]/portfolio/route.ts",nextConfigOutput:"standalone",userland:E}),{workAsyncStorage:A,workUnitAsyncStorage:S,serverHooks:N}=C;function T(){return(0,n.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:S})}async function q(e,t,n){C.isDev&&(0,r.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let b="/api/lab-management/students/[id]/portfolio/route";b=b.replace(/\/index$/,"")||"/";let y=await C.prepare(e,t,{srcPage:b,multiZoneDraftMode:!1});if(!y)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:v,params:R,nextConfig:k,parsedUrl:w,isDraftMode:x,prerenderManifest:E,routerServerContext:A,isOnDemandRevalidate:S,revalidateOnlyGenerated:N,resolvedPathname:T,clientReferenceManifest:q,serverActionsManifest:P}=y,O=(0,o.normalizeAppPath)(b),H=!!(E.dynamicRoutes[O]||E.routes[T]),U=async()=>((null==A?void 0:A.render404)?await A.render404(e,t,w,!1):t.end("This page could not be found"),null);if(H&&!x){let e=!!E.routes[T],t=E.dynamicRoutes[O];if(t&&!1===t.fallback&&!e){if(k.experimental.adapterPath)return await U();throw new h.NoFallbackError}}let D=null;!H||C.isDev||x||(D="/index"===(D=T)?"/":D);let I=!0===C.isDev||!H,M=H&&!I;P&&q&&(0,i.setManifestsSingleton)({page:b,clientReferenceManifest:q,serverActionsManifest:P});let F=e.method||"GET",j=(0,s.getTracer)(),$=j.getActiveScopeSpan(),B={params:R,prerenderManifest:E,renderOpts:{experimental:{authInterrupts:!!k.experimental.authInterrupts},cacheComponents:!!k.cacheComponents,supportsDynamicResponse:I,incrementalCache:(0,r.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:k.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,n,r)=>C.onRequestError(e,t,n,r,A)},sharedContext:{buildId:v}},K=new l.NodeNextRequest(e),V=new l.NodeNextResponse(t),L=d.NextRequestAdapter.fromNodeNextRequest(K,(0,d.signalFromNodeResponse)(t));try{let i=async e=>C.handle(L,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=j.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=a.get("next.route");if(n){let t=`${F} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t)}else e.updateName(`${F} ${b}`)}),o=!!(0,r.getRequestMeta)(e,"minimalMode"),l=async r=>{var s,l;let d=async({previousCacheEntry:a})=>{try{if(!o&&S&&N&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await i(r);e.fetchMetrics=B.renderOpts.fetchMetrics;let l=B.renderOpts.pendingWaitUntil;l&&n.waitUntil&&(n.waitUntil(l),l=void 0);let d=B.renderOpts.collectedTags;if(!H)return await (0,_.sendResponse)(K,V,s,B.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,p.toNodeOutgoingHttpHeaders)(s.headers);d&&(t[g.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=g.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,n=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=g.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:f.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:n}}}}catch(t){throw(null==a?void 0:a.isStale)&&await C.onRequestError(e,t,{routerKind:"App Router",routePath:b,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:S})},!1,A),t}},u=await C.handleResponse({req:e,nextConfig:k,cacheKey:D,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:E,isRoutePPREnabled:!1,isOnDemandRevalidate:S,revalidateOnlyGenerated:N,responseGenerator:d,waitUntil:n.waitUntil,isMinimalMode:o});if(!H)return null;if((null==u||null==(s=u.value)?void 0:s.kind)!==f.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(l=u.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});o||t.setHeader("x-nextjs-cache",S?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),x&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let h=(0,p.fromNodeOutgoingHttpHeaders)(u.value.headers);return o&&H||h.delete(g.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||h.get("Cache-Control")||h.set("Cache-Control",(0,m.getCacheControlHeader)(u.cacheControl)),await (0,_.sendResponse)(K,V,new Response(u.value.body,{headers:h,status:u.value.status||200})),null};$?await l($):await j.withPropagatedContext(e.headers,()=>j.trace(u.BaseServerSpan.handleRequest,{spanName:`${F} ${b}`,kind:s.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},l))}catch(t){if(t instanceof h.NoFallbackError||await C.onRequestError(e,t,{routerKind:"App Router",routePath:O,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:S})},!1,A),H)throw t;return await (0,_.sendResponse)(K,V,new Response(null,{status:500})),null}}e.s(["handler",()=>q,"patchFetch",()=>T,"routeModule",()=>C,"serverHooks",()=>N,"workAsyncStorage",()=>A,"workUnitAsyncStorage",()=>S],744424)}];

//# sourceMappingURL=e71d5_next_dist_esm_build_templates_app-route_7dd60c26.js.map