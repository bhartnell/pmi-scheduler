'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronRight,
  Home,
  Save,
  ArrowLeft,
  User,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Users,
  Bell,
  Award,
  ClipboardCheck,
  AlertCircle,
  CheckSquare
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
  // Clearance fields
  liability_form_completed: boolean;
  background_check_completed: boolean;
  drug_screen_completed: boolean;
  immunizations_verified: boolean;
  cpr_card_verified: boolean;
  uniform_issued: boolean;
  badge_issued: boolean;
  cleared_for_nremt: boolean;
  ryan_notified: boolean;
  ryan_notified_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    photo_url: string | null;
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
  { key: 'liability_form_completed', label: 'Liability Form Signed', required: true },
  { key: 'background_check_completed', label: 'Background Check', required: true },
  { key: 'drug_screen_completed', label: 'Drug Screen', required: true },
  { key: 'immunizations_verified', label: 'Immunizations Verified', required: true },
  { key: 'cpr_card_verified', label: 'CPR Card Verified', required: true },
  { key: 'uniform_issued', label: 'Uniform Issued', required: false },
  { key: 'badge_issued', label: 'Badge Issued', required: false },
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

const CLEARANCE_ITEMS: ChecklistItem[] = [
  { key: 'closeout_meeting_date', label: 'Closeout Meeting Scheduled', dateKey: 'closeout_meeting_date', required: true },
  { key: 'closeout_completed', label: 'Closeout Meeting Completed', required: true },
  { key: 'actual_end_date', label: 'Internship End Date Recorded', dateKey: 'actual_end_date', required: true },
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

      const [internshipRes, preceptorsRes, agenciesRes] = await Promise.all([
        fetch(`/api/clinical/internships/${internshipId}`),
        fetch('/api/clinical/preceptors?activeOnly=true'),
        fetch('/api/clinical/agencies'),
      ]);

      const internshipData = await internshipRes.json();
      const preceptorsData = await preceptorsRes.json();
      const agenciesData = await agenciesRes.json();

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
          liability_form_completed: i.liability_form_completed || false,
          background_check_completed: i.background_check_completed || false,
          drug_screen_completed: i.drug_screen_completed || false,
          immunizations_verified: i.immunizations_verified || false,
          cpr_card_verified: i.cpr_card_verified || false,
          uniform_issued: i.uniform_issued || false,
          badge_issued: i.badge_issued || false,
          cleared_for_nremt: i.cleared_for_nremt || false,
          ryan_notified: i.ryan_notified || false,
          ryan_notified_date: i.ryan_notified_date || '',
          notes: i.notes || '',
        });
      } else {
        router.push('/clinical/internships');
        return;
      }

      setPreceptors(preceptorsData.preceptors || []);
      setAgencies(agenciesData.agencies || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        showToast('Failed to save changes', 'error');
      }
    } catch (error) {
      console.error('Error saving:', error);
      showToast('Failed to save changes', 'error');
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
  const phase1Progress = calculateSectionProgress(PHASE1_ITEMS);
  const phase2Progress = calculateSectionProgress(PHASE2_ITEMS);
  const clearanceProgress = calculateSectionProgress(CLEARANCE_ITEMS);

  const totalItems = PLACEMENT_ITEMS.length + PHASE1_ITEMS.length + PHASE2_ITEMS.length + CLEARANCE_ITEMS.length;
  const completedItems = [...PLACEMENT_ITEMS, ...PHASE1_ITEMS, ...PHASE2_ITEMS, ...CLEARANCE_ITEMS].filter(isItemComplete).length;
  const overallProgress = Math.round((completedItems / totalItems) * 100);

  // Check if cleared for NREMT (all required items complete)
  const allRequiredItems = [...PLACEMENT_ITEMS, ...PHASE1_ITEMS, ...PHASE2_ITEMS, ...CLEARANCE_ITEMS].filter(i => i.required);
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

  if (!session || !internship) return null;

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

              {student?.photo_url ? (
                <Image
                  src={student.photo_url}
                  alt={`${student.first_name} ${student.last_name}`}
                  width={56}
                  height={56}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-14 h-14 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                  <User className="w-7 h-7 text-teal-600 dark:text-teal-400" />
                </div>
              )}

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
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{placementProgress}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Placement</div>
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
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{clearanceProgress}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Clearance</div>
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
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Preceptor</label>
                      <select
                        value={formData.preceptor_id || ''}
                        onChange={(e) => handleInputChange('preceptor_id', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      >
                        <option value="">Select Preceptor</option>
                        {preceptors.map(p => (
                          <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {PLACEMENT_ITEMS.map(item => (
                  <ChecklistRow key={item.key} item={item} section="placement" />
                ))}
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

            {/* Clearance & Closeout */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Clearance & Closeout</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    clearanceProgress === 100
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {clearanceProgress}%
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {CLEARANCE_ITEMS.map(item => (
                  <ChecklistRow key={item.key} item={item} section="clearance" />
                ))}
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
                  {student?.phone && (
                    <a href={`tel:${student.phone}`} className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mt-1">
                      <Phone className="w-3 h-3" /> {student.phone}
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
    </div>
  );
}
