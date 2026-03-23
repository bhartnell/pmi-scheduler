module.exports=[193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},604868,e=>{"use strict";let t=process.env.NEXTAUTH_URL||"https://pmiparamedic.tools",r={primary:"#1e3a5f",accent:"#2563eb",success:"#10b981",warning:"#f59e0b",error:"#dc2626",gray:{50:"#f9fafb",100:"#f3f4f6",200:"#e5e7eb",500:"#6b7280",700:"#374151",900:"#111827"}};function a(e,t,n=r.accent){return`
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
`}e.s(["EMAIL_COLORS",0,r,"emailButton",()=>a,"emailContentBox",()=>n,"emailHeading",()=>o,"emailParagraph",()=>i,"wrapInEmailTemplate",()=>s])},272920,e=>{e.v(t=>Promise.all(["server/chunks/[root-of-the-server]__a801940c._.js"].map(t=>e.l(t))).then(()=>t(855644)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__045d62fe._.js.map