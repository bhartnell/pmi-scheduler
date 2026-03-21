'use client';

import { formatCohortNumber } from '@/lib/format-cohort';
import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Calendar,
  Plus,
  ClipboardCheck,
  Users,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Loader2,
  UserCheck,
  Link2,
  Layers,
  Copy,
  RefreshCw,
} from 'lucide-react';
import LabTimer from '@/components/LabTimer';
import AttendanceSection from '@/components/AttendanceSection';
import LearningStyleDistribution from '@/components/LearningStyleDistribution';
import { downloadICS, parseLocalDate } from '@/lib/ics-export';
import { openPrintWindow, printHeader, printFooter, escapeHtml } from '@/lib/print-utils';
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
  ChecklistItem,
  StudentRating,
  EquipmentItem,
  CostItem,
} from '@/components/lab-day/types';
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
import EditStationModal from '@/components/lab-day/EditStationModal';
import ScenarioRoleModal from '@/components/lab-day/ScenarioRoleModal';
import DuplicateModals from '@/components/lab-day/DuplicateModals';
import LabDayPrintView from '@/components/lab-day/LabDayPrintView';

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
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [scenarioParticipation, setScenarioParticipation] = useState<ScenarioParticipation[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistGenerating, setChecklistGenerating] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);

  // Equipment state
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [equipmentCollapsed, setEquipmentCollapsed] = useState(false);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentQty, setNewEquipmentQty] = useState(1);
  const [newEquipmentStation, setNewEquipmentStation] = useState('');
  const [addingEquipment, setAddingEquipment] = useState(false);

  // Cost state
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [costsCollapsed, setCostsCollapsed] = useState(true);
  const [costsLoading, setCostsLoading] = useState(false);
  const [addingCost, setAddingCost] = useState(false);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [newCostCategory, setNewCostCategory] = useState<string>('Consumables');
  const [newCostDescription, setNewCostDescription] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [editCostForm, setEditCostForm] = useState<{ category: string; description: string; amount: string }>({ category: '', description: '', amount: '' });

  // Debrief state
  const [debriefs, setDebriefs] = useState<any[]>([]);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefCollapsed, setDebriefCollapsed] = useState(false);
  const [currentUserDebrief, setCurrentUserDebrief] = useState<any>(null);
  const [editingDebriefId, setEditingDebriefId] = useState<string | null>(null);
  const [submittingDebrief, setSubmittingDebrief] = useState(false);
  const [debriefHoverRating, setDebriefHoverRating] = useState(0);
  const [debriefForm, setDebriefForm] = useState({ rating: 0, went_well: '', to_improve: '', student_concerns: '', equipment_issues: '' });
  const [evaluationConcerns, setEvaluationConcerns] = useState<any[]>([]);

  // Student ratings state
  const [studentRatings, setStudentRatings] = useState<StudentRating[]>([]);
  const [ratingsCollapsed, setRatingsCollapsed] = useState(false);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [savingRating, setSavingRating] = useState<Record<string, boolean>>({});
  const [ratingHover, setRatingHover] = useState<Record<string, number>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});

  // Coverage state
  interface ShiftCoverage {
    id: string; title: string; date: string; start_time: string; end_time: string;
    signups: { id: string; status: string; instructor: { id: string; name: string; email: string } | null }[];
  }
  const [coverageShifts, setCoverageShifts] = useState<ShiftCoverage[]>([]);
  const [coverageCollapsed, setCoverageCollapsed] = useState(false);

  // UI state
  const [showRosterPrint, setShowRosterPrint] = useState(false);
  const [rosterIncludePhotos, setRosterIncludePhotos] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showNextWeekConfirm, setShowNextWeekConfirm] = useState(false);
  const [showBulkDuplicateModal, setShowBulkDuplicateModal] = useState(false);
  const [showDuplicateDropdown, setShowDuplicateDropdown] = useState(false);
  const [copySuccessToast, setCopySuccessToast] = useState(false);
  const [showQuickAddStation, setShowQuickAddStation] = useState(false);
  const [quickAddType, setQuickAddType] = useState('scenario');
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [labMode, setLabMode] = useState<'group_rotations' | 'individual_testing'>('group_rotations');
  const [labModeLoading, setLabModeLoading] = useState(false);

  // Station edit modal state
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [roleModalStation, setRoleModalStation] = useState<Station | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (session && labDayId) {
      fetchLabDay();
      fetchScenarioParticipation();
      fetchChecklistItems();
      fetchEquipmentItems();
      fetchCostItems();
      fetchDebriefs();
      fetchEvaluationConcerns();
      fetchStudentRatings();
      fetchCurrentUserRole();
      fetchSkillsForSignoffs();
      fetchCoverageShifts();
    }
  }, [session, labDayId]);

  useEffect(() => {
    if (labDay?.cohort?.id) fetchCohortStudents();
  }, [labDay?.cohort?.id]);

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

      if (labDayData.success) {
        setLabDay(labDayData.labDay);
        if (labDayData.labDay?.lab_mode) setLabMode(labDayData.labDay.lab_mode);
      }
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
                  for (const ss of stationSkillsData.stationSkills) {
                    if (ss.skill?.id) {
                      const skill = skillsMap.get(ss.skill.id);
                      if (skill?.documents) docs.push(...skill.documents);
                    }
                  }
                  skillDocsMap[station.id] = docs;
                }
              } catch (error) { console.error(`Error fetching skill documents for station ${station.id}:`, error); }
            }
          }
          setStationSkillDocs(skillDocsMap);
        }
        if (labDayData.labDay.cohort?.program?.abbreviation) {
          lookupSkillSheets(labDayData.labDay.stations, labDayData.labDay.cohort.program.abbreviation);
        }
      }
    } catch (error) { console.error('Error fetching lab day:', error); }
    setLoading(false);
  };

  const lookupSkillSheets = async (stations: any[], program: string) => {
    const results: Record<string, string> = {};
    for (const station of stations) {
      const skillName = station.skill_name || station.scenario?.title || station.custom_title;
      if (!skillName) continue;
      try {
        const res = await fetch(`/api/skill-sheets/by-skill-name?name=${encodeURIComponent(skillName)}&program=${encodeURIComponent(program.toLowerCase())}`);
        const data = await res.json();
        if (data.success && data.sheets?.length > 0) results[station.id] = data.sheets[0].id;
      } catch { /* ignore */ }
    }
    setStationSkillSheetIds(results);
  };

  const fetchCohortStudents = async () => {
    if (!labDay?.cohort?.id) return;
    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${labDay.cohort.id}&status=active`);
      const data = await res.json();
      if (data.success) setCohortStudents(data.students || []);
    } catch (error) { console.error('Error fetching students:', error); }
  };

  const fetchScenarioParticipation = async () => {
    try {
      const res = await fetch(`/api/tracking/scenarios?labDayId=${labDayId}`);
      const data = await res.json();
      if (data.success) setScenarioParticipation(data.participation || []);
    } catch (error) { console.error('Error fetching scenario participation:', error); }
  };

  const fetchCurrentUserRole = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) setUserRole(data.user.role);
    } catch (error) { console.error('Error fetching user role:', error); }
  };

  const fetchSkillsForSignoffs = async () => {
    if (skills.length > 0) return;
    try {
      const res = await fetch('/api/lab-management/skills');
      const data = await res.json();
      if (data.success) setSkills(data.skills || []);
    } catch (error) { console.error('Error fetching skills for signoffs:', error); }
  };

  const fetchCoverageShifts = async () => {
    try {
      const labDayRes = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const labDayData = await labDayRes.json();
      const labDate = labDayData?.labDay?.date;
      if (!labDate) return;
      const res = await fetch(`/api/scheduling/shifts?start_date=${labDate}&end_date=${labDate}&include_filled=true`);
      const data = await res.json();
      if (data.success) {
        setCoverageShifts((data.shifts || []).map((s: any) => ({
          id: s.id, title: s.title, date: s.date, start_time: s.start_time, end_time: s.end_time,
          signups: (s.signups || []).map((su: any) => ({ id: su.id, status: su.status, instructor: su.instructor || null })),
        })));
      }
    } catch (error) { console.error('Error fetching coverage shifts:', error); }
  };

  // ---- Checklist handlers ----
  const fetchChecklistItems = async () => {
    setChecklistLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`); const data = await res.json(); if (data.success) setChecklistItems(data.items || []); }
    catch (error) { console.error('Error fetching checklist items:', error); }
    setChecklistLoading(false);
  };
  const handleAutoGenerateChecklist = async () => {
    setChecklistGenerating(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'auto-generate' }) }); const data = await res.json(); if (data.success) await fetchChecklistItems(); else alert('Failed: ' + (data.error || 'Unknown')); }
    catch (error) { console.error('Error:', error); alert('Failed to auto-generate checklist'); }
    setChecklistGenerating(false);
  };
  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return; setAddingChecklistItem(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newChecklistItem.trim() }) }); const data = await res.json(); if (data.success) { setChecklistItems(prev => [...prev, data.item]); setNewChecklistItem(''); } else alert('Failed: ' + (data.error || 'Unknown')); }
    catch (error) { console.error('Error:', error); alert('Failed to add checklist item'); }
    setAddingChecklistItem(false);
  };
  const handleToggleChecklistItem = async (item: ChecklistItem) => {
    const newCompleted = !item.is_completed;
    setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: newCompleted } : i));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: item.id, is_completed: newCompleted }) }); const data = await res.json(); if (data.success) setChecklistItems(prev => prev.map(i => i.id === item.id ? data.item : i)); else setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i)); }
    catch { setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i)); }
  };
  const handleDeleteChecklistItem = async (itemId: string) => {
    setChecklistItems(prev => prev.filter(i => i.id !== itemId));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist?itemId=${itemId}`, { method: 'DELETE' }); const data = await res.json(); if (!data.success) await fetchChecklistItems(); }
    catch { await fetchChecklistItems(); }
  };

  // ---- Equipment handlers ----
  const fetchEquipmentItems = async () => {
    setEquipmentLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`); const data = await res.json(); if (data.success) setEquipmentItems(data.items || []); }
    catch (error) { console.error('Error:', error); }
    setEquipmentLoading(false);
  };
  const handleAddEquipmentItem = async () => {
    if (!newEquipmentName.trim()) return; setAddingEquipment(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newEquipmentName.trim(), quantity: newEquipmentQty, station_id: newEquipmentStation || null }) }); const data = await res.json(); if (data.success) { setEquipmentItems(prev => [...prev, data.item]); setNewEquipmentName(''); setNewEquipmentQty(1); setNewEquipmentStation(''); } else alert('Failed: ' + (data.error || 'Unknown')); }
    catch (error) { console.error('Error:', error); alert('Failed to add equipment'); }
    setAddingEquipment(false);
  };
  const handleUpdateEquipmentStatus = async (item: EquipmentItem, newStatus: EquipmentItem['status']) => {
    setEquipmentItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: item.id, status: newStatus }) }); const data = await res.json(); if (data.success) setEquipmentItems(prev => prev.map(i => i.id === item.id ? data.item : i)); else setEquipmentItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i)); }
    catch { setEquipmentItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i)); }
  };
  const handleDeleteEquipmentItem = async (itemId: string) => {
    setEquipmentItems(prev => prev.filter(i => i.id !== itemId));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment?itemId=${itemId}`, { method: 'DELETE' }); const data = await res.json(); if (!data.success) await fetchEquipmentItems(); }
    catch { await fetchEquipmentItems(); }
  };

  // ---- Cost handlers ----
  const fetchCostItems = async () => {
    setCostsLoading(true);
    try { const res = await fetch(`/api/lab-management/costs?lab_day_id=${labDayId}`); const data = await res.json(); if (data.success) setCostItems(data.items || []); }
    catch (error) { console.error('Error:', error); }
    setCostsLoading(false);
  };
  const handleAddCostItem = async () => {
    if (!newCostDescription.trim() || !newCostAmount) return; setAddingCost(true);
    try { const res = await fetch('/api/lab-management/costs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lab_day_id: labDayId, category: newCostCategory, description: newCostDescription.trim(), amount: parseFloat(newCostAmount) || 0 }) }); const data = await res.json(); if (data.success) { setCostItems(prev => [...prev, data.item]); setNewCostDescription(''); setNewCostAmount(''); setNewCostCategory('Consumables'); } }
    catch (error) { console.error('Error:', error); }
    setAddingCost(false);
  };
  const handleStartEditCost = (item: CostItem) => { setEditingCostId(item.id); setEditCostForm({ category: item.category, description: item.description, amount: item.amount.toString() }); };
  const handleSaveEditCost = async (itemId: string) => {
    try { const res = await fetch(`/api/lab-management/costs/${itemId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: editCostForm.category, description: editCostForm.description, amount: parseFloat(editCostForm.amount) || 0 }) }); const data = await res.json(); if (data.success) { setCostItems(prev => prev.map(i => i.id === itemId ? data.item : i)); setEditingCostId(null); } }
    catch (error) { console.error('Error:', error); }
  };
  const handleDeleteCostItem = async (itemId: string) => {
    setCostItems(prev => prev.filter(i => i.id !== itemId));
    try { const res = await fetch(`/api/lab-management/costs/${itemId}`, { method: 'DELETE' }); const data = await res.json(); if (!data.success) await fetchCostItems(); }
    catch { await fetchCostItems(); }
  };

  // ---- Debrief handlers ----
  const isLabDayPast = (): boolean => { if (!labDay?.date) return false; const today = new Date(); today.setHours(0, 0, 0, 0); return new Date(labDay.date + 'T00:00:00') < today; };
  const isLabDayPastOrToday = (): boolean => { if (!labDay?.date) return false; const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1); return new Date(labDay.date + 'T00:00:00') < tomorrow; };

  const fetchDebriefs = async () => {
    if (!labDayId) return; setDebriefLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/debrief`); const data = await res.json(); if (data.success) { setDebriefs(data.debriefs || []); const userEmail = session?.user?.email?.toLowerCase(); const own = (data.debriefs || []).find((d: any) => d.instructor_email?.toLowerCase() === userEmail); setCurrentUserDebrief(own || null); if (own) setDebriefForm({ rating: own.rating || 0, went_well: own.went_well || '', to_improve: own.to_improve || '', student_concerns: own.student_concerns || '', equipment_issues: own.equipment_issues || '' }); } }
    catch (error) { console.error('Error:', error); }
    setDebriefLoading(false);
  };
  const fetchEvaluationConcerns = async () => {
    try { const res = await fetch(`/api/skill-sheets/evaluations-by-lab-day?lab_day_id=${labDayId}`); const data = await res.json(); if (data.success) setEvaluationConcerns((data.evaluations || []).filter((e: any) => e.flagged_items?.length > 0)); }
    catch { /* ignore */ }
  };
  const handleSubmitDebrief = async () => {
    if (debriefForm.rating < 1) return; setSubmittingDebrief(true);
    try { const method = editingDebriefId ? 'PUT' : 'POST'; const url = editingDebriefId ? `/api/lab-management/lab-days/${labDayId}/debrief?id=${editingDebriefId}` : `/api/lab-management/lab-days/${labDayId}/debrief`; const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(debriefForm) }); const data = await res.json(); if (data.success) { setEditingDebriefId(null); await fetchDebriefs(); } }
    catch (error) { console.error('Error:', error); }
    setSubmittingDebrief(false);
  };
  const startEditingDebrief = (debrief: any) => { setEditingDebriefId(debrief.id); setDebriefForm({ rating: debrief.rating || 0, went_well: debrief.went_well || '', to_improve: debrief.to_improve || '', student_concerns: debrief.student_concerns || '', equipment_issues: debrief.equipment_issues || '' }); };
  const cancelEditingDebrief = () => { setEditingDebriefId(null); if (currentUserDebrief) setDebriefForm({ rating: currentUserDebrief.rating || 0, went_well: currentUserDebrief.went_well || '', to_improve: currentUserDebrief.to_improve || '', student_concerns: currentUserDebrief.student_concerns || '', equipment_issues: currentUserDebrief.equipment_issues || '' }); };

  // ---- Ratings handlers ----
  const fetchStudentRatings = async () => {
    if (!labDayId) return; setRatingsLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`); const data = await res.json(); if (data.success) { setStudentRatings(data.ratings || []); const notes: Record<string, string> = {}; const currentEmail = session?.user?.email?.toLowerCase(); (data.ratings || []).forEach((r: StudentRating) => { if (r.instructor_email?.toLowerCase() === currentEmail && r.note) notes[r.student_id] = r.note; }); setPendingNotes(notes); } }
    catch (error) { console.error('Error:', error); }
    setRatingsLoading(false);
  };
  const handleSaveRating = async (studentId: string, rating: number) => {
    setSavingRating(prev => ({ ...prev, [studentId]: true }));
    const currentEmail = session?.user?.email || '';
    const existingIdx = studentRatings.findIndex(r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail.toLowerCase());
    const optimisticRating: StudentRating = { id: existingIdx >= 0 ? studentRatings[existingIdx].id : `temp-${studentId}`, lab_day_id: labDayId, student_id: studentId, instructor_email: currentEmail, rating, note: pendingNotes[studentId] || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setStudentRatings(prev => existingIdx >= 0 ? prev.map((r, i) => i === existingIdx ? optimisticRating : r) : [...prev, optimisticRating]);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, rating, note: pendingNotes[studentId] || null }) }); const data = await res.json(); if (data.success) { setStudentRatings(prev => prev.map(r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail.toLowerCase() ? data.rating : r)); toast.success('Rating saved'); } else { await fetchStudentRatings(); toast.error('Failed to save rating'); } }
    catch { await fetchStudentRatings(); toast.error('Failed to save rating'); }
    setSavingRating(prev => ({ ...prev, [studentId]: false }));
  };
  const handleSaveNote = async (studentId: string) => {
    const currentEmail = session?.user?.email?.toLowerCase();
    const existing = studentRatings.find(r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail);
    if (!existing) return;
    setSavingRating(prev => ({ ...prev, [`note-${studentId}`]: true }));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, rating: existing.rating, note: pendingNotes[studentId] || null }) }); const data = await res.json(); if (data.success) { setStudentRatings(prev => prev.map(r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail ? data.rating : r)); toast.success('Note saved'); setExpandedNotes(prev => ({ ...prev, [studentId]: false })); } else toast.error('Failed to save note'); }
    catch { toast.error('Failed to save note'); }
    setSavingRating(prev => ({ ...prev, [`note-${studentId}`]: false }));
  };

  // ---- Check-in handlers ----
  const handleEnableCheckIn = async () => {
    setCheckInLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checkin-token`, { method: 'POST' }); const data = await res.json(); if (data.success) setLabDay(prev => prev ? { ...prev, checkin_token: data.checkin_token, checkin_enabled: true } : prev); else alert('Failed: ' + (data.error || 'Unknown')); }
    catch (error) { console.error('Error:', error); }
    setCheckInLoading(false);
  };
  const handleDisableCheckIn = async () => {
    setCheckInLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checkin-token`, { method: 'DELETE' }); const data = await res.json(); if (data.success) setLabDay(prev => prev ? { ...prev, checkin_enabled: false } : prev); }
    catch (error) { console.error('Error:', error); }
    setCheckInLoading(false);
  };
  const handleCopyCheckInLink = async () => {
    if (!labDay?.checkin_token) return;
    const url = `${window.location.origin}/checkin/${labDay.checkin_token}`;
    try { await navigator.clipboard.writeText(url); setCopyLinkSuccess(true); setTimeout(() => setCopyLinkSuccess(false), 2500); }
    catch { alert('Check-in URL: ' + url); }
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

  // ---- Print/Export handlers ----
  const formatDate = (dateString: string) => { const date = new Date(dateString + 'T12:00:00'); return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); };
  const formatTime = (timeString: string | null) => { if (!timeString) return null; const [hours, minutes] = timeString.split(':'); const hour = parseInt(hours, 10); const ampm = hour >= 12 ? 'PM' : 'AM'; const hour12 = hour % 12 || 12; return `${hour12}:${minutes} ${ampm}`; };
  const getStationTitle = (station: Station) => { if (station.custom_title) return station.custom_title; if (station.scenario) return station.scenario.title; if (station.skill_name) return station.skill_name; return `Station ${station.station_number}`; };

  const handleExportCalendar = () => {
    if (!labDay) return;
    const startDate = parseLocalDate(labDay.date, labDay.start_time, 8);
    const endDate = parseLocalDate(labDay.date, labDay.end_time, 17);
    const cohortName = `${labDay.cohort.program.abbreviation} Group ${formatCohortNumber(labDay.cohort.cohort_number)}`;
    const stationList = labDay.stations.map((s: Station) => getStationTitle(s)).join(', ');
    const titlePart = labDay.title || `Lab Day ${labDay.date}`;
    const descParts = [`Cohort: ${cohortName}`];
    if (stationList) descParts.push(`Stations: ${stationList}`);
    labDayRoles.forEach(r => { const name = r.instructor?.name || r.instructor?.email || 'TBD'; const roleLabel = r.role === 'lab_lead' ? 'Lab Lead' : r.role === 'roamer' ? 'Roamer' : 'Observer'; descParts.push(`${roleLabel}: ${name}`); });
    if (labDay.notes) descParts.push(`Notes: ${labDay.notes}`);
    downloadICS([{ uid: `labday-${labDay.id}@pmi-scheduler`, title: `Lab Day - ${titlePart}`, description: descParts.join('\n'), location: 'PMI Campus', startDate, endDate }], `lab-day-${labDay.date}.ics`);
  };

  const handlePrint = () => {
    if (!labDay) return;
    const cohortName = `${labDay.cohort.program.abbreviation} Group ${formatCohortNumber(labDay.cohort.cohort_number)}`;
    const dateStr = formatDate(labDay.date);
    const timeStr = labDay.start_time ? `${formatTime(labDay.start_time)}${labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}` : '';
    let html = printHeader(labDay.title || 'Lab Day Schedule', `${cohortName} — ${dateStr}${timeStr ? ` — ${timeStr}` : ''}`);
    if (labDay.week_number && labDay.day_number) html += `<div style="font-size: 13px; color: #444; margin-bottom: 12px;">Week ${labDay.week_number}, Day ${labDay.day_number} &bull; ${labDay.num_rotations} rotations &times; ${labDay.rotation_duration} min</div>`;
    else html += `<div style="font-size: 13px; color: #444; margin-bottom: 12px;">${labDay.num_rotations} rotations &times; ${labDay.rotation_duration} min</div>`;
    if (labDayRoles.length > 0) { const leads = labDayRoles.filter(r => r.role === 'lab_lead').map(r => r.instructor?.name || 'Unknown'); const roamers = labDayRoles.filter(r => r.role === 'roamer').map(r => r.instructor?.name || 'Unknown'); const observers = labDayRoles.filter(r => r.role === 'observer').map(r => r.instructor?.name || 'Unknown'); html += '<div class="section" style="font-size: 12px;">'; if (leads.length > 0) html += `<strong>Lab Lead${leads.length > 1 ? 's' : ''}:</strong> ${leads.map(n => escapeHtml(n)).join(', ')} &nbsp; `; if (roamers.length > 0) html += `<strong>Roamer${roamers.length > 1 ? 's' : ''}:</strong> ${roamers.map(n => escapeHtml(n)).join(', ')} &nbsp; `; if (observers.length > 0) html += `<strong>Observer${observers.length > 1 ? 's' : ''}:</strong> ${observers.map(n => escapeHtml(n)).join(', ')}`; html += '</div>'; }
    if (labDay.stations.length > 0) { html += '<h2>Stations</h2><table><thead><tr><th>#</th><th>Type</th><th>Station / Scenario</th><th>Instructor</th><th>Room</th></tr></thead><tbody>'; labDay.stations.forEach((s: Station) => { const t = s.custom_title || s.scenario?.title || s.skill_name || `Station ${s.station_number}`; html += `<tr><td>${s.station_number}</td><td style="text-transform:capitalize;font-size:11px;">${escapeHtml(s.station_type.replace('_',' '))}</td><td><strong>${escapeHtml(t)}</strong>${s.station_notes ? `<br/><span style="font-size:11px;color:#666;">${escapeHtml(s.station_notes)}</span>` : ''}</td><td>${s.instructor_name ? escapeHtml(s.instructor_name) : '<em style="color:#999;">TBD</em>'}</td><td>${escapeHtml(s.room || '')}</td></tr>`; }); html += '</tbody></table>'; }
    if (labDay.start_time && labDay.rotation_duration > 0 && labDay.num_rotations > 0) { html += '<h2>Rotation Schedule</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:12px;">'; const sp = labDay.start_time.split(':'); const sm = parseInt(sp[0])*60+parseInt(sp[1]); for (let i=0;i<labDay.num_rotations;i++) { const rs=sm+(i*labDay.rotation_duration); const re=rs+labDay.rotation_duration; const ft=(m:number)=>{const h=Math.floor(m/60)%12||12;const mn=String(m%60).padStart(2,'0');const ap=Math.floor(m/60)>=12?'PM':'AM';return`${h}:${mn} ${ap}`}; html+=`<div style="border:1px solid #ddd;border-radius:4px;padding:4px 8px;"><strong>R${i+1}:</strong> ${ft(rs)} - ${ft(re)}</div>`; } html+='</div>'; }
    if (checklistItems.length > 0) { html += `<h2>Prep Checklist (${checklistItems.filter(i => i.is_completed).length}/${checklistItems.length})</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:12px;">`; checklistItems.forEach(item => { const icon = item.is_completed ? '<span class="checkbox-checked"></span>' : '<span class="checkbox"></span>'; html += `<div>${icon} <span${item.is_completed ? ' style="text-decoration:line-through;color:#888;"' : ''}>${escapeHtml(item.title)}</span></div>`; }); html += '</div>'; }
    if (labDay.notes) html += `<h2>Notes</h2><p style="font-size:12px;">${escapeHtml(labDay.notes)}</p>`;
    if (cohortStudents.length > 0) { html += `<h2>Student Roster (${cohortStudents.length})</h2><div class="three-col" style="font-size:12px;">`; [...cohortStudents].sort((a,b) => a.last_name.localeCompare(b.last_name)).forEach((s,i) => html += `<div>${i+1}. ${escapeHtml(s.last_name)}, ${escapeHtml(s.first_name)}</div>`); html += '</div>'; }
    html += printFooter(); openPrintWindow(`Lab Day - ${cohortName} - ${labDay.date}`, html);
  };

  const handlePrintRoster = () => {
    if (!labDay) return;
    const cohortName = `${labDay.cohort.program.abbreviation} Group ${formatCohortNumber(labDay.cohort.cohort_number)}`;
    let html = printHeader('Lab Day Roster', `${cohortName} — ${formatDate(labDay.date)}`);
    html += '<div class="two-col" style="margin-bottom: 12px; font-size: 12px;">';
    html += `<div><strong>Date:</strong> ${escapeHtml(formatDate(labDay.date))}<br/><strong>Cohort:</strong> ${escapeHtml(cohortName)}`; if (labDay.title) html += `<br/><strong>Lab:</strong> ${escapeHtml(labDay.title)}`; html += '</div><div>';
    if (labDay.start_time) html += `<strong>Time:</strong> ${formatTime(labDay.start_time)}${labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}<br/>`;
    if (labDay.week_number && labDay.day_number) html += `<strong>Week ${labDay.week_number}, Day ${labDay.day_number}</strong><br/>`;
    html += `<strong>Rotations:</strong> ${labDay.num_rotations} x ${labDay.rotation_duration} min</div></div>`;
    if (labDay.stations.length > 0) { html += '<h2>Stations & Instructors</h2><table><thead><tr><th>Stn</th><th>Station</th><th>Instructor</th><th>Room</th></tr></thead><tbody>'; labDay.stations.forEach((s: Station) => { const t = s.custom_title || s.scenario?.title || s.skill_name || `Station ${s.station_number}`; html += `<tr><td>${s.station_number}</td><td>${escapeHtml(t)}</td><td>${s.instructor_name ? escapeHtml(s.instructor_name) : '<em style="color:#999">TBD</em>'}</td><td>${escapeHtml(s.room || '')}</td></tr>`; }); html += '</tbody></table>'; }
    html += `<h2>Enrolled Students (${cohortStudents.length})</h2>`;
    if (cohortStudents.length > 0) { html += '<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Agency</th></tr></thead><tbody>'; [...cohortStudents].sort((a,b) => a.last_name.localeCompare(b.last_name)).forEach((s,i) => html += `<tr><td>${i+1}</td><td><strong>${escapeHtml(s.last_name)}, ${escapeHtml(s.first_name)}</strong></td><td>${escapeHtml(s.email || '')}</td><td>${escapeHtml(s.agency || '')}</td></tr>`); html += '</tbody></table>'; }
    html += printFooter(); openPrintWindow(`Roster - ${cohortName} - ${labDay.date}`, html);
  };

  const handleCSVExport = async () => {
    if (!labDay) return;
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/roster?format=csv`); if (!res.ok) { toast.error('Failed to export'); return; } const blob = await res.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `labday-roster-${labDay.date}.csv`; link.click(); URL.revokeObjectURL(url); toast.success('CSV downloaded'); }
    catch { toast.error('Failed to export'); }
  };

  const handleDownloadPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('lab-day-printable');
    if (!element) { alert('Could not find printable content'); return; }
    const printHidden = element.querySelectorAll('.print\\:hidden');
    const printBlock = element.querySelectorAll('.print\\:block');
    printHidden.forEach(el => (el as HTMLElement).style.display = 'none');
    printBlock.forEach(el => (el as HTMLElement).style.display = 'block');
    const cohortName = `${labDay?.cohort.program.abbreviation}-G${formatCohortNumber(labDay?.cohort.cohort_number)}`;
    const dateStr = labDay?.date || new Date().toISOString().split('T')[0];
    try { await html2pdf().set({ margin: 0.5, filename: `lab-day-${cohortName}-${dateStr}.pdf`, image: { type: 'jpeg' as const, quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in' as const, format: 'letter', orientation: 'portrait' as const } }).from(element).save(); }
    finally { printHidden.forEach(el => (el as HTMLElement).style.display = ''); printBlock.forEach(el => (el as HTMLElement).style.display = ''); }
  };

  // ---- Loading/Error states ----
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading schedule...</p>
        </div>
      </div>
    );
  }
  if (!session) return null;
  if (!labDay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Lab Day Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">The requested lab day could not be found.</p>
          <Link href="/lab-management/schedule" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <ChevronLeft className="w-4 h-4" /> Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="lab-day-printable" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 print:bg-white">
      <style>{`@media print { @page { margin: 0.5in; size: letter portrait; } nav, aside, header, footer, [data-radix-popper-content-wrapper], [role="dialog"], .toast-container { display: none !important; } html, body { background: white !important; color: black !important; font-size: 10pt !important; } * { box-shadow: none !important; text-shadow: none !important; } a { color: inherit !important; text-decoration: none !important; } }`}</style>

      {/* Toasts */}
      {justGraded && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden">
          <Check className="w-5 h-5" /><span>Assessment saved successfully!</span>
        </div>
      )}
      {copySuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden">
          <Check className="w-5 h-5" /><span>Lab day copied to next week!</span>
        </div>
      )}

      {/* Print Views */}
      <LabDayPrintView
        labDay={labDay}
        labDayRoles={labDayRoles}
        checklistItems={checklistItems}
        coverageShifts={coverageShifts}
        cohortStudents={cohortStudents}
        showRosterPrint={showRosterPrint}
        rosterIncludePhotos={rosterIncludePhotos}
        onSetShowRosterPrint={setShowRosterPrint}
        onSetRosterIncludePhotos={setRosterIncludePhotos}
        formatDate={formatDate}
        formatTime={formatTime}
      />

      {/* Header */}
      <LabDayHeader
        labDay={labDay}
        labDayId={labDayId}
        showDuplicateDropdown={showDuplicateDropdown}
        onSetShowDuplicateDropdown={setShowDuplicateDropdown}
        onOpenTimer={() => setShowTimer(true)}
        onPrint={handlePrint}
        onDownloadPDF={handleDownloadPDF}
        onExportCalendar={handleExportCalendar}
        onPrintRoster={handlePrintRoster}
        onCSVExport={handleCSVExport}
        onOpenDuplicateModal={() => { setShowDuplicateModal(true); setShowDuplicateDropdown(false); }}
        onOpenNextWeekConfirm={() => { setShowDuplicateDropdown(false); setShowNextWeekConfirm(true); }}
        onOpenBulkDuplicateModal={() => { setShowDuplicateDropdown(false); setShowBulkDuplicateModal(true); }}
        formatDate={formatDate}
        formatTime={formatTime}
      />

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6${showRosterPrint ? ' print:hidden' : ''}`}>
        {/* Notes */}
        {labDay.notes && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">Notes</h3>
            <p className="text-yellow-700 dark:text-yellow-400 text-sm">{labDay.notes}</p>
          </div>
        )}

        {/* Source Template */}
        {labDay.source_template && (
          <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 mb-6 print:hidden">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Source Template: {labDay.source_template.name}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">{labDay.source_template.program?.toUpperCase()} S{labDay.source_template.semester} &bull; Week {labDay.source_template.week_number} Day {labDay.source_template.day_number}</p>
            </div>
            {userRole && canAccessAdmin(userRole) && (
              <button onClick={() => setShowDiffModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-700/50 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Compare &amp; Update Template
              </button>
            )}
          </div>
        )}

        {/* Lab Day Roles */}
        <LabDayRolesSection
          labDayId={labDayId}
          labDayRoles={labDayRoles}
          instructors={instructors}
          userRole={userRole}
          calendarAvailability={calendarAvailability}
          onRolesChange={setLabDayRoles}
        />

        {/* Calendar Availability Summary */}
        {calendarSummary.total > 0 && !calendarLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3 print:hidden">
            <Calendar className="w-4 h-4" />
            <span>{calendarSummary.free} of {calendarSummary.total} instructor{calendarSummary.total !== 1 ? 's' : ''} {calendarSummary.free === 1 ? 'has a' : 'have'} free calendar{calendarSummary.free !== 1 ? 's' : ''} for this date</span>
            {calendarSummary.free < calendarSummary.total && <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">({calendarSummary.total - calendarSummary.free} busy or disconnected)</span>}
          </div>
        )}
        {calendarLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-3 print:hidden">
            <Loader2 className="w-4 h-4 animate-spin" /><span>Checking calendar availability...</span>
          </div>
        )}

        {/* Coverage */}
        <LabDayCoverageSection
          coverageShifts={coverageShifts}
          coverageCollapsed={coverageCollapsed}
          userRole={userRole}
          onToggleCollapse={() => setCoverageCollapsed(prev => !prev)}
          onRefresh={fetchCoverageShifts}
        />

        {/* Quick Add Station */}
        {showQuickAddStation && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 border-2 border-blue-200 dark:border-blue-800 print:hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Quick Add Station</h3>
              <button onClick={() => setShowQuickAddStation(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ClipboardCheck className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Station Type</label>
                <select value={quickAddType} onChange={(e) => setQuickAddType(e.target.value)} className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                  <option value="scenario">Scenario</option><option value="skills">Skills</option><option value="skill_drill">Skill Drill</option><option value="documentation">Documentation</option>
                </select>
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
                <input type="text" value={quickAddTitle} onChange={(e) => setQuickAddTitle(e.target.value)} placeholder="Enter station title..." className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAddStation(); }} />
              </div>
              <button onClick={handleQuickAddStation} disabled={quickAddSaving || !quickAddTitle.trim()} className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {quickAddSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 mb-4 print:hidden">
          {!showQuickAddStation && (
            <button onClick={() => setShowQuickAddStation(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800">
              <Plus className="w-4 h-4" /> Quick Add Station
            </button>
          )}
        </div>

        {/* Lab Mode Toggle */}
        <div className="flex items-center gap-2 mb-4 print:hidden">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Mode:</span>
          <button onClick={() => handleToggleLabMode('group_rotations')} disabled={labModeLoading} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${labMode === 'group_rotations' ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
            <Layers className="w-3.5 h-3.5" /> Group Rotations
          </button>
          <button onClick={() => handleToggleLabMode('individual_testing')} disabled={labModeLoading} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${labMode === 'individual_testing' ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
            <ClipboardCheck className="w-3.5 h-3.5" /> Individual Testing
          </button>
          {labModeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
        </div>

        {/* Individual Testing Grid */}
        {labMode === 'individual_testing' && (
          <div className="mt-6 print:hidden"><IndividualTestingGrid labDayId={labDayId as string} /></div>
        )}

        {/* Stations Grid */}
        <StationCards stations={labDay.stations} stationSkillDocs={stationSkillDocs} stationSkillSheetIds={stationSkillSheetIds} calendarAvailability={calendarAvailability} labDayId={labDayId as string} getStationTitle={getStationTitle} onEditStation={(station) => setEditingStation(station)} onOpenRoleModal={(station) => setRoleModalStation(station)} />

        {/* Checklist */}
        <ChecklistSection checklistItems={checklistItems} checklistCollapsed={checklistCollapsed} checklistLoading={checklistLoading} checklistGenerating={checklistGenerating} newChecklistItem={newChecklistItem} addingChecklistItem={addingChecklistItem} onToggleCollapse={() => setChecklistCollapsed(prev => !prev)} onToggleItem={handleToggleChecklistItem} onAddItem={handleAddChecklistItem} onDeleteItem={handleDeleteChecklistItem} onAutoGenerate={handleAutoGenerateChecklist} onNewItemChange={setNewChecklistItem} />

        {/* Equipment */}
        <EquipmentSection equipmentItems={equipmentItems} equipmentCollapsed={equipmentCollapsed} equipmentLoading={equipmentLoading} stations={labDay.stations} newEquipmentName={newEquipmentName} newEquipmentQty={newEquipmentQty} newEquipmentStation={newEquipmentStation} addingEquipment={addingEquipment} onToggleCollapse={() => setEquipmentCollapsed(prev => !prev)} onUpdateStatus={handleUpdateEquipmentStatus} onAddEquipment={handleAddEquipmentItem} onDeleteEquipment={handleDeleteEquipmentItem} onNewNameChange={setNewEquipmentName} onNewQtyChange={setNewEquipmentQty} onNewStationChange={setNewEquipmentStation} />

        {/* Costs */}
        {userRole && hasMinRole(userRole, 'instructor') && (
          <CostsSection costItems={costItems} costsCollapsed={costsCollapsed} costsLoading={costsLoading} addingCost={addingCost} editingCostId={editingCostId} editCostForm={editCostForm} newCostCategory={newCostCategory} newCostDescription={newCostDescription} newCostAmount={newCostAmount} cohortStudents={cohortStudents} onToggleCollapse={() => setCostsCollapsed(prev => !prev)} onAddCostItem={handleAddCostItem} onStartEditCost={handleStartEditCost} onSaveEditCost={handleSaveEditCost} onCancelEditCost={() => setEditingCostId(null)} onDeleteCostItem={handleDeleteCostItem} onEditCostFormChange={setEditCostForm} onNewCostCategoryChange={setNewCostCategory} onNewCostDescriptionChange={setNewCostDescription} onNewCostAmountChange={setNewCostAmount} />
        )}

        {/* Student Self Check-In */}
        {labDay.cohort?.id && (
          <div className="mt-6 print:hidden">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${labDay.checkin_enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <UserCheck className={`w-5 h-5 ${labDay.checkin_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Student Self Check-In</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{labDay.checkin_enabled ? 'Check-in is active — students can tap their name to mark themselves present.' : 'Enable to give students a link to check themselves in.'}</p>
                  </div>
                </div>
                <button onClick={labDay.checkin_enabled ? handleDisableCheckIn : handleEnableCheckIn} disabled={checkInLoading} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors disabled:opacity-50 ${labDay.checkin_enabled ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>
                  {checkInLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : labDay.checkin_enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  {labDay.checkin_enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              {labDay.checkin_enabled && labDay.checkin_token && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Check-In Link</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 min-w-0">
                      <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600 dark:text-gray-300 font-mono truncate">{typeof window !== 'undefined' ? `${window.location.origin}/checkin/${labDay.checkin_token}` : `/checkin/${labDay.checkin_token}`}</span>
                    </div>
                    <button onClick={handleCopyCheckInLink} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors ${copyLinkSuccess ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                      {copyLinkSuccess ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Share this link with students or display it on screen.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance */}
        {labDay.cohort?.id && labMode !== 'individual_testing' && (
          <div className="mt-6 print:hidden"><AttendanceSection labDayId={labDayId} cohortId={labDay.cohort.id} /></div>
        )}

        {/* Student Ratings */}
        {userRole && hasMinRole(userRole, 'instructor') && cohortStudents.length > 0 && (
          <StudentRatingsSection studentRatings={studentRatings} ratingsCollapsed={ratingsCollapsed} ratingsLoading={ratingsLoading} cohortStudents={cohortStudents} savingRating={savingRating} ratingHover={ratingHover} expandedNotes={expandedNotes} pendingNotes={pendingNotes} session={session} onToggleCollapse={() => setRatingsCollapsed(prev => !prev)} onSaveRating={handleSaveRating} onSaveNote={handleSaveNote} onRatingHoverChange={(sid, v) => setRatingHover(prev => ({ ...prev, [sid]: v }))} onPendingNoteChange={(sid, v) => setPendingNotes(prev => ({ ...prev, [sid]: v }))} onExpandedNotesChange={(sid, expanded) => setExpandedNotes(prev => ({ ...prev, [sid]: expanded }))} />
        )}

        {/* Learning Style Distribution */}
        {userRole && hasMinRole(userRole, 'instructor') && labDay.cohort?.id && (
          <div className="mt-6 print:hidden"><LearningStyleDistribution labDayId={labDayId} cohortLinkId={labDay.cohort.id} /></div>
        )}

        {/* Skill Sign-offs */}
        <LabDaySkillSignoffs labDayId={labDayId} cohortStudents={cohortStudents} skills={skills} userRole={userRole} />

        {/* Debrief */}
        {isLabDayPast() && (
          <DebriefSection debriefs={debriefs} debriefCollapsed={debriefCollapsed} debriefLoading={debriefLoading} currentUserDebrief={currentUserDebrief} editingDebriefId={editingDebriefId} submittingDebrief={submittingDebrief} debriefForm={debriefForm} debriefHoverRating={debriefHoverRating} evaluationConcerns={evaluationConcerns} session={session} onToggleCollapse={() => setDebriefCollapsed(prev => !prev)} onSubmitDebrief={handleSubmitDebrief} onStartEditingDebrief={startEditingDebrief} onCancelEditingDebrief={cancelEditingDebrief} onDebriefFormChange={setDebriefForm} onDebriefHoverRatingChange={setDebriefHoverRating} />
        )}

        {/* Debrief Notes */}
        {isLabDayPastOrToday() && <DebriefNotesSection labDayId={labDayId} session={session} userRole={userRole || ''} />}

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Link href={`/lab-management/students?cohortId=${labDay.cohort.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Users className="w-4 h-4" /> View Students
          </Link>
          <Link href={`/lab-management/reports/team-leads?cohortId=${labDay.cohort.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <ClipboardCheck className="w-4 h-4" /> Team Lead Report
          </Link>
        </div>
      </main>

      {/* Edit Station Modal */}
      {editingStation && (
        <EditStationModal station={editingStation} labDay={labDay} instructors={instructors} locations={locations} calendarAvailability={calendarAvailability} session={session} onClose={() => setEditingStation(null)} onSaved={() => { setEditingStation(null); fetchLabDay(); }} />
      )}

      {/* Lab Timer */}
      {showTimer && <LabTimer labDayId={labDayId} numRotations={labDay.num_rotations} rotationMinutes={labDay.rotation_duration} onClose={() => setShowTimer(false)} isController={true} />}

      {/* Role Logging Modal */}
      {roleModalStation?.scenario && (
        <ScenarioRoleModal station={roleModalStation} labDayId={labDayId} labDayDate={labDay.date} cohortStudents={cohortStudents} scenarioParticipation={scenarioParticipation} onClose={() => setRoleModalStation(null)} onSaved={async () => { await fetchScenarioParticipation(); setRoleModalStation(null); }} />
      )}

      {/* Duplicate Modals */}
      <DuplicateModals labDay={labDay} labDayId={labDayId} showDuplicateModal={showDuplicateModal} showNextWeekConfirm={showNextWeekConfirm} showBulkDuplicateModal={showBulkDuplicateModal} onCloseDuplicate={() => setShowDuplicateModal(false)} onCloseNextWeek={() => setShowNextWeekConfirm(false)} onCloseBulkDuplicate={() => setShowBulkDuplicateModal(false)} onDuplicated={(newId) => { setCopySuccessToast(true); setTimeout(() => setCopySuccessToast(false), 3000); router.push(`/lab-management/schedule/${newId}/edit`); }} formatDate={formatDate} />

      {/* Template Diff Modal */}
      {showDiffModal && labDay.source_template && (
        <TemplateDiffModal labDayId={labDay.id} templateId={labDay.source_template.id} templateName={labDay.source_template.name} onClose={() => setShowDiffModal(false)} onApplied={() => { setShowDiffModal(false); toast.success('Template updated successfully'); fetchLabDay(); }} />
      )}
    </div>
  );
}
