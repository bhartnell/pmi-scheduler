# Pre-Internship Self-Assessment: handoff for pmiparamedic.tools

**From:** Rae Niedfeldt, Director of Clinical Education, EMS Programs
**For:** Ben, and the Claude project that manages pmiparamedic.tools

## Why this exists

In this year's Clinical Extern Affiliate Survey, our field agencies asked for a pre-semester summary of each paramedic student's strengths and weaknesses so they can place students with the right preceptor. Academic performance is already documented. Most internship problems come from the affective domain (scene control, leadership presence, receiving feedback), so this tool collects a structured student self-assessment, pairs it with instructor ratings, and produces a one-page profile per student for the agency.

## What it does

**Students** (about 15 to 20 minutes) complete:
1. Ten professional behaviors, each rated on four behaviorally anchored levels (1 Needs direction, 2 Developing, 3 Consistent, 4 Leads).
2. Five field scenarios with one best, one or two acceptable, and one or more concern answers (scored 2 / 1 / 0, max 10).
3. Three reflections. Only the third ("anything your preceptor should know") goes to the agency. The first two are instructor-only.
4. Learning preferences: how they learn, how they want feedback, how much autonomy they want early, and situations that throw them off.
5. An acknowledgment that a summary will be shared with their agency.

**Instructors** see a roster, rate each student on the same ten anchors, and get a side-by-side comparison with gap flags (self much higher, slightly higher, aligned, slightly lower, much lower) and an overall calibration label. The tool pre-drafts strengths, growth areas, and preceptor-match notes from both sets of ratings, which instructors edit before saving. Outputs: a one-page agency summary (download as HTML or copy as text) and a CSV export of the cohort.

## Files

| File | Purpose | Change it? |
|---|---|---|
| `index.html` | Page shell and script load order | Adapt to the site's layout |
| `styles.css` | All styling, driven by color tokens on `:root` with a dark-mode set | Swap tokens to match the site |
| `content.js` | Every question, anchor, scenario, and score | Rae edits wording here |
| `app.js` | Form, review screen, scoring, summary generation | Port as-is or translate to the site's framework |
| `storage-adapter.js` | **The only persistence layer.** Demo version uses localStorage | **Replace with the real backend** |

## Try the demo first

Open `index.html` in a browser to act as a student. Open `index.html?role=instructor` to act as an instructor. Both use this browser's localStorage, so submit as a student, then switch to the instructor URL to see the record.

## Integration task (paste this to Claude in the pmiparamedic.tools project)

> Integrate the Pre-Internship Self-Assessment from the attached folder into this site. Read HANDOFF.md first.
>
> 1. Add a student-facing page and an instructor-facing review page (or one page that shows the review tab only to instructors), using the site's existing login.
> 2. Implement every method in `storage-adapter.js` against our backend, keeping the same method names, arguments, and return shapes. Use the signed-in user's id as the Response id.
> 3. Enforce the access rules below on the server, not only in the UI.
> 4. Keep `content.js` as a separate, easy-to-edit file (or move it to a database table) so question wording can change without code changes. Do not change existing `id` or option `k` values once students have submitted.
> 5. If you translate `app.js` into the site's framework, keep the scoring, gap labels, calibration thresholds, and summary-drafting rules exactly as written.
> 6. Match the site's visual style by changing the tokens in `styles.css`.
> 7. Run through the acceptance checklist at the end of HANDOFF.md before shipping.

## Data model

**Response** (one per student; written by the student)

| Field | Type | Notes |
|---|---|---|
| `v` | number | Schema version, currently `1` |
| `name`, `cohort`, `email` | string | Email is optional |
| `ratings` | object | `{ lead, judg, crit, pcom, team, fdbk, prof, comp, init, advo }`, each 1 to 4 |
| `scenarios` | object | `{ s1 … s5 }`, each `"A"`, `"B"`, `"C"`, or `"D"` |
| `reflections` | object | `{ r1, r2, r3 }` strings; `r3` optional |
| `prefs` | object | `learn`, `feedback` (0 to 3), `autonomy` (0 to 2), `challenges` (array of 0 to 7) |
| `ack` | boolean | Must be `true` to submit |
| `submittedAt` | ISO 8601 string | Set on each submit or update |

**Review** (one per student; written by instructors; keyed `"r-" + responseId`)

| Field | Type | Notes |
|---|---|---|
| `instr` | object | Same ten domain ids, each 1 to 4 |
| `academic` | object | `{ cog, skills }` free text |
| `summary` | object | `{ strengths, growth, match, comments }`; strengths and growth are one item per line |
| `preparedBy` | string | Instructor name for the summary header |
| `updatedAt` | ISO 8601 string | |
| `recordKey` | string | Same as the key |

## Access rules (must be enforced server side)

- A student can read and update only their own Response.
- Students can never read other students' Responses or any Review.
- Instructors (at minimum Rae Niedfeldt and Ryan Young) can read all Responses, write all Reviews, and delete a Response (for test or duplicate records).
- Reflections `r1` and `r2` are instructor-only and must never appear in anything sent to an agency. The generated summary already leaves them out.

## Acceptance checklist

- [ ] A student can submit, leave, come back, see a "you submitted this on…" notice, and update their answers.
- [ ] A second student account cannot see the first student's submission, by UI or by calling the API directly.
- [ ] A student account cannot reach the instructor review screen or its API endpoints.
- [ ] An instructor sees every submission, can rate all ten behaviors, and the gap tags update immediately.
- [ ] "Refill from ratings" redrafts the summary using instructor ratings where they exist.
- [ ] Saved reviews persist across sessions and across instructors.
- [ ] The downloaded agency summary contains no `r1` or `r2` text.
- [ ] CSV export opens cleanly in Excel with one row per student.
- [ ] The form works at phone width (students will likely complete it on phones).

## Questions for Rae

- Which instructors besides Rae and Ryan need review access?
- Should students be blocked from editing once an instructor saves a review?
- Should agency summaries be stored or emailed from the site, or is download-and-send enough for now?
