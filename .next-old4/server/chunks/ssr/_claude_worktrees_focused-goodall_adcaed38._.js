module.exports=[288774,a=>{"use strict";let b=(0,a.i(89592).default)("download",[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]]);a.s(["Download",()=>b],288774)},237789,a=>{"use strict";let b=(0,a.i(89592).default)("clipboard-check",[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]]);a.s(["ClipboardCheck",()=>b],237789)},220693,a=>{"use strict";let b=(0,a.i(89592).default)("printer",[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]]);a.s(["Printer",()=>b],220693)},470292,a=>{"use strict";let b=(0,a.i(89592).default)("file-spreadsheet",[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]]);a.s(["FileSpreadsheet",()=>b],470292)},198905,a=>{"use strict";var b=a.i(317400);function c(a){let{title:c,subtitle:d,filename:e,columns:f,data:g}=a,h=[...[[c],d?[d]:[],[""],f.map(a=>a.label)].filter(a=>a.length>0),...g.map(a=>f.map(b=>b.getValue?b.getValue(a):a[b.key]??""))],i=b.utils.aoa_to_sheet(h),j=f.map(a=>({wch:Math.max(a.label.length,15)}));i["!cols"]=j,i["!merges"]=[{s:{r:0,c:0},e:{r:0,c:f.length-1}}],d&&i["!merges"].push({s:{r:1,c:0},e:{r:1,c:f.length-1}});let k=b.utils.book_new();b.utils.book_append_sheet(k,i,"Roster"),b.writeFile(k,`${e}.xlsx`)}async function d(b){let{title:c,subtitle:d,filename:e,columns:g,data:h}=b,i=(await a.A(658627)).default,j=f(b,!0),k=document.createElement("div");k.innerHTML=j,document.body.appendChild(k);let l={margin:[.5,.5,.5,.5],filename:`${e}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:!0,allowTaint:!0,foreignObjectRendering:!1,logging:!1},jsPDF:{unit:"in",format:"letter",orientation:"landscape"}};try{await i().set(l).from(k.firstChild).save()}catch(a){console.error("PDF generation error:",a)}document.body.removeChild(k)}function e(a){let b=f(a,!1),c=window.open("","_blank");c&&(c.document.write(b),c.document.close(),c.focus(),c.onload=()=>{c.print()})}function f(a,b){let{title:c,subtitle:d,columns:e,data:f}=a,g=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),h=f.map(a=>{let b=e.map(b=>{let c;return"boolean"==typeof(c=b.getValue?b.getValue(a):a[b.key]??"")&&(c=c?"✓":"✗"),`<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${c}</td>`}).join("");return`<tr>${b}</tr>`}).join(""),i=e.map(a=>`<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; font-weight: bold; text-align: center;">${a.label}</th>`).join("");return`
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
</html>`}a.s(["exportToExcel",()=>c,"exportToPDF",()=>d,"printRoster",()=>e])},760078,a=>{"use strict";var b=a.i(326363),c=a.i(648181),d=a.i(288774),e=a.i(186835),f=a.i(220693),g=a.i(470292),h=a.i(916059),i=a.i(198905);function j({config:a,disabled:j=!1}){let[k,l]=(0,c.useState)(!1),[m,n]=(0,c.useState)(null),o=(0,c.useRef)(null);(0,c.useEffect)(()=>{function a(a){o.current&&!o.current.contains(a.target)&&l(!1)}return document.addEventListener("mousedown",a),()=>document.removeEventListener("mousedown",a)},[]);let p=async b=>{if(0===a.data.length)return void alert("No data to export");n(b);try{switch(b){case"print":(0,i.printRoster)(a);break;case"pdf":await (0,i.exportToPDF)(a);break;case"excel":(0,i.exportToExcel)(a)}}catch(a){console.error("Export error:",a),alert("Export failed. Please try again.")}n(null),l(!1)};return(0,b.jsxs)("div",{className:"relative",ref:o,children:[(0,b.jsxs)("button",{onClick:()=>l(!k),disabled:j||0===a.data.length,className:"flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",children:[(0,b.jsx)(d.Download,{className:"w-4 h-4"}),(0,b.jsx)("span",{children:"Export"}),(0,b.jsx)(e.ChevronDown,{className:`w-4 h-4 transition-transform ${k?"rotate-180":""}`})]}),k&&(0,b.jsxs)("div",{className:"absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50",children:[(0,b.jsxs)("button",{onClick:()=>p("print"),disabled:null!==m,className:"w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50",children:[(0,b.jsx)(f.Printer,{className:"w-4 h-4"}),(0,b.jsx)("span",{children:"print"===m?"Preparing...":"Print"})]}),(0,b.jsxs)("button",{onClick:()=>p("pdf"),disabled:null!==m,className:"w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50",children:[(0,b.jsx)(h.FileText,{className:"w-4 h-4"}),(0,b.jsx)("span",{children:"pdf"===m?"Generating...":"Download PDF"})]}),(0,b.jsxs)("button",{onClick:()=>p("excel"),disabled:null!==m,className:"w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50",children:[(0,b.jsx)(g.FileSpreadsheet,{className:"w-4 h-4"}),(0,b.jsx)("span",{children:"excel"===m?"Generating...":"Download Excel"})]})]})]})}a.s(["default",()=>j])},920569,a=>{"use strict";var b=a.i(326363),c=a.i(751413),d=a.i(731590),e=a.i(648181),f=a.i(389305),g=a.i(326786),h=a.i(305942),i=a.i(237789),j=a.i(812239),k=a.i(682011),l=a.i(490661),m=a.i(884541),n=a.i(831394),o=a.i(701933),p=a.i(760078);let q=[{key:"vax_complete",label:"Vax",fullName:"Vaccinations"},{key:"ride_along_complete",label:"Ride-Along",fullName:"Ride-Along Complete"},{key:"vitals_complete",label:"Vitals",fullName:"Vitals Assessment"}];function r(){let{data:a,status:r}=(0,c.useSession)(),s=(0,d.useRouter)(),[t,u]=(0,e.useState)([]),[v,w]=(0,e.useState)([]),[x,y]=(0,e.useState)([]),[z,A]=(0,e.useState)(!0),[B,C]=(0,e.useState)(null),[D,E]=(0,e.useState)(null),[F,G]=(0,e.useState)(""),[H,I]=(0,e.useState)(""),[J,K]=(0,e.useState)(!1);(0,e.useEffect)(()=>{"unauthenticated"===r&&s.push("/auth/signin")},[r,s]),(0,e.useEffect)(()=>{a&&L()},[a]),(0,e.useEffect)(()=>{F&&M()},[F]);let L=async()=>{A(!0);try{let a=await fetch("/api/instructor/me"),b=await a.json();if(b.success&&b.user&&(E(b.user.role),!(0,o.canAccessClinical)(b.user.role)))return void s.push("/");let c=await fetch("/api/lab-management/cohorts?activeOnly=true"),d=await c.json();if(d.success){let a=(d.cohorts||[]).filter(a=>a.program?.abbreviation==="EMT");u(a),a.length>0&&G(a[0].id)}}catch(a){console.error("Error fetching data:",a)}A(!1)},M=async()=>{try{let[a,b]=await Promise.all([fetch(`/api/lab-management/students?cohortId=${F}`),fetch(`/api/clinical/emt-tracking?cohortId=${F}`)]),c=await a.json(),d=await b.json();c.success&&w(c.students||[]),d.success&&y(d.tracking||[])}catch(a){console.error("Error fetching cohort data:",a)}},N=(a,b)=>{let c=x.find(b=>b.student_id===a);return!!c&&!0===c[b]},O=async(a,b)=>{if(!D||!(0,o.canEditClinical)(D))return;C(`${a}-${b}`);let c=!N(a,b);try{let d=await fetch("/api/clinical/emt-tracking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({student_id:a,field:b,value:c})}),e=await d.json();e.success?y(d=>d.find(b=>b.student_id===a)?d.map(d=>d.student_id===a?{...d,[b]:c}:d):[...d,{id:e.tracking?.id||"",student_id:a,mce_complete:!1,vax_complete:!1,ride_along_complete:!1,vitals_complete:!1,[b]:c}]):(console.error("EMT tracking save failed:",e.error),await M())}catch(a){console.error("Error toggling field:",a),await M()}C(null)},P=v.filter(a=>{if(H){let b=H.toLowerCase();if(!`${a.first_name} ${a.last_name}`.toLowerCase().includes(b))return!1}return(!J||q.filter(b=>N(a.id,b.key)).length!==q.length)&&!0}),Q=v.length*q.length,R=v.reduce((a,b)=>a+q.filter(a=>N(b.id,a.key)).length,0),S=Q>0?Math.round(R/Q*100):0;if("loading"===r||z)return(0,b.jsx)("div",{className:"min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800",children:(0,b.jsx)("div",{className:"animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"})});if(!a)return null;let T=D&&(0,o.canEditClinical)(D),U=t.find(a=>a.id===F),V=U?`EMT Group ${U.cohort_number}`:"EMT",W={title:"EMT Student Tracking Roster",subtitle:U?V:void 0,filename:`emt-tracking-${V.replace(/\s+/g,"-").toLowerCase()}-${new Date().toISOString().split("T")[0]}`,columns:[{key:"name",label:"Student Name",getValue:a=>`${a.first_name} ${a.last_name}`},{key:"email",label:"Email",getValue:a=>a.email||""},...q.map(a=>({key:a.key,label:a.label,getValue:b=>N(b.id,a.key)})),{key:"progress",label:"Progress",getValue:a=>{let b=q.filter(b=>N(a.id,b.key)).length;return`${Math.round(b/q.length*100)}%`}}],data:P};return(0,b.jsxs)("div",{className:"min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800",children:[(0,b.jsx)("div",{className:"bg-white dark:bg-gray-800 shadow-sm",children:(0,b.jsxs)("div",{className:"max-w-7xl mx-auto px-4 py-6",children:[(0,b.jsxs)("div",{className:"flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2",children:[(0,b.jsxs)(f.default,{href:"/",className:"hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1",children:[(0,b.jsx)(h.Home,{className:"w-3 h-3"}),"Home"]}),(0,b.jsx)(g.ChevronRight,{className:"w-4 h-4"}),(0,b.jsx)(f.default,{href:"/clinical",className:"hover:text-teal-600 dark:hover:text-teal-400",children:"Clinical"}),(0,b.jsx)(g.ChevronRight,{className:"w-4 h-4"}),(0,b.jsx)("span",{children:"EMT Tracking"})]}),(0,b.jsxs)("div",{className:"flex items-center justify-between",children:[(0,b.jsxs)("div",{className:"flex items-center gap-3",children:[(0,b.jsx)("div",{className:"p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg",children:(0,b.jsx)(i.ClipboardCheck,{className:"w-6 h-6 text-blue-600 dark:text-blue-400"})}),(0,b.jsxs)("div",{children:[(0,b.jsx)("h1",{className:"text-2xl font-bold text-gray-900 dark:text-white",children:"EMT Student Tracking"}),(0,b.jsx)("p",{className:"text-gray-600 dark:text-gray-400",children:"Track vaccinations, ride-alongs, and vitals"})]})]}),(0,b.jsxs)("div",{className:"flex items-center gap-4",children:[(0,b.jsxs)("div",{className:"text-right",children:[(0,b.jsxs)("div",{className:"text-2xl font-bold text-blue-600 dark:text-blue-400",children:[S,"%"]}),(0,b.jsx)("div",{className:"text-sm text-gray-500 dark:text-gray-400",children:"Complete"})]}),(0,b.jsx)(p.default,{config:W,disabled:!F||0===P.length})]})]})]})}),(0,b.jsxs)("main",{className:"max-w-7xl mx-auto px-4 py-6 space-y-4",children:[(0,b.jsx)("div",{className:"bg-white dark:bg-gray-800 rounded-lg shadow p-4",children:(0,b.jsxs)("div",{className:"flex flex-wrap gap-4 items-center",children:[(0,b.jsxs)("div",{className:"flex items-center gap-2",children:[(0,b.jsx)(j.Users,{className:"w-5 h-5 text-gray-400"}),(0,b.jsxs)("select",{value:F,onChange:a=>G(a.target.value),className:"px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 min-w-[200px]",children:[(0,b.jsx)("option",{value:"",children:"Select EMT Cohort"}),t.map(a=>(0,b.jsxs)("option",{value:a.id,children:["EMT Group ",a.cohort_number]},a.id))]})]}),(0,b.jsxs)("div",{className:"flex-1 min-w-[200px] relative",children:[(0,b.jsx)(k.Search,{className:"absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"}),(0,b.jsx)("input",{type:"text",value:H,onChange:a=>I(a.target.value),placeholder:"Search student...",className:"w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"})]}),(0,b.jsxs)("label",{className:"flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer",children:[(0,b.jsx)("input",{type:"checkbox",checked:J,onChange:a=>K(a.target.checked),className:"w-4 h-4 text-blue-600 rounded"}),"Show incomplete only"]})]})}),0===t.length&&!z&&(0,b.jsxs)("div",{className:"bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center",children:[(0,b.jsx)(j.Users,{className:"w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"}),(0,b.jsx)("p",{className:"text-gray-500 dark:text-gray-400",children:"No EMT cohorts found"})]}),F&&(0,b.jsx)("div",{className:"bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden",children:(0,b.jsx)("div",{className:"overflow-x-auto",children:(0,b.jsxs)("table",{className:"w-full",children:[(0,b.jsx)("thead",{className:"bg-gray-50 dark:bg-gray-700",children:(0,b.jsxs)("tr",{children:[(0,b.jsx)("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10",children:"Student"}),q.map(a=>(0,b.jsx)("th",{className:"px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap",title:a.fullName,children:a.label},a.key)),(0,b.jsx)("th",{className:"px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider",children:"Progress"})]})}),(0,b.jsx)("tbody",{className:"divide-y divide-gray-200 dark:divide-gray-700",children:0===P.length?(0,b.jsx)("tr",{children:(0,b.jsx)("td",{colSpan:q.length+2,className:"px-4 py-8 text-center text-gray-500 dark:text-gray-400",children:"No students found"})}):P.map(a=>{let c=Math.round(q.filter(b=>N(a.id,b.key)).length/q.length*100);return(0,b.jsxs)("tr",{className:"hover:bg-gray-50 dark:hover:bg-gray-700/50",children:[(0,b.jsx)("td",{className:"px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10",children:(0,b.jsxs)("div",{className:"font-medium text-gray-900 dark:text-white",children:[a.first_name," ",a.last_name]})}),q.map(c=>{let d=N(a.id,c.key),e=B===`${a.id}-${c.key}`;return(0,b.jsx)("td",{className:"px-4 py-3 text-center",children:(0,b.jsx)("button",{onClick:()=>O(a.id,c.key),disabled:!T||e,className:`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${d?"bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50":"bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"} ${!T?"cursor-not-allowed":"cursor-pointer"}`,title:`${c.fullName}: ${d?"Complete":"Incomplete"}`,children:e?(0,b.jsx)(n.Loader2,{className:"w-5 h-5 animate-spin"}):d?(0,b.jsx)(l.Check,{className:"w-5 h-5"}):(0,b.jsx)(m.X,{className:"w-5 h-5"})})},c.key)}),(0,b.jsx)("td",{className:"px-4 py-3 text-center",children:(0,b.jsxs)("div",{className:"flex items-center gap-2",children:[(0,b.jsx)("div",{className:"flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden min-w-[60px]",children:(0,b.jsx)("div",{className:`h-full transition-all ${100===c?"bg-green-500":c>=75?"bg-yellow-500":"bg-red-500"}`,style:{width:`${c}%`}})}),(0,b.jsxs)("span",{className:"text-xs text-gray-500 dark:text-gray-400 w-10",children:[c,"%"]})]})})]},a.id)})})]})})}),!F&&t.length>0&&(0,b.jsxs)("div",{className:"bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center",children:[(0,b.jsx)(j.Users,{className:"w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"}),(0,b.jsx)("p",{className:"text-gray-500 dark:text-gray-400",children:"Select a cohort to view tracking data"})]})]})]})}a.s(["default",()=>r])},658627,a=>{a.v(b=>Promise.all(["server/chunks/ssr/e71d5_404b7277._.js"].map(b=>a.l(b))).then(()=>b(281420)))}];

//# sourceMappingURL=_claude_worktrees_focused-goodall_adcaed38._.js.map