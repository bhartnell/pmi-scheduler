---
title: Build a lab day from a template
section: running-the-program
roles: [admin_director, lead_instructor]
summary: Generate a cohort's lab days from a saved template set — and what to double-check afterward, since not every scenario link carries over automatically.
related: [run-a-lab-day]
verified: true
updated: "2026-09-22"
---

## What this is for

Generating a semester's worth of lab days for a cohort from a reusable template set, instead of building each lab day by hand.

## When you'd do this

At the start of a semester, or when a new cohort needs its lab day schedule set up, once a template set already exists for that program and semester.

## Before you start

- A template set must already exist for the program and semester you're applying. If one doesn't exist yet, build it first (see "Creating a template" below).
- Know the cohort, the start date (this becomes "Week 1 Day 1"), and whether any weeks should be skipped for a break.

## Steps

### Applying a template set to a cohort

1. Go to **Admin > Lab Templates**.
2. In **Apply Template Set to Cohort**, pick the Cohort, Program, Semester, and Start Date.
3. Optionally list Break Weeks (comma-separated week numbers) to skip.
4. Click **Apply Templates**. You'll see a confirmation: *"Confirm: Apply all Semester {N} templates from {program} to cohort {cohort} starting {date}? This will create lab days for each template in the set. Existing lab days for this semester will be skipped."*
5. Click **Confirm Apply**.

### Creating a template (if one doesn't exist yet)

1. Click **New Template** (or **Create First Template** on an empty library).
2. Fill in Program, Semester, Week Number, Name, and Description.
3. Click **Add Station** for each station on that day. For a scenario station, use the **Scenario** dropdown to pick a real scenario from the scenario library — don't just type a scenario name into a text field.
4. Click **Create Template**.

## What good looks like

- After applying, the cohort has a lab day for every template in the set, on the right dates, skipping any break weeks you listed.
- Any station where the scenario was picked from the **Scenario dropdown** while building the template arrives in the generated lab day already linked to that scenario.

## When it goes wrong

**Scenario-type stations built from an uploaded or seeded template — as opposed to hand-picked from the Scenario dropdown — can generate with no scenario actually linked, even though the station itself is created correctly.** This is a known, open gap.

Why: a bulk-imported or seeded template only ever carries a scenario's *title as text*, never its real database record. The system links it automatically only when that text matches an existing scenario's title exactly — a small punctuation difference (like a dash typed differently) is enough to break the match and leave the station unlinked rather than guess at the wrong scenario. Most of the historical template stations built this way have not been backfilled, on purpose — the project doesn't auto-write a guessed link, only a confirmed one.

**What to check after generating a lab day from a template:** open the generated lab day and look at each scenario-type station. If a station shows no linked scenario, re-link it by hand on the lab day (Edit Station), or use the lab day's **Compare & Update Template** option to diff against the template. This is most likely on templates that were bulk-imported or seeded rather than built by hand in the template editor.

## Related

- Run a lab day
