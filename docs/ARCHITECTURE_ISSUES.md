# PMI EMS Scheduler - Architecture Issues

## Overview

This document identifies architectural issues, dead code, placeholders, and inconsistencies discovered during the codebase audit.

---

## Critical Issues

### 1. Duplicate Admin Pages (HIGH PRIORITY)

**Problem:** Two separate admin areas with overlapping functionality and inconsistent implementations.

| Page | `/admin/` | `/lab-management/admin/` |
|------|-----------|--------------------------|
| User Management | `/admin/users` - **COMPLETE** (5 roles) | `/admin/users` - **INCOMPLETE** (4 roles, missing lead_instructor, superadmin, guest) |
| Deletion Requests | `/admin/deletion-requests` | `/admin/deletion-requests` - **DUPLICATE** |
| Certifications | Compliance overview | Individual records - **DIFFERENT PURPOSE** |

**Impact:**
- Confusing UX with two places to manage users
- Risk of inconsistent data if different APIs are used
- Missing role options in lab-management version

**Solution:** Consolidate user management and deletion requests to `/admin/` only. Keep certification pages separate (different purposes).

---

### 2. Inconsistent Role System

**Problem:** `/lab-management/admin/users` uses a different role set than the authoritative system.

**Authoritative Roles (lib/permissions.ts):**
- superadmin (level 5)
- admin (level 4)
- lead_instructor (level 3)
- instructor (level 2)
- guest (level 1)
- pending (level 0)

**Lab Management Admin Users shows:**
- admin
- instructor
- user (not a real role!)
- pending

**Impact:**
- Users assigned "user" role may have undefined behavior
- Can't assign lead_instructor from this interface
- Can't see or manage superadmins/guests

---

### 3. Poll Creation in Wrong Location

**Problem:** `/admin/create` is for creating scheduling polls, not admin functions.

**Current:** `/admin/create/page.tsx` - Creates scheduling polls
**Expected:** Should be at `/scheduler/create` or `/poll/create`

**Impact:** Confusing navigation, unexpected content in admin area

---

## Moderate Issues

### 4. Missing Navigation Link to Settings

**Problem:** The new `/settings` page for email notification preferences has no link in the main navigation.

**Current:** Users have to manually navigate to `/settings`
**Expected:** Link in header dropdown or sidebar

---

### 5. Dead/Placeholder Features in Admin Settings

**Problem:** `/admin/settings` has buttons that show "coming soon" toasts instead of actual functionality.

```tsx
// Export Data button
onClick={() => showToast('Export feature coming soon', 'success')}

// Clear Expired Sessions
onClick={() => showToast('Cleanup feature coming soon', 'success')}

// Purge Old Data (disabled)
onClick={() => showToast('This action is disabled for safety', 'error')}
```

**Impact:** False expectations, incomplete admin tooling

---

### 6. Inconsistent API Paths

**Problem:** Some features have APIs in multiple locations.

| Feature | Path 1 | Path 2 |
|---------|--------|--------|
| Deletion Requests | `/api/admin/deletion-requests` | `/api/lab-management/deletion-requests` |
| Users | `/api/admin/users` | `/api/lab-management/users` |

**Impact:** Maintenance burden, potential data inconsistency

---

### 7. Missing Error Boundaries

**Problem:** No React error boundaries for graceful failure handling.

**Impact:** Entire page crashes if a component throws an error

---

### 8. Hardcoded Values

**Problem:** Some configuration is hardcoded instead of stored in database/env.

**Examples:**
- Protected superadmin emails in `lib/permissions.ts`
- Timer default values in components
- Email templates have hardcoded PMI branding

---

## Low Priority Issues

### 9. Inconsistent Loading States

**Problem:** Loading states vary between pages.

- Some use full-screen spinner
- Some use skeleton loaders
- Some use inline spinners
- Some have no loading state

---

### 10. Large Component Files

**Problem:** Some components are too large and should be split.

| Component | Lines | Recommendation |
|-----------|-------|----------------|
| `Scheduler.tsx` | 1743 | Split into sub-components |
| `LabTimer.tsx` | 1075 | Extract timer logic to hook |
| `feedback/page.tsx` | 865 | Extract card components |

---

### 11. Duplicate Type Definitions

**Problem:** Similar interfaces defined in multiple files.

**Examples:**
- `Student` interface in multiple pages
- `CurrentUser` interface copied across admin pages
- `Role` type imported vs. locally defined

---

### 12. Missing TypeScript Strict Mode

**Problem:** `tsconfig.json` may not have strictest settings.

**Potential issues:**
- Implicit `any` types
- Nullable values not checked
- Unused variables not caught

---

### 13. No Unit Tests

**Problem:** No test files found in the codebase.

**Impact:**
- Regression risk during refactoring
- No automated validation of business logic

---

### 14. Email Template Duplication

**Problem:** Email templates in `lib/email.ts` have repeated HTML structure.

**Impact:** Hard to maintain consistent branding across emails

---

### 15. Polling Intervals Not Configurable

**Problem:** Hardcoded polling intervals across components.

**Examples:**
- NotificationBell: 60s
- TimerBanner: 5s/30s
- GlobalTimerBanner: 5s/60s

---

## Code Quality Observations

### Positive Patterns

- Consistent use of TypeScript
- Good separation of concerns (API routes vs pages)
- Consistent Tailwind styling with dark mode
- FERPA audit logging implemented
- Role-based permission checks

### Areas for Improvement

- More component reuse (forms, tables, modals)
- Centralized error handling
- API response standardization
- Environment-based configuration

---

## Security Considerations

### Currently Good

- Role-based access control implemented
- FERPA audit logging for sensitive data
- Protected superadmin accounts
- RLS policies in database

### Needs Attention

- API routes should validate all inputs
- Rate limiting not implemented
- No CSRF protection beyond Next.js defaults
- Some APIs may expose too much data in errors

---

## Performance Observations

### Potential Issues

- Large bundle size (Scheduler component)
- Multiple polling requests on dashboard
- No data caching strategy
- Full page re-renders on state changes

### Recommendations

- Implement React Query or SWR for data fetching
- Add component-level code splitting
- Optimize re-renders with memo/useMemo
- Consider server components where appropriate

---

*Generated: 2026-02-17*
