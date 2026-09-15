# Bug & Fix Log

Generated snapshot of the 🐞 Bug & Fix Log (Notion, Agent Ops Hub).
**Notion is the working source of truth — do not hand-edit this file.**
Regenerate with `node scripts/export-bug-log.js`.

Last generated: 2026-09-15T00:26:58.502Z · 20 rows · 5 recurred/partially-held

See the Known-Issue Check section of `CLAUDE.md`: query this log
(or the live Notion database, if reachable) for the relevant Area
before forming any hypothesis about a reported problem.

### Timer (11) — ⚠️ 5 recurred/partially-held

| Bug ID | Bug | Severity | Fix Type | Outcome | First Reported | Fix Deployed | Verify By | Evidence |
|---|---|---|---|---|---|---|---|---|
| BUG-17 | ⚠️ [Stale/duplicate timer state — old timers running concurrently, stuck banners, Open Timer 404](https://app.notion.com/p/3dc5cd1cbc9b818ebbf7e246054ad4ad) | High | Code patch | **Recurred** | 2026-02-04 | 2026-02-05 | — | Cluster of 4+ reports 2026-02-04 to 2026-02-06. Ben: 'There seemed to be an old timer running at the same time, and we couldn't get rid of it easily.' Fixes: c60c180 (Feb 5) timer state management, o… |
| BUG-18 | ⚠️ [Station timer desync with 401 polling errors](https://app.notion.com/p/3dc5cd1cbc9b81748e0cec75bad6d97b) | Medium | Code patch | **Recurred** | 2026-03-06 | 2026-03-24 | — | jlomonaco 2026-03-06 on /lab-management/grade/station/[id]: 'non sync on station timer' with console errors. Resolution note: 'Timer desync and 401 polling error fixed' — no commit reference, no name… |
| BUG-19 | [Timer will not clear via trash-can icon — closed with no resolution record](https://app.notion.com/p/3dc5cd1cbc9b81a5b5f7c504fb85bf97) | Medium | Not yet fixed | Not yet verified | 2026-03-25 | 2026-04-09 | — | stpeterson 2026-03-25: 'I have gone through and done the turn off timer with the trash can icon several times and the timer will not go away.' Marked resolved 2026-04-09 with resolution_notes EMPTY. |
| BUG-20 | [NremtTimer.tsx maintained its own separate hardcoded duration map](https://app.notion.com/p/3dc5cd1cbc9b818f90bde2cb54237654) | Medium | Code patch | Not yet verified | 2026-04-15 | 2026-07-08 | 2026-10-15 | mschafer 2026-04-15: 'Timer should be 5 minutes.' Fix note (Claude Code 2026-07-08): 'components/NremtTimer.tsx (the actual countdown widget used on /labs/grade/station/[id]) maintained its OWN separ… |
| BUG-14 | ⚠️ [Rotation duration edits not reflected in the running timer — display computed from STATIC rotationMinutes](https://app.notion.com/p/3dc5cd1cbc9b81b3bee7e80316409af5) | High | Code patch | **Recurred** | 2026-05-19 | 2026-07-08 | — | Ben 2026-05-19: 'when adjusting the timer that should be adjusting every rotations time, it is only adjusting the current rotation timer. Also, after making the adjustment on the edit lab day to 20 m… |
| BUG-15 | ⚠️ [Timers starting at the wrong second (xx:49 not xx:59) — poll-only timer discovery, 15-30s lag](https://app.notion.com/p/3dc5cd1cbc9b8189a39fdc04014f8db5) | High | Code patch | **Recurred** | 2026-06-18 | 2026-07-08 | — | jlomonaco 2026-06-18: 'timers have been starting at xx:49 not xx:59'. Fix note (Claude Code 2026-07-08): 'root cause was poll-only timer discovery on components/LabTimer.tsx and both app/timer-displa… |
| BUG-16 | ⚠️ [Timer not displaying on adv-cert grading page after lead instructor starts it](https://app.notion.com/p/3dc5cd1cbc9b8188bf06f2fa316ebbc7) | Medium | Architectural | **Partially held** | 2026-06-19 | 2026-07-01 | — | trpaul 2026-06-19. Fix note: 'commit 1284e38 added a Supabase Realtime subscription (postgres_changes on lab_timer_state, anon RLS via 20260701_lab_timer_state_realtime_rls.sql) to components/GlobalT… |
| BUG-1 | [Rotation timer display reverts to base duration (20:00) instead of holding the computed remaining](https://app.notion.com/p/3dc5cd1cbc9b81528336e926ef71da26) | Critical - blocks live class | Not yet fixed | Not yet verified | 2026-09-14 | — | — | Video, 60 frames analysed. Bar alternates at ~1 Hz between 20:00 (white/green, never decrements, ~83% of each second) and 01:32>01:31 (amber, decrements correctly, ~17%). Arithmetic confirms 01:3x is… |
| BUG-2 | [Timer syncs by REST polling on a fixed interval instead of pushing on state change](https://app.notion.com/p/3db5cd1cbc9b81229cdff98581ce1cb5) | High | Not yet fixed | Not yet verified | 2026-09-14 | — | — | edge_logs 23:15-23:32Z: GET /rest/v1/lab_timer_state pinned at 69 req/min (~1.15 Hz), dead flat for 15+ min. /realtime/v1/websocket only 42 hits in 70 min — realtime not in use. Poll cadence matches … |
| BUG-3 | [lab_timer_state.updated_at is never maintained — frozen at created_at](https://app.notion.com/p/3db5cd1cbc9b81229cdff98581ce1cb5) | Medium | Not yet fixed | Not yet verified | 2026-09-14 | — | — | Row 57bad453: version = 10 (ten updates) yet updated_at identical to created_at to the microsecond (2026-09-14 22:17:03.773225+00). No trigger, update path does not set it. |
| BUG-13 | [ROOT PATTERN: four rotation-timer surfaces, each with its own state handling (NREMT timer is separate by design)](https://app.notion.com/p/3db5cd1cbc9b81229cdff98581ce1cb5) | High | Not yet fixed | Not yet verified | 2026-09-15 | — | — | Rotation-timer surfaces named in feedback_reports resolution_notes: components/LabTimer.tsx, components/GlobalTimerBanner.tsx, app/timer-display/[token]/page.tsx, app/timer-display/live/[labDayId]/pa… |

### Infra / Cost (1)

| Bug ID | Bug | Severity | Fix Type | Outcome | First Reported | Fix Deployed | Verify By | Evidence |
|---|---|---|---|---|---|---|---|---|
| BUG-4 | [lab_users polled at ~2/s — 40% of all project edge traffic](https://app.notion.com/p/3db5cd1cbc9b81229cdff98581ce1cb5) | High | Not yet fixed | Not yet verified | 2026-09-14 | — | — | 2026-09-14: 14,559 requests of 36,550 total project edge requests (40%). 112-130 req/min during lab. Table content barely changes. Largest single consumer of the edge budget and unrelated to the time… |

### Student Data / Import (1)

| Bug ID | Bug | Severity | Fix Type | Outcome | First Reported | Fix Deployed | Verify By | Evidence |
|---|---|---|---|---|---|---|---|---|
| BUG-5 | [Student importer creates students rows without matching student_program_enrollments rows](https://app.notion.com/p/3dc5cd1cbc9b81789e09efe5e7e48a65) | High | Not yet fixed | Not yet verified | 2026-09-14 | — | — | G15: 21 students rows exist, 1 student_program_enrollments row. ~94 students affected across 6 cohorts. Ben had previously reported 'a weird null finding' on the S2 roster that was never resolved. |

### ACLS / AHA (3)

| Bug ID | Bug | Severity | Fix Type | Outcome | First Reported | Fix Deployed | Verify By | Evidence |
|---|---|---|---|---|---|---|---|---|
| BUG-6 | [ACLS Oct 5-6 lab days generated from a superseded March placeholder template](https://app.notion.com/p/3dc5cd1cbc9b8116b770c18e4f0125e2) | Critical - blocks live class | Data correction | Not yet verified | 2026-09-14 | 2026-09-14 | 2026-09-28 | G15 Oct 5-6 generated from template 3b12db4b (March placeholder) rather than the July sectioned templates. Post-fix query shows sectioned days present: Day 1 Sections 2/3 (Cases 45/47/48/49, 16/17/26… |
| BUG-7 | [[ARCHIVED] superseded ACLS lab days still sit live on the Oct 5 and Oct 6 dates](https://app.notion.com/p/3dc5cd1cbc9b81e9a1fde0fef9afce8e) | High | Not yet fixed | Not yet verified | 2026-09-14 | — | 2026-09-28 | Query returns '[ARCHIVED] ACLS Certification — Day 1 (superseded)' with old Cases 34/36/39/40 and '[ARCHIVED] ... Day 2' with free-text 'ACLS Megacode Final', both as live lab_days rows dated 2026-10… |
| BUG-11 | [ACLS Megacode Test Stations 1-4 are free text with no grading scheme link](https://app.notion.com/p/3dc5cd1cbc9b8107949beed0cf2e1a0f) | High | Not yet fixed | Not yet verified | 2026-09-14 | — | 2026-09-28 | Oct 6 'ACLS Certification — Day 2, Section 3 (Megacode Testing)' stations 1-4 all have scenario_id NULL and cert_course NULL, while the practice sets either side are correctly linked to Cases 67-74. |

### Reporting / Coverage (1)

| Bug ID | Bug | Severity | Fix Type | Outcome | First Reported | Fix Deployed | Verify By | Evidence |
|---|---|---|---|---|---|---|---|---|
| BUG-8 | [Skill/Scenario Coverage panel counts scheduled stations, not completed ones](https://app.notion.com/p/3dc5cd1cbc9b816aa1cada107907d02d) | High | Not yet fixed | Not yet verified | 2026-09-14 | — | — | Ben's screenshot showed counts against future dates (11/16, 11/23). Query confirms: G15 scenario stations = 13 run to date vs 75 scheduled; skills 43 done vs 15 scheduled. ~85% of displayed 'coverage… |

### Lab Schedule Manager (2)

| Bug ID | Bug | Severity | Fix Type | Outcome | First Reported | Fix Deployed | Verify By | Evidence |
|---|---|---|---|---|---|---|---|---|
| BUG-9 | [lab_template_stations does not carry scenario links through to generated lab days](https://app.notion.com/p/3dc5cd1cbc9b81b982d2f353540ee7c9) | High | Not yet fixed | Not yet verified | 2026-09-14 | — | — | 324 lab_template_stations rows, only 24 with scenario_id. Zero exact title matches available between template scenario_title free text and scenarios.title, so no naive backfill is possible. |
| BUG-10 | [Orphaned scenario stations — 77 of 266 lab_stations rows typed 'scenario' have null scenario_id](https://app.notion.com/p/3dc5cd1cbc9b8111bf62efb39cc079e2) | Medium | Not yet fixed | Not yet verified | 2026-09-14 | — | — | SELECT count(*) FILTER (WHERE station_type='scenario' AND scenario_id IS NULL) FROM lab_stations = 77 of 266. |

### Process / Board (1)

| Bug ID | Bug | Severity | Fix Type | Outcome | First Reported | Fix Deployed | Verify By | Evidence |
|---|---|---|---|---|---|---|---|---|
| BUG-12 | [Board cards left gated on events that had already completed weeks earlier](https://app.notion.com/p/3dc5cd1cbc9b8108bedaec6dda0cb057) | Medium | Documentation | Not yet verified | 2026-09-14 | 2026-09-14 | 2026-10-15 | ~7 cards found gated on events completed 6-8 weeks prior, producing an apparent AHA workstream stall. Three items found already complete while their cards said otherwise (G14 results export Jul 18, C… |
