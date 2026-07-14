# PALS Day Hub — Phase-by-Phase Build Plan (self-contained)

**For:** Claude Code (clone or manual session)
**Mode:** Work through the phases AUTONOMOUSLY — do NOT stop and wait for a human "next move" between phases. Report each phase on the Notion board, but keep moving. HALT + flag Ben **only** at destructive/risky steps (see Autonomy Rules).
**Why self-contained:** chat compression keeps dropping PALS context, so this file is the source of truth — everything you need is here, not in chat history.

---

## Goal
Build a **PALS "day hub"** — one page per PALS day that runs the whole day — mirroring the **existing ACLS hub** already built on the webapp. Same shape, PALS data.

## Reference model (build to this, don't invent)
The **existing ACLS hub** (already built + working — read its code FIRST). The PALS hub adapts it. **Best approach: make the ACLS hub AHA-generic** (parametrize `cert_course = acls | pals`) so ONE hub renders both. Do NOT build from scratch. Keep ACLS + PALS parallel so they can be changed together later.

## What the hub shows (per day)
1. **Timed schedule** (agenda: start time, duration, lesson/activity, instructor)
2. **Grouped sections**, each = **station cards** carrying: room, instructor, scenario, **PDF link**, **grading link**
3. **Aggregated read-only tracker** with links
4. **Team-Lead coverage per student** — threshold **≥2 TL each** in PRACTICE (AHA 2025, Module 6 Lesson 12: every student is TL at least TWICE). 6 students × 12 practice cases = exactly 2 each — **warn when any group exceeds 6** (breaks compliance). TESTING is separate: a student satisfies it as TL **or team member**, so testing does NOT require 2 TL runs. Aggregate `team_leader` from `pals_test_attempts` (practice); per-student grid; flag <2 vs ≥2.
5. **Group rosters**
Reached from an **all-day calendar event** (created by selecting cohort + date).

## Content source — READ THIS (NOW AVAILABLE)
Populate content ONLY from the **AHA-2025** files (delivered by the AHA chat, commit to `docs/pals/`):
- `PALS_2025_Day_Structure.md` — the schedule, lab sections, station structure, scenario assignments
- `pals_scenario_seed.json` **v2.0 / content_version "AHA 2025"** — 12 checklists + scenarios (SUPERSEDES the v1.0 2020 seed)
**Verified:** the DB already holds the v2.0 (2025) checklists — all 12 keys + criteria match, incl. `shock_obstructive` and `shock_distributive` (14, with antibiotics). Grading content is correct 2025.
**Do NOT use the old PALS 2020 spreadsheet content.**

### Structure from the 2025 day-structure file (build sections to THIS):
- **Section A — Learning Stations:** **3** stations (Airway 7C, Vascular/IO 8C, Rhythm 9C), 20 min each, ratio 6:1. **NOT graded in app** — attestation + printable competency sheet.
- **Sections B/C/D — Practice:** **4** stations, rotate, NEW TL each rotation, 25 min/case. **Graded formative** (checklist mirrors the testing checklist + 0–4 TL rubric, **NO PASS/NR**). 12 cases total (4 Resp, 4 Shock, 4 Arrhythmia).
- **Section E — Testing:** **4 stations × 3 synchronized rounds** × 25 min. All 4 stations run the SAME case per round; one graded TL per station per round, others = team members. **PASS 2 of 3, PASS/NR.** Program uses **instructor-SELECTED cases** (not AHA's random draw) — hub must support selection, not force a draw.
- ⚠ **Day 1 runs to ~17:30** per AHA 2025 durations (real overflow) — do NOT silently trim; flag Ben.

---

## Phases

### Phase 1 — Read + map (read-only, no changes)
Read the ACLS hub code, the `pals_*` tables, and the existing PALS days (G14: `6aec40f8` 7/16, `e319dc4b` 7/17). Map how the ACLS hub renders schedule/sections/TL-grid so PALS mirrors it exactly. Post the plan to the board.

### Phase 2 — AHA-generic hub structure (additive)
Adapt the ACLS hub to render by `cert_course` (acls | pals). Build the PALS hub page: schedule + sections + station cards + TL grid, reading PALS data. Additive — keep the ACLS hub working unchanged. Merge when `tsc`/build clean AND verified by **loading the page**.

### Phase 3 — Station direct-links (Ben's requested feature)
On **both** ACLS + PALS hubs: make the **big station card** (the one with the station + assigned instructor) link **directly to that lab station** — not just to the lab day. Right now only the small top-corner section buttons are clickable; Ben wants the whole station card to be a direct link to its station. Do it on both hubs so they stay parallel.

### Phase 4 — Calendar entry point (additive)
The PALS day shows as an **all-day calendar event**; clicking it opens the hub. The create-day flow = **select cohort + date** (same as ACLS).

### Phase 5 — Content population (WAITS on `docs/pals/PALS_2025_Day_Structure.md`)
When that file exists: populate schedule + sections + scenario assignments from it. **Never** use the 2020 sheet. Ben builds the station-card details via the normal lab UI; the hub just displays them. If the file is absent or ambiguous, HALT and flag Ben.

### Phase 6 — TL tracking + verify
Wire the TL coverage: **≥2 TL per student in PRACTICE** + **warn when a group exceeds 6**. Verify the whole hub by **loading it** — report the working URL and confirm G14's schedule, sections, and TL grid render.

---

## Autonomy Rules (the key change Ben wants)
- **Work Phases 1→4 and 6 autonomously.** Report each on Notion but do NOT wait for a human between them.
- **HALT + flag Ben before:**
  - any **destructive** op (delete/overwrite existing data, drop tables, remove features)
  - any change to **G14's ACLS data** (`aebf842d` / `26e3efe1` — 32 attempts; **never touch**)
  - any **schema change beyond additive**
  - **Phase 5** if the AHA-2025 content file is missing/ambiguous
- **Claim-first:** mark In Progress + check for open PRs before starting each phase.
- **Merge** additive completed work; don't strand drafts. Distinguish "PR opened" from "merged/live."
- **Verify by loading pages**, not by DB queries or "done" reports.
- **Data-integrity:** never fabricate content; use the AHA-2025 file or leave it null.

## Guardrails
- **Additive only** unless Ben explicitly oks a destructive step.
- **Desktop-first / wide** (NOT vertical/mobile-first).
- **Never touch G14 ACLS data.**
- Report **actual** progress per phase on the board.

---

## What's already done (don't redo)
- `pals_*` tables, 12 checklists, 150 criteria — loaded
- 16 scenarios `narrative_status='complete'` with narratives — loaded
- PASS/NR grading model — Ben's decision; the shipped grading UI already grades PALS practice + testing PASS/NR (zero new code needed for scoring)
- The dedicated **testing section** structure (Day 2, T7/T9/T13) — correct, keep it
- G14's two PALS days exist (7/16 practice w/ 12 stations, 7/17 testing w/ 3 stations) — Ben may restructure into sections himself; ASK before clearing
