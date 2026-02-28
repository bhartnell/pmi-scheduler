# PMI EMS Scheduler

A comprehensive scheduling and management system for the **Pima Medical Institute Paramedic Program**. Handles lab management, clinical tracking, student onboarding, scheduling polls, instructor certifications, shift management, and program reporting.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL), direct client queries |
| Auth | NextAuth.js 4, Google OAuth |
| Styling | Tailwind CSS 4, Lucide React icons |
| Email | Resend |
| Export | xlsx (Excel), html2pdf.js (PDF), react-barcode |
| Deployment | Vercel (frontend) + Supabase (database) |

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A Supabase project (PostgreSQL database)
- A Google Cloud project with OAuth 2.0 credentials

### 1. Clone and install

```bash
git clone <repo-url>
cd pmi-scheduler
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Google OAuth (https://console.cloud.google.com)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Supabase (https://supabase.com/dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**Note:** `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side API routes and is never exposed to the browser.

### 3. Apply database migrations

Run the SQL migration files in `supabase/migrations/` against your Supabase project in chronological order. The Supabase CLI or the Supabase dashboard SQL editor can be used.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with a `@pmi.edu` or `@my.pmi.edu` Google account.

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbo mode |
| `npm run build` | Production build (also used to verify type correctness) |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript check without emit |
| `npm run clean` | Remove `.next` build cache |

---

## Project Structure

```
app/
  api/              # API route handlers (organized by feature)
    cron/           # Vercel cron job handlers
    admin/          # Admin-only endpoints
    clinical/       # Clinical & internship endpoints
    lab-management/ # Lab management endpoints
    ...
  admin/            # Admin pages (user management, settings)
  clinical/         # Clinical & internship tracking pages
  lab-management/   # Lab scheduling, scenarios, and student assessment
  scheduler/        # Scheduling polls
  scheduling/       # Part-timer shift management
  onboarding/       # Instructor onboarding workflow
  reports/          # Program reporting and exports
  calendar/         # Unified calendar view
  instructor/       # Instructor certification and CE tracking
  student/          # Student portal
  auth/             # Sign-in page

components/
  dashboard/        # Dashboard widget components
  ui/               # Base UI primitives (skeleton, etc.)
  *.tsx             # Shared feature components

lib/
  auth.ts           # NextAuth config, Google OAuth, user provisioning
  permissions.ts    # Role-based access control helpers
  audit.ts          # FERPA audit logging
  supabase.ts       # Supabase client factory (getSupabase, getSupabaseAdmin)
  notifications.ts  # In-app and email notification helpers
  export-utils.ts   # Excel/PDF export utilities
  email.ts          # Transactional email via Resend
  validation.ts     # Shared input validation helpers
  rate-limit.ts     # API rate limiting

types/
  index.ts          # Shared TypeScript interfaces
  user.ts           # User and role types
  student.ts        # Student record types
  scheduling.ts     # Scheduling domain types
  lab-management.ts # Lab management domain types
  tasks.ts          # Task management types

supabase/
  migrations/       # SQL migration files (YYYYMMDD_description.sql)
```

---

## Authentication and Access

Sign-in is restricted to Google accounts. Access is granted as follows:

- `@pmi.edu` accounts: Created as `pending` role; require admin approval before accessing the app.
- `@my.pmi.edu` accounts: Auto-approved as `student` role.
- Non-PMI accounts: May sign in and submit a volunteer access request via `/request-access`.

See `docs/ARCHITECTURE.md` for the full role hierarchy and permission matrix.

---

## Deployment

The application deploys automatically from the `main` branch via Vercel. Push to `main` to deploy.

Vercel cron jobs are defined in `vercel.json` and run scheduled tasks such as:
- Daily digest notifications
- Attendance alerts
- Certification expiry warnings
- Clinical hours reminders
- System health checks

Environment variables must be configured in the Vercel project dashboard (Settings > Environment Variables).

---

## Documentation

- `CONTRIBUTING.md` - Code style, workflow, and conventions
- `docs/ARCHITECTURE.md` - System architecture, auth flow, database patterns
- `SECURITY_AUDIT.md` - Security audit findings and mitigations
