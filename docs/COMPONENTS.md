# PMI EMS Scheduler -- Component & Utility Reference

> Last refreshed 2026-05-23 (was auto-generated 2026-03-08).
> See [the "New / Updated Since March 2026" section below](#new--updated-since-march-2026)
> for additions during May; the original inventory below is still ~accurate
> for files that haven't been touched.

## Summary

| Category | Count (2026-05-23) | Δ vs March |
|----------|--------------------|-----------|
| Components (`components/**/*.tsx`) | 63 top-level + subdirs | +new lab-day, scenario, scheduling subdirs |
| Custom Hooks (`hooks/`) | 15 | unchanged |
| Shared Utilities (`lib/*.ts`) | 54 | +24 |

---

## New / Updated Since March 2026

### Major additions

**`components/scenario/ScenarioFullDisplay.tsx`** — Read-only renderer for
the full scenario card (dispatch, patient, SAMPLE, phases, vitals, critical
actions, debrief points). Used on the scenario edit page's preview pane
and inline in the grading flow. Decouples display formatting from the
edit form's input controls.

**`components/seating/Suite1Layout.tsx`** — Suite 1 SVG floor-plan layout
component. Renders the physical room as positionable student boxes (drag-
drop seating chart). Drives `/labs/seating/charts/[id]`. Honors print
styles (`@media print`) so a chart prints cleanly without UI chrome.

**`components/scheduling/GenerateLabShiftsModal.tsx`** — Modal flow for
generating recurring lab instructor shifts from a cohort's lab day
schedule. Picks date range, instructor pool, role types; previews shift
list before committing. Triggered from cohort hub.

**`components/Breadcrumbs.tsx`** (updated) — Now resolves more dynamic
segments (UUID, numeric, slug) and accepts a `customSegments` override
for paths where the canonical path doesn't match the displayed hierarchy.
Used by every refactored page (LabHeader, page-level breadcrumbs throughout).

**`components/lab-day/LabDayChat.tsx`** — Lab day live chat with Supabase
realtime presence + messages. Updated 2026-05-23 with exponential backoff
on `CHANNEL_ERROR` (1s → 2s → 4s → 8s → 16s, max 5 attempts), proper
channel teardown before retry, and a status indicator
('connecting' | 'connected' | 'reconnecting' | 'offline') so operators
know when the chat is dark. Lab controls (timer next/cleanup/etc.) are
independent of realtime — they go through direct API calls.

**`components/lab-day/EditStationModal.tsx`** — Widened from `max-w-lg`
to `max-w-2xl` on 2026-05-21; scenario picker now shows chief_complaint
+ category/difficulty/duration badges per row.

### Library / utilities

**`lib/scenario-export.ts`** — Pure converters for Export JSON / Update
from JSON / Bulk Export. `scenarioToImportShape()` translates DB-shape
or editor-shape scenarios into the bulk-import JSON shape (preserves id
for round-trip dedup). `buildSingleExport()` / `buildBulkExport()` wrap
in `{ scenarios: [...] }`. `downloadJson()` + `sanitizeFilename()` are
client-only helpers used by the edit page and list page. See the file's
header comment for what round-trips losslessly vs. what's currently
ignored by the bulk-importer.

**`lib/email.ts`** (updated) — Added per-lab-day NREMT kill-switch
scoping via `isNremtLabDay(labDayId)`. The central `sendEmail()` now
prefers per-lab-day scoping when callers pass `labDayId` and falls back
to the broader `isNremtTestingActiveToday()` only when context is
unknown. STUDENT_EVAL_TEMPLATES (`'skill_evaluation'`, `'scenario_feedback'`)
are the gated templates. Fails closed on DB error to prevent NREMT-day
leaks.

**`lib/date-input.ts`** — Date input utilities for the various date
pickers across the app. Handles AZ-local-date string formatting,
ISO-string parsing tolerant of partial inputs, and Date ↔ YYYY-MM-DD
round-tripping for `<input type="date">` controls.

**`lib/poll-link.ts`** — URL builders + token validation for scheduling
poll share links. Generates per-recipient signed tokens, normalizes
poll URLs across `/poll/[id]`, `/admin/poll/[id]`, and
`/scheduling/polls/[id]`.

**`lib/instructor-blocks.ts`** — Helper for assembling per-instructor
calendar blocks from `pmi_block_instructors` + `pmi_schedule_blocks`
queries. Used by the planner (`/academics/planner`), instructor
teaching schedule (`/instructor/teaching`), and the Google Calendar
auto-sync flow.

### Other notable additions

- `components/lab-day/LabDayCheckInSection.tsx` — student/instructor
  check-in panel embedded in the lab day view.
- `components/lab-day/IndividualTestingGrid.tsx` — NREMT-day grid mode
  replacing the rotation grid when `is_nremt_testing=true`.
- `components/lab-day/CostsSection.tsx` — equipment / instructor pay
  cost tracking per lab day.
- `components/lab-day/EquipmentSection.tsx` — equipment checkout
  tracking.
- `components/lab-day/DebriefNotesSection.tsx` + `DebriefSection.tsx` —
  post-lab debrief workflow.
- `components/lab-day/ScenarioPickerModal.tsx` — searchable scenario
  picker reused across station edit + checkoff flows.
- `components/grading/ScenarioReferencePanel.tsx` — read-only scenario
  reference panel on the grading page (so the grader can see scenario
  details without leaving the page).
- `components/grading/FlaggingPanel.tsx` — flag-for-follow-up panel
  on the grading page.
- `components/scheduling/CoordinatorCalendarView.tsx` — coordinator's
  unified calendar view across cohorts/labs/clinical.
- `components/scheduling/RequestCoverageModal.tsx` — instructor
  coverage-request flow.

### Library additions (full list, 2026-05-23)

`achievements`, `calendar-auto-sync`, `calendar-availability`,
`case-generation`, `case-session-realtime`, `case-validation`,
`coordinator-calendar-colors`, `date-input`, `email`, `email-templates`,
`endorsements`, `ferpa`, `ferpa-filter`, `fetch-utils`, `format-cohort`,
`format-name`, `google-calendar`, `google-shared-calendar`, `ics-export`,
`instructor-blocks`, `lvfr-availability`, `lvfr-utils`, `nremtExport`,
`nremt-instructions`, `pharm-scoring`, `planner-semester`, `poll-link`,
`practice-auth`, `print-utils`, `program-key`, `question-types`,
`rate-limit`, `safe-array`, `scenario-export`, `schedule-constraints`,
`semester-cascade`, `session-tracker`, `shift-calculator`,
`skillSheetPrintTemplate`, `totp`, `version`, `webhooks`. Plus the
originals (`api-auth`, `audit`, `auth`, `auth-helpers`, `config`,
`constants`, `export-utils`, `notifications`, `permissions`, `supabase`,
`utils`, `validation`).

---

## Original Inventory (2026-03-08)



## Components

### Layout & Page Structure

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `Breadcrumbs` | `components/Breadcrumbs.tsx` | `BreadcrumbsProps { entityTitle?, customSegments?, className? }` | Auto-generated breadcrumb navigation derived from the current pathname. Supports dynamic segments (UUIDs, numeric IDs) and custom label overrides. |
| `LabHeader` | `components/LabHeader.tsx` | `LabHeaderProps { breadcrumbs, title, actions, entityTitle }` | Standard page header used across lab management pages; renders breadcrumbs, page title, and action buttons. |
| `PageErrorBoundary` | `components/PageErrorBoundary.tsx` | `PageErrorBoundaryProps { children, fallback?, featureName? }` | React class-component error boundary for page-level crash recovery with retry support. |
| `SectionErrorPage` | `components/SectionErrorPage.tsx` | `SectionErrorPageProps { title?, message?, actionLabel?, actionHref? }` | Full-page error display for section-level failures with optional action link. |

### Navigation

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `CommandPalette` | `components/CommandPalette.tsx` | _(none)_ | Global Cmd+K / Ctrl+K command palette with navigation, quick actions, and API-backed search. |
| `QuickActionsMenu` | `components/QuickActionsMenu.tsx` | _(none)_ | Floating speed-dial menu providing shortcuts to common actions. |

### Forms & Inputs

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `AutoSaveIndicator` | `components/AutoSaveIndicator.tsx` | `AutoSaveIndicatorProps { saveStatus, showRestorePrompt, draftTimestamp, onRestore, onDiscard, onDismiss? }` | Shows save status badge and draft restore banner for auto-saved forms. |
| `FormError` | `components/FormError.tsx` | `FormErrorProps { message: string \| null }` | Inline field-level validation error message. |
| `FormField` | `components/FormField.tsx` | `FormFieldProps { label, htmlFor?, required?, error?, helpText?, children, className? }` | Reusable form field wrapper with label, error, and help text. |
| `TagInput` | `components/TagInput.tsx` | `TagInputProps { tags, onAdd, onRemove, placeholder?, maxTags? }` | Multi-tag text input with add/remove support. |
| `StudentPicker` | `components/StudentPicker.tsx` | `StudentPickerProps { value?, onChange, cohortId?, multi?, placeholder? }` | Searchable student selection dropdown. |
| `EmailSettingsPanel` | `components/EmailSettingsPanel.tsx` | `EmailSettingsPanelProps { compact? }` | Email notification preferences management panel. |

### Data Display

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `EmptyState` | `components/EmptyState.tsx` | `EmptyStateProps { icon?, title, message?, actionLabel?, actionHref?, onAction? }` | Reusable empty-state placeholder with optional call-to-action. |
| `ExportDropdown` | `components/ExportDropdown.tsx` | `ExportDropdownProps { config: ExportConfig; disabled? }` | Dropdown menu offering Print, PDF, and Excel export options. |
| `HelpTooltip` | `components/HelpTooltip.tsx` | `HelpTooltipProps { text, className?, size? }` | Info-circle icon with hover tooltip. |
| `LoadingSkeleton` | `components/LoadingSkeleton.tsx` | _(none)_ | Generic loading skeleton placeholder. |
| `LoadingSpinner` | `components/LoadingSpinner.tsx` | _(none)_ | Generic spinning loader indicator. |
| `PrintButton` | `components/PrintButton.tsx` | `PrintButtonProps { onClick, label?, size?, className? }` | Button that triggers a print action. |
| `QRCodeDisplay` | `components/QRCodeDisplay.tsx` | `QRCodeDisplayProps { value, size?, label? }` | Renders a QR code for check-in tokens and shareable links. |
| `ShareLink` | `components/ShareLink.tsx` | `ShareLinkProps { url, label? }` | Copy-to-clipboard shareable link component. |
| `StatCard` | `components/reports/StatCard.tsx` | `StatCardProps { label, value, trend?, icon?, color? }` | Metric stat card with optional trend indicator and icon. |
| `ReportCard` | `components/reports/ReportCard.tsx` | `ReportCardProps { title, children, className? }` | Card wrapper for report sections. |
| `CohortFilter` | `components/reports/CohortFilter.tsx` | `CohortFilterProps { value, onChange, className? }` | Cohort selection dropdown filter for reports. |
| `DateRangeFilter` | `components/reports/DateRangeFilter.tsx` | `DateRangeFilterProps { startDate, endDate, onChange, presets? }` | Date range picker with preset options for report filtering. |

### Timer

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `GlobalTimerBanner` | `components/GlobalTimerBanner.tsx` | _(none)_ | Persistent global timer banner shown across all pages during active lab rotations. |
| `InlineTimerWidget` | `components/InlineTimerWidget.tsx` | `InlineTimerWidgetProps { labDayId, onOpenFullTimer, paused? }` | Compact inline timer widget embedded in lab day pages. |
| `LabTimer` | `components/LabTimer.tsx` | `LabTimerProps { labDayId, stations?, rotationMinutes?, onComplete? }` | Full-featured lab rotation timer with station tracking and audio alerts. |
| `TimerBanner` | `components/TimerBanner.tsx` | `TimerBannerProps { labDayId, remainingSeconds, stationName?, onExpand? }` | Slim persistent banner showing timer countdown. |

### Dashboard

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `AnnouncementBanner` | `components/dashboard/AnnouncementBanner.tsx` | _(none)_ | System-wide announcement banner fetched from system config. |
| `CustomizeModal` | `components/dashboard/CustomizeModal.tsx` | `CustomizeModalProps { isOpen, onClose, widgets, quickLinks, onSave, role }` | Modal for customizing dashboard widget layout and quick link selection. |
| `DraggableWidgetGrid` | `components/dashboard/DraggableWidgetGrid.tsx` | `DraggableWidgetGridProps { widgets, onReorder, renderWidget }` | Drag-and-drop grid layout for dashboard widgets. |
| `ResizableWidget` | `components/dashboard/ResizableWidget.tsx` | `ResizableWidgetProps { widgetId, children, defaultSize? }` | Resizable container for dashboard widgets. Also exports `useWidgetSizes` hook. |
| `WidgetCard` | `components/dashboard/WidgetCard.tsx` | `WidgetCardProps { title, icon?, actions?, loading?, error?, children }` | Standard card wrapper for dashboard widgets. Also exports `WidgetEmpty`. |

#### Dashboard Widgets

| Widget | File | Description |
|--------|------|-------------|
| `AtRiskStudentsWidget` | `components/dashboard/widgets/AtRiskStudentsWidget.tsx` | Students with 2+ absences or 3+ consecutive missed labs. |
| `CertExpiryWidget` | `components/dashboard/widgets/CertExpiryWidget.tsx` | Certifications expiring within 90 days. |
| `MyLabsWidget` | `components/dashboard/widgets/MyLabsWidget.tsx` | Upcoming labs where the current user is assigned as instructor. |
| `MyTasksWidget` | `components/dashboard/widgets/MyTasksWidget.tsx` | Tasks assigned to the current user with quick mark-complete. |
| `NeedsAttentionWidget` | `components/dashboard/widgets/NeedsAttentionWidget.tsx` | Alerts for items requiring admin/lead action. |
| `NotificationsWidget` | `components/dashboard/widgets/NotificationsWidget.tsx` | Recent unread notifications. |
| `OnboardingWidget` | `components/dashboard/widgets/OnboardingWidget.tsx` | Onboarding progress tracker (conditional on active assignment). |
| `OpenStationsWidget` | `components/dashboard/widgets/OpenStationsWidget.tsx` | Lab stations that still need instructors assigned. |
| `OverdueTasksWidget` | `components/dashboard/widgets/OverdueTasksWidget.tsx` | Tasks past their due date. |
| `OverviewStatsWidget` | `components/dashboard/widgets/OverviewStatsWidget.tsx` | Summary counts for students, labs, and feedback. |
| `QuickLinksWidget` | `components/dashboard/widgets/QuickLinksWidget.tsx` | Customizable shortcut links to common pages. Also exports `QUICK_LINK_DEFINITIONS`. |
| `QuickStatsWidget` | `components/dashboard/widgets/QuickStatsWidget.tsx` | Key metrics at a glance: students, labs, tasks, completion rate. |
| `RecentActivityWidget` | `components/dashboard/widgets/RecentActivityWidget.tsx` | Latest system activity and audit log entries. |
| `RecentFeedbackWidget` | `components/dashboard/widgets/RecentFeedbackWidget.tsx` | Latest bug reports and feature requests. |

**Widget configuration** is managed via the barrel export at `components/dashboard/widgets/index.ts`, which exports `WIDGET_DEFINITIONS`, `WIDGET_WHITELIST`, `QUICK_LINK_WHITELIST`, `ROLE_DEFAULTS`, `getWidgetWhitelist()`, `filterWidgetsByRole()`, and the `WidgetId` type.

### Grading

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `GradingHeader` | `components/grading/GradingHeader.tsx` | `GradingHeaderProps { labDay, station?, onBack }` | Header bar for the grading interface showing lab/station context. |
| `ScenarioGrading` | `components/grading/ScenarioGrading.tsx` | `ScenarioGradingProps { scenarioId, studentIds, labDayId, stationId, onSave }` | Full scenario grading form with criteria ratings and feedback. |
| `EvaluationCriteria` | `components/grading/EvaluationCriteria.tsx` | `EvaluationCriteriaProps { criteria, ratings, onChange, readOnly? }` | Renders evaluation criteria with rating selectors. |
| `StudentSelection` | `components/grading/StudentSelection.tsx` | `StudentSelectionProps { students, selectedIds, onChange, mode? }` | Student multi-select for grading sessions. |
| `FlaggingPanel` | `components/grading/FlaggingPanel.tsx` | `FlaggingPanelProps { studentId, labDayId, existingFlags?, onSave }` | Panel for flagging student performance concerns. |

**Shared types** are in `components/grading/types.ts`: `Student`, `LabGroup`, `ScenarioPhase`, `Station`, `CriteriaRating`, plus constants `EVALUATION_CRITERIA`, `SKILLS_EVALUATION_CRITERIA`, `RATING_COLORS`, `RATING_LABELS`.

### Case Studies

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `AchievementCelebration` | `components/cases/AchievementCelebration.tsx` | `AchievementCelebrationProps { achievement, onDismiss }` | Animated celebration overlay when a student earns an achievement. |
| `BadgeShowcase` | `components/cases/BadgeShowcase.tsx` | `BadgeShowcaseProps { studentId }` | Displays earned achievement badges for a student. |
| `CaseEditor` | `components/cases/CaseEditor.tsx` | `CaseEditorProps { existingCase?, mode }` | Full case study editor for creating and editing clinical cases. |
| `Leaderboard` | `components/cases/Leaderboard.tsx` | `LeaderboardProps { cohortId?, limit? }` | Student leaderboard ranked by case study performance. |

### Calendar & Scheduling

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `CalendarAvailabilityDot` | `components/CalendarAvailabilityDot.tsx` | `{ status: 'free'\|'partial'\|'busy'\|'disconnected'; events?; size? }` | Color-coded dot indicating Google Calendar availability with tooltip. |
| `LabCalendarPanel` | `components/LabCalendarPanel.tsx` | `LabCalendarPanelProps { cohortId?, onDateSelect?, selectedDate? }` | Calendar panel for lab day scheduling with date selection. |
| `LabDayTemplateSelector` | `components/LabDayTemplateSelector.tsx` | `LabDayTemplateSelectorProps { onSelect, selectedId?, programId? }` | Template picker for creating new lab days from saved templates. |

### Scheduler (Scheduling Polls)

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `Scheduler` | `components/scheduler/index.tsx` | `SchedulerProps { mode, pollData?, onComplete? }` | Main scheduler component; routes between create, admin, and participant views. |
| `SchedulerAdmin` | `components/scheduler/SchedulerAdmin.tsx` | `SchedulerAdminProps { pollData, onComplete }` | Admin view for managing scheduling poll results. |
| `SchedulerCalendar` | `components/scheduler/SchedulerCalendar.tsx` | `SchedulerCalendarProps { dates, timeSlots, responses, onCellClick? }` | Calendar grid for scheduling poll responses. |
| `SchedulerCreate` | `components/scheduler/SchedulerCreate.tsx` | `SchedulerCreateProps { pollData?, onComplete }` | Form for creating a new scheduling poll. |
| `SchedulerParticipant` | `components/scheduler/SchedulerParticipant.tsx` | `SchedulerParticipantProps { pollData, onComplete }` | Participant view for submitting scheduling poll availability. |

**Shared types** are in `components/scheduler/types.ts`: `SchedulerProps`, `DateInfo`, `PollConfig`, `StudentData`, `RespondentRole`, `MeetingForm`, `MeetingResult`, `EmailForm`, `EmailResult`, `BestTimeSlot`.
**Utilities** are in `components/scheduler/utils.ts`: `agencies`, `respondentRoles`, `generateTimeSlots`, `generateDates`, `getCellColor`, `getRoleConfig`, `getAvailability`.

### Clinical

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `CloseoutSection` | `components/clinical/CloseoutSection.tsx` | `CloseoutSectionProps { internshipId, studentId, canEdit }` | Internship closeout management with surveys and verification. |
| `CloseoutSurveyModal` | `components/clinical/CloseoutSurveyModal.tsx` | `CloseoutSurveyModalProps { isOpen, onClose, internshipId, surveyType }` | Modal for completing closeout surveys. |
| `EmploymentVerificationModal` | `components/clinical/EmploymentVerificationModal.tsx` | `EmploymentVerificationModalProps { isOpen, onClose, internshipId }` | Modal for verifying student employment at clinical sites. |
| `PreceptorEvalModal` | `components/clinical/PreceptorEvalModal.tsx` | `PreceptorEvalModalProps { isOpen, onClose, preceptorId, internshipId }` | Modal for evaluating clinical preceptors. |
| `PreceptorsSection` | `components/clinical/PreceptorsSection.tsx` | `PreceptorsSectionProps { internshipId, canEdit }` | Preceptor list and management section within internship pages. |
| `SummativeEvaluationsSection` | `components/clinical/SummativeEvaluationsSection.tsx` | `SummativeEvaluationsSectionProps { internshipId, studentId }` | Displays summative evaluations for an internship. |

### Lab Day Detail

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ChecklistSection` | `components/lab-day/ChecklistSection.tsx` | `ChecklistSectionProps { labDayId, items?, onUpdate }` | Editable checklist for lab day preparation tasks. |
| `CostsSection` | `components/lab-day/CostsSection.tsx` | `CostsSectionProps { labDayId, items?, onUpdate }` | Lab day cost tracking with categorized line items. |
| `DebriefSection` | `components/lab-day/DebriefSection.tsx` | `DebriefSectionProps { labDayId, notes?, onSave }` | Post-lab debrief notes section. |
| `EquipmentSection` | `components/lab-day/EquipmentSection.tsx` | `EquipmentSectionProps { labDayId, items?, onUpdate }` | Equipment inventory and tracking for lab days. |
| `StationCards` | `components/lab-day/StationCards.tsx` | `StationCardsProps { stations, labDayId, onEdit?, onDelete? }` | Card grid displaying lab stations with type badges and instructor assignments. |
| `StudentRatingsSection` | `components/lab-day/StudentRatingsSection.tsx` | `StudentRatingsSectionProps { labDayId, students?, onRate }` | Student performance rating section for lab days. |

**Shared types** are in `components/lab-day/types.ts`: `LabDay`, `Station`, `Scenario`, `SkillDocument`, `Skill`, `Instructor`, `LabDayRole`, `Student`, `ScenarioParticipation`, `ChecklistItem`, `StudentRating`, `EquipmentItem`, `CostItem`, plus constants `COST_CATEGORIES`, `STATION_TYPES`, `STATION_TYPE_COLORS`, `STATION_TYPE_BADGES`.

### Attendance

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `AttendanceSection` | `components/AttendanceSection.tsx` | `AttendanceSectionProps { labDayId: string; cohortId: string }` | Full attendance management UI with status buttons, bulk actions, and notes. |
| `AttendanceAlertBanner` | `components/AttendanceAlertBanner.tsx` | `{ studentId: string }` | Shows attendance risk alerts for individual students. |
| `FieldTripAttendance` | `components/FieldTripAttendance.tsx` | `FieldTripAttendanceProps { cohortId, students }` | Field trip creation and attendance tracking. |

### Learning Styles

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `LearningPlanBanner` | `components/LearningPlanBanner.tsx` | `{ studentId: string }` | Banner prompting students to complete their learning plan. |
| `LearningStyleBadge` | `components/LearningStyleBadge.tsx` | `LearningStyleBadgeProps { style, size? }` | Badge displaying a student's learning style. Also exports `getLearningStyleConfig`. |
| `LearningStyleDistribution` | `components/LearningStyleDistribution.tsx` | `LearningStyleDistributionProps { data, cohortId? }` | Chart/visualization of learning style distribution across a cohort. |

### Scenarios

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ScenarioDifficultyRecommendation` | `components/ScenarioDifficultyRecommendation.tsx` | `{ scenarioId, currentDifficulty?, onAccept? }` | AI-based difficulty recommendation for scenarios using historical data. |
| `ScenarioVersionHistory` | `components/ScenarioVersionHistory.tsx` | `{ scenarioId, currentVersion? }` | Version history panel with diff view for scenario changes. |

### Modals & Overlays

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `WelcomeModal` | `components/WelcomeModal.tsx` | `WelcomeModalProps { userName, role, onStartTour, onSkip }` | Welcome modal shown to first-time users with option to start onboarding tour. |
| `WhatsNewModal` | `components/WhatsNewModal.tsx` | `WhatsNewModalProps { forceShow?, onClose }` | Changelog modal showing recent feature updates. |
| `WhatsNewWrapper` | `components/WhatsNewWrapper.tsx` | _(none)_ | Wrapper that auto-shows `WhatsNewModal` when new updates are available. |
| `TemplateDiffModal` | `components/TemplateDiffModal.tsx` | `TemplateDiffModalProps { isOpen, onClose, oldTemplate, newTemplate }` | Modal showing side-by-side differences between template versions. |
| `BulkPhotoUpload` | `components/BulkPhotoUpload.tsx` | `BulkPhotoUploadProps { students, onComplete, onClose }` | Drag-and-drop bulk photo upload with automatic filename-to-student matching. |

### Error Handling

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | `ErrorBoundaryProps { children, fallback?, onError?, featureName? }` | React class-component error boundary with retry and error reporting. |
| `ErrorBoundary` (UI) | `components/ui/ErrorBoundary.tsx` | `ErrorBoundaryProps { children, fallback?, featureName? }` | Lightweight error boundary. Also exports `ErrorFallback` and `PageErrorFallback`. |

### Notifications & Feedback

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `NotificationBell` | `components/NotificationBell.tsx` | _(none)_ | Notification bell icon with unread count badge and dropdown list. |
| `Toast` / `ToastProvider` | `components/Toast.tsx` | _(provider: `{ children }`)_ | Toast notification system. Exports `useToast` hook and `ToastProvider` context provider. |
| `FeedbackButton` | `components/FeedbackButton.tsx` | _(none)_ | Floating feedback button with modal form for bugs, feature requests, and general feedback. |

### Onboarding

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `OnboardingTour` | `components/OnboardingTour.tsx` | `OnboardingTourProps { steps, onComplete, onSkip }` | Step-by-step guided tour overlay with spotlight highlighting. |
| `OnboardingTourWrapper` | `components/OnboardingTourWrapper.tsx` | _(none)_ | Wrapper that conditionally renders `OnboardingTour` based on user state. |

### Offline & PWA

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `OfflineBanner` | `components/OfflineBanner.tsx` | _(none)_ | Banner displayed when the app detects the user is offline. |
| `OfflineProvider` | `components/OfflineProvider.tsx` | `OfflineProviderProps { children }` | Context provider for offline detection state. Also exports `useOffline` hook. |
| `ServiceWorkerRegistration` | `components/ServiceWorkerRegistration.tsx` | _(none)_ | Registers the service worker for PWA functionality. |

### Role Preview

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `RolePreviewProvider` | `components/RolePreviewProvider.tsx` | `{ children }` | Context provider for role preview mode. Exports `useRolePreview` hook. |
| `RolePreviewBanner` | `components/RolePreviewBanner.tsx` | _(none)_ | Warning banner shown when the user is in role preview mode. |
| `RolePreviewSelector` | `components/RolePreviewSelector.tsx` | _(none)_ | Role dropdown selector for entering/exiting role preview. |

### Security

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `TwoFactorPanel` | `components/TwoFactorPanel.tsx` | _(none)_ | Two-factor authentication setup and management panel (TOTP-based). |

### Miscellaneous

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ActivityTracker` | `components/ActivityTracker.tsx` | _(none)_ | Invisible component that tracks user page navigation activity via API. |
| `AppBanner` | `components/AppBanner.tsx` | _(none)_ | Mobile-only banner prompting users to use the native app. |
| `BLSPlatinumChecklist` | `components/BLSPlatinumChecklist.tsx` | `BLSPlatinumChecklistProps { labDayId, currentStationId?, selectedSkillIds, onToggleSkill?, readOnly? }` | BLS/Platinum skills checklist for lab station skill tracking. |
| `CapacityWarning` | `components/CapacityWarning.tsx` | `CapacityWarningProps { siteId, source?, date?, studentCount?, userRole?, onOverride?, className? }` | Clinical site capacity check with admin override option. |
| `KeyboardShortcutsHelp` | `components/KeyboardShortcutsHelp.tsx` | `KeyboardShortcutsHelpProps { shortcuts, isOpen, onClose }` | Modal displaying registered keyboard shortcuts. |
| `SiteVisitAlerts` | `components/SiteVisitAlerts.tsx` | `SiteVisitAlertsProps { userId?, role? }` | Clinical site visit alert notification panel. |
| `SkillSheetPanel` | `components/SkillSheetPanel.tsx` | `SkillSheetPanelProps { sheetId, studentId?, readOnly? }` | Skill sheet viewer and management panel. |
| `StudentCommunications` | `components/StudentCommunications.tsx` | `StudentCommunicationsProps { studentId, studentName }` | Communication log and message composer for students. |
| `SwapInterestPanel` | `components/SwapInterestPanel.tsx` | `SwapInterestPanelProps { shiftId, currentUserId }` | Shift swap interest management panel. |
| `TaskKanban` | `components/TaskKanban.tsx` | `TaskKanbanProps { tasks, onStatusChange, onEdit }` | Kanban board for task management with drag-and-drop columns. |
| `TemplateGuideSection` | `components/TemplateGuideSection.tsx` | `TemplateGuideSectionProps { metadata: StationMetadata }` | Template guide/instructions display section. Also exports `StationMetadata` type. |
| `ThemeToggle` | `components/ThemeToggle.tsx` | _(none)_ | Dark/light mode toggle button using next-themes. |
| `QueryProvider` | `components/QueryProvider.tsx` | `{ children }` | React Query `QueryClientProvider` wrapper. |
| `ButtonLoading` | `components/ButtonLoading.tsx` | _(re-export)_ | Re-exports `ButtonLoading` from `components/ui/ButtonLoading`. |

### UI Primitives (`components/ui/`)

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ButtonLoading` | `components/ui/ButtonLoading.tsx` | `ButtonLoadingProps extends ButtonHTMLAttributes { loading?, loadingText?, variant?, size? }` | Button with built-in loading spinner and disabled state. |
| `ButtonSpinner` | `components/ui/ButtonSpinner.tsx` | `ButtonSpinnerProps { className? }` | Inline spinner for use inside buttons. |
| `ContentLoader` | `components/ui/ContentLoader.tsx` | `ContentLoaderProps { lines?, className? }` | Animated content skeleton loader. Also exports `SkeletonCard`, `SkeletonTableRow`, `SkeletonTable`, `SkeletonForm`, `SkeletonText`, `SkeletonStats`. |
| `ErrorBoundary` | `components/ui/ErrorBoundary.tsx` | `ErrorBoundaryProps { children, fallback?, featureName? }` | Class-component error boundary. Also exports `ErrorFallback`, `PageErrorFallback`. |
| `LoadingSpinner` | `components/ui/LoadingSpinner.tsx` | `LoadingSpinnerProps { size?, className?, label? }` | Configurable spinning loader with optional label. |
| `PageLoader` | `components/ui/PageLoader.tsx` | `PageLoaderProps { message?, fullScreen? }` | Full-page loading indicator with optional message. |

**Barrel export** at `components/ui/index.ts` re-exports all UI primitives.

---

## Custom Hooks

| Hook | File | Signature | Description |
|------|------|-----------|-------------|
| `useAutoSave` | `hooks/useAutoSave.ts` | `useAutoSave<T>({ key, data, debounceMs?, enabled? }): UseAutoSaveReturn` | Auto-saves form data to localStorage with debouncing. Returns `saveStatus`, `showRestorePrompt`, `draftTimestamp`, `onRestore`, `onDiscard`, `onDismiss`. |
| `useCalendarAvailability` | `hooks/useCalendarAvailability.ts` | `useCalendarAvailability(date: string, emails: string[])` | Fetches Google Calendar free/busy status for given date and instructor emails. Returns availability map. |
| `useCohorts` | `hooks/useCohorts.ts` | `useCohorts(options?: UseCohortOptions): { cohorts, loading, error }` | Fetches cohorts from API with optional `programId` filter. |
| `useCurrentUser` | `hooks/useCurrentUser.ts` | `useCurrentUser(options?: { enabled? }): { user, loading, error }` | Fetches the current user's profile from `/api/me`. |
| `useEffectiveRole` | `hooks/useEffectiveRole.ts` | `useEffectiveRole(realRole: Role \| string \| null): Role \| string \| null` | Returns effective role considering role preview mode from `useRolePreview`. |
| `useKeyboardShortcuts` | `hooks/useKeyboardShortcuts.ts` | `useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled?: boolean): void` | Registers global keyboard shortcuts with key combo matching. |
| `useLabDays` | `hooks/useLabDays.ts` | `useLabDays(options?: UseLabDaysOptions): { labDays, loading, error, refetch }` | Fetches lab days with filtering by cohort, date range, and status. |
| `useLocations` | `hooks/useLocations.ts` | `useLocations(options?: { type?, enabled? }): { locations, loading, error }` | Fetches location data with optional type filter. |
| `useNotifications` | `hooks/useNotifications.ts` | `useNotifications(options?: { enabled? }): { notifications, unreadCount, markRead, markAllRead, loading }` | Fetches and manages user notifications with mark-read actions. |
| `usePrograms` | `hooks/usePrograms.ts` | `usePrograms(options?: { enabled? }): { programs, loading, error }` | Fetches academic programs list. |
| `useScenarios` | `hooks/useScenarios.ts` | `useScenarios(options?: UseScenariosOptions): { scenarios, loading, error, refetch }` | Fetches scenarios with optional filters (program, difficulty, search). |
| `useSkillSheets` | `hooks/useSkillSheets.ts` | `useSkillSheets(options?: UseSkillSheetsOptions): { skillSheets, loading, error }` | Fetches skill sheets with program counts and optional filtering. |
| `useStudents` | `hooks/useStudents.ts` | `useStudents(options?: UseStudentsOptions): { students, loading, error, refetch }` | Fetches students with cohort and search filters. |
| `useTimerAudio` | `hooks/useTimerAudio.ts` | `useTimerAudio(settings?: Partial<TimerAudioSettings>): { play, stop, isPlaying }` | Timer audio playback management. Also exports `loadTimerAudioSettings`, `saveTimerAudioSettings`, `TimerAudioSettings`, `DEFAULT_TIMER_AUDIO_SETTINGS`. |
| `useVisibilityPolling` | `hooks/useVisibilityPolling.ts` | `useVisibilityPolling(callback: () => void, intervalMs: number, enabled?: boolean): void` | Polls a callback at a set interval, pausing when the browser tab is hidden. |

---

## Shared Utilities (`lib/`)

### Authentication & Authorization

| File | Exports | Description |
|------|---------|-------------|
| `lib/auth.ts` | `authOptions` | NextAuth.js configuration with Google OAuth provider restricted to @pmi.edu. |
| `lib/auth-helpers.ts` | `LabUser`, `findOrCreateLabUser`, `getUserRole`, `isAdmin`, `isInstructor`, `isApproved` | Server-side helpers for user lookup, creation, and role checks. |
| `lib/api-auth.ts` | `AuthUser`, `AuthResult`, `requireAuth` | Server-side API route authentication middleware. |
| `lib/permissions.ts` | `Role`, `ROLE_LEVELS`, `ROLE_LABELS`, `ROLE_COLORS`, `hasMinRole`, `canAccessAdmin`, `canManageUsers`, `canAssignRole`, `canModifyUser`, `canDeleteUsers`, `canDeleteScenarios`, `canCreateScenarios`, `canCreateLabDays`, `canManageCohorts`, `canManageStudentRoster`, `canViewAllCertifications`, `canManageGuestAccess`, `canManageContent`, `canAccessSystemSettings`, `canAccessClinical`, `canEditClinical`, `canViewPreceptors`, `isSuperadmin`, `isProtectedSuperadmin`, `getAssignableRoles`, `isStudent`, `canAccessStudentPortal`, `isPendingRole`, `canAccessApp`, `canAccessScheduling`, `canViewLabSchedule`, `canModifyLabSchedule`, `canAccessAffiliations`, `canEditAffiliations`, `getRoleBadgeClasses`, `getRoleLabel`, `sanitizeStudentForRole`, `sanitizeStudentsForRole`, `DataPermissionType`, `canAccessData` | Comprehensive role-based permission system with role hierarchy, data sanitization, and endorsement support. |
| `lib/totp.ts` | `generateTOTPSecret`, `verifyTOTP`, `getCurrentTOTPCode`, `generateBackupCodes`, `verifyAndConsumeBackupCode`, `buildOTPAuthURI` | TOTP-based two-factor authentication utilities. |
| `lib/rate-limit.ts` | `rateLimit` | In-memory rate limiter for API routes. |

### Data Fetching & API

| File | Exports | Description |
|------|---------|-------------|
| `lib/api-client.ts` | `ApiFetchOptions`, `ApiError`, `apiFetch` | Client-side API fetch wrapper with error handling and type safety. |
| `lib/fetch-utils.ts` | `ApiError`, `apiFetch`, `isHttpError`, `isAuthError` | Fetch utilities with HTTP error classification. |
| `lib/supabase.ts` | `getSupabase`, `getSupabaseAdmin`, `supabase` | Supabase client initialization (browser, server, and admin clients). |

### Notifications & Email

| File | Exports | Description |
|------|---------|-------------|
| `lib/notifications.ts` | `NotificationType`, `NotificationCategory`, `createNotification`, `createBulkNotifications`, `notifyInstructorAssigned`, `notifyAdminsNewFeedback`, `notifyFeedbackResolved`, `notifyLabReminder`, `notifyTaskAssigned`, `notifyTaskCompleted`, `notifyTaskComment`, `notifyRoleApproved`, `notifyAdminsNewPendingUser`, `getEligibleShiftRecipients`, `insertDefaultNotificationPreferences`, `updatePreferencesForRoleChange` | In-app notification creation and routing system with category mapping. |
| `lib/email.ts` | `EmailTemplate`, `sendEmail`, `sendTaskAssignedEmail`, `sendTaskCompletedEmail`, `sendShiftAvailableEmail`, `sendShiftConfirmedEmail`, `sendLabAssignedEmail`, `sendLabReminderEmail` | Email sending via Resend API with pre-built transactional templates. |
| `lib/email-templates.ts` | `EMAIL_COLORS`, `emailButton`, `emailContentBox`, `emailHeading`, `emailParagraph`, `emailDetail`, `wrapInEmailTemplate`, `notificationEmailTemplate`, `taskTemplates`, `schedulingTemplates`, `labTemplates`, `clinicalTemplates` | HTML email template builder functions organized by feature domain. |
| `lib/webhooks.ts` | `WEBHOOK_EVENTS`, `WebhookEvent`, `WEBHOOK_EVENT_GROUPS`, `WebhookRecord`, `generateSignature`, `sendWebhookRequest`, `triggerWebhook`, `SAMPLE_PAYLOADS` | Outbound webhook system with HMAC signing and event categorization. |

### Calendar & Scheduling

| File | Exports | Description |
|------|---------|-------------|
| `lib/google-calendar.ts` | `getAccessTokenForUser`, `shouldSyncForUser`, `createGoogleEvent`, `updateGoogleEvent`, `deleteGoogleEvent`, `storeEventMapping`, `getEventMapping`, `deleteEventMapping`, `syncLabStationAssignment`, `removeLabStationAssignment`, `syncLabDayRole`, `removeLabDayRole`, `updateLabDayEvents`, `deleteLabDayEvents`, `syncShiftSignup`, `removeShiftSignup`, `cancelShiftEvents`, `updateCoverageTag`, `syncSiteVisit`, `updateSiteVisit`, `removeSiteVisit` | Full two-way Google Calendar sync for lab assignments, shifts, and site visits. |
| `lib/calendar-availability.ts` | `refreshAccessToken`, `checkInstructorAvailability` | Google Calendar free/busy API integration for instructor availability checks. |
| `lib/ics-export.ts` | `CalendarEvent`, `generateICS`, `downloadICS`, `parseLocalDate` | ICS file generation and download for calendar export. |

### Audit & Tracking

| File | Exports | Description |
|------|---------|-------------|
| `lib/audit.ts` | `AuditAction`, `AuditResourceType`, `AuditUser`, `AuditLogEntry`, `logAuditEvent`, `logStudentAccess`, `logStudentListAccess`, `logAssessmentAccess`, `logStudentCreate`, `logStudentUpdate`, `logStudentDelete`, `logDataExport`, `logAccessDenied`, `logUserLogin`, `logGuestAccess`, `getAuditLogs` | Comprehensive audit logging for FERPA compliance with specialized student data access logging. |
| `lib/session-tracker.ts` | `SessionRecord`, `parseUserAgent`, `getDeviceIcon`, `trackSession` | User session tracking with device/browser detection. |

### Case Studies

| File | Exports | Description |
|------|---------|-------------|
| `lib/achievements.ts` | `AchievementDefinition`, `ACHIEVEMENTS`, `getAchievementDefinition`, `checkAchievements` | Achievement/badge definitions and unlock logic for the case study gamification system. |
| `lib/case-generation.ts` | `CaseBrief`, `GenerationResult`, `fetchPromptTemplate`, `generateSingleCase` | AI-powered case study generation using prompt templates. |
| `lib/case-session-realtime.ts` | `broadcastSessionUpdate` | Real-time session update broadcasting for collaborative case sessions. |
| `lib/case-validation.ts` | `ValidationError`, `validateCaseJson` | JSON schema validation for case study data structures. |

### Export & Print

| File | Exports | Description |
|------|---------|-------------|
| `lib/export-utils.ts` | `ExportColumn`, `ExportConfig`, `exportToExcel`, `exportToPDF`, `printRoster` | Excel (XLSX) and PDF export generators plus print-formatted roster output. |
| `lib/print-utils.ts` | `openPrintWindow`, `formatPrintDate`, `printHeader`, `printFooter`, `escapeHtml` | Print window helpers with header/footer templates and HTML escaping. |

### Endorsements & Certifications

| File | Exports | Description |
|------|---------|-------------|
| `lib/endorsements.ts` | `EndorsementType`, `Endorsement`, `ENDORSEMENT_LABELS`, `ENDORSEMENT_BADGES`, `getEndorsementAbbrev`, `hasEndorsement`, `isDirector`, `getUserEndorsements`, `getUserEndorsementsByEmail`, `canDirectorSignOff`, `grantEndorsement`, `revokeEndorsement` | Instructor endorsement management (ACLS, PALS, NRP, etc.) with grant/revoke operations. |

### Configuration & Constants

| File | Exports | Description |
|------|---------|-------------|
| `lib/config.ts` | `SystemConfigRow`, `getConfig`, `getConfigsByCategory`, `isFeatureEnabled`, `getAllConfigs`, `setConfig` | System configuration management backed by the `system_config` database table. |
| `lib/constants.ts` | `SKIN_OPTIONS` | Shared application constants. |
| `lib/version.ts` | `APP_VERSION`, `VERSION_DATE`, `VersionEntry`, `WHATS_NEW_ITEMS` | Application version tracking and changelog entries for the What's New modal. |

### Validation & Utilities

| File | Exports | Description |
|------|---------|-------------|
| `lib/validation.ts` | `validateEmail`, `validatePhone`, `validateRequired`, `validateDateRange`, `validateMinLength`, `validateMaxLength`, `validators`, `validateForm`, `isFormValid` | Form validation utilities with composable validator functions. |
| `lib/utils.ts` | `cn`, `formatDate`, `formatShortDate`, `capitalize`, `truncate`, `sleep`, `generateId`, `parseDateSafe`, `toDateStr`, `addWeeksToDate`, `formatDateSafe`, `formatTime`, `formatTimeAgo` | General-purpose utility functions including `cn` (clsx + tailwind-merge), date formatting, and ID generation. |

---

## Key Patterns

- **Client components with `useEffect` data fetching**: Pages are `'use client'` components that fetch data on mount via custom hooks or direct `fetch` calls.
- **Supabase direct queries**: No ORM; all database access uses the Supabase JS client with `.select()`, `.insert()`, `.update()`, `.delete()`.
- **PostgREST FK hints**: When tables have multiple foreign key paths, queries use explicit FK constraint names (e.g., `cohort:cohorts!students_cohort_id_fkey(...)`) to avoid PGRST201 ambiguity errors.
- **Role-based access**: Permission checks use `lib/permissions.ts` with a role hierarchy (`superadmin > admin > lead_instructor > instructor > volunteer_instructor > program_director > student > guest > pending`).
- **Barrel exports**: Subdirectories use `index.ts` files for clean imports (e.g., `components/ui/index.ts`, `components/dashboard/widgets/index.ts`).
- **Shared type files**: Feature-specific types are colocated in `types.ts` files within component subdirectories (e.g., `components/grading/types.ts`, `components/lab-day/types.ts`).
- **Dark mode**: All components support dark mode via Tailwind `dark:` variants, toggled by `next-themes`.
