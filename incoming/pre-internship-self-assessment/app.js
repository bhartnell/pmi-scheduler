/*
 * Pre-Internship Self-Assessment: application logic.
 * All persistence goes through window.SA_STORAGE (see storage-adapter.js).
 * Nothing in this file talks to a server directly.
 */
const LEVELS=window.SA_LEVELS, DOMAINS=window.SA_DOMAINS, SCENARIOS=window.SA_SCENARIOS, REFLECT=window.SA_REFLECT, PREFS=window.SA_PREFS;
const DNAME = Object.fromEntries(DOMAINS.map(d=>[d.id,d.name]));
const STORE = window.SA_STORAGE;

/* ---------------- Helpers ---------------- */
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DRAFT_KEY = "pmi-sa-draft-v1";
function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2600)}
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function fmtDate(iso){if(!iso)return "";try{return new Date(iso).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}catch(e){return iso}}
async function copyText(text, fallbackEl){
  try{await navigator.clipboard.writeText(text);toast("Copied")}
  catch(e){ if(fallbackEl){const r=document.createRange();r.selectNodeContents(fallbackEl);const s=getSelection();s.removeAllRanges();s.addRange(r)} toast("Press Ctrl+C or Cmd+C to copy the selected text") }
}
function blankForm(){return {name:"",cohort:"",email:"",ratings:{},scenarios:{},reflections:{},prefs:{learn:null,feedback:null,autonomy:null,challenges:[]},ack:false}}

/* ---------------- App state ---------------- */
const S = {form:blankForm(), canEdit:false, downloads:true,
  submitted:null, existing:null,
  records:{responses:[], imports:[]}, ratings:{}, selected:null, edit:null, dirty:false, filter:{q:"",cohort:""}};

/* ---------------- Student form ---------------- */
function renderForm(){
  const f = S.form;
  const el = $("#view-form");
  el.innerHTML = `
  <div class="progress" id="progress" aria-label="Progress"></div>
  <form class="form" id="sa-form" novalidate>
    <div id="form-status"></div>
    <section class="block" id="sec-about">
      <header><span class="eyebrow">Section 1</span><h2>About you</h2></header>
      <div class="grid2">
        <label class="field">Full name<input type="text" id="f-name" autocomplete="name" value="${esc(f.name)}"></label>
        <label class="field">Cohort or group<input type="text" id="f-cohort" list="cohorts" placeholder="e.g., Group 5" value="${esc(f.cohort)}"></label>
        <label class="field">PMI email <small>Optional</small><input type="email" id="f-email" autocomplete="email" value="${esc(f.email)}"></label>
      </div>
      <datalist id="cohorts"><option value="Group 4"><option value="Group 5"></datalist>
    </section>

    <section class="block" id="sec-ratings">
      <header><span class="eyebrow">Section 2 · 10 items</span><h2>Professional behaviors</h2>
        <p class="muted">For each area, choose the description that sounds most like you on a typical call today. Pick based on what you actually do, not what you plan to do. Honest ratings help us match you with a preceptor who fits how you learn, and your instructors complete the same ratings so you can compare.</p></header>
      ${DOMAINS.map(d=>`
      <fieldset class="domain" id="d-${d.id}">
        <legend><h3>${esc(d.name)}</h3></legend>
        <div class="anchors">${d.anchors.map((a,i)=>`
          <label class="opt"><input type="radio" name="rate-${d.id}" value="${i+1}" ${f.ratings[d.id]===i+1?"checked":""}>
            <span class="lvl">${i+1} · ${LEVELS[i]}</span><span>${esc(a)}</span></label>`).join("")}
        </div>
      </fieldset>`).join("")}
    </section>

    <section class="block" id="sec-scen">
      <header><span class="eyebrow">Section 3 · 5 calls</span><h2>Field scenarios</h2>
        <p class="muted">Choose what you would most likely do first. Go with your instinct rather than the answer you think we want.</p></header>
      ${SCENARIOS.map((s,i)=>`
      <fieldset class="call" id="c-${s.id}">
        <div class="dispatch"><span class="eyebrow">Call ${i+1}</span><h3>${esc(s.title)}</h3></div>
        <div class="body">
          <p class="quote" style="border-color:var(--accent)">${esc(s.text)}</p>
          <div class="choices">${s.options.map(o=>`
            <label class="opt"><input type="radio" name="scen-${s.id}" value="${o.k}" ${f.scenarios[s.id]===o.k?"checked":""}>
              <span class="key">${o.k}</span><span>${esc(o.t)}</span></label>`).join("")}</div>
        </div>
      </fieldset>`).join("")}
    </section>

    <section class="block" id="sec-reflect">
      <header><span class="eyebrow">Section 4</span><h2>Reflection</h2>
        <p class="muted">A few sentences each is enough. Specific examples are more useful than general statements.</p></header>
      ${REFLECT.map(r=>`
      <label class="field">${esc(r.label)}${r.help?`<small>${esc(r.help)}</small>`:""}
        <textarea id="f-${r.id}" data-reflect="${r.id}">${esc(f.reflections[r.id]||"")}</textarea></label>`).join("")}
    </section>

    <section class="block" id="sec-prefs">
      <header><span class="eyebrow">Section 5</span><h2>How you learn best</h2>
        <p class="muted">These answers go straight to your agency's placement coordinator to help pair you with a preceptor.</p></header>
      ${["learn","feedback","autonomy"].map(k=>`
      <fieldset class="domain" id="p-${k}">
        <legend><h3 style="font-family:var(--f-body);font-size:1.02rem;font-weight:700;letter-spacing:0">${esc(PREFS[k].label)}</h3></legend>
        <div class="choices">${PREFS[k].options.map((o,i)=>`
          <label class="opt"><input type="radio" name="pref-${k}" value="${i}" ${f.prefs[k]===i?"checked":""}>
            <span class="key">${String.fromCharCode(65+i)}</span><span>${esc(o)}</span></label>`).join("")}</div>
      </fieldset>`).join("")}
      <fieldset class="domain" id="p-challenges">
        <legend><h3 style="font-family:var(--f-body);font-size:1.02rem;font-weight:700;letter-spacing:0">${esc(PREFS.challenges.label)}</h3></legend>
        <div class="checks">${PREFS.challenges.options.map((o,i)=>`
          <label class="opt"><input type="checkbox" name="pref-challenges" value="${i}" ${f.prefs.challenges.includes(i)?"checked":""}><span>${esc(o)}</span></label>`).join("")}</div>
      </fieldset>
    </section>

    <section class="block" id="sec-submit">
      <label class="ack"><input type="checkbox" id="f-ack" ${f.ack?"checked":""}>
        <span>I understand that a summary of my responses, alongside my instructors' ratings, will be shared with my field internship agency to help match me with a preceptor. My reflection answers to the first two questions stay with my instructors.</span></label>
      <div id="missing"></div>
      <div class="row"><button type="submit" id="submit-btn">${S.existing?"Update my responses":"Submit self-assessment"}</button>
        <span class="muted" id="save-hint">Your answers are saved as a draft in this browser as you go.</span></div>
    </section>
  </form>`;
  bindForm(); updateProgress();
}

function readForm(){
  const f=S.form;
  f.name=$("#f-name").value.trim(); f.cohort=$("#f-cohort").value.trim(); f.email=$("#f-email").value.trim();
  DOMAINS.forEach(d=>{const c=$(`input[name="rate-${d.id}"]:checked`);if(c)f.ratings[d.id]=+c.value});
  SCENARIOS.forEach(s=>{const c=$(`input[name="scen-${s.id}"]:checked`);if(c)f.scenarios[s.id]=c.value});
  REFLECT.forEach(r=>{f.reflections[r.id]=$(`#f-${r.id}`).value});
  ["learn","feedback","autonomy"].forEach(k=>{const c=$(`input[name="pref-${k}"]:checked`);f.prefs[k]=c?+c.value:null});
  f.prefs.challenges=$$(`input[name="pref-challenges"]:checked`).map(i=>+i.value);
  f.ack=$("#f-ack").checked;
}
function bindForm(){
  const form=$("#sa-form");
  let t;
  form.addEventListener("input",()=>{readForm();updateProgress();clearTimeout(t);t=setTimeout(()=>lsSet(DRAFT_KEY,S.form),400)});
  form.addEventListener("change",()=>{readForm();updateProgress();lsSet(DRAFT_KEY,S.form)});
  form.addEventListener("submit",e=>{e.preventDefault();submitForm()});
}
function sectionStatus(){
  const f=S.form;
  return [
    {id:"sec-about",label:"About you",done:+(!!f.name&&!!f.cohort),of:1},
    {id:"sec-ratings",label:"Behaviors",done:DOMAINS.filter(d=>f.ratings[d.id]).length,of:DOMAINS.length},
    {id:"sec-scen",label:"Scenarios",done:SCENARIOS.filter(s=>f.scenarios[s.id]).length,of:SCENARIOS.length},
    {id:"sec-reflect",label:"Reflection",done:REFLECT.filter(r=>r.req&&(f.reflections[r.id]||"").trim().length>=10).length,of:REFLECT.filter(r=>r.req).length},
    {id:"sec-prefs",label:"Learning",done:["learn","feedback","autonomy"].filter(k=>f.prefs[k]!=null).length,of:3}
  ];
}
function updateProgress(){
  const p=$("#progress"); if(!p) return;
  p.innerHTML = sectionStatus().map(s=>`<a class="chip ${s.done>=s.of?"done":""}" href="#${s.id}" data-jump="${s.id}">${esc(s.label)} ${s.of>1?`${s.done}/${s.of}`:(s.done?"✓":"")}</a>`).join("");
  $$("[data-jump]",p).forEach(a=>a.addEventListener("click",e=>{e.preventDefault();document.getElementById(a.dataset.jump)?.scrollIntoView({behavior:"smooth",block:"start"})}));
}
function missingList(){
  const f=S.form, m=[];
  if(!f.name) m.push(["sec-about","Your name"]);
  if(!f.cohort) m.push(["sec-about","Your cohort or group"]);
  DOMAINS.forEach(d=>{if(!f.ratings[d.id])m.push([`d-${d.id}`,`Rating: ${d.name}`])});
  SCENARIOS.forEach((s,i)=>{if(!f.scenarios[s.id])m.push([`c-${s.id}`,`Call ${i+1}: ${s.title}`])});
  REFLECT.forEach((r,i)=>{if(r.req&&(f.reflections[r.id]||"").trim().length<10)m.push([`f-${r.id}`,`Reflection question ${i+1}`])});
  ["learn","feedback","autonomy"].forEach(k=>{if(f.prefs[k]==null)m.push([`p-${k}`,PREFS[k].label])});
  if(!f.ack) m.push(["f-ack","The acknowledgment checkbox"]);
  return m;
}
function payload(){
  const f=S.form;
  return {v:1,name:f.name,cohort:f.cohort,email:f.email,ratings:{...f.ratings},scenarios:{...f.scenarios},
    reflections:{...f.reflections},prefs:{...f.prefs,challenges:[...f.prefs.challenges]},ack:f.ack,submittedAt:new Date().toISOString()};
}
async function submitForm(){
  readForm();
  const miss=missingList(), box=$("#missing");
  if(miss.length){
    box.innerHTML=`<div class="notice err"><strong>Finish these items before submitting:</strong><ul style="margin:6px 0 0;padding-left:20px">${miss.map(([id,l])=>`<li><a href="#${id}" data-go="${id}" style="color:inherit">${esc(l)}</a></li>`).join("")}</ul></div>`;
    $$("[data-go]",box).forEach(a=>a.addEventListener("click",e=>{e.preventDefault();document.getElementById(a.dataset.go)?.scrollIntoView({behavior:"smooth",block:"center"})}));
    box.scrollIntoView({behavior:"smooth",block:"center"});
    return;
  }
  box.innerHTML="";
  const btn=$("#submit-btn"); btn.disabled=true; btn.textContent="Submitting…";
  const data=payload();
  let saved=false;
  try{ await STORE.saveMyResponse(data); saved=true; }
  catch(e){ saved=false; }
  if(!saved){
    btn.disabled=false; btn.textContent=S.existing?"Update my responses":"Submit self-assessment";
    box.innerHTML=`<div class="notice err"><strong>Your responses didn't save.</strong> Check your connection and select Submit again. Your answers are still here.</div>`;
    return;
  }
  S.existing=data;
  S.submitted={data,saved};
  renderSubmitted();
}
function renderSubmitted(){
  const {data,saved}=S.submitted;
  const el=$("#view-form");
  el.innerHTML = `<div class="form">
    <div class="notice ok"><strong>Submitted.</strong> Your self-assessment was received on ${esc(fmtDate(data.submittedAt))}. Your instructors will review it alongside their own ratings before your internship placement.</div>
    <div class="panel"><h3>What happens next</h3>
      <p>Your instructors rate you on the same ten professional behaviors. The comparison, your scenario choices, and your learning preferences become a one-page summary for your agency's placement coordinator. Your first two reflection answers stay with your instructors.</p></div>
    <div class="row"><button class="btn ghost" id="edit-again">Review or change my answers</button></div>
  </div>`;
  $("#edit-again").addEventListener("click",()=>{S.submitted=null;renderForm();scrollTo(0,0)});
  scrollTo(0,0);
}
function slug(s){return (s||"student").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"student"}
async function saveFile(name,data){
  if(STORE.download) return STORE.download(name,data);
  const type=name.endsWith(".csv")?"text/csv":name.endsWith(".html")?"text/html":"text/plain";
  const url=URL.createObjectURL(new Blob([data],{type:type+";charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
}

/* ---------------- Scoring & summaries ---------------- */
function scenarioScore(rec){
  let total=0; const items=SCENARIOS.map(s=>{const k=rec.scenarios?.[s.id];const o=s.options.find(x=>x.k===k);const sc=o?o.s:null;if(sc!=null)total+=sc;return {s,o,sc}});
  return {total,max:SCENARIOS.length*2,items};
}
function gapInfo(self,ins){
  if(!self||!ins) return {d:null,cls:"",label:ins?"":"Not rated"};
  const d=self-ins;
  if(d>=2) return {d,cls:"bad",label:"Self much higher"};
  if(d===1) return {d,cls:"warn",label:"Self slightly higher"};
  if(d===0) return {d,cls:"ok",label:"Aligned"};
  if(d===-1) return {d,cls:"info",label:"Self slightly lower"};
  return {d,cls:"info",label:"Self much lower"};
}
function calibration(rec,edit){
  const ds=DOMAINS.map(d=>[rec.ratings?.[d.id],edit?.instr?.[d.id]]).filter(([a,b])=>a&&b);
  if(!ds.length) return null;
  const mean=ds.reduce((t,[a,b])=>t+(a-b),0)/ds.length;
  if(mean>0.5) return {mean,cls:"warn",label:"Rates self higher"};
  if(mean<-0.5) return {mean,cls:"info",label:"Rates self lower"};
  return {mean,cls:"ok",label:"Well calibrated"};
}
function autoSummary(rec,edit){
  const eff=d=>edit.instr?.[d.id]||rec.ratings?.[d.id]||0;
  const strengths=DOMAINS.filter(d=>eff(d)>=3).sort((a,b)=>eff(b)-eff(a)).slice(0,3).map(d=>d.name);
  const over=DOMAINS.filter(d=>rec.ratings?.[d.id]&&edit.instr?.[d.id]&&rec.ratings[d.id]-edit.instr[d.id]>=2);
  const growthSet=[...DOMAINS.filter(d=>eff(d)&&eff(d)<=2).sort((a,b)=>eff(a)-eff(b)),...over];
  const growth=[...new Set(growthSet.map(d=>d.name))].slice(0,3);
  const sc=scenarioScore(rec);
  const missed=sc.items.filter(i=>i.sc===0).map(i=>DNAME[i.s.domain]);
  const cal=calibration(rec,edit);
  const p=rec.prefs||{};
  const lines=[];
  if(p.learn!=null) lines.push(PREFS.learn.match[p.learn]);
  if(p.feedback!=null) lines.push(PREFS.feedback.match[p.feedback]);
  const leadOver=over.some(d=>d.id==="lead");
  if(p.autonomy===0){
    lines.push(leadOver
      ?"Wants early autonomy, but rates their scene leadership higher than instructors do. A preceptor who sets clear expectations on day one and corrects directly in the moment is a good fit."
      :"Ready for early autonomy. A preceptor comfortable letting the student run calls and debriefing afterward is a good fit.");
  }else if(p.autonomy===1){
    lines.push("Prefers graduated autonomy, leading lower-acuity calls first.");
  }else if(p.autonomy===2){
    lines.push(cal&&cal.mean<-0.5
      ?"Prefers to observe first and tends to underrate their own ability. A preceptor who hands off calls on a clear timeline and names what the student does well will build confidence."
      :"Prefers to observe for the first few shifts. Set a clear point at which the student takes the lead so the observation period doesn't stretch out.");
  }
  if(cal&&cal.mean>0.5&&!leadOver) lines.push("Self-ratings run higher than instructor ratings overall. Frequent, specific feedback early in the internship is recommended.");
  if(p.challenges?.length) lines.push("Self-identified stressors: "+p.challenges.map(i=>PREFS.challenges.options[i].toLowerCase()).join("; ")+".");
  if(missed.length) lines.push("Scenario choices suggest coaching in "+[...new Set(missed)].map(x=>x.toLowerCase()).join(" and ")+".");
  return {strengths:strengths.join("\n"),growth:growth.join("\n"),match:lines.join(" ")};
}
function listItems(text){return (text||"").split(/\n+/).map(s=>s.trim()).filter(Boolean)}
function summaryInner(rec,edit){
  const sc=scenarioScore(rec);
  const rows=DOMAINS.map(d=>{const a=rec.ratings?.[d.id],b=edit.instr?.[d.id];const g=gapInfo(a,b);
    return `<tr><td>${esc(d.name)}</td><td class="num">${a||"–"}</td><td class="num">${b||"–"}</td><td>${g.label?`<span class="tag ${g.cls}">${esc(g.label)}</span>`:""}</td></tr>`}).join("");
  const s=edit.summary||{};
  const li=t=>{const xs=listItems(t);return xs.length?`<ul>${xs.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p class="muted">Not yet written.</p>`};
  return `<div class="sh-head"><div><div class="eyebrow">Pre-internship student profile</div><h2>${esc(rec.name||"Student")}</h2>
      <div class="muted">${esc(rec.cohort||"")}</div></div>
      <div class="muted" style="text-align:right">PMI Las Vegas · Paramedic Program<br>${edit.preparedBy?`Prepared by ${esc(edit.preparedBy)} · `:""}${esc(fmtDate(edit.updatedAt||new Date().toISOString()))}</div></div>
    ${(edit.academic?.cog||edit.academic?.skills)?`<div class="two">
      ${edit.academic?.cog?`<div><h4>Cognitive standing</h4><p>${esc(edit.academic.cog)}</p></div>`:""}
      ${edit.academic?.skills?`<div><h4>Psychomotor / skills</h4><p>${esc(edit.academic.skills)}</p></div>`:""}</div>`:""}
    <div class="two"><div><h4>Strengths</h4>${li(s.strengths)}</div><div><h4>Growth areas</h4>${li(s.growth)}</div></div>
    <div><h4>Preceptor match</h4>${s.match?`<p>${esc(s.match)}</p>`:`<p class="muted">Not yet written.</p>`}</div>
    <div><h4>Professional behaviors · self vs. instructor (1–4)</h4><div class="tablewrap"><table>
      <thead><tr><th>Behavior</th><th>Self</th><th>Instr.</th><th>Comparison</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted" style="margin-top:6px">Scale: 1 Needs direction · 2 Developing · 3 Consistent · 4 Leads. Scenario judgment: ${sc.total}/${sc.max}.</p></div>
    ${s.comments?`<div><h4>Instructor comments</h4><p style="white-space:pre-wrap">${esc(s.comments)}</p></div>`:""}
    ${(rec.reflections?.r3||"").trim()?`<div><h4>From the student</h4><p class="quote">${esc(rec.reflections.r3)}</p></div>`:""}`;
}
function summaryStandalone(rec,edit){
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(rec.name)} – Pre-Internship Profile</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#16212B;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.45;font-size:14px}
h2{margin:0;font-size:24px}.eyebrow,h4{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5A6774;margin:0 0 4px}
.sh-head{display:flex;justify-content:space-between;gap:10px;border-bottom:2px solid #16212B;padding-bottom:10px;margin-bottom:14px}
.muted{color:#5A6774}.two{display:flex;gap:24px}.two>div{flex:1}div{margin-bottom:12px}ul{margin:0;padding-left:18px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #D6DEE6;padding:6px 8px;text-align:left}td.num{text-align:center}
th{font-size:11px;text-transform:uppercase;color:#5A6774}.tag{font-size:11px;padding:1px 6px;border:1px solid #D6DEE6;border-radius:9px}
.tag.bad{color:#A8261D;border-color:#A8261D}.tag.warn{color:#9A5B00;border-color:#9A5B00}.tag.ok{color:#276B44;border-color:#276B44}.tag.info{color:#1D5FA6;border-color:#1D5FA6}
.quote{border-left:3px solid #D6DEE6;padding-left:10px;white-space:pre-wrap}@media print{body{margin:0}}</style></head><body>${summaryInner(rec,edit)}</body></html>`;
}
function summaryPlain(rec,edit){
  const s=edit.summary||{};
  const L=[`PRE-INTERNSHIP STUDENT PROFILE`,`${rec.name} (${rec.cohort})`,`PMI Las Vegas Paramedic Program${edit.preparedBy?` · Prepared by ${edit.preparedBy}`:""}`,""];
  if(edit.academic?.cog)L.push(`Cognitive standing: ${edit.academic.cog}`);
  if(edit.academic?.skills)L.push(`Psychomotor / skills: ${edit.academic.skills}`);
  L.push("","STRENGTHS",...listItems(s.strengths).map(x=>"- "+x),"","GROWTH AREAS",...listItems(s.growth).map(x=>"- "+x),"","PRECEPTOR MATCH",s.match||"","","SELF vs INSTRUCTOR (1-4)");
  DOMAINS.forEach(d=>{const a=rec.ratings?.[d.id],b=edit.instr?.[d.id];L.push(`- ${d.name}: self ${a||"-"}, instructor ${b||"-"}${a&&b?` (${gapInfo(a,b).label})`:""}`)});
  const sc=scenarioScore(rec);L.push(`Scenario judgment: ${sc.total}/${sc.max}`);
  if(s.comments)L.push("","INSTRUCTOR COMMENTS",s.comments);
  if((rec.reflections?.r3||"").trim())L.push("","FROM THE STUDENT",rec.reflections.r3);
  return L.join("\n");
}

/* ---------------- Instructor review ---------------- */
function allRecords(){
  const r=[...S.records.responses.map(d=>({key:"r-"+d.id,src:"form",docId:d.id,...d.data})),
           ...S.records.imports.map(d=>({key:"i-"+d.id,src:"import",docId:d.id,...d.data}))];
  return r.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
}
function blankEdit(){return {instr:{},academic:{cog:"",skills:""},summary:{strengths:"",growth:"",match:"",comments:""},preparedBy:""}}
function renderReview(){
  const el=$("#view-review");
  const recs=allRecords();
  const cohorts=[...new Set(recs.map(r=>r.cohort).filter(Boolean))].sort();
  const q=S.filter.q.toLowerCase();
  const shown=recs.filter(r=>(!S.filter.cohort||r.cohort===S.filter.cohort)&&(!q||(r.name||"").toLowerCase().includes(q)));
  const reviewed=recs.filter(r=>DOMAINS.every(d=>S.ratings[r.key]?.instr?.[d.id])).length;
  el.innerHTML=`<div class="review">
    <aside class="rail">
      <div class="row" style="justify-content:space-between"><h2>Students</h2><span class="tag">${reviewed}/${recs.length} reviewed</span></div>
      <input type="text" id="r-q" placeholder="Search by name" value="${esc(S.filter.q)}" aria-label="Search students">
      <select id="r-cohort" aria-label="Filter by cohort"><option value="">All cohorts</option>${cohorts.map(c=>`<option ${c===S.filter.cohort?"selected":""}>${esc(c)}</option>`).join("")}</select>
      <div class="roster" id="roster">${shown.length?shown.map(r=>{
        const e=S.ratings[r.key];const done=e&&DOMAINS.every(d=>e.instr?.[d.id]);const cal=e?calibration(r,e):null;
        return `<button data-key="${esc(r.key)}" aria-current="${S.selected===r.key}"><span class="nm">${esc(r.name||"Unnamed")}</span>
          <span class="meta"><span class="tag">${esc(r.cohort||"No cohort")}</span>${done?`<span class="tag ok">Reviewed</span>`:`<span class="tag">Awaiting review</span>`}${cal&&done?`<span class="tag ${cal.cls}">${cal.label}</span>`:""}${r.src==="import"?`<span class="tag">Imported</span>`:""}</span></button>`}).join("")
        :`<div style="padding:14px" class="muted">${recs.length?"No students match this filter.":"No submissions yet."}</div>`}</div>
      <div class="row"><button class="btn small ghost" id="refresh-btn">Refresh list</button><button class="btn small ghost" id="csv-btn" ${recs.length?"":"disabled"}>Export all as CSV</button></div>
    </aside>
    <section class="detail" id="detail"></section></div>`;
  $("#r-q").addEventListener("input",e=>{S.filter.q=e.target.value;renderRosterOnly()});
  $("#r-cohort").addEventListener("change",e=>{S.filter.cohort=e.target.value;renderRosterOnly()});
  bindRoster();
  $("#refresh-btn").addEventListener("click",()=>loadInstructorData().then(()=>toast("List updated")));
  $("#csv-btn").addEventListener("click",exportCSV);
  renderDetail();
}
function renderRosterOnly(){
  const q=$("#r-q"), pos=q.selectionStart; renderReview(); const nq=$("#r-q"); if(document.activeElement!==nq&&S.filter.q!==undefined){nq.focus();try{nq.setSelectionRange(pos,pos)}catch(e){}}
}
function bindRoster(){$$("#roster button").forEach(b=>b.addEventListener("click",()=>selectRecord(b.dataset.key)))}
function selectRecord(key){
  if(S.dirty && S.selected && S.selected!==key){ S._pendingSwitch=key; renderDetail(); return; }
  S.selected=key; S.dirty=false; S._pendingSwitch=null;
  S.edit=JSON.parse(JSON.stringify(S.ratings[key]||blankEdit()));
  const rec=allRecords().find(r=>r.key===key);
  if(rec && !S.ratings[key]) Object.assign(S.edit.summary,autoSummary(rec,S.edit));
  $$("#roster button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.key===key)));
  renderDetail();
  if(matchMedia("(max-width:860px)").matches) $("#detail").scrollIntoView({behavior:"smooth"});
}
function renderDetail(){
  const el=$("#detail"); if(!el) return;
  const recs=allRecords();
  const rec=recs.find(r=>r.key===S.selected);
  if(!rec){
    el.innerHTML=`<div class="empty"><h2>${recs.length?"Select a student":"Waiting for students"}</h2>
      <p class="muted">${recs.length?"Choose a student on the left to compare their self-ratings with yours and build the agency summary."
      :"Submissions appear here as students complete the form. Select Refresh list to check for new ones."}</p></div>`;
    return;
  }
  const E=S.edit, sc=scenarioScore(rec), cal=calibration(rec,E), p=rec.prefs||{};
  el.innerHTML=`
  ${S._pendingSwitch?`<div class="notice warn row" style="justify-content:space-between"><span>You have unsaved changes for ${esc(rec.name)}.</span>
     <span class="row"><button class="btn small" id="sw-save">Save and switch</button><button class="btn small ghost" id="sw-discard">Discard changes</button></span></div>`:""}
  <div class="detail-head"><div><span class="eyebrow">${esc(rec.cohort||"")} · Submitted ${esc(fmtDate(rec.submittedAt))}${rec.src==="import"?" · Imported code":""}</span><h2 style="font-size:2rem">${esc(rec.name)}</h2>${rec.email?`<span class="muted" style="user-select:all">${esc(rec.email)}</span>`:""}</div>
    <div class="row">${cal?`<span class="tag ${cal.cls}">${cal.label} (${cal.mean>0?"+":""}${cal.mean.toFixed(1)})</span>`:""}<span class="tag info">Scenarios ${sc.total}/${sc.max}</span></div></div>

  <div class="panel"><div class="row" style="justify-content:space-between"><h3>Professional behaviors</h3><span class="muted">Rate each area using the same anchors the student saw.</span></div>
    <div class="tablewrap"><table><thead><tr><th>Behavior</th><th>Self</th><th>Instructor</th><th>Comparison</th></tr></thead><tbody>
    ${DOMAINS.map(d=>{const a=rec.ratings?.[d.id],b=E.instr?.[d.id];const g=gapInfo(a,b);
      return `<tr><td title="${esc(a?d.anchors[a-1]:"")}">${esc(d.name)}</td>
      <td class="num"><span class="dots" aria-label="Self ${a||"not rated"} of 4">${[1,2,3,4].map(i=>`<i class="${i<=(a||0)?"on":""}"></i>`).join("")}</span> ${a||"–"}</td>
      <td><select data-instr="${d.id}" aria-label="Instructor rating for ${esc(d.name)}"><option value="">Rate…</option>${LEVELS.map((l,i)=>`<option value="${i+1}" ${b===i+1?"selected":""}>${i+1} · ${l}</option>`).join("")}</select></td>
      <td>${g.label?`<span class="tag ${g.cls}">${esc(g.label)}</span>`:""}</td></tr>`}).join("")}
    </tbody></table></div></div>

  <div class="panel"><h3>Academic standing</h3><div class="grid2">
    <label class="field">Cognitive standing<small>e.g., summative exam average, module scores</small><input type="text" data-acad="cog" value="${esc(E.academic?.cog)}"></label>
    <label class="field">Psychomotor / skills<small>e.g., skills check-offs complete, remediation</small><input type="text" data-acad="skills" value="${esc(E.academic?.skills)}"></label></div></div>

  <div class="panel"><h3>Scenario choices</h3>
    ${sc.items.map(({s,o,sc:v},i)=>`<div style="display:grid;gap:4px;padding-bottom:10px;border-bottom:1px solid var(--line)">
      <div class="row" style="justify-content:space-between"><strong>Call ${i+1}: ${esc(s.title)}</strong><span class="row"><span class="tag">${esc(DNAME[s.domain])}</span>${v===2?`<span class="tag ok">Best choice</span>`:v===1?`<span class="tag warn">Acceptable</span>`:v===0?`<span class="tag bad">Concern</span>`:`<span class="tag">No answer</span>`}</span></div>
      ${o?`<span class="muted">${o.k}. ${esc(o.t)}</span>`:""}</div>`).join("")}</div>

  <div class="panel"><h3>Reflections <span class="tag">Instructor only</span></h3>
    ${REFLECT.map(r=>`<div style="display:grid;gap:4px"><strong>${esc(r.label)}</strong>${(rec.reflections?.[r.id]||"").trim()?`<p class="quote">${esc(rec.reflections[r.id])}</p>`:`<p class="muted">No answer.</p>`}</div>`).join("")}</div>

  <div class="panel"><h3>Learning preferences</h3><div class="grid2">
    ${["learn","feedback","autonomy"].map(k=>`<div><div class="eyebrow">${esc(PREFS[k].label)}</div><p>${p[k]!=null?esc(PREFS[k].options[p[k]]):"–"}</p></div>`).join("")}
    <div><div class="eyebrow">Situations that throw them off</div><p>${p.challenges?.length?esc(p.challenges.map(i=>PREFS.challenges.options[i]).join("; ")):"None selected"}</p></div></div></div>

  <div class="panel"><div class="row" style="justify-content:space-between"><h3>Agency summary</h3><button class="btn small ghost" id="regen">Refill from ratings</button></div>
    <p class="muted">Pre-filled from both sets of ratings and the student's preferences. Edit freely; one item per line for strengths and growth areas.</p>
    <div class="grid2">
      <label class="field">Strengths<textarea data-sum="strengths">${esc(E.summary.strengths)}</textarea></label>
      <label class="field">Growth areas<textarea data-sum="growth">${esc(E.summary.growth)}</textarea></label></div>
    <label class="field">Preceptor match<textarea data-sum="match" style="min-height:120px">${esc(E.summary.match)}</textarea></label>
    <label class="field">Instructor comments<small>Optional</small><textarea data-sum="comments">${esc(E.summary.comments)}</textarea></label>
    <label class="field" style="max-width:360px">Prepared by<input type="text" data-prep="1" value="${esc(E.preparedBy)}"></label>
    <div class="savebar"><span class="muted" id="save-state">${S.dirty?"Unsaved changes":(S.ratings[rec.key]?"Saved":"Not saved yet")}</span>
      <span class="row"><button class="btn" id="save-btn">Save review</button></span></div>
  </div>

  <div class="row" style="justify-content:space-between"><h3>Summary preview</h3>
    <span class="row"><button class="btn small ghost" id="copy-sum">Copy as text</button><button class="btn small" id="dl-sum" >Download summary</button></span></div>
  <article class="sheet" id="sheet">${summaryInner(rec,E)}</article>
  <pre id="plain-sum" hidden></pre>
  <div class="row"><button class="btn small danger" id="rm-imp">${S._confirmRemove?"Confirm: remove this student's record":"Remove this record"}</button><span class="muted">Use this for test submissions or duplicates.</span></div>`;
  bindDetail(rec);
}
function markDirty(){S.dirty=true;const s=$("#save-state");if(s)s.textContent="Unsaved changes"}
function refreshSheet(rec){const sh=$("#sheet");if(sh)sh.innerHTML=summaryInner(rec,S.edit)}
function bindDetail(rec){
  $("#sw-save")?.addEventListener("click",async()=>{const k=S._pendingSwitch;if(await saveReview(rec)){S._pendingSwitch=null;selectRecord(k)}});
  $("#sw-discard")?.addEventListener("click",()=>{const k=S._pendingSwitch;S.dirty=false;S._pendingSwitch=null;selectRecord(k)});
  $$("[data-instr]").forEach(s=>s.addEventListener("change",()=>{const v=+s.value||null;if(v)S.edit.instr[s.dataset.instr]=v;else delete S.edit.instr[s.dataset.instr];markDirty();renderDetail()}));
  $$("[data-acad]").forEach(i=>i.addEventListener("input",()=>{S.edit.academic[i.dataset.acad]=i.value;markDirty();refreshSheet(rec)}));
  $$("[data-sum]").forEach(t=>t.addEventListener("input",()=>{S.edit.summary[t.dataset.sum]=t.value;markDirty();refreshSheet(rec)}));
  $("[data-prep]")?.addEventListener("input",e=>{S.edit.preparedBy=e.target.value;markDirty();refreshSheet(rec)});
  $("#regen").addEventListener("click",()=>{Object.assign(S.edit.summary,autoSummary(rec,S.edit));markDirty();renderDetail();toast("Summary refilled")});
  $("#save-btn").addEventListener("click",()=>saveReview(rec));
  $("#copy-sum").addEventListener("click",()=>{const pre=$("#plain-sum");pre.textContent=summaryPlain(rec,S.edit);pre.hidden=false;copyText(pre.textContent,pre).finally(()=>{setTimeout(()=>pre.hidden=true,50)})});
  $("#dl-sum")?.addEventListener("click",async()=>{const base=`profile-${slug(rec.name)}`;const r=await saveFile(base+".html",summaryStandalone(rec,S.edit));if(r==="ext")await saveFile(base+".txt",summaryPlain(rec,S.edit))});
  $("#rm-imp")?.addEventListener("click",async()=>{
    if(!S._confirmRemove){S._confirmRemove=true;renderDetail();return}
    S._confirmRemove=false;
    try{await STORE.deleteResponse(rec.docId);await STORE.deleteReview(rec.key);S.selected=null;S.dirty=false;await loadInstructorData();toast("Record removed")}
    catch(e){toast("That record couldn't be removed. Try again.")}
  });
}
async function saveReview(rec){
  const btn=$("#save-btn"); if(btn){btn.disabled=true;btn.textContent="Saving…"}
  const body={...S.edit,updatedAt:new Date().toISOString(),recordKey:rec.key};
  try{await STORE.saveReview(rec.key,body);S.ratings[rec.key]=JSON.parse(JSON.stringify(body));S.edit=JSON.parse(JSON.stringify(body));S.dirty=false;toast("Review saved");renderReview();return true}
  catch(e){toast("The review didn't save. Check your connection and try again.");if(btn){btn.disabled=false;btn.textContent="Save review"}return false}
}
async function exportCSV(){
  const recs=allRecords();
  const head=["Name","Cohort","Email","Submitted","Source",...DOMAINS.flatMap(d=>[`${d.name} (self)`,`${d.name} (instructor)`]),"Mean gap (self - instr)","Scenario score",...SCENARIOS.map((s,i)=>`Call ${i+1} choice`),"Learns best","Feedback preference","Autonomy","Stressors","Strengths","Growth areas","Preceptor match"];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=recs.map(r=>{const e=S.ratings[r.key]||blankEdit();const cal=calibration(r,e);const p=r.prefs||{};
    return [r.name,r.cohort,r.email,r.submittedAt,r.src,...DOMAINS.flatMap(d=>[r.ratings?.[d.id]||"",e.instr?.[d.id]||""]),cal?cal.mean.toFixed(2):"",scenarioScore(r).total,
      ...SCENARIOS.map(s=>r.scenarios?.[s.id]||""),p.learn!=null?PREFS.learn.options[p.learn]:"",p.feedback!=null?PREFS.feedback.options[p.feedback]:"",p.autonomy!=null?PREFS.autonomy.options[p.autonomy]:"",
      (p.challenges||[]).map(i=>PREFS.challenges.options[i]).join("; "),listItems(e.summary?.strengths).join("; "),listItems(e.summary?.growth).join("; "),e.summary?.match||""].map(q).join(",")});
  await saveFile(`pre-internship-self-assessments-${new Date().toISOString().slice(0,10)}.csv`,[head.map(q).join(","),...rows].join("\n"));
}

/* ---------------- View switching ---------------- */
function showView(v){
  $("#view-form").hidden=v!=="form"; $("#view-review").hidden=v!=="review";
  $("#tab-form").setAttribute("aria-selected",String(v==="form")); $("#tab-review").setAttribute("aria-selected",String(v==="review"));
  $("#subline").textContent = v==="review" ? "Compare each student's self-ratings with yours and build the one-page summary for their agency." : "Complete this before your field internship begins. Plan on 15 to 20 minutes.";
  if(v==="review") renderReview();
}
$$("#tabs button").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));

/* ---------------- Boot ---------------- */
async function loadInstructorData(){
  const [responses,reviews]=await Promise.all([STORE.listResponses(),STORE.listReviews()]);
  S.records.responses=responses; S.ratings=reviews||{};
  if(S.selected&&!S.dirty&&S.ratings[S.selected])S.edit=JSON.parse(JSON.stringify(S.ratings[S.selected]));
  if(!$("#view-review").hidden)rerenderKeepingEdits();
}
function rerenderKeepingEdits(){
  const a=document.activeElement;
  if(a&&$("#view-review").contains(a)&&(a.tagName==="TEXTAREA"||a.tagName==="INPUT")){clearTimeout(rerenderKeepingEdits._t);rerenderKeepingEdits._t=setTimeout(rerenderKeepingEdits,1500);return}
  renderReview();
}
async function start(){
  const draft=lsGet(DRAFT_KEY);
  if(draft&&draft.ratings) S.form={...blankForm(),...draft,prefs:{...blankForm().prefs,...(draft.prefs||{})}};
  renderForm();
  S.canEdit=await STORE.isInstructor();
  if(S.canEdit){
    $("#tabs").hidden=false;
    await loadInstructorData();
    showView(location.hash==="#form"?"form":"review");
    return;
  }
  try{
    const d=await STORE.getMyResponse();
    if(d){S.existing=d;
      if(!draft)S.form={...blankForm(),...d,prefs:{...blankForm().prefs,...(d.prefs||{})},ack:true};
      renderForm();
      $("#form-status").innerHTML=`<div class="notice ok">You submitted this on ${esc(fmtDate(d.submittedAt))}. You can review or update your answers below until your instructors finalize your summary.</div>`;}
  }catch(e){}
}
start();

