# Contributing to PMI EMS Scheduler

This document describes the conventions and workflow for developing the PMI EMS Scheduler.

---

## Git Workflow

### Direct-to-Main

This project deploys directly from `main` via Vercel. **Do not use feature branches or pull requests** unless explicitly requested.

All work goes directly to `main`:

```bash
git add <specific-files>
git commit -m "descriptive commit message"
git push origin main
```

Always run `npm run build` before pushing to catch type errors and build failures before they affect the live deployment.

### Worktree Branches

Worktree branches (e.g. `condescending-goldberg`) are temporary workspaces only. Before ending a session, merge completed work to `main`:

```bash
git checkout main
git merge <worktree-branch> --no-edit
git push origin main
```

Never leave completed work stranded on a worktree branch.

---

## Commit Message Format

Write concise, imperative commit messages that describe what changed and why:

```
Add certification expiry alerts to instructor portal

Fix student search returning incorrect cohort results

Update permission check for volunteer_instructor lab schedule access
```

- Use present tense imperative ("Add", "Fix", "Update", not "Added", "Fixed", "Updated")
- Keep the first line under 72 characters
- If more context is needed, leave a blank line after the summary, then add body text

---

## Code Style

### TypeScript

- **Strict mode is enabled.** All types must be explicit; avoid `any` unless absolutely necessary (add an eslint-disable comment with an explanation if needed).
- Use TypeScript interfaces for object shapes. Define shared types in `types/`.
- API route handler return types are inferred; use `NextResponse.json()` consistently.

### Styling

- **Tailwind CSS only.** No CSS modules, no inline `style` attributes, no external CSS files (except `globals.css` for base resets).
- Use `dark:` variants for all color-bearing classes to support dark mode.
- Use the `clsx` / `tailwind-merge` utilities (via `lib/utils.ts`) when conditionally composing class names.
- Color conventions:
  - Primary actions: `blue-600`
  - Destructive actions: `red-600`
  - Success/active: `green-600`
  - Warning: `amber-500` / `yellow-500`
  - Neutral backgrounds: `gray-50` / `gray-800` (light/dark)

### Icons

Use **Lucide React** icons only. Do not introduce other icon libraries.

---

## Component Conventions

### Client vs. Server Components

- Most pages are **client components** (`'use client'`). They fetch data at runtime via API routes using `useEffect` and `fetch()`.
- Only use React Server Components for static content with no interactivity or client-side data fetching.

### Page Structure

A typical page component follows this pattern:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function FeaturePage() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/feature')
      .then(res => res.json())
      .then(json => {
        setData(json.data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load data');
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div>{error}</div>;

  return (/* ... */);
}
```

### Dark Mode

Every component must support dark mode. Use `dark:` Tailwind variants on all color-bearing classes:

```tsx
// Correct
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">

// Wrong - breaks dark mode
<div className="bg-white text-gray-900">
```

### Loading and Error States

- Show a loading spinner or skeleton UI while data is fetching. Use `<LoadingSpinner />` or the `<SkeletonCard />` / `<SkeletonStats />` components from `components/ui/`.
- Show a user-friendly error message if a fetch fails. Never expose raw error objects or stack traces to the UI.

### Error Boundaries

Wrap page sections in `<ErrorBoundary>` or `<PageErrorBoundary>` to prevent a single failing widget from crashing the whole page.

---

## API Route Conventions

All API routes live in `app/api/` and follow this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  // 1. Auth check - always first
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Permission check if needed
  // const user = await getCurrentUser(session.user.email);
  // if (!canAccessAdmin(user.role)) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  // 3. Database query
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('table').select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
```

Rules:
- **Always** check `session` before any database operation.
- Use `getSupabaseAdmin()` (service role) in API routes — never the anon client.
- Return `{ success: true, ...data }` for successful responses for consistency.
- Return `{ error: string }` with an appropriate HTTP status for errors.
- Log sensitive operations via `lib/audit.ts`.

---

## Database Migrations

### File Naming

```
supabase/migrations/YYYYMMDD_short_description.sql
```

Example: `20260228_add_cohort_notes_column.sql`

Use today's date. If multiple migrations are created on the same day, add a suffix: `_add_cohort_notes_v2.sql`.

### Migration Template

```sql
-- supabase/migrations/YYYYMMDD_description.sql
-- Brief description of what this migration does

-- Tables
CREATE TABLE IF NOT EXISTS feature_table (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Row-Level Security (always required)
ALTER TABLE feature_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON feature_table
  FOR ALL USING (true);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_feature_table_user_id ON feature_table(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_table_created_at ON feature_table(created_at DESC);
```

### Rules

- Always use `IF NOT EXISTS` / `IF EXISTS` to make migrations re-runnable.
- Every new table needs `created_at` and `updated_at` timestamps.
- Every new table needs `ENABLE ROW LEVEL SECURITY` and at least a service-role policy.
- Add an index for any column used in a `WHERE`, `ORDER BY`, or foreign key join.
- Avoid `ALTER TABLE ... DROP COLUMN` on tables with existing production data unless coordinated with a data migration.

---

## Permissions and Role Checks

Use the helpers from `lib/permissions.ts`. Do not hard-code role strings in application logic.

```typescript
import { canAccessAdmin, canAccessClinical, hasMinRole } from '@/lib/permissions';

// In API routes
if (!canAccessAdmin(user.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// In UI
{canAccessClinical(currentUser.role) && <ClinicalLink />}
```

See `lib/permissions.ts` for the full list of available permission helpers.

---

## Audit Logging

Log all sensitive operations — access to student records, exports, deletions, and admin actions — via `lib/audit.ts`. Audit logging must never cause a request to fail; it is fire-and-forget.

```typescript
import { logStudentAccess, logDataExport } from '@/lib/audit';

await logStudentAccess(
  { id: user.id, email: user.email, role: user.role },
  student.id,
  `${student.first_name} ${student.last_name}`,
  request.headers.get('x-forwarded-for') ?? undefined
);
```

---

## No New Dependencies

Do not install new npm packages without explicit approval. Evaluate whether an existing dependency already covers the need before adding something new.
