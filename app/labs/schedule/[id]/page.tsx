'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCohortNumber } from '@/lib/format-cohort';
import {
  ChevronLeft,
  Calendar,
  Plus,
  ClipboardCheck,
  AlertOctagon,
  AlertTriangle,
  Sparkles,
  Users,
  Check,
  AlertCircle,
  Loader2,
  Layers,
  RefreshCw,
  GitCompare,
  GraduationCap,
  Flag,
  Mail,
} from 'lucide-react';
import { priorityBadgeClasses, type PriorityFlag } from '@/components/lab-day/types';
import LabTimer from '@/components/LabTimer';
import AttendanceSection from '@/components/AttendanceSection';
import LearningStyleDistribution from '@/components/LearningStyleDistribution';
import { useToast } from '@/components/Toast';
import { hasMinRole, canAccessAdmin } from '@/lib/permissions';
import TemplateDiffModal from '@/components/TemplateDiffModal';
import RequestCoverageModal from '@/components/scheduling/RequestCoverageModal';
import GenerateLabShiftsModal from '@/components/scheduling/GenerateLabShiftsModal';
import { useCalendarAvailability } from '@/hooks/useCalendarAvailability';

import type {
  LabDay,
  Station,
  SkillDocument,
  Skill,
  Instructor,
  LabDayRole,
  Student,
  ScenarioParticipation,
} from '@/components/lab-day/types';
import {
  formatDate,
  formatTime,
  getStationTitle,
  handleExportCalendar,
  handlePrint,
  handlePrintRoster,
  handleDownloadPDF,
  handleCSVExport,
} from '@/components/lab-day/labDayExport';
import ChecklistSection from '@/components/lab-day/ChecklistSection';
import EquipmentSection from '@/components/lab-day/EquipmentSection';
import CostsSection from '@/components/lab-day/CostsSection';
import DebriefSection from '@/components/lab-day/DebriefSection';
import DebriefNotesSection from '@/components/lab-day/DebriefNotesSection';
import StationCards from '@/components/lab-day/StationCards';
import StudentRatingsSection from '@/components/lab-day/StudentRatingsSection';
import IndividualTestingGrid from '@/components/lab-day/IndividualTestingGrid';
import LabDayHeader from '@/components/lab-day/LabDayHeader';
import LabDayRolesSection from '@/components/lab-day/LabDayRolesSection';
import LabDayCoverageSection from '@/components/lab-day/LabDayCoverageSection';
import LabDaySkillSignoffs from '@/components/lab-day/LabDaySkillSignoffs';
import LabDayCheckInSection from '@/components/lab-day/LabDayCheckInSection';
import EditStationModal from '@/components/lab-day/EditStationModal';
import ScenarioRoleModal from '@/components/lab-day/ScenarioRoleModal';
import ScenarioPickerModal from '@/components/lab-day/ScenarioPickerModal';
import DuplicateModals from '@/components/lab-day/DuplicateModals';
import LabDayPrintView from '@/components/lab-day/LabDayPrintView';
import LabDayVolunteers from '@/components/lab-day/LabDayVolunteers';
import LabDayChat from '@/components/lab-day/LabDayChat';

export default function LabDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const labDayId = params.id as string;
  const justGraded = searchParams.get('graded');
  const openTimerParam = searchParams.get('timer') === 'open';
  const toast = useToast();

  // Resend Results Emails state. Tracks the in-flight POST to
  // /api/lab-management/lab-days/[id]/skill-results/resend so the
  // button can show a spinner and prevent double-submit. The
  // endpoint is idempotent (skips already-sent rows) but a double
  // click would still fire two RPCs unnecessarily.
  const [resendingResults, setResendingResults] = useState(false);

  // Core state
  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimer, setShowTimer] = useState(openTimerParam);
  const [labDayRoles, setLabDayRoles] = useState<LabDayRole[]>([]);
  const [stationSkillDocs, setStationSkillDocs] = useState<Record<string, SkillDocument[]>>({});
  const [stationSkillSheetIds, setStationSkillSheetIds] = useState<Record<string, string>>({});
  const [stationNremtCodes, setStationNremtCodes] = useState<Record<string, 'E201' | 'E202' | undefined>>({});
  const [nremtScenarioTitles, setNremtScenarioTitles] = useState<Record<string, string>>({});
  const [scenarioPickerState, setScenarioPickerState] = useState<{ station: Station; code: 'E201' | 'E202' } | null>(null);
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [scenarioParticipation, setScenarioParticipation] = useState<ScenarioParticipation[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [allCohorts, setAllCohorts] = useState<{ id: string; cohort_number: number; program: { abbreviation: string } }[]>([]);
  const [cohortChanging, setCohortChanging] = useState(false);

  // UI state
  const [showRosterPrint, setShowRosterPrint] = useState(false);
  const [rosterIncludePhotos, setRosterIncludePhotos] = useState(true);
  const [copySuccessToast, setCopySuccessToast] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  // Per-lab-day "Refresh from template" — pulls template content
  // onto just this row. Distinct from the bulk "Update from Template"
  // on the cohort page: this always overwrites the title for this day
  // since the operator opted in explicitly. Tracked separately from
  // the Compare modal so the spinner doesn't fight with it.
  const [refreshingFromTemplate, setRefreshingFromTemplate] = useState(false);
  const [showRequestCoverage, setShowRequestCoverage] = useState(false);
  // Shortcut: bulk-shift generator scoped to this single lab day's
  // date + cohort. Same modal as /scheduling but pre-locked so the
  // coordinator can't accidentally fan it across other cohorts.
  const [showGenerateLabShifts, setShowGenerateLabShifts] = useState(false);

  // Checkoff-day auto-detection. Matches the server heuristic: the
  // skill_sheet_id that shows up on 2+ stations wins. Used for the
  // banner + to collapse the Individual Testing tracker by default on
  // these days (the live station grid is the primary UI; the tracker
  // panel just makes the page longer).
  const checkoffDetection = (() => {
    const counts = new Map<string, number>();
    for (const sid of Object.values(stationSkillSheetIds)) {
      if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
    let best: { id: string; n: number } | null = null;
    for (const [id, n] of counts) {
      if (n < 2) continue;
      if (!best || n > best.n) best = { id, n };
    }
    return best;
  })();
  const isCheckoffDay = !!checkoffDetection;
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showNextWeekConfirm, setShowNextWeekConfirm] = useState(false);
  const [showBulkDuplicateModal, setShowBulkDuplicateModal] = useState(false);
  const [showDuplicateDropdown, setShowDuplicateDropdown] = useState(false);
  const [showQuickAddStation, setShowQuickAddStation] = useState(false);
  const [quickAddType, setQuickAddType] = useState('scenario');
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [labMode, setLabMode] = useState<'group_rotations' | 'individual_testing'>('group_rotations');
  const [labModeLoading, setLabModeLoading] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [roleModalStation, setRoleModalStation] = useState<Station | null>(null);

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);
  useEffect(() => { if (session && labDayId) { fetchLabDay(); fetchScenarioParticipation(); fetchCurrentUserRole(); fetchSkillsForSignoffs(); fetchAllCohorts(); } }, [session, labDayId]);
  useEffect(() => { if (labDay?.cohort?.id) fetchCohortStudents(); }, [labDay?.cohort?.id]);

  // Calendar availability
  const allInstructorEmails = (() => {
    const emails = new Set<string>();
    labDay?.stations?.forEach(s => { if (s.instructor_email) emails.add(s.instructor_email.toLowerCase()); });
    labDayRoles.forEach(r => { if (r.instructor?.email) emails.add(r.instructor.email.toLowerCase()); });
    instructors.forEach(i => { if (i.email) emails.add(i.email.toLowerCase()); });
    return Array.from(emails);
  })();
  const { availability: calendarAvailability, loading: calendarLoading, summary: calendarSummary } = useCalendarAvailability(
    labDay?.date || null, allInstructorEmails,
    labDay?.start_time?.substring(0, 5) || '08:00', labDay?.end_time?.substring(0, 5) || '17:00'
  );

  // ---- Fetch functions ----
  // `silent: true` skips the loading-spinner flash. Use it for post-
  // mutation refreshes (cohort change, station add/edit, scenario
  // picker, template diff) so the page doesn't unmount into a full-
  // screen spinner that resets scroll position and any open modals.
  // The initial load (from the bootstrapping useEffect) leaves it off
  // so the first paint shows the spinner instead of an empty page.
  const fetchLabDay = async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const [labDayRes, instructorsRes, locationsRes, rolesRes] = await Promise.all([
        fetch(`/api/lab-management/lab-days/${labDayId}`),
        fetch('/api/lab-management/instructors'),
        fetch('/api/lab-management/locations?type=room'),
        fetch(`/api/lab-management/lab-day-roles?lab_day_id=${labDayId}`)
      ]);
      const labDayData = await labDayRes.json();
      const instructorsData = await instructorsRes.json();
      const locationsData = await locationsRes.json();
      const rolesData = await rolesRes.json();
      if (labDayData.success) { setLabDay(labDayData.labDay); if (labDayData.labDay?.lab_mode) setLabMode(labDayData.labDay.lab_mode); }
      if (instructorsData.success) setInstructors(instructorsData.instructors || []);
      if (locationsData.success) setLocations(locationsData.locations || []);
      if (rolesData.success) setLabDayRoles(rolesData.roles || []);
      if (labDayData.success && labDayData.labDay?.stations) {
        const allSkillsRes = await fetch('/api/lab-management/skills?includeDocuments=true');
        const allSkillsData = await allSkillsRes.json();
        if (allSkillsData.success && allSkillsData.skills) {
          const skillsMap = new Map<string, Skill>();
          allSkillsData.skills.forEach((skill: Skill) => skillsMap.set(skill.id, skill));
          const skillDocsMap: Record<string, SkillDocument[]> = {};
          for (const station of labDayData.labDay.stations) {
            if (station.station_type === 'skills' || station.station_type === 'skill_drill') {
              try {
                const stationSkillsRes = await fetch(`/api/lab-management/station-skills?stationId=${station.id}`);
                const stationSkillsData = await stationSkillsRes.json();
                if (stationSkillsData.success && stationSkillsData.stationSkills) {
                  const docs: SkillDocument[] = [];
                  for (const ss of stationSkillsData.stationSkills) { if (ss.skill?.id) { const skill = skillsMap.get(ss.skill.id); if (skill?.documents) docs.push(...skill.documents); } }
                  skillDocsMap[station.id] = docs;
                }
              } catch (error) { console.error(`Error fetching skill documents for station ${station.id}:`, error); }
            }
          }
          setStationSkillDocs(skillDocsMap);
        }
        if (labDayData.labDay.cohort?.program?.abbreviation) lookupSkillSheets(labDayData.labDay.stations, labDayData.labDay.cohort.program.abbreviation);
      }
    } catch (error) { console.error('Error fetching lab day:', error); }
    if (!opts.silent) setLoading(false);
  };

  const lookupSkillSheets = async (stations: any[], program: string) => {
    const results: Record<string, string> = {};
    const nremtCodes: Record<string, 'E201' | 'E202' | undefined> = {};
    let anyNremt = false;
    for (const station of stations) {
      const skillName = station.skill_name || station.scenario?.title || station.custom_title;
      if (!skillName) continue;
      try {
        const res = await fetch(`/api/skill-sheets/by-skill-name?name=${encodeURIComponent(skillName)}&program=${encodeURIComponent(program.toLowerCase())}`);
        const data = await res.json();
        if (data.success && data.sheets?.length > 0) {
          const sheet = data.sheets[0];
          results[station.id] = sheet.id;
          const code = sheet.nremt_code as string | null | undefined;
          if (code === 'E201' || code === 'E202') {
            nremtCodes[station.id] = code;
            anyNremt = true;
          }
        }
      } catch { /* ignore */ }
    }
    setStationSkillSheetIds(results);
    setStationNremtCodes(nremtCodes);
    if (anyNremt) {
      // Fetch all active NREMT scenarios once so we can label assigned ones on the cards
      try {
        const res = await fetch('/api/nremt-scenarios');
        const data = await res.json();
        if (data.success && Array.isArray(data.scenarios)) {
          const titles: Record<string, string> = {};
          for (const sc of data.scenarios) titles[sc.id] = sc.title;
          setNremtScenarioTitles(titles);
        }
      } catch { /* ignore */ }
    }
  };

  const fetchCohortStudents = async () => {
    if (!labDay?.cohort?.id) return;
    try { const res = await fetch(`/api/lab-management/students?cohortId=${labDay.cohort.id}&status=active`); const data = await res.json(); if (data.success) setCohortStudents(data.students || []); }
    catch (error) { console.error('Error fetching students:', error); }
  };

  const fetchScenarioParticipation = async () => {
    try { const res = await fetch(`/api/tracking/scenarios?labDayId=${labDayId}`); const data = await res.json(); if (data.success) setScenarioParticipation(data.participation || []); }
    catch (error) { console.error('Error fetching scenario participation:', error); }
  };

  const fetchCurrentUserRole = async () => {
    try { const res = await fetch('/api/instructor/me'); const data = await res.json(); if (data.success && data.user) setUserRole(data.user.role); }
    catch (error) { console.error('Error fetching user role:', error); }
  };

  const fetchSkillsForSignoffs = async () => {
    if (skills.length > 0) return;
    try { const res = await fetch('/api/lab-management/skills'); const data = await res.json(); if (data.success) setSkills(data.skills || []); }
    catch (error) { console.error('Error fetching skills for signoffs:', error); }
  };

  const fetchAllCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) setAllCohorts(data.cohorts || []);
    } catch (error) { console.error('Error fetching cohorts:', error); }
  };

  const handleCohortChange = async (newCohortId: string) => {
    if (!newCohortId || newCohortId === labDay?.cohort?.id) return;
    setCohortChanging(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: newCohortId }),
      });
      const data = await res.json();
      if (!data.error) {
        toast?.addToast('success', 'Cohort updated');
        fetchLabDay({ silent: true });
      } else {
        toast?.addToast('error', data.error || 'Failed to update cohort');
      }
    } catch (err) {
      console.error('Error changing cohort:', err);
      toast?.addToast('error', 'Failed to update cohort');
    } finally {
      setCohortChanging(false);
    }
  };

  // ---- Quick add & lab mode ----
  const handleQuickAddStation = async () => {
    if (!quickAddTitle.trim()) return; setQuickAddSaving(true);
    try { const nextNumber = labDay ? Math.max(...labDay.stations.map((s: Station) => s.station_number), 0) + 1 : 1; const res = await fetch('/api/lab-management/stations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lab_day_id: labDayId, station_number: nextNumber, station_type: quickAddType, custom_title: quickAddTitle.trim() }) }); const data = await res.json(); if (data.success) { toast?.addToast('success', 'Station added'); setShowQuickAddStation(false); setQuickAddTitle(''); setQuickAddType('scenario'); fetchLabDay({ silent: true }); } else toast?.addToast('error', data.error || 'Failed'); }
    catch (error) { console.error('Error:', error); toast?.addToast('error', 'Failed to add station'); }
    setQuickAddSaving(false);
  };

  // Per-lab-day "Refresh from template". Posts to the dedicated
  // refresh endpoint, which always overwrites the title from the
  // template, inserts any missing stations, and never touches
  // instructor notes / results / sign-offs / competency. Used to
  // unstick lab_days whose generic "Lab Day - Week N" title isn't
  // matched by the bulk Update-from-Template predicate.
  const handleRefreshFromTemplate = async () => {
    if (refreshingFromTemplate) return;
    const ok = window.confirm(
      'Refresh this lab day from the matching template?\n\n' +
        '• Title will be overwritten\n' +
        '• Missing stations will be added\n' +
        '• Instructor notes, results, sign-offs are preserved\n' +
        '• Other lab days in the cohort are not affected',
    );
    if (!ok) return;
    setRefreshingFromTemplate(true);
    try {
      const res = await fetch('/api/admin/lab-templates/refresh-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: labDayId }),
      });
      const data = await res.json();
      if (data.success) {
        const parts: string[] = [];
        if (data.title_changed) parts.push('title updated');
        if (data.stations_added > 0)
          parts.push(`${data.stations_added} station${data.stations_added === 1 ? '' : 's'} added`);
        const msg = parts.length > 0
          ? `Refreshed: ${parts.join(', ')}`
          : 'Already matches template — nothing to update';
        toast?.addToast('success', msg);
        fetchLabDay({ silent: true });
      } else {
        toast?.addToast('error', data.error || 'Refresh failed');
      }
    } catch (err) {
      console.error('Refresh from template error:', err);
      toast?.addToast('error', 'Refresh request failed');
    } finally {
      setRefreshingFromTemplate(false);
    }
  };

  const handleToggleLabMode = async (newMode: 'group_rotations' | 'individual_testing') => {
    if (newMode === labMode || labModeLoading) return; setLabModeLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lab_mode: newMode }) }); const data = await res.json(); if (!data.error) setLabMode(newMode); }
    catch (err) { console.error('Error:', err); }
    finally { setLabModeLoading(false); }
  };

  const handleToggleNremt = async () => {
    const newValue = !labDay?.is_nremt_testing;
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_nremt_testing: newValue }) });
      const data = await res.json();
      if (!data.error && labDay) { setLabDay({ ...labDay, is_nremt_testing: newValue }); if (newValue) handleToggleLabMode('individual_testing'); }
    } catch (err) { console.error('Error:', err); }
  };

  // Scheduling Overhaul Phase 1.1 — set the lab day's priority flag.
  // The reason prompt only fires for high/critical; clearing back to
  // normal wipes the existing reason so it doesn't linger on a now-
  // unflagged day. Optimistic local update — no full refetch (keeps
  // station collapse / scroll intact).
  const [priorityLoading, setPriorityLoading] = useState(false);
  const handleSetPriority = async (newFlag: PriorityFlag) => {
    if (!labDay || newFlag === (labDay.priority_flag ?? 'normal')) return;
    let reason: string | null = labDay.priority_reason ?? null;
    if (newFlag === 'normal') {
      reason = null;
    } else {
      const promptLabel = newFlag === 'critical'
        ? 'Reason for CRITICAL priority (e.g. "ACLS recert", "NREMT psychomotor"):'
        : 'Reason for HIGH priority (e.g. "Guest cardiologist", "Heavy skill day"):';
      const entered = window.prompt(promptLabel, reason || '');
      if (entered === null) return; // user cancelled
      reason = entered.trim() || null;
    }
    setPriorityLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority_flag: newFlag, priority_reason: reason }),
      });
      const data = await res.json();
      if (!data.error) {
        setLabDay({ ...labDay, priority_flag: newFlag, priority_reason: reason });
        toast?.addToast('success', newFlag === 'normal' ? 'Priority cleared' : `Priority set to ${newFlag}`);
      } else {
        toast?.addToast('error', data.error || 'Failed to set priority');
      }
    } catch (err) {
      console.error('Error setting priority:', err);
      toast?.addToast('error', 'Failed to set priority');
    } finally {
      setPriorityLoading(false);
    }
  };

  // Resend skill-evaluation result emails for this lab day. Picks
  // up anything with email_status != 'sent' (queued, do_not_send,
  // null) and tries again. Idempotent — already-sent rows are
  // excluded server-side. Used after Resend was down at lab time
  // or when emails weren't fired before the grading page closed.
  const handleResendResults = async () => {
    if (resendingResults) return;
    const confirmed = window.confirm(
      `Resend grade emails to all students with email addresses on file for this lab day?\n\n` +
      `Already-sent emails will be skipped. Students with no email on file will be listed in the result.`,
    );
    if (!confirmed) return;
    setResendingResults(true);
    try {
      const res = await fetch(
        `/api/lab-management/lab-days/${labDayId}/skill-results/resend`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(`Resend failed: ${data.error || res.statusText}`);
        return;
      }
      const sent = data.sent ?? 0;
      const skipped = data.skipped_no_email ?? 0;
      const errors = data.errors ?? 0;
      const noEmailNames: string[] = data.no_email_names ?? [];
      const summary =
        `Resend complete: sent ${sent}` +
        (skipped > 0 ? `, ${skipped} skipped (no email on file)` : '') +
        (errors > 0 ? `, ${errors} errored` : '');
      if (sent > 0 && skipped === 0 && errors === 0) {
        toast.success(summary);
      } else {
        // Mixed result — use addToast so we can keep the message
        // visible long enough to read the no_email_names list.
        toast.addToast(skipped > 0 || errors > 0 ? 'warning' : 'info', summary, 9000);
      }
      if (noEmailNames.length > 0) {
        const list = noEmailNames.length <= 5
          ? noEmailNames.join(', ')
          : `${noEmailNames.slice(0, 5).join(', ')} +${noEmailNames.length - 5} more`;
        toast.addToast(
          'warning',
          `No email on file: ${list}. Add their address in the cohort roster to enable sends.`,
          9000,
        );
      }
    } catch (err) {
      toast.error(`Resend failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setResendingResults(false);
    }
  };

  // ---- Date helpers ----
  const isLabDayPast = (): boolean => { if (!labDay?.date) return false; const today = new Date(); today.setHours(0, 0, 0, 0); return new Date(labDay.date + 'T00:00:00') < today; };
  const isLabDayPastOrToday = (): boolean => { if (!labDay?.date) return false; const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1); return new Date(labDay.date + 'T00:00:00') < tomorrow; };

  // ---- Loading/Error states ----
  if (status === 'loading' || loading) {
    return (<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4 text-gray-700 dark:text-gray-300">Loading schedule...</p></div></div>);
  }
  if (!session) return null;
  if (!labDay) {
    return (<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center"><div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Lab Day Not Found</h2><p className="text-gray-600 dark:text-gray-400 mb-4">The requested lab day could not be found.</p><Link href="/labs/schedule" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><ChevronLeft className="w-4 h-4" /> Back to Schedule</Link></div></div>);
  }

  return (
    <div id="lab-day-printable" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 print:bg-white">
      <style>{`@media print { @page { margin: 0.5in; size: letter portrait; } nav, aside, header, footer, [data-radix-popper-content-wrapper], [role="dialog"], .toast-container { display: none !important; } html, body { background: white !important; color: black !important; font-size: 10pt !important; } * { box-shadow: none !important; text-shadow: none !important; } a { color: inherit !important; text-decoration: none !important; } }`}</style>

      {justGraded && (<div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden"><Check className="w-5 h-5" /><span>Assessment saved successfully!</span></div>)}
      {copySuccessToast && (<div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden"><Check className="w-5 h-5" /><span>Lab day copied to next week!</span></div>)}

      <LabDayPrintView labDay={labDay} labDayId={labDayId} labDayRoles={labDayRoles} cohortStudents={cohortStudents} showRosterPrint={showRosterPrint} rosterIncludePhotos={rosterIncludePhotos} onSetShowRosterPrint={setShowRosterPrint} onSetRosterIncludePhotos={setRosterIncludePhotos} formatDate={formatDate} formatTime={formatTime} />

      <LabDayHeader labDay={labDay} labDayId={labDayId} showDuplicateDropdown={showDuplicateDropdown} onSetShowDuplicateDropdown={setShowDuplicateDropdown} onOpenTimer={() => setShowTimer(true)} onPrint={() => handlePrint(labDay, labDayRoles, cohortStudents)} onDownloadPDF={() => handleDownloadPDF(labDay)} onExportCalendar={() => handleExportCalendar(labDay, labDayRoles)} onPrintRoster={() => handlePrintRoster(labDay, cohortStudents)} onCSVExport={() => handleCSVExport(labDayId, labDay.date, toast)} onOpenDuplicateModal={() => { setShowDuplicateModal(true); setShowDuplicateDropdown(false); }} onOpenNextWeekConfirm={() => { setShowDuplicateDropdown(false); setShowNextWeekConfirm(true); }} onOpenBulkDuplicateModal={() => { setShowDuplicateDropdown(false); setShowBulkDuplicateModal(true); }} formatDate={formatDate} formatTime={formatTime} />

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6${showRosterPrint ? ' print:hidden' : ''}`}>
        {labDay.is_nremt_testing && (
          <div className="bg-red-600 text-white text-center py-2 font-bold rounded-lg mb-4">
            NREMT Psychomotor Testing Day &mdash; Official Examination
          </div>
        )}

        {/* Priority banner (Scheduling Overhaul Phase 1.1) — high/critical
            days get a prominent strip with the reason text so part-timers
            and instructors who land here see the context immediately,
            without scrolling through to find the badge. Critical = red,
            high = amber. Hidden on print to avoid wasting toner. */}
        {labDay.priority_flag && labDay.priority_flag !== 'normal' && !labDay.is_nremt_testing && (
          <div
            className={`flex items-center gap-2 px-4 py-2 mb-4 rounded-lg font-semibold print:hidden ${
              labDay.priority_flag === 'critical'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
            }`}
          >
            {labDay.priority_flag === 'critical' ? (
              <AlertOctagon className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="uppercase tracking-wide text-xs">
              {labDay.priority_flag === 'critical' ? 'Critical priority' : 'High priority'}
            </span>
            {labDay.priority_reason && (
              <>
                <span className="text-gray-400 dark:text-gray-600">·</span>
                <span className="text-sm font-normal">{labDay.priority_reason}</span>
              </>
            )}
          </div>
        )}

        {/* Checkoff-day banner. Renders when 2+ stations share the same
            skill_sheet_id (the same heuristic the coordinator API uses).
            Links straight to the mobile coordinator view so Ryan can tap
            it from the toolbar without scrolling through every station. */}
        {checkoffDetection && (() => {
          const checkoffStations = labDay.stations.filter(
            (s) => stationSkillSheetIds[s.id] === checkoffDetection.id
          );
          const firstSkillName =
            checkoffStations[0]?.skill_name ||
            checkoffStations[0]?.custom_title ||
            'Checkoff skill';
          return (
            <Link
              href={`/labs/schedule/${labDayId}/checkoff`}
              className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-teal-800 dark:text-teal-200 text-sm">
                    Checkoff day &mdash; {firstSkillName}
                  </div>
                  <div className="text-xs text-teal-700 dark:text-teal-300">
                    Running across {checkoffDetection.n} stations. Tap to open the coordinator view.
                  </div>
                </div>
              </div>
              <span className="text-teal-600 dark:text-teal-400 text-xs font-medium">
                Open &rarr;
              </span>
            </Link>
          );
        })()}

        {/* Cohort selector */}
        {userRole && hasMinRole(userRole, 'instructor') && (
          <div className="flex items-center gap-3 mb-4 print:hidden">
            <GraduationCap className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Cohort:</label>
            <select
              value={labDay.cohort?.id || ''}
              onChange={(e) => handleCohortChange(e.target.value)}
              disabled={cohortChanging}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {allCohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.program?.abbreviation || 'Unknown'} Cohort {formatCohortNumber(c.cohort_number)}
                </option>
              ))}
            </select>
            {cohortChanging && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
        )}

        {labDay.notes && (<div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6"><h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">Notes</h3><p className="text-yellow-700 dark:text-yellow-400 text-sm">{labDay.notes}</p></div>)}

        {labDay.source_template && (
          <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 mb-6 print:hidden">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Source Template: {labDay.source_template.name}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">{labDay.source_template.program?.toUpperCase()} S{labDay.source_template.semester} &bull; Week {labDay.source_template.week_number} Day {labDay.source_template.day_number}</p>
            </div>
            {userRole && canAccessAdmin(userRole) && (
              <>
                <button
                  onClick={handleRefreshFromTemplate}
                  disabled={refreshingFromTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50"
                  title="Pull title + missing stations from this template. Preserves instructor notes, results, sign-offs."
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingFromTemplate ? 'animate-spin' : ''}`} />
                  {refreshingFromTemplate ? 'Refreshing…' : 'Refresh from template'}
                </button>
                <button onClick={() => setShowDiffModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-700/50 transition-colors">
                  <GitCompare className="w-3.5 h-3.5" /> Compare &amp; Update Template
                </button>
              </>
            )}
          </div>
        )}
        {/* No source_template set yet — show an admin-only quick-action
            banner that lets the operator pull content for this single
            day. This is the path the "Content Pending" lab_days hit,
            since they have no source_template_id link from /apply. */}
        {!labDay.source_template && userRole && canAccessAdmin(userRole) && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 mb-6 print:hidden">
            <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">No source template linked</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">Pull content from the matching template by week + day. Preserves notes, results, sign-offs.</p>
            </div>
            <button
              onClick={handleRefreshFromTemplate}
              disabled={refreshingFromTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingFromTemplate ? 'animate-spin' : ''}`} />
              {refreshingFromTemplate ? 'Refreshing…' : 'Refresh from template'}
            </button>
          </div>
        )}

        <LabDayRolesSection labDayId={labDayId} labDayRoles={labDayRoles} instructors={instructors} userRole={userRole} calendarAvailability={calendarAvailability} onRolesChange={setLabDayRoles} />

        {calendarSummary.total > 0 && !calendarLoading && (<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3 print:hidden"><Calendar className="w-4 h-4" /><span>{calendarSummary.free} of {calendarSummary.total} instructor{calendarSummary.total !== 1 ? 's' : ''} {calendarSummary.free === 1 ? 'has a' : 'have'} free calendar{calendarSummary.free !== 1 ? 's' : ''} for this date</span>{calendarSummary.free < calendarSummary.total && <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">({calendarSummary.total - calendarSummary.free} busy or disconnected)</span>}</div>)}
        {calendarLoading && (<div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-3 print:hidden"><Loader2 className="w-4 h-4 animate-spin" /><span>Checking calendar availability...</span></div>)}

        <LabDayCoverageSection labDayId={labDayId} userRole={userRole} />

        <LabDayVolunteers labDayId={labDayId} />

        {showQuickAddStation && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 border-2 border-blue-200 dark:border-blue-800 print:hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Quick Add Station</h3>
              <button onClick={() => setShowQuickAddStation(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ClipboardCheck className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Station Type</label>
                <select value={quickAddType} onChange={(e) => setQuickAddType(e.target.value)} className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"><option value="scenario">Scenario</option><option value="skills">Skills</option><option value="skill_drill">Skill Drill</option><option value="documentation">Documentation</option></select>
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
                <input type="text" value={quickAddTitle} onChange={(e) => setQuickAddTitle(e.target.value)} placeholder="Enter station title..." className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAddStation(); }} />
              </div>
              <button onClick={handleQuickAddStation} disabled={quickAddSaving || !quickAddTitle.trim()} className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">{quickAddSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add</button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 print:hidden">
          {!showQuickAddStation && (<button onClick={() => setShowQuickAddStation(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800"><Plus className="w-4 h-4" /> Quick Add Station</button>)}
        </div>

        <div className="flex items-center gap-2 mb-4 print:hidden">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Mode:</span>
          <button onClick={() => handleToggleLabMode('group_rotations')} disabled={labModeLoading} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${labMode === 'group_rotations' ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750'}`}><Layers className="w-3.5 h-3.5" /> Group Rotations</button>
          <button onClick={() => handleToggleLabMode('individual_testing')} disabled={labModeLoading} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${labMode === 'individual_testing' ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750'}`}><ClipboardCheck className="w-3.5 h-3.5" /> Individual Testing</button>
          {labModeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer" title="Enables Final evaluations only, per-station timers, candidate instructions, and coordinator view">
            <input type="checkbox" checked={!!labDay.is_nremt_testing} onChange={handleToggleNremt} className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <span className={`text-xs font-medium ${labDay.is_nremt_testing ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>NREMT Testing Day</span>
          </label>
          {/* Priority flag selector (Scheduling Overhaul 1.1). Native
              <select> keeps the toolbar compact; setter prompts for a
              reason when promoting to high/critical so the banner has
              context. Color hints which value is currently active. */}
          <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
          <label
            className="inline-flex items-center gap-1.5"
            title="Flag this day so part-timers and instructors see it as a priority on calendars and the open-shift feed."
          >
            <Flag
              className={`w-3.5 h-3.5 ${
                labDay.priority_flag === 'critical'
                  ? 'text-red-600 dark:text-red-400'
                  : labDay.priority_flag === 'high'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            />
            <select
              value={labDay.priority_flag ?? 'normal'}
              onChange={e => handleSetPriority(e.target.value as PriorityFlag)}
              disabled={priorityLoading}
              className={`text-xs font-medium bg-transparent border-0 focus:ring-0 cursor-pointer ${
                labDay.priority_flag === 'critical'
                  ? 'text-red-600 dark:text-red-400'
                  : labDay.priority_flag === 'high'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
              <option value="critical">Critical priority</option>
            </select>
            {priorityLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
          </label>
          {(labDay.is_nremt_testing || labMode === 'individual_testing') && (
            <>
              <Link href={`/labs/schedule/${labDayId}/results`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800"><ClipboardCheck className="w-3.5 h-3.5" /> Skill Results</Link>
              <Link href={`/labs/schedule/${labDayId}/coordinator`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800"><Users className="w-3.5 h-3.5" /> Coordinator View</Link>
            </>
          )}
          {/* Checkoff view — mobile-first combined tracker for days where two
              stations run the same skill (e.g. Intubation Checkoff). Auto-
              detects from stations; shows an empty state otherwise. */}
          <Link
            href={`/labs/schedule/${labDayId}/assignments`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 ml-auto"
          >
            <Users className="w-3.5 h-3.5" /> Assign Students
          </Link>
          <Link
            href={`/labs/schedule/${labDayId}/checkoff`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-800"
          >
            <ClipboardCheck className="w-3.5 h-3.5" /> Checkoff View
          </Link>
          {/* Request Coverage — lead_instructor+. Opens the modal
              pre-filled with this lab day's date/time so the director
              (Ryan/Ben) just has to click Approve. */}
          {userRole && hasMinRole(userRole, 'lead_instructor') && (
            <>
              <button
                type="button"
                onClick={() => setShowGenerateLabShifts(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800"
                title="Create open shifts for this lab day so part-timers can sign up"
              >
                <Sparkles className="w-3.5 h-3.5" /> Create shifts
              </button>
              <button
                type="button"
                onClick={() => setShowRequestCoverage(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800"
              >
                <AlertOctagon className="w-3.5 h-3.5" /> Request Coverage
              </button>
            </>
          )}
        </div>

        {/* Individual Testing tracker — auto-collapsed on checkoff
            days (the coordinator uses the dedicated checkoff view as
            the primary UI; the full tracker is still one click away
            but doesn't need to push the station cards below the fold). */}
        {labMode === 'individual_testing' && (
          <details
            className="mt-6 print:hidden group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            open={!isCheckoffDay}
          >
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-lg flex items-center justify-between">
              <span>Individual Testing Tracker</span>
              <span className="text-xs font-normal text-gray-400 group-open:hidden">Click to expand</span>
            </summary>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <IndividualTestingGrid labDayId={labDayId as string} isNremtTesting={!!labDay.is_nremt_testing} />
            </div>
          </details>
        )}

        {/* Station cards + right rail (lab info / quick stats / checklist).
            Mobile: stacks in DOM order — StationCards → LabInfo → Checklist.
            lg+: StationCards fills the left main column while the sidebar
            rail holds the quick-reference lab info card above the checklist. */}
        <div className="space-y-6 lg:space-y-0 lg:grid lg:gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="lg:col-start-1 lg:row-start-1">
            <StationCards stations={labDay.stations} stationSkillDocs={stationSkillDocs} stationSkillSheetIds={stationSkillSheetIds} stationNremtCodes={stationNremtCodes} stationScenarioTitles={nremtScenarioTitles} canSelectScenario={!!userRole && hasMinRole(userRole, 'lead_instructor')} calendarAvailability={calendarAvailability} labDayId={labDayId as string} getStationTitle={getStationTitle} onEditStation={(station) => setEditingStation(station)} onOpenRoleModal={(station) => setRoleModalStation(station)} onOpenScenarioPicker={(station, code) => setScenarioPickerState({ station, code })} />
          </div>

          <aside className="lg:col-start-2 lg:row-start-1 space-y-4 lg:sticky lg:top-4">
            {/* Lab Info + Quick Stats — at-a-glance reference card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Lab Info
              </h3>
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">Date</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{formatDate(labDay.date)}</dd>
                </div>
                {(labDay.start_time || labDay.end_time) && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Time</dt>
                    <dd className="text-gray-900 dark:text-white font-medium">
                      {labDay.start_time ? formatTime(labDay.start_time) : '—'}
                      {labDay.end_time ? ` – ${formatTime(labDay.end_time)}` : ''}
                    </dd>
                  </div>
                )}
                {labDay.cohort && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Cohort</dt>
                    <dd className="text-gray-900 dark:text-white font-medium">
                      {labDay.cohort.program?.abbreviation || 'Unknown'} {formatCohortNumber(labDay.cohort.cohort_number)}
                    </dd>
                  </div>
                )}
                {labDayRoles.filter((r) => r.role === 'lab_lead').length > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Lab Lead</dt>
                    <dd className="text-gray-900 dark:text-white font-medium text-right">
                      {labDayRoles
                        .filter((r) => r.role === 'lab_lead')
                        .map((r) => r.instructor?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {labDay.stations?.length || 0}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                    Stations
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {cohortStudents.length}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                    Students
                  </div>
                </div>
              </div>
            </div>

            <ChecklistSection labDayId={labDayId} />
          </aside>
        </div>
        <EquipmentSection labDayId={labDayId} stations={labDay.stations} />
        {userRole && hasMinRole(userRole, 'instructor') && <CostsSection labDayId={labDayId} cohortStudents={cohortStudents} />}
        {labDay.cohort?.id && <LabDayCheckInSection labDay={labDay} labDayId={labDayId} onLabDayUpdate={setLabDay} />}
        {/*
          Student Attendance, Performance, and Learning Style widgets
          are collapsed by default as of 2026-04-18 per feedback from
          active lab days — they clutter the working view and are rarely
          consulted mid-lab. Still one click away via native <details>
          disclosure (no JS state, keyboard-accessible out of the box).
        */}
        {labDay.cohort?.id && labMode !== 'individual_testing' && (
          <details className="mt-6 print:hidden group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-lg flex items-center justify-between">
              <span>Student Attendance</span>
              <span className="text-xs font-normal text-gray-400 group-open:hidden">Click to expand</span>
            </summary>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <AttendanceSection labDayId={labDayId} cohortId={labDay.cohort.id} />
            </div>
          </details>
        )}
        {/* Resend Results Emails — admin/lead_instructor only.
            Recovers from the "Resend was down at lab time" and
            "instructor closed the grading page before emails went
            out" scenarios. Idempotent server-side: already-sent
            rows are excluded by the resend route. Sits above
            Student Performance Ratings per request from coordinator
            workflow notes (May 22). */}
        {userRole && hasMinRole(userRole, 'lead_instructor') && (
          <div className="mt-6 print:hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Resend Results Emails
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Resend skill-evaluation result emails for this lab day. Already-sent
                  emails are skipped — useful if Resend was down at lab time or the
                  grading page was closed before emails fired.
                </p>
                <button
                  onClick={handleResendResults}
                  disabled={resendingResults}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {resendingResults ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {resendingResults ? 'Resending…' : 'Resend Results Emails'}
                </button>
              </div>
            </div>
          </div>
        )}
        {userRole && hasMinRole(userRole, 'instructor') && cohortStudents.length > 0 && (
          <details className="mt-6 print:hidden group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-lg flex items-center justify-between">
              <span>Student Performance Ratings</span>
              <span className="text-xs font-normal text-gray-400 group-open:hidden">Click to expand</span>
            </summary>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <StudentRatingsSection labDayId={labDayId} cohortStudents={cohortStudents} />
            </div>
          </details>
        )}
        {userRole && hasMinRole(userRole, 'instructor') && labDay.cohort?.id && (
          <details className="mt-6 print:hidden group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-lg flex items-center justify-between">
              <span>Learning Style Distribution</span>
              <span className="text-xs font-normal text-gray-400 group-open:hidden">Click to expand</span>
            </summary>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <LearningStyleDistribution labDayId={labDayId} cohortLinkId={labDay.cohort.id} />
            </div>
          </details>
        )}
        <LabDaySkillSignoffs labDayId={labDayId} cohortStudents={cohortStudents} skills={skills} userRole={userRole} />
        {isLabDayPast() && <DebriefSection labDayId={labDayId} />}
        {isLabDayPastOrToday() && <DebriefNotesSection labDayId={labDayId} session={session} userRole={userRole || ''} />}

        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Link href={`/academics/students?cohortId=${labDay.cohort.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"><Users className="w-4 h-4" /> View Students</Link>
          <Link href={`/reports/team-leads?cohortId=${labDay.cohort.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"><ClipboardCheck className="w-4 h-4" /> Team Lead Report</Link>
        </div>
      </main>

      {editingStation && (<EditStationModal station={editingStation} labDay={labDay} instructors={instructors} locations={locations} calendarAvailability={calendarAvailability} session={session} onClose={() => setEditingStation(null)} onSaved={() => { setEditingStation(null); fetchLabDay({ silent: true }); }} />)}
      {showTimer && <LabTimer labDayId={labDayId} numRotations={labDay.num_rotations} rotationMinutes={labDay.rotation_duration} onClose={() => setShowTimer(false)} isController={true} />}
      {roleModalStation?.scenario && (<ScenarioRoleModal station={roleModalStation} labDayId={labDayId} labDayDate={labDay.date} cohortStudents={cohortStudents} scenarioParticipation={scenarioParticipation} onClose={() => setRoleModalStation(null)} onSaved={async () => { await fetchScenarioParticipation(); setRoleModalStation(null); }} />)}
      {scenarioPickerState && (
        <ScenarioPickerModal
          station={scenarioPickerState.station}
          skillCode={scenarioPickerState.code}
          skillName={getStationTitle(scenarioPickerState.station)}
          allStations={labDay.stations}
          stationNremtCodes={stationNremtCodes}
          onClose={() => setScenarioPickerState(null)}
          onSaved={async () => { await fetchLabDay({ silent: true }); setScenarioPickerState(null); }}
        />
      )}
      <DuplicateModals labDay={labDay} labDayId={labDayId} showDuplicateModal={showDuplicateModal} showNextWeekConfirm={showNextWeekConfirm} showBulkDuplicateModal={showBulkDuplicateModal} onCloseDuplicate={() => setShowDuplicateModal(false)} onCloseNextWeek={() => setShowNextWeekConfirm(false)} onCloseBulkDuplicate={() => setShowBulkDuplicateModal(false)} onDuplicated={(newId) => { setCopySuccessToast(true); setTimeout(() => setCopySuccessToast(false), 3000); router.push(`/labs/schedule/${newId}/edit`); }} formatDate={formatDate} />
      {showDiffModal && labDay.source_template && (<TemplateDiffModal labDayId={labDay.id} templateId={labDay.source_template.id} templateName={labDay.source_template.name} onClose={() => setShowDiffModal(false)} onApplied={() => { setShowDiffModal(false); toast.success('Template updated successfully'); fetchLabDay({ silent: true }); }} />)}

      {showRequestCoverage && (
        <RequestCoverageModal
          onClose={() => setShowRequestCoverage(false)}
          onSubmitted={() => {
            setShowRequestCoverage(false);
            toast.success('Coverage request submitted — Ryan + Ben notified.');
          }}
          prefilledLabDay={{
            id: labDayId,
            date: labDay.date,
            start_time: labDay.start_time,
            end_time: labDay.end_time,
            title: labDay.title,
            cohortLabel: labDay.cohort
              ? `${labDay.cohort.program?.abbreviation ?? ''} Cohort ${formatCohortNumber(labDay.cohort.cohort_number)}`.trim()
              : null,
          }}
        />
      )}

      {showGenerateLabShifts && (
        <GenerateLabShiftsModal
          onClose={() => setShowGenerateLabShifts(false)}
          onCreated={(count) => {
            if (count > 0) {
              toast.success(`Created ${count} shift${count === 1 ? '' : 's'} — part-timers can sign up now.`);
            }
          }}
          // Lock to this lab day's cohort + date so a single-lab
          // shortcut can't accidentally fan across the whole semester.
          lockCohortId={labDay.cohort?.id ?? undefined}
          defaultStartDate={labDay.date}
          defaultEndDate={labDay.date}
        />
      )}

      {session?.user && (
        <LabDayChat
          labDayId={labDayId}
          senderName={session.user.name || 'Unknown'}
          senderEmail={session.user.email || ''}
          senderRole={userRole || 'user'}
          bottomOffset={80}
        />
      )}
    </div>
  );
}
