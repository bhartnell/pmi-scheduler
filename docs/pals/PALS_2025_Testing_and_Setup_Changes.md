# PALS 2025 — Testing & Course-Setup Changes (the stuff that bites late)

**Source:** AHA PALS 2025 Instructor Manual, **Module 4 (Testing)**, OCR'd verbatim.
**Why this file:** Ben's warning — *provider content barely changes between editions, but
class setup and testing change a lot, and we found out afterwards last time.* This is the
pre-emptive sweep.

---

## ✅ RESOLVED — the Team-Leader / "pass 2 of 3" tension

I flagged this as blocking. **The 2025 manual answers it directly:**

> *"Completion of **2 PALS case scenario tests as Team Leader or a team member**"*
> *"PALS Case Scenario Test 1 — cardiac (**as Team Leader or a team member**)"*

So a student does **NOT** have to lead twice. AHA's letter is satisfied by participating in 2
case scenario tests **as TL *or* as a team member**. Our run model (one graded TL per station,
new TL each station, everyone else participates) **complies as-is.**

The program's team-lead tracking is therefore a **higher internal standard**, not an AHA
requirement — exactly the letter-vs-intent position we took for ACLS. Nothing to change in
the run; the data model just must not *require* 2 TL runs per student to compute a pass.

**AHA minimum = 2 case scenario tests (1 cardiac + 1 respiratory or shock). Program runs 3
(Shock/Respiratory/Cardiac) and requires passing 2.** Program exceeds AHA. Good.

---

## ⚠ CHANGE #1 — Skills stations ARE individually tested and tracked

**This contradicts our current build assumption** ("skills = plan-only, no per-student
tracking"). AHA 2025 requires each student to **individually** pass these, with competency
checklists, for course completion:

| Skills test | Requirement |
|---|---|
| **Child CPR and AED Skills Test** | Full checklist; CPR feedback device **required** |
| **Infant CPR Skills Test** | Full checklist; feedback device **preferred** |
| **Bag-Mask Ventilation Skills Test** | *"All PALS students must participate in the Airway Management lesson and must pass the Bag-Mask Ventilation Skills Test."* Effective BMV for **1 minute** during a respiratory-arrest scenario, **including inserting an OPA** |
| **Airway Management** competency | *"Each student must individually demonstrate the psychomotor skills of managing a respiratory emergency"* |
| **Vascular Access (IO)** competency | *"Each student must individually **discuss indications and contraindications** for IO access **and demonstrate** the psychomotor skills of IO access"* |
| **Rhythm Disturbances / Electrical Therapy** competency | *"Each student must individually demonstrate the psychomotor skills"* |

**Consequence for the build:** the PALS skills stations need **per-student pass/fail records**,
not just a line on the day plan. Ben — you said "skills don't need tracked other than in the
plan itself," but you also said you couldn't remember. **2025 says they do.** This is a real
scope change; flagging before it's discovered on class day.

*(AHA note: these skill evaluations **may be incorporated into the PALS case scenario tests**
if desired — an option worth taking to save station time.)*

---

## ⚠ CHANGE #2 — Scope of practice = N/A grading (per Ben's clarification)

The class is mixed-discipline (paramedic, RN, MD, RT). AHA marks some steps
*"evaluated only if the student's scope of practice applies."* Practically:

- RN generally **cannot intubate** → advanced-airway steps = **N/A**
- Paramedic generally **has no antibiotics** → "directs administration of antibiotics" = **N/A**
- Out of scope ⇒ **not graded, not a failure — N/A.**

**Therefore the pass rule is: ALL *IN-SCOPE* STEPS CHECKED** — *not* "no blank boxes."
An N/A step is not a blank box.

Build requirement: every criterion result needs a third state — **checked / not-checked / N/A** —
and ideally a **student discipline (scope profile)** that pre-suggests N/A. This is broader than
the one block AHA explicitly flags.

*(Correction to my earlier alarm: I said a medic could "pass septic shock without being scored on
antibiotics." For a paramedic that's the **correct** outcome — N/A. The real defect is only that
the antibiotics criterion is **absent from our seed**, so there's nothing to mark N/A.)*

---

## ⚠ CHANGE #3 — "No hints" rule vs the scripted prompts

Module 4: *"Students must demonstrate competency during PALS testing **without any assistance,
hints, or prompting from the instructor.**"*

But the case-scenario checklists contain **scripted prompts** (*"If the student does not verbalize
the above, prompt the student with the following question…"*).

**These are not in conflict — but instructors must know the line:** the **scripted prompt printed
on the checklist is sanctioned** and part of the test; **any other coaching, hint, or comment is
not.** The app should show the scripted prompt verbatim and nothing more.

Also required: *"Explain clearly to the students which actions, if not performed correctly, will
result in a 'no pass' (eg, failure to confirm airway placement, shocking a perfusing rhythm)."*
→ Critical actions must be **briefed up front**, and modeled as `is_critical` on criteria.

---

## ⚠ CHANGE #4 — Retesting & remediation rules (hard deadlines)

- May **immediately retest once** if time permits during skills testing.
- Further retesting happens at the **end of course, in the remediation lesson.**
- On retest, **test the entire skill**, not just the failed step.
- **Remediation and retesting must be completed within 30 days.**
- Substantial remediation ⇒ recommend the student **repeat the full PALS course.**
- Any student who **fails any skills test** should be referred back to the full course.

**Build:** attempts need a `retest_of` link and a **30-day remediation clock** the app can surface.

---

## ⚠ CHANGE #5 — CPR Coach is a formal tested role

Skills-testing directions: *"In groups of 3 or 4, assign a **CPR Coach**… performs the role of the
AED/Monitor/Defibrillator and does not switch… 5-minute rounds with at least 1 compressor switch…
**Ensure that every student has a chance to practice the CPR Coach role.**"*

→ Affects **station setup and group sizing** (groups of 3–4; rounds = number of students in group).

---

## Universal grading vocabulary (confirmed across ALL 2025 checklists)

**PASS / NR** (needs remediation), circled. Any blank check box ⇒ NR. Per student, with
Instructor Initials + Instructor Number + Date. Free-text remediation note.
Same on BLS skills checklists **and** case scenario checklists — one consistent model.

---

## Still to verify (not yet read)
- **Module 6 (lesson plans)** — the 2025 lesson/station structure & timings vs our 2020 schedule.
  This is the *other* place "class setup" changes hide. **Recommend I sweep it next.**
- Written exam pass threshold for 2025 (2020 = 84%, open book) — confirm.
