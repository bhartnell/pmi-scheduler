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
  Users,
  Check,
  AlertCircle,
  Loader2,
  Layers,
  RefreshCw,
  GraduationCap,
} from 'lucide-react';
import LabTimer from '@/components/LabTimer';
import AttendanceSection from '@/components/AttendanceSection';
import LearningStyleDistribution from '@/components/LearningStyleDistribution';
import { useToast } from '@/components/Toast';
import { hasMinRole, canAccessAdmin } from '@/lib/permissions';
import TemplateDiffModal from '@/components/TemplateDiffModal';
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
  const fetchLabDay = async () => {
    setLoading(true);
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
    setLoading(false);
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
        fetchLabDay();
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
    try { const nextNumber = labDay ? Math.max(...labDay.stations.map((s: Station) => s.station_number), 0) + 1 : 1; const res = await fetch('/api/lab-management/stations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lab_day_id: labDayId, station_number: nextNumber, station_type: quickAddType, custom_title: quickAddTitle.trim() }) }); const data = await res.json(); if (data.success) { toast?.addToast('success', 'Station added'); setShowQuickAddStation(false); setQuickAddTitle(''); setQuickAddType('scenario'); fetchLabDay(); } else toast?.addToast('error', data.error || 'Failed'); }
    catch (error) { console.error('Error:', error); toast?.addToast('error', 'Failed to add station'); }
    setQuickAddSaving(false);
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
            {userRole && canAccessAdmin(userRole) && (<button onClick={() => setShowDiffModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-700/50 transition-colors"><RefreshCw className="w-3.5 h-3.5" /> Compare &amp; Update Template</button>)}
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
          {(labDay.is_nremt_testing || labMode === 'individual_testing') && (
            <>
              <Link href={`/labs/schedule/${labDayId}/results`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800"><ClipboardCheck className="w-3.5 h-3.5" /> Skill Results</Link>
              <Link href={`/labs/schedule/${labDayId}/coordinator`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800 ml-auto"><Users className="w-3.5 h-3.5" /> Coordinator View</Link>
            </>
          )}
        </div>

        {labMode === 'individual_testing' && (<div className="mt-6 print:hidden"><IndividualTestingGrid labDayId={labDayId as string} isNremtTesting={!!labDay.is_nremt_testing} /></div>)}

        <StationCards stations={labDay.stations} stationSkillDocs={stationSkillDocs} stationSkillSheetIds={stationSkillSheetIds} stationNremtCodes={stationNremtCodes} stationScenarioTitles={nremtScenarioTitles} canSelectScenario={!!userRole && hasMinRole(userRole, 'lead_instructor')} calendarAvailability={calendarAvailability} labDayId={labDayId as string} getStationTitle={getStationTitle} onEditStation={(station) => setEditingStation(station)} onOpenRoleModal={(station) => setRoleModalStation(station)} onOpenScenarioPicker={(station, code) => setScenarioPickerState({ station, code })} />

        <ChecklistSection labDayId={labDayId} />
        <EquipmentSection labDayId={labDayId} stations={labDay.stations} />
        {userRole && hasMinRole(userRole, 'instructor') && <CostsSection labDayId={labDayId} cohortStudents={cohortStudents} />}
        {labDay.cohort?.id && <LabDayCheckInSection labDay={labDay} labDayId={labDayId} onLabDayUpdate={setLabDay} />}
        {labDay.cohort?.id && labMode !== 'individual_testing' && (<div className="mt-6 print:hidden"><AttendanceSection labDayId={labDayId} cohortId={labDay.cohort.id} /></div>)}
        {userRole && hasMinRole(userRole, 'instructor') && cohortStudents.length > 0 && <StudentRatingsSection labDayId={labDayId} cohortStudents={cohortStudents} />}
        {userRole && hasMinRole(userRole, 'instructor') && labDay.cohort?.id && (<div className="mt-6 print:hidden"><LearningStyleDistribution labDayId={labDayId} cohortLinkId={labDay.cohort.id} /></div>)}
        <LabDaySkillSignoffs labDayId={labDayId} cohortStudents={cohortStudents} skills={skills} userRole={userRole} />
        {isLabDayPast() && <DebriefSection labDayId={labDayId} />}
        {isLabDayPastOrToday() && <DebriefNotesSection labDayId={labDayId} session={session} userRole={userRole || ''} />}

        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Link href={`/academics/students?cohortId=${labDay.cohort.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"><Users className="w-4 h-4" /> View Students</Link>
          <Link href={`/lab-management/reports/team-leads?cohortId=${labDay.cohort.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"><ClipboardCheck className="w-4 h-4" /> Team Lead Report</Link>
        </div>
      </main>

      {editingStation && (<EditStationModal station={editingStation} labDay={labDay} instructors={instructors} locations={locations} calendarAvailability={calendarAvailability} session={session} onClose={() => setEditingStation(null)} onSaved={() => { setEditingStation(null); fetchLabDay(); }} />)}
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
          onSaved={async () => { await fetchLabDay(); setScenarioPickerState(null); }}
        />
      )}
      <DuplicateModals labDay={labDay} labDayId={labDayId} showDuplicateModal={showDuplicateModal} showNextWeekConfirm={showNextWeekConfirm} showBulkDuplicateModal={showBulkDuplicateModal} onCloseDuplicate={() => setShowDuplicateModal(false)} onCloseNextWeek={() => setShowNextWeekConfirm(false)} onCloseBulkDuplicate={() => setShowBulkDuplicateModal(false)} onDuplicated={(newId) => { setCopySuccessToast(true); setTimeout(() => setCopySuccessToast(false), 3000); router.push(`/labs/schedule/${newId}/edit`); }} formatDate={formatDate} />
      {showDiffModal && labDay.source_template && (<TemplateDiffModal labDayId={labDay.id} templateId={labDay.source_template.id} templateName={labDay.source_template.name} onClose={() => setShowDiffModal(false)} onApplied={() => { setShowDiffModal(false); toast.success('Template updated successfully'); fetchLabDay(); }} />)}

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
