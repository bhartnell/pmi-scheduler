module.exports=[193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},604868,e=>{"use strict";let t=process.env.NEXTAUTH_URL||"https://pmiparamedic.tools",r={primary:"#1e3a5f",accent:"#2563eb",success:"#10b981",warning:"#f59e0b",error:"#dc2626",gray:{50:"#f9fafb",100:"#f3f4f6",200:"#e5e7eb",500:"#6b7280",700:"#374151",900:"#111827"}};function a(e,t,o=r.accent){return`
    <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${o}; border-radius: 6px;">
          <a href="${t}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${e}
          </a>
        </td>
      </tr>
    </table>
  `}function o(e,t=r.accent,a=r.gray[100]){return`
    <div style="background-color: ${a}; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid ${t};">
      ${e}
    </div>
  `}function n(e,t=2){return`
    <h${t} style="color: ${r.gray[900]}; margin: 0 0 ${2===t?"16px":"8px"} 0; font-size: ${({2:"20px",3:"18px"})[t]};">
      ${e}
    </h${t}>
  `}function s(e,t=!1){return`
    <p style="color: ${t?r.gray[500]:r.gray[700]}; margin: 0 0 16px 0; font-size: ${t?"14px":"16px"}; line-height: 1.5;">
      ${e}
    </p>
  `}function i(e,a){let o=a||`${t}/settings?tab=notifications`;return`
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
                      <a href="${o}" style="color: ${r.accent}; text-decoration: none;">
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
                      <a href="${o}" style="color: ${r.gray[500]}; text-decoration: underline;">update your preferences</a>.
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
`}e.s(["EMAIL_COLORS",0,r,"emailButton",()=>a,"emailContentBox",()=>o,"emailHeading",()=>n,"emailParagraph",()=>s,"wrapInEmailTemplate",()=>i])},454395,e=>{"use strict";var t=e.i(855644),r=e.i(604868),a=e.i(859727);let o=null,n=process.env.EMAIL_FROM||"PMI Paramedic Tools <notifications@pmiparamedic.tools>",s=process.env.NEXTAUTH_URL||"https://pmiparamedic.tools";function i(e,t,r="#2563eb"){return`
    <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${r}; border-radius: 6px;">
          <a href="${t}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${e}
          </a>
        </td>
      </tr>
    </table>
  `}let l={task_assigned:e=>({subject:`[PMI] Task assigned: ${e.title}`,html:`
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        New Task Assigned
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        <strong>${e.assignerName}</strong> has assigned you a new task:
      </p>
      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${e.title}
        </h3>
        ${e.description?`<p style="color: #6b7280; margin: 0; font-size: 14px;">${e.description}</p>`:""}
        ${e.dueDate?`<p style="color: #dc2626; margin: 8px 0 0 0; font-size: 14px;"><strong>Due:</strong> ${e.dueDate}</p>`:""}
      </div>
      ${i("View Task",`${s}/tasks/${e.taskId}`)}
    `}),task_completed:e=>({subject:`[PMI] Task completed: ${e.title}`,html:`
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Task Completed
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        <strong>${e.assigneeName}</strong> has completed the task:
      </p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981;">
        <h3 style="color: #111827; margin: 0; font-size: 18px;">
          ${e.title}
        </h3>
        ${e.completionNotes?`<p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;"><strong>Notes:</strong> ${e.completionNotes}</p>`:""}
      </div>
      ${i("View Task",`${s}/tasks/${e.taskId}`,"#10b981")}
    `}),shift_available:e=>({subject:`[PMI] New shift available: ${e.title}`,html:`
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        New Shift Available
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        A new shift has been posted that you may be interested in:
      </p>
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #3b82f6;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${e.title}
        </h3>
        <p style="color: #374151; margin: 0; font-size: 14px;">
          <strong>Date:</strong> ${e.date}<br>
          <strong>Time:</strong> ${e.startTime} - ${e.endTime}
        </p>
        ${e.location?`<p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;"><strong>Location:</strong> ${e.location}</p>`:""}
      </div>
      ${i("Sign Up for Shift",`${s}/scheduling/shifts`)}
    `}),shift_confirmed:e=>({subject:`[PMI] Shift confirmed: ${e.date}`,html:`
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Shift Signup Confirmed
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        Your signup for the following shift has been confirmed:
      </p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${e.title}
        </h3>
        <p style="color: #374151; margin: 0; font-size: 14px;">
          <strong>Date:</strong> ${e.date}<br>
          <strong>Time:</strong> ${e.startTime} - ${e.endTime}
        </p>
        ${e.location?`<p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;"><strong>Location:</strong> ${e.location}</p>`:""}
      </div>
      ${i("View My Schedule",`${s}/scheduling`,"#10b981")}
    `}),lab_assigned:e=>({subject:`[PMI] Lab assignment: ${e.labName}`,html:`
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Lab Assignment
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        You've been assigned to the following lab:
      </p>
      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${e.labName}
        </h3>
        <p style="color: #374151; margin: 0; font-size: 14px;">
          <strong>Date:</strong> ${e.date}<br>
          ${e.time?`<strong>Time:</strong> ${e.time}<br>`:""}
          ${e.role?`<strong>Role:</strong> ${e.role}`:""}
        </p>
      </div>
      ${i("View Lab Details",`${s}/lab-management/schedule`,"#f59e0b")}
    `}),lab_reminder:e=>({subject:`[PMI] Reminder: ${e.labName} tomorrow`,html:`
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Lab Reminder
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        This is a reminder that you have a lab assignment tomorrow:
      </p>
      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${e.labName}
        </h3>
        <p style="color: #374151; margin: 0; font-size: 14px;">
          <strong>Date:</strong> ${e.date}<br>
          ${e.time?`<strong>Time:</strong> ${e.time}<br>`:""}
          ${e.role?`<strong>Role:</strong> ${e.role}`:""}
        </p>
      </div>
      ${i("View Lab Details",`${s}/lab-management/schedule`,"#f59e0b")}
    `}),general:e=>({subject:`[PMI] ${e.subject||"Notification"}`,html:`
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        ${e.title||"Notification"}
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        ${e.message}
      </p>
      ${e.actionUrl?i(String(e.actionText||"View"),String(e.actionUrl)):""}
    `})};async function d(e){try{let t=(0,a.getSupabaseAdmin)();await t.from("email_log").insert({to_email:e.to,subject:e.subject,template:e.template,status:e.status,resend_id:e.resendId??null,error:e.error??null,sent_at:"sent"===e.status?new Date().toISOString():null})}catch(e){console.error("Failed to log email send:",e)}}async function p(e){let a=process.env.RESEND_API_KEY?(o||(o=new t.Resend(process.env.RESEND_API_KEY)),o):(console.warn("RESEND_API_KEY not configured - emails will not be sent"),null);if(!a)return{success:!0,id:"mock-"+Date.now()};try{let{subject:t,html:o}=(0,l[e.template])(e.data),i=`${s}/settings?tab=notifications`,p=(0,r.wrapInEmailTemplate)(o,i),{data:c,error:g}=await a.emails.send({from:n,to:e.to,subject:t,html:p});if(g)return console.error("Resend error:",g),await d({to:e.to,subject:t,template:e.template,status:"failed",error:g.message}),{success:!1,error:g.message};return await d({to:e.to,subject:t,template:e.template,status:"sent",resendId:c?.id}),{success:!0,id:c?.id}}catch(r){console.error("Email send error:",r);let t=r instanceof Error?r.message:"Unknown error";return await d({to:e.to,subject:`[PMI] ${e.template}`,template:e.template,status:"failed",error:t}),{success:!1,error:t}}}async function c(e,t){return p({to:e,subject:`[PMI] Task assigned: ${t.title}`,template:"task_assigned",data:t})}async function g(e,t){return p({to:e,subject:`[PMI] Task completed: ${t.title}`,template:"task_completed",data:t})}async function m(e,t){return p({to:e,subject:`[PMI] New shift available: ${t.title}`,template:"shift_available",data:t})}async function u(e,t){return p({to:e,subject:`[PMI] Lab assignment: ${t.labName}`,template:"lab_assigned",data:t})}async function f(e,t){return p({to:e,subject:`[PMI] Reminder: ${t.labName} tomorrow`,template:"lab_reminder",data:t})}e.s(["sendEmail",()=>p,"sendLabAssignedEmail",()=>u,"sendLabReminderEmail",()=>f,"sendShiftAvailableEmail",()=>m,"sendTaskAssignedEmail",()=>c,"sendTaskCompletedEmail",()=>g])},226831,e=>{"use strict";var t=e.i(356292),r=e.i(511587),a=e.i(658158),o=e.i(385772),n=e.i(755949),s=e.i(68611),i=e.i(722194),l=e.i(570712),d=e.i(268070),p=e.i(375339),c=e.i(663426),g=e.i(962412),m=e.i(413713),u=e.i(569873),f=e.i(413654),x=e.i(193695);e.i(689710);var h=e.i(770056),y=e.i(876908),b=e.i(859727),$=e.i(604868),R=e.i(454395);let w=process.env.NEXTAUTH_URL||"https://pmiparamedic.tools";async function E(e){let t=e.headers.get("authorization"),r=process.env.CRON_SECRET;if(r&&t!==`Bearer ${r}`)return console.warn("[LVFR-WEEKLY-REPORT] Unauthorized cron request"),y.NextResponse.json({error:"Unauthorized"},{status:401});let a=Date.now(),o=(0,b.getSupabaseAdmin)();try{let{data:e,error:t}=await o.from("lab_users").select("id, name, email, role, agency_affiliation").in("role",["agency_observer","agency_liaison"]);if(t)return console.error("[LVFR-WEEKLY-REPORT] Failed to fetch agency users:",t.message),y.NextResponse.json({error:"Failed to fetch users"},{status:500});if(!e||0===e.length)return y.NextResponse.json({success:!0,message:"No agency users",sent:0});let{data:r}=await o.from("lvfr_aemt_chapters").select("id, status"),n=r?.length||0,s=r?.filter(e=>"completed"===e.status).length||0,i=n>0?Math.round(s/n*100):0,{data:l}=await o.from("lvfr_aemt_course_days").select("id, day_number, date, status, has_exam, has_quiz, title").order("day_number",{ascending:!0}),d=l?.length||0,p=l?.filter(e=>"completed"===e.status).length||0,c=new Date().toISOString().split("T")[0],g=new Date(Date.now()+6048e5).toISOString().split("T")[0],m=(l||[]).filter(e=>e.date&&e.date>=c&&e.date<=g).slice(0,5),{data:u}=await o.from("cohorts").select("id").or("cohort_number.ilike.%LVFR%,cohort_number.ilike.%AEMT%"),f=u?.map(e=>e.id)||[],x=0,h=[],b=null;if(f.length>0){let{data:e}=await o.from("students").select("id, first_name, last_name, status").in("cohort_id",f).eq("status","active");if((x=e?.length||0)>0){let t=e.map(e=>e.id),{data:r}=await o.from("lvfr_aemt_grades").select("student_id, score_percent").in("student_id",t);if(r&&r.length>0){let t=r.reduce((e,t)=>e+(Number(t.score_percent)||0),0);b=Math.round(t/r.length);let a=new Map;for(let e of r){let t=a.get(e.student_id)||[];t.push(Number(e.score_percent)||0),a.set(e.student_id,t)}for(let[t,r]of a){let a=r.reduce((e,t)=>e+t,0)/r.length;if(a<80){let r=e.find(e=>e.id===t);r&&h.push(`${r.first_name} ${r.last_name} (${Math.round(a)}%)`)}}}}}let E=new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),v=m.length>0?m.map(e=>`<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid ${$.EMAIL_COLORS.gray[200]}; font-size: 14px;">Day ${e.day_number}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid ${$.EMAIL_COLORS.gray[200]}; font-size: 14px;">${e.date}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid ${$.EMAIL_COLORS.gray[200]}; font-size: 14px;">${e.title||"—"}${e.has_exam?" 📝":""}${e.has_quiz?" ❓":""}</td>
          </tr>`).join(""):'<tr><td colspan="3" style="padding: 12px; text-align: center; color: #6b7280;">No classes scheduled this week</td></tr>',_=h.length>0?`<div style="margin-top: 16px;">
          <h3 style="color: ${$.EMAIL_COLORS.error}; font-size: 16px; margin-bottom: 8px;">⚠️ Students Requiring Attention</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${h.map(e=>`<li style="font-size: 14px; margin-bottom: 4px;">${e}</li>`).join("")}
          </ul>
        </div>`:'<p style="color: #10b981; font-size: 14px;">✅ All students are currently on track.</p>',O=`
      <h2 style="color: ${$.EMAIL_COLORS.primary}; font-size: 20px; margin-bottom: 4px;">LVFR AEMT Weekly Progress Report</h2>
      <p style="color: ${$.EMAIL_COLORS.gray[500]}; font-size: 14px; margin-top: 0;">${E}</p>

      ${(0,$.emailContentBox)(`
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: ${$.EMAIL_COLORS.gray[900]};">Course Progress</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: ${$.EMAIL_COLORS.accent};">${i}%</span>
              <span style="color: ${$.EMAIL_COLORS.gray[500]}; font-size: 14px;"> (${s}/${n} chapters)</span>
            </td>
            <td style="padding: 8px 0;">
              <strong style="color: ${$.EMAIL_COLORS.gray[900]};">Days Completed</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: ${$.EMAIL_COLORS.accent};">${p}/${d}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: ${$.EMAIL_COLORS.gray[900]};">Students Enrolled</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: ${$.EMAIL_COLORS.accent};">${x}</span>
            </td>
            <td style="padding: 8px 0;">
              <strong style="color: ${$.EMAIL_COLORS.gray[900]};">Class Average</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: ${b&&b>=80?$.EMAIL_COLORS.success:$.EMAIL_COLORS.error};">${null!=b?`${b}%`:"N/A"}</span>
            </td>
          </tr>
        </table>
      `)}

      <h3 style="color: ${$.EMAIL_COLORS.gray[900]}; font-size: 16px; margin-top: 24px;">📅 Upcoming Week</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background-color: ${$.EMAIL_COLORS.gray[100]};">
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: ${$.EMAIL_COLORS.gray[500]};">Day</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: ${$.EMAIL_COLORS.gray[500]};">Date</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: ${$.EMAIL_COLORS.gray[500]};">Content</th>
          </tr>
        </thead>
        <tbody>
          ${v}
        </tbody>
      </table>

      ${_}

      <p style="color: ${$.EMAIL_COLORS.gray[500]}; font-size: 12px; margin-top: 24px;">
        This is an automated weekly report from the PMI Paramedic Tools LVFR AEMT module.
        Contact your program administrator to adjust reporting preferences.
      </p>
    `,k=0,L=0;for(let t of e)try{await (0,R.sendEmail)({to:t.email,subject:`LVFR AEMT Weekly Report — ${E}`,template:"general",data:{title:"LVFR AEMT Weekly Progress Report",message:O,actionUrl:`${w}/lvfr-aemt`,actionText:"View Dashboard"}}),k++}catch(e){console.error(`[LVFR-WEEKLY-REPORT] Failed to send to ${t.email}:`,e),L++}let A=Date.now()-a;return y.NextResponse.json({success:!0,sent:k,errors:L,duration_ms:A})}catch(e){return console.error("[LVFR-WEEKLY-REPORT] Unhandled error:",e),y.NextResponse.json({error:"Internal server error"},{status:500})}}e.s(["GET",()=>E],432743);var v=e.i(432743);let _=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/cron/lvfr-weekly-report/route",pathname:"/api/cron/lvfr-weekly-report",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/.claude/worktrees/focused-goodall/app/api/cron/lvfr-weekly-report/route.ts",nextConfigOutput:"standalone",userland:v}),{workAsyncStorage:O,workUnitAsyncStorage:k,serverHooks:L}=_;function A(){return(0,a.patchFetch)({workAsyncStorage:O,workUnitAsyncStorage:k})}async function I(e,t,a){_.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let y="/api/cron/lvfr-weekly-report/route";y=y.replace(/\/index$/,"")||"/";let b=await _.prepare(e,t,{srcPage:y,multiZoneDraftMode:!1});if(!b)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:$,params:R,nextConfig:w,parsedUrl:E,isDraftMode:v,prerenderManifest:O,routerServerContext:k,isOnDemandRevalidate:L,revalidateOnlyGenerated:A,resolvedPathname:I,clientReferenceManifest:T,serverActionsManifest:C}=b,M=(0,i.normalizeAppPath)(y),P=!!(O.dynamicRoutes[M]||O.routes[I]),S=async()=>((null==k?void 0:k.render404)?await k.render404(e,t,E,!1):t.end("This page could not be found"),null);if(P&&!v){let e=!!O.routes[I],t=O.dynamicRoutes[M];if(t&&!1===t.fallback&&!e){if(w.experimental.adapterPath)return await S();throw new x.NoFallbackError}}let z=null;!P||_.isDev||v||(z="/index"===(z=I)?"/":z);let N=!0===_.isDev||!P,j=P&&!N;C&&T&&(0,s.setManifestsSingleton)({page:y,clientReferenceManifest:T,serverActionsManifest:C});let D=e.method||"GET",U=(0,n.getTracer)(),q=U.getActiveScopeSpan(),F={params:R,prerenderManifest:O,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:N,incrementalCache:(0,o.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:w.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,o)=>_.onRequestError(e,t,a,o,k)},sharedContext:{buildId:$}},H=new l.NodeNextRequest(e),V=new l.NodeNextResponse(t),K=d.NextRequestAdapter.fromNodeNextRequest(H,(0,d.signalFromNodeResponse)(t));try{let s=async e=>_.handle(K,F).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=U.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${D} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${D} ${y}`)}),i=!!(0,o.getRequestMeta)(e,"minimalMode"),l=async o=>{var n,l;let d=async({previousCacheEntry:r})=>{try{if(!i&&L&&A&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await s(o);e.fetchMetrics=F.renderOpts.fetchMetrics;let l=F.renderOpts.pendingWaitUntil;l&&a.waitUntil&&(a.waitUntil(l),l=void 0);let d=F.renderOpts.collectedTags;if(!P)return await (0,g.sendResponse)(H,V,n,F.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(n.headers);d&&(t[f.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==F.renderOpts.collectedRevalidate&&!(F.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&F.renderOpts.collectedRevalidate,a=void 0===F.renderOpts.collectedExpire||F.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:F.renderOpts.collectedExpire;return{value:{kind:h.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await _.onRequestError(e,t,{routerKind:"App Router",routePath:y,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:L})},!1,k),t}},p=await _.handleResponse({req:e,nextConfig:w,cacheKey:z,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:O,isRoutePPREnabled:!1,isOnDemandRevalidate:L,revalidateOnlyGenerated:A,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:i});if(!P)return null;if((null==p||null==(n=p.value)?void 0:n.kind)!==h.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==p||null==(l=p.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});i||t.setHeader("x-nextjs-cache",L?"REVALIDATED":p.isMiss?"MISS":p.isStale?"STALE":"HIT"),v&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let x=(0,m.fromNodeOutgoingHttpHeaders)(p.value.headers);return i&&P||x.delete(f.NEXT_CACHE_TAGS_HEADER),!p.cacheControl||t.getHeader("Cache-Control")||x.get("Cache-Control")||x.set("Cache-Control",(0,u.getCacheControlHeader)(p.cacheControl)),await (0,g.sendResponse)(H,V,new Response(p.value.body,{headers:x,status:p.value.status||200})),null};q?await l(q):await U.withPropagatedContext(e.headers,()=>U.trace(p.BaseServerSpan.handleRequest,{spanName:`${D} ${y}`,kind:n.SpanKind.SERVER,attributes:{"http.method":D,"http.target":e.url}},l))}catch(t){if(t instanceof x.NoFallbackError||await _.onRequestError(e,t,{routerKind:"App Router",routePath:M,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:L})},!1,k),P)throw t;return await (0,g.sendResponse)(H,V,new Response(null,{status:500})),null}}e.s(["handler",()=>I,"patchFetch",()=>A,"routeModule",()=>_,"serverHooks",()=>L,"workAsyncStorage",()=>O,"workUnitAsyncStorage",()=>k],226831)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__70737a39._.js.map