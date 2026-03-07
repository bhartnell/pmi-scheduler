'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Calendar,
  Plus,
  Edit2,
  ClipboardCheck,
  FileText,
  Users,
  Clock,
  Check,
  AlertCircle,
  Printer,
  Download,
  X,
  Save,
  Trash2,
  Timer,
  Repeat,
  Upload,
  ExternalLink,
  Copy,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Info,
  Link2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  UserCheck,
  CalendarPlus,
  ChevronUp,
  CheckCircle,
  XCircle,
  Shield,
  Layers,
  Monitor
} from 'lucide-react';
import LabTimer from '@/components/LabTimer';
import InlineTimerWidget from '@/components/InlineTimerWidget';
import BLSPlatinumChecklist from '@/components/BLSPlatinumChecklist';
import AttendanceSection from '@/components/AttendanceSection';
import LearningStyleDistribution from '@/components/LearningStyleDistribution';
import { downloadICS, parseLocalDate } from '@/lib/ics-export';
import { openPrintWindow, printHeader, printFooter, escapeHtml } from '@/lib/print-utils';
import { useToast } from '@/components/Toast';
import { hasMinRole, canAccessAdmin } from '@/lib/permissions';
import HelpTooltip from '@/components/HelpTooltip';
import TemplateGuideSection from '@/components/TemplateGuideSection';
import type { StationMetadata } from '@/components/TemplateGuideSection';
import TemplateDiffModal from '@/components/TemplateDiffModal';
import CalendarAvailabilityDot from '@/components/CalendarAvailabilityDot';
import { useCalendarAvailability } from '@/hooks/useCalendarAvailability';
import Breadcrumbs from '@/components/Breadcrumbs';
import { ArrowLeft } from 'lucide-react';

import type {
  LabDay,
  Station,
  Scenario,
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
import { STATION_TYPES } from '@/components/lab-day/types';
import ChecklistSection from '@/components/lab-day/ChecklistSection';
import EquipmentSection from '@/components/lab-day/EquipmentSection';
import CostsSection from '@/components/lab-day/CostsSection';
import DebriefSection from '@/components/lab-day/DebriefSection';
import StationCards from '@/components/lab-day/StationCards';
import StudentRatingsSection from '@/components/lab-day/StudentRatingsSection';

export default function LabDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const labDayId = params.id as string;
  const justGraded = searchParams.get('graded');
  const openTimerParam = searchParams.get('timer') === 'open';

  const toast = useToast();

  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimer, setShowTimer] = useState(openTimerParam);
  const [labDayRoles, setLabDayRoles] = useState<LabDayRole[]>([]);
  const [showRoleAssignForm, setShowRoleAssignForm] = useState(false);
  const [roleAssignRole, setRoleAssignRole] = useState<'lab_lead' | 'roamer' | 'observer'>('roamer');
  const [roleAssignInstructorId, setRoleAssignInstructorId] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);
  const [stationSkillDocs, setStationSkillDocs] = useState<Record<string, SkillDocument[]>>({});

  // Role logging state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleModalStation, setRoleModalStation] = useState<Station | null>(null);
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [scenarioParticipation, setScenarioParticipation] = useState<ScenarioParticipation[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({
    team_lead: '',
    med_tech: '',
    monitor_tech: '',
    airway_tech: '',
    observer: ''
  });
  const [savingRoles, setSavingRoles] = useState(false);

  // Template diff modal state
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Duplicate lab day modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  // Copy to Next Week state
  const [showNextWeekConfirm, setShowNextWeekConfirm] = useState(false);
  const [copyingNextWeek, setCopyingNextWeek] = useState(false);
  const [showDuplicateDropdown, setShowDuplicateDropdown] = useState(false);
  const [copySuccessToast, setCopySuccessToast] = useState(false);

  // Duplicate to multiple dates modal state
  const [showBulkDuplicateModal, setShowBulkDuplicateModal] = useState(false);
  const [bulkSelectedDates, setBulkSelectedDates] = useState<string[]>([]);
  const [bulkCalendarMonth, setBulkCalendarMonth] = useState<Date>(new Date());
  const [bulkDuplicating, setBulkDuplicating] = useState(false);
  const [bulkDuplicateProgress, setBulkDuplicateProgress] = useState<{
    status: 'idle' | 'running' | 'done';
    total: number;
    current: number;
    createdIds: string[];
    failed: Array<{ date: string; error: string }>;
  }>({ status: 'idle', total: 0, current: 0, createdIds: [], failed: [] });

  // Prep checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistGenerating, setChecklistGenerating] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);

  // Equipment tracking state
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [equipmentCollapsed, setEquipmentCollapsed] = useState(false);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentQty, setNewEquipmentQty] = useState(1);
  const [newEquipmentStation, setNewEquipmentStation] = useState('');
  const [addingEquipment, setAddingEquipment] = useState(false);

  // Cost tracking state
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [costsCollapsed, setCostsCollapsed] = useState(true);
  const [costsLoading, setCostsLoading] = useState(false);
  const [addingCost, setAddingCost] = useState(false);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [newCostCategory, setNewCostCategory] = useState<string>('Consumables');
  const [newCostDescription, setNewCostDescription] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [editCostForm, setEditCostForm] = useState<{
    category: string;
    description: string;
    amount: string;
  }>({ category: '', description: '', amount: '' });

  // Post-lab debrief state
  const [debriefs, setDebriefs] = useState<any[]>([]);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefCollapsed, setDebriefCollapsed] = useState(false);
  const [currentUserDebrief, setCurrentUserDebrief] = useState<any>(null);
  const [editingDebriefId, setEditingDebriefId] = useState<string | null>(null);
  const [submittingDebrief, setSubmittingDebrief] = useState(false);
  const [debriefHoverRating, setDebriefHoverRating] = useState(0);
  const [debriefForm, setDebriefForm] = useState({
    rating: 0,
    went_well: '',
    to_improve: '',
    student_concerns: '',
    equipment_issues: '',
  });

  // Skill sheet lookup state (maps station.id -> skill_sheet.id)
  const [stationSkillSheetIds, setStationSkillSheetIds] = useState<Record<string, string>>({});

  // Evaluation concerns from skill sheet evaluations (for debrief section)
  const [evaluationConcerns, setEvaluationConcerns] = useState<any[]>([]);

  // Student ratings state
  const [studentRatings, setStudentRatings] = useState<StudentRating[]>([]);
  const [ratingsCollapsed, setRatingsCollapsed] = useState(false);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [savingRating, setSavingRating] = useState<Record<string, boolean>>({});
  const [ratingHover, setRatingHover] = useState<Record<string, number>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string | null>(null);

  // Skill sign-off state
  const [signoffCollapsed, setSignoffCollapsed] = useState(false);
  const [signoffSkillId, setSignoffSkillId] = useState('');
  const [signoffs, setSignoffs] = useState<Record<string, { id: string; signed_off_by: string; signed_off_at: string; revoked: boolean }>>({});
  const [signoffLoading, setSignoffLoading] = useState(false);
  const [signoffSaving, setSignoffSaving] = useState<Record<string, boolean>>({});
  const [signoffConfirm, setSignoffConfirm] = useState<Record<string, boolean>>({});
  const [signoffBulkSelected, setSignoffBulkSelected] = useState<string[]>([]);
  const [signoffBulkConfirm, setSignoffBulkConfirm] = useState(false);
  const [signoffBulkSaving, setSignoffBulkSaving] = useState(false);
  const [signoffRevokeId, setSignoffRevokeId] = useState<string | null>(null);
  const [signoffRevokeReason, setSignoffRevokeReason] = useState('');
  const [signoffRevoking, setSignoffRevoking] = useState(false);

  // Roster export state
  const [showRosterPrint, setShowRosterPrint] = useState(false);
  const [rosterIncludePhotos, setRosterIncludePhotos] = useState(true);

  // Check-in toggle state
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);

  // Edit station modal state
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [editDrillData, setEditDrillData] = useState<Record<string, unknown> | null>(null);
  const [editSkillDrills, setEditSkillDrills] = useState<{ id: string; name: string; category: string; station_id?: string }[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [isCustomInstructor, setIsCustomInstructor] = useState(false);
  const [savingStation, setSavingStation] = useState(false);
  const [deletingStation, setDeletingStation] = useState(false);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [certLevelFilter, setCertLevelFilter] = useState<string>(''); // '' = All, 'EMT', 'AEMT', 'Paramedic'
  const [editCustomSkills, setEditCustomSkills] = useState<string[]>([]);
  const [stationInstructors, setStationInstructors] = useState<{id?: string; user_email: string; user_name: string; is_primary: boolean}[]>([]);
  const [editForm, setEditForm] = useState({
    station_type: 'scenario' as string,
    scenario_id: '',
    selectedSkills: [] as string[],
    selectedDrillIds: [] as string[],
    custom_title: '',
    skill_sheet_url: '',
    instructions_url: '',
    station_notes: '',
    instructor_name: '',
    instructor_email: '',
    room: '',
    notes: ''
  });

  // Coverage section state (shift signups for this lab day)
  interface ShiftCoverage {
    id: string;
    title: string;
    date: string;
    start_time: string;
    end_time: string;
    signups: {
      id: string;
      status: string;
      instructor: { id: string; name: string; email: string } | null;
    }[];
  }
  const [coverageShifts, setCoverageShifts] = useState<ShiftCoverage[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageCollapsed, setCoverageCollapsed] = useState(false);

  // Quick Add Station state
  const [showQuickAddStation, setShowQuickAddStation] = useState(false);
  const [quickAddType, setQuickAddType] = useState('scenario');
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
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
      fetchSignoffs();
      fetchSkillsForSignoffs();
      fetchCoverageShifts();
    }
  }, [session, labDayId]);

  // Fetch students when lab day is loaded
  useEffect(() => {
    if (labDay?.cohort?.id) {
      fetchCohortStudents();
    }
  }, [labDay?.cohort?.id]);

  // Collect all instructor emails for calendar availability lookup
  const allInstructorEmails = (() => {
    const emails = new Set<string>();
    // Station instructors
    labDay?.stations?.forEach(s => {
      if (s.instructor_email) emails.add(s.instructor_email.toLowerCase());
    });
    // Lab day roles (lead, roamer, observer)
    labDayRoles.forEach(r => {
      if (r.instructor?.email) emails.add(r.instructor.email.toLowerCase());
    });
    // All available instructors for the picker
    instructors.forEach(i => {
      if (i.email) emails.add(i.email.toLowerCase());
    });
    return Array.from(emails);
  })();

  const { availability: calendarAvailability, loading: calendarLoading, summary: calendarSummary } = useCalendarAvailability(
    labDay?.date || null,
    allInstructorEmails,
    labDay?.start_time?.substring(0, 5) || '08:00',
    labDay?.end_time?.substring(0, 5) || '17:00'
  );

  // --- Lab Day Role (Roamer/Lead/Observer) inline assignment handlers ---
  const handleAddLabDayRole = async () => {
    if (!roleAssignInstructorId || !roleAssignRole) return;
    setAddingRole(true);
    try {
      const res = await fetch('/api/lab-management/lab-day-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          instructor_id: roleAssignInstructorId,
          role: roleAssignRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLabDayRoles(prev => [...prev, data.role]);
        setRoleAssignInstructorId('');
        setShowRoleAssignForm(false);
        toast?.addToast('success', 'Role assigned successfully');
      } else {
        toast?.addToast('error', data.error || 'Failed to assign role');
      }
    } catch (error) {
      console.error('Error adding lab day role:', error);
      toast?.addToast('error', 'Failed to assign role');
    }
    setAddingRole(false);
  };

  const handleRemoveLabDayRole = async (roleId: string) => {
    setRemovingRoleId(roleId);
    try {
      const res = await fetch(`/api/lab-management/lab-day-roles?id=${roleId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setLabDayRoles(prev => prev.filter(r => r.id !== roleId));
        toast?.addToast('success', 'Role removed');
      } else {
        toast?.addToast('error', data.error || 'Failed to remove role');
      }
    } catch (error) {
      console.error('Error removing lab day role:', error);
      toast?.addToast('error', 'Failed to remove role');
    }
    setRemovingRoleId(null);
  };

  const fetchChecklistItems = async () => {
    setChecklistLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`);
      const data = await res.json();
      if (data.success) {
        setChecklistItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching checklist items:', error);
    }
    setChecklistLoading(false);
  };

  const handleAutoGenerateChecklist = async () => {
    setChecklistGenerating(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto-generate' }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchChecklistItems();
      } else {
        alert('Failed to auto-generate checklist: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error auto-generating checklist:', error);
      alert('Failed to auto-generate checklist');
    }
    setChecklistGenerating(false);
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    setAddingChecklistItem(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChecklistItem.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setChecklistItems(prev => [...prev, data.item]);
        setNewChecklistItem('');
      } else {
        alert('Failed to add item: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding checklist item:', error);
      alert('Failed to add checklist item');
    }
    setAddingChecklistItem(false);
  };

  const handleToggleChecklistItem = async (item: ChecklistItem) => {
    const newCompleted = !item.is_completed;
    // Optimistic update
    setChecklistItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, is_completed: newCompleted } : i)
    );
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, is_completed: newCompleted }),
      });
      const data = await res.json();
      if (data.success) {
        setChecklistItems(prev =>
          prev.map(i => i.id === item.id ? data.item : i)
        );
      } else {
        // Revert on failure
        setChecklistItems(prev =>
          prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i)
        );
      }
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      // Revert on failure
      setChecklistItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i)
      );
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    // Optimistic update
    setChecklistItems(prev => prev.filter(i => i.id !== itemId));
    try {
      const res = await fetch(
        `/api/lab-management/lab-days/${labDayId}/checklist?itemId=${itemId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!data.success) {
        // Revert by refetching
        await fetchChecklistItems();
      }
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      await fetchChecklistItems();
    }
  };

  const fetchEquipmentItems = async () => {
    setEquipmentLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`);
      const data = await res.json();
      if (data.success) {
        setEquipmentItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching equipment items:', error);
    }
    setEquipmentLoading(false);
  };

  const handleAddEquipmentItem = async () => {
    if (!newEquipmentName.trim()) return;
    setAddingEquipment(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEquipmentName.trim(),
          quantity: newEquipmentQty,
          station_id: newEquipmentStation || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEquipmentItems(prev => [...prev, data.item]);
        setNewEquipmentName('');
        setNewEquipmentQty(1);
        setNewEquipmentStation('');
      } else {
        alert('Failed to add item: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding equipment item:', error);
      alert('Failed to add equipment item');
    }
    setAddingEquipment(false);
  };

  const handleUpdateEquipmentStatus = async (item: EquipmentItem, newStatus: EquipmentItem['status']) => {
    // Optimistic update
    setEquipmentItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i)
    );
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setEquipmentItems(prev =>
          prev.map(i => i.id === item.id ? data.item : i)
        );
      } else {
        // Revert
        setEquipmentItems(prev =>
          prev.map(i => i.id === item.id ? { ...i, status: item.status } : i)
        );
      }
    } catch (error) {
      console.error('Error updating equipment status:', error);
      setEquipmentItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: item.status } : i)
      );
    }
  };

  const handleDeleteEquipmentItem = async (itemId: string) => {
    // Optimistic update
    setEquipmentItems(prev => prev.filter(i => i.id !== itemId));
    try {
      const res = await fetch(
        `/api/lab-management/lab-days/${labDayId}/equipment?itemId=${itemId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!data.success) {
        await fetchEquipmentItems();
      }
    } catch (error) {
      console.error('Error deleting equipment item:', error);
      await fetchEquipmentItems();
    }
  };

  // ---- Cost tracking helpers ----

  const fetchCostItems = async () => {
    setCostsLoading(true);
    try {
      const res = await fetch(`/api/lab-management/costs?lab_day_id=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        setCostItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching cost items:', error);
    }
    setCostsLoading(false);
  };

  const handleAddCostItem = async () => {
    if (!newCostDescription.trim() || !newCostAmount) return;
    setAddingCost(true);
    try {
      const res = await fetch('/api/lab-management/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          category: newCostCategory,
          description: newCostDescription.trim(),
          amount: parseFloat(newCostAmount) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCostItems(prev => [...prev, data.item]);
        setNewCostDescription('');
        setNewCostAmount('');
        setNewCostCategory('Consumables');
      } else {
        alert('Failed to add cost item: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding cost item:', error);
      alert('Failed to add cost item');
    }
    setAddingCost(false);
  };

  const handleStartEditCost = (item: CostItem) => {
    setEditingCostId(item.id);
    setEditCostForm({
      category: item.category,
      description: item.description,
      amount: item.amount.toString(),
    });
  };

  const handleSaveEditCost = async (itemId: string) => {
    try {
      const res = await fetch(`/api/lab-management/costs/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editCostForm.category,
          description: editCostForm.description,
          amount: parseFloat(editCostForm.amount) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCostItems(prev => prev.map(i => i.id === itemId ? data.item : i));
        setEditingCostId(null);
      } else {
        alert('Failed to update cost item: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating cost item:', error);
      alert('Failed to update cost item');
    }
  };

  const handleDeleteCostItem = async (itemId: string) => {
    // Optimistic update
    setCostItems(prev => prev.filter(i => i.id !== itemId));
    try {
      const res = await fetch(`/api/lab-management/costs/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        await fetchCostItems();
      }
    } catch (error) {
      console.error('Error deleting cost item:', error);
      await fetchCostItems();
    }
  };

  // ---- Debrief helpers ----

  const isLabDayPast = (): boolean => {
    if (!labDay?.date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const labDate = new Date(labDay.date + 'T00:00:00');
    return labDate < today;
  };

  const fetchDebriefs = async () => {
    if (!labDayId) return;
    setDebriefLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/debrief`);
      const data = await res.json();
      if (data.success) {
        setDebriefs(data.debriefs || []);
        const userEmail = session?.user?.email?.toLowerCase();
        const own = (data.debriefs || []).find(
          (d: any) => d.instructor_email?.toLowerCase() === userEmail
        );
        setCurrentUserDebrief(own || null);
        if (own) {
          setDebriefForm({
            rating: own.rating || 0,
            went_well: own.went_well || '',
            to_improve: own.to_improve || '',
            student_concerns: own.student_concerns || '',
            equipment_issues: own.equipment_issues || '',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching debriefs:', error);
    }
    setDebriefLoading(false);
  };

  // Look up skill sheets for each station by name + program
  const lookupSkillSheets = async (stations: any[], program: string) => {
    const results: Record<string, string> = {};
    for (const station of stations) {
      const skillName = station.skill_name || station.scenario?.title || station.custom_title;
      if (!skillName) continue;
      try {
        const res = await fetch(`/api/skill-sheets/by-skill-name?name=${encodeURIComponent(skillName)}&program=${encodeURIComponent(program.toLowerCase())}`);
        const data = await res.json();
        if (data.success && data.sheets && data.sheets.length > 0) {
          results[station.id] = data.sheets[0].id;
        }
      } catch { /* ignore - skill sheets feature may not be available */ }
    }
    setStationSkillSheetIds(results);
  };

  // Fetch evaluation concerns for debrief section
  const fetchEvaluationConcerns = async () => {
    try {
      const res = await fetch(`/api/skill-sheets/evaluations-by-lab-day?lab_day_id=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        setEvaluationConcerns(
          (data.evaluations || []).filter((e: any) => e.flagged_items && e.flagged_items.length > 0)
        );
      }
    } catch { /* ignore - feature may not be available yet */ }
  };

  const handleSubmitDebrief = async () => {
    if (debriefForm.rating < 1) return;
    setSubmittingDebrief(true);
    try {
      const method = editingDebriefId ? 'PUT' : 'POST';
      const url = editingDebriefId
        ? `/api/lab-management/lab-days/${labDayId}/debrief?id=${editingDebriefId}`
        : `/api/lab-management/lab-days/${labDayId}/debrief`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debriefForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditingDebriefId(null);
        await fetchDebriefs();
      } else {
        alert('Failed to submit debrief: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error submitting debrief:', error);
      alert('Failed to submit debrief');
    }
    setSubmittingDebrief(false);
  };

  const startEditingDebrief = (debrief: any) => {
    setEditingDebriefId(debrief.id);
    setDebriefForm({
      rating: debrief.rating || 0,
      went_well: debrief.went_well || '',
      to_improve: debrief.to_improve || '',
      student_concerns: debrief.student_concerns || '',
      equipment_issues: debrief.equipment_issues || '',
    });
  };

  const cancelEditingDebrief = () => {
    setEditingDebriefId(null);
    if (currentUserDebrief) {
      setDebriefForm({
        rating: currentUserDebrief.rating || 0,
        went_well: currentUserDebrief.went_well || '',
        to_improve: currentUserDebrief.to_improve || '',
        student_concerns: currentUserDebrief.student_concerns || '',
        equipment_issues: currentUserDebrief.equipment_issues || '',
      });
    }
  };

  const fetchCohortStudents = async () => {
    if (!labDay?.cohort?.id) return;

    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${labDay.cohort.id}&status=active`);
      const data = await res.json();
      if (data.success) {
        setCohortStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchStudentRatings = async () => {
    if (!labDayId) return;
    setRatingsLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`);
      const data = await res.json();
      if (data.success) {
        setStudentRatings(data.ratings || []);
        // Pre-populate pending notes from existing ratings
        const notes: Record<string, string> = {};
        const currentEmail = session?.user?.email?.toLowerCase();
        (data.ratings || []).forEach((r: StudentRating) => {
          if (r.instructor_email?.toLowerCase() === currentEmail && r.note) {
            notes[r.student_id] = r.note;
          }
        });
        setPendingNotes(notes);
      }
    } catch (error) {
      console.error('Error fetching student ratings:', error);
    }
    setRatingsLoading(false);
  };

  const fetchCurrentUserRole = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  // ---- Skill Sign-off helpers ----

  const fetchSkillsForSignoffs = async () => {
    // Only load if skills haven't been fetched yet
    if (skills.length > 0) return;
    try {
      const res = await fetch('/api/lab-management/skills');
      const data = await res.json();
      if (data.success) {
        setSkills(data.skills || []);
      }
    } catch (error) {
      console.error('Error fetching skills for signoffs:', error);
    }
  };

  const fetchSignoffs = async () => {
    if (!labDayId) return;
    setSignoffLoading(true);
    try {
      const res = await fetch(`/api/lab-management/skill-signoffs?lab_day_id=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        const map: Record<string, { id: string; signed_off_by: string; signed_off_at: string; revoked: boolean }> = {};
        for (const s of data.signoffs || []) {
          // Key by "studentId:skillId"
          map[`${s.student_id}:${s.skill_id}`] = {
            id: s.id,
            signed_off_by: s.signed_off_by,
            signed_off_at: s.signed_off_at,
            revoked: s.revoked,
          };
        }
        setSignoffs(map);
      }
    } catch (error) {
      console.error('Error fetching signoffs:', error);
    }
    setSignoffLoading(false);
  };

  const handleSignoff = async (studentId: string) => {
    if (!signoffSkillId) return;
    const key = `${studentId}:${signoffSkillId}`;

    // Two-click confirmation
    if (!signoffConfirm[key]) {
      setSignoffConfirm(prev => ({ ...prev, [key]: true }));
      // Auto-reset after 4 seconds
      setTimeout(() => setSignoffConfirm(prev => ({ ...prev, [key]: false })), 4000);
      return;
    }

    setSignoffSaving(prev => ({ ...prev, [studentId]: true }));
    setSignoffConfirm(prev => ({ ...prev, [key]: false }));
    try {
      const res = await fetch('/api/lab-management/skill-signoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          skill_id: signoffSkillId,
          lab_day_id: labDayId,
        }),
      });
      const data = await res.json();
      if (data.success && data.signoffs?.length > 0) {
        const s = data.signoffs[0];
        setSignoffs(prev => ({
          ...prev,
          [key]: { id: s.id, signed_off_by: s.signed_off_by, signed_off_at: s.signed_off_at, revoked: s.revoked },
        }));
        toast.success('Skill signed off');
      } else if (data.skipped_count > 0) {
        toast.info('Already signed off');
      } else {
        toast.error(data.error || 'Failed to sign off');
      }
    } catch (error) {
      console.error('Error signing off:', error);
      toast.error('Failed to sign off');
    }
    setSignoffSaving(prev => ({ ...prev, [studentId]: false }));
  };

  const handleBulkSignoff = async () => {
    if (!signoffSkillId || signoffBulkSelected.length === 0) return;

    if (!signoffBulkConfirm) {
      setSignoffBulkConfirm(true);
      setTimeout(() => setSignoffBulkConfirm(false), 4000);
      return;
    }

    setSignoffBulkSaving(true);
    setSignoffBulkConfirm(false);
    try {
      const res = await fetch('/api/lab-management/skill-signoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_ids: signoffBulkSelected,
          skill_id: signoffSkillId,
          lab_day_id: labDayId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const newSignoffs: Record<string, { id: string; signed_off_by: string; signed_off_at: string; revoked: boolean }> = {};
        for (const s of data.signoffs || []) {
          newSignoffs[`${s.student_id}:${s.skill_id}`] = {
            id: s.id,
            signed_off_by: s.signed_off_by,
            signed_off_at: s.signed_off_at,
            revoked: s.revoked,
          };
        }
        setSignoffs(prev => ({ ...prev, ...newSignoffs }));
        setSignoffBulkSelected([]);
        toast.success(`Signed off ${data.signoffs?.length || 0} student${data.signoffs?.length !== 1 ? 's' : ''}`);
      } else {
        toast.error(data.error || 'Failed to bulk sign off');
      }
    } catch (error) {
      console.error('Error bulk signing off:', error);
      toast.error('Failed to bulk sign off');
    }
    setSignoffBulkSaving(false);
  };

  const handleRevokeSignoff = async () => {
    if (!signoffRevokeId) return;
    setSignoffRevoking(true);
    try {
      const res = await fetch('/api/lab-management/skill-signoffs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signoffRevokeId, revoke_reason: signoffRevokeReason || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        const s = data.signoff;
        const key = Object.keys(signoffs).find(k => signoffs[k].id === signoffRevokeId);
        if (key) {
          setSignoffs(prev => ({ ...prev, [key]: { ...prev[key], revoked: true } }));
        }
        setSignoffRevokeId(null);
        setSignoffRevokeReason('');
        toast.success('Sign-off revoked');
      } else {
        toast.error(data.error || 'Failed to revoke');
      }
    } catch (error) {
      console.error('Error revoking signoff:', error);
      toast.error('Failed to revoke');
    }
    setSignoffRevoking(false);
  };

  const handleSaveRating = async (studentId: string, rating: number) => {
    setSavingRating(prev => ({ ...prev, [studentId]: true }));
    // Optimistic update
    const currentEmail = session?.user?.email || '';
    const existingIdx = studentRatings.findIndex(
      r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail.toLowerCase()
    );
    const optimisticRating: StudentRating = {
      id: existingIdx >= 0 ? studentRatings[existingIdx].id : `temp-${studentId}`,
      lab_day_id: labDayId,
      student_id: studentId,
      instructor_email: currentEmail,
      rating,
      note: pendingNotes[studentId] || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setStudentRatings(prev => {
      if (existingIdx >= 0) {
        return prev.map((r, i) => (i === existingIdx ? optimisticRating : r));
      }
      return [...prev, optimisticRating];
    });

    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          rating,
          note: pendingNotes[studentId] || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Replace optimistic with real
        setStudentRatings(prev =>
          prev.map(r =>
            r.student_id === studentId &&
            r.instructor_email?.toLowerCase() === currentEmail.toLowerCase()
              ? data.rating
              : r
          )
        );
        toast.success('Rating saved');
      } else {
        // Revert optimistic update
        await fetchStudentRatings();
        toast.error('Failed to save rating');
      }
    } catch (error) {
      console.error('Error saving rating:', error);
      await fetchStudentRatings();
      toast.error('Failed to save rating');
    }
    setSavingRating(prev => ({ ...prev, [studentId]: false }));
  };

  const handleSaveNote = async (studentId: string) => {
    // Find existing rating for this student from current user
    const currentEmail = session?.user?.email?.toLowerCase();
    const existing = studentRatings.find(
      r => r.student_id === studentId && r.instructor_email?.toLowerCase() === currentEmail
    );
    if (!existing) return; // Must rate before adding note
    setSavingRating(prev => ({ ...prev, [`note-${studentId}`]: true }));
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          rating: existing.rating,
          note: pendingNotes[studentId] || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStudentRatings(prev =>
          prev.map(r =>
            r.student_id === studentId &&
            r.instructor_email?.toLowerCase() === currentEmail
              ? data.rating
              : r
          )
        );
        toast.success('Note saved');
        setExpandedNotes(prev => ({ ...prev, [studentId]: false }));
      } else {
        toast.error('Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    }
    setSavingRating(prev => ({ ...prev, [`note-${studentId}`]: false }));
  };

  const fetchScenarioParticipation = async () => {
    try {
      const res = await fetch(`/api/tracking/scenarios?labDayId=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        setScenarioParticipation(data.participation || []);
      }
    } catch (error) {
      console.error('Error fetching scenario participation:', error);
    }
  };

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
      } else {
        console.error('Failed to fetch lab day:', labDayData.error);
      }

      if (instructorsData.success) {
        setInstructors(instructorsData.instructors || []);
      }

      if (locationsData.success) {
        setLocations(locationsData.locations || []);
      }

      if (rolesData.success) {
        setLabDayRoles(rolesData.roles || []);
      }

      // Fetch station skill documents
      if (labDayData.success && labDayData.labDay?.stations) {
        // Fetch all skills with documents once
        const allSkillsRes = await fetch('/api/lab-management/skills?includeDocuments=true');
        const allSkillsData = await allSkillsRes.json();

        if (allSkillsData.success && allSkillsData.skills) {
          const skillsMap = new Map<string, Skill>();
          allSkillsData.skills.forEach((skill: Skill) => {
            skillsMap.set(skill.id, skill);
          });

          const skillDocsMap: Record<string, SkillDocument[]> = {};

          for (const station of labDayData.labDay.stations) {
            // Only fetch for skills or skill_drill stations
            if (station.station_type === 'skills' || station.station_type === 'skill_drill') {
              try {
                // Fetch station skills
                const stationSkillsRes = await fetch(`/api/lab-management/station-skills?stationId=${station.id}`);
                const stationSkillsData = await stationSkillsRes.json();

                if (stationSkillsData.success && stationSkillsData.stationSkills) {
                  const docs: SkillDocument[] = [];

                  // Collect documents from all linked skills
                  for (const stationSkill of stationSkillsData.stationSkills) {
                    if (stationSkill.skill?.id) {
                      const skill = skillsMap.get(stationSkill.skill.id);
                      if (skill?.documents) {
                        docs.push(...skill.documents);
                      }
                    }
                  }

                  skillDocsMap[station.id] = docs;
                }
              } catch (error) {
                console.error(`Error fetching skill documents for station ${station.id}:`, error);
              }
            }
          }

          setStationSkillDocs(skillDocsMap);
        }

        // Look up skill sheets for station cards
        if (labDayData.labDay.cohort?.program?.abbreviation) {
          lookupSkillSheets(
            labDayData.labDay.stations,
            labDayData.labDay.cohort.program.abbreviation
          );
        }
      }
    } catch (error) {
      console.error('Error fetching lab day:', error);
    }
    setLoading(false);
  };

  const fetchCoverageShifts = async () => {
    setCoverageLoading(true);
    try {
      // We need the lab day date - fetch it from state or wait for lab day to load
      // This will be called after fetchLabDay populates labDay state, or use the URL param
      const labDayRes = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const labDayData = await labDayRes.json();
      const labDate = labDayData?.labDay?.date;
      if (!labDate) {
        setCoverageLoading(false);
        return;
      }

      const res = await fetch(`/api/scheduling/shifts?start_date=${labDate}&end_date=${labDate}&include_filled=true`);
      const data = await res.json();
      if (data.success) {
        setCoverageShifts(
          (data.shifts || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
            signups: (s.signups || []).map((su: any) => ({
              id: su.id,
              status: su.status,
              instructor: su.instructor || null,
            })),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching coverage shifts:', error);
    }
    setCoverageLoading(false);
  };

  const handleQuickAddStation = async () => {
    if (!quickAddTitle.trim()) return;
    setQuickAddSaving(true);
    try {
      const nextNumber = labDay ? Math.max(...labDay.stations.map((s: Station) => s.station_number), 0) + 1 : 1;
      const res = await fetch('/api/lab-management/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          station_number: nextNumber,
          station_type: quickAddType,
          custom_title: quickAddTitle.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast?.addToast('success', 'Station added');
        setShowQuickAddStation(false);
        setQuickAddTitle('');
        setQuickAddType('scenario');
        fetchLabDay(); // Refresh
      } else {
        toast?.addToast('error', data.error || 'Failed to add station');
      }
    } catch (error) {
      console.error('Error adding station:', error);
      toast?.addToast('error', 'Failed to add station');
    }
    setQuickAddSaving(false);
  };

  const handleAcceptSignup = async (shiftId: string, signupId: string) => {
    try {
      const res = await fetch(`/api/scheduling/shifts/${shiftId}/signup/${signupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });
      const data = await res.json();
      if (data.success) {
        toast?.addToast('success', 'Signup confirmed');
        fetchCoverageShifts();
      } else {
        toast?.addToast('error', data.error || 'Failed to confirm signup');
      }
    } catch (error) {
      console.error('Error confirming signup:', error);
      toast?.addToast('error', 'Failed to confirm signup');
    }
  };

  const handleDeclineSignup = async (shiftId: string, signupId: string) => {
    try {
      const res = await fetch(`/api/scheduling/shifts/${shiftId}/signup/${signupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', reason: 'Declined by admin' }),
      });
      const data = await res.json();
      if (data.success) {
        toast?.addToast('success', 'Signup declined');
        fetchCoverageShifts();
      } else {
        toast?.addToast('error', data.error || 'Failed to decline signup');
      }
    } catch (error) {
      console.error('Error declining signup:', error);
      toast?.addToast('error', 'Failed to decline signup');
    }
  };

  const formatDate = (dateString: string) => {
    // Parse date string as local date to avoid timezone issues
    // Adding T12:00:00 ensures the date displays correctly in any timezone
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return null;
    // timeString is in "HH:MM" or "HH:MM:SS" format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStationTitle = (station: Station) => {
    // Prioritize custom_title as it contains the full descriptive name
    if (station.custom_title) return station.custom_title;
    // Fallback to scenario title or skill name
    if (station.scenario) return station.scenario.title;
    if (station.skill_name) return station.skill_name;
    return `Station ${station.station_number}`;
  };

  const handleExportCalendar = () => {
    if (!labDay) return;

    const dateStr = labDay.date;
    const startDate = parseLocalDate(dateStr, labDay.start_time, 8);
    const endDate = parseLocalDate(dateStr, labDay.end_time, 17);

    const cohortName = `${labDay.cohort.program.abbreviation} Group ${labDay.cohort.cohort_number}`;
    const stationList = labDay.stations
      .map((s: Station) => getStationTitle(s))
      .join(', ');

    const titlePart = labDay.title || `Lab Day ${dateStr}`;
    const descriptionParts = [`Cohort: ${cohortName}`];
    if (stationList) {
      descriptionParts.push(`Stations: ${stationList}`);
    }
    if (labDayRoles.length > 0) {
      const roleLines = labDayRoles.map(r => {
        const name = r.instructor?.name || r.instructor?.email || 'TBD';
        const roleLabel =
          r.role === 'lab_lead' ? 'Lab Lead' : r.role === 'roamer' ? 'Roamer' : 'Observer';
        return `${roleLabel}: ${name}`;
      });
      descriptionParts.push(...roleLines);
    }
    if (labDay.notes) {
      descriptionParts.push(`Notes: ${labDay.notes}`);
    }

    downloadICS(
      [
        {
          uid: `labday-${labDay.id}@pmi-scheduler`,
          title: `Lab Day - ${titlePart}`,
          description: descriptionParts.join('\n'),
          location: 'PMI Campus',
          startDate,
          endDate,
        },
      ],
      `lab-day-${dateStr}.ics`
    );
  };

  const handlePrint = () => {
    if (!labDay) return;

    const cohortName = `${labDay.cohort.program.abbreviation} Group ${labDay.cohort.cohort_number}`;
    const dateStr = formatDate(labDay.date);
    const timeStr = labDay.start_time
      ? `${formatTime(labDay.start_time)}${labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}`
      : '';

    let html = printHeader(
      labDay.title || 'Lab Day Schedule',
      `${cohortName} — ${dateStr}${timeStr ? ` — ${timeStr}` : ''}`
    );

    // Week/Day info
    if (labDay.week_number && labDay.day_number) {
      html += `<div style="font-size: 13px; color: #444; margin-bottom: 12px;">Week ${labDay.week_number}, Day ${labDay.day_number} &bull; ${labDay.num_rotations} rotations &times; ${labDay.rotation_duration} min</div>`;
    } else {
      html += `<div style="font-size: 13px; color: #444; margin-bottom: 12px;">${labDay.num_rotations} rotations &times; ${labDay.rotation_duration} min</div>`;
    }

    // Lab Day Roles
    if (labDayRoles.length > 0) {
      const leads = labDayRoles.filter(r => r.role === 'lab_lead').map(r => r.instructor?.name || 'Unknown');
      const roamers = labDayRoles.filter(r => r.role === 'roamer').map(r => r.instructor?.name || 'Unknown');
      const observers = labDayRoles.filter(r => r.role === 'observer').map(r => r.instructor?.name || 'Unknown');
      html += '<div class="section" style="font-size: 12px;">';
      if (leads.length > 0) html += `<strong>Lab Lead${leads.length > 1 ? 's' : ''}:</strong> ${leads.map(n => escapeHtml(n)).join(', ')} &nbsp; `;
      if (roamers.length > 0) html += `<strong>Roamer${roamers.length > 1 ? 's' : ''}:</strong> ${roamers.map(n => escapeHtml(n)).join(', ')} &nbsp; `;
      if (observers.length > 0) html += `<strong>Observer${observers.length > 1 ? 's' : ''}:</strong> ${observers.map(n => escapeHtml(n)).join(', ')}`;
      html += '</div>';
    }

    // Stations table
    if (labDay.stations.length > 0) {
      html += '<h2>Stations</h2>';
      html += '<table><thead><tr><th>#</th><th>Type</th><th>Station / Scenario</th><th>Instructor</th><th>Room</th></tr></thead><tbody>';
      labDay.stations.forEach((station: Station) => {
        const stationTitle = station.custom_title || station.scenario?.title || station.skill_name || `Station ${station.station_number}`;
        html += `<tr>
          <td>${station.station_number}</td>
          <td style="text-transform: capitalize; font-size: 11px;">${escapeHtml(station.station_type.replace('_', ' '))}</td>
          <td><strong>${escapeHtml(stationTitle)}</strong>${station.station_notes ? `<br/><span style="font-size: 11px; color: #666;">${escapeHtml(station.station_notes)}</span>` : ''}</td>
          <td>${station.instructor_name ? escapeHtml(station.instructor_name) : '<em style="color: #999;">TBD</em>'}</td>
          <td>${escapeHtml(station.room || '')}</td>
        </tr>`;
      });
      html += '</tbody></table>';
    }

    // Rotation schedule
    if (labDay.start_time && labDay.rotation_duration > 0 && labDay.num_rotations > 0) {
      html += '<h2>Rotation Schedule</h2>';
      html += '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 12px;">';
      const startParts = labDay.start_time.split(':');
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
      for (let i = 0; i < labDay.num_rotations; i++) {
        const rotStart = startMinutes + (i * labDay.rotation_duration);
        const rotEnd = rotStart + labDay.rotation_duration;
        const fmtTime = (mins: number) => {
          const h = Math.floor(mins / 60) % 12 || 12;
          const m = String(mins % 60).padStart(2, '0');
          const ampm = Math.floor(mins / 60) >= 12 ? 'PM' : 'AM';
          return `${h}:${m} ${ampm}`;
        };
        html += `<div style="border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px;"><strong>R${i + 1}:</strong> ${fmtTime(rotStart)} - ${fmtTime(rotEnd)}</div>`;
      }
      html += '</div>';
    }

    // Checklist
    if (checklistItems.length > 0) {
      html += '<h2>Prep Checklist (' + checklistItems.filter(i => i.is_completed).length + '/' + checklistItems.length + ')</h2>';
      html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; font-size: 12px;">';
      checklistItems.forEach(item => {
        const icon = item.is_completed
          ? '<span class="checkbox-checked"></span>'
          : '<span class="checkbox"></span>';
        html += `<div>${icon} <span${item.is_completed ? ' style="text-decoration: line-through; color: #888;"' : ''}>${escapeHtml(item.title)}</span></div>`;
      });
      html += '</div>';
    }

    // Notes
    if (labDay.notes) {
      html += '<h2>Notes</h2>';
      html += `<p style="font-size: 12px;">${escapeHtml(labDay.notes)}</p>`;
    }

    // Student roster
    if (cohortStudents.length > 0) {
      html += `<h2>Student Roster (${cohortStudents.length})</h2>`;
      html += '<div class="three-col" style="font-size: 12px;">';
      const sorted = [...cohortStudents].sort((a, b) => a.last_name.localeCompare(b.last_name));
      sorted.forEach((student, idx) => {
        html += `<div>${idx + 1}. ${escapeHtml(student.last_name)}, ${escapeHtml(student.first_name)}</div>`;
      });
      html += '</div>';
    }

    html += printFooter();
    openPrintWindow(`Lab Day - ${cohortName} - ${labDay.date}`, html);
  };

  const handlePrintRoster = () => {
    if (!labDay) return;

    const cohortName = `${labDay.cohort.program.abbreviation} Group ${labDay.cohort.cohort_number}`;
    let html = printHeader('Lab Day Roster', `${cohortName} — ${formatDate(labDay.date)}`);

    html += '<div class="two-col" style="margin-bottom: 12px; font-size: 12px;">';
    html += `<div><strong>Date:</strong> ${escapeHtml(formatDate(labDay.date))}<br/><strong>Cohort:</strong> ${escapeHtml(cohortName)}`;
    if (labDay.title) html += `<br/><strong>Lab:</strong> ${escapeHtml(labDay.title)}`;
    html += '</div>';
    html += '<div>';
    if (labDay.start_time) {
      html += `<strong>Time:</strong> ${formatTime(labDay.start_time)}${labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}<br/>`;
    }
    if (labDay.week_number && labDay.day_number) {
      html += `<strong>Week ${labDay.week_number}, Day ${labDay.day_number}</strong><br/>`;
    }
    html += `<strong>Rotations:</strong> ${labDay.num_rotations} x ${labDay.rotation_duration} min`;
    html += '</div></div>';

    // Roles
    if (labDayRoles.length > 0) {
      html += '<h2>Lab Day Roles</h2><div style="font-size: 12px; margin-bottom: 8px;">';
      const leads = labDayRoles.filter(r => r.role === 'lab_lead');
      const roamers = labDayRoles.filter(r => r.role === 'roamer');
      const observers = labDayRoles.filter(r => r.role === 'observer');
      if (leads.length > 0) html += `<strong>Lab Lead${leads.length > 1 ? 's' : ''}:</strong> ${leads.map(r => escapeHtml(r.instructor?.name || 'Unknown')).join(', ')} &nbsp; `;
      if (roamers.length > 0) html += `<strong>Roamer${roamers.length > 1 ? 's' : ''}:</strong> ${roamers.map(r => escapeHtml(r.instructor?.name || 'Unknown')).join(', ')} &nbsp; `;
      if (observers.length > 0) html += `<strong>Observer${observers.length > 1 ? 's' : ''}:</strong> ${observers.map(r => escapeHtml(r.instructor?.name || 'Unknown')).join(', ')}`;
      html += '</div>';
    }

    // Stations
    if (labDay.stations.length > 0) {
      html += '<h2>Stations & Instructors</h2>';
      html += '<table><thead><tr><th>Stn</th><th>Station</th><th>Instructor</th><th>Room</th></tr></thead><tbody>';
      labDay.stations.forEach((station: Station) => {
        const title = station.custom_title || station.scenario?.title || station.skill_name || `Station ${station.station_number}`;
        html += `<tr><td>${station.station_number}</td><td>${escapeHtml(title)}</td>`;
        html += `<td>${station.instructor_name ? escapeHtml(station.instructor_name) : '<em style="color:#999">TBD</em>'}</td>`;
        html += `<td>${escapeHtml(station.room || '')}</td></tr>`;
      });
      html += '</tbody></table>';
    }

    // Students
    html += `<h2>Enrolled Students (${cohortStudents.length})</h2>`;
    if (cohortStudents.length === 0) {
      html += '<p style="font-size: 12px; color: #999; font-style: italic;">No students found for this cohort.</p>';
    } else {
      html += '<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Agency</th></tr></thead><tbody>';
      const sorted = [...cohortStudents].sort((a, b) => a.last_name.localeCompare(b.last_name));
      sorted.forEach((student, idx) => {
        html += `<tr><td>${idx + 1}</td><td><strong>${escapeHtml(student.last_name)}, ${escapeHtml(student.first_name)}</strong></td>`;
        html += `<td>${escapeHtml(student.email || '')}</td><td>${escapeHtml(student.agency || '')}</td></tr>`;
      });
      html += '</tbody></table>';
    }

    html += printFooter();
    openPrintWindow(`Roster - ${cohortName} - ${labDay.date}`, html);
  };

  const handleCSVExport = async () => {
    if (!labDay) return;
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/roster?format=csv`);
      if (!res.ok) {
        toast.error('Failed to export roster CSV');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `labday-roster-${labDay.date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export roster CSV');
    }
  };

  const handleDownloadPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('lab-day-printable');

    if (!element) {
      alert('Could not find printable content');
      return;
    }

    // Temporarily show print-only elements and hide screen-only elements
    const printHiddenElements = element.querySelectorAll('.print\\:hidden');
    const printBlockElements = element.querySelectorAll('.print\\:block');

    printHiddenElements.forEach(el => (el as HTMLElement).style.display = 'none');
    printBlockElements.forEach(el => (el as HTMLElement).style.display = 'block');

    const cohortName = `${labDay?.cohort.program.abbreviation}-G${labDay?.cohort.cohort_number}`;
    const dateStr = labDay?.date || new Date().toISOString().split('T')[0];

    const options = {
      margin: 0.5,
      filename: `lab-day-${cohortName}-${dateStr}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in' as const, format: 'letter', orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(options).from(element).save();
    } finally {
      // Restore visibility
      printHiddenElements.forEach(el => (el as HTMLElement).style.display = '');
      printBlockElements.forEach(el => (el as HTMLElement).style.display = '');
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateDate) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: duplicateDate })
      });
      const data = await res.json();
      if (data.success && data.newLabDayId) {
        setShowDuplicateModal(false);
        router.push(`/lab-management/schedule/${data.newLabDayId}/edit`);
      } else {
        alert('Failed to duplicate: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error duplicating lab day:', error);
      alert('An error occurred while duplicating the lab day.');
    }
    setDuplicating(false);
  };

  const getNextWeekDate = (): string => {
    if (!labDay?.date) return '';
    const d = new Date(labDay.date + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const handleCopyToNextWeek = async () => {
    const nextDate = getNextWeekDate();
    if (!nextDate) return;
    setCopyingNextWeek(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: nextDate })
      });
      const data = await res.json();
      if (data.success && data.newLabDayId) {
        setShowNextWeekConfirm(false);
        setCopySuccessToast(true);
        setTimeout(() => setCopySuccessToast(false), 3000);
        router.push(`/lab-management/schedule/${data.newLabDayId}/edit`);
      } else {
        alert('Failed to copy: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error copying lab day to next week:', error);
      alert('An error occurred while copying the lab day.');
    }
    setCopyingNextWeek(false);
  };

  // ---- Bulk duplicate helpers ----

  const openBulkDuplicateModal = () => {
    setBulkSelectedDates([]);
    // Initialize calendar to the month after the lab day's date (or current month if no date)
    const baseDate = labDay?.date
      ? new Date(labDay.date + 'T12:00:00')
      : new Date();
    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    setBulkCalendarMonth(nextMonth);
    setBulkDuplicateProgress({ status: 'idle', total: 0, current: 0, createdIds: [], failed: [] });
    setShowDuplicateDropdown(false);
    setShowBulkDuplicateModal(true);
  };

  const toggleBulkDate = (dateStr: string) => {
    setBulkSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      }
      if (prev.length >= 10) return prev; // max 10
      return [...prev, dateStr].sort();
    });
  };

  const removeBulkDate = (dateStr: string) => {
    setBulkSelectedDates(prev => prev.filter(d => d !== dateStr));
  };

  const bulkQuickSelectSameDayNextWeeks = () => {
    if (!labDay?.date) return;
    const base = new Date(labDay.date + 'T12:00:00');
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const dates: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * 7);
      if (d >= todayMidnight) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    setBulkSelectedDates(prev => {
      const combined = [...new Set([...prev, ...dates])].sort().slice(0, 10);
      return combined;
    });
  };

  const bulkQuickSelectEveryWeekdayInMonth = () => {
    if (!labDay?.date) return;
    const base = new Date(labDay.date + 'T12:00:00');
    const targetDay = base.getDay(); // 0=Sun, 1=Mon...
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const year = bulkCalendarMonth.getFullYear();
    const month = bulkCalendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dates: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d.getDay() === targetDay && d >= todayMidnight) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    setBulkSelectedDates(prev => {
      const combined = [...new Set([...prev, ...dates])].sort().slice(0, 10);
      return combined;
    });
  };

  const handleBulkDuplicate = async () => {
    if (bulkSelectedDates.length === 0) return;
    setBulkDuplicating(true);
    setBulkDuplicateProgress({
      status: 'running',
      total: bulkSelectedDates.length,
      current: 0,
      createdIds: [],
      failed: [],
    });

    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/duplicate-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: bulkSelectedDates }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkDuplicateProgress({
          status: 'done',
          total: bulkSelectedDates.length,
          current: bulkSelectedDates.length,
          createdIds: data.created || [],
          failed: data.failed || [],
        });
        if ((data.created || []).length > 0) {
          toast.success(`Created ${data.created.length} lab day${data.created.length === 1 ? '' : 's'} successfully`);
        }
        if ((data.failed || []).length > 0) {
          toast.error(`${data.failed.length} date(s) failed to create`);
        }
      } else {
        setBulkDuplicateProgress(prev => ({ ...prev, status: 'done' }));
        toast.error('Failed to duplicate lab days: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error bulk duplicating lab days:', error);
      setBulkDuplicateProgress(prev => ({ ...prev, status: 'done' }));
      toast.error('An error occurred while duplicating lab days');
    }
    setBulkDuplicating(false);
  };

  // Calendar helpers for bulk duplicate modal
  const getBulkCalendarDays = (): Array<{ date: Date | null; dateStr: string | null }> => {
    const year = bulkCalendarMonth.getFullYear();
    const month = bulkCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ date: Date | null; dateStr: string | null }> = [];
    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      cells.push({ date: null, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, dateStr });
    }
    return cells;
  };

  const isBulkDatePast = (date: Date): boolean => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return date < todayMidnight;
  };

  const isBulkDateToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const formatBulkDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getWeekdayName = (): string => {
    if (!labDay?.date) return 'weekday';
    const d = new Date(labDay.date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const handleEnableCheckIn = async () => {
    setCheckInLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checkin-token`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setLabDay(prev => prev ? {
          ...prev,
          checkin_token: data.checkin_token,
          checkin_enabled: true,
        } : prev);
      } else {
        alert('Failed to enable check-in: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error enabling check-in:', error);
      alert('An error occurred while enabling check-in.');
    }
    setCheckInLoading(false);
  };

  const handleDisableCheckIn = async () => {
    setCheckInLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checkin-token`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setLabDay(prev => prev ? { ...prev, checkin_enabled: false } : prev);
      } else {
        alert('Failed to disable check-in: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error disabling check-in:', error);
      alert('An error occurred while disabling check-in.');
    }
    setCheckInLoading(false);
  };

  const handleCopyCheckInLink = async () => {
    if (!labDay?.checkin_token) return;
    const url = `${window.location.origin}/checkin/${labDay.checkin_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyLinkSuccess(true);
      setTimeout(() => setCopyLinkSuccess(false), 2500);
    } catch {
      // Fallback: show the URL in an alert
      alert('Check-in URL: ' + url);
    }
  };

  const fetchScenariosAndSkills = async () => {
    try {
      const [scenariosRes, skillsRes] = await Promise.all([
        fetch('/api/lab-management/scenarios'),
        fetch('/api/lab-management/skills?includeDocuments=true')
      ]);
      const scenariosData = await scenariosRes.json();
      const skillsData = await skillsRes.json();
      if (scenariosData.success) {
        setScenarios(scenariosData.scenarios || []);
      }
      if (skillsData.success) {
        setSkills(skillsData.skills || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios/skills:', error);
    }
  };

  const openEditModal = async (station: Station) => {
    setEditingStation(station);

    // Always fetch scenarios and skills FIRST to ensure they're available for rendering
    // This fixes a race condition where skills would appear empty in the edit form
    await fetchScenariosAndSkills();

    // Fetch station skills and custom skills if it's a skills station
    let stationSkillIds: string[] = [];
    let customSkillsList: string[] = [];

    if (station.station_type === 'skills' || station.station_type === 'skill_drill') {
      try {
        // Fetch library skills from station-skills endpoint
        const res = await fetch(`/api/lab-management/station-skills?stationId=${station.id}`);
        const data = await res.json();
        if (data.success && data.stationSkills) {
          stationSkillIds = data.stationSkills.map((ss: any) => ss.skill?.id || ss.skill_id).filter(Boolean);
        }

        // Fetch custom skills
        const customRes = await fetch(`/api/lab-management/custom-skills?stationId=${station.id}`);
        const customData = await customRes.json();
        if (customData.success && customData.customSkills) {
          customSkillsList = customData.customSkills.map((cs: any) => cs.name);
        }
      } catch (error) {
        console.error('Error fetching station skills:', error);
      }
    }

    setEditForm({
      station_type: station.station_type || 'scenario',
      scenario_id: station.scenario?.id || '',
      selectedSkills: stationSkillIds,
      selectedDrillIds: Array.isArray(station.drill_ids) ? station.drill_ids : [],
      custom_title: station.custom_title || '',
      skill_sheet_url: station.skill_sheet_url || '',
      instructions_url: station.instructions_url || '',
      station_notes: station.station_notes || '',
      instructor_name: station.instructor_name || '',
      instructor_email: station.instructor_email || '',
      room: station.room || '',
      notes: station.notes || ''
    });

    setEditCustomSkills(customSkillsList);

    // Fetch drill data for S3 skill_drill stations
    setEditDrillData(null); // Reset
    if (station.station_type === 'skill_drill') {
      // First try: use the station's own metadata if it has S3 drill data
      if (station.metadata?.objectives || station.metadata?.instructor_guide) {
        setEditDrillData(station.metadata as Record<string, unknown>);
      }

      // Fetch available skill drills for the picker
      try {
        const drillsRes = await fetch('/api/lab-management/skill-drills');
        const drillsData = await drillsRes.json();
        if (drillsData.success) {
          setEditSkillDrills(drillsData.drills || []);
        }
      } catch (error) {
        console.error('Error fetching skill drills:', error);
      }
    }

    // Fetch station instructors
    try {
      const instructorsRes = await fetch(`/api/lab-management/station-instructors?stationId=${station.id}`);
      const instructorsData = await instructorsRes.json();
      if (instructorsData.success && instructorsData.instructors) {
        setStationInstructors(instructorsData.instructors);
      } else {
        // Fallback to primary instructor from station
        if (station.instructor_name && station.instructor_email) {
          setStationInstructors([{
            user_email: station.instructor_email,
            user_name: station.instructor_name,
            is_primary: true
          }]);
        } else {
          setStationInstructors([]);
        }
      }
    } catch (error) {
      console.error('Error fetching station instructors:', error);
      // Fallback to primary instructor
      if (station.instructor_name && station.instructor_email) {
        setStationInstructors([{
          user_email: station.instructor_email,
          user_name: station.instructor_name,
          is_primary: true
        }]);
      } else {
        setStationInstructors([]);
      }
    }

    // Set selectedInstructor based on existing instructor data
    if (station.instructor_name && station.instructor_email) {
      const matchingInstructor = instructors.find(
        (i) => i.name === station.instructor_name && i.email === station.instructor_email
      );
      if (matchingInstructor) {
        setSelectedInstructor(`${matchingInstructor.name}|${matchingInstructor.email}`);
        setIsCustomInstructor(false);
      } else {
        // Custom instructor not in the list
        setSelectedInstructor('custom');
        setIsCustomInstructor(true);
      }
    } else if (station.instructor_name) {
      // Only has name, no email
      setSelectedInstructor('custom');
      setIsCustomInstructor(true);
    } else {
      setSelectedInstructor('');
      setIsCustomInstructor(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setEditForm(prev => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skillId)
        ? prev.selectedSkills.filter(id => id !== skillId)
        : [...prev.selectedSkills, skillId]
    }));
  };

  const assignSelf = () => {
    setEditForm(prev => ({
      ...prev,
      instructor_name: session?.user?.name || '',
      instructor_email: session?.user?.email || ''
    }));
    setSelectedInstructor(`${session?.user?.name}|${session?.user?.email}`);
    setIsCustomInstructor(false);
  };

  const handleInstructorChange = (value: string) => {
    setSelectedInstructor(value);

    if (value === 'custom') {
      setIsCustomInstructor(true);
      setEditForm(prev => ({
        ...prev,
        instructor_name: '',
        instructor_email: ''
      }));
    } else if (value === '') {
      setIsCustomInstructor(false);
      setEditForm(prev => ({
        ...prev,
        instructor_name: '',
        instructor_email: ''
      }));
    } else {
      setIsCustomInstructor(false);
      const [name, email] = value.split('|');
      setEditForm(prev => ({
        ...prev,
        instructor_name: name,
        instructor_email: email
      }));
    }
  };

  // Add instructor to station
  const addStationInstructor = async (name: string, email: string, isPrimary: boolean = false) => {
    if (!editingStation || !email.trim()) return;

    // Add to local state immediately for responsiveness
    const newInstructor = { user_email: email.trim(), user_name: name.trim() || email.split('@')[0], is_primary: isPrimary };

    // If setting as primary, unset existing primaries
    if (isPrimary) {
      setStationInstructors(prev => prev.map(i => ({ ...i, is_primary: false })));
    }

    // Check if already exists
    if (stationInstructors.some(i => i.user_email === email.trim())) {
      return;
    }

    setStationInstructors(prev => [...prev, newInstructor]);

    // Clear the form fields
    setEditForm(prev => ({ ...prev, instructor_name: '', instructor_email: '' }));
    setSelectedInstructor('');
    setIsCustomInstructor(false);
  };

  // Remove instructor from station
  const removeStationInstructor = (email: string) => {
    setStationInstructors(prev => prev.filter(i => i.user_email !== email));
  };

  // Set instructor as primary
  const setPrimaryInstructor = (email: string) => {
    setStationInstructors(prev => prev.map(i => ({
      ...i,
      is_primary: i.user_email === email
    })));
  };

  const addEditCustomSkill = () => {
    setEditCustomSkills([...editCustomSkills, '']);
  };

  const updateEditCustomSkill = (index: number, value: string) => {
    const updated = [...editCustomSkills];
    updated[index] = value;
    setEditCustomSkills(updated);
  };

  const removeEditCustomSkill = (index: number) => {
    setEditCustomSkills(editCustomSkills.filter((_, i) => i !== index));
  };

  // Group skills by category for the modal with certification level filter
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = !skillSearch ||
      skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
      skill.category.toLowerCase().includes(skillSearch.toLowerCase());
    const matchesLevel = !certLevelFilter || skill.certification_levels?.includes(certLevelFilter);
    return matchesSearch && matchesLevel;
  });

  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const closeEditModal = () => {
    setEditingStation(null);
  };

  const handleSaveStation = async () => {
    if (!editingStation) return;

    setSavingStation(true);
    try {
      // Auto-add selected instructor if user forgot to click (+)
      let workingInstructors = [...stationInstructors];
      if (selectedInstructor && selectedInstructor !== 'custom') {
        const [name, email] = selectedInstructor.split('|');
        if (!workingInstructors.some(i => i.user_email === email)) {
          workingInstructors.push({
            user_name: name,
            user_email: email,
            is_primary: workingInstructors.length === 0
          });
        }
      }
      // Also handle custom instructor fields
      if (isCustomInstructor && editForm.instructor_email && !workingInstructors.some(i => i.user_email === editForm.instructor_email)) {
        workingInstructors.push({
          user_name: editForm.instructor_name || editForm.instructor_email,
          user_email: editForm.instructor_email,
          is_primary: workingInstructors.length === 0
        });
      }

      // Get primary instructor for backwards compatibility
      const primaryInstructor = workingInstructors.find(i => i.is_primary) || workingInstructors[0];

      // Update station basic info
      const res = await fetch(`/api/lab-management/stations/${editingStation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_type: editForm.station_type,
          scenario_id: editForm.station_type === 'scenario' ? (editForm.scenario_id || null) : null,
          drill_ids: editForm.station_type === 'skill_drill' && editForm.selectedDrillIds.length > 0 ? editForm.selectedDrillIds : null,
          custom_title: editForm.custom_title || null,
          skill_sheet_url: editForm.skill_sheet_url || null,
          instructions_url: editForm.instructions_url || null,
          station_notes: editForm.station_notes || null,
          instructor_name: primaryInstructor?.user_name || null,
          instructor_email: primaryInstructor?.user_email || null,
          room: editForm.room || null,
          notes: editForm.notes || null
        })
      });

      const data = await res.json();
      if (!data.success) {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
        setSavingStation(false);
        return;
      }

      // If skills or skill_drill station, update skill links and custom skills
      if (editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') {
        // Delete existing skill links
        await fetch(`/api/lab-management/station-skills?stationId=${editingStation.id}`, {
          method: 'DELETE'
        });

        // Add new skill links
        for (const skillId of editForm.selectedSkills) {
          await fetch('/api/lab-management/station-skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              station_id: editingStation.id,
              skill_id: skillId
            })
          });
        }

        // Delete existing custom skills
        const customSkillsRes = await fetch(`/api/lab-management/custom-skills?stationId=${editingStation.id}`);
        const customSkillsData = await customSkillsRes.json();
        if (customSkillsData.success && customSkillsData.customSkills) {
          for (const customSkill of customSkillsData.customSkills) {
            await fetch(`/api/lab-management/custom-skills?id=${customSkill.id}`, {
              method: 'DELETE'
            });
          }
        }

        // Add new custom skills
        for (const customSkill of editCustomSkills) {
          if (customSkill.trim()) {
            await fetch('/api/lab-management/custom-skills', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                station_id: editingStation.id,
                name: customSkill.trim()
              })
            });
          }
        }
      }

      // Save station instructors
      // First, get existing instructors to compare
      const existingRes = await fetch(`/api/lab-management/station-instructors?stationId=${editingStation.id}`);
      const existingData = await existingRes.json();
      const existingEmails = existingData.success ? existingData.instructors.map((i: any) => i.user_email) : [];

      // Remove instructors that are no longer in the list
      for (const email of existingEmails) {
        if (!workingInstructors.some(i => i.user_email === email)) {
          await fetch(`/api/lab-management/station-instructors?stationId=${editingStation.id}&userEmail=${encodeURIComponent(email)}`, {
            method: 'DELETE'
          });
        }
      }

      // Add or update instructors
      for (const instructor of workingInstructors) {
        await fetch('/api/lab-management/station-instructors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stationId: editingStation.id,
            userEmail: instructor.user_email,
            userName: instructor.user_name,
            isPrimary: instructor.is_primary
          })
        });
      }

      closeEditModal();
      fetchLabDay(); // Refresh the data
    } catch (error) {
      console.error('Error saving station:', error);
      alert('Failed to save station');
    }
    setSavingStation(false);
  };

  const handleDeleteStation = async () => {
    if (!editingStation) return;
    if (!confirm('Are you sure you want to delete this station? This cannot be undone.')) return;

    setDeletingStation(true);
    try {
      const res = await fetch(`/api/lab-management/stations/${editingStation.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        closeEditModal();
        fetchLabDay(); // Refresh the data
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting station:', error);
      alert('Failed to delete station');
    }
    setDeletingStation(false);
  };

  const openRoleModal = (station: Station) => {
    if (!station.scenario) return;

    setRoleModalStation(station);
    setShowRoleModal(true);

    // Pre-fill existing role assignments for this scenario on this lab day
    const existingRoles = scenarioParticipation.filter(
      sp => sp.scenario_id === station.scenario?.id && sp.lab_day_id === labDayId
    );

    const prefilledRoles: Record<string, string> = {
      team_lead: '',
      med_tech: '',
      monitor_tech: '',
      airway_tech: '',
      observer: ''
    };

    existingRoles.forEach(sp => {
      if (sp.role && sp.student_id) {
        prefilledRoles[sp.role] = sp.student_id;
      }
    });

    setRoleAssignments(prefilledRoles);
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setRoleModalStation(null);
    setRoleAssignments({
      team_lead: '',
      med_tech: '',
      monitor_tech: '',
      airway_tech: '',
      observer: ''
    });
  };

  const handleSaveRoles = async () => {
    if (!roleModalStation?.scenario || !labDay) return;

    setSavingRoles(true);
    try {
      const rolesToLog = Object.entries(roleAssignments).filter(([_, studentId]) => studentId);

      for (const [role, studentId] of rolesToLog) {
        await fetch('/api/tracking/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: studentId,
            scenario_id: roleModalStation.scenario.id,
            scenario_name: roleModalStation.scenario.title,
            role: role,
            lab_day_id: labDayId,
            date: labDay.date
          })
        });
      }

      // Refresh participation data
      await fetchScenarioParticipation();
      closeRoleModal();

      // Show success message
      alert(`Successfully logged ${rolesToLog.length} role assignment(s)`);
    } catch (error) {
      console.error('Error saving roles:', error);
      alert('Failed to save roles');
    }
    setSavingRoles(false);
  };

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
          <Link
            href="/lab-management/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="lab-day-printable" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 print:bg-white">
      {/* Print CSS */}
      <style>{`
        @media print {
          @page { margin: 0.5in; size: letter portrait; }
          nav, aside, header, footer,
          [data-radix-popper-content-wrapper],
          [role="dialog"],
          .toast-container { display: none !important; }
          html, body { background: white !important; color: black !important; font-size: 10pt !important; }
          * { box-shadow: none !important; text-shadow: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>

      {/* Success Toast */}
      {justGraded && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden">
          <Check className="w-5 h-5" />
          <span>Assessment saved successfully!</span>
        </div>
      )}

      {/* Copy to Next Week Toast */}
      {copySuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden">
          <Check className="w-5 h-5" />
          <span>Lab day copied to next week!</span>
        </div>
      )}

      {/* Print Header - Only visible when printing non-roster view */}
      <div className={`hidden mb-4 p-4 border-b-2 border-gray-800${showRosterPrint ? '' : ' print:block'}`}>
        <h1 className="text-2xl font-bold text-center">LAB DAY SCHEDULE</h1>
        <div className="mt-2 flex justify-between text-sm">
          <div>
            <p><strong>Cohort:</strong> {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}</p>
            <p><strong>Date:</strong> {formatDate(labDay.date)}</p>
            {(labDay.start_time || labDay.end_time) && (
              <p><strong>Time:</strong> {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}</p>
            )}
          </div>
          <div className="text-right">
            {labDay.title && (
              <p className="font-semibold text-base">{labDay.title}</p>
            )}
            {labDay.week_number && labDay.day_number && (
              <p><strong>Week {labDay.week_number}, Day {labDay.day_number}</strong></p>
            )}
            <p>{labDay.num_rotations} rotations × {labDay.rotation_duration} min</p>
          </div>
        </div>
        {labDayRoles.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-400 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {labDayRoles.filter(r => r.role === 'lab_lead').length > 0 && (
              <span>
                <strong>Lab Lead{labDayRoles.filter(r => r.role === 'lab_lead').length > 1 ? 's' : ''}:</strong>{' '}
                {labDayRoles.filter(r => r.role === 'lab_lead').map(r => r.instructor?.name || 'Unknown').join(', ')}
              </span>
            )}
            {labDayRoles.filter(r => r.role === 'roamer').length > 0 && (
              <span>
                <strong>Roamer{labDayRoles.filter(r => r.role === 'roamer').length > 1 ? 's' : ''}:</strong>{' '}
                {labDayRoles.filter(r => r.role === 'roamer').map(r => r.instructor?.name || 'Unknown').join(', ')}
              </span>
            )}
            {labDayRoles.filter(r => r.role === 'observer').length > 0 && (
              <span>
                <strong>Observer{labDayRoles.filter(r => r.role === 'observer').length > 1 ? 's' : ''}:</strong>{' '}
                {labDayRoles.filter(r => r.role === 'observer').map(r => r.instructor?.name || 'Unknown').join(', ')}
              </span>
            )}
          </div>
        )}

        {/* Print: Stations Table */}
        {labDay.stations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Stations</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-400">
                  <th className="text-left py-1 pr-2 font-semibold text-gray-600 w-8">#</th>
                  <th className="text-left py-1 pr-2 font-semibold text-gray-600">Type</th>
                  <th className="text-left py-1 pr-2 font-semibold text-gray-600">Station / Scenario</th>
                  <th className="text-left py-1 pr-2 font-semibold text-gray-600">Instructor</th>
                  <th className="text-left py-1 font-semibold text-gray-600">Room</th>
                </tr>
              </thead>
              <tbody>
                {labDay.stations.map((station: Station) => (
                  <tr key={station.id} className="border-b border-gray-200">
                    <td className="py-1.5 pr-2 text-gray-500">{station.station_number}</td>
                    <td className="py-1.5 pr-2 capitalize text-gray-600 text-xs">{station.station_type.replace('_', ' ')}</td>
                    <td className="py-1.5 pr-2">
                      <span className="font-medium text-gray-900">
                        {station.custom_title || station.scenario?.title || station.skill_name || `Station ${station.station_number}`}
                      </span>
                      {station.station_notes && (
                        <p className="text-xs text-gray-500 mt-0.5">{station.station_notes}</p>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-gray-700">
                      {station.instructor_name || <span className="text-gray-300 italic">TBD</span>}
                    </td>
                    <td className="py-1.5 text-gray-700">{station.room || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print: Rotation Schedule */}
        {labDay.start_time && labDay.rotation_duration > 0 && labDay.num_rotations > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Rotation Schedule</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {Array.from({ length: labDay.num_rotations }, (_, i) => {
                const startParts = labDay.start_time!.split(':');
                const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
                const rotStart = startMinutes + (i * labDay.rotation_duration);
                const rotEnd = rotStart + labDay.rotation_duration;
                const fmtTime = (mins: number) => {
                  const h = Math.floor(mins / 60) % 12 || 12;
                  const m = String(mins % 60).padStart(2, '0');
                  const ampm = Math.floor(mins / 60) >= 12 ? 'PM' : 'AM';
                  return `${h}:${m} ${ampm}`;
                };
                return (
                  <div key={i} className="border border-gray-200 rounded px-2 py-1">
                    <span className="font-semibold text-gray-700">R{i + 1}:</span>{' '}
                    <span className="text-gray-600">{fmtTime(rotStart)} - {fmtTime(rotEnd)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Print: Checklist */}
        {checklistItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">
              Prep Checklist ({checklistItems.filter(i => i.is_completed).length}/{checklistItems.length})
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
              {checklistItems.map(item => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <span className={`text-xs ${item.is_completed ? 'text-green-600' : 'text-gray-400'}`}>
                    {item.is_completed ? '\u2713' : '\u25CB'}
                  </span>
                  <span className={item.is_completed ? 'text-gray-500 line-through' : 'text-gray-800'}>
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Print: Coverage / Shift Signups */}
        {coverageShifts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">Shift Coverage</h2>
            {coverageShifts.map(shift => {
              const confirmed = shift.signups.filter(s => s.status === 'confirmed');
              return (
                <div key={shift.id} className="text-sm mb-1">
                  <strong>{shift.title}</strong>
                  {confirmed.length > 0 && (
                    <span className="ml-2 text-gray-600">
                      {confirmed.map(s => s.instructor?.name || 'Unknown').join(', ')}
                    </span>
                  )}
                  {confirmed.length === 0 && (
                    <span className="ml-2 text-gray-400 italic">No confirmed signups</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Print: Notes */}
        {labDay.notes && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-1">Notes</h2>
            <p className="text-sm text-gray-600">{labDay.notes}</p>
          </div>
        )}

        {/* Print: Student Roster */}
        {cohortStudents.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-300">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">
              Student Roster ({cohortStudents.length})
            </h2>
            <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-sm">
              {cohortStudents
                .sort((a, b) => a.last_name.localeCompare(b.last_name))
                .map((student, idx) => (
                  <span key={student.id} className="text-gray-800">
                    {idx + 1}. {student.last_name}, {student.first_name}
                  </span>
                ))
              }
            </div>
          </div>
        )}

        <div className="mt-4 pt-2 border-t border-gray-300 text-xs text-gray-400 flex justify-between">
          <span>PMI EMS Scheduler</span>
          <span>Printed {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Roster Print View - Only visible when printing roster */}
      {showRosterPrint && (
        <div className="hidden print:block p-6 bg-white text-black">
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
            <h1 className="text-2xl font-bold">PMI Paramedic Program</h1>
            <h2 className="text-xl font-semibold mt-1">Lab Day Roster</h2>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Date:</strong> {formatDate(labDay.date)}</p>
              <p><strong>Cohort:</strong> {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}</p>
              {labDay.title && <p><strong>Lab:</strong> {labDay.title}</p>}
            </div>
            <div>
              {(labDay.start_time || labDay.end_time) && (
                <p><strong>Time:</strong> {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}</p>
              )}
              {labDay.week_number && labDay.day_number && (
                <p><strong>Week {labDay.week_number}, Day {labDay.day_number}</strong></p>
              )}
              <p><strong>Rotations:</strong> {labDay.num_rotations} x {labDay.rotation_duration} min</p>
            </div>
          </div>
          {labDayRoles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-bold border-b border-gray-400 pb-1 mb-3 uppercase tracking-wide">
                Lab Day Roles
              </h3>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {labDayRoles.filter(r => r.role === 'lab_lead').length > 0 && (
                  <div>
                    <span className="font-semibold text-gray-700">Lab Lead{labDayRoles.filter(r => r.role === 'lab_lead').length > 1 ? 's' : ''}:</span>{' '}
                    <span>{labDayRoles.filter(r => r.role === 'lab_lead').map(r => r.instructor?.name || 'Unknown').join(', ')}</span>
                    <span className="text-gray-500 ml-1 text-xs">(oversees lab day, runs timer)</span>
                  </div>
                )}
                {labDayRoles.filter(r => r.role === 'roamer').length > 0 && (
                  <div>
                    <span className="font-semibold text-gray-700">Roamer{labDayRoles.filter(r => r.role === 'roamer').length > 1 ? 's' : ''}:</span>{' '}
                    <span>{labDayRoles.filter(r => r.role === 'roamer').map(r => r.instructor?.name || 'Unknown').join(', ')}</span>
                    <span className="text-gray-500 ml-1 text-xs">(floats between stations, grabs supplies)</span>
                  </div>
                )}
                {labDayRoles.filter(r => r.role === 'observer').length > 0 && (
                  <div>
                    <span className="font-semibold text-gray-700">Observer{labDayRoles.filter(r => r.role === 'observer').length > 1 ? 's' : ''}:</span>{' '}
                    <span>{labDayRoles.filter(r => r.role === 'observer').map(r => r.instructor?.name || 'Unknown').join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {labDay.stations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-bold border-b border-gray-400 pb-1 mb-3 uppercase tracking-wide">
                Stations &amp; Instructors
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1 pr-4 font-semibold w-12">Stn</th>
                    <th className="text-left py-1 pr-4 font-semibold">Station</th>
                    <th className="text-left py-1 font-semibold">Instructor</th>
                    <th className="text-left py-1 pl-4 font-semibold">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {labDay.stations.map((station) => (
                    <tr key={station.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-4 font-medium">{station.station_number}</td>
                      <td className="py-1.5 pr-4">
                        {station.custom_title || station.scenario?.title || station.skill_name || `Station ${station.station_number}`}
                      </td>
                      <td className="py-1.5">
                        {station.instructor_name
                          ? `${station.instructor_name}${station.instructor_email ? ` (${station.instructor_email})` : ''}`
                          : <span className="text-gray-400 italic">TBD</span>
                        }
                      </td>
                      <td className="py-1.5 pl-4">{station.room || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div>
            <h3 className="text-base font-bold border-b border-gray-400 pb-1 mb-3 uppercase tracking-wide">
              Enrolled Students ({cohortStudents.length})
            </h3>
            {cohortStudents.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No students found for this cohort.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1 pr-4 font-semibold w-8">#</th>
                    <th className="text-left py-1 pr-4 font-semibold">Name</th>
                    <th className="text-left py-1 pr-4 font-semibold">Email</th>
                    <th className="text-left py-1 pr-4 font-semibold">Agency</th>
                    {rosterIncludePhotos && (
                      <th className="text-left py-1 font-semibold">Photo</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {cohortStudents.map((student, index) => (
                    <tr key={student.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-4 text-gray-500">{index + 1}.</td>
                      <td className="py-1.5 pr-4 font-medium">{student.last_name}, {student.first_name}</td>
                      <td className="py-1.5 pr-4 text-gray-600">{student.email || ''}</td>
                      <td className="py-1.5 pr-4">{student.agency || ''}</td>
                      {rosterIncludePhotos && (
                        <td className="py-1.5">
                          {student.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={student.photo_url}
                              alt={`${student.first_name} ${student.last_name}`}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <span className="text-gray-400 text-xs italic">No photo</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400 flex justify-between">
            <span>PMI EMS Scheduler</span>
            <span>Generated: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      )}

      {/* Roster Print Controls - visible on screen when roster print mode is active */}
      {showRosterPrint && (
        <div className="print:hidden fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 flex flex-col gap-3 w-72">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">Roster Print Options</span>
            <button
              onClick={() => setShowRosterPrint(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={rosterIncludePhotos}
              onChange={(e) => setRosterIncludePhotos(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Include student photos
          </label>
          <button
            onClick={() => window.print()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Print Roster
          </button>
          <button
            onClick={() => setShowRosterPrint(false)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Breadcrumbs
                entityTitle={labDay.title || `${labDay.cohort.program.abbreviation} Group ${labDay.cohort.cohort_number}`}
                className="mb-1"
              />
              <Link
                href="/lab-management/schedule"
                className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Schedule
              </Link>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {formatDate(labDay.date)}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                {(labDay.start_time || labDay.end_time) && (
                  <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                    <Clock className="w-4 h-4" />
                    {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}
                  </span>
                )}
                {labDay.week_number && labDay.day_number && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Week {labDay.week_number}, Day {labDay.day_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {labDay.num_rotations} rotations × {labDay.rotation_duration} min
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end print:hidden">
              {/* Inline timer widget — only visible when timer is active */}
              <InlineTimerWidget
                labDayId={labDayId}
                onOpenFullTimer={() => setShowTimer(true)}
                paused={showTimer}
              />
              <div className="flex gap-2">
              <button
                onClick={() => setShowTimer(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Timer className="w-4 h-4" />
                Start Timer
              </button>
              <button
                onClick={() => window.open(`/timer-display/live/${labDayId}`, '_blank')}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 lg:px-3 lg:py-2 max-lg:px-4 max-lg:py-3 max-lg:text-base max-lg:font-medium"
                title="Open full-screen timer display in new tab"
              >
                <Monitor className="w-4 h-4 max-lg:w-5 max-lg:h-5" />
                <span className="hidden sm:inline">Timer Display</span>
                <span className="sm:hidden">Display</span>
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={handleExportCalendar}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Export to Calendar (.ics)"
              >
                <CalendarPlus className="w-4 h-4" />
                Calendar
              </button>
              <button
                onClick={handlePrintRoster}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Print student roster"
              >
                <Users className="w-4 h-4" />
                Roster
              </button>
              <button
                onClick={handleCSVExport}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Download roster as CSV"
              >
                <FileText className="w-4 h-4" />
                CSV
              </button>
              {/* Duplicate split button */}
              <div className="relative inline-flex">
                <button
                  onClick={() => {
                    setDuplicateDate('');
                    setShowDuplicateModal(true);
                    setShowDuplicateDropdown(false);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-l-lg hover:bg-gray-50 dark:hover:bg-gray-700 border-r-0"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  onClick={() => setShowDuplicateDropdown(prev => !prev)}
                  className="inline-flex items-center px-1.5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-r-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  title="More duplicate options"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showDuplicateDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDuplicateDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                      <button
                        onClick={() => {
                          setShowDuplicateDropdown(false);
                          setShowNextWeekConfirm(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                      >
                        <Calendar className="w-4 h-4 text-blue-500" />
                        Copy to Next Week
                      </button>
                      <button
                        onClick={openBulkDuplicateModal}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-lg flex items-center gap-2"
                      >
                        <Copy className="w-4 h-4 text-purple-500" />
                        Copy to Multiple Dates...
                      </button>
                    </div>
                  </>
                )}
              </div>
              <Link
                href={`/lab-management/schedule/${labDayId}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <Link
                href={`/lab-management/schedule/${labDayId}/stations/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Station
              </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                Source Template: {labDay.source_template.name}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                {labDay.source_template.program?.toUpperCase()} S{labDay.source_template.semester} &bull; Week {labDay.source_template.week_number} Day {labDay.source_template.day_number}
              </p>
            </div>
            {userRole && canAccessAdmin(userRole) && (
              <button
                onClick={() => setShowDiffModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-700/50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Compare &amp; Update Template
              </button>
            )}
          </div>
        )}

        {/* Lab Day Roles */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 print:shadow-none print:border print:border-gray-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Lab Leads &amp; Roamers
            </h3>
            {userRole && canAccessAdmin(userRole) && (
              <button
                onClick={() => setShowRoleAssignForm(!showRoleAssignForm)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline print:hidden flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {showRoleAssignForm ? 'Cancel' : 'Add'}
              </button>
            )}
          </div>

          {/* Inline Add Role Form */}
          {showRoleAssignForm && userRole && canAccessAdmin(userRole) && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 print:hidden">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
                  <select
                    value={roleAssignRole}
                    onChange={(e) => setRoleAssignRole(e.target.value as 'lab_lead' | 'roamer' | 'observer')}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="lab_lead">Lab Lead</option>
                    <option value="roamer">Roamer</option>
                    <option value="observer">Observer</option>
                  </select>
                </div>
                <div className="flex-[2] min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instructor</label>
                  <select
                    value={roleAssignInstructorId}
                    onChange={(e) => setRoleAssignInstructorId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select instructor...</option>
                    {instructors
                      .filter(inst => !labDayRoles.some(r => r.instructor_id === inst.id && r.role === roleAssignRole))
                      .map(inst => {
                        const avail = inst.email ? calendarAvailability.get(inst.email.toLowerCase()) : undefined;
                        const dot = avail
                          ? avail.status === 'free' ? '\u{1F7E2} '
                          : avail.status === 'partial' ? '\u{1F7E1} '
                          : avail.status === 'busy' ? '\u{1F534} '
                          : '\u26AA '
                          : '';
                        return (
                          <option key={inst.id} value={inst.id}>{dot}{inst.name}</option>
                        );
                      })
                    }
                  </select>
                </div>
                <button
                  onClick={handleAddLabDayRole}
                  disabled={addingRole || !roleAssignInstructorId}
                  className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {addingRole ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Assign
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Lab Leads oversee the lab and run the timer. Roamers float between stations and grab supplies. Observers shadow or train.
              </p>
            </div>
          )}

          {labDayRoles.length === 0 && !showRoleAssignForm ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic print:hidden">
              No roles assigned.{' '}
              {userRole && canAccessAdmin(userRole) ? (
                <button
                  onClick={() => setShowRoleAssignForm(true)}
                  className="text-blue-600 dark:text-blue-400 hover:underline not-italic"
                >
                  Assign Lab Leads &amp; Roamers
                </button>
              ) : (
                <span>Lab leads and roamers have not been assigned for this lab day.</span>
              )}
            </p>
          ) : (
            <div className="flex flex-wrap gap-6">
              {/* Lab Leads */}
              {labDayRoles.filter(r => r.role === 'lab_lead').length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lab Lead</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 normal-case tracking-normal print:hidden"> &mdash; oversees lab, runs timer</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {labDayRoles.filter(r => r.role === 'lab_lead').map(role => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 print:bg-amber-100 print:text-amber-800 rounded-full text-sm font-medium group"
                      >
                        <Shield className="w-3 h-3" />
                        {role.instructor?.name || 'Unknown'}
                        {role.instructor?.email && calendarAvailability.has(role.instructor.email.toLowerCase()) && (
                          <CalendarAvailabilityDot
                            status={calendarAvailability.get(role.instructor.email.toLowerCase())!.status}
                            events={calendarAvailability.get(role.instructor.email.toLowerCase())!.events}
                            size="sm"
                          />
                        )}
                        {userRole && canAccessAdmin(userRole) && (
                          <button
                            onClick={() => handleRemoveLabDayRole(role.id)}
                            disabled={removingRoleId === role.id}
                            className="ml-0.5 text-amber-600 dark:text-amber-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                            title="Remove"
                          >
                            {removingRoleId === role.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Roamers */}
              {labDayRoles.filter(r => r.role === 'roamer').length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Roamer</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 normal-case tracking-normal print:hidden"> &mdash; floats between stations, grabs supplies</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {labDayRoles.filter(r => r.role === 'roamer').map(role => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 print:bg-blue-100 print:text-blue-800 rounded-full text-sm font-medium group"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {role.instructor?.name || 'Unknown'}
                        {role.instructor?.email && calendarAvailability.has(role.instructor.email.toLowerCase()) && (
                          <CalendarAvailabilityDot
                            status={calendarAvailability.get(role.instructor.email.toLowerCase())!.status}
                            events={calendarAvailability.get(role.instructor.email.toLowerCase())!.events}
                            size="sm"
                          />
                        )}
                        {userRole && canAccessAdmin(userRole) && (
                          <button
                            onClick={() => handleRemoveLabDayRole(role.id)}
                            disabled={removingRoleId === role.id}
                            className="ml-0.5 text-blue-600 dark:text-blue-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                            title="Remove"
                          >
                            {removingRoleId === role.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Observers */}
              {labDayRoles.filter(r => r.role === 'observer').length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Observer</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 normal-case tracking-normal print:hidden"> &mdash; shadowing / training</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {labDayRoles.filter(r => r.role === 'observer').map(role => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 print:bg-purple-100 print:text-purple-800 rounded-full text-sm font-medium group"
                      >
                        {role.instructor?.name || 'Unknown'}
                        {role.instructor?.email && calendarAvailability.has(role.instructor.email.toLowerCase()) && (
                          <CalendarAvailabilityDot
                            status={calendarAvailability.get(role.instructor.email.toLowerCase())!.status}
                            events={calendarAvailability.get(role.instructor.email.toLowerCase())!.events}
                            size="sm"
                          />
                        )}
                        {userRole && canAccessAdmin(userRole) && (
                          <button
                            onClick={() => handleRemoveLabDayRole(role.id)}
                            disabled={removingRoleId === role.id}
                            className="ml-0.5 text-purple-600 dark:text-purple-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                            title="Remove"
                          >
                            {removingRoleId === role.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calendar Availability Summary */}
        {calendarSummary.total > 0 && !calendarLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3 print:hidden">
            <Calendar className="w-4 h-4" />
            <span>
              {calendarSummary.free} of {calendarSummary.total} instructor{calendarSummary.total !== 1 ? 's' : ''} {calendarSummary.free === 1 ? 'has a' : 'have'} free calendar{calendarSummary.free !== 1 ? 's' : ''} for this date
            </span>
            {calendarSummary.free < calendarSummary.total && (
              <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                ({calendarSummary.total - calendarSummary.free} busy or disconnected)
              </span>
            )}
          </div>
        )}
        {calendarLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-3 print:hidden">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Checking calendar availability...</span>
          </div>
        )}

        {/* Shift Coverage Section */}
        {coverageShifts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 print:shadow-none print:border print:border-gray-300">
            <button
              onClick={() => setCoverageCollapsed(!coverageCollapsed)}
              className="flex items-center justify-between w-full mb-3"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Coverage &mdash; Shift Signups
              </h3>
              {coverageCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            {!coverageCollapsed && (
              <div className="space-y-3">
                {coverageShifts.map(shift => {
                  const confirmed = shift.signups.filter(s => s.status === 'confirmed');
                  const pending = shift.signups.filter(s => s.status === 'pending');
                  return (
                    <div key={shift.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{shift.title}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {shift.start_time?.substring(0, 5)} - {shift.end_time?.substring(0, 5)}
                          </span>
                        </div>
                      </div>
                      {/* Confirmed signups */}
                      {confirmed.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {confirmed.map(signup => (
                            <span
                              key={signup.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300"
                            >
                              <CheckCircle className="w-3 h-3" />
                              {signup.instructor?.name || signup.instructor?.email?.split('@')[0] || 'Unknown'}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Pending signups with accept/decline */}
                      {pending.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Pending ({pending.length})</p>
                          {pending.map(signup => (
                            <div key={signup.id} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                              <span className="text-sm text-gray-900 dark:text-white">
                                {signup.instructor?.name || signup.instructor?.email?.split('@')[0] || 'Unknown'}
                              </span>
                              {userRole && (userRole === 'admin' || userRole === 'superadmin' || userRole === 'lead_instructor') && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleAcceptSignup(shift.id, signup.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/60"
                                    title="Accept signup"
                                  >
                                    <Check className="w-3 h-3" />
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleDeclineSignup(shift.id, signup.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/60"
                                    title="Decline signup"
                                  >
                                    <X className="w-3 h-3" />
                                    Decline
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {confirmed.length === 0 && pending.length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No signups yet</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick Add Station */}
        {showQuickAddStation && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 border-2 border-blue-200 dark:border-blue-800 print:hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Quick Add Station
              </h3>
              <button
                onClick={() => setShowQuickAddStation(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Station Type</label>
                <select
                  value={quickAddType}
                  onChange={(e) => setQuickAddType(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="scenario">Scenario</option>
                  <option value="skills">Skills</option>
                  <option value="skill_drill">Skill Drill</option>
                  <option value="documentation">Documentation</option>
                </select>
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  placeholder="Enter station title..."
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAddStation(); }}
                />
              </div>
              <button
                onClick={handleQuickAddStation}
                disabled={quickAddSaving || !quickAddTitle.trim()}
                className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {quickAddSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Add
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 mb-4 print:hidden">
          {!showQuickAddStation && (
            <button
              onClick={() => setShowQuickAddStation(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800"
            >
              <Plus className="w-4 h-4" />
              Quick Add Station
            </button>
          )}
        </div>

        {/* Stations Grid */}
        <StationCards
          stations={labDay.stations}
          stationSkillDocs={stationSkillDocs}
          stationSkillSheetIds={stationSkillSheetIds}
          calendarAvailability={calendarAvailability}
          labDayId={labDayId as string}
          getStationTitle={getStationTitle}
          onEditStation={openEditModal}
          onOpenRoleModal={openRoleModal}
        />

        {/* Prep Checklist */}
        <ChecklistSection
          checklistItems={checklistItems}
          checklistCollapsed={checklistCollapsed}
          checklistLoading={checklistLoading}
          checklistGenerating={checklistGenerating}
          newChecklistItem={newChecklistItem}
          addingChecklistItem={addingChecklistItem}
          onToggleCollapse={() => setChecklistCollapsed(prev => !prev)}
          onToggleItem={handleToggleChecklistItem}
          onAddItem={handleAddChecklistItem}
          onDeleteItem={handleDeleteChecklistItem}
          onAutoGenerate={handleAutoGenerateChecklist}
          onNewItemChange={setNewChecklistItem}
        />

        {/* Equipment & Supplies */}
        <EquipmentSection
          equipmentItems={equipmentItems}
          equipmentCollapsed={equipmentCollapsed}
          equipmentLoading={equipmentLoading}
          stations={labDay.stations}
          newEquipmentName={newEquipmentName}
          newEquipmentQty={newEquipmentQty}
          newEquipmentStation={newEquipmentStation}
          addingEquipment={addingEquipment}
          onToggleCollapse={() => setEquipmentCollapsed(prev => !prev)}
          onUpdateStatus={handleUpdateEquipmentStatus}
          onAddEquipment={handleAddEquipmentItem}
          onDeleteEquipment={handleDeleteEquipmentItem}
          onNewNameChange={setNewEquipmentName}
          onNewQtyChange={setNewEquipmentQty}
          onNewStationChange={setNewEquipmentStation}
        />

        {/* Lab Day Costs */}
        {userRole && hasMinRole(userRole, 'instructor') && (
          <CostsSection
            costItems={costItems}
            costsCollapsed={costsCollapsed}
            costsLoading={costsLoading}
            addingCost={addingCost}
            editingCostId={editingCostId}
            editCostForm={editCostForm}
            newCostCategory={newCostCategory}
            newCostDescription={newCostDescription}
            newCostAmount={newCostAmount}
            cohortStudents={cohortStudents}
            onToggleCollapse={() => setCostsCollapsed(prev => !prev)}
            onAddCostItem={handleAddCostItem}
            onStartEditCost={handleStartEditCost}
            onSaveEditCost={handleSaveEditCost}
            onCancelEditCost={() => setEditingCostId(null)}
            onDeleteCostItem={handleDeleteCostItem}
            onEditCostFormChange={setEditCostForm}
            onNewCostCategoryChange={setNewCostCategory}
            onNewCostDescriptionChange={setNewCostDescription}
            onNewCostAmountChange={setNewCostAmount}
          />
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {labDay.checkin_enabled
                        ? 'Check-in is active — students can tap their name to mark themselves present.'
                        : 'Enable to give students a link to check themselves in.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={labDay.checkin_enabled ? handleDisableCheckIn : handleEnableCheckIn}
                  disabled={checkInLoading}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors disabled:opacity-50 ${
                    labDay.checkin_enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={labDay.checkin_enabled ? 'Disable check-in' : 'Enable check-in'}
                >
                  {checkInLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : labDay.checkin_enabled ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  {labDay.checkin_enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Check-in URL section — shown when enabled and token exists */}
              {labDay.checkin_enabled && labDay.checkin_token && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Check-In Link
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 min-w-0">
                      <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600 dark:text-gray-300 font-mono truncate">
                        {typeof window !== 'undefined' ? `${window.location.origin}/checkin/${labDay.checkin_token}` : `/checkin/${labDay.checkin_token}`}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCheckInLink}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors ${
                        copyLinkSuccess
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {copyLinkSuccess ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Share this link with students or display it on screen. They can tap their name to mark themselves present.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student Attendance */}
        {labDay.cohort?.id && (
          <div className="mt-6 print:hidden">
            <AttendanceSection
              labDayId={labDayId}
              cohortId={labDay.cohort.id}
            />
          </div>
        )}

        {/* Student Performance Ratings — visible to instructors+ */}
        {userRole && hasMinRole(userRole, 'instructor') && cohortStudents.length > 0 && (
          <StudentRatingsSection
            studentRatings={studentRatings}
            ratingsCollapsed={ratingsCollapsed}
            ratingsLoading={ratingsLoading}
            cohortStudents={cohortStudents}
            savingRating={savingRating}
            ratingHover={ratingHover}
            expandedNotes={expandedNotes}
            pendingNotes={pendingNotes}
            session={session}
            onToggleCollapse={() => setRatingsCollapsed(prev => !prev)}
            onSaveRating={handleSaveRating}
            onSaveNote={handleSaveNote}
            onRatingHoverChange={(studentId, value) => setRatingHover(prev => ({ ...prev, [studentId]: value }))}
            onPendingNoteChange={(studentId, value) => setPendingNotes(prev => ({ ...prev, [studentId]: value }))}
            onExpandedNotesChange={(studentId, expanded) => setExpandedNotes(prev => ({ ...prev, [studentId]: expanded }))}
          />
        )}

        {/* Learning Style Distribution — visible to instructors+ */}
        {userRole && hasMinRole(userRole, 'instructor') && labDay.cohort?.id && (
          <div className="mt-6 print:hidden">
            <LearningStyleDistribution
              labDayId={labDayId}
              cohortLinkId={labDay.cohort.id}
            />
          </div>
        )}

        {/* Skill Sign-offs — visible to instructors+ with students present */}
        {userRole && hasMinRole(userRole, 'instructor') && cohortStudents.length > 0 && skills.length > 0 && (
          <div className="mt-6 print:hidden">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              {/* Section header */}
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <button
                  onClick={() => setSignoffCollapsed(prev => !prev)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  <ClipboardCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Skill Sign-offs</h3>
                  {signoffSkillId && (
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0 truncate">
                      {skills.find(s => s.id === signoffSkillId)?.name}
                    </span>
                  )}
                  {signoffCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                  )}
                </button>
                <div className="group relative inline-flex items-center shrink-0 ml-2">
                  <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 cursor-help" />
                  <div className="invisible group-hover:visible absolute right-6 top-0 z-50 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg">
                    <div className="absolute -right-1 top-2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                    Confirm a student has demonstrated competency in this skill. Sign-offs are recorded with your name and timestamp and cannot be revoked.
                  </div>
                </div>
              </div>

              {!signoffCollapsed && (
                <div className="p-4 space-y-4">
                  {/* Skill selector + bulk action bar */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <select
                        value={signoffSkillId}
                        onChange={e => {
                          setSignoffSkillId(e.target.value);
                          setSignoffBulkSelected([]);
                          setSignoffConfirm({});
                          setSignoffBulkConfirm(false);
                        }}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select a skill...</option>
                        {/* Group by category */}
                        {Array.from(new Set(skills.map(s => s.category))).sort().map(category => (
                          <optgroup key={category} label={category}>
                            {skills.filter(s => s.category === category).map(skill => (
                              <option key={skill.id} value={skill.id}>{skill.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {signoffSkillId && signoffBulkSelected.length > 0 && (
                      <button
                        onClick={handleBulkSignoff}
                        disabled={signoffBulkSaving}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          signoffBulkConfirm
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        } disabled:opacity-50`}
                      >
                        {signoffBulkSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : signoffBulkConfirm ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {signoffBulkConfirm
                          ? `Confirm sign-off ${signoffBulkSelected.length}?`
                          : `Bulk Sign-off (${signoffBulkSelected.length})`}
                      </button>
                    )}

                    {signoffSkillId && (
                      <button
                        onClick={() => {
                          // Select all unsigned students
                          const unsigned = cohortStudents
                            .filter(s => {
                              const entry = signoffs[`${s.id}:${signoffSkillId}`];
                              return !entry || entry.revoked;
                            })
                            .map(s => s.id);
                          setSignoffBulkSelected(unsigned);
                        }}
                        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Select unsigned
                      </button>
                    )}

                    {signoffBulkSelected.length > 0 && (
                      <button
                        onClick={() => setSignoffBulkSelected([])}
                        className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Student list */}
                  {signoffLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                  ) : !signoffSkillId ? (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                      Select a skill above to view and record sign-offs.
                    </div>
                  ) : (
                    <div className="divide-y dark:divide-gray-700 border dark:border-gray-700 rounded-lg overflow-hidden">
                      {cohortStudents.map(student => {
                        const key = `${student.id}:${signoffSkillId}`;
                        const signoff = signoffs[key];
                        const isSigned = signoff && !signoff.revoked;
                        const isSaving = signoffSaving[student.id];
                        const isConfirming = signoffConfirm[key];
                        const isSelected = signoffBulkSelected.includes(student.id);
                        const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();

                        return (
                          <div
                            key={student.id}
                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                              isSigned
                                ? 'bg-emerald-50 dark:bg-emerald-900/10'
                                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                            }`}
                          >
                            {/* Checkbox for bulk */}
                            {!isSigned && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSignoffBulkSelected(prev => [...prev, student.id]);
                                  } else {
                                    setSignoffBulkSelected(prev => prev.filter(id => id !== student.id));
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500 shrink-0"
                              />
                            )}
                            {isSigned && <div className="w-4 shrink-0" />}

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 overflow-hidden">
                              {(student as any).photo_url ? (
                                <img
                                  src={(student as any).photo_url}
                                  alt={`${student.first_name} ${student.last_name}`}
                                  className="w-8 h-8 object-cover rounded-full"
                                />
                              ) : (
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{initials}</span>
                              )}
                            </div>

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {student.first_name} {student.last_name}
                              </p>
                              {isSigned && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                                  Signed by {signoff.signed_off_by.split('@')[0]} on{' '}
                                  {new Date(signoff.signed_off_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                              )}
                              {signoff?.revoked && (
                                <p className="text-xs text-red-500 dark:text-red-400">Revoked</p>
                              )}
                            </div>

                            {/* Status / action */}
                            <div className="shrink-0 flex items-center gap-2">
                              {isSigned ? (
                                <>
                                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    Signed
                                  </span>
                                  {userRole && hasMinRole(userRole, 'lead_instructor') && (
                                    <button
                                      onClick={() => {
                                        setSignoffRevokeId(signoff.id);
                                        setSignoffRevokeReason('');
                                      }}
                                      className="text-xs text-red-500 dark:text-red-400 hover:underline ml-1"
                                      title="Revoke sign-off"
                                    >
                                      Revoke
                                    </button>
                                  )}
                                </>
                              ) : isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleSignoff(student.id)}
                                    disabled={!signoffSkillId}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      isConfirming
                                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300'
                                    } disabled:opacity-50`}
                                  >
                                    {isConfirming ? (
                                      <>
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Confirm?
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Sign Off
                                      </>
                                    )}
                                  </button>
                                  {!isConfirming && (
                                    <HelpTooltip text="Once signed, this confirmation is permanent and cannot be reversed. It records your name and timestamp as the signing instructor." />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Revoke Signoff Modal */}
        {signoffRevokeId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  Revoke Sign-off
                </h2>
                <button
                  onClick={() => { setSignoffRevokeId(null); setSignoffRevokeReason(''); }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This will mark the sign-off as revoked. The record is preserved for audit purposes.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={signoffRevokeReason}
                    onChange={e => setSignoffRevokeReason(e.target.value)}
                    placeholder="e.g., Retraction due to error"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
                <button
                  onClick={() => { setSignoffRevokeId(null); setSignoffRevokeReason(''); }}
                  disabled={signoffRevoking}
                  className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevokeSignoff}
                  disabled={signoffRevoking}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  {signoffRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Revoke Sign-off
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Post-Lab Debrief — shown only after lab day date has passed */}
        {isLabDayPast() && (
          <DebriefSection
            debriefs={debriefs}
            debriefCollapsed={debriefCollapsed}
            debriefLoading={debriefLoading}
            currentUserDebrief={currentUserDebrief}
            editingDebriefId={editingDebriefId}
            submittingDebrief={submittingDebrief}
            debriefForm={debriefForm}
            debriefHoverRating={debriefHoverRating}
            evaluationConcerns={evaluationConcerns}
            session={session}
            onToggleCollapse={() => setDebriefCollapsed(prev => !prev)}
            onSubmitDebrief={handleSubmitDebrief}
            onStartEditingDebrief={startEditingDebrief}
            onCancelEditingDebrief={cancelEditingDebrief}
            onDebriefFormChange={setDebriefForm}
            onDebriefHoverRatingChange={setDebriefHoverRating}
          />
        )}

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Link
            href={`/lab-management/students?cohortId=${labDay.cohort.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Users className="w-4 h-4" />
            View Students
          </Link>
          <Link
            href={`/lab-management/reports/team-leads?cohortId=${labDay.cohort.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ClipboardCheck className="w-4 h-4" />
            Team Lead Report
          </Link>
        </div>
      </main>

      {/* Edit Station Modal */}
      {editingStation && !skillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Station {editingStation.station_number}
              </h2>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Station Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Station Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STATION_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, station_type: type.value }))}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        editForm.station_type === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{type.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Station Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Station Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editForm.custom_title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, custom_title: e.target.value }))}
                    placeholder="e.g., PM14 01/23/26 - Chest Pain Scenario"
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!labDay) return;
                      const cohortAbbrev = labDay.cohort.program.abbreviation + labDay.cohort.cohort_number;
                      const dateStr = new Date(labDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                      let suffix = '';
                      if (editForm.station_type === 'scenario' && editForm.scenario_id) {
                        const scenario = scenarios.find(s => s.id === editForm.scenario_id);
                        suffix = scenario ? scenario.title : 'Scenario';
                      } else if (editForm.station_type === 'skills' && editForm.selectedSkills.length > 0) {
                        const firstSkill = skills.find(s => s.id === editForm.selectedSkills[0]);
                        suffix = firstSkill ? (editForm.selectedSkills.length > 1 ? `${firstSkill.name} +${editForm.selectedSkills.length - 1}` : firstSkill.name) : 'Skills';
                      } else if (editForm.station_type === 'documentation') {
                        suffix = 'Documentation';
                      } else {
                        suffix = `Station ${editingStation?.station_number || ''}`;
                      }
                      setEditForm(prev => ({ ...prev, custom_title: `${cohortAbbrev} ${dateStr} - ${suffix}` }));
                    }}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm whitespace-nowrap"
                  >
                    Auto-generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Descriptive name shown on dashboard and schedule
                </p>
              </div>

              {/* Scenario Selection (for scenario type) */}
              {editForm.station_type === 'scenario' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Scenario
                  </label>
                  <select
                    value={editForm.scenario_id}
                    onChange={(e) => setEditForm(prev => ({ ...prev, scenario_id: e.target.value }))}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Select a scenario...</option>
                    {scenarios.map(scenario => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.title} ({scenario.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Skill Drill Info + Picker */}
              {editForm.station_type === 'skill_drill' && (
                <div className="space-y-3">
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                    <p className="text-orange-800 dark:text-orange-300 text-sm">
                      <strong>Skill Drill:</strong> Student-led practice station. Select drills from the library below.
                    </p>
                  </div>

                  {/* Selected drills */}
                  {editForm.selectedDrillIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {editForm.selectedDrillIds.map(id => {
                        const drill = editSkillDrills.find(d => d.id === id);
                        return drill ? (
                          <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-sm rounded-full">
                            {drill.name}
                            <button type="button" onClick={() => setEditForm(prev => ({ ...prev, selectedDrillIds: prev.selectedDrillIds.filter(did => did !== id) }))} className="hover:text-red-600">×</button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* Drill picker list */}
                  {editSkillDrills.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border dark:border-gray-700 rounded-lg">
                      {editSkillDrills.map(drill => {
                        const isSelected = editForm.selectedDrillIds.includes(drill.id);
                        return (
                          <label key={drill.id} className={`flex items-center gap-3 p-2.5 cursor-pointer border-b last:border-0 dark:border-gray-700 transition-colors ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => setEditForm(prev => ({
                                ...prev,
                                selectedDrillIds: isSelected
                                  ? prev.selectedDrillIds.filter(id => id !== drill.id)
                                  : [...prev.selectedDrillIds, drill.id]
                              }))}
                              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{drill.name}</span>
                              {drill.category && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{drill.category}</span>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {editForm.selectedDrillIds.length === 0 ? 'No drills selected.' : `${editForm.selectedDrillIds.length} drill${editForm.selectedDrillIds.length !== 1 ? 's' : ''} selected.`}
                  </p>
                </div>
              )}

              {/* S3 Drill Guide (from metadata or fetched drill_data) */}
              {editForm.station_type === 'skill_drill' && editDrillData && Object.keys(editDrillData).length > 0 && (
                <TemplateGuideSection metadata={{
                  objectives: editDrillData.objectives as string[] | undefined,
                  student_instructions: editDrillData.student_instructions as string[] | undefined,
                  instructor_guide: editDrillData.instructor_guide as StationMetadata['instructor_guide'],
                  case_bank: editDrillData.case_bank as StationMetadata['case_bank'],
                  rhythm_cases: editDrillData.rhythm_cases as StationMetadata['rhythm_cases'],
                  minicode_phase_overlay: editDrillData.minicode_phase_overlay as StationMetadata['minicode_phase_overlay'],
                  key_observations: editDrillData.key_observations as string[] | undefined,
                  common_errors: editDrillData.common_errors as string[] | undefined,
                  stress_layers_detailed: editDrillData.stress_layers_detailed as StationMetadata['stress_layers_detailed'],
                  equipment: editDrillData.equipment as string[] | undefined,
                }} />
              )}

              {/* Template Guide from applied template */}
              {editingStation?.metadata && Object.keys(editingStation.metadata).length > 0 && (
                <TemplateGuideSection metadata={editingStation.metadata} />
              )}

              {/* Skills Selection (for skills or skill_drill type) */}
              {(editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Skills from Library
                    </label>
                    <button
                      type="button"
                      onClick={() => setSkillsModalOpen(true)}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <ClipboardCheck className="w-5 h-5 mx-auto mb-1" />
                      {editForm.selectedSkills.length > 0
                        ? `${editForm.selectedSkills.length} skills selected - Click to modify`
                        : 'Click to select skills from library'
                      }
                    </button>
                    {editForm.selectedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editForm.selectedSkills.map(skillId => {
                          const skill = skills.find(s => s.id === skillId);
                          return skill ? (
                            <span key={skillId} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm rounded">
                              {skill.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Custom Skills */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Custom Skills
                    </label>
                    <div className="space-y-2">
                      {editCustomSkills.map((skill, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={skill}
                            onChange={(e) => updateEditCustomSkill(index, e.target.value)}
                            placeholder="Enter custom skill name"
                            className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                          />
                          <button
                            type="button"
                            onClick={() => removeEditCustomSkill(index)}
                            className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addEditCustomSkill}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add custom skill
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Documentation Info */}
              {editForm.station_type === 'documentation' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-300 text-sm">
                    Documentation station for PCR practice and review. Instructor assignment is optional.
                  </p>
                </div>
              )}

              {/* BLS/Platinum Skills Checklist (for skills/skill_drill stations) */}
              {(editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') && labDay && (
                <BLSPlatinumChecklist
                  labDayId={labDay.id}
                  currentStationId={editingStation?.id}
                  selectedSkillIds={editForm.selectedSkills}
                  onToggleSkill={(skillId) => {
                    setEditForm(prev => ({
                      ...prev,
                      selectedSkills: prev.selectedSkills.includes(skillId)
                        ? prev.selectedSkills.filter(id => id !== skillId)
                        : [...prev.selectedSkills, skillId]
                    }));
                  }}
                />
              )}

              {/* Station Documentation Section */}
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Station Documentation</h3>
                </div>

                {/* Auto-loaded documents from selected skills */}
                {(editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') && editForm.selectedSkills.some(skillId => {
                  const skill = skills.find(s => s.id === skillId);
                  return skill?.documents && skill.documents.length > 0;
                }) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      Linked Skill Documents
                    </h4>
                    <div className="space-y-1">
                      {editForm.selectedSkills.flatMap(skillId => {
                        const skill = skills.find(s => s.id === skillId);
                        return (skill?.documents || []).map(doc => (
                          <a key={doc.id} href={doc.document_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 hover:underline">
                            <ExternalLink className="w-3 h-3" />
                            {doc.document_name}
                            <span className="text-xs text-blue-500 px-1 py-0.5 bg-blue-100 rounded">{doc.document_type}</span>
                          </a>
                        ));
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Skill Sheet URL
                  </label>
                  <input
                    type="url"
                    value={editForm.skill_sheet_url}
                    onChange={(e) => setEditForm(prev => ({ ...prev, skill_sheet_url: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Link to skill sheet or reference document
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Instructions URL
                  </label>
                  <input
                    type="url"
                    value={editForm.instructions_url}
                    onChange={(e) => setEditForm(prev => ({ ...prev, instructions_url: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Link to instructor instructions or setup guide
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Station Notes
                  </label>
                  <textarea
                    value={editForm.station_notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, station_notes: e.target.value }))}
                    placeholder="Equipment needed, setup instructions, special considerations..."
                    rows={3}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Internal notes about station setup, equipment, or special requirements
                  </p>
                </div>
              </div>

              {/* Instructors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instructors
                </label>

                {/* Current instructors list */}
                {stationInstructors.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {stationInstructors.map((instructor) => (
                      <div
                        key={instructor.user_email}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          instructor.is_primary
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                            : 'bg-gray-50 dark:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">{instructor.user_name}</span>
                          {instructor.user_email && calendarAvailability.has(instructor.user_email.toLowerCase()) && (
                            <CalendarAvailabilityDot
                              status={calendarAvailability.get(instructor.user_email.toLowerCase())!.status}
                              events={calendarAvailability.get(instructor.user_email.toLowerCase())!.events}
                              size="md"
                            />
                          )}
                          {instructor.is_primary && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!instructor.is_primary && stationInstructors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPrimaryInstructor(instructor.user_email)}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                              title="Set as primary"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeStationInstructor(instructor.user_email)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Remove instructor"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add instructor dropdown */}
                <div className="flex gap-2">
                  <select
                    value={selectedInstructor}
                    onChange={(e) => handleInstructorChange(e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Add instructor...</option>
                    {instructors
                      .filter(i => !stationInstructors.some(si => si.user_email === i.email))
                      .map((instructor) => {
                        const avail = instructor.email ? calendarAvailability.get(instructor.email.toLowerCase()) : undefined;
                        const dot = avail
                          ? avail.status === 'free' ? '\u{1F7E2} '
                          : avail.status === 'partial' ? '\u{1F7E1} '
                          : avail.status === 'busy' ? '\u{1F534} '
                          : '\u26AA '
                          : '';
                        return (
                          <option key={instructor.id} value={`${instructor.name}|${instructor.email}`}>
                            {dot}{instructor.name}
                          </option>
                        );
                      })}
                    <option value="custom">+ Custom name...</option>
                  </select>
                  {selectedInstructor && selectedInstructor !== 'custom' && (
                    <button
                      type="button"
                      onClick={() => {
                        const [name, email] = selectedInstructor.split('|');
                        addStationInstructor(name, email, stationInstructors.length === 0);
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {isCustomInstructor && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={editForm.instructor_name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, instructor_name: e.target.value }))}
                      placeholder="Name"
                      className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                    <input
                      type="email"
                      value={editForm.instructor_email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, instructor_email: e.target.value }))}
                      placeholder="Email"
                      className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editForm.instructor_email) {
                          addStationInstructor(editForm.instructor_name, editForm.instructor_email, stationInstructors.length === 0);
                        }
                      }}
                      disabled={!editForm.instructor_email}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {stationInstructors.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (session?.user?.email && session?.user?.name) {
                        addStationInstructor(session.user.name, session.user.email, true);
                      }
                    }}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Users className="w-4 h-4" />
                    Assign myself
                  </button>
                )}
              </div>

              {/* Room */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Room / Location
                </label>
                <select
                  value={editForm.room}
                  onChange={(e) => setEditForm(prev => ({ ...prev, room: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select room...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Special instructions, equipment needed, etc."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
              <button
                onClick={handleDeleteStation}
                disabled={deletingStation}
                className="inline-flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                {deletingStation ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>

              <div className="flex gap-3">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStation}
                  disabled={savingStation}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingStation ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lab Timer */}
      {showTimer && (
        <LabTimer
          labDayId={labDayId}
          numRotations={labDay.num_rotations}
          rotationMinutes={labDay.rotation_duration}
          onClose={() => setShowTimer(false)}
          isController={true}
        />
      )}

      {/* Skills Selection Modal */}
      {skillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Select Skills</h3>
              <button
                onClick={() => setSkillsModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search and Filter */}
            <div className="p-4 border-b dark:border-gray-700 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search skills..."
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <select
                  value={certLevelFilter}
                  onChange={(e) => setCertLevelFilter(e.target.value)}
                  className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">All Levels</option>
                  <option value="EMT">EMT</option>
                  <option value="AEMT">AEMT</option>
                  <option value="Paramedic">Paramedic</option>
                </select>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{editForm.selectedSkills.length} selected</span>
                <span>{filteredSkills.length} skills shown</span>
              </div>
            </div>

            {/* Skills List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                  <div className="space-y-1">
                    {categorySkills.map(skill => {
                      const isSelected = editForm.selectedSkills.includes(skill.id);
                      return (
                        <label
                          key={skill.id}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                            isSelected ? 'bg-green-50 dark:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSkill(skill.id)}
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{skill.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(skillsByCategory).length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No skills found</p>
              )}
            </div>

            {/* Done Button */}
            <div className="p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setSkillsModalOpen(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done ({editForm.selectedSkills.length} skills selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Logging Modal */}
      {showRoleModal && roleModalStation?.scenario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Log Scenario Roles
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {roleModalStation.scenario.title}
                </p>
              </div>
              <button
                onClick={closeRoleModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Team Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Team Lead
                </label>
                <select
                  value={roleAssignments.team_lead}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, team_lead: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Med Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Med Tech
                </label>
                <select
                  value={roleAssignments.med_tech}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, med_tech: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monitor Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Monitor Tech
                </label>
                <select
                  value={roleAssignments.monitor_tech}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, monitor_tech: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Airway Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Airway Tech
                </label>
                <select
                  value={roleAssignments.airway_tech}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, airway_tech: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Observer
                </label>
                <select
                  value={roleAssignments.observer}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, observer: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Previously logged roles for this scenario */}
              {scenarioParticipation.filter(sp =>
                sp.scenario_id === roleModalStation.scenario?.id &&
                sp.lab_day_id === labDayId
              ).length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h4 className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">
                    Previously Logged
                  </h4>
                  <div className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
                    {scenarioParticipation
                      .filter(sp => sp.scenario_id === roleModalStation.scenario?.id && sp.lab_day_id === labDayId)
                      .map(sp => (
                        <div key={sp.id}>
                          {sp.role.replace(/_/g, ' ')}: {sp.student?.last_name}, {sp.student?.first_name}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={closeRoleModal}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoles}
                disabled={savingRoles || !Object.values(roleAssignments).some(v => v)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingRoles ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Log All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Duplicate Modal */}
      {showBulkDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Duplicate Lab Day to Multiple Dates
              </h2>
              <button
                onClick={() => {
                  if (!bulkDuplicating) setShowBulkDuplicateModal(false);
                }}
                disabled={bulkDuplicating}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Source info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">Source: </span>
                {labDay?.title && <span>{labDay.title} — </span>}
                {labDay?.date ? formatDate(labDay.date) : 'this lab day'}
                {labDay && (
                  <span className="ml-2 text-xs">
                    ({labDay.stations?.length ?? 0} stations)
                  </span>
                )}
              </div>

              {/* Done state */}
              {bulkDuplicateProgress.status === 'done' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                    <Check className="w-5 h-5" />
                    Done! Created {bulkDuplicateProgress.createdIds.length} of {bulkDuplicateProgress.total} lab days
                  </div>
                  {bulkDuplicateProgress.createdIds.length > 0 && (
                    <div className="space-y-1">
                      {bulkDuplicateProgress.createdIds.map((newId, idx) => (
                        <Link
                          key={newId}
                          href={`/lab-management/schedule/${newId}`}
                          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          onClick={() => setShowBulkDuplicateModal(false)}
                        >
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          View new lab day {idx + 1}
                        </Link>
                      ))}
                    </div>
                  )}
                  {bulkDuplicateProgress.failed.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">Failed dates:</p>
                      {bulkDuplicateProgress.failed.map(f => (
                        <p key={f.date} className="text-xs text-red-600 dark:text-red-400">
                          {formatBulkDate(f.date)}: {f.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : bulkDuplicateProgress.status === 'running' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    Creating lab days...
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${bulkDuplicateProgress.total > 0 ? (bulkDuplicateProgress.current / bulkDuplicateProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Processing {bulkDuplicateProgress.total} date{bulkDuplicateProgress.total !== 1 ? 's' : ''}...
                  </p>
                </div>
              ) : (
                <>
                  {/* Calendar picker */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select dates:</p>
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                      {/* Month navigation */}
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700">
                        <button
                          onClick={() => setBulkCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {bulkCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => setBulkCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 text-center">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                          <div key={day} className="py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                            {day}
                          </div>
                        ))}
                      </div>
                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 text-center p-1 gap-0.5">
                        {getBulkCalendarDays().map((cell, idx) => {
                          if (!cell.date || !cell.dateStr) {
                            return <div key={`empty-${idx}`} />;
                          }
                          const isPast = isBulkDatePast(cell.date);
                          const isToday = isBulkDateToday(cell.date);
                          const isSelected = bulkSelectedDates.includes(cell.dateStr);
                          const isMaxed = bulkSelectedDates.length >= 10 && !isSelected;

                          return (
                            <button
                              key={cell.dateStr}
                              onClick={() => !isPast && !isMaxed && toggleBulkDate(cell.dateStr!)}
                              disabled={isPast || isMaxed}
                              className={[
                                'w-full aspect-square flex items-center justify-center rounded text-sm transition-colors',
                                isPast
                                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : isToday
                                  ? 'ring-2 ring-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                  : isMaxed
                                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                              ].join(' ')}
                            >
                              {cell.date.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {bulkSelectedDates.length >= 10 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Maximum 10 dates selected</p>
                    )}
                  </div>

                  {/* Quick select buttons */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quick select</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={bulkQuickSelectSameDayNextWeeks}
                        className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40"
                      >
                        Same day next 4 weeks
                      </button>
                      <button
                        onClick={bulkQuickSelectEveryWeekdayInMonth}
                        className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40"
                      >
                        Every {getWeekdayName()} in {bulkCalendarMonth.toLocaleDateString('en-US', { month: 'long' })}
                      </button>
                    </div>
                  </div>

                  {/* Selected dates list */}
                  {bulkSelectedDates.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Selected dates ({bulkSelectedDates.length}):
                      </p>
                      <ul className="space-y-1">
                        {bulkSelectedDates.map(dateStr => (
                          <li key={dateStr} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{formatBulkDate(dateStr)}</span>
                            <button
                              onClick={() => removeBulkDate(dateStr)}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 ml-2"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Preview summary */}
                  {bulkSelectedDates.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium">Preview: Will create {bulkSelectedDates.length} new lab day{bulkSelectedDates.length !== 1 ? 's' : ''}</p>
                      <p className="text-xs mt-0.5 text-blue-600 dark:text-blue-400">
                        Each with the same stations, skills, and configuration
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700 flex-shrink-0">
              {bulkDuplicateProgress.status === 'done' ? (
                <button
                  onClick={() => setShowBulkDuplicateModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowBulkDuplicateModal(false)}
                    disabled={bulkDuplicating}
                    className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDuplicate}
                    disabled={bulkSelectedDates.length === 0 || bulkDuplicating}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                  >
                    {bulkDuplicating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {bulkDuplicating
                      ? 'Creating...'
                      : `Create ${bulkSelectedDates.length} Lab Day${bulkSelectedDates.length !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Lab Day Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Duplicate Lab Day
              </h2>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will create a copy of <strong className="text-gray-900 dark:text-white">{labDay?.date ? formatDate(labDay.date) : 'this lab day'}</strong> with all its stations, skills, and configuration on a new date.
              </p>

              {labDay && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p><span className="font-medium">Stations:</span> {labDay.stations?.length ?? 0}</p>
                  <p><span className="font-medium">Rotations:</span> {labDay.num_rotations} x {labDay.rotation_duration} min</p>
                  {labDay.title && <p><span className="font-medium">Title:</span> {labDay.title}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Date
                </label>
                <input
                  type="date"
                  value={duplicateDate}
                  onChange={e => setDuplicateDate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowDuplicateModal(false)}
                disabled={duplicating}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicate}
                disabled={!duplicateDate || duplicating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {duplicating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {duplicating ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Diff Modal */}
      {showDiffModal && labDay.source_template && (
        <TemplateDiffModal
          labDayId={labDay.id}
          templateId={labDay.source_template.id}
          templateName={labDay.source_template.name}
          onClose={() => setShowDiffModal(false)}
          onApplied={() => {
            setShowDiffModal(false);
            toast.success('Template updated successfully');
            fetchLabDay();
          }}
        />
      )}

      {/* Copy to Next Week Confirm Dialog */}
      {showNextWeekConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Copy to Next Week
              </h2>
              <button
                onClick={() => setShowNextWeekConfirm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Copy this lab day to{' '}
                <strong className="text-gray-900 dark:text-white">
                  {getNextWeekDate() ? formatDate(getNextWeekDate()) : 'next week'}
                </strong>
                ? All stations, skills, and configuration will be copied.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowNextWeekConfirm(false)}
                disabled={copyingNextWeek}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyToNextWeek}
                disabled={copyingNextWeek}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {copyingNextWeek ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                {copyingNextWeek ? 'Copying...' : 'Copy to Next Week'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
