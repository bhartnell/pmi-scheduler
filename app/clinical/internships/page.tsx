'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  Home,
  ClipboardList,
  Plus,
  Search,
  Filter,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  X,
  Eye,
  Edit2,
  Save,
  UserPlus,
  AlertCircle,
  Calendar,
  Bell,
  Loader2
} from 'lucide-react';
import { canEditClinical, isSuperadmin, type Role } from '@/lib/permissions';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
}

interface Cohort {
  id: string;
  cohort_number: number;
  programs: {
    id: string;
    name: string;
    abbreviation: string;
  } | null;
}

interface Preceptor {
  id: string;
  first_name: string;
  last_name: string;
  agency_name: string | null;
  station: string | null;
}

interface Agency {
  id: string;
  name: string;
  abbreviation: string | null;
}

interface Internship {
  id: string;
  student_id: string;
  cohort_id: string | null;
  preceptor_id: string | null;
  agency_id: string | null;
  agency_name: string | null;
  shift_type: string;
  placement_date: string | null;
  orientation_date: string | null;
  orientation_completed: boolean;
  internship_start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  current_phase: string;
  phase_1_start_date: string | null;
  phase_1_eval_scheduled: string | null;
  phase_1_eval_completed: boolean;
  phase_2_start_date: string | null;
  phase_2_eval_scheduled: string | null;
  phase_2_eval_completed: boolean;
  closeout_meeting_date: string | null;
  closeout_completed: boolean;
  // Clearance fields
  liability_form_completed: boolean;
  background_check_completed: boolean;
  drug_screen_completed: boolean;
  immunizations_verified: boolean;
  cpr_card_verified: boolean;
  cleared_for_nremt: boolean;
  status: string;
  // Phase extension tracking
  phase_1_extended: boolean;
  phase_1_extended_until: string | null;
  phase_1_extension_reason: string | null;
  is_extended: boolean;
  students: Student | null;
  cohorts: Cohort | null;
  field_preceptors: Preceptor | null;
  agencies: Agency | null;
}

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

// Combined view item - either has internship or just student
interface StudentRow {
  student: Student;
  internship: Internship | null;
  hasRecord: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  pre_internship: 'Pre-Internship',
  phase_1_mentorship: 'Phase 1 - Mentorship',
  phase_2_evaluation: 'Phase 2 - Evaluation',
  completed: 'Completed',
  extended: 'Extended',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  on_track: { label: 'On Track', color: 'text-green-600', bgColor: 'bg-green-100' },
  at_risk: { label: 'At Risk', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  extended: { label: 'Extended', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  completed: { label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  withdrawn: { label: 'Withdrawn', color: 'text-red-600', bgColor: 'bg-red-100' },
};

// Milestone status helpers
type MilestoneStatus = 'complete' | 'due_soon' | 'due_week' | 'overdue' | 'not_set';

const getMilestoneStatus = (dueDate: string | null, isComplete: boolean): MilestoneStatus => {
  if (isComplete) return 'complete';
  if (!dueDate) return 'not_set';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'due_week';
  if (daysUntilDue <= 14) return 'due_soon';
  return 'not_set';
};

const MILESTONE_INDICATORS: Record<MilestoneStatus, { emoji: string; className: string; label: string }> = {
  complete: { emoji: '🟢', className: 'text-green-500', label: 'Complete' },
  due_soon: { emoji: '🟡', className: 'text-yellow-500', label: 'Due in 14 days' },
  due_week: { emoji: '🟠', className: 'text-orange-500', label: 'Due in 7 days' },
  overdue: { emoji: '🔴', className: 'text-red-500', label: 'Overdue' },
  not_set: { emoji: '⚪', className: 'text-gray-300', label: 'Not set' },
};

export default function InternshipTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [internships, setInternships] = useState<Internship[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [preceptors, setPreceptors] = useState<Preceptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Filters
  const [selectedCohort, setSelectedCohort] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAgency, setFilterAgency] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyWithRecords, setShowOnlyWithRecords] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showDueThisWeek, setShowDueThisWeek] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);

  // Check if selected cohort is a PM cohort
  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);
  const isPMCohort = selectedCohortData?.program?.abbreviation === 'PM';

  // Quick edit modal for creating/editing inline
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingInternship, setEditingInternship] = useState<Internship | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingPhase, setTogglingPhase] = useState<string | null>(null);
  // Collapsible sections in edit modal
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    phase: false,
    clearance: false,
    notes: false,
  });
  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [formData, setFormData] = useState({
    student_id: '',
    cohort_id: '',
    agency_id: '',
    preceptor_id: '',
    shift_type: '12_hour',
    placement_date: '',
    internship_start_date: '',
    status: 'not_started',
    current_phase: 'pre_internship',
    notes: '',
    // Phase tracking
    orientation_date: '',
    orientation_completed: false,
    phase_1_start_date: '',
    phase_1_eval_scheduled: '',
    phase_1_eval_completed: false,
    phase_1_eval_notes: '',
    phase_2_start_date: '',
    phase_2_eval_scheduled: '',
    phase_2_eval_completed: false,
    phase_2_eval_notes: '',
    expected_end_date: '',
    // Clearance & Closeout
    closeout_meeting_date: '',
    closeout_completed: false,
    internship_completion_date: '',
    snhd_submitted: false,
    snhd_submitted_date: '',
    cleared_for_nremt: false,
    nremt_clearance_date: '',
    ryan_notified: false,
    ryan_notified_date: '',
    // Extension
    phase_1_extended: false,
    phase_1_extended_until: '',
    phase_1_extension_reason: '',
  });

  // Quick add modals
  const [showAddAgencyModal, setShowAddAgencyModal] = useState(false);
  const [showAddPreceptorModal, setShowAddPreceptorModal] = useState(false);
  const [savingAgency, setSavingAgency] = useState(false);
  const [savingPreceptor, setSavingPreceptor] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', abbreviation: '', type: 'ems' });
  const [newPreceptor, setNewPreceptor] = useState({ first_name: '', last_name: '', email: '', agency_id: '', station: '' });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  useEffect(() => {
    if (session && selectedCohort) {
      fetchInternships();
      // For PM cohorts, also fetch all students to show who needs placement
      const cohort = cohorts.find(c => c.id === selectedCohort);
      if (cohort?.program?.abbreviation === 'PM') {
        fetchCohortStudents(selectedCohort);
      } else {
        setCohortStudents([]);
      }
    }
  }, [selectedCohort, filterPhase, filterStatus, filterAgency, cohorts]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch current user
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
      }

      // Fetch cohorts, agencies, preceptors
      const [cohortsRes, agenciesRes, preceptorsRes] = await Promise.all([
        fetch('/api/lab-management/cohorts?activeOnly=true'),
        fetch('/api/clinical/agencies?type=ems'),
        fetch('/api/clinical/preceptors?activeOnly=true'),
      ]);

      const cohortsData = await cohortsRes.json();
      const agenciesData = await agenciesRes.json();
      const preceptorsData = await preceptorsRes.json();

      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
        // Auto-select first cohort
        if (cohortsData.cohorts?.length > 0 && !selectedCohort) {
          setSelectedCohort(cohortsData.cohorts[0].id);
        }
      }
      if (agenciesData.success) {
        setAgencies(agenciesData.agencies || []);
      }
      if (preceptorsData.success) {
        setPreceptors(preceptorsData.preceptors || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchInternships = async () => {
    try {
      let url = '/api/clinical/internships?';
      if (selectedCohort) url += `cohortId=${selectedCohort}&`;
      if (filterPhase) url += `phase=${filterPhase}&`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (filterAgency) url += `agencyId=${filterAgency}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setInternships(data.internships || []);
      }
    } catch (error) {
      console.error('Error fetching internships:', error);
    }
  };

  const fetchCohortStudents = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success) {
        setCohortStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  // Open edit modal for a student (either create new or edit existing)
  const openEditModal = (student: Student, internship: Internship | null) => {
    setEditingStudent(student);
    setEditingInternship(internship);

    if (internship) {
      // Editing existing internship — populate ALL fields
      setFormData({
        student_id: student.id,
        cohort_id: selectedCohort,
        agency_id: internship.agency_id || '',
        preceptor_id: internship.preceptor_id || '',
        shift_type: internship.shift_type || '12_hour',
        placement_date: internship.placement_date || '',
        internship_start_date: internship.internship_start_date || '',
        status: internship.status || 'not_started',
        current_phase: internship.current_phase || 'pre_internship',
        notes: (internship as any).notes || '',
        // Phase tracking
        orientation_date: internship.orientation_date || '',
        orientation_completed: internship.orientation_completed || false,
        phase_1_start_date: internship.phase_1_start_date || '',
        phase_1_eval_scheduled: internship.phase_1_eval_scheduled || '',
        phase_1_eval_completed: internship.phase_1_eval_completed || false,
        phase_1_eval_notes: (internship as any).phase_1_eval_notes || '',
        phase_2_start_date: internship.phase_2_start_date || '',
        phase_2_eval_scheduled: internship.phase_2_eval_scheduled || '',
        phase_2_eval_completed: internship.phase_2_eval_completed || false,
        phase_2_eval_notes: (internship as any).phase_2_eval_notes || '',
        expected_end_date: internship.expected_end_date || '',
        // Clearance & Closeout
        closeout_meeting_date: internship.closeout_meeting_date || '',
        closeout_completed: internship.closeout_completed || false,
        internship_completion_date: (internship as any).internship_completion_date || '',
        snhd_submitted: (internship as any).snhd_submitted || false,
        snhd_submitted_date: (internship as any).snhd_submitted_date || '',
        cleared_for_nremt: internship.cleared_for_nremt || false,
        nremt_clearance_date: (internship as any).nremt_clearance_date || '',
        ryan_notified: (internship as any).ryan_notified || false,
        ryan_notified_date: (internship as any).ryan_notified_date || '',
        // Extension
        phase_1_extended: internship.phase_1_extended || false,
        phase_1_extended_until: internship.phase_1_extended_until || '',
        phase_1_extension_reason: internship.phase_1_extension_reason || '',
      });
      // Expand basic section, collapse others
      setExpandedSections({ basic: true, phase: false, clearance: false, notes: false });
    } else {
      // Creating new internship for this student
      setFormData({
        student_id: student.id,
        cohort_id: selectedCohort,
        agency_id: '',
        preceptor_id: '',
        shift_type: '12_hour',
        placement_date: '',
        internship_start_date: '',
        status: 'not_started',
        current_phase: 'pre_internship',
        notes: '',
        orientation_date: '',
        orientation_completed: false,
        phase_1_start_date: '',
        phase_1_eval_scheduled: '',
        phase_1_eval_completed: false,
        phase_1_eval_notes: '',
        phase_2_start_date: '',
        phase_2_eval_scheduled: '',
        phase_2_eval_completed: false,
        phase_2_eval_notes: '',
        expected_end_date: '',
        closeout_meeting_date: '',
        closeout_completed: false,
        internship_completion_date: '',
        snhd_submitted: false,
        snhd_submitted_date: '',
        cleared_for_nremt: false,
        nremt_clearance_date: '',
        ryan_notified: false,
        ryan_notified_date: '',
        phase_1_extended: false,
        phase_1_extended_until: '',
        phase_1_extension_reason: '',
      });
      setExpandedSections({ basic: true, phase: false, clearance: false, notes: false });
    }
  };

  const closeEditModal = () => {
    setEditingStudent(null);
    setEditingInternship(null);
  };

  // Add new agency handler
  const handleAddAgency = async () => {
    if (!newAgency.name.trim()) {
      alert('Agency name is required');
      return;
    }
    setSavingAgency(true);
    try {
      const res = await fetch('/api/clinical/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgency),
      });
      const data = await res.json();
      if (data.success) {
        // Add to agencies list and auto-select
        setAgencies([...agencies, data.agency]);
        setFormData({ ...formData, agency_id: data.agency.id });
        setShowAddAgencyModal(false);
        setNewAgency({ name: '', abbreviation: '', type: 'ems' });
      } else {
        alert(data.error || 'Failed to add agency');
      }
    } catch (error) {
      console.error('Error adding agency:', error);
      alert('Failed to add agency');
    }
    setSavingAgency(false);
  };

  // Add new preceptor handler
  const handleAddPreceptor = async () => {
    if (!newPreceptor.first_name.trim() || !newPreceptor.last_name.trim()) {
      alert('First and last name are required');
      return;
    }
    setSavingPreceptor(true);
    try {
      const res = await fetch('/api/clinical/preceptors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPreceptor,
          agency_id: newPreceptor.agency_id || formData.agency_id || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Add to preceptors list and auto-select
        const newPreceptorData = {
          ...data.preceptor,
          agency_name: agencies.find(a => a.id === (newPreceptor.agency_id || formData.agency_id))?.name || null,
        };
        setPreceptors([...preceptors, newPreceptorData]);
        setFormData({ ...formData, preceptor_id: data.preceptor.id });
        setShowAddPreceptorModal(false);
        setNewPreceptor({ first_name: '', last_name: '', email: '', agency_id: '', station: '' });
      } else {
        alert(data.error || 'Failed to add preceptor');
      }
    } catch (error) {
      console.error('Error adding preceptor:', error);
      alert('Failed to add preceptor');
    }
    setSavingPreceptor(false);
  };

  const handleSaveInternship = async () => {
    if (!formData.student_id) {
      alert('Please select a student');
      return;
    }

    setSaving(true);
    try {
      let res;
      if (editingInternship) {
        // Update existing
        res = await fetch(`/api/clinical/internships/${editingInternship.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        // Create new
        res = await fetch('/api/clinical/internships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      const data = await res.json();
      if (data.success) {
        closeEditModal();
        fetchInternships();
      } else {
        alert(data.error || 'Failed to save internship record');
      }
    } catch (error) {
      console.error('Error saving internship:', error);
      alert('Failed to save internship record');
    }
    setSaving(false);
  };

  // Toggle phase completion directly from the table
  const togglePhaseCompletion = async (internshipId: string, phase: 'phase_1' | 'phase_2', currentValue: boolean) => {
    if (!userRole || !canEditClinical(userRole)) return;

    const toggleKey = `${internshipId}-${phase}`;
    setTogglingPhase(toggleKey);

    try {
      const fieldName = phase === 'phase_1' ? 'phase_1_eval_completed' : 'phase_2_eval_completed';
      const res = await fetch(`/api/clinical/internships/${internshipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: !currentValue }),
      });

      if (res.ok) {
        // Refresh the data
        await fetchInternships();
      }
    } catch (error) {
      console.error('Error toggling phase:', error);
    }
    setTogglingPhase(null);
  };

  // Calculate milestone statuses for each internship (defined early so it can be used in filters)
  const getInternshipMilestones = (internship: Internship) => {
    let p1Status = getMilestoneStatus(internship.phase_1_eval_scheduled, internship.phase_1_eval_completed);
    const p2Status = getMilestoneStatus(internship.phase_2_eval_scheduled, internship.phase_2_eval_completed);
    const endStatus = getMilestoneStatus(internship.expected_end_date, internship.status === 'completed');

    // Phase 1 extension: suppress overdue alert if phase 1 is extended and we're before the extended date
    const p1Extended = internship.phase_1_extended && internship.phase_1_extended_until;
    if (p1Extended && p1Status === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const extendedUntil = new Date(internship.phase_1_extended_until!);
      extendedUntil.setHours(0, 0, 0, 0);
      if (today <= extendedUntil) {
        // Phase 1 is extended and we're still within the extension period — downgrade from overdue
        p1Status = 'not_set'; // suppress the alert
      }
    }

    const isOverdue = p1Status === 'overdue' || p2Status === 'overdue' || endStatus === 'overdue';
    const isDueThisWeek = p1Status === 'due_week' || p2Status === 'due_week' || endStatus === 'due_week';
    const isIncomplete = internship.status !== 'completed' && internship.status !== 'withdrawn';

    // Check pre-requisites completion
    const preReqsComplete = internship.liability_form_completed &&
      internship.background_check_completed &&
      internship.drug_screen_completed &&
      internship.immunizations_verified &&
      internship.cpr_card_verified;

    return { p1Status, p2Status, endStatus, isOverdue, isDueThisWeek, isIncomplete, preReqsComplete };
  };

  // Build combined student rows for PM cohorts (spreadsheet view)
  const studentRows: StudentRow[] = isPMCohort
    ? cohortStudents.map(student => {
        const internship = internships.find(i => i.student_id === student.id) || null;
        return { student, internship, hasRecord: !!internship };
      })
    : internships.map(i => ({
        student: i.students as Student,
        internship: i,
        hasRecord: true,
      }));

  // Filter rows by search and other filters
  const filteredRows = studentRows.filter(row => {
    // Search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const studentName = `${row.student.first_name} ${row.student.last_name}`.toLowerCase();
      const preceptorName = row.internship
        ? `${row.internship.field_preceptors?.first_name || ''} ${row.internship.field_preceptors?.last_name || ''}`.toLowerCase()
        : '';
      const agencyName = row.internship?.agency_name?.toLowerCase() || '';
      if (!studentName.includes(search) && !preceptorName.includes(search) && !agencyName.includes(search)) {
        return false;
      }
    }

    // Show only with records filter
    if (showOnlyWithRecords && !row.hasRecord) {
      return false;
    }

    // Phase filter (only applies to rows with internships)
    if (filterPhase && row.internship?.current_phase !== filterPhase) {
      return false;
    }

    // Status filter (only applies to rows with internships)
    if (filterStatus && row.internship?.status !== filterStatus) {
      return false;
    }

    // Agency filter (only applies to rows with internships)
    if (filterAgency && row.internship?.agency_id !== filterAgency) {
      return false;
    }

    // New milestone filters
    if (row.internship) {
      const milestones = getInternshipMilestones(row.internship);

      // Overdue only filter
      if (showOverdueOnly && !milestones.isOverdue) {
        return false;
      }

      // Due this week filter
      if (showDueThisWeek && !milestones.isDueThisWeek) {
        return false;
      }

      // Incomplete filter
      if (showIncomplete && !milestones.isIncomplete) {
        return false;
      }
    } else {
      // If no internship record, filter out for milestone filters
      if (showOverdueOnly || showDueThisWeek || showIncomplete) {
        return false;
      }
    }

    return true;
  });

  // Sort: students without records first, then by name
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (a.hasRecord !== b.hasRecord) {
      return a.hasRecord ? 1 : -1; // No record first
    }
    return `${a.student.first_name} ${a.student.last_name}`.localeCompare(
      `${b.student.first_name} ${b.student.last_name}`
    );
  });

  // Stats
  const needsPlacement = isPMCohort ? cohortStudents.filter(s => !internships.find(i => i.student_id === s.id)).length : 0;
  const stats = {
    totalStudents: isPMCohort ? cohortStudents.length : internships.length,
    needsPlacement,
    placed: internships.length,
    phase1: internships.filter(i => i.current_phase === 'phase_1_mentorship').length,
    phase2: internships.filter(i => i.current_phase === 'phase_2_evaluation').length,
    atRisk: internships.filter(i => i.status === 'at_risk').length,
    completed: internships.filter(i => i.status === 'completed').length,
  };

  // Calculate alerts with categories: critical, action, upcoming
  const alerts = internships.reduce((acc, internship) => {
    const milestones = getInternshipMilestones(internship);

    // Check if Phase 1 is extended (show info notice instead of critical)
    const p1IsExtended = internship.phase_1_extended && internship.phase_1_extended_until;
    if (p1IsExtended) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const extUntil = new Date(internship.phase_1_extended_until!);
      extUntil.setHours(0, 0, 0, 0);
      if (today <= extUntil) {
        // Phase 1 extended — show as upcoming info notice, not critical
        acc.upcoming.push({
          internship,
          milestones,
          reason: `Phase 1 extended until ${extUntil.toLocaleDateString()}${internship.phase_1_extension_reason ? ` — ${internship.phase_1_extension_reason}` : ''}`
        });
      }
    }

    // CRITICAL: Overdue items that need immediate attention
    if (milestones.isOverdue) {
      acc.critical.push({
        internship,
        milestones,
        reason: milestones.p1Status === 'overdue' ? 'Phase 1 eval overdue' :
                milestones.p2Status === 'overdue' ? 'Phase 2 eval overdue' :
                'Expected end date passed'
      });
    }

    // ACTION: Items that need attention soon (due this week, at risk status, missing placement)
    if (milestones.isDueThisWeek && !milestones.isOverdue) {
      acc.action.push({
        internship,
        milestones,
        reason: milestones.p1Status === 'due_week' ? 'Phase 1 eval due this week' :
                milestones.p2Status === 'due_week' ? 'Phase 2 eval due this week' :
                'Expected end date this week'
      });
    }
    if (internship.status === 'at_risk' && !milestones.isOverdue) {
      const exists = acc.action.find(a => a.internship.id === internship.id);
      if (!exists) {
        acc.action.push({ internship, milestones, reason: 'At risk status' });
      }
    }

    // UPCOMING: Items due within 14 days
    const hasDueSoon = milestones.p1Status === 'due_soon' || milestones.p2Status === 'due_soon' || milestones.endStatus === 'due_soon';
    if (hasDueSoon && !milestones.isOverdue && !milestones.isDueThisWeek) {
      acc.upcoming.push({
        internship,
        milestones,
        reason: milestones.p1Status === 'due_soon' ? 'Phase 1 eval in ~2 weeks' :
                milestones.p2Status === 'due_soon' ? 'Phase 2 eval in ~2 weeks' :
                'Internship ending in ~2 weeks'
      });
    }

    return acc;
  }, {
    critical: [] as { internship: Internship; milestones: ReturnType<typeof getInternshipMilestones>; reason: string }[],
    action: [] as { internship: Internship; milestones: ReturnType<typeof getInternshipMilestones>; reason: string }[],
    upcoming: [] as { internship: Internship; milestones: ReturnType<typeof getInternshipMilestones>; reason: string }[]
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const canEdit = userRole && canEditClinical(userRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical & Internship</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Internship Tracker</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <ClipboardList className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Internship Tracker</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {isPMCohort
                    ? 'View all students and track their internship placement'
                    : 'Track student progress through internship phases'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Cohort Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 min-w-[200px]"
              >
                <option value="">Select PM Cohort</option>
                {cohorts
                  .filter(c => c.program?.abbreviation === 'PM')
                  .map(c => (
                  <option key={c.id} value={c.id}>
                    PM Group {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            {selectedCohort && (
              <>
                {/* Search */}
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student or preceptor..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>

                {/* Filters */}
                <select
                  value={filterPhase}
                  onChange={(e) => setFilterPhase(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">All Phases</option>
                  {Object.entries(PHASE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">All Statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>

                <select
                  value={filterAgency}
                  onChange={(e) => setFilterAgency(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">All Agencies</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.id}>{a.abbreviation || a.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {selectedCohort && (
          <>
            {/* Stats */}
            <div className={`grid grid-cols-2 ${isPMCohort ? 'md:grid-cols-6' : 'md:grid-cols-5'} gap-4`}>
              {isPMCohort && (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalStudents}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Students</div>
                  </div>
                  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center ${stats.needsPlacement > 0 ? 'border-2 border-orange-200 dark:border-orange-800' : ''}`}>
                    <div className={`text-2xl font-bold ${stats.needsPlacement > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>{stats.needsPlacement}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Needs Placement</div>
                  </div>
                </>
              )}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.placed}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Placed</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.phase1}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Phase 1</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.phase2}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Phase 2</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
              </div>
            </div>

            {/* Alerts Section - Organized by Category */}
            {(alerts.critical.length > 0 || alerts.action.length > 0 || alerts.upcoming.length > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Alerts</h3>
                    <div className="ml-auto flex items-center gap-2">
                      {alerts.critical.length > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                          {alerts.critical.length} critical
                        </span>
                      )}
                      {alerts.action.length > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
                          {alerts.action.length} action
                        </span>
                      )}
                      {alerts.upcoming.length > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                          {alerts.upcoming.length} upcoming
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
                  {/* Critical Alerts */}
                  {alerts.critical.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Critical</span>
                      </div>
                      <div className="space-y-2">
                        {alerts.critical.map(({ internship, reason }) => (
                          <div key={internship.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🔴</span>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {internship.students?.first_name} {internship.students?.last_name}
                                </div>
                                <div className="text-xs text-red-600 dark:text-red-400">{reason}</div>
                              </div>
                            </div>
                            <Link
                              href={`/clinical/internships/${internship.id}`}
                              className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
                            >
                              View →
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Required */}
                  {alerts.action.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Action Required</span>
                      </div>
                      <div className="space-y-2">
                        {alerts.action.map(({ internship, reason }) => (
                          <div key={`action-${internship.id}`} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🟠</span>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {internship.students?.first_name} {internship.students?.last_name}
                                </div>
                                <div className="text-xs text-orange-600 dark:text-orange-400">{reason}</div>
                              </div>
                            </div>
                            <Link
                              href={`/clinical/internships/${internship.id}`}
                              className="text-sm text-orange-600 dark:text-orange-400 hover:underline font-medium"
                            >
                              View →
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming */}
                  {alerts.upcoming.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Upcoming</span>
                      </div>
                      <div className="space-y-2">
                        {alerts.upcoming.map(({ internship, reason }) => (
                          <div key={`upcoming-${internship.id}`} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🟡</span>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {internship.students?.first_name} {internship.students?.last_name}
                                </div>
                                <div className="text-xs text-blue-600 dark:text-blue-400">{reason}</div>
                              </div>
                            </div>
                            <Link
                              href={`/clinical/internships/${internship.id}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              View →
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Filter Toggles */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
              {isPMCohort && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyWithRecords}
                    onChange={(e) => setShowOnlyWithRecords(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  With records only
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOverdueOnly}
                  onChange={(e) => setShowOverdueOnly(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <span className="flex items-center gap-1">
                  🔴 Overdue
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDueThisWeek}
                  onChange={(e) => setShowDueThisWeek(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded"
                />
                <span className="flex items-center gap-1">
                  🟠 Due This Week
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIncomplete}
                  onChange={(e) => setShowIncomplete(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                Incomplete Only
              </label>
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                Showing {sortedRows.length} {isPMCohort ? `of ${cohortStudents.length} students` : 'records'}
              </span>
            </div>

            {/* Students/Internships Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {sortedRows.length === 0 ? (
                <div className="p-8 text-center">
                  <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {isPMCohort
                      ? 'No students found in this cohort'
                      : internships.length === 0
                      ? 'No internship records for this cohort'
                      : 'No internships match your filters'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agency</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preceptor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phase</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">P1</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">P2</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {sortedRows.map((row) => {
                        const { student, internship, hasRecord } = row;
                        const statusConfig = internship
                          ? STATUS_CONFIG[internship.status] || STATUS_CONFIG.not_started
                          : null;

                        return (
                          <tr
                            key={student.id}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                              !hasRecord ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {student.first_name} {student.last_name}
                                </div>
                                {!hasRecord && (
                                  <span className="px-1.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                                    Needs placement
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {internship?.agencies?.abbreviation || internship?.agency_name || (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {internship?.field_preceptors ? (
                                <div>
                                  <div className="text-gray-900 dark:text-white">
                                    {internship.field_preceptors.first_name} {internship.field_preceptors.last_name}
                                  </div>
                                  {internship.field_preceptors.station && (
                                    <div className="text-xs text-gray-500">{internship.field_preceptors.station}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {internship ? formatDate(internship.internship_start_date) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {internship ? (
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {PHASE_LABELS[internship.current_phase] || internship.current_phase}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {internship ? (
                                (() => {
                                  const status = getMilestoneStatus(internship.phase_1_eval_scheduled, internship.phase_1_eval_completed);
                                  const indicator = MILESTONE_INDICATORS[status];
                                  const isToggling = togglingPhase === `${internship.id}-phase_1`;
                                  return canEdit ? (
                                    <button
                                      onClick={() => togglePhaseCompletion(internship.id, 'phase_1', internship.phase_1_eval_completed)}
                                      disabled={isToggling}
                                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                      title={`${indicator.label} - Click to toggle`}
                                    >
                                      {isToggling ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                      ) : (
                                        <span>{indicator.emoji}</span>
                                      )}
                                    </button>
                                  ) : (
                                    <span title={indicator.label} className="cursor-help">
                                      {indicator.emoji}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {internship ? (
                                (() => {
                                  const status = getMilestoneStatus(internship.phase_2_eval_scheduled, internship.phase_2_eval_completed);
                                  const indicator = MILESTONE_INDICATORS[status];
                                  const isToggling = togglingPhase === `${internship.id}-phase_2`;
                                  return canEdit ? (
                                    <button
                                      onClick={() => togglePhaseCompletion(internship.id, 'phase_2', internship.phase_2_eval_completed)}
                                      disabled={isToggling}
                                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                      title={`${indicator.label} - Click to toggle`}
                                    >
                                      {isToggling ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                      ) : (
                                        <span>{indicator.emoji}</span>
                                      )}
                                    </button>
                                  ) : (
                                    <span title={indicator.label} className="cursor-help">
                                      {indicator.emoji}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {statusConfig ? (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color} dark:bg-opacity-20`}>
                                  {statusConfig.label}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canEdit && (
                                  <button
                                    onClick={() => openEditModal(student, internship)}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded ${
                                      hasRecord
                                        ? 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                                        : 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30'
                                    }`}
                                  >
                                    {hasRecord ? (
                                      <>
                                        <Edit2 className="w-4 h-4" />
                                        Edit
                                      </>
                                    ) : (
                                      <>
                                        <UserPlus className="w-4 h-4" />
                                        Setup
                                      </>
                                    )}
                                  </button>
                                )}
                                {hasRecord && internship && (
                                  <Link
                                    href={`/clinical/internships/${internship.id}`}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded"
                                  >
                                    <Eye className="w-4 h-4" />
                                    View
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {!selectedCohort && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view internship records</p>
          </div>
        )}
      </main>

      {/* Edit/Create Internship Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingInternship ? 'Edit Internship Record' : 'Setup Internship'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {editingStudent.first_name} {editingStudent.last_name}
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {/* === BASIC INFO Section (accordion) === */}
              <button
                type="button"
                onClick={() => toggleSection('basic')}
                className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm font-semibold text-gray-900 dark:text-white"
              >
                <span>Basic Info</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.basic ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.basic && (
                <div className="space-y-4 px-1 pb-2">
                  {/* Agency */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Agency</label>
                      <button type="button" onClick={() => setShowAddAgencyModal(true)} className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add New
                      </button>
                    </div>
                    <select value={formData.agency_id} onChange={(e) => setFormData({ ...formData, agency_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <option value="">Select Agency</option>
                      {agencies.map(a => (<option key={a.id} value={a.id}>{a.name} {a.abbreviation ? `(${a.abbreviation})` : ''}</option>))}
                    </select>
                  </div>
                  {/* Preceptor */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preceptor</label>
                      <button type="button" onClick={() => { setNewPreceptor({ ...newPreceptor, agency_id: formData.agency_id }); setShowAddPreceptorModal(true); }} className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add New
                      </button>
                    </div>
                    <select value={formData.preceptor_id} onChange={(e) => setFormData({ ...formData, preceptor_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <option value="">Select Preceptor</option>
                      {preceptors.filter(p => !formData.agency_id || p.agency_name === agencies.find(a => a.id === formData.agency_id)?.name).map(p => (
                        <option key={p.id} value={p.id}>{p.first_name} {p.last_name} {p.agency_name ? `(${p.agency_name})` : ''} {p.station ? `- Station ${p.station}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Placement Date</label>
                      <input type="date" value={formData.placement_date} onChange={(e) => setFormData({ ...formData, placement_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                      <input type="date" value={formData.internship_start_date} onChange={(e) => setFormData({ ...formData, internship_start_date: e.target.value, phase_1_start_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                    </div>
                  </div>
                  {/* Status Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phase</label>
                      <select value={formData.current_phase} onChange={(e) => setFormData({ ...formData, current_phase: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                        {Object.entries(PHASE_LABELS).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                      <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => (<option key={value} value={value}>{config.label}</option>))}
                      </select>
                    </div>
                  </div>
                  {/* Shift Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift Type</label>
                    <select value={formData.shift_type} onChange={(e) => setFormData({ ...formData, shift_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <option value="12_hour">12-Hour Shifts</option>
                      <option value="14_hour">14-Hour Shifts</option>
                      <option value="24_hour">24-Hour Shifts</option>
                      <option value="48_hour">48-Hour Shifts</option>
                      <option value="mixed">Mixed Schedule</option>
                    </select>
                  </div>
                </div>
              )}

              {/* === PHASE STATUS Section (accordion) === */}
              {editingInternship && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSection('phase')}
                    className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    <span>Phase Status & Dates</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.phase ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.phase && (
                    <div className="space-y-4 px-1 pb-2">
                      {/* Orientation */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Orientation Date</label>
                          <input type="date" value={formData.orientation_date} onChange={(e) => setFormData({ ...formData, orientation_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="flex items-end pb-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={formData.orientation_completed} onChange={(e) => setFormData({ ...formData, orientation_completed: e.target.checked })} className="rounded" />
                            Orientation Completed
                          </label>
                        </div>
                      </div>
                      {/* Expected End Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected End Date</label>
                        <input type="date" value={formData.expected_end_date} onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                      </div>
                      {/* Phase 1 */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg space-y-3">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase">Phase 1 — Mentorship</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">P1 Start Date</label>
                            <input type="date" value={formData.phase_1_start_date} onChange={(e) => setFormData({ ...formData, phase_1_start_date: e.target.value, internship_start_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">P1 Eval Scheduled</label>
                            <input type="date" value={formData.phase_1_eval_scheduled} onChange={(e) => setFormData({ ...formData, phase_1_eval_scheduled: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={formData.phase_1_eval_completed} onChange={(e) => setFormData({ ...formData, phase_1_eval_completed: e.target.checked })} className="rounded" />
                          Phase 1 Eval Completed
                        </label>
                        <textarea value={formData.phase_1_eval_notes} onChange={(e) => setFormData({ ...formData, phase_1_eval_notes: e.target.value })} placeholder="P1 eval notes..." rows={2} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                        {/* Extension */}
                        <div className="mt-2 p-2 border border-amber-300 dark:border-amber-700 rounded bg-amber-50 dark:bg-amber-900/10 space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                            <input type="checkbox" checked={formData.phase_1_extended} onChange={(e) => setFormData({ ...formData, phase_1_extended: e.target.checked })} className="rounded" />
                            Phase 1 Extended
                          </label>
                          {formData.phase_1_extended && (
                            <div className="space-y-2 pl-6">
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Extended Until</label>
                                <input type="date" value={formData.phase_1_extended_until} onChange={(e) => setFormData({ ...formData, phase_1_extended_until: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Reason</label>
                                <input type="text" value={formData.phase_1_extension_reason} onChange={(e) => setFormData({ ...formData, phase_1_extension_reason: e.target.value })} placeholder="Reason for extension..." className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Phase 2 */}
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg space-y-3">
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase">Phase 2 — Evaluation</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">P2 Start Date</label>
                            <input type="date" value={formData.phase_2_start_date} onChange={(e) => setFormData({ ...formData, phase_2_start_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">P2 Eval Scheduled</label>
                            <input type="date" value={formData.phase_2_eval_scheduled} onChange={(e) => setFormData({ ...formData, phase_2_eval_scheduled: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={formData.phase_2_eval_completed} onChange={(e) => setFormData({ ...formData, phase_2_eval_completed: e.target.checked })} className="rounded" />
                          Phase 2 Eval Completed
                        </label>
                        <textarea value={formData.phase_2_eval_notes} onChange={(e) => setFormData({ ...formData, phase_2_eval_notes: e.target.value })} placeholder="P2 eval notes..." rows={2} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* === CLEARANCE & CLOSEOUT Section (accordion) === */}
              {editingInternship && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSection('clearance')}
                    className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    <span>Clearance & Closeout</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.clearance ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.clearance && (
                    <div className="space-y-3 px-1 pb-2">
                      {/* Completion */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Completion Date</label>
                          <input type="date" value={formData.internship_completion_date} onChange={(e) => setFormData({ ...formData, internship_completion_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Closeout Meeting</label>
                          <input type="date" value={formData.closeout_meeting_date} onChange={(e) => setFormData({ ...formData, closeout_meeting_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={formData.closeout_completed} onChange={(e) => setFormData({ ...formData, closeout_completed: e.target.checked })} className="rounded" />
                        Closeout Meeting Completed
                      </label>
                      {/* SNHD */}
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={formData.snhd_submitted} onChange={(e) => setFormData({ ...formData, snhd_submitted: e.target.checked })} className="rounded" />
                          SNHD Submitted
                        </label>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">SNHD Date</label>
                          <input type="date" value={formData.snhd_submitted_date} onChange={(e) => setFormData({ ...formData, snhd_submitted_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                        </div>
                      </div>
                      {/* NREMT */}
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={formData.cleared_for_nremt} onChange={(e) => setFormData({ ...formData, cleared_for_nremt: e.target.checked })} className="rounded" />
                          Cleared for NREMT
                        </label>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">NREMT Date</label>
                          <input type="date" value={formData.nremt_clearance_date} onChange={(e) => setFormData({ ...formData, nremt_clearance_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                        </div>
                      </div>
                      {/* Ryan Notified */}
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={formData.ryan_notified} onChange={(e) => setFormData({ ...formData, ryan_notified: e.target.checked })} className="rounded" />
                          Ryan Notified
                        </label>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Notified Date</label>
                          <input type="date" value={formData.ryan_notified_date} onChange={(e) => setFormData({ ...formData, ryan_notified_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* === NOTES Section (accordion) === */}
              {editingInternship && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSection('notes')}
                    className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    <span>Notes</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.notes ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.notes && (
                    <div className="px-1 pb-2">
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="General notes about this internship..."
                        rows={4}
                        className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Full details link for existing records */}
              {editingInternship && (
                <div className="pt-2 border-t dark:border-gray-700">
                  <Link
                    href={`/clinical/internships/${editingInternship.id}`}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    View full timeline & history →
                  </Link>
                </div>
              )}
            </div>

            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInternship}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingInternship ? 'Save Changes' : 'Create Record'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Agency Modal */}
      {showAddAgencyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Agency</h3>
              <button
                onClick={() => setShowAddAgencyModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agency Name *
                </label>
                <input
                  type="text"
                  value={newAgency.name}
                  onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
                  placeholder="e.g., Clark County Fire Department"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Abbreviation
                </label>
                <input
                  type="text"
                  value={newAgency.abbreviation}
                  onChange={(e) => setNewAgency({ ...newAgency, abbreviation: e.target.value })}
                  placeholder="e.g., CCFD"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={newAgency.type}
                  onChange={(e) => setNewAgency({ ...newAgency, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="ems">EMS Agency (Fire, Ambulance, Private)</option>
                  <option value="hospital">Hospital</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowAddAgencyModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAgency}
                disabled={savingAgency}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
              >
                {savingAgency ? 'Adding...' : 'Add Agency'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Preceptor Modal */}
      {showAddPreceptorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Preceptor</h3>
              <button
                onClick={() => setShowAddPreceptorModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newPreceptor.first_name}
                    onChange={(e) => setNewPreceptor({ ...newPreceptor, first_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newPreceptor.last_name}
                    onChange={(e) => setNewPreceptor({ ...newPreceptor, last_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newPreceptor.email}
                  onChange={(e) => setNewPreceptor({ ...newPreceptor, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agency
                </label>
                <select
                  value={newPreceptor.agency_id}
                  onChange={(e) => setNewPreceptor({ ...newPreceptor, agency_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">Select Agency</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.abbreviation ? `(${a.abbreviation})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Station
                </label>
                <input
                  type="text"
                  value={newPreceptor.station}
                  onChange={(e) => setNewPreceptor({ ...newPreceptor, station: e.target.value })}
                  placeholder="e.g., Station 32"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowAddPreceptorModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPreceptor}
                disabled={savingPreceptor}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
              >
                {savingPreceptor ? 'Adding...' : 'Add Preceptor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
