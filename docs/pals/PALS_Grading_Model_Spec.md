# PALS Grading Model — Spec (built to AHA 2025, not to our ACLS schema)

**Source:** AHA PALS 2025 Instructor Manual — Module 4 (Testing) + Module 5 Appendix A
(all 12 PALS Case Scenario Testing Checklists), OCR'd verbatim.
**Directive (Ben):** match the AHA PALS criteria. Do **not** bend PALS to fit the ACLS schema.

---

## 0. Scope of the app's grading — DECIDED

| Area | In the app? | Model |
|---|---|---|
| **Scenario practice** | **YES — grade in app** | 0–4 rubric (existing `scenario_assessments`), same as ACLS practice |
| **Scenario testing** | **YES — grade in app** | AHA PALS checklist → PASS / NR (§2) |
| **Skills stations** | **NO grading page** | Verified in class by the instructor; app stores an **attestation + printable completed sheet** for the student file (§4) |
| **Written exam** | Existing handling | ≥84% (confirm 2025 threshold) |

**Rationale (Ben):** he teaches a full semester of airway management and a semester of
pediatrics; students already practice pediatric intubation well before PALS. Skills are
verified continuously in class and are easy to remediate. Historical base rate: **1 skill
failure in several hundred students** (intubation). Building a per-criterion skills grading
UI would be effort spent on the rarest path.

**This mirrors ACLS**, where BLS is graded on a separate existing skill sheet and is *not* a
mechanism inside the ACLS app.

---

## 1. What we would have gotten wrong by reusing the ACLS model

1. **Pass rule is all-or-nothing, not holistic.** AHA PALS: *any blank check box ⇒ the student
   must receive remediation.* Our seed said "instructor-set group Pass/Fail" (the ACLS megacode
   rule). Wrong for PALS. **(But see §3 — "all steps" means all *in-scope* steps.)**
2. **Outcome is PASS / NR (Needs Remediation), per student** — literally circled on the sheet.
   Not Pass/Fail, not a group result. Every sheet carries Student Name, Instructor Initials,
   Instructor Number, Date.
3. **PALS has no algorithm-segment chain.** ACLS megacode = ordered rhythm-driven segments.
   PALS = **one flat list of "Critical Performance Steps"** per pathophysiology. The earlier
   "team_leader + patient_management segments" modeling was a shoehorn.

### Content gap in the current seed
Seed criteria were reverse-engineered from the **Group-13 (2020) Google form** and are stale:
septic shock is **missing "Directs early administration of antibiotics (within first hour)"**;
there is **no obstructive-shock checklist** (DOPE mnemonic, 2 causes); **every scripted
instructor prompt** is absent; **scope-conditional steps** are absent. Also the case_codes
`PALS_TEST_7/9/13` are **2020 numbers** — 2025 keys by category+subtype.
⇒ **Replace all 12 checklists verbatim from 2025.** See `PALS_2020_vs_2025_Contamination_Guard.md`.

---

## 2. The actual AHA PALS checklist structure

Identical across all 12:

```
PALS Case Scenario Testing Checklist
<Category> Case Scenario — <Subtype>
Student Name ______   Date of Test ______

Critical Performance Steps                    | Check if done correctly
 1. Assigns team member roles                            [ ]
 2. Uses effective communication throughout              [ ]
 3..n <patho-specific management steps>                  [ ]
        └─ optional scripted instructor prompt
 [conditional block] "The following step is evaluated
  only if the student's scope of practice applies"
        └─ <step> + optional prompt                      [ ]

STOP TEST

Instructor Notes: all steps checked; any blank ⇒ remediation.
                  Free text: which skills require remediation.
Test Results:     Circle  PASS  /  NR
Sign-off:         Instructor Initials __  Instructor Number __  Date __
```

**Team-leader preamble:** steps 1–2 ("Assigns team member roles", "Uses effective communication
throughout") are the first two Critical Performance Steps of **every** checklist — a reusable
preamble, not a separate gradable segment.

**Scripted prompts are part of the test.** *"If the student does not verbalize the above, prompt
the student with the following question/statement: '…'"* — sometimes a question, sometimes a
statement. The app must display the **exact wording**. AHA also forbids **any other** hint or
coaching (*"without any assistance, hints, or prompting"*) — printed prompt = sanctioned;
anything else = not.

---

## 3. Scope of practice = N/A grading  ⚠ (drives the pass rule)

The class is mixed-discipline: paramedic, RN, MD, RT. A step outside the tester's scope is
**not graded and is not a failure — it is N/A.**

- RN generally cannot intubate ⇒ advanced-airway steps **N/A**
- Paramedic generally has no antibiotics ⇒ "directs administration of antibiotics" **N/A**

> **PASS RULE: all *IN-SCOPE* steps checked.** An N/A step is **not** a blank box.

This is broader than the single block AHA explicitly marks scope-conditional — it's a general
capability. Requirements:

- every criterion result has three states: **checked / not-checked / N/A**
- students carry a **discipline / scope profile** (paramedic | RN | MD | RT | other) that
  **pre-suggests** N/A, instructor-overridable
- criteria carry `scope_conditional` (AHA-marked) **and** can be marked N/A ad hoc by scope

---

## 4. Skills — attestation + printable record (NO grading UI)

Skills are verified **in class**, not clicked through in the app. But AHA still requires a
completed competency record per student. So:

**Required skills records (per student):** Child CPR & AED · Infant CPR · **Bag-Mask
Ventilation** (1 min effective BMV incl. OPA, respiratory-arrest scenario) · Airway Management ·
Vascular Access / IO (discuss indications & contraindications **and** demonstrate) ·
Rhythm Disturbances / Electrical Therapy.

**Model:**
```
pals_skill_completions   id, student_id, skill_key, cert_course='pals',
                         status (pass | fail | remediated),      -- default pass on attest
                         verified_by (instructor_id), verified_at,
                         instructor_initials, instructor_number,
                         signature,                              -- simple attached signature
                         remediation_notes                       -- only when fail/remediated
```
- **Bulk attest** the roster as complete/passed (the normal path).
- **Exception path:** mark an individual **fail + remediation documentation** when it happens.
- **Export:** the student's download/export file must contain a **printable, completed AHA
  skills competency sheet** — pre-filled as passed, with signature, instructor number, date.
  This is the artifact that lives in the student's file.

**Not required:** per-criterion tap-through grading screens for skills.

---

## 5. Testing attempts (scenarios) — data model

**Share:** scenario bank (`cert_course='pals'`), scheduling, roster/instructors, team-lead
tracking (`team_lead_id` / `team_lead_log` — spans practice **and** testing), and the 0–4
practice rubric (`scenario_assessments`).

**PALS-faithful grading (its own structure — NOT the ACLS segment chain):**
```
pals_checklists           id, scenario_id, category(resp|shock|cardiac), subtype,
                          content_version 'AHA 2025', pass_rule 'all_in_scope_checked'

pals_checklist_criteria   id, checklist_id, order, text,
                          instructor_prompt,            -- nullable, verbatim
                          prompt_kind (question|statement),
                          scope_conditional (bool),
                          is_critical (bool)            -- forces no-pass; briefed up front

pals_test_attempts        id, checklist_id, student_id, instructor_id, lab_station_id,
                          attempted_at, result (PASS|NR), remediation_notes,
                          instructor_initials, instructor_number,
                          retest_of (nullable FK),      -- retest linkage
                          client_uuid                   -- offline dedup

pals_criterion_results    id, attempt_id, criterion_id,
                          state (checked | not_checked | na)
```

**Course completion (aggregation):** AHA = **2 case scenario tests, as Team Leader *or a team
member*** (1 cardiac + 1 respiratory or shock). Program runs **3** (Shock / Respiratory /
Cardiac) and requires **2 of 3 PASS**. ⚠ **Pass must NOT require 2 team-lead runs per student** —
that is not the AHA rule. TL tracking is the program's higher internal standard.

**Retest / remediation:** may immediately retest once if time permits; otherwise retest in the
end-of-course remediation lesson. Retest the **entire** skill/scenario. **Remediation and
retesting must complete within 30 days** — the app should surface that clock.

**Critical actions:** must be briefed to students up front (e.g. failure to confirm airway
placement, shocking a perfusing rhythm) and force a no-pass ⇒ `is_critical`.

---

## 6. Offline
Same hard requirement as the ACLS megacode station — this is certification testing on a tablet.
`client_uuid` dedup on `pals_test_attempts`, local persistence surviving reload and sustained
outage, sync on reconnect.
