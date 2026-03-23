module.exports=[888367,e=>{"use strict";var t=e.i(356292),s=e.i(511587),i=e.i(658158),a=e.i(385772),r=e.i(755949),n=e.i(68611),l=e.i(156149),o=e.i(570712),d=e.i(268070),u=e.i(375339),c=e.i(663426),_=e.i(962412),m=e.i(413713),p=e.i(569873),f=e.i(413654),h=e.i(193695);e.i(689710);var g=e.i(770056),R=e.i(876908),w=e.i(81563),y=e.i(421427),v=e.i(859727);async function x(e){let t=await (0,w.getServerSession)(y.authOptions);if(!t?.user?.email)return R.NextResponse.json({success:!1,error:"Unauthorized"},{status:401});let s=e.nextUrl.searchParams,i=s.get("type")||"hours_by_instructor",a=s.get("start_date"),r=s.get("end_date");if(!a||!r)return R.NextResponse.json({success:!1,error:"start_date and end_date required"},{status:400});try{let e=(0,v.getSupabaseAdmin)();switch(i){case"dashboard":{let{data:t,error:s}=await e.from("open_shifts").select(`
            id,
            title,
            date,
            start_time,
            end_time,
            location,
            department,
            min_instructors,
            max_instructors,
            is_filled,
            is_cancelled,
            created_at,
            signups:shift_signups(
              id,
              status,
              instructor:lab_users!shift_signups_instructor_id_fkey(name, email)
            )
          `).gte("date",a).lte("date",r).order("date",{ascending:!0}).order("start_time",{ascending:!0});if(s)throw s;let i=t||[],n=i.filter(e=>!e.is_cancelled),l=n.filter(e=>(e.signups?.filter(e=>"confirmed"===e.status).length||0)>=e.min_instructors).length,o=n.length-l,d={total:i.length,active:n.length,filled:l,open:o,cancelled:i.length-n.length},u=i.map(e=>{let t=e.signups?.filter(e=>"confirmed"===e.status).length||0,s=e.signups?.filter(e=>"pending"===e.status).length||0,i="unfilled";return e.is_cancelled?i="cancelled":t>=e.min_instructors?i="filled":(t>0||s>0)&&(i="partial"),{id:e.id,title:e.title,date:e.date,start_time:e.start_time,end_time:e.end_time,location:e.location,department:e.department,min_instructors:e.min_instructors,confirmed_count:t,pending_count:s,status:i,instructors:e.signups?.filter(e=>"confirmed"===e.status).map(e=>e.instructor?.name||e.instructor?.email)||[]}}),{data:c,error:_}=await e.from("instructor_availability").select(`
            id,
            date,
            start_time,
            end_time,
            is_all_day,
            instructor:lab_users!instructor_availability_instructor_id_fkey(id, name, email)
          `).gte("date",a).lte("date",r).order("date");if(_)throw _;let m={};for(let e of c||[]){let t=e.instructor;if(!t)continue;let s=new Date(e.date+"T12:00:00"),i=s.getDay(),a=s.getDate()-i+(0===i?-6:1),r=new Date(s.setDate(a)).toISOString().split("T")[0];m[r]||(m[r]={}),m[r][t.id]||(m[r][t.id]={name:t.name||t.email,email:t.email,dates:[]}),m[r][t.id].dates.push({date:e.date,start_time:e.start_time,end_time:e.end_time,is_all_day:e.is_all_day})}let p=Object.entries(m).sort(([e],[t])=>e.localeCompare(t)).map(([e,t])=>({week_start:e,instructors:Object.values(t).sort((e,t)=>e.name.localeCompare(t.name))})),{data:f,error:h}=await e.from("open_shifts").select(`
            id,
            title,
            date,
            start_time,
            end_time,
            location,
            department,
            is_filled,
            is_cancelled,
            created_at,
            updated_at
          `).order("created_at",{ascending:!1}).limit(10);if(h)throw h;return R.NextResponse.json({success:!0,reportType:"dashboard",shiftStats:d,coverageReport:u,availabilityByWeek:p,recentActivity:f||[]})}case"hours_by_instructor":{let{data:t,error:s}=await e.from("shift_signups").select(`
            id,
            shift_id,
            instructor_id,
            signup_start_time,
            signup_end_time,
            is_partial,
            status,
            instructor:lab_users!shift_signups_instructor_id_fkey(id, name, email),
            shift:open_shifts!shift_signups_shift_id_fkey(id, date, start_time, end_time, title, is_cancelled)
          `).eq("status","confirmed").gte("shift.date",a).lte("shift.date",r);if(s)throw s;let n={};for(let e of t||[]){let t=e.shift,s=e.instructor;if(!t||!s||t.is_cancelled)continue;let i=s.id;n[i]||(n[i]={instructor_id:i,instructor_name:s.name||s.email,instructor_email:s.email,days_worked:new Set,total_minutes:0,shifts:[]});let a=e.is_partial&&e.signup_start_time?e.signup_start_time:t.start_time,r=e.is_partial&&e.signup_end_time?e.signup_end_time:t.end_time,[l,o]=a.split(":").map(Number),[d,u]=r.split(":").map(Number),c=60*d+u-(60*l+o);n[i].days_worked.add(t.date),n[i].total_minutes+=c,n[i].shifts.push({date:t.date,title:t.title,hours:c/60})}let l=Object.values(n).map(e=>({instructor_id:e.instructor_id,instructor_name:e.instructor_name,instructor_email:e.instructor_email,days_worked:e.days_worked.size,total_hours:Math.round(e.total_minutes/60*100)/100,shifts:e.shifts.sort((e,t)=>e.date.localeCompare(t.date))})).sort((e,t)=>t.total_hours-e.total_hours);return R.NextResponse.json({success:!0,report:l,reportType:i})}case"shift_coverage":{let{data:t,error:s}=await e.from("open_shifts").select(`
            id,
            title,
            date,
            start_time,
            end_time,
            location,
            department,
            min_instructors,
            max_instructors,
            is_filled,
            is_cancelled,
            signups:shift_signups(
              id,
              status,
              instructor:lab_users!shift_signups_instructor_id_fkey(name, email)
            )
          `).gte("date",a).lte("date",r).order("date").order("start_time");if(s)throw s;let n=(t||[]).map(e=>{let t=e.signups?.filter(e=>"confirmed"===e.status).length||0,s=e.signups?.filter(e=>"pending"===e.status).length||0,i="unfilled";return e.is_cancelled?i="cancelled":t>=e.min_instructors?i="filled":(t>0||s>0)&&(i="partial"),{id:e.id,title:e.title,date:e.date,start_time:e.start_time,end_time:e.end_time,location:e.location,department:e.department,min_instructors:e.min_instructors,max_instructors:e.max_instructors,confirmed_count:t,pending_count:s,status:i,instructors:e.signups?.filter(e=>"confirmed"===e.status).map(e=>e.instructor?.name||e.instructor?.email)||[]}}),l={total:n.length,filled:n.filter(e=>"filled"===e.status).length,partial:n.filter(e=>"partial"===e.status).length,unfilled:n.filter(e=>"unfilled"===e.status).length,cancelled:n.filter(e=>"cancelled"===e.status).length};return R.NextResponse.json({success:!0,report:n,summary:l,reportType:i})}case"availability_summary":{let{data:t,error:s}=await e.from("instructor_availability").select(`
            id,
            date,
            start_time,
            end_time,
            is_all_day,
            instructor:lab_users!instructor_availability_instructor_id_fkey(id, name, email)
          `).gte("date",a).lte("date",r).order("date");if(s)throw s;let n={},l={};for(let e of t||[]){let t=e.instructor;if(!t)continue;let s=t.email;n[s]||(n[s]={name:t.name||t.email,email:t.email,dates:[]}),n[s].dates.push({date:e.date,start_time:e.start_time,end_time:e.end_time,is_all_day:e.is_all_day}),l[e.date]||(l[e.date]={date:e.date,instructors:[]}),l[e.date].instructors.push({name:t.name||t.email,email:t.email,start_time:e.start_time,end_time:e.end_time,is_all_day:e.is_all_day})}let o=Object.values(n).sort((e,t)=>e.name.localeCompare(t.name)),d=Object.values(l).sort((e,t)=>e.date.localeCompare(t.date));return R.NextResponse.json({success:!0,reportByInstructor:o,reportByDate:d,totalEntries:(t||[]).length,reportType:i})}case"missed_shifts":{let{data:t,error:s}=await e.from("open_shifts").select(`
            id,
            title,
            date,
            start_time,
            end_time,
            location,
            department,
            is_cancelled,
            signups:shift_signups(id)
          `).gte("date",a).lte("date",r).eq("is_cancelled",!1).order("date",{ascending:!0}).order("start_time",{ascending:!0});if(s){if(s.message?.includes("does not exist"))return R.NextResponse.json({success:!0,report:[],summary:{total_shifts:0,missed_shifts:0,missed_rate:0},reportType:i});throw s}let n=(t||[]).filter(e=>{let t=e.signups?.length||0;return 0===t}).map(e=>({id:e.id,date:e.date,title:e.title,start_time:e.start_time,end_time:e.end_time,location:e.location||"Not specified",department:e.department||"General"})),l=(t||[]).length,o={total_shifts:l,missed_shifts:n.length,missed_rate:l>0?Math.round(n.length/l*100):0};return R.NextResponse.json({success:!0,report:n,summary:o,reportType:i})}case"coverage_rate":{let{data:t,error:s}=await e.from("open_shifts").select(`
            id,
            date,
            min_instructors,
            is_cancelled,
            signups:shift_signups(id, status)
          `).gte("date",a).lte("date",r).order("date");if(s){if(s.message?.includes("does not exist"))return R.NextResponse.json({success:!0,report:[],overall:{total:0,filled:0,unfilled:0,cancelled:0,fill_rate:0},reportType:i});throw s}let n={};for(let e of t||[]){let t=e.date.substring(0,7);if(n[t]||(n[t]={total:0,filled:0,partial:0,unfilled:0,cancelled:0}),n[t].total++,e.is_cancelled)n[t].cancelled++;else{let s=e.signups?.filter(e=>"confirmed"===e.status).length||0,i=e.signups?.filter(e=>"pending"===e.status).length||0;s>=e.min_instructors?n[t].filled++:s>0||i>0?n[t].partial++:n[t].unfilled++}}let l=Object.entries(n).sort(([e],[t])=>e.localeCompare(t)).map(([e,t])=>{let s=t.total-t.cancelled;return{month:e,...t,active:s,fill_rate:s>0?Math.round(t.filled/s*100):0}}),o=(t||[]).filter(e=>!e.is_cancelled),d=o.filter(e=>(e.signups?.filter(e=>"confirmed"===e.status).length||0)>=e.min_instructors).length,u={total:(t||[]).length,active:o.length,filled:d,unfilled:o.length-d,cancelled:(t||[]).length-o.length,fill_rate:o.length>0?Math.round(d/o.length*100):0};return R.NextResponse.json({success:!0,report:l,overall:u,reportType:i})}case"hours_by_month":{let{data:t,error:s}=await e.from("shift_signups").select(`
            id,
            signup_start_time,
            signup_end_time,
            is_partial,
            status,
            instructor:lab_users!shift_signups_instructor_id_fkey(id, name, email),
            shift:open_shifts!shift_signups_shift_id_fkey(id, date, start_time, end_time, title, is_cancelled)
          `).eq("status","confirmed");if(s){if(s.message?.includes("does not exist"))return R.NextResponse.json({success:!0,report:[],months:[],reportType:i});throw s}let n={},l=new Set;for(let e of t||[]){let t=e.shift,s=e.instructor;if(!t||!s||t.is_cancelled||t.date<a||t.date>r)continue;let i=s.id,o=t.date.substring(0,7);l.add(o),n[i]||(n[i]={}),n[i][o]||(n[i][o]={instructor_id:i,instructor_name:s.name||s.email,instructor_email:s.email,month:o,total_minutes:0,shift_count:0});let d=e.is_partial&&e.signup_start_time?e.signup_start_time:t.start_time,u=e.is_partial&&e.signup_end_time?e.signup_end_time:t.end_time,[c,_]=d.split(":").map(Number),[m,p]=u.split(":").map(Number),f=60*m+p-(60*c+_);n[i][o].total_minutes+=f,n[i][o].shift_count++}let o=[];for(let[,e]of Object.entries(n)){let t={},s=0,i=0,a="",r="",n="";for(let[l,o]of Object.entries(e))t[l]={hours:Math.round(o.total_minutes/60*100)/100,shift_count:o.shift_count},s+=o.total_minutes,i+=o.shift_count,a=o.instructor_name,r=o.instructor_email,n=o.instructor_id;o.push({instructor_id:n,instructor_name:a,instructor_email:r,months:t,total_hours:Math.round(s/60*100)/100,total_shifts:i})}o.sort((e,t)=>e.instructor_name.localeCompare(t.instructor_name));let d=Array.from(l).sort();return R.NextResponse.json({success:!0,report:o,months:d,reportType:i})}default:return R.NextResponse.json({success:!1,error:"Invalid report type"},{status:400})}}catch(e){return console.error("Error generating report:",e),R.NextResponse.json({success:!1,error:"Failed to generate report"},{status:500})}}e.s(["GET",()=>x],656579);var b=e.i(656579);let E=new t.AppRouteRouteModule({definition:{kind:s.RouteKind.APP_ROUTE,page:"/api/scheduling/reports/route",pathname:"/api/scheduling/reports",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/.claude/worktrees/focused-goodall/app/api/scheduling/reports/route.ts",nextConfigOutput:"standalone",userland:b}),{workAsyncStorage:C,workUnitAsyncStorage:N,serverHooks:A}=E;function O(){return(0,i.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:N})}async function j(e,t,i){E.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let R="/api/scheduling/reports/route";R=R.replace(/\/index$/,"")||"/";let w=await E.prepare(e,t,{srcPage:R,multiZoneDraftMode:!1});if(!w)return t.statusCode=400,t.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:y,params:v,nextConfig:x,parsedUrl:b,isDraftMode:C,prerenderManifest:N,routerServerContext:A,isOnDemandRevalidate:O,revalidateOnlyGenerated:j,resolvedPathname:T,clientReferenceManifest:k,serverActionsManifest:S}=w,P=(0,l.normalizeAppPath)(R),q=!!(N.dynamicRoutes[P]||N.routes[T]),D=async()=>((null==A?void 0:A.render404)?await A.render404(e,t,b,!1):t.end("This page could not be found"),null);if(q&&!C){let e=!!N.routes[T],t=N.dynamicRoutes[P];if(t&&!1===t.fallback&&!e){if(x.experimental.adapterPath)return await D();throw new h.NoFallbackError}}let M=null;!q||E.isDev||C||(M="/index"===(M=T)?"/":M);let U=!0===E.isDev||!q,H=q&&!U;S&&k&&(0,n.setManifestsSingleton)({page:R,clientReferenceManifest:k,serverActionsManifest:S});let I=e.method||"GET",F=(0,r.getTracer)(),$=F.getActiveScopeSpan(),K={params:v,prerenderManifest:N,renderOpts:{experimental:{authInterrupts:!!x.experimental.authInterrupts},cacheComponents:!!x.cacheComponents,supportsDynamicResponse:U,incrementalCache:(0,a.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:x.cacheLife,waitUntil:i.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,s,i,a)=>E.onRequestError(e,t,i,a,A)},sharedContext:{buildId:y}},B=new o.NodeNextRequest(e),G=new o.NodeNextResponse(t),L=d.NextRequestAdapter.fromNodeNextRequest(B,(0,d.signalFromNodeResponse)(t));try{let n=async e=>E.handle(L,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let s=F.getRootSpanAttributes();if(!s)return;if(s.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${s.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=s.get("next.route");if(i){let t=`${I} ${i}`;e.setAttributes({"next.route":i,"http.route":i,"next.span_name":t}),e.updateName(t)}else e.updateName(`${I} ${R}`)}),l=!!(0,a.getRequestMeta)(e,"minimalMode"),o=async a=>{var r,o;let d=async({previousCacheEntry:s})=>{try{if(!l&&O&&j&&!s)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await n(a);e.fetchMetrics=K.renderOpts.fetchMetrics;let o=K.renderOpts.pendingWaitUntil;o&&i.waitUntil&&(i.waitUntil(o),o=void 0);let d=K.renderOpts.collectedTags;if(!q)return await (0,_.sendResponse)(B,G,r,K.renderOpts.pendingWaitUntil),null;{let e=await r.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(r.headers);d&&(t[f.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let s=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,i=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:g.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:s,expire:i}}}}catch(t){throw(null==s?void 0:s.isStale)&&await E.onRequestError(e,t,{routerKind:"App Router",routePath:R,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:O})},!1,A),t}},u=await E.handleResponse({req:e,nextConfig:x,cacheKey:M,routeKind:s.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:N,isRoutePPREnabled:!1,isOnDemandRevalidate:O,revalidateOnlyGenerated:j,responseGenerator:d,waitUntil:i.waitUntil,isMinimalMode:l});if(!q)return null;if((null==u||null==(r=u.value)?void 0:r.kind)!==g.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(o=u.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});l||t.setHeader("x-nextjs-cache",O?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),C&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let h=(0,m.fromNodeOutgoingHttpHeaders)(u.value.headers);return l&&q||h.delete(f.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||h.get("Cache-Control")||h.set("Cache-Control",(0,p.getCacheControlHeader)(u.cacheControl)),await (0,_.sendResponse)(B,G,new Response(u.value.body,{headers:h,status:u.value.status||200})),null};$?await o($):await F.withPropagatedContext(e.headers,()=>F.trace(u.BaseServerSpan.handleRequest,{spanName:`${I} ${R}`,kind:r.SpanKind.SERVER,attributes:{"http.method":I,"http.target":e.url}},o))}catch(t){if(t instanceof h.NoFallbackError||await E.onRequestError(e,t,{routerKind:"App Router",routePath:P,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:O})},!1,A),q)throw t;return await (0,_.sendResponse)(B,G,new Response(null,{status:500})),null}}e.s(["handler",()=>j,"patchFetch",()=>O,"routeModule",()=>E,"serverHooks",()=>A,"workAsyncStorage",()=>C,"workUnitAsyncStorage",()=>N],888367)}];

//# sourceMappingURL=e71d5_next_dist_esm_build_templates_app-route_2e6c4079.js.map