# Role-Default Rule — Approach & Decisions (for review)

_Generated 2026-06-15. Read-only investigation; no code changed yet. Pick the
two decisions at the bottom and I'll build it._

---

## 0. Important: the time-critical floor is ALREADY live

`@my.pmi.edu` → `role: 'student'` (auto-approved) is **already implemented** in
`lib/auth.ts` (the first-login provisioning block). If Rae posts the exam-signup
instructions today, the wave will **already default to `student`, not minimal
access**. So this task is an *enhancement* (roster-driven + notify-admin), not a
race against the wave. The pressure is off.

Current behavior in `lib/auth.ts` `signIn` callback, `if (!existingUser)` branch:
- `@my.pmi.edu`        -> role `student`, `approved_at = now()`
- `@pmi.edu` (plain)   -> role `pending`, admin notified
- external domains     -> blocked unless whitelisted in `approved_external_emails`
- EXISTING users       -> never re-provisioned (returns early) — already safe

---

## 1. Data cleanliness (the question you asked)

Active cohorts are clean; the sign-in wave matches on BOTH domain and roster:

| Cohort | Students | With email | @my.pmi.edu | Verdict |
|--------|----------|-----------|-------------|---------|
| G13    | 25       | 25        | 24          | complete |
| G14    | 23       | 23        | 23          | complete |
| G15    | 20       | 20        | 20          | complete |
| G12    | 20       | 1         | 1           | sparse (old, sem 4 — not the wave) |

- Fresh logins expected (my.pmi roster rows not yet in lab_users): G13=24,
  G14=18, G15=20 (~62). All have a roster row -> assignment-match succeeds for
  every one of them. Domain default and assignment-match AGREE for the wave.
- 3 `volunteer_instructor` accounts exist on @my.pmi.edu emails (the
  "instructor candidate" case). Already provisioned -> first-provision-only +
  never-override protects them (next login = no change).
- 21 students have no email at all; concentrated in G12 (old) — not the wave.

Conclusion: enrollment data is reliable enough to DRIVE role for the active
wave. The notify-admin path will only fire for genuine no-match logins (rare).

---

## 2. Proposed build (where it hooks in)

File: `lib/auth.ts`, `signIn` callback, the `if (!existingUser)` PMI branch.
First-provision ONLY; never on subsequent logins; existing roles never touched.

- `@my.pmi.edu`:
    - run `getRosterStudent(email)` (same roster match the exam gate uses)
    - MATCH    -> role `student`, auto-approved [+ set primary_cohort_id — see Decision B]
    - NO MATCH -> [see Decision A] + notify admin ("@my.pmi.edu login, no roster
      match — review/assign cohort")
- `@pmi.edu` (plain): UNCHANGED -> `pending` + notify admin.
    One-directional preserved: NEVER auto-grant an elevated/staff/faculty role
    from any signal.
- Existing users: untouched (guardrail already enforced by `if (!existingUser)`).

Admin notification reuses `notifyAdminsNewPendingUser()` (or a sibling) in
`lib/notifications.ts`, which targets active admin/superadmin users.

Guardrails confirmed enforceable:
- First-provision-only: the create branch only runs when no lab_users row exists.
- Never override: subsequent logins short-circuit; an admin-assigned role
  (incl. the 3 my.pmi volunteer_instructors) is permanent until an admin changes it.
- One-directional: only the restricted `student` role is auto-granted; elevated
  roles always require manual assignment.

---

## DECISION A — no roster match for an @my.pmi.edu login (admin notified either way)

  [ ] A1. STUDENT FLOOR + NOTIFY  (recommended)
        Default to `student` anyway (restricted role, safe to auto-grant per the
        one-directional rule) and notify admin to verify/assign cohort.
        Pro: no student is EVER stuck at minimal during the wave, even if their
             roster row is briefly missing.
        Con: a non-student who slips in on a my.pmi address would get student
             until an admin fixes it (low risk; admin is notified).

  [ ] A2. MINIMAL + NOTIFY  (literal refined spec)
        Default to `pending`/minimal and notify admin to assign.
        Pro: assignment-match strictly required for student; tightest.
        Con: a real student added mid-wave with no roster row yet lands at
             minimal until an admin acts. Low risk now (data is clean) but not zero.

## DECISION B — set primary_cohort_id from the roster match on first provision?

  [ ] B1. YES — set it  (recommended)
        On a roster match, populate lab_users.primary_cohort_id with the matched
        cohort. Useful enrichment; currently null for auto-provisioned students.
        Harmless.

  [ ] B2. NO — role only
        Only set the role; leave primary_cohort_id null as today. Smaller change.

---

## Recommendation: A1 + B1

A1 best serves the stated goal ("students must not default to minimal during the
wave") while still notifying admins about anything unmatched. B1 is a free
enrichment. Reply with your picks (e.g. "A1 + B1") and I'll build it, run a
build, and report before it goes live.
