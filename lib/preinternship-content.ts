// Pre-Internship Self-Assessment: question content (Rae's content.js, ported verbatim).
// Edit wording here. Keep every `id` and option `k` value stable once students
// have submitted, because saved responses reference them.
// Scenario option scores: 2 = best choice, 1 = acceptable, 0 = concern.
export interface SaPrefOption { label: string; options: string[]; match?: string[]; multi?: boolean }
export const SA_LEVELS: string[] = ["Needs direction","Developing","Consistent","Leads"];
export const SA_DOMAINS: { id: string; name: string; anchors: string[] }[] = [
 {id:"lead",name:"Scene leadership & control",anchors:[
  "I usually wait for my partner or instructor to tell me what to do when I arrive on scene.",
  "I can take the lead on simple calls, but I lose direction when the scene gets busy or loud.",
  "I assign roles, give clear direction, and keep most calls organized, including ones with multiple providers.",
  "I establish command within the first minute, adjust roles as the call changes, and others look to me for direction."]},
 {id:"judg",name:"Clinical judgment under pressure",anchors:[
  "I have trouble settling on a treatment plan without prompting, especially when time is short.",
  "I reach the right decisions, but slowly, and I second-guess myself when the patient changes.",
  "I make timely, protocol-based decisions and re-evaluate when the patient's condition changes.",
  "I anticipate what the patient will need next and commit to decisions even with incomplete information."]},
 {id:"crit",name:"Critical thinking & assessment reasoning",anchors:[
  "I follow the assessment steps, but I struggle to connect my findings to a likely cause.",
  "I form a field impression, but I tend to lock onto the first one.",
  "I build a short differential and use my assessment findings to narrow it.",
  "I look for findings that would prove my impression wrong and change course when they appear."]},
 {id:"pcom",name:"Patient & family communication",anchors:[
  "I find it hard to know what to say to patients and families, especially when they are upset.",
  "I communicate well with calm patients, but I get flustered with anxious or angry people.",
  "I adjust my language and tone to the patient and can calm most anxious patients and families.",
  "I build rapport quickly, de-escalate tense people, and explain care in terms anyone can follow."]},
 {id:"team",name:"Team communication & handoff",anchors:[
  "I rarely speak up during a call, and radio reports and handoffs intimidate me.",
  "I give directions and reports, but they can be incomplete, and I don't always confirm they were heard.",
  "I use closed-loop communication and give organized radio reports and hospital handoffs.",
  "I keep the whole team, including fire and other agencies, informed and working from the same plan."]},
 {id:"fdbk",name:"Receptiveness to feedback",anchors:[
  "Feedback often feels personal, and I tend to explain or defend what I did.",
  "I accept feedback, but I don't always change my approach on the next attempt.",
  "I ask for feedback, accept it without defending myself, and apply it on the next call.",
  "I seek out critique, reflect on my performance on my own, and track my progress over time."]},
 {id:"prof",name:"Professionalism & accountability",anchors:[
  "I sometimes struggle with punctuality, preparation, or finishing documentation on time.",
  "I meet expectations most of the time, but I need reminders about deadlines or details.",
  "I arrive prepared and on time, own my mistakes, and complete documentation accurately.",
  "I hold myself to a high standard without reminders and model professional conduct for classmates."]},
 {id:"comp",name:"Composure under stress",anchors:[
  "On high-stress calls I freeze or lose track of what I am doing.",
  "I stay functional under stress, but it shows and affects my communication or skills.",
  "I stay calm and organized on most high-acuity scenarios.",
  "I stay composed on the most chaotic calls, and my composure steadies the people around me."]},
 {id:"init",name:"Self-motivation & initiative",anchors:[
  "I do what is assigned, but I rarely look for extra work or learning.",
  "I take initiative when prompted or when I already feel comfortable with the task.",
  "I look for things to do on scene and between calls, and I study my weak areas on my own.",
  "I identify my own learning gaps and close them without being asked."]},
 {id:"advo",name:"Empathy & patient advocacy",anchors:[
  "I focus on the tasks of the call and sometimes overlook the patient's comfort or wishes.",
  "I show empathy when the call is calm, but it slips when I am busy.",
  "I treat every patient with respect and speak up for their needs and preferences.",
  "I advocate for patients even when it is inconvenient, including pushing back respectfully when care isn't right."]}
];

export const SA_SCENARIOS: { id: string; domain: string; title: string; text: string; options: { k: string; t: string; s: number }[] }[] = [
 {id:"s1",domain:"lead",title:"Two-vehicle collision, three patients",
  text:"You and your preceptor arrive first on a two-car collision with three patients. Your preceptor says, “This one is yours.” Two minutes later an engine company arrives, and the captain starts directing your partner without talking to you.",
  options:[
   {k:"A",t:"Introduce yourself to the captain, give a 15-second triage report, and ask for specific help with the patients you have assigned.",s:2},
   {k:"B",t:"Step back and let the captain run the scene, since fire has command.",s:1},
   {k:"C",t:"Keep working your own plan and redirect your partner back to the patient you assigned.",s:0},
   {k:"D",t:"Ask your preceptor to talk to the captain for you.",s:1}]},
 {id:"s2",domain:"crit",title:"Dispatched as an anxiety attack",
  text:"A 24-year-old woman was dispatched as an “anxiety attack.” Her family says she has panic attacks often. She is breathing fast, HR 128, SpO₂ 92% on room air, and reports sharp chest pain when she breathes in. She returned from an overseas flight two days ago. Your partner says, “Classic panic attack. Let’s coach her breathing and go.”",
  options:[
   {k:"A",t:"Agree with your partner. The history fits, and coaching her breathing is the right first step.",s:0},
   {k:"B",t:"Do the extra assessment quietly, but don’t raise your concern, to avoid a disagreement.",s:1},
   {k:"C",t:"Tell your partner you are concerned about a pulmonary embolism, complete a focused assessment, treat per protocol, and include your concern in the hospital report.",s:2},
   {k:"D",t:"Reassure the family that this looks like her usual panic attacks.",s:0}]},
 {id:"s3",domain:"fdbk",title:"Feedback in front of the crew",
  text:"After a call, your preceptor tells you in front of the crew that your hospital report was disorganized and left out the patient’s medication history.",
  options:[
   {k:"A",t:"Explain that the nurse kept interrupting you, so the report wasn’t really your fault.",s:0},
   {k:"B",t:"Thank them, ask what one change would have made the report better, and ask to give the report on the next call.",s:2},
   {k:"C",t:"Nod, say nothing, and vent to a classmate about it later.",s:0},
   {k:"D",t:"Agree in the moment, then ask privately afterward for specific examples.",s:1}]},
 {id:"s4",domain:"pcom",title:"Hostile bystander",
  text:"You are assessing an intoxicated 30-year-old with a scalp laceration outside a bar. His friend is getting louder, standing over you, and demanding that you “hurry up and take him to the hospital.”",
  options:[
   {k:"A",t:"Raise your voice and tell the friend to back off so you can work.",s:0},
   {k:"B",t:"Ignore the friend and keep working so you don’t encourage him.",s:0},
   {k:"C",t:"Stop patient care, move to the ambulance, and request law enforcement before continuing.",s:1},
   {k:"D",t:"Keep a clear exit, acknowledge the friend’s concern in a calm, low voice, give him a simple task, and ask your partner or law enforcement to stay close.",s:2}]},
 {id:"s5",domain:"prof",title:"Charting error after transfer",
  text:"After transferring care at the hospital, you realize you charted the wrong time for a medication you gave.",
  options:[
   {k:"A",t:"Leave it. The difference is only a few minutes.",s:0},
   {k:"B",t:"Change the original entry so the chart reads correctly.",s:0},
   {k:"C",t:"Add a correction or addendum following agency documentation policy, and tell your preceptor what happened.",s:2},
   {k:"D",t:"Tell your preceptor and ask how they want you to handle it.",s:1}]}
];
export const SA_REFLECT: { id: string; req: boolean; label: string; help?: string }[] = [
 {id:"r1",req:true,label:"Describe a lab scenario or clinical shift where you lost control of the scene or felt behind. What happened, and what would you do differently?"},
 {id:"r2",req:true,label:"What feedback have you heard more than once from instructors or preceptors?"},
 {id:"r3",req:false,label:"Is there anything you want your field preceptor to know about you before your first shift?",help:"Optional. This answer is included in the summary your agency receives."}
];
export const SA_PREFS: Record<"learn" | "feedback" | "autonomy" | "challenges", SaPrefOption> = {
 learn:{label:"When you are learning a new skill or call type, what helps most?",options:[
  "Watching my preceptor do it first","Talking through the plan before the call","Jumping in with coaching as I go","Reviewing it on my own, then trying it"],
  match:["Learns best by watching first, then performing.","Learns best when the plan is talked through before the call.","Learns best hands-on, with coaching during the call.","Learns best with time to review independently before performing."]},
 feedback:{label:"When you make a mistake, what kind of feedback helps you most?",options:[
  "Immediate and direct, in the moment when it is safe","A private debrief after the call","A short written note I can review later","A mix, depending on the mistake"],
  match:["Prefers immediate, direct feedback in the moment.","Prefers a private debrief after the call.","Prefers short written feedback to review later.","Responds to a mix of in-the-moment and debrief feedback."]},
 autonomy:{label:"Early in internship, how much do you want to lead?",options:[
  "Lead calls from day one, with my preceptor as backup","Lead lower-acuity calls and observe critical ones at first","Observe for my first few shifts, then take over gradually"]},
 challenges:{label:"Which situations tend to throw you off? Choose any that apply.",multi:true,options:[
  "Chaotic or multi-patient scenes","Hostile patients or bystanders","Pediatric patients","Critical or arresting patients","Radio reports and hospital handoffs","Documentation","Working alongside fire or other agencies","Being watched or evaluated"]}
};

