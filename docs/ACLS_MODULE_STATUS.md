# ACLS / Advanced-Cert Testing Module — Status & Open Decisions

_Generated 2026-06-15. Exportable handoff: current technical state of the
build, how grading flows, what the schedule requires, and the open decision(s)
awaiting a call. Safe to paste into another chat for design review._

---

## 1. What is already built, committed, and live

All UUID PKs/FKs (the original spec's BIGSERIAL was corrected). Direct-to-main,
deployed.

### Step 1 — Schema (commit `421c2d34`, migration applied)
Seven net-new `adv_cert_*` tables:

| Table | Purpose |
|-------|---------|
| `adv_cert_segments` | Reusable algorithm-segment library (CPR Quality, VF Mgmt, …). `key` + `cert_course` is the natural key. `always_present`, `content_version`. |
| `adv_cert_segment_criteria` | The checklist line-items under each segment. `display_order`, optional `is_critical` (informational, NOT auto-fail). |
| `adv_cert_scenario_segments` | Assembly: orders segments into a scenario (`scenario_id` → existing `scenarios`, `segment_id`, `sequence_order`). "The assembly IS the schema." |
| `adv_cert_test_attempts` | One group's scored run. `lab_day_id`, `lab_station_id`, `lab_group_id`, `scenario_id`, `team_lead_id`→students, `grader_id`→lab_users, `overall_result` (instructor-set pass/fail), `client_uuid` (UNIQUE, offline dedup). |
| `adv_cert_attempt_students` | Which students were on the tested team (attempt_id, student_id). |
| `adv_cert_segment_results` | Per-segment pass/fail + comments for an attempt. |
| `adv_cert_criterion_results` | Per-criterion met/not-met under each segment result. |

Tagging/grading columns added to EXISTING tables:
- `scenarios`: `grading_model`, `case_code`, `cert_course`, `cert_tier`, `scenario_scope` (+ partial-unique `(case_code, cert_course)`)
- `skills`: `cert_course`, `cert_tier`
- `skill_drills`: `cert_course`, `cert_tier`
- `lab_days`: `is_adv_cert_testing` (parallel to `is_nremt_testing`, NOT overloaded), `cert_course`

CHECK constraints on the closed enums (`cert_course` ∈ acls|pals; `cert_tier` ∈
skill|learning_station|megacode_practice|megacode_testing; `grading_model` ∈
scenario_assessment_0_4|adv_cert_checklist; `scenario_scope` ∈ full|skill_focused_mini).
`algorithm_type` deliberately left free text (so PALS pediatric rhythms drop in).
RLS enabled (authenticated read; writes via service-role API routes).

### Step 3 — Online megacode grading (commit `fe165b37`, build green)
- `lib/adv-cert.ts`: `listScenarios`, `getScenarioWithSegments`, `saveAttempt`, `listAttemptsForDay`
- `types/adv-cert.ts`: all interfaces + `ADV_CERT_SCALE` (0–4 reference constant)
- API: `/api/adv-cert/scenarios`, `/scenarios/[id]`, `/grading-context`, `/attempts`
- UI: `app/labs/adv-cert/grade/page.tsx` — course → testing day → group → team-lead + members → drawn scenario → segment/criteria checklist + per-segment pass/fail + instructor-set overall pass/fail
- Nav: "Megacode Grading" tile on the Labs hub
- `saveAttempt` writes the full graph + a best-effort `team_lead_log` row for the
  test team-lead; idempotent on a client-minted `client_uuid` (offline-ready
  from day one — the offline phase can build on this without schema change)
- Verified via a full live round-trip inside a rolled-back transaction
  (nothing persisted)

### Step 2 — Importer (BUILT, dry-run clean, NOT yet written to prod)
- `scripts/import-acls-seed.js` — idempotent SELECT-then-write upsert (mirrors
  the skill-drills importer): segments by `(key, cert_course)`, scenarios by
  `(case_code, cert_course)`. Re-runnable; updates in place; deactivates extra
  criteria rather than deleting (preserves FK references from any recorded
  results). `--dry-run` runs the whole thing in a transaction and rolls back.
- Dry-run result against live: **9 segments, 41 criteria, 20 scenarios, 40
  assembly rows — all new, 0 conflicts.**

---

## 2. Two grading paths (this is the core design)

| Path | Grading model | Storage | Used by |
|------|---------------|---------|---------|
| **0–4 rubric** | `scenario_assessment_0_4` | EXISTING `scenario_assessments` table + EXISTING `/labs/grade/station` page | Single-rhythm + brady/tachy learning-station cases (`CASE_34/36/39/40`, `CASE_16/17/26/27`). **No new code — already works today.** |
| **Megacode checklist** | `adv_cert_checklist` | NEW `adv_cert_*` tables + NEW `/labs/adv-cert/grade` page | Megacode practice (`CASE_48–55`) and megacode testing (`MEGACODE_TEST_*`). Scenario → ordered reusable segments → per-segment criteria checklist → per-segment results + an instructor-rendered GROUP pass/fail. |

Both are tagged with `cert_course='acls'` + `cert_tier`. The discriminator is
`grading_model` on the scenario row.

---

## 3. What the schedule seed requires (acls_schedule_seed.json)

Megacode testing is **Day 2 only.** Day 1 never touches the new engine.

| When | Block | Grading | Cases | Engine |
|------|-------|---------|-------|--------|
| Day 1 afternoon (14:15) | Cardiac Arrest scenarios | rubric_0_4 | CASE_34/36/39/40 | EXISTING 0–4 |
| Day 2 09:30 | Brady/Tachy scenarios | rubric_0_4 | CASE_16/17/26/27 | EXISTING 0–4 |
| Day 2 10:45 | **Megacode PRACTICE** | megacode_checklist | CASE_48–55 (full 5-segment chains) | NEW adv_cert |
| Day 2 14:05 | **Megacode TESTING (SCORED)** | megacode_checklist, `is_adv_cert_testing` | MEGACODE_TEST_2/4/9/10 (**empty chains** — assemble from live test card) | NEW adv_cert |

Implication: the first real use of the new engine is **Day-2 morning practice**
(content complete). The 4 empty test cards only affect **Day-2 afternoon**.

---

## 4. THE OPEN DECISION — megacode grading pool scope

The new grader's scenario picker currently filters to `cert_tier =
'megacode_testing'`. Because the 4 test cards are empty, that view would show 4
ungradeable scenarios. Options:

### Option A — Show BOTH practice + testing tiers  ✅ recommended
- **Change:** `listScenarios` + the `/scenarios` route accept both tiers; the UI
  requests `megacode_practice,megacode_testing` and labels it "Megacode scenarios."
- **Effect:** Day-2 practice (8 full cases) is gradeable in the new engine
  immediately. The 4 test cards still appear, marked "no segments yet" until
  assembled.
- **Cost:** ~10-line change to the route + lib + one UI string. No schema change.
- **Risk:** an instructor could pick a practice case during the scored block —
  mitigated by labeling and by the day's `is_adv_cert_testing` context.

### Option B — Testing tier only; assemble the 4 cards first
- **Change:** none to the pool. You provide the live test-card sequences; I add
  4 `adv_cert_scenario_segments` assemblies (data only, via the importer or a
  small add).
- **Effect:** the scored block grades exactly the real test cards; practice
  cases would NOT appear in the new grader (they'd have to be added to the pool
  separately if you want to grade practice with the new engine).
- **Cost:** blocked on the test-card content; otherwise trivial (data).
- **Risk:** if cards arrive late, Day-2 morning practice has no new-engine grader.

### Option C — Both tiers now, assemble cards later
- Ship Option A immediately, then do Option B's assembly when cards arrive.
- Best of both: practice gradeable now; test fidelity later. No rework.

---

## 5. The prod write that's queued behind this decision

Running the importer for real writes to the **shared production `scenarios`
table** (which already holds ~80 non-ACLS scenarios). It adds 20 ACLS-tagged
rows (category set to 'Cardiac'; title/case_code/cert_* set) + 9 segments + 41
criteria + 40 assembly rows. Idempotent and re-runnable. Needed for BOTH days
(Day-1 0-4 cases must exist to be assigned to stations too).

---

## 6. Remaining build steps (after this decision)

- **Step 4 — Offline phase** (dedicated, after online is proven): IndexedDB
  persistence surviving reload/outage; sync-on-reconnect deduped by the existing
  `client_uuid`. No schema change required (the column already exists).
- **Step 5 — Day-builder**: generate the Day-1/Day-2 `lab_days` + `lab_stations`
  (scenario_id ← case_code) + `pmi_schedule_blocks` (teaching) from
  `acls_schedule_seed.json`. Reuses the existing lab-template "scenario_id per
  station" plumbing. Instructor/room/scenario are per-cohort; timing is the
  reusable template.
- **Step 6 — Filter/report view**: cohort megacode results
  (pass/fail per group/student, per segment) over `adv_cert_test_attempts`.

---

## 7. Recommendation in one line

**Option C**: run the importer to prod, set the pool to both tiers now (Option
A), and assemble the 4 test cards from the live card when it arrives (Option B) —
nothing about Day 1 is blocked, Day-2 practice works immediately, and the scored
block gets real cards with time to spare.
