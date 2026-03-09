# PMI EMS Scheduler — Master Roadmap

> Updated: March 8, 2026

---

## Project Stats

| Metric | Count |
|--------|-------|
| Page routes | 208 |
| API routes | 447 |
| React components | 122 |
| Library modules | 30 |
| Database tables | ~60+ |
| Migration files | 171 |
| Cron jobs | 15 |
| Total commits | 639 |
| Lines of TS/TSX | ~61,800 |

---

## What Was Completed (March 4-8, 2026)

~80+ commits shipped across the following categories:

### Core Features

| Tasks | Feature |
|-------|---------|
| 81-85 | **Case Study Application** — Full case study system with 10 database tables, library page, case editor, practice mode with immersive UI, 5 sample cases, navigation integration |
| 86-88 | **Classroom Session System** — Realtime classroom API with join flow, instructor control panel, TV display, student participation UI with realtime sync |
| 89 | **Gamification** — Leaderboards, badges, achievements, stats tracking |
| 90A-D | **AI Case Generation** — Migration, generation endpoints with validation pipeline, brief catalog (42 cases), admin UI with coverage dashboard + prompt editor |
| 48 | **OSCE Events Refactoring** — Parent event table, event-scoped API routes, admin pages, public signup, calendar invites, observer management |
| 92 | **Google Calendar Phase 4** — Multi-calendar availability, site visit sync, Google Calendar overlay, admin sync dashboard, auto-sync cron |

### Infrastructure & Quality

| Tasks | Feature |
|-------|---------|
| 76 | React Query caching layer with 9 custom hooks |
| 77 | AI-powered scenario content generation |
| 78 | Accessibility + dark mode audit |
| 79 | Print views + PDF exports for key pages |
| 80 | Reporting & analytics dashboards with 5 report views |
| 93 | Fix `getServerSession(authOptions)` across 72 API routes |
| 94-97 | PostgREST FK disambiguation (PGRST201 fixes) |
| 96 | FK ambiguity checker script (`check-fk-ambiguity.js`) |

### Polish & Bug Fixes

| Tasks | Feature |
|-------|---------|
| 50-54 | Clinical alerts, scenario audit, notifications, shift signups, email digest |
| 55-60 | Breadcrumbs, equipment table, skill sheets, site visits, OSCE breadcrumbs, shifts calendar |
| 61-65 | Timer overhaul (single active, desync fix, quick display, adaptive polling), component splitting |
| 66-70 | Student portal, scenario auto-fill, historical import, SELECT * cleanup, skill sheets |
| 71-75 | Skill sheet verify, scenario transform, mCE tracker redesign, email polish |
| Bugs 1-8 | requireAuth 500 errors, timer desync, breadcrumbs, PWA icons, feedback items |

---

## Remaining Roadmap Items

### High Priority

#### Unit & Integration Tests
- **Status**: Not started
- **Scope**: API route tests (auth, CRUD), component snapshot tests, database query tests
- **Effort**: Ongoing — start with 10-20 critical path tests

### Medium Priority

#### LVFR AEMT Contract Support
- **Status**: Planning
- **Scope**: AEMT-specific views, separate tracking, contract reporting
- **Details**: May require additional student types or program tracks

#### WebSocket / Real-Time Enhancements
- **Status**: Classroom sessions use polling, timer system uses polling
- **Scope**: Consider migrating classroom realtime to true WebSocket (Supabase Realtime or Socket.io)
- **Benefit**: Lower latency for classroom participation and timer sync

### Low Priority

#### Multi-Campus Support
- **Status**: Not started
- **Scope**: Location-aware scheduling, campus-specific settings, cross-campus reporting
- **Prerequisite**: Business need from PMI leadership

#### Offline / PWA Enhancement
- **Status**: Basic service worker exists (Task 7)
- **Scope**: Cache API responses, offline-first for critical pages, background sync
- **Benefit**: Reliability during network issues in clinical settings

#### RFID Lab Station System
- **Status**: Hardware planned, database tables exist (access_cards, access_devices, access_logs)
- **Scope**: Student attendance via RFID taps, station login, rotation tracking
- **Prerequisite**: RFID hardware deployment at stations

---

## Open Feedback Items

Minimal — most user feedback has been addressed through Tasks 38 (FeedbackButton visibility), Bug 8 (6 resolved feedback items), and continuous polish passes.

---

## Technical Debt Status

| Category | Status |
|----------|--------|
| Auth consistency | ✅ Resolved (Task 93) |
| RBAC enforcement | ✅ Resolved (Tasks 35, 41) |
| FK disambiguation | ✅ Resolved (Tasks 94-97) |
| Console.log cleanup | ✅ Resolved (Task 42) |
| Client factory consolidation | ✅ Resolved (Task 42) |
| Component splitting | ✅ Resolved (Task 65) |
| N+1 queries | ✅ Resolved (Task 45) |
| Breadcrumb navigation | ✅ Resolved (Tasks 55, 59) |
| Test coverage | ❌ Not started |
| Migration squashing | 🟡 Optional (171 files) |
| Server Components | 🟡 Optional (all pages are CSR) |
| JSONB validation | 🟡 Optional |

---

## Architecture Notes

### Tech Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Supabase** (PostgreSQL) — direct queries, no ORM
- **NextAuth.js 4** — Google OAuth, `@pmi.edu` restriction
- **Tailwind CSS 4** — dark mode via `next-themes`
- **Vercel** — auto-deploy from `main`, cron jobs
- **Google Calendar API v3** — FreeBusy, Events CRUD, multi-calendar

### Key Patterns
- `requireAuth(authOptions)` for API route protection
- `getSupabaseAdmin()` for all server-side queries (bypasses RLS)
- Fire-and-forget for calendar sync and notifications
- React Query hooks for client-side caching (Task 76)
- FK disambiguation with `!fk_constraint_name` syntax
- `check-fk-ambiguity.js` script for regression prevention
