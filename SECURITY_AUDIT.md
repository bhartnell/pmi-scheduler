# Security Audit Report

**Date:** 2026-02-26
**Scope:** All API routes under `app/api/` (~230 route files)

---

## 1. Rate Limiting

### Implementation

A simple sliding-window in-memory rate limiter was created at `lib/rate-limit.ts`.

**Important caveat:** Vercel serverless functions each have their own memory space. Instances do not share state, so rate limiting is per-instance rather than globally enforced. This is a best-effort defense that limits abuse from a single IP hitting the same instance repeatedly, but a determined attacker could bypass it by hitting multiple instances. For airtight rate limiting, a shared store (e.g., Upstash Redis) would be required.

### Routes with Rate Limiting Applied

| Route | Limit | Window | Rationale |
|---|---|---|---|
| `POST /api/feedback` | 5/min per IP | 60s | Prevents feedback spam from unauthenticated users |
| `POST /api/checkin/[token]` | 20/min per IP | 60s | Student self-check-in; moderate volume allowed |
| `POST /api/guest/login` | 10/min per IP | 60s | Public auth-like endpoint, brute-force protection |
| `POST /api/access-requests` | 5/min per IP | 60s | Self-service signup form; low legitimate volume expected |

### Usage Pattern

```typescript
import { rateLimit } from '@/lib/rate-limit';

const ip = request.headers.get('x-forwarded-for') || 'unknown';
const { success } = rateLimit(`feedback:${ip}`, 5, 60000);
if (!success) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

---

## 2. Auth Audit

### Method

Scanned all `app/api/**/route.ts` files for presence of `getServerSession()` and `hasMinRole()`/`canAccessAdmin()` calls.

### Routes Without `getServerSession` (Expected Public or Cron Routes)

| Route | Status | Reason |
|---|---|---|
| `app/api/auth/[...nextauth]/route.ts` | OK - intentionally public | NextAuth.js handler |
| `app/api/checkin/[token]/route.ts` | OK - intentionally public | Token-gated student check-in kiosk |
| `app/api/timer-display/[token]/route.ts` | OK - intentionally public | Token-gated kiosk display |
| `app/api/guest/login/route.ts` | OK - intentionally public | Guest access with named codes |
| `app/api/cron/attendance-alerts/route.ts` | OK - cron secret | Bearer CRON_SECRET header check |
| `app/api/cron/availability-reminders/route.ts` | OK - cron secret | Bearer CRON_SECRET header check |
| `app/api/cron/daily-digest/route.ts` | OK - cron secret | Bearer CRON_SECRET header check |
| `app/api/cron/scheduled-exports/route.ts` | OK - cron secret | Bearer CRON_SECRET header check |

### Routes with Missing Auth - Fixed

| Route | Issue | Fix Applied |
|---|---|---|
| `app/api/lab-management/team-leads/route.ts` | Both GET and POST had no session check or role check | Added `getServerSession()` + `hasMinRole('instructor')` to both handlers |

**Why this was a real issue:** The team-leads GET endpoint exposed student names and team-lead performance statistics without any authentication. The POST endpoint allowed anyone to insert records into `team_lead_log` (which affects which students are selected as team leads). These are FERPA-relevant student records that must be protected.

### Auth Pattern Summary (All Other Routes)

The remaining 227 routes with `getServerSession` were reviewed for proper role enforcement. The general pattern is consistent:

- All admin routes check `canAccessAdmin()` (requires admin or superadmin)
- Clinical routes check `hasMinRole('lead_instructor')` or `hasMinRole('instructor')`
- Instructor-specific routes check `hasMinRole('instructor')`
- Student-specific routes check `role === 'student'` or `hasMinRole('guest')`
- Cron routes use CRON_SECRET bearer token (not session-based)

No other routes were found to be clearly missing auth where they should have it.

---

## 3. Input Validation Audit

### Scope Reviewed

- `/api/auth/*` - NextAuth.js managed; no custom input parsing
- `/api/admin/*` - All handlers reviewed
- `/api/clinical/*` - Key handlers reviewed (internships, preceptor-feedback, summative-evaluations)
- `/api/feedback` - Reviewed fully

### SQL Injection Risk

**None found.** All database queries use the Supabase JS client's parameterized query builder (`.from().select().eq().insert()` etc.). There are no raw SQL string concatenations in any reviewed route. The Supabase client handles all escaping internally.

### Input Validation Findings

**Feedback route (`/api/feedback` POST):**
- `description` is required and trimmed (good)
- `report_type` falls back to `'other'` if missing (acceptable)
- Screenshot upload validates file type (png/jpeg only) and size (5MB max) (good)
- The route accepts anonymous submissions - this is intentional design

**Admin feedback import (`/api/admin/feedback/import` POST):**
- UUID validation with regex before DB lookup (good)
- Status value validated against an allowlist (good)

**Admin certifications import (`/api/admin/certifications/import` POST):**
- Email format validated (`includes('@')`) (adequate)
- Array structure validated before iteration (good)

**Clinical internships (`/api/clinical/internships` POST):**
- `student_id` required (good)
- Other fields passed through with `|| null` fallback - acceptable since Supabase types enforce DB constraints

**Preceptor feedback (`/api/clinical/preceptor-feedback` POST):**
- `student_id` and `preceptor_name` validated (good)
- Ratings are numeric fields - passed directly from body but DB column type will reject non-numeric

**Overall:** Input validation is generally adequate for an internal tool. The Supabase client's parameterized queries prevent SQL injection. The main gap is that several POST handlers do not strictly validate the shape of the request body (e.g., checking for unexpected extra fields or enforcing max string lengths), but this is low risk in an authenticated internal application.

### Potential Improvements (Not Fixed - Not Critical)

- Add max-length enforcement on free-text fields (descriptions, notes) to prevent very large payloads
- The `feedback` POST body `description` could be length-capped server-side (currently unlimited)
- Consider validating that UUID-format IDs passed in POST bodies match the expected pattern before DB lookup

---

## 4. Additional Observations

### Cron Secret Hardening

All four cron routes check `if (cronSecret && authHeader !== ...)`. This means if `CRON_SECRET` is not set in the environment, the routes are openly accessible. Vercel cron jobs should always have `CRON_SECRET` configured in the project's environment variables.

**Recommendation:** Consider making the cron check fail-closed (deny when secret is not configured) rather than fail-open. Example:

```typescript
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

This was **not changed** in this audit as it may be intentional for local development. Flagged for future hardening.

### Feedback POST Accepts Anonymous Submissions

The `POST /api/feedback` endpoint does not require authentication - it logs the user email if a session exists but accepts anonymous submissions (`user_email: session?.user?.email || 'anonymous'`). This is apparently intentional to allow reporting bugs before login. Rate limiting has been added to mitigate abuse.

### `x-forwarded-for` Header Spoofing

Rate limiting uses `x-forwarded-for` to identify the client IP. On Vercel, this header is set by the platform and can be trusted. In other environments it can be spoofed, making rate limits bypassable. This is acceptable for the current deployment target.

---

## Summary of Changes Made

| File | Change |
|---|---|
| `lib/rate-limit.ts` | Created - in-memory sliding window rate limiter |
| `app/api/feedback/route.ts` | Added rate limit (5/min) to POST handler |
| `app/api/checkin/[token]/route.ts` | Added rate limit (20/min) to POST handler |
| `app/api/guest/login/route.ts` | Added rate limit (10/min) to POST handler |
| `app/api/access-requests/route.ts` | Added rate limit (5/min) to POST handler |
| `app/api/lab-management/team-leads/route.ts` | Added `getServerSession` + `hasMinRole('instructor')` to both GET and POST |
| `SECURITY_AUDIT.md` | Created this report |
