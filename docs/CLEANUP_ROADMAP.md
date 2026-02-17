# PMI EMS Scheduler - Cleanup Roadmap

## Overview

Prioritized cleanup tasks based on the architecture audit. Tasks are organized by priority (P0-P3) and estimated effort.

---

## Priority Levels

| Priority | Description | Timeline |
|----------|-------------|----------|
| P0 | Critical - Blocking/breaking issues | Immediate |
| P1 | High - User-facing problems | This sprint |
| P2 | Medium - Technical debt | Next sprint |
| P3 | Low - Nice to have | Backlog |

---

## P0: Critical (Immediate)

### 1. Consolidate Admin User Management

**Status:** IN PROGRESS

**Tasks:**
- [x] Audit admin structure (completed)
- [ ] Remove `/lab-management/admin/users/page.tsx`
- [ ] Update `/lab-management/admin/page.tsx` to link to `/admin/users`
- [ ] Add redirect from `/lab-management/admin/users` to `/admin/users`

**Effort:** 1 hour
**Files:**
- `app/lab-management/admin/users/page.tsx` - DELETE
- `app/lab-management/admin/page.tsx` - UPDATE

---

### 2. Consolidate Deletion Requests

**Tasks:**
- [ ] Remove `/lab-management/admin/deletion-requests/page.tsx`
- [ ] Update `/lab-management/admin/page.tsx` to link to `/admin/deletion-requests`
- [ ] Add redirect from `/lab-management/admin/deletion-requests`
- [ ] Verify both APIs (`/api/admin/` and `/api/lab-management/`) are needed

**Effort:** 1 hour
**Files:**
- `app/lab-management/admin/deletion-requests/page.tsx` - DELETE
- `app/lab-management/admin/page.tsx` - UPDATE

---

## P1: High Priority (This Sprint)

### 3. Move Poll Creation to Correct Location

**Tasks:**
- [ ] Move `/admin/create/page.tsx` to `/scheduler/create/page.tsx`
- [ ] Update any links pointing to `/admin/create`
- [ ] Add redirect from `/admin/create` to `/scheduler/create`

**Effort:** 30 minutes
**Files:**
- `app/admin/create/page.tsx` - MOVE
- `app/scheduler/create/page.tsx` - CREATE

---

### 4. Add Settings Navigation Link

**Tasks:**
- [ ] Add "Settings" link to NotificationBell dropdown
- [ ] Or add to user menu in LabHeader
- [ ] Consider adding to `/admin` dashboard for admins

**Effort:** 30 minutes
**Files:**
- `components/NotificationBell.tsx` - UPDATE
- `components/LabHeader.tsx` - UPDATE (optional)

---

### 5. Fix Lab-Management Admin Dashboard Links

**Tasks:**
- [ ] Remove "Manage Users" card (duplicate)
- [ ] Remove "Deletion Requests" card (duplicate)
- [ ] Add link to `/admin/users` in "Related Areas"
- [ ] Keep cohorts, feedback, timer-displays, certifications

**Effort:** 30 minutes
**Files:**
- `app/lab-management/admin/page.tsx` - UPDATE

---

### 6. Create Redirect Middleware

**Tasks:**
- [ ] Create `middleware.ts` or use Next.js redirects
- [ ] Add redirects for deprecated routes:
  - `/lab-management/admin/users` → `/admin/users`
  - `/lab-management/admin/deletion-requests` → `/admin/deletion-requests`
  - `/admin/create` → `/scheduler/create`

**Effort:** 1 hour
**Files:**
- `next.config.js` - UPDATE (add redirects)

---

## P2: Medium Priority (Next Sprint)

### 7. Implement Admin Settings Features

**Tasks:**
- [ ] Export Data: Create `/api/admin/export` endpoint
- [ ] Clear Expired Sessions: Create cleanup endpoint
- [ ] Add confirmation modals before actions

**Effort:** 4 hours
**Files:**
- `app/admin/settings/page.tsx` - UPDATE
- `app/api/admin/export/route.ts` - CREATE
- `app/api/admin/cleanup/route.ts` - CREATE

---

### 8. Consolidate Type Definitions

**Tasks:**
- [ ] Create `types/index.ts` with shared types
- [ ] Create `types/student.ts`, `types/user.ts`, etc.
- [ ] Update imports across codebase
- [ ] Remove duplicate interface definitions

**Effort:** 2 hours
**Files:**
- `types/*.ts` - CREATE/UPDATE
- Multiple page files - UPDATE imports

---

### 9. Standardize Loading States

**Tasks:**
- [ ] Create `components/LoadingSpinner.tsx`
- [ ] Create `components/PageSkeleton.tsx`
- [ ] Apply consistently across all pages

**Effort:** 2 hours
**Files:**
- `components/LoadingSpinner.tsx` - CREATE
- `components/PageSkeleton.tsx` - CREATE

---

### 10. Add Error Boundaries

**Tasks:**
- [ ] Create `components/ErrorBoundary.tsx`
- [ ] Wrap major page sections
- [ ] Add error reporting to feedback system

**Effort:** 2 hours
**Files:**
- `components/ErrorBoundary.tsx` - CREATE
- `app/layout.tsx` - UPDATE

---

### 11. Extract Email Template Base

**Tasks:**
- [ ] Create `lib/email-templates/base.ts`
- [ ] Refactor `lib/email.ts` to use base template
- [ ] Make branding configurable

**Effort:** 2 hours
**Files:**
- `lib/email-templates/base.ts` - CREATE
- `lib/email.ts` - UPDATE

---

## P3: Low Priority (Backlog)

### 12. Split Large Components

**Tasks:**
- [ ] Split `Scheduler.tsx` into:
  - `SchedulerCreate.tsx`
  - `SchedulerParticipant.tsx`
  - `SchedulerAdmin.tsx`
  - `SchedulerCalendar.tsx`
- [ ] Split `LabTimer.tsx` into:
  - `LabTimerDisplay.tsx`
  - `LabTimerControls.tsx`
  - `useLabTimer.ts` hook

**Effort:** 8 hours

---

### 13. Add Unit Tests

**Tasks:**
- [ ] Set up Jest + React Testing Library
- [ ] Add tests for permission functions
- [ ] Add tests for utility functions
- [ ] Add component tests for critical paths

**Effort:** 16 hours

---

### 14. Configuration Externalization

**Tasks:**
- [ ] Move protected superadmins to database
- [ ] Create system settings table
- [ ] Add admin UI for managing settings
- [ ] Make timer defaults configurable

**Effort:** 8 hours

---

### 15. Performance Optimization

**Tasks:**
- [ ] Implement React Query for data fetching
- [ ] Add component-level code splitting
- [ ] Optimize polling with WebSocket consideration
- [ ] Add data caching layer

**Effort:** 16 hours

---

### 16. API Response Standardization

**Tasks:**
- [ ] Create `lib/api-response.ts` helper
- [ ] Standardize all API responses
- [ ] Add proper error codes
- [ ] Document API contracts

**Effort:** 8 hours

---

## Quick Wins (< 30 min each)

| Task | File | Change |
|------|------|--------|
| Remove unused imports | Various | Cleanup |
| Add TypeScript strict mode | `tsconfig.json` | Enable strict |
| Update Next.js config | `next.config.js` | Add redirects |
| Fix console warnings | Various | Remove warnings |
| Add missing alt tags | Various | Accessibility |

---

## Completed Tasks

- [x] Create `/docs/SITEMAP.md`
- [x] Create `/docs/DATABASE_SCHEMA.md`
- [x] Create `/docs/COMPONENTS.md`
- [x] Create `/docs/ARCHITECTURE_ISSUES.md`
- [x] Create `/docs/CLEANUP_ROADMAP.md`
- [x] Audit admin structure

---

## Sprint Planning Suggestion

### Sprint 1 (Current)
1. P0: Consolidate admin user management
2. P0: Consolidate deletion requests
3. P1: Move poll creation
4. P1: Add settings navigation
5. P1: Fix admin dashboard links
6. P1: Create redirects

### Sprint 2
1. P2: Implement admin settings features
2. P2: Consolidate type definitions
3. P2: Standardize loading states

### Sprint 3
1. P2: Add error boundaries
2. P2: Extract email template base
3. P3: Split large components (start)

### Future
1. P3: Add unit tests
2. P3: Configuration externalization
3. P3: Performance optimization
4. P3: API response standardization

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Duplicate pages | 3 | 0 |
| Components > 500 lines | 3 | 0 |
| Test coverage | 0% | 50% |
| TypeScript errors | ? | 0 |
| Console warnings | ? | 0 |

---

*Generated: 2026-02-17*
*Last Updated: 2026-02-17*
