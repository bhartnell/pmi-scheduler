module.exports=[960807,a=>{"use strict";let b=(0,a.i(89592).default)("refresh-cw",[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]);a.s(["RefreshCw",()=>b],960807)},288774,a=>{"use strict";let b=(0,a.i(89592).default)("download",[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]]);a.s(["Download",()=>b],288774)},943103,a=>{"use strict";let b=(0,a.i(89592).default)("trash-2",[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]]);a.s(["Trash2",()=>b],943103)},292247,a=>{"use strict";var b=a.i(326363),c=a.i(389305),d=a.i(731590),e=a.i(305942),f=a.i(326786);let g={"":"Home","lab-management":"Lab Management","lab-management/schedule":"Schedule","lab-management/scenarios":"Scenarios","lab-management/skill-sheets":"Skill Sheets","lab-management/skill-drills":"Skill Drills","lab-management/templates":"Templates","lab-management/students":"Students","lab-management/cohorts":"Cohorts","lab-management/reports":"Reports","lab-management/admin":"Lab Admin","lab-management/seating":"Seating","lab-management/grade":"Grading","lab-management/peer-evals":"Peer Evaluations","lab-management/mentorship":"Mentorship","lab-management/skills":"Skills","lab-management/skills/competencies":"Competencies","lab-management/debrief-review":"Debrief Review",clinical:"Clinical","clinical/internships":"Internships","clinical/hours":"Clinical Hours","clinical/preceptors":"Preceptors","clinical/compliance":"Compliance","clinical/site-visits":"Site Visits","clinical/summative-evaluations":"Summative Evaluations","clinical/affiliations":"Affiliations","clinical/agencies":"Agencies",scheduling:"Scheduling","scheduling/availability":"Availability","scheduling/shifts":"Shifts","scheduling/reports":"Reports",tasks:"Tasks",admin:"Admin","admin/users":"Users","admin/osce-events":"OSCE Events","admin/osce-observers":"OSCE Observers","admin/settings":"Settings","admin/scenarios":"Scenarios","admin/scenarios/bulk-import":"Bulk Import",instructor:"Instructor Portal",calendar:"Calendar",settings:"Settings",notifications:"Notifications",resources:"Resources","clinical/site-visit-settings":"Alert Settings",cases:"Case Studies","cases/leaderboard":"Leaderboard","cases/new":"New Case","cases/session":"Session","admin/cases":"Cases","admin/cases/generate":"Case Generation","admin/external-access":"External Access","admin/ferpa-compliance":"FERPA Compliance","admin/compliance":"Compliance","lvfr-aemt":"LVFR AEMT","lvfr-aemt/calendar":"Course Calendar","lvfr-aemt/scheduling":"Coverage Grid","lvfr-aemt/pharm":"Pharmacology","lvfr-aemt/grades":"Gradebook","lvfr-aemt/grades/import":"CSV Import","lvfr-aemt/skills":"Skills Tracking","lvfr-aemt/files":"Course Materials"};function h({entityTitle:a,customSegments:h,className:i}){let j=(0,d.usePathname)().split("/").filter(Boolean),k=[];k.push({label:"Home",href:"/",isCurrent:0===j.length});for(let b=0;b<j.length;b++){let c=j.slice(0,b+1).join("/"),d="/"+c,e=b===j.length-1,f=j[b];if(h?.[c])k.push({label:h[c],href:d,isCurrent:e});else if(h?.[f])k.push({label:h[f],href:d,isCurrent:e});else if(g[c])k.push({label:g[c],href:d,isCurrent:e});else if("new"===f)k.push({label:"New",href:d,isCurrent:e});else if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f)||/^\d+$/.test(f)||/^[0-9a-f]{16,}$/i.test(f)?0:1){let a=f.split("-").map(a=>a.charAt(0).toUpperCase()+a.slice(1)).join(" ");k.push({label:a,href:d,isCurrent:e})}else e&&a?k.push({label:a,href:d,isCurrent:!0}):a&&b===j.length-2?k.push({label:a,href:d,isCurrent:!1}):k.push({label:"Detail",href:d,isCurrent:e})}return(0,b.jsx)("nav",{"aria-label":"Breadcrumb",className:i,children:(0,b.jsx)("ol",{className:"flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 list-none p-0 m-0 flex-wrap",children:k.map((a,d)=>(0,b.jsxs)("li",{className:"flex items-center gap-1.5",children:[d>0&&(0,b.jsx)(f.ChevronRight,{className:"w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0","aria-hidden":"true"}),a.isCurrent?(0,b.jsxs)("span",{className:"text-gray-900 dark:text-white font-medium","aria-current":"page",children:[0===d&&(0,b.jsx)(e.Home,{className:"w-3.5 h-3.5 inline mr-1","aria-hidden":"true"}),a.label]}):(0,b.jsxs)(c.default,{href:a.href,className:"hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1",children:[0===d&&(0,b.jsx)(e.Home,{className:"w-3.5 h-3.5","aria-hidden":"true"}),0===d?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)("span",{className:"hidden sm:inline",children:a.label}),(0,b.jsx)("span",{className:"sr-only sm:hidden",children:a.label})]}):a.label]})]},a.href))})})}a.s(["default",()=>h])},842640,a=>{"use strict";let b=(0,a.i(89592).default)("circle-x",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]);a.s(["XCircle",()=>b],842640)},166247,a=>{"use strict";let b=(0,a.i(89592).default)("circle-check",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["CheckCircle2",()=>b],166247)},653662,a=>{"use strict";let b=(0,a.i(89592).default)("pen",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]]);a.s(["Edit2",()=>b],653662)},198905,a=>{"use strict";var b=a.i(317400);function c(a){let{title:c,subtitle:d,filename:e,columns:f,data:g}=a,h=[...[[c],d?[d]:[],[""],f.map(a=>a.label)].filter(a=>a.length>0),...g.map(a=>f.map(b=>b.getValue?b.getValue(a):a[b.key]??""))],i=b.utils.aoa_to_sheet(h),j=f.map(a=>({wch:Math.max(a.label.length,15)}));i["!cols"]=j,i["!merges"]=[{s:{r:0,c:0},e:{r:0,c:f.length-1}}],d&&i["!merges"].push({s:{r:1,c:0},e:{r:1,c:f.length-1}});let k=b.utils.book_new();b.utils.book_append_sheet(k,i,"Roster"),b.writeFile(k,`${e}.xlsx`)}async function d(b){let{title:c,subtitle:d,filename:e,columns:g,data:h}=b,i=(await a.A(658627)).default,j=f(b,!0),k=document.createElement("div");k.innerHTML=j,document.body.appendChild(k);let l={margin:[.5,.5,.5,.5],filename:`${e}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:!0,allowTaint:!0,foreignObjectRendering:!1,logging:!1},jsPDF:{unit:"in",format:"letter",orientation:"landscape"}};try{await i().set(l).from(k.firstChild).save()}catch(a){console.error("PDF generation error:",a)}document.body.removeChild(k)}function e(a){let b=f(a,!1),c=window.open("","_blank");c&&(c.document.write(b),c.document.close(),c.focus(),c.onload=()=>{c.print()})}function f(a,b){let{title:c,subtitle:d,columns:e,data:f}=a,g=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),h=f.map(a=>{let b=e.map(b=>{let c;return"boolean"==typeof(c=b.getValue?b.getValue(a):a[b.key]??"")&&(c=c?"✓":"✗"),`<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${c}</td>`}).join("");return`<tr>${b}</tr>`}).join(""),i=e.map(a=>`<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; font-weight: bold; text-align: center;">${a.label}</th>`).join("");return`
<!DOCTYPE html>
<html>
<head>
  <title>${c}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #1e3a5f;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1e3a5f;
      margin-bottom: 5px;
    }
    .title {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      margin: 10px 0 5px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
    }
    .date {
      font-size: 12px;
      color: #888;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: ${b?"11px":"12px"};
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: center;
    }
    th {
      background: #f5f5f5;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background: #fafafa;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">PMI - Paramedic Institute</div>
    <div class="title">${c}</div>
    ${d?`<div class="subtitle">${d}</div>`:""}
    <div class="date">Generated: ${g}</div>
  </div>

  <table>
    <thead>
      <tr>${i}</tr>
    </thead>
    <tbody>
      ${h}
    </tbody>
  </table>

  <div class="footer">
    Total Students: ${f.length} | Generated from PMI Scheduler
  </div>
</body>
</html>`}a.s(["exportToExcel",()=>c,"exportToPDF",()=>d,"printRoster",()=>e])},658627,a=>{a.v(b=>Promise.all(["server/chunks/ssr/e71d5_404b7277._.js"].map(b=>a.l(b))).then(()=>b(281420)))}];

//# sourceMappingURL=_claude_worktrees_focused-goodall_dbf4bf7a._.js.map