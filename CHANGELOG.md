# Changelog

All notable changes to the PMI EMS Scheduler are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and
the project uses [Semantic Versioning](https://semver.org/).

---

## [1.4.0] - 2026-02-28

### Added
- Error boundaries on every page and section — crashes are caught gracefully with a recovery UI instead of a blank white screen
- PWA offline support via service worker — the app continues to function without an internet connection, with an offline banner indicating degraded mode
- Skeleton loading states throughout the app — blank screens while data loads are replaced with animated placeholder skeletons
- Database tools page for admins (`/admin/db-tools`) — includes connection health checks, table size inspection, and a safe read-only query runner
- Full help documentation at `/help` — covers Getting Started, Features by Role, FAQ, Keyboard Shortcuts, Video Tutorials (planned), and how to Report an Issue
- Changelog system — this file plus a "What's New" modal that surfaces key changes to users after a version bump
- Granular notification preferences API — per-category email and push notification settings with immediate or daily-digest delivery modes
- Onboarding tour system — role-specific guided tour for first-time users; can be replayed from Settings at any time
- Improved form validation — inline error messages, required field indicators, and input validation helpers in `lib/validation.ts`

### Changed
- Global search API returns richer result previews with contextual snippets
- Accessibility improvements across the app: focus ring styles, ARIA labels, semantic HTML elements, and form labels

---

## [1.3.0] - 2026-02-21

### Added
- Activity tracker — captures recent page visits and surfaces them in the Command Palette
- Quick Actions menu — floating action button giving one-tap access to frequently used workflows
- Command Palette (`Ctrl+K` / `⌘K`) — keyboard-driven search and navigation across all major sections
- Global timer banner — visible countdown when a lab timer is running, accessible from any page
- Offline provider and OfflineBanner component — detects network state and warns users

### Changed
- Settings page restructured with tabbed sections: Notifications, Email, Timer Audio, Profile, and Onboarding

---

## [1.2.0] - 2026-02-14

### Added
- Help page (`/help`) — initial version with Getting Started steps, FAQ, and keyboard shortcuts
- Onboarding tour wrapper — automatically shows the welcome modal and guided tour to new users
- Global search API (`/api/search`) — searches students, scenarios, lab days, tasks, and more
- Feedback button — persistent floating button on every page for bug reports and feature requests
- Notification bell component — shows unread notification count in the header

### Changed
- Theme toggle moved to the settings page; dark mode preference is now persisted in localStorage
- Dashboard widgets are now reorderable via drag-and-drop

---

## [1.1.0] - 2026-02-07

### Added
- Student portal (`/student`) — students can view their own progress, clinical hours, skill sign-offs, and portfolio
- Preceptor evaluation forms — hospital preceptors can submit evaluations linked to clinical shifts
- Cohort archive — completed cohorts can be archived and browsed separately from active cohorts
- Endorsement system — instructors can endorse students for specific skills with audit trail
- BLS Platinum Checklist component — tracks BLS skill completion against platinum standard requirements
- Swap interest panel — students can indicate interest in swapping scheduled lab slots
- Site visit alerts — automatic alerts when clinical site visit deadlines are approaching
- Capacity warnings — visual indicators when lab sections are near or at capacity

### Changed
- Lab header redesigned with inline status indicators and quick-action buttons
- Student picker component updated with search, role filter, and multi-select support

### Fixed
- Scheduling poll results not refreshing after a new response was submitted
- Clinical hours total miscalculating when shifts crossed midnight

---

## [1.0.0] - 2026-01-31

### Added
- Core scheduling system — instructors can create scheduling polls; students submit availability; results are aggregated
- Lab management (`/lab-management`) — manage lab days, sections, scenarios, and student assignments
- Clinical tracking (`/clinical`) — track hospital clinical shifts, agency internship hours, and field contacts
- Admin panel (`/admin`) — user management, role assignment, cohort creation, and system reports
- Scenario library — create, version, and assign EMS scenarios to lab days
- Task management — Kanban board for tracking program tasks with due dates and assignments
- Lab Day Templates — reusable templates for common lab day structures
- Reports page — exportable reports for clinical hours, lab attendance, scenario completion, and certifications
- Excel and PDF export utilities in `lib/export-utils.ts`
- ICS calendar export — lab and clinical schedules can be exported to calendar apps
- Barcode support for student ID scanning at lab check-in
- Role-based access control — superadmin, admin, lead_instructor, instructor, volunteer_instructor, student, guest
- Google OAuth authentication restricted to @pmi.edu and @my.pmi.edu domains
- Audit logging for all sensitive operations via `lib/audit.ts`
- Email notification system with per-event templates
- Dark mode support via next-themes

---

[1.4.0]: https://github.com/your-org/pmi-scheduler/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/your-org/pmi-scheduler/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/your-org/pmi-scheduler/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/your-org/pmi-scheduler/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/your-org/pmi-scheduler/releases/tag/v1.0.0
