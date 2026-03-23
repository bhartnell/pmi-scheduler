module.exports=[288774,a=>{"use strict";let b=(0,a.i(89592).default)("download",[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]]);a.s(["Download",()=>b],288774)},842640,a=>{"use strict";let b=(0,a.i(89592).default)("circle-x",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]);a.s(["XCircle",()=>b],842640)},217769,a=>{"use strict";let b=(0,a.i(89592).default)("chevron-up",[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]]);a.s(["ChevronUp",()=>b],217769)},166247,a=>{"use strict";let b=(0,a.i(89592).default)("circle-check",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["CheckCircle2",()=>b],166247)},203934,a=>{"use strict";let b=(0,a.i(89592).default)("funnel",[["path",{d:"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",key:"sc7q7i"}]]);a.s(["Filter",()=>b],203934)},198905,a=>{"use strict";var b=a.i(317400);function c(a){let{title:c,subtitle:d,filename:e,columns:f,data:g}=a,h=[...[[c],d?[d]:[],[""],f.map(a=>a.label)].filter(a=>a.length>0),...g.map(a=>f.map(b=>b.getValue?b.getValue(a):a[b.key]??""))],i=b.utils.aoa_to_sheet(h),j=f.map(a=>({wch:Math.max(a.label.length,15)}));i["!cols"]=j,i["!merges"]=[{s:{r:0,c:0},e:{r:0,c:f.length-1}}],d&&i["!merges"].push({s:{r:1,c:0},e:{r:1,c:f.length-1}});let k=b.utils.book_new();b.utils.book_append_sheet(k,i,"Roster"),b.writeFile(k,`${e}.xlsx`)}async function d(b){let{title:c,subtitle:d,filename:e,columns:g,data:h}=b,i=(await a.A(658627)).default,j=f(b,!0),k=document.createElement("div");k.innerHTML=j,document.body.appendChild(k);let l={margin:[.5,.5,.5,.5],filename:`${e}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:!0,allowTaint:!0,foreignObjectRendering:!1,logging:!1},jsPDF:{unit:"in",format:"letter",orientation:"landscape"}};try{await i().set(l).from(k.firstChild).save()}catch(a){console.error("PDF generation error:",a)}document.body.removeChild(k)}function e(a){let b=f(a,!1),c=window.open("","_blank");c&&(c.document.write(b),c.document.close(),c.focus(),c.onload=()=>{c.print()})}function f(a,b){let{title:c,subtitle:d,columns:e,data:f}=a,g=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),h=f.map(a=>{let b=e.map(b=>{let c;return"boolean"==typeof(c=b.getValue?b.getValue(a):a[b.key]??"")&&(c=c?"✓":"✗"),`<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${c}</td>`}).join("");return`<tr>${b}</tr>`}).join(""),i=e.map(a=>`<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; font-weight: bold; text-align: center;">${a.label}</th>`).join("");return`
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

//# sourceMappingURL=_claude_worktrees_focused-goodall_bcab42f7._.js.map