---
title: Add students and check they are properly enrolled
section: using-the-site
roles: [lead_instructor, admin_director]
summary: Import a roster of students into a cohort, and understand the current gap between "added" and "enrolled" — including how to spot a student who has one but not the other.
related: []
verified: true
updated: "2026-09-22"
---

## What this is for

Adding a batch of students to a cohort, and understanding what "properly enrolled" actually means in this system — a student can exist in the roster without being fully enrolled underneath, and there's currently no single screen that shows you which is which.

## When you'd do this

At the start of a cohort, or whenever new students join an existing one.

## Before you start

- Have your student data ready as a spreadsheet or CSV. Use the **Download CSV Template** button on the import page to get the exact column headers expected (first name, last name, email, phone, agency, emergency contact name/phone, learning style, notes).
- Know which cohort you're adding students to.

## Steps

1. Go to **Academics > Students > Import**.
2. **Step 1 — Select Cohort.**
3. **Step 2 — Duplicate Handling** — choose whether to skip, update, or allow duplicates of students who already match by email or by first+last name.
4. **Step 3 — Add Student Data** — either paste data directly or upload a file.
5. **Step 4 — Review & Select Rows** — the preview table flags errors and warnings per row. Use **Select All Valid** to select everything that passed validation, then uncheck anything you don't want to import.
6. Click **Import N Students**. A summary shows how many were Imported / Updated / Skipped / Failed.

## What good looks like

- Every student you imported shows up in the cohort roster.
- For a student added **on or after 2026-09-14**, with a cohort selected and a resolvable program (EMT / AEMT / Paramedic), the system automatically creates their enrollment record behind the scenes — no extra step needed.

## When it goes wrong

This is the one place in the system where "added to the roster" and "actually enrolled" can quietly come apart — and there currently isn't an in-app screen that shows a student's enrollment status directly. It has to be checked in the database.

**Background:** for a long time, importing or adding a student created their roster record but never created the matching enrollment record underneath it — a gap that recurred across multiple cohorts (roughly 94 students across 6 cohorts, in one measured case) before it was tracked down. A fix shipped 2026-09-14 so new students get their enrollment record automatically the moment they're added — but that fix was code-only: **students added before that date were not automatically backfilled**, by design. The project doesn't auto-write a guessed-at fix to real student data; a human has to confirm a backfill like that.

Even with the fix in place going forward, a student can still end up without an enrollment record, silently, if any of these are true when they're added:

- **No cohort was selected** at the time.
- Their status was set to **On Hold**.
- Their cohort's program isn't one of EMT, AEMT, or Paramedic (or can't be resolved at all).

**Why this matters day-to-day:** the lab-day roster, station completions, and grading screens you use in lab don't depend on the enrollment record — they work fine either way. But the lifecycle actions on a student's detail page — **Withdraw**, **Mark Graduated**, **Re-enroll**, **Advance** — only update an *existing* enrollment record. If a student doesn't have one, clicking these silently does nothing on the enrollment side even though their visible status still changes — there's no error and no on-screen warning when this happens.

**If you suspect a student is missing their enrollment record** — especially anyone added before 2026-09-14, or added without a cohort selected at the time — flag it for an admin to check directly in the database rather than assuming the lifecycle buttons fixed it.

## Related

None yet — this is one of the wiki's first articles. If you know of a related how-to that should link here, mention it on the Report an Issue link on the Help page.
