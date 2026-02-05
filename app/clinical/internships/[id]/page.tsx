'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Save,
  ArrowLeft,
  User,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  Mail,
  MapPin,
  FileText,
  Users,
  Bell,
  Award,
  ClipboardCheck,
  AlertCircle,
  CheckSquare,
  ExternalLink,
  X
} from 'lucide-react';
import { canAccessClinical, canEditClinical, type Role } from '@/lib/permissions';

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
  status: string;
  phase_1_start_date: string | null;
  phase_1_end_date: string | null;
  phase_1_eval_scheduled: string | null;
  phase_1_eval_completed: boolean;
  phase_1_eval_notes: string | null;
  phase_2_start_date: string | null;
  phase_2_end_date: string | null;
  phase_2_eval_scheduled: string | null;
  phase_2_eval_completed: boolean;
  phase_2_eval_notes: string | null;
  closeout_meeting_date: string | null;
  closeout_completed: boolean;
  // Clearance fields (legacy S2 - kept for data but not displayed)
  liability_form_completed: boolean;
  background_check_completed: boolean;
  drug_screen_completed: boolean;
  immunizations_verified: boolean;
  cpr_card_verified: boolean;
  // New closeout workflow fields
  internship_completion_date: string | null;
  snhd_submitted: boolean;
  snhd_submitted_date: string | null;
  cleared_for_nremt: boolean;
  nremt_clearance_date: string | null;
  ryan_notified: boolean;
  ryan_notified_date: string | null;
  // Exam fields
  written_exam_date: string | null;
  written_exam_passed: boolean;
  psychomotor_exam_date: string | null;
  psychomotor_exam_passed: boolean;
  // Course completion
  course_completion_date: string | null;
  // Meeting poll IDs
  phase_1_meeting_poll_id: string | null;
  phase_1_meeting_scheduled: string | null;
  phase_2_meeting_poll_id: string | null;
  phase_2_meeting_scheduled: string | null;
  final_exam_poll_id: string | null;
  final_exam_scheduled: string | null;
  // Extension tracking
  is_extended: boolean;
  extension_reason: string | null;
  extension_date: string | null;
  original_expected_end_date: string | null;
  extension_eval_completed: boolean;
  extension_eval_date: string | null;
  extension_eval_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    cohort_id: string | null;
    status: string | null;
  } | null;
  cohorts: {
    id: string;
    cohort_number: string;
    programs: {
      id: string;
      name: string;
      abbreviation: string;
    } | null;
  } | null;
  field_preceptors: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    station: string | null;
    agency_name: string | null;
  } | null;
  agencies: {
    id: string;
    name: string;
    abbreviation: string | null;
    phone: string | null;
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

// Checklist item definition
interface ChecklistItem {
  key: string;
  label: string;
  dateKey?: string;
  required: boolean;
}

const PLACEMENT_ITEMS: ChecklistItem[] = [
  { key: 'agency_id', label: 'Agency Assigned', required: true },
  { key: 'preceptor_id', label: 'Preceptor Assigned', required: true },
  { key: 'placement_date', label: 'Placement Date Set', dateKey: 'placement_date', required: true },
  { key: 'orientation_completed', label: 'Orientation Completed', dateKey: 'orientation_date', required: true },
];

// Exam tracking items
const EXAM_ITEMS: ChecklistItem[] = [
  { key: 'written_exam_passed', label: 'Written Exam', dateKey: 'written_exam_date', required: true },
  { key: 'psychomotor_exam_passed', label: 'Psychomotor Exam', dateKey: 'psychomotor_exam_date', required: true },
];

const PHASE1_ITEMS: ChecklistItem[] = [
  { key: 'internship_start_date', label: 'Internship Started', dateKey: 'internship_start_date', required: true },
  { key: 'phase_1_start_date', label: 'Phase 1 Started', dateKey: 'phase_1_start_date', required: true },
  { key: 'phase_1_eval_scheduled', label: 'Evaluation Scheduled', dateKey: 'phase_1_eval_scheduled', required: true },
  { key: 'phase_1_eval_completed', label: 'Phase 1 Evaluation Completed', required: true },
];

const PHASE2_ITEMS: ChecklistItem[] = [
  { key: 'phase_2_start_date', label: 'Phase 2 Started', dateKey: 'phase_2_start_date', required: true },
  { key: 'phase_2_eval_scheduled', label: 'Evaluation Scheduled', dateKey: 'phase_2_eval_scheduled', required: true },
  { key: 'phase_2_eval_completed', label: 'Phase 2 Evaluation Completed', required: true },
];

// New organized closeout workflow: Internship Completion → SNHD Requirements → NREMT Clearance → Closeout Meeting
const CLOSEOUT_ITEMS: ChecklistItem[] = [
  { key: 'internship_completion_date', label: 'Internship Completed', dateKey: 'internship_completion_date', required: true },
  { key: 'snhd_submitted', label: 'SNHD Requirements Submitted', dateKey: 'snhd_submitted_date', required: true },
  { key: 'cleared_for_nremt', label: 'NREMT Clearance', dateKey: 'nremt_clearance_date', required: true },
  { key: 'closeout_completed', label: 'Closeout Meeting Completed', dateKey: 'closeout_meeting_date', required: true },
];

export default function InternshipDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const internshipId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [internship, setInternship] = useState<Internship | null>(null);
  const [preceptors, setPreceptors] = useState<Preceptor[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddPreceptorModal, setShowAddPreceptorModal] = useState(false);
  const [newPreceptor, setNewPreceptor] = useState({ first_name: '', last_name: '', email: '', phone: '', agency_name: '' });
  const [addingPreceptor, setAddingPreceptor] = useState(false);
  // Multi-preceptor assignments
  const [preceptorAssignments, setPreceptorAssignments] = useState<any[]>([]);
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [newAssignRole, setNewAssignRole] = useState('primary');
  const [newAssignPreceptorId, setNewAssignPreceptorId] = useState('');

  // Form state with all fields
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (session && internshipId) {
      fetchData();
    }
  }, [session, internshipId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      const [internshipRes, preceptorsRes, agenciesRes, assignmentsRes] = await Promise.all([
        fetch(`/api/clinical/internships/${internshipId}`),
        fetch('/api/clinical/preceptors?activeOnly=true'),
        fetch('/api/clinical/agencies'),
        fetch(`/api/clinical/preceptor-assignments?internshipId=${internshipId}&activeOnly=false`),
      ]);

      const internshipData = await internshipRes.json();
      const preceptorsData = await preceptorsRes.json();
      const agenciesData = await agenciesRes.json();
      const assignmentsData = await assignmentsRes.json();

      if (assignmentsData.success) {
        setPreceptorAssignments(assignmentsData.assignments || []);
      }

      if (internshipData.success && internshipData.internship) {
        setInternship(internshipData.internship);
        const i = internshipData.internship;
        setFormData({
          preceptor_id: i.preceptor_id || '',
          agency_id: i.agency_id || '',
          shift_type: i.shift_type || '12_hour',
          current_phase: i.current_phase || 'pre_internship',
          status: i.status || 'not_started',
          placement_date: i.placement_date || '',
          orientation_date: i.orientation_date || '',
          orientation_completed: i.orientation_completed || false,
          internship_start_date: i.internship_start_date || '',
          expected_end_date: i.expected_end_date || '',
          actual_end_date: i.actual_end_date || '',
          phase_1_start_date: i.phase_1_start_date || '',
          phase_1_end_date: i.phase_1_end_date || '',
          phase_1_eval_scheduled: i.phase_1_eval_scheduled || '',
          phase_1_eval_completed: i.phase_1_eval_completed || false,
          phase_1_eval_notes: i.phase_1_eval_notes || '',
          phase_2_start_date: i.phase_2_start_date || '',
          phase_2_end_date: i.phase_2_end_date || '',
          phase_2_eval_scheduled: i.phase_2_eval_scheduled || '',
          phase_2_eval_completed: i.phase_2_eval_completed || false,
          phase_2_eval_notes: i.phase_2_eval_notes || '',
          closeout_meeting_date: i.closeout_meeting_date || '',
          closeout_completed: i.closeout_completed || false,
          // Legacy S2 fields (kept for data compatibility)
          liability_form_completed: i.liability_form_completed || false,
          background_check_completed: i.background_check_completed || false,
          drug_screen_completed: i.drug_screen_completed || false,
          immunizations_verified: i.immunizations_verified || false,
          cpr_card_verified: i.cpr_card_verified || false,
          // New closeout workflow fields
          internship_completion_date: i.internship_completion_date || '',
          snhd_submitted: i.snhd_submitted || false,
          snhd_submitted_date: i.snhd_submitted_date || '',
          cleared_for_nremt: i.cleared_for_nremt || false,
          nremt_clearance_date: i.nremt_clearance_date || '',
          ryan_notified: i.ryan_notified || false,
          ryan_notified_date: i.ryan_notified_date || '',
          // Exam fields
          written_exam_date: i.written_exam_date || '',
          written_exam_passed: i.written_exam_passed || false,
          psychomotor_exam_date: i.psychomotor_exam_date || '',
          psychomotor_exam_passed: i.psychomotor_exam_passed || false,
          course_completion_date: i.course_completion_date || '',
          // Meeting poll IDs
          phase_1_meeting_poll_id: i.phase_1_meeting_poll_id || '',
          phase_1_meeting_scheduled: i.phase_1_meeting_scheduled || '',
          phase_2_meeting_poll_id: i.phase_2_meeting_poll_id || '',
          phase_2_meeting_scheduled: i.phase_2_meeting_scheduled || '',
          final_exam_poll_id: i.final_exam_poll_id || '',
          final_exam_scheduled: i.final_exam_scheduled || '',
          notes: i.notes || '',
          // Extension tracking
          is_extended: i.is_extended || false,
          extension_reason: i.extension_reason || '',
          extension_date: i.extension_date || '',
          original_expected_end_date: i.original_expected_end_date || '',
          extension_eval_completed: i.extension_eval_completed || false,
          extension_eval_date: i.extension_eval_date || '',
          extension_eval_notes: i.extension_eval_notes || '',
        });
      } else {
        console.error('Failed to load internship:', internshipData.error, internshipData.debug);
        const debugInfo = internshipData.debug ? ` (Queried ID: ${internshipData.debug.queriedId})` : '';
        setError(`${internshipData.error || 'Failed to load internship record'}${debugInfo}`);
      }

      setPreceptors(preceptorsData.preceptors || []);
      setAgencies(agenciesData.agencies || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Sync "Internship Started" and "Phase 1 Started" dates
      // When one is set, auto-fill the other if it's empty
      if (field === 'internship_start_date' && value && !prev.phase_1_start_date) {
        updated.phase_1_start_date = value;
      }
      if (field === 'phase_1_start_date' && value && !prev.internship_start_date) {
        updated.internship_start_date = value;
      }

      return updated;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!userRole || !canEditClinical(userRole)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setHasChanges(false);
        showToast('Changes saved successfully', 'success');
        await fetchData();
      } else {
        console.error('Save failed:', data.error, data.code);
        showToast(data.error || 'Failed to save changes', 'error');
      }
    } catch (error) {
      console.error('Error saving:', error);
      showToast('Network error saving changes', 'error');
    }
    setSaving(false);
  };

  const handleNotifyRyan = async () => {
    if (!canEdit || !isClearedForNREMT) return;

    setNotifying(true);
    try {
      // Mark as notified and save
      const updatedData = {
        ...formData,
        ryan_notified: true,
        ryan_notified_date: new Date().toISOString().split('T')[0],
      };

      const res = await fetch(`/api/clinical/internships/${internshipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();
      if (data.success) {
        setFormData(updatedData);
        setHasChanges(false);
        showToast('Ryan has been notified! Student is cleared for NREMT.', 'success');
        await fetchData();
      } else {
        showToast('Failed to notify', 'error');
      }
    } catch (error) {
      console.error('Error notifying:', error);
      showToast('Failed to notify', 'error');
    }
    setNotifying(false);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddPreceptor = async () => {
    if (!newPreceptor.first_name.trim() || !newPreceptor.last_name.trim()) {
      showToast('First and last name are required', 'error');
      return;
    }

    setAddingPreceptor(true);
    try {
      const res = await fetch('/api/clinical/preceptors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newPreceptor.first_name.trim(),
          last_name: newPreceptor.last_name.trim(),
          email: newPreceptor.email.trim() || null,
          phone: newPreceptor.phone.trim() || null,
          agency_name: newPreceptor.agency_name.trim() || null,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.preceptor) {
        // Add to list and auto-select
        setPreceptors([...preceptors, data.preceptor]);
        handleInputChange('preceptor_id', data.preceptor.id);
        setShowAddPreceptorModal(false);
        setNewPreceptor({ first_name: '', last_name: '', email: '', phone: '', agency_name: '' });
        showToast('Preceptor added successfully', 'success');
      } else {
        showToast(data.error || 'Failed to add preceptor', 'error');
      }
    } catch (error) {
      console.error('Error adding preceptor:', error);
      showToast('Failed to add preceptor', 'error');
    }
    setAddingPreceptor(false);
  };

  // Calculate progress
  const isItemComplete = (item: ChecklistItem): boolean => {
    if (item.key === 'agency_id' || item.key === 'preceptor_id') {
      return !!formData[item.key];
    }
    if (item.dateKey) {
      return !!formData[item.dateKey];
    }
    return !!formData[item.key];
  };

  const calculateSectionProgress = (items: ChecklistItem[]): number => {
    const completed = items.filter(item => isItemComplete(item)).length;
    return Math.round((completed / items.length) * 100);
  };

  const placementProgress = calculateSectionProgress(PLACEMENT_ITEMS);
  const examProgress = calculateSectionProgress(EXAM_ITEMS);
  const phase1Progress = calculateSectionProgress(PHASE1_ITEMS);
  const phase2Progress = calculateSectionProgress(PHASE2_ITEMS);
  const closeoutProgress = calculateSectionProgress(CLOSEOUT_ITEMS);

  const totalItems = PLACEMENT_ITEMS.length + EXAM_ITEMS.length + PHASE1_ITEMS.length + PHASE2_ITEMS.length + CLOSEOUT_ITEMS.length;
  const completedItems = [...PLACEMENT_ITEMS, ...EXAM_ITEMS, ...PHASE1_ITEMS, ...PHASE2_ITEMS, ...CLOSEOUT_ITEMS].filter(isItemComplete).length;
  const overallProgress = Math.round((completedItems / totalItems) * 100);

  // Check if cleared for NREMT (all required items complete)
  const allRequiredItems = [...PLACEMENT_ITEMS, ...EXAM_ITEMS, ...PHASE1_ITEMS, ...PHASE2_ITEMS, ...CLOSEOUT_ITEMS].filter(i => i.required);
  const isClearedForNREMT = allRequiredItems.every(isItemComplete);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
              <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
                <Home className="w-3 h-3" />
                Home
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
              <ChevronRight className="w-4 h-4" />
              <Link href="/clinical/internships" className="hover:text-teal-600 dark:hover:text-teal-400">Internships</Link>
            </div>
          </div>
        </div>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Internship</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <Link
              href="/clinical/internships"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Internships
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!internship) return null;

  const student = internship.students;
  const canEdit = userRole ? canEditClinical(userRole) : false;

  // Checklist item component
  const ChecklistRow = ({ item, section }: { item: ChecklistItem; section: string }) => {
    const isComplete = isItemComplete(item);
    const dateValue = item.dateKey ? formData[item.dateKey] : null;
    const isCheckbox = !item.dateKey || (item.dateKey && typeof formData[item.key] === 'boolean');

    return (
      <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
        isComplete ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/30'
      }`}>
        <div className="flex items-center gap-3">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
          <span className={`text-sm ${isComplete ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
            {item.label}
            {item.required && <span className="text-red-500 ml-1">*</span>}
          </span>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {item.dateKey && (
              <input
                type="date"
                value={formData[item.dateKey] || ''}
                onChange={(e) => handleInputChange(item.dateKey!, e.target.value)}
                className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            )}
            {isCheckbox && item.key !== 'agency_id' && item.key !== 'preceptor_id' && (
              <input
                type="checkbox"
                checked={!!formData[item.key]}
                onChange={(e) => handleInputChange(item.key, e.target.checked)}
                className="w-5 h-5 text-teal-600 rounded"
              />
            )}
          </div>
        )}

        {!canEdit && dateValue && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(dateValue)}</span>
        )}
      </div>
    );
  };

  // Closeout step component with auto-date buttons
  const CloseoutStep = ({
    step,
    label,
    description,
    dateKey,
    dateValue,
    isComplete,
    onMarkComplete,
    onDateChange,
    onClear,
    canEdit,
    buttonLabel,
  }: {
    step: number;
    label: string;
    description: string;
    dateKey: string;
    dateValue: string;
    isComplete: boolean;
    onMarkComplete: () => void;
    onDateChange: (date: string) => void;
    onClear: () => void;
    canEdit: boolean;
    buttonLabel: string;
  }) => {
    return (
      <div className={`p-3 rounded-lg border-2 transition-all ${
        isComplete
          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isComplete
                ? 'bg-green-500 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}>
              {isComplete ? <CheckCircle2 className="w-5 h-5" /> : step}
            </div>
            <div>
              <div className={`font-medium ${isComplete ? 'text-green-800 dark:text-green-300' : 'text-gray-900 dark:text-white'}`}>
                {label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
              {dateValue && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Completed: {formatDate(dateValue)}
                </div>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isComplete ? (
                <button
                  onClick={onMarkComplete}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {buttonLabel}
                </button>
              ) : (
                <button
                  onClick={onClear}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Undo
                </button>
              )}
              <input
                type="date"
                value={dateValue || ''}
                onChange={(e) => onDateChange(e.target.value)}
                className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white w-32"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical/internships" className="hover:text-teal-600 dark:hover:text-teal-400">Internships</Link>
            <ChevronRight className="w-4 h-4" />
            <span>{student?.first_name} {student?.last_name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/clinical/internships"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>

              <div className="w-14 h-14 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                <User className="w-7 h-7 text-teal-600 dark:text-teal-400" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {student?.first_name} {student?.last_name}
                </h1>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  {internship.cohorts && (
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {internship.cohorts.programs?.abbreviation} - Cohort {internship.cohorts.cohort_number}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canEdit && hasChanges && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Overall Progress Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Internship Progress</h2>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">{overallProgress}%</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{completedItems} of {totalItems} items</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {/* Section Progress Indicators */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{placementProgress}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Placement</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{examProgress}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Exams</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{phase1Progress}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Phase 1</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{phase2Progress}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Phase 2</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{closeoutProgress}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Closeout</div>
            </div>
          </div>

          {/* NREMT Clearance Status */}
          <div className={`mt-6 p-4 rounded-lg ${
            isClearedForNREMT
              ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500'
              : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className={`w-6 h-6 ${isClearedForNREMT ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                <div>
                  <div className={`font-semibold ${isClearedForNREMT ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    {isClearedForNREMT ? 'Cleared for NREMT!' : 'Not Yet Cleared for NREMT'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {isClearedForNREMT
                      ? 'All required items completed. Student can proceed to NREMT exam.'
                      : `${allRequiredItems.filter(i => !isItemComplete(i)).length} required items remaining`}
                  </div>
                </div>
              </div>

              {canEdit && isClearedForNREMT && !formData.ryan_notified && (
                <button
                  onClick={handleNotifyRyan}
                  disabled={notifying}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  Notify Ryan
                </button>
              )}

              {formData.ryan_notified && (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm">Notified {formData.ryan_notified_date && formatDate(formData.ryan_notified_date)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Placement & Pre-Requisites */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Placement & Pre-Requisites</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    placementProgress === 100
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {placementProgress}%
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {/* Agency & Preceptor Selects */}
                {canEdit && (
                  <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Agency</label>
                      <select
                        value={formData.agency_id || ''}
                        onChange={(e) => handleInputChange('agency_id', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      >
                        <option value="">Select Agency</option>
                        {agencies.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preceptor Assignments</label>

                      {/* Current assignments */}
                      <div className="space-y-2 mb-3">
                        {preceptorAssignments.filter(a => a.is_active).length === 0 && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No preceptors assigned</p>
                        )}
                        {preceptorAssignments.filter(a => a.is_active).map(assignment => (
                          <div key={assignment.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                              assignment.role === 'primary'
                                ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                                : assignment.role === 'secondary'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            }`}>
                              {assignment.role === 'primary' ? '1°' : assignment.role === 'secondary' ? '2°' : '3°'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {assignment.preceptor?.first_name} {assignment.preceptor?.last_name}
                              </div>
                              {assignment.preceptor?.agency_name && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{assignment.preceptor.agency_name}</div>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">{assignment.assigned_date}</span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch(`/api/clinical/preceptor-assignments?id=${assignment.id}`, { method: 'DELETE' });
                                  const res = await fetch(`/api/clinical/preceptor-assignments?internshipId=${internshipId}&activeOnly=false`);
                                  const data = await res.json();
                                  if (data.success) setPreceptorAssignments(data.assignments || []);
                                }}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title="Remove assignment"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Inactive/historical assignments */}
                        {preceptorAssignments.filter(a => !a.is_active).length > 0 && (
                          <details className="text-xs">
                            <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
                              {preceptorAssignments.filter(a => !a.is_active).length} previous assignment(s)
                            </summary>
                            <div className="mt-1 space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-600">
                              {preceptorAssignments.filter(a => !a.is_active).map(assignment => (
                                <div key={assignment.id} className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                                  <span className="font-medium">{assignment.preceptor?.first_name} {assignment.preceptor?.last_name}</span>
                                  <span>({assignment.role})</span>
                                  <span>{assignment.assigned_date} → {assignment.end_date || '?'}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>

                      {/* Add preceptor assignment */}
                      {canEdit && (
                        <div className="flex gap-2 items-end">
                          <select
                            value={newAssignPreceptorId}
                            onChange={(e) => setNewAssignPreceptorId(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          >
                            <option value="">Select Preceptor</option>
                            {preceptors.map(p => (
                              <option key={p.id} value={p.id}>{p.first_name} {p.last_name} {p.agency_name ? `(${p.agency_name})` : ''}</option>
                            ))}
                          </select>
                          <select
                            value={newAssignRole}
                            onChange={(e) => setNewAssignRole(e.target.value)}
                            className="px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          >
                            <option value="primary">Primary</option>
                            <option value="secondary">Secondary</option>
                            <option value="tertiary">Tertiary</option>
                          </select>
                          <button
                            type="button"
                            disabled={!newAssignPreceptorId || addingAssignment}
                            onClick={async () => {
                              setAddingAssignment(true);
                              try {
                                await fetch('/api/clinical/preceptor-assignments', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    internship_id: internshipId,
                                    preceptor_id: newAssignPreceptorId,
                                    role: newAssignRole,
                                  }),
                                });
                                // Refresh assignments
                                const res = await fetch(`/api/clinical/preceptor-assignments?internshipId=${internshipId}&activeOnly=false`);
                                const data = await res.json();
                                if (data.success) setPreceptorAssignments(data.assignments || []);
                                setNewAssignPreceptorId('');
                              } catch (err) {
                                console.error('Error adding assignment:', err);
                              }
                              setAddingAssignment(false);
                            }}
                            className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                          >
                            {addingAssignment ? '...' : 'Add'}
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowAddPreceptorModal(true)}
                        className="mt-2 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
                      >
                        + Create New Preceptor
                      </button>
                    </div>
                  </div>
                )}

                {PLACEMENT_ITEMS.map(item => (
                  <ChecklistRow key={item.key} item={item} section="placement" />
                ))}
              </div>
            </div>

            {/* Exams */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Exams</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    examProgress === 100
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {examProgress}%
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {EXAM_ITEMS.map(item => (
                  <ChecklistRow key={item.key} item={item} section="exams" />
                ))}

                {/* Course Completion Date */}
                {canEdit && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700 dark:text-gray-300">Course Completion Date</label>
                      <input
                        type="date"
                        value={formData.course_completion_date || ''}
                        onChange={(e) => handleInputChange('course_completion_date', e.target.value)}
                        className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Phase 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      1
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Phase 1 - Mentorship</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    phase1Progress === 100
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {phase1Progress}%
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {PHASE1_ITEMS.map(item => (
                  <ChecklistRow key={item.key} item={item} section="phase1" />
                ))}

                {/* Phase 1 Notes */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phase 1 Notes</label>
                  <textarea
                    value={formData.phase_1_eval_notes || ''}
                    onChange={(e) => handleInputChange('phase_1_eval_notes', e.target.value)}
                    disabled={!canEdit}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                    placeholder="Add notes..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Phase 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400">
                      2
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Phase 2 - Evaluation</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    phase2Progress === 100
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {phase2Progress}%
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {PHASE2_ITEMS.map(item => (
                  <ChecklistRow key={item.key} item={item} section="phase2" />
                ))}

                {/* Phase 2 Notes */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phase 2 Notes</label>
                  <textarea
                    value={formData.phase_2_eval_notes || ''}
                    onChange={(e) => handleInputChange('phase_2_eval_notes', e.target.value)}
                    disabled={!canEdit}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                    placeholder="Add notes..."
                  />
                </div>
              </div>
            </div>

            {/* Extension Tracking */}
            {(formData.is_extended || formData.current_phase === 'extended') && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border-2 border-amber-300 dark:border-amber-600">
                <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Extension Active</h3>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Extended</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Extension Date</label>
                      <input
                        type="date"
                        value={formData.extension_date || ''}
                        onChange={(e) => handleInputChange('extension_date', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Original End Date</label>
                      <input
                        type="date"
                        value={formData.original_expected_end_date || ''}
                        onChange={(e) => handleInputChange('original_expected_end_date', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Extension Reason</label>
                    <textarea
                      value={formData.extension_reason || ''}
                      onChange={(e) => handleInputChange('extension_reason', e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                      placeholder="Reason for extension..."
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.extension_eval_completed || false}
                        onChange={(e) => handleInputChange('extension_eval_completed', e.target.checked)}
                        disabled={!canEdit}
                        className="w-4 h-4 rounded text-amber-600"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Extension Evaluation Completed</span>
                    </label>
                    {formData.extension_eval_completed && (
                      <input
                        type="date"
                        value={formData.extension_eval_date || ''}
                        onChange={(e) => handleInputChange('extension_eval_date', e.target.value)}
                        disabled={!canEdit}
                        className="px-3 py-1 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                      />
                    )}
                  </div>
                  {formData.extension_eval_completed && (
                    <textarea
                      value={formData.extension_eval_notes || ''}
                      onChange={(e) => handleInputChange('extension_eval_notes', e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                      placeholder="Extension evaluation notes..."
                    />
                  )}
                </div>
              </div>
            )}

            {/* Mark as Extended button (when not already extended) */}
            {!formData.is_extended && formData.current_phase !== 'extended' && canEdit && (
              <button
                type="button"
                onClick={() => {
                  handleInputChange('is_extended', true);
                  handleInputChange('current_phase', 'extended');
                  handleInputChange('original_expected_end_date', formData.expected_end_date || '');
                  handleInputChange('extension_date', new Date().toISOString().split('T')[0]);
                }}
                className="w-full py-2 text-sm text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <Clock className="w-4 h-4 inline-block mr-1" />
                Mark as Extended (removes critical alerts)
              </button>
            )}

            {/* Closeout Workflow */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Closeout Workflow</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    closeoutProgress === 100
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {closeoutProgress}%
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Step 1: Internship Completion */}
                <CloseoutStep
                  step={1}
                  label="Internship Completed"
                  description="All hours and competencies completed"
                  dateKey="internship_completion_date"
                  dateValue={formData.internship_completion_date}
                  isComplete={!!formData.internship_completion_date}
                  onMarkComplete={() => {
                    const today = new Date().toISOString().split('T')[0];
                    handleInputChange('internship_completion_date', today);
                  }}
                  onDateChange={(date) => handleInputChange('internship_completion_date', date)}
                  onClear={() => handleInputChange('internship_completion_date', '')}
                  canEdit={canEdit}
                  buttonLabel="Complete"
                />

                {/* Step 2: SNHD Requirements */}
                <CloseoutStep
                  step={2}
                  label="SNHD Requirements"
                  description="Southern Nevada Health District paperwork submitted"
                  dateKey="snhd_submitted_date"
                  dateValue={formData.snhd_submitted_date}
                  isComplete={formData.snhd_submitted}
                  onMarkComplete={() => {
                    const today = new Date().toISOString().split('T')[0];
                    handleInputChange('snhd_submitted', true);
                    handleInputChange('snhd_submitted_date', today);
                  }}
                  onDateChange={(date) => {
                    handleInputChange('snhd_submitted_date', date);
                    if (date) handleInputChange('snhd_submitted', true);
                  }}
                  onClear={() => {
                    handleInputChange('snhd_submitted', false);
                    handleInputChange('snhd_submitted_date', '');
                  }}
                  canEdit={canEdit}
                  buttonLabel="Submit"
                />

                {/* Step 3: NREMT Clearance */}
                <CloseoutStep
                  step={3}
                  label="NREMT Clearance"
                  description="Cleared to take national registry exam"
                  dateKey="nremt_clearance_date"
                  dateValue={formData.nremt_clearance_date}
                  isComplete={formData.cleared_for_nremt}
                  onMarkComplete={() => {
                    const today = new Date().toISOString().split('T')[0];
                    handleInputChange('cleared_for_nremt', true);
                    handleInputChange('nremt_clearance_date', today);
                  }}
                  onDateChange={(date) => {
                    handleInputChange('nremt_clearance_date', date);
                    if (date) handleInputChange('cleared_for_nremt', true);
                  }}
                  onClear={() => {
                    handleInputChange('cleared_for_nremt', false);
                    handleInputChange('nremt_clearance_date', '');
                  }}
                  canEdit={canEdit}
                  buttonLabel="Clear"
                />

                {/* Step 4: Closeout Meeting */}
                <CloseoutStep
                  step={4}
                  label="Closeout Meeting"
                  description="Final meeting with student completed"
                  dateKey="closeout_meeting_date"
                  dateValue={formData.closeout_meeting_date}
                  isComplete={formData.closeout_completed}
                  onMarkComplete={() => {
                    const today = new Date().toISOString().split('T')[0];
                    handleInputChange('closeout_completed', true);
                    handleInputChange('closeout_meeting_date', today);
                  }}
                  onDateChange={(date) => {
                    handleInputChange('closeout_meeting_date', date);
                    if (date) handleInputChange('closeout_completed', true);
                  }}
                  onClear={() => {
                    handleInputChange('closeout_completed', false);
                    handleInputChange('closeout_meeting_date', '');
                  }}
                  canEdit={canEdit}
                  buttonLabel="Complete"
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                Contact Information
              </h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Student</div>
                  {student?.email && (
                    <a href={`mailto:${student.email}`} className="flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline">
                      <Mail className="w-3 h-3" /> {student.email}
                    </a>
                  )}
                </div>

                {internship.field_preceptors && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Preceptor</div>
                    <div className="text-gray-900 dark:text-white">
                      {internship.field_preceptors.first_name} {internship.field_preceptors.last_name}
                    </div>
                    {internship.field_preceptors.email && (
                      <a href={`mailto:${internship.field_preceptors.email}`} className="flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline">
                        <Mail className="w-3 h-3" /> Email
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Meeting Scheduling */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-cyan-50 dark:bg-cyan-900/20">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Meeting Scheduling</h3>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Phase 1 Meeting */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Phase 1 Evaluation</div>
                    {formData.phase_1_meeting_scheduled && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Scheduled: {formatDate(formData.phase_1_meeting_scheduled)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <input
                        type="text"
                        value={formData.phase_1_meeting_poll_id || ''}
                        onChange={(e) => handleInputChange('phase_1_meeting_poll_id', e.target.value)}
                        placeholder="Rallly poll ID"
                        className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white w-32"
                      />
                    )}
                    {formData.phase_1_meeting_poll_id && (
                      <a
                        href={`https://rallly.co/p/${formData.phase_1_meeting_poll_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded"
                      >
                        View Poll <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {!formData.phase_1_meeting_poll_id && (
                      <a
                        href="https://rallly.co/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        Create Poll <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Phase 2 Meeting */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Phase 2 Evaluation</div>
                    {formData.phase_2_meeting_scheduled && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Scheduled: {formatDate(formData.phase_2_meeting_scheduled)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <input
                        type="text"
                        value={formData.phase_2_meeting_poll_id || ''}
                        onChange={(e) => handleInputChange('phase_2_meeting_poll_id', e.target.value)}
                        placeholder="Rallly poll ID"
                        className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white w-32"
                      />
                    )}
                    {formData.phase_2_meeting_poll_id && (
                      <a
                        href={`https://rallly.co/p/${formData.phase_2_meeting_poll_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded"
                      >
                        View Poll <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {!formData.phase_2_meeting_poll_id && (
                      <a
                        href="https://rallly.co/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        Create Poll <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Final Exam Meeting */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Final Exam</div>
                    {formData.final_exam_scheduled && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Scheduled: {formatDate(formData.final_exam_scheduled)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <input
                        type="text"
                        value={formData.final_exam_poll_id || ''}
                        onChange={(e) => handleInputChange('final_exam_poll_id', e.target.value)}
                        placeholder="Rallly poll ID"
                        className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white w-32"
                      />
                    )}
                    {formData.final_exam_poll_id && (
                      <a
                        href={`https://rallly.co/p/${formData.final_exam_poll_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded"
                      >
                        View Poll <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {!formData.final_exam_poll_id && (
                      <a
                        href="https://rallly.co/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        Create Poll <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            General Notes
          </h3>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            disabled={!canEdit}
            rows={4}
            placeholder="Add general notes about this internship..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          />
        </div>
      </main>

      {/* Add Preceptor Modal */}
      {showAddPreceptorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Add New Preceptor</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newPreceptor.first_name}
                    onChange={(e) => setNewPreceptor({ ...newPreceptor, first_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newPreceptor.last_name}
                    onChange={(e) => setNewPreceptor({ ...newPreceptor, last_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={newPreceptor.email}
                  onChange={(e) => setNewPreceptor({ ...newPreceptor, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newPreceptor.phone}
                  onChange={(e) => setNewPreceptor({ ...newPreceptor, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="(702) 555-1234"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Agency Name</label>
                <input
                  type="text"
                  value={newPreceptor.agency_name}
                  onChange={(e) => setNewPreceptor({ ...newPreceptor, agency_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="Agency name"
                />
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddPreceptorModal(false);
                  setNewPreceptor({ first_name: '', last_name: '', email: '', phone: '', agency_name: '' });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPreceptor}
                disabled={addingPreceptor}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
              >
                {addingPreceptor ? 'Adding...' : 'Add Preceptor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
