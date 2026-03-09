# PMI EMS Scheduler — Cleanup Roadmap

> Auto-generated from codebase audit — March 8, 2026

## Summary

The majority of cleanup work has been completed through Tasks 42-46, 55, 65, 69, 78, 93-97. This document tracks completed cleanup items and identifies remaining work.

### Metrics Snapshot (March 8, 2026)

| Metric | Value |
|--------|-------|
| Pages | 208 |
| API routes | 447 |
| Components | 122 |
| Lib modules | 30 |
| TypeScript/TSX lines | ~61,800 |
| Database tables | ~60+ |
| Migration files | 171 |
| Total commits | 639 |
| Cron jobs | 15 |

---

## ✅ Completed Cleanup Items

### Code Quality (All Complete)

| Item | Task | Status |
|------|------|--------|
| Remove all debug `console.log` | Task 42 | ✅ Done |
| Consolidate Supabase client factories | Task 42 | ✅ Done |
| Replace `SELECT *` with explicit columns | Task 69 | ✅ Done |
| Fix N+1 query patterns | Task 45 | ✅ Done |
| Split monolithic page components | Task 65 | ✅ Done |
| Extract shared utilities | Task 43-44 | ✅ Done |

### Auth & Security (All Complete)

| Item | Task | Status |
|------|------|--------|
| Fix bare `getServerSession()` calls | Task 93 | ✅ Done |
| Add `requireAuth` to all admin routes | Task 35 | ✅ Done |
| Add `requireAuth` to all non-admin routes | Task 41 | ✅ Done |
| Fix PostgREST FK ambiguity (PGRST201) | Tasks 94-97 | ✅ Done |
| Create FK ambiguity checker script | Task 96 | ✅ Done |

### Navigation & UX (All Complete)

| Item | Task | Status |
|------|------|--------|
| Universal breadcrumb component | Task 55 | ✅ Done |
| Breadcrumbs on OSCE + 15 missed pages | Task 59 | ✅ Done |
| Add redirects for moved routes | Task 46 | ✅ Done |
| Add `loading.tsx` skeleton files | Task 46 | ✅ Done |
| Accessibility & dark mode audit | Task 78 | ✅ Done |
| PWA icons + meta tag fixes | Bug 7 | ✅ Done |

### Performance (All Complete)

| Item | Task | Status |
|------|------|--------|
| Adaptive polling on timer displays | Task 64 | ✅ Done |
| React Query caching layer (9 hooks) | Task 76 | ✅ Done |
| Timer system overhaul (single active) | Task 62 | ✅ Done |

---

## 🟡 Remaining Cleanup Items

### Priority: Medium

#### 1. Add Automated Test Coverage

**Status**: Not started
**Effort**: Large (ongoing)
**Recommendation**: Start with API route integration tests for critical paths:
- Auth flow (sign-in, session, role check)
- Lab day CRUD
- Student CRUD (FERPA compliance)
- Calendar sync operations
- Scheduling poll lifecycle

#### 2. Review Dead Code Report Findings

**Status**: Dead Code Report generated (see `docs/DEAD_CODE_REPORT.md`)
**Effort**: Small-Medium
**Recommendation**: Address findings from the dead code scan:
- Remove confirmed unused imports
- Delete confirmed orphaned files
- Clean up TODO/FIXME comments
- Review console.log statements that crept back in

### Priority: Low

#### 3. Migration File Squashing

**Status**: 171 migration files accumulated
**Effort**: Medium
**Risk**: Low (all migrations are idempotent)
**Recommendation**: Consider creating a single consolidated "baseline" migration that represents the current schema state, archiving the 171 individual files.

#### 4. Server Component Migration for Key Pages

**Status**: All pages are client components
**Effort**: Large
**Recommendation**: Migrate dashboard and calendar pages to React Server Components for faster initial load. This is optional for an internal tool.

#### 5. JSONB Schema Validation

**Status**: JSONB columns validated by TypeScript types only
**Effort**: Small
**Recommendation**: Add PostgreSQL CHECK constraints or JSON Schema validation for JSONB columns (user_preferences, dashboard_layouts, etc.)

#### 6. Redis-Based Rate Limiting

**Status**: In-memory rate limiting (resets on cold start)
**Effort**: Small-Medium
**Recommendation**: Only needed if scaling beyond single-user admin. Consider Vercel KV or Upstash Redis.

---

## 🟢 No Longer Relevant

The following items from earlier cleanup discussions have been superseded or are no longer applicable:

| Item | Reason |
|------|--------|
| Duplicate page consolidation | Task 46 added redirects for all moved pages |
| Timer race conditions | Tasks 61-64 completely overhauled timer system |
| Missing error boundaries | Already in place via `ErrorBoundary` + `PageErrorBoundary` |
| Email template inconsistencies | Task 54 + Task 75 standardized all email templates |
| Scenario data quality | Task 51 performed comprehensive audit and fixes |

---

## Sprint Recommendations

### Next Sprint (if cleanup focused)

1. **Dead code cleanup** — Review and address `DEAD_CODE_REPORT.md` findings (1-2 hours)
2. **Add 5-10 critical API tests** — Cover auth, lab days, students (4-8 hours)
3. **JSONB constraints** — Add CHECK constraints on key JSONB columns (1-2 hours)

### Future Sprint (when bandwidth allows)

1. **Server Components** — Migrate dashboard to RSC (8-16 hours)
2. **Test coverage** — Expand to 50+ tests covering all CRUD operations (16+ hours)
3. **Migration squash** — Consolidate 171 files to baseline + recent (4-8 hours)
