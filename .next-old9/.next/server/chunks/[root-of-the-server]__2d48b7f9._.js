module.exports=[523165,e=>{"use strict";var t=e.i(859727),a=e.i(454395);let i={enabled:!0,mode:"immediate",digest_time:"08:00",categories:{tasks:!0,labs:!0,scheduling:!0,feedback:!0,clinical:!0,system:!0}};async function r(e){try{let a=(0,t.getSupabaseAdmin)(),{data:r,error:n}=await a.from("user_preferences").select("email_preferences").ilike("user_email",e).single();if(n||!r?.email_preferences)return i;return r.email_preferences}catch(e){return console.error("[EMAIL PREFS] Exception:",e),i}}async function n(e,t){let a=await r(e);return!!a.enabled&&"off"!==a.mode&&"daily_digest"!==a.mode&&"weekly_digest"!==a.mode&&(a.categories[t]??!1)}let s={task_assigned:"tasks",task_completed:"tasks",task_comment:"tasks",lab_assignment:"labs",lab_reminder:"labs",shift_available:"scheduling",shift_confirmed:"scheduling",feedback_new:"feedback",feedback_resolved:"feedback",clinical_hours:"clinical",compliance_due:"clinical",affiliation_expiry:"clinical",role_approved:"system",general:"system"};async function o({userEmail:e,title:a,message:i,type:r="general",category:n,linkUrl:o,referenceType:l,referenceId:c}){try{let d=(0,t.getSupabaseAdmin)(),m=n||s[r]||"system",{error:p}=await d.from("user_notifications").insert({user_email:e,title:a,message:i,type:r,category:m,link_url:o||null,reference_type:l||null,reference_id:c||null});if(p)throw p;return{success:!0}}catch(e){return console.error("Error creating notification:",e),{success:!1,error:e?.message}}}async function l(e){try{let a=(0,t.getSupabaseAdmin)(),i=e.map(e=>{let t=e.type||"general",a=e.category||s[t]||"system";return{user_email:e.userEmail,title:e.title,message:e.message,type:t,category:a,link_url:e.linkUrl||null,reference_type:e.referenceType||null,reference_id:e.referenceId||null}}),{error:r}=await a.from("user_notifications").insert(i);if(r)throw r;return{success:!0}}catch(e){return console.error("Error creating bulk notifications:",e),{success:!1,error:e?.message}}}async function c(e,t){let i=new Date(t.labDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});await o({userEmail:e,title:`Assigned to ${t.stationTitle}`,message:`You were assigned to a station for ${t.cohortName} on ${i}`,type:"lab_assignment",linkUrl:`/lab-management/grade/station/${t.stationId}`,referenceType:"lab_station",referenceId:t.stationId}),await n(e,"labs")&&await (0,a.sendLabAssignedEmail)(e,{labName:`${t.stationTitle} - ${t.cohortName}`,date:i,time:t.startTime?f(t.startTime):void 0,role:t.role})}async function d(e){try{let a=(0,t.getSupabaseAdmin)(),{data:i}=await a.from("lab_users").select("email").in("role",["admin","superadmin"]).eq("is_active",!0);if(!i||0===i.length)return;let r=i.map(t=>({userEmail:t.email,title:`New ${e.type} report`,message:`${e.submittedBy.split("@")[0]} submitted: ${e.title}`,type:"feedback_new",linkUrl:`/lab-management/admin/feedback?id=${e.feedbackId}`,referenceType:"feedback_report",referenceId:e.feedbackId}));await l(r)}catch(e){console.error("Error notifying admins of new feedback:",e)}}async function m(e,t){await o({userEmail:e,title:"Feedback resolved",message:`Your feedback "${t.title}" has been resolved`,type:"feedback_resolved",linkUrl:`/lab-management/admin/feedback?id=${t.feedbackId}`,referenceType:"feedback_report",referenceId:t.feedbackId})}async function p(e,t){let i=t.startTime?` at ${f(t.startTime)}`:"",r=new Date(t.labDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});await o({userEmail:e,title:"Lab reminder",message:`You have a lab tomorrow${i} - ${t.stationTitle} for ${t.cohortName}`,type:"lab_reminder",linkUrl:`/lab-management/grade/station/${t.stationId}`,referenceType:"lab_station",referenceId:t.stationId}),await n(e,"labs")&&await (0,a.sendLabReminderEmail)(e,{labName:`${t.stationTitle} - ${t.cohortName}`,date:r,time:t.startTime?f(t.startTime):void 0,role:t.role})}function f(e){let[t,a]=e.split(":"),i=parseInt(t,10);return`${i%12||12}:${a} ${i>=12?"PM":"AM"}`}async function g(e,t){try{await o({userEmail:e,title:"New task assigned",message:`${t.assignerName} assigned you a task: ${t.title}`,type:"task_assigned",linkUrl:`/tasks/${t.taskId}`,referenceType:"instructor_task",referenceId:t.taskId})}catch(t){console.error("[NOTIFY] In-app notification FAILED for:",e,t)}if(await n(e,"tasks"))try{await (0,a.sendTaskAssignedEmail)(e,{taskId:t.taskId,title:t.title,assignerName:t.assignerName,description:t.description,dueDate:t.dueDate})}catch(t){console.error("[NOTIFY] Email send FAILED for:",e,t)}}async function u(e,t){await o({userEmail:e,title:"Task completed",message:`${t.assigneeName} completed: ${t.title}`,type:"task_completed",linkUrl:`/tasks/${t.taskId}`,referenceType:"instructor_task",referenceId:t.taskId}),await n(e,"tasks")&&await (0,a.sendTaskCompletedEmail)(e,{taskId:t.taskId,title:t.title,assigneeName:t.assigneeName,completionNotes:t.completionNotes})}async function b(e,t){await o({userEmail:e,title:"New comment on task",message:`${t.commenterName} commented on: ${t.title}`,type:"task_comment",linkUrl:`/tasks/${t.taskId}`,referenceType:"instructor_task",referenceId:t.taskId})}async function y(e,t){var a;let i={superadmin:"Super Admin",admin:"Admin",lead_instructor:"Lead Instructor",instructor:"Instructor",program_director:"Program Director",guest:"Guest",pending:"Pending"}[a=t.newRole]||a;await o({userEmail:e,title:"Account approved!",message:`Your account has been approved. You now have ${i} access to PMI Tools.`,type:"role_approved",linkUrl:"/",referenceType:"lab_user",referenceId:t.userId})}async function h(e){try{let a=(0,t.getSupabaseAdmin)(),{data:i}=await a.from("lab_users").select("email").in("role",["admin","superadmin"]).eq("is_active",!0);if(!i||0===i.length)return;let r=i.map(t=>({userEmail:t.email,title:"New user pending approval",message:`${e.name} (${e.email}) signed up and needs role assignment`,type:"general",linkUrl:"/admin/users",referenceType:"lab_user",referenceId:e.userId}));await l(r)}catch(e){console.error("Error notifying admins of new pending user:",e)}}async function x(e){try{let a=(0,t.getSupabaseAdmin)(),{data:i,error:r}=await a.from("lab_users").select("email, name").eq("is_active",!0).or("is_part_time.eq.true,role.eq.volunteer_instructor");if(r||!i)return console.error("[SHIFT RECIPIENTS] Error fetching eligible users:",r),[];let n=["timer","shared","generic","test","noreply","no-reply"];return i.filter(t=>{let a=t.email.toLowerCase();return!n.some(e=>a.includes(e))&&(!e||a!==e.toLowerCase())})}catch(e){return console.error("[SHIFT RECIPIENTS] Exception:",e),[]}}let k={superadmin:{tasks:!0,labs:!0,scheduling:!0,feedback:!0,clinical:!0,system:!0},admin:{tasks:!0,labs:!0,scheduling:!0,feedback:!0,clinical:!0,system:!0},lead_instructor:{tasks:!0,labs:!0,scheduling:!0,feedback:!0,clinical:!0,system:!0},instructor:{tasks:!0,labs:!0,scheduling:!0,feedback:!1,clinical:!1,system:!0},volunteer_instructor:{tasks:!1,labs:!1,scheduling:!0,feedback:!1,clinical:!1,system:!0},program_director:{tasks:!1,labs:!1,scheduling:!1,feedback:!1,clinical:!0,system:!0},student:{tasks:!0,labs:!0,scheduling:!1,feedback:!1,clinical:!1,system:!0},guest:{tasks:!1,labs:!0,scheduling:!1,feedback:!1,clinical:!1,system:!0},pending:{tasks:!1,labs:!1,scheduling:!1,feedback:!1,clinical:!1,system:!0}},$={superadmin:"immediate",admin:"immediate",lead_instructor:"immediate",instructor:"immediate",volunteer_instructor:"immediate",program_director:"immediate",student:"immediate",guest:"off",pending:"off"};async function _(e,a){try{let i=(0,t.getSupabaseAdmin)(),r=k[a]||k.guest,n=$[a]||"immediate",s={category_preferences:r,email_lab_assignments:r.labs??!0,email_lab_reminders:r.labs??!0,email_feedback_updates:r.feedback??!1,show_desktop_notifications:!1,notification_sound:!1},{data:o}=await i.from("user_preferences").select("user_email").eq("user_email",e).single();if(o)return;let{error:l}=await i.from("user_preferences").insert({user_email:e,notification_settings:s,email_preferences:{enabled:"off"!==n,mode:n,digest_time:"08:00",categories:r},updated_at:new Date().toISOString()});if(l){if("23505"===l.code)return;console.error("[DEFAULT PREFS] Error inserting default preferences:",l)}}catch(e){console.error("[DEFAULT PREFS] Exception inserting default preferences:",e)}}async function w(e,a){try{let i=(0,t.getSupabaseAdmin)(),r=k[a]||k.guest,n=$[a]||"immediate",{data:s}=await i.from("user_preferences").select("notification_settings, email_preferences").eq("user_email",e).single();if(!s)return void await _(e,a);let o=s.notification_settings?.category_preferences,l=k.pending;if(!o||JSON.stringify(o)===JSON.stringify(l)){let t={...s.notification_settings||{},category_preferences:r,email_lab_assignments:r.labs??!0,email_lab_reminders:r.labs??!0,email_feedback_updates:r.feedback??!1};await i.from("user_preferences").update({notification_settings:t,email_preferences:{enabled:"off"!==n,mode:n,digest_time:"08:00",categories:r},updated_at:new Date().toISOString()}).eq("user_email",e)}}catch(e){console.error("[DEFAULT PREFS] Exception updating preferences for role change:",e)}}e.s(["TYPE_TO_CATEGORY",0,s,"createBulkNotifications",()=>l,"createNotification",()=>o,"getEligibleShiftRecipients",()=>x,"insertDefaultNotificationPreferences",()=>_,"notifyAdminsNewFeedback",()=>d,"notifyAdminsNewPendingUser",()=>h,"notifyFeedbackResolved",()=>m,"notifyInstructorAssigned",()=>c,"notifyLabReminder",()=>p,"notifyRoleApproved",()=>y,"notifyTaskAssigned",()=>g,"notifyTaskComment",()=>b,"notifyTaskCompleted",()=>u,"updatePreferencesForRoleChange",()=>w])},193695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},604868,e=>{"use strict";let t=process.env.NEXTAUTH_URL||"https://pmiparamedic.tools",a={primary:"#1e3a5f",accent:"#2563eb",success:"#10b981",warning:"#f59e0b",error:"#dc2626",gray:{50:"#f9fafb",100:"#f3f4f6",200:"#e5e7eb",500:"#6b7280",700:"#374151",900:"#111827"}};function i(e,t,r=a.accent){return`
    <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${r}; border-radius: 6px;">
          <a href="${t}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${e}
          </a>
        </td>
      </tr>
    </table>
  `}function r(e,t=a.accent,i=a.gray[100]){return`
    <div style="background-color: ${i}; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid ${t};">
      ${e}
    </div>
  `}function n(e,t=2){return`
    <h${t} style="color: ${a.gray[900]}; margin: 0 0 ${2===t?"16px":"8px"} 0; font-size: ${({2:"20px",3:"18px"})[t]};">
      ${e}
    </h${t}>
  `}function s(e,t=!1){return`
    <p style="color: ${t?a.gray[500]:a.gray[700]}; margin: 0 0 16px 0; font-size: ${t?"14px":"16px"}; line-height: 1.5;">
      ${e}
    </p>
  `}function o(e,i){let r=i||`${t}/settings?tab=notifications`;return`
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
<body style="margin: 0; padding: 0; background-color: ${a.gray[100]}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <!-- Preheader text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    PMI Paramedic Tools Notification
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: ${a.gray[100]}; padding: 20px 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td class="email-header" style="background-color: ${a.primary}; padding: 24px; text-align: center;">
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
            <td class="email-footer" style="background-color: ${a.gray[50]}; padding: 24px; border-top: 1px solid ${a.gray[200]};">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="color: ${a.gray[500]}; font-size: 12px; text-align: center; line-height: 1.6;">
                    <p style="margin: 0 0 8px 0;">
                      Pima Medical Institute &mdash; Paramedic Program
                    </p>
                    <p style="margin: 0 0 8px 0;">
                      <a href="${r}" style="color: ${a.accent}; text-decoration: none;">
                        Manage your notification preferences
                      </a>
                      &nbsp;&bull;&nbsp;
                      <a href="${t}" style="color: ${a.accent}; text-decoration: none;">
                        Open PMI Tools
                      </a>
                    </p>
                    <p style="margin: 0; color: ${a.gray[500]}; font-size: 11px;">
                      You received this email because you have notifications enabled
                      for your PMI Paramedic Tools account. To stop receiving emails,
                      <a href="${r}" style="color: ${a.gray[500]}; text-decoration: underline;">update your preferences</a>.
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
`}e.s(["EMAIL_COLORS",0,a,"emailButton",()=>i,"emailContentBox",()=>r,"emailHeading",()=>n,"emailParagraph",()=>s,"wrapInEmailTemplate",()=>o])},454395,e=>{"use strict";var t=e.i(855644),a=e.i(604868),i=e.i(859727);let r=null,n=process.env.EMAIL_FROM||"PMI Paramedic Tools <notifications@pmiparamedic.tools>",s=process.env.NEXTAUTH_URL||"https://pmiparamedic.tools";function o(e,t,a="#2563eb"){return`
    <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${a}; border-radius: 6px;">
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
      ${o("View Task",`${s}/tasks/${e.taskId}`)}
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
      ${o("View Task",`${s}/tasks/${e.taskId}`,"#10b981")}
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
      ${o("Sign Up for Shift",`${s}/scheduling/shifts`)}
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
      ${o("View My Schedule",`${s}/scheduling`,"#10b981")}
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
      ${o("View Lab Details",`${s}/lab-management/schedule`,"#f59e0b")}
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
      ${o("View Lab Details",`${s}/lab-management/schedule`,"#f59e0b")}
    `}),general:e=>({subject:`[PMI] ${e.subject||"Notification"}`,html:`
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        ${e.title||"Notification"}
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        ${e.message}
      </p>
      ${e.actionUrl?o(String(e.actionText||"View"),String(e.actionUrl)):""}
    `})};async function c(e){try{let t=(0,i.getSupabaseAdmin)();await t.from("email_log").insert({to_email:e.to,subject:e.subject,template:e.template,status:e.status,resend_id:e.resendId??null,error:e.error??null,sent_at:"sent"===e.status?new Date().toISOString():null})}catch(e){console.error("Failed to log email send:",e)}}async function d(e){let i=process.env.RESEND_API_KEY?(r||(r=new t.Resend(process.env.RESEND_API_KEY)),r):(console.warn("RESEND_API_KEY not configured - emails will not be sent"),null);if(!i)return{success:!0,id:"mock-"+Date.now()};try{let{subject:t,html:r}=(0,l[e.template])(e.data),o=`${s}/settings?tab=notifications`,d=(0,a.wrapInEmailTemplate)(r,o),{data:m,error:p}=await i.emails.send({from:n,to:e.to,subject:t,html:d});if(p)return console.error("Resend error:",p),await c({to:e.to,subject:t,template:e.template,status:"failed",error:p.message}),{success:!1,error:p.message};return await c({to:e.to,subject:t,template:e.template,status:"sent",resendId:m?.id}),{success:!0,id:m?.id}}catch(a){console.error("Email send error:",a);let t=a instanceof Error?a.message:"Unknown error";return await c({to:e.to,subject:`[PMI] ${e.template}`,template:e.template,status:"failed",error:t}),{success:!1,error:t}}}async function m(e,t){return d({to:e,subject:`[PMI] Task assigned: ${t.title}`,template:"task_assigned",data:t})}async function p(e,t){return d({to:e,subject:`[PMI] Task completed: ${t.title}`,template:"task_completed",data:t})}async function f(e,t){return d({to:e,subject:`[PMI] New shift available: ${t.title}`,template:"shift_available",data:t})}async function g(e,t){return d({to:e,subject:`[PMI] Lab assignment: ${t.labName}`,template:"lab_assigned",data:t})}async function u(e,t){return d({to:e,subject:`[PMI] Reminder: ${t.labName} tomorrow`,template:"lab_reminder",data:t})}e.s(["sendEmail",()=>d,"sendLabAssignedEmail",()=>g,"sendLabReminderEmail",()=>u,"sendShiftAvailableEmail",()=>f,"sendTaskAssignedEmail",()=>m,"sendTaskCompletedEmail",()=>p])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__2d48b7f9._.js.map