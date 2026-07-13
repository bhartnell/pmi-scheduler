# PALS — 2020 vs 2025 Contamination Guard

**Purpose:** the Group-13 run (Google Suite, **PALS 2020**) is a **process reference only.**
Its *shape* is good and we keep it. Its *content, numbering, and grading rules* must NOT
enter the 2025 build. This file is the checklist that keeps them apart.

**Rule:** 2025 (Module 5 appendix) is the single source of truth for **content, numbering,
criteria, and pass rules.** 2020 informs **process only**.

---

## ⚠ Contamination already present in our seed (must purge)

These came from the 2020 Google form and are in `pals_scenario_seed.json` right now:

| # | 2020 artifact in the seed | Why it's wrong for 2025 | Fix |
|---|---|---|---|
| 1 | **case_codes `PALS_TEST_7_…`, `PALS_TEST_9_…`, `PALS_TEST_13_…`** | 7/9/13 are **2020 scenario-bank numbers**. In 2025 the testing checklists are **not numbered** — they're organized by **category + subtype** (Appendix A). Same mistake we made on ACLS. | Re-key to category/subtype codes (e.g. `PALS_TEST_SHOCK_DISTRIBUTIVE`). No numeric carryover. |
| 2 | **Testing criteria** (reverse-engineered from the Google form) | 2020 criteria. Missing 2025 steps — most seriously, **septic shock is missing "Directs early administration of antibiotics (within first hour)."** | Replace all 12 checklists **verbatim from 2025**. |
| 3 | **"Group Pass/Fail" grading model** | That's the ACLS megacode rule + the 2020 form's shape. **2025 PALS = every box must be checked; any blank ⇒ NR.** Result is **PASS / NR**, per student. | Adopt the 2025 model (see `PALS_Grading_Model_Spec.md`). |
| 4 | **Only 3 testing scenarios** | 2020 run used 3 (7/9/13). **2025 has 12** (4 Respiratory · 4 Shock · 4 Cardiac). | Load all 12; pick 3 per test day. |
| 5 | **Patient demographics** | 2020 Testing 7 = Distributive Shock, **Infant; 4-month-old, 5.1 kg, HR 192**. 2025 Distributive practice case = **Adolescent**. Different patient entirely. | Never mix a 2020 card with a 2025 checklist. |

---

## ✅ What we KEEP from the 2020 run (process — safe to carry)

Confirmed from `PALS Schedule (1).xlsx`, Day 2:

- **Testing = synchronized rounds.** *"All instructors have the same scenarios, and go in the
  order of 7, 9, 13"* — i.e. every station runs the **same scenario at the same time**, then
  rotates. This confirms your 4-station × 3-round model (2025 will use the 2025 checklists,
  not 7/9/13).
- **25 minutes per testing scenario.** Testing block 13:30–14:45 = 75 min = 3 × 25. Use 25 min
  as the real rotation length (not a guess).
- **New Team Leader at each station.**
- **Pass 2 of 3; all 3 required (Shock, Respiratory, Cardiac).**
- **Day-1 learning stations:** Airway Management (7C), Vascular Access / IO (8C), Rhythm
  Disturbances & Electrical Therapy (9C) — run as **2 stations** (1 synchronized cardioversion,
  1 defibrillation).
- **Day-2 practice flow:** 4 scenarios per group (08:40–11:10) → break → 4 more (11:20–12:30).
- Instructor-per-station assignment pattern and room layout (Classroom 1 / Lab Tables / Lab
  Room 1 / Lab Room 2).

---

## ⚠ Two things in the old sheet that are errors — do not copy

1. **Crossed labels.** The Day-2 sheet maps *"Scenario 2 – Respiratory"* → `Testing scenario 9
   Cardiac.pdf` and *"Scenario 3 – Cardiac"* → `Testing scenario 13 Respiratory.pdf`. Those are
   **swapped**. The real order was **7 (Shock) → 9 (Cardiac) → 13 (Respiratory)**.
2. **"3 stations" vs 4.** The sheet says *"students rotate between 3 stations"* but lists **4
   instructors and 4 rooms**. Your description is 4 stations × 3 rounds. Going with **4 stations,
   3 rounds** — flagging in case the old run genuinely used 3.

---

## ⚠ OPEN QUESTION — the team-lead / pass-2-of-3 tension (needs your call)

AHA says a student must **pass 2 case scenarios as Team Leader** (1 cardiac + 1 respiratory or
shock). But the run model is **one TL per station, new TL at each station** — across 3 rounds a
given student can only lead **once**, not twice.

So either:
- **(a)** each student leads **once**, and the "2 of 3" is satisfied program-wide by combining
  **practice + testing** TL sheets (the same letter-vs-intent argument we made for ACLS); or
- **(b)** students actually lead **more than once** across the rounds, and pass is computed per
  student across their own TL runs.

**This determines how pass is computed per student in the data model**, so I need your answer
before wiring it. How did it actually run?
