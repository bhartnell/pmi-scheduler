# AHA Results Export — Spec (v1, discovery checkpoint)

First instance of a general **per-student / per-cohort export/report engine**.
Status: **discovery done; spec proposed; pending confirmation before build.**
Read-only on grading data; only additive writes = instructor-profile fields.

## 1. Architecture — the engine (AHA = first branch)

```
data-source  →  select records (per-student / per-cohort)  →  render(template)  →  styled HTML doc  →  browser print-to-PDF (download)
```
- **Reuse the NREMT pattern** (`lib/nremtExport.ts` + a print-template module): a server endpoint returns a fully-styled HTML document with an auto-`window.print()` + a "Save as PDF" button, opened in a new tab. Browser handles page breaks / fonts / filename. (They moved OFF `html2pdf.js` to kill black-box/blank-page bugs — we follow suit.)
- **Pluggable templates:** a `ReportTemplate` registry. Each template = `{ id, title, fetch(scope) → data, renderHTML(data) }`. AHA forms are the "detailed-form" templates; later branches (COAEMSP hospital log, team-lead summaries, general data reports) register the same way. **Nothing AHA-specific in the engine core.**
- Course-agnostic: ACLS form set now; PALS swaps in as another template set behind the same engine + the same `cert_course` filter.

Proposed shape:
- `lib/reports/engine.ts` — registry + scope selection (student / cohort) + HTML→PDF open.
- `lib/reports/templates/aha/*` — the 4 AHA form templates (HTML render fns).
- `app/api/reports/aha/route.ts` — server endpoint returning the styled HTML doc.
- `app/<area>/exports/aha/page.tsx` — picker UI (cohort/student select, per-form instructor dropdowns, "show all attempts" toggle, Download).

## 2. Form set (recreate AHA 2025 layout as HTML templates)
1. **Megacode Testing Checklist** — 6 rhythm-chain variants:
   - Brady→pVT→PEA (Sc. 1/3/8) · Brady→VF→Asystole (2/5) · Tachy→VF→PEA (4/7/10) · Brady→VF→PEA (6/11) · Tachy→PEA→VF (9) · Brady→VF→Asystole/PEA (12)
2. **Airway Management Skills Checklist**
3. **Adult High-Quality BLS Skills Checklist**
4. **Infant CPR Skills Checklist**

⚠️ **DEPENDENCY:** need Ben's official **2025 AHA forms** (PDF/images) for the 4 above as the visual reference to recreate the HTML faithfully. Engine + data + profile schema can start without them; the exact form layout cannot be finalized until provided.

## 3. Megacode autofill (from site data — read-only)
Source tables (confirmed): `adv_cert_test_attempts` (overall_result, team_lead_id, scenario_id, cert_course), `adv_cert_segment_results` (per-segment result), `adv_cert_criterion_results` (met, via `segment_result_id`), `adv_cert_segment_criteria` (text, is_critical), `adv_cert_scenario_segments`→`adv_cert_segments` (rhythm chain).

**Best-attempt per student** (student = `team_lead_id`):
1. PRIMARY: PASS > FAIL.
2. SECONDARY: most criteria met (⚠️ no criteria are flagged `is_critical` today, so "most critical actions" = most met-criteria; revisit if criticals get flagged).
3. **Proposed guard:** prefer attempts whose rhythm chain maps to an AHA variant (so the form can be filled); flag a student whose only/best pass doesn't map.
4. No pass → use best fail (most met) for documentation.
- **Rhythm chain → AHA variant** from the assembled segment `algorithm_type` chain (e.g. `bradycardia>pvt>pea` → "Brady→pVT→PEA").
- Fill: TL, CPR quality, rhythm segments, Post-Arrest, PASS/NR from the recorded grading.
- **"Show all attempts"** checkbox (default OFF): prints every attempt (pass+fail) for remediation records.

## 4. Skills sheets auto-complete (NOT scored on site)
Airway / Adult BLS / Infant CPR are verified live but not in the app → render **as COMPLETED / PASS** (boxes checked) to document the verification. UI label states this is **documenting verified competency** (intentional), not a fabricated score. Failures are handled live; export reflects completed state.

## 5. Instructor info — profile additions (DRY-RUN before applying)
Add to `lab_users` (currently has name/email/role; NO aha/signature):
- `aha_instructor_number` text
- `signature_data` text (PNG data URL — drawn via signature-pad OR uploaded image)
- `signature_kind` text ('drawn' | 'uploaded' | 'auto') — `auto` = script-font render of name (fallback)
All additive/nullable → low-risk. Edited on the instructor's settings/profile page (`app/settings/...`). **Migration runs only after a `--dry-run` + sign-off.**

## 6. Per-form instructor selection
Dropdown per form/section → instructors who have AHA info on file (name + AHA# + signature). Default = station instructor (or current user); editable so a recerting instructor's signature can be routed elsewhere. Selection pulls that instructor's stored name/AHA#/signature onto the form. Signature line can use the saved digital signature OR be left blank for wet-sign.

## 7. Output
- Document-formatted, printable HTML → PDF (clean form layout, COAEMSP-log formality — not table dumps).
- **Per-student** (one full form set) and **whole-cohort** (all students).
- Download / open-in-tab; print + sign is a post-step.
- FERPA drive: download-and-place only — NO drive integration.

## 8a. ⚠️ CHECKPOINT-1 VALIDATION FINDING (G14, real data) — BLOCKS the renderer

Ran the best-attempt selection + variant mapping against G14 (23 active students, 32 attempts):
- **All 32 in-app scored attempts are megacode _practice_ (CASE_67–74). ZERO _testing_ (TEST_1–4) attempts exist in-app** — the Day-2 megacode TESTING block was not graded in the app.
- Result of mapping each student's best pass to an AHA Megacode **Testing** variant:
  - **13/23 map cleanly** (chains `brady>pvt>pea` → 1/3/8, `tachy>vf>pea` → 4/7/10).
  - **9/23 PASSED but on a chain with NO official AHA variant** (`tachy>vf>asystole`, `tachy>pvt>pea`, `brady>pvt>asystole` — practice scenarios 67/69/72/74). These students led ONLY unmapped-chain practice scenarios → no AHA-mappable attempt exists for them.
  - **1/23 no scorable attempt** (Figueras).
- Root cause: practice scenarios 67–74 span 8 rhythm chains; only ~half match the 6 official AHA **testing** variants, and the actual testing megacodes weren't entered in-app.
- **Decision needed before building the form renderer** (see chat) — determines the data source + how unmapped students are handled.

## 8. Flags (per "FLAG anything that doesn't map")
- No criteria flagged `is_critical` → critical-actions tiebreak = total met-criteria (noted above).
- Practice chains not matching an AHA variant (`tachy>vf>asystole`, `brady>pvt>asystole`, …) — flag students whose best attempt is one of these.
- Students with NO scorable attempt → treat as **excused / certifying separately, NOT an error**: omit from the whole-cohort packet by default (with an optional "excused" annotation in the cohort summary), never generate a broken blank form. (Known G14 case: **Cian Figueras** — pre-planned excused absence, getting ACLS separately. Rare/legitimate.)
- ~~Need the official AHA form templates (Ben).~~ ✅ received (4-form set).

## 9. Checkpoints (build order)
1. ✅ **DONE — engine skeleton + Megacode data layer** (`lib/reports/engine.ts`, `lib/reports/aha/megacode.ts`): pluggable template registry; best-attempt selection (best score: pass>fail, most-met) + variant mapping + per-attempt segment/criteria assembly + flags. Logic validated against G14 (§8a). tsc 0 + clean build. *(no schema change; render endpoint/template pending official AHA PDFs.)*
2. ✅ **DONE — instructor profile** (migration `20260623_lab_users_aha_profile.sql`, dry-run→applied): `lab_users.aha_instructor_number / signature_data / signature_kind`. API `app/api/profile/aha` (self GET/PATCH). UI `app/settings/aha-credentials` (AHA#, signature draw via `components/SignaturePad.tsx` / upload / auto script-font fallback); nav link in UserMenu.
3. ✅ **DONE — Megacode Testing Checklist** (`lib/reports/aha/megacodeForm.ts` + render endpoint `app/api/reports/aha`): all 6 official variants recreated from the PDF; autofilled from CP1 best-attempt data (checkboxes/PASS-NR/flags/excused); print-to-PDF HTML doc. Validated e2e vs G14 (23 forms). Tachycardia has 1 official item with no rubric counterpart → footnoted.
4. **Skills templates** — ✅ **Airway + Adult BLS DONE** (`lib/reports/aha/skillsForms.ts`, auto-complete PASS, endpoint `template=airway|adult_bls`, validated vs G14). ⚠️ **Infant CPR deferred/FLAGGED** — per-cycle compression/breath sub-criteria didn't survive extraction; needs cleaner source or visual confirm.
5. ✅ **DONE — picker UI** (`app/reports/aha`) + options endpoint + per-form instructor selection (signer per export) + nav entry on the Reports hub. Per-cohort output via the render endpoint; open/print-to-PDF. Megacode + Airway + Adult BLS usable end-to-end.
6. **Remaining:** Infant CPR form (flagged — extraction lost sub-items); **visual QA** of the rendered PDFs vs the official AHA layouts; optional per-student (single-student) export UI; optional "show all attempts" toggle in the UI.

**Official AHA 2025 forms received** (all carry the "Instructor Initials / Instructor Number / Date" sign-off): Megacode Testing (6 variants), Airway, Adult BLS, Infant CPR. Learning Station Checklists (8, formative) intentionally OUT of scope for now.

## Decisions to confirm before building (see chat)
1. AHA form templates — Ben to provide the 4 official 2025 PDFs/images.
2. Best-attempt mapping rule (prefer AHA-mappable pass; flag if none) — OK?
3. Start checkpoint 1 (engine + megacode preview, no schema change) now?
