# PMI EMS Scheduler — Architecture Issues & Technical Debt

> Auto-generated from codebase audit — March 8, 2026

## Summary

After 98 tasks and ~640 commits, the PMI EMS Scheduler has undergone significant architecture improvements. Most critical issues have been resolved. This document tracks the current state of known architectural issues, resolved items, and remaining technical debt.

- **Critical issues**: 0
- **Warnings**: 3
- **Informational / Low priority**: 5

---

## Resolved Issues

### ✅ R-1: Bare `getServerSession()` Calls (RESOLVED — Task 93)

**Original issue**: 72+ API routes called `getServerSession()` without passing `authOptions`, causing `null` session returns and 500 errors in production.

**Fix**: Task 93 systematically fixed all 72 API routes to use `getServerSession(authOptions)`.

**Status**: Fully resolved. Permission Audit confirms zero bare `getServerSession()` calls remain.

---

### ✅ R-2: Missing RBAC on API Routes (RESOLVED — Tasks 35, 41)

**Original issue**: Many API routes only checked for a valid session without verifying the user's role, allowing any authenticated user to access admin/instructor endpoints.

**Fix**: Task 35 migrated admin routes to `requireAuth` pattern. Task 41 added `requireAuth` to all remaining non-admin routes.

**Status**: Fully resolved. All routes now enforce role-based access.

---

### ✅ R-3: PostgREST FK Ambiguity (PGRST201) (RESOLVED — Tasks 94-97)

**Original issue**: Tables with multiple foreign key paths (e.g., `students` → `cohorts` via both `cohort_id` and `original_cohort_id`) caused PGRST201 errors when Supabase couldn't determine which FK to use for joins.

**Fix**:
- Task 94: Fixed cohorts 500 error (students↔cohorts)
- Task 95: Comprehensive sweep across 17 files for students↔cohorts disambiguation
- Task 96: Created `check-fk-ambiguity.js` script for automated detection
- Task 97: Fixed final 3 implicit joins (scenario_assessments↔lab_stations)

**Status**: Fully resolved. FK ambiguity checker reports 0 CRITICAL implicit joins.

---

### ✅ R-4: Console.log Pollution (RESOLVED — Task 42)

**Original issue**: Debug `console.log` statements were scattered throughout API routes and components, leaking internal state to browser devtools.

**Fix**: Task 42 removed all debug console.log statements.

**Status**: Resolved. Dead Code Report may flag new instances that crept back in during subsequent development.

---

### ✅ R-5: Duplicate Supabase Client Factories (RESOLVED — Task 42)

**Original issue**: Multiple `getSupabase`/`createClient` functions existed across different files with inconsistent patterns.

**Fix**: Task 42 consolidated to a single `lib/supabase.ts` with `getSupabase()` and `getSupabaseAdmin()`.

**Status**: Fully resolved.

---

### ✅ R-6: Large Monolithic Components (RESOLVED — Task 65)

**Original issue**: Several page components exceeded 1000+ lines, making them difficult to maintain and test.

**Fix**: Task 65 split large components into focused sub-components.

**Status**: Resolved. Some pages remain large but are well-structured.

---

### ✅ R-7: SELECT * on Timer Endpoints (RESOLVED — Task 69)

**Original issue**: Timer-related API routes used `SELECT *`, fetching unnecessary columns and potentially exposing sensitive data.

**Fix**: Task 69 replaced `SELECT *` with explicit column lists on timer endpoints.

**Status**: Fully resolved.

---

### ✅ R-8: N+1 Query Patterns (RESOLVED — Task 45)

**Original issue**: Several pages and API routes fetched lists then made individual queries for each item, causing poor performance.

**Fix**: Task 45 fixed N+1 patterns in groups, station grades, and onboarding dashboard.

**Status**: Resolved for identified cases. New instances may emerge as features grow.

---

### ✅ R-9: Accessibility & Dark Mode Gaps (RESOLVED — Task 78)

**Original issue**: Some UI components had accessibility issues (missing ARIA labels, poor contrast) and dark mode styling gaps.

**Fix**: Task 78 performed a comprehensive accessibility and dark mode audit.

**Status**: Resolved.

---

### ✅ R-10: Missing Breadcrumbs (RESOLVED — Tasks 55, 59)

**Original issue**: Many pages lacked breadcrumb navigation, making it difficult for users to orient themselves.

**Fix**: Task 55 created a universal breadcrumb component. Task 59 added breadcrumbs to OSCE pages and 15 other missed pages.

**Status**: Fully resolved.

---

## Active Warnings

### ⚠️ W-1: Client-Side Data Fetching Pattern

**Description**: All pages use `'use client'` with `useEffect` + `fetch` for data loading. While consistent, this means:
- No server-side rendering benefits (SEO, initial load performance)
- Waterfalls when pages need multiple API calls
- No streaming or suspense integration

**Impact**: Medium. Performance is acceptable for an internal tool, but loading states are visible on every page navigation.

**Recommendation**: Consider migrating high-traffic pages (dashboard, calendar) to React Server Components or adding React Query's prefetching. Task 76 added React Query hooks which improves caching but doesn't eliminate the client-fetch pattern.

**Priority**: Low — acceptable for internal tool.

---

### ⚠️ W-2: No Unit/Integration Test Coverage

**Description**: The project has zero automated tests. All quality assurance is manual testing + TypeScript type checking + build verification.

**Impact**: High risk for regressions. The `npm run build` check catches type errors but not logic bugs.

**Recommendation**: Add at minimum:
- API route integration tests (jest + supertest or similar)
- Critical component snapshot tests
- Database query tests against a test database

**Priority**: Medium — technical debt that grows with each feature.

---

### ⚠️ W-3: In-Memory Rate Limiting and Caching

**Description**: Several features use in-memory stores (Maps, objects) for rate limiting (`lib/rate-limit.ts`) and caching (calendar event cache in `google-events/route.ts`). These don't persist across serverless function cold starts and don't share state across instances.

**Impact**: Low in practice — Vercel's serverless model means rate limits reset on cold start, but with a single-user admin app this is rarely problematic.

**Recommendation**: If scaling becomes needed, migrate to Redis (Vercel KV or Upstash).

**Priority**: Low.

---

## Informational Items

### ℹ️ I-1: Google Calendar OAuth Scope Breadth

The app requests `calendar.events` scope which grants broad calendar access. This is necessary for the current feature set (FreeBusy, event CRUD, calendar list) but should be documented clearly for users.

### ℹ️ I-2: No Database Connection Pooling

API routes create a new Supabase client per request via `getSupabaseAdmin()`. Supabase handles connection pooling on their end (PgBouncer), but high-traffic scenarios could benefit from explicit connection management.

### ℹ️ I-3: Migration Files Are Append-Only

With 171 migration files, the migration history is large. All migrations use `IF NOT EXISTS` for idempotency, but there's no migration rollback mechanism. Consider periodic squashing.

### ℹ️ I-4: JSONB Columns Lack Schema Validation

Several tables use JSONB columns (user_preferences, dashboard_layouts, etc.) without database-level schema validation. TypeScript types enforce shape at the application layer, but the database accepts any valid JSON.

### ℹ️ I-5: Service Worker Is Basic

The PWA service worker provides minimal offline capability. It doesn't cache API responses or provide offline-first functionality. Task 7 added PWA icons but the service worker itself remains basic.

---

## Architecture Strengths

1. **Consistent patterns**: All API routes follow the same auth → query → respond structure
2. **Role hierarchy**: Well-defined permission system with `requireAuth` enforcement
3. **Fire-and-forget integrations**: Calendar sync and notifications never block primary operations
4. **FK disambiguation**: Automated checking prevents PGRST201 regressions
5. **Migration idempotency**: All migrations are safely re-runnable
6. **Audit trail**: FERPA compliance via `lib/audit.ts` and `audit_log` table
7. **Type safety**: Comprehensive TypeScript types across the stack
