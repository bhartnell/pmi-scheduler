module.exports=[918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},604868,e=>{"use strict";let t=process.env.NEXTAUTH_URL||"https://pmiparamedic.tools",r={primary:"#1e3a5f",accent:"#2563eb",success:"#10b981",warning:"#f59e0b",error:"#dc2626",gray:{50:"#f9fafb",100:"#f3f4f6",200:"#e5e7eb",500:"#6b7280",700:"#374151",900:"#111827"}};function a(e,t,n=r.accent){return`
    <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${n}; border-radius: 6px;">
          <a href="${t}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${e}
          </a>
        </td>
      </tr>
    </table>
  `}function n(e,t=r.accent,a=r.gray[100]){return`
    <div style="background-color: ${a}; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid ${t};">
      ${e}
    </div>
  `}function o(e,t=2){return`
    <h${t} style="color: ${r.gray[900]}; margin: 0 0 ${2===t?"16px":"8px"} 0; font-size: ${({2:"20px",3:"18px"})[t]};">
      ${e}
    </h${t}>
  `}function i(e,t=!1){return`
    <p style="color: ${t?r.gray[500]:r.gray[700]}; margin: 0 0 16px 0; font-size: ${t?"14px":"16px"}; line-height: 1.5;">
      ${e}
    </p>
  `}function s(e,a){let n=a||`${t}/settings?tab=notifications`;return`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>PMI Paramedic Tools</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }

    /* Mobile responsive */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-content { padding: 24px 16px !important; }
      .email-header { padding: 20px 16px !important; }
      .email-footer { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${r.gray[100]}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <!-- Preheader text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    PMI Paramedic Tools Notification
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: ${r.gray[100]}; padding: 20px 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td class="email-header" style="background-color: ${r.primary}; padding: 24px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">
                      PMI Paramedic Tools
                    </h1>
                    <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0 0; font-size: 12px; font-weight: 400;">
                      Pima Medical Institute &mdash; Paramedic Program
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="email-content" style="padding: 32px 24px;">
              ${e}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background-color: ${r.gray[50]}; padding: 24px; border-top: 1px solid ${r.gray[200]};">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="color: ${r.gray[500]}; font-size: 12px; text-align: center; line-height: 1.6;">
                    <p style="margin: 0 0 8px 0;">
                      Pima Medical Institute &mdash; Paramedic Program
                    </p>
                    <p style="margin: 0 0 8px 0;">
                      <a href="${n}" style="color: ${r.accent}; text-decoration: none;">
                        Manage your notification preferences
                      </a>
                      &nbsp;&bull;&nbsp;
                      <a href="${t}" style="color: ${r.accent}; text-decoration: none;">
                        Open PMI Tools
                      </a>
                    </p>
                    <p style="margin: 0; color: ${r.gray[500]}; font-size: 11px;">
                      You received this email because you have notifications enabled
                      for your PMI Paramedic Tools account. To stop receiving emails,
                      <a href="${n}" style="color: ${r.gray[500]}; text-decoration: underline;">update your preferences</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`}e.s(["EMAIL_COLORS",0,r,"emailButton",()=>a,"emailContentBox",()=>n,"emailHeading",()=>o,"emailParagraph",()=>i,"wrapInEmailTemplate",()=>s])},94080,e=>{"use strict";var t=e.i(876908),r=e.i(859727),a=e.i(604868);let n=process.env.NEXTAUTH_URL||"https://pmiparamedic.tools",o={labs:{label:"Lab Assignments",icon:"&#129514;",color:a.EMAIL_COLORS.warning,bgColor:"#fef3c7",borderColor:a.EMAIL_COLORS.warning,description:"New assignments and upcoming labs"},tasks:{label:"Tasks",icon:"&#128203;",color:a.EMAIL_COLORS.accent,bgColor:"#eff6ff",borderColor:a.EMAIL_COLORS.accent,description:"New tasks assigned and tasks due soon"},scheduling:{label:"Scheduling",icon:"&#128197;",color:a.EMAIL_COLORS.success,bgColor:"#ecfdf5",borderColor:a.EMAIL_COLORS.success,description:"New shifts available and signup confirmations"},feedback:{label:"Feedback",icon:"&#128172;",color:"#8b5cf6",bgColor:"#f5f3ff",borderColor:"#8b5cf6",description:"New reports and status changes"},clinical:{label:"Clinical",icon:"&#9877;&#65039;",color:a.EMAIL_COLORS.error,bgColor:"#fef2f2",borderColor:a.EMAIL_COLORS.error,description:"Hours updates, compliance due dates, and site visit reminders"},system:{label:"System",icon:"&#9881;&#65039;",color:a.EMAIL_COLORS.gray[500],bgColor:a.EMAIL_COLORS.gray[50],borderColor:a.EMAIL_COLORS.gray[200],description:"Account and system updates"}},i=["labs","tasks","scheduling","feedback","clinical","system"];function s(e,t){let r=o[e],i=t.length,s=t.map(e=>{let t=e.link_url?`<a href="${n}${e.link_url}" style="color: ${r.color}; text-decoration: none; font-weight: 600;">${d(e.title)}</a>`:`<strong style="color: ${a.EMAIL_COLORS.gray[900]};">${d(e.title)}</strong>`;return`
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${a.EMAIL_COLORS.gray[200]}; vertical-align: top;">
            <p style="margin: 0 0 2px 0; font-size: 14px; color: ${a.EMAIL_COLORS.gray[900]};">
              ${t}
            </p>
            <p style="margin: 0; font-size: 13px; color: ${a.EMAIL_COLORS.gray[500]};">
              ${d(e.message)}
            </p>
          </td>
        </tr>
      `}).join("");return`
    <div style="margin: 0 0 24px 0;">
      <div style="background-color: ${r.bgColor}; border-left: 4px solid ${r.borderColor}; border-radius: 4px; padding: 10px 14px; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; color: ${a.EMAIL_COLORS.gray[900]}; font-weight: 600;">
          ${r.icon}&nbsp; ${r.label}
          <span style="font-size: 13px; font-weight: normal; color: ${a.EMAIL_COLORS.gray[500]}; margin-left: 6px;">(${i} new)</span>
        </h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${a.EMAIL_COLORS.gray[500]};">
          ${r.description}
        </p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          ${s}
        </tbody>
      </table>
    </div>
  `}function l(e,t,r){let o=new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),l="weekly"===r,d={};for(let r of e){let e=r.category;t.includes(e)&&(d[e]||(d[e]=[]),d[e].push(r))}let c=i.filter(e=>d[e]&&d[e].length>0);if(0===c.length)return"";let p=c.reduce((e,t)=>e+(d[t]?.length??0),0),u=c.map(e=>s(e,d[e])).join("");return`
    <h2 style="color: ${a.EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 22px; font-weight: bold;">
      ${l?"Your Weekly Summary":"Your Daily Digest"}
    </h2>
    <p style="color: ${a.EMAIL_COLORS.gray[500]}; margin: 0 0 24px 0; font-size: 14px;">
      ${o}
    </p>
    <p style="color: ${a.EMAIL_COLORS.gray[700]}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.5;">
      Here's a summary of
      <strong>${p} notification${1!==p?"s":""}</strong>
      from ${l?"the past week":"the last 24 hours"}:
    </p>

    ${u}

    <hr style="border: none; border-top: 1px solid ${a.EMAIL_COLORS.gray[200]}; margin: 24px 0;">

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align: center; padding: 8px 0;">
          <a href="${n}/notifications" style="color: ${a.EMAIL_COLORS.accent}; text-decoration: none; font-size: 14px;">
            View all notifications
          </a>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
      <tr>
        <td style="text-align: center; padding: 12px 0; background-color: ${a.EMAIL_COLORS.gray[50]}; border-radius: 6px;">
          <p style="margin: 0; font-size: 13px; color: ${a.EMAIL_COLORS.gray[500]};">
            <a href="${n}/settings?tab=notifications" style="color: ${a.EMAIL_COLORS.accent}; text-decoration: none;">
              Manage your notification preferences
            </a>
          </p>
        </td>
      </tr>
    </table>
  `}function d(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}async function c(t,r,o){let{user_email:i,email_preferences:s}=r,d=Object.keys(s.categories).filter(e=>!0===s.categories[e]);if(0===d.length)return"skipped";let c="weekly"===o?168:24,p=new Date(Date.now()-60*c*6e4).toISOString(),{data:u,error:g}=await t.from("user_notifications").select("id, title, message, link_url, category, created_at").eq("user_email",i).eq("is_read",!1).is("digest_sent_at",null).gte("created_at",p).order("created_at",{ascending:!1});if(g)throw Error(`DB query failed for ${i}: ${g.message}`);if(!u||0===u.length)return"skipped";let m=l(u,d,o);if(!m)return"skipped";let f=`${n}/settings?tab=notifications`,x=(0,a.wrapInEmailTemplate)(m,f),{Resend:y}=await e.A(272920),h=process.env.RESEND_API_KEY?new y(process.env.RESEND_API_KEY):null,b=process.env.EMAIL_FROM||"PMI Paramedic Tools <notifications@pmiparamedic.tools>",w=new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),R="weekly"===o?`[PMI] Weekly Summary - ${w}`:`[PMI] Daily Digest - ${w}`;if(h){let{error:e}=await h.emails.send({from:b,to:i,subject:R,html:x});if(e)throw Error(`Resend error for ${i}: ${e.message}`)}let E=u.map(e=>e.id),$=new Date().toISOString(),{error:_}=await t.from("user_notifications").update({digest_sent_at:$}).in("id",E);_&&console.error(`[DIGEST] Failed to mark notifications as digest_sent for ${i}:`,_.message);let O="weekly"===o?"weekly_digest":"daily_digest";return await t.from("email_log").insert({to_email:i,subject:R,template:O,status:"sent",sent_at:$}),"sent"}async function p(e,a){let n=e.headers.get("authorization"),o=process.env.CRON_SECRET;if(o&&n!==`Bearer ${o}`)return console.warn(`[DIGEST] Unauthorized ${a} cron request`),t.NextResponse.json({error:"Unauthorized"},{status:401});let i=Date.now(),s=(0,r.getSupabaseAdmin)(),l="weekly"===a?"weekly_digest":"daily_digest",{data:d,error:p}=await s.from("user_preferences").select("user_email, email_preferences").eq("email_preferences->>mode",l).eq("email_preferences->>enabled","true");if(p)return console.error(`[DIGEST] Failed to query ${a} digest users:`,p.message),t.NextResponse.json({error:`Failed to query ${a} digest users`,detail:p.message},{status:500});if(!d||0===d.length)return t.NextResponse.json({success:!0,mode:a,processed:0,sent:0,skipped:0,errors:[],duration_ms:Date.now()-i});let u=await Promise.allSettled(d.map(e=>c(s,e,a))),g=0,m=0,f=[];u.forEach((e,t)=>{let r=d[t]?.user_email??`user[${t}]`;if("fulfilled"===e.status)"sent"===e.value?g++:m++;else{let t=e.reason instanceof Error?e.reason.message:String(e.reason);console.error(`[DIGEST] Error processing ${r}:`,t),f.push(`${r}: ${t}`)}});let x={success:!0,mode:a,processed:d.length,sent:g,skipped:m,errors:f,duration_ms:Date.now()-i};return t.NextResponse.json(x)}async function u(e){return p(e,"daily")}e.s(["CATEGORY_META",()=>o,"CATEGORY_ORDER",()=>i,"GET",()=>u,"buildCategorySection",()=>s,"escapeHtml",()=>d,"generateDigestHtml",()=>l,"processDigest",()=>p])},577689,e=>{"use strict";var t=e.i(356292),r=e.i(511587),a=e.i(658158),n=e.i(385772),o=e.i(755949),i=e.i(68611),s=e.i(156149),l=e.i(570712),d=e.i(268070),c=e.i(375339),p=e.i(663426),u=e.i(962412),g=e.i(413713),m=e.i(569873),f=e.i(413654),x=e.i(193695);e.i(689710);var y=e.i(770056),h=e.i(94080);async function b(e){return(0,h.processDigest)(e,"weekly")}e.s(["GET",()=>b],317003);var w=e.i(317003);let R=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/cron/weekly-digest/route",pathname:"/api/cron/weekly-digest",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/.claude/worktrees/focused-goodall/app/api/cron/weekly-digest/route.ts",nextConfigOutput:"standalone",userland:w}),{workAsyncStorage:E,workUnitAsyncStorage:$,serverHooks:_}=R;function O(){return(0,a.patchFetch)({workAsyncStorage:E,workUnitAsyncStorage:$})}async function C(e,t,a){R.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let h="/api/cron/weekly-digest/route";h=h.replace(/\/index$/,"")||"/";let b=await R.prepare(e,t,{srcPage:h,multiZoneDraftMode:!1});if(!b)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:w,params:E,nextConfig:$,parsedUrl:_,isDraftMode:O,prerenderManifest:C,routerServerContext:v,isOnDemandRevalidate:S,revalidateOnlyGenerated:k,resolvedPathname:A,clientReferenceManifest:I,serverActionsManifest:L}=b,M=(0,s.normalizeAppPath)(h),P=!!(C.dynamicRoutes[M]||C.routes[A]),T=async()=>((null==v?void 0:v.render404)?await v.render404(e,t,_,!1):t.end("This page could not be found"),null);if(P&&!O){let e=!!C.routes[A],t=C.dynamicRoutes[M];if(t&&!1===t.fallback&&!e){if($.experimental.adapterPath)return await T();throw new x.NoFallbackError}}let D=null;!P||R.isDev||O||(D="/index"===(D=A)?"/":D);let N=!0===R.isDev||!P,q=P&&!N;L&&I&&(0,i.setManifestsSingleton)({page:h,clientReferenceManifest:I,serverActionsManifest:L});let j=e.method||"GET",H=(0,o.getTracer)(),U=H.getActiveScopeSpan(),z={params:E,prerenderManifest:C,renderOpts:{experimental:{authInterrupts:!!$.experimental.authInterrupts},cacheComponents:!!$.cacheComponents,supportsDynamicResponse:N,incrementalCache:(0,n.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:$.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>R.onRequestError(e,t,a,n,v)},sharedContext:{buildId:w}},F=new l.NodeNextRequest(e),G=new l.NodeNextResponse(t),B=d.NextRequestAdapter.fromNodeNextRequest(F,(0,d.signalFromNodeResponse)(t));try{let i=async e=>R.handle(B,z).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=H.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==c.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${j} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${j} ${h}`)}),s=!!(0,n.getRequestMeta)(e,"minimalMode"),l=async n=>{var o,l;let d=async({previousCacheEntry:r})=>{try{if(!s&&S&&k&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let o=await i(n);e.fetchMetrics=z.renderOpts.fetchMetrics;let l=z.renderOpts.pendingWaitUntil;l&&a.waitUntil&&(a.waitUntil(l),l=void 0);let d=z.renderOpts.collectedTags;if(!P)return await (0,u.sendResponse)(F,G,o,z.renderOpts.pendingWaitUntil),null;{let e=await o.blob(),t=(0,g.toNodeOutgoingHttpHeaders)(o.headers);d&&(t[f.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==z.renderOpts.collectedRevalidate&&!(z.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&z.renderOpts.collectedRevalidate,a=void 0===z.renderOpts.collectedExpire||z.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:z.renderOpts.collectedExpire;return{value:{kind:y.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await R.onRequestError(e,t,{routerKind:"App Router",routePath:h,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:S})},!1,v),t}},c=await R.handleResponse({req:e,nextConfig:$,cacheKey:D,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:S,revalidateOnlyGenerated:k,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:s});if(!P)return null;if((null==c||null==(o=c.value)?void 0:o.kind)!==y.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(l=c.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});s||t.setHeader("x-nextjs-cache",S?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),O&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let x=(0,g.fromNodeOutgoingHttpHeaders)(c.value.headers);return s&&P||x.delete(f.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||x.get("Cache-Control")||x.set("Cache-Control",(0,m.getCacheControlHeader)(c.cacheControl)),await (0,u.sendResponse)(F,G,new Response(c.value.body,{headers:x,status:c.value.status||200})),null};U?await l(U):await H.withPropagatedContext(e.headers,()=>H.trace(c.BaseServerSpan.handleRequest,{spanName:`${j} ${h}`,kind:o.SpanKind.SERVER,attributes:{"http.method":j,"http.target":e.url}},l))}catch(t){if(t instanceof x.NoFallbackError||await R.onRequestError(e,t,{routerKind:"App Router",routePath:M,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:S})},!1,v),P)throw t;return await (0,u.sendResponse)(F,G,new Response(null,{status:500})),null}}e.s(["handler",()=>C,"patchFetch",()=>O,"routeModule",()=>R,"serverHooks",()=>_,"workAsyncStorage",()=>E,"workUnitAsyncStorage",()=>$],577689)},272920,e=>{e.v(t=>Promise.all(["server/chunks/[root-of-the-server]__a801940c._.js"].map(t=>e.l(t))).then(()=>t(855644)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__91656a5a._.js.map