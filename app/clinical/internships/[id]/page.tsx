'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronRight,
  Home,
  Briefcase,
  Save,
  ArrowLeft,
  User,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Users,
  Plus,
  Trash2,
  Edit2
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
    agency: string | null;
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
    normal_schedule: string | null;
  } | null;
  agencies: {
    id: string;
    name: string;
    abbreviation: string | null;
    phone: string | null;
  } | null;
}

interface Meeting {
  id: string;
  student_internship_id: string;
  meeting_type: string;
  scheduled_date: string;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
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

const PHASES = [
  { value: 'pre_internship', label: 'Pre-Internship', color: 'gray' },
  { value: 'phase_1_mentorship', label: 'Phase 1 - Mentorship', color: 'blue' },
  { value: 'phase_2_evaluation', label: 'Phase 2 - Evaluation', color: 'purple' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'extended', label: 'Extended', color: 'orange' },
];

const STATUSES = [
  { value: 'not_started', label: 'Not Started', color: 'gray' },
  { value: 'in_progress', label: 'In Progress', color: 'blue' },
  { value: 'on_track', label: 'On Track', color: 'green' },
  { value: 'at_risk', label: 'At Risk', color: 'yellow' },
  { value: 'extended', label: 'Extended', color: 'orange' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'red' },
];

const SHIFT_TYPES = [
  { value: '12_hour', label: '12-Hour Shifts' },
  { value: '24_hour', label: '24-Hour Shifts' },
  { value: 'mixed', label: 'Mixed Schedule' },
];

export default function InternshipDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const internshipId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [internship, setInternship] = useState<Internship | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [preceptors, setPreceptors] = useState<Preceptor[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    preceptor_id: '',
    agency_id: '',
    shift_type: '12_hour',
    current_phase: 'pre_internship',
    status: 'not_started',
    placement_date: '',
    orientation_date: '',
    internship_start_date: '',
    expected_end_date: '',
    actual_end_date: '',
    phase_1_start_date: '',
    phase_1_end_date: '',
    phase_1_eval_scheduled: '',
    phase_1_eval_completed: false,
    phase_1_eval_notes: '',
    phase_2_start_date: '',
    phase_2_end_date: '',
    phase_2_eval_scheduled: '',
    phase_2_eval_completed: false,
    phase_2_eval_notes: '',
    closeout_meeting_date: '',
    closeout_completed: false,
    notes: '',
  });

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
      // Fetch user role
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      // Fetch internship, preceptors, and agencies in parallel
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
        setMeetings(internshipData.meetings || []);

        // Initialize form data
        const i = internshipData.internship;
        setFormData({
          preceptor_id: i.preceptor_id || '',
          agency_id: i.agency_id || '',
          shift_type: i.shift_type || '12_hour',
          current_phase: i.current_phase || 'pre_internship',
          status: i.status || 'not_started',
          placement_date: i.placement_date || '',
          orientation_date: i.orientation_date || '',
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
        // Refresh data
        await fetchData();
      } else {
        alert('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save changes');
    }
    setSaving(false);
  };

  const getPhaseColor = (phase: string) => {
    const p = PHASES.find(p => p.value === phase);
    return p?.color || 'gray';
  };

  const getStatusColor = (status: string) => {
    const s = STATUSES.find(s => s.value === status);
    return s?.color || 'gray';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">
              Clinical
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical/internships" className="hover:text-teal-600 dark:hover:text-teal-400">
              Internships
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>{student?.first_name} {student?.last_name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/clinical/internships"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    getPhaseColor(formData.current_phase) === 'blue' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    getPhaseColor(formData.current_phase) === 'purple' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    getPhaseColor(formData.current_phase) === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    getPhaseColor(formData.current_phase) === 'orange' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {PHASES.find(p => p.value === formData.current_phase)?.label}
                  </span>
                </div>
              </div>
            </div>

            {canEdit && hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Student & Preceptor Info */}
          <div className="space-y-6">
            {/* Student Contact */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Student Contact
              </h3>
              <div className="space-y-3 text-sm">
                {student?.email && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${student.email}`} className="hover:text-teal-600 dark:hover:text-teal-400">
                      {student.email}
                    </a>
                  </div>
                )}
                {student?.phone && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${student.phone}`} className="hover:text-teal-600 dark:hover:text-teal-400">
                      {student.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Preceptor Assignment */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Preceptor Assignment
              </h3>

              {canEdit ? (
                <select
                  value={formData.preceptor_id}
                  onChange={(e) => handleInputChange('preceptor_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
                >
                  <option value="">Select Preceptor</option>
                  {preceptors.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} - {p.agency_name || 'No Agency'}
                    </option>
                  ))}
                </select>
              ) : null}

              {internship.field_preceptors ? (
                <div className="space-y-3 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {internship.field_preceptors.first_name} {internship.field_preceptors.last_name}
                  </div>
                  {internship.field_preceptors.agency_name && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Building2 className="w-4 h-4" />
                      {internship.field_preceptors.agency_name}
                    </div>
                  )}
                  {internship.field_preceptors.station && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      Station {internship.field_preceptors.station}
                    </div>
                  )}
                  {internship.field_preceptors.email && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4" />
                      <a href={`mailto:${internship.field_preceptors.email}`} className="hover:text-teal-600 dark:hover:text-teal-400">
                        {internship.field_preceptors.email}
                      </a>
                    </div>
                  )}
                  {internship.field_preceptors.phone && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${internship.field_preceptors.phone}`} className="hover:text-teal-600 dark:hover:text-teal-400">
                        {internship.field_preceptors.phone}
                      </a>
                    </div>
                  )}
                  {internship.field_preceptors.normal_schedule && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      {internship.field_preceptors.normal_schedule}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No preceptor assigned</p>
              )}
            </div>

            {/* Agency */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                Agency
              </h3>

              {canEdit ? (
                <select
                  value={formData.agency_id}
                  onChange={(e) => handleInputChange('agency_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
                >
                  <option value="">Select Agency</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.abbreviation ? `(${a.abbreviation})` : ''}
                    </option>
                  ))}
                </select>
              ) : null}

              {internship.agencies ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {internship.agencies.name}
                  </div>
                  {internship.agencies.phone && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${internship.agencies.phone}`} className="hover:text-teal-600 dark:hover:text-teal-400">
                        {internship.agencies.phone}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No agency assigned</p>
              )}
            </div>
          </div>

          {/* Middle Column - Dates & Status */}
          <div className="space-y-6">
            {/* Status & Phase */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status & Phase</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Phase
                  </label>
                  <select
                    value={formData.current_phase}
                    onChange={(e) => handleInputChange('current_phase', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    {PHASES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Shift Type
                  </label>
                  <select
                    value={formData.shift_type}
                    onChange={(e) => handleInputChange('shift_type', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    {SHIFT_TYPES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Key Dates */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Key Dates
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Placement Date
                  </label>
                  <input
                    type="date"
                    value={formData.placement_date}
                    onChange={(e) => handleInputChange('placement_date', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Orientation Date
                  </label>
                  <input
                    type="date"
                    value={formData.orientation_date}
                    onChange={(e) => handleInputChange('orientation_date', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Internship Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.internship_start_date}
                    onChange={(e) => handleInputChange('internship_start_date', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Expected End
                    </label>
                    <input
                      type="date"
                      value={formData.expected_end_date}
                      onChange={(e) => handleInputChange('expected_end_date', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Actual End
                    </label>
                    <input
                      type="date"
                      value={formData.actual_end_date}
                      onChange={(e) => handleInputChange('actual_end_date', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Phase Evaluations */}
          <div className="space-y-6">
            {/* Phase 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
                  1
                </div>
                Phase 1 - Mentorship
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.phase_1_start_date}
                      onChange={(e) => handleInputChange('phase_1_start_date', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.phase_1_end_date}
                      onChange={(e) => handleInputChange('phase_1_end_date', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Eval Scheduled
                  </label>
                  <input
                    type="date"
                    value={formData.phase_1_eval_scheduled}
                    onChange={(e) => handleInputChange('phase_1_eval_scheduled', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="phase_1_eval_completed"
                    checked={formData.phase_1_eval_completed}
                    onChange={(e) => handleInputChange('phase_1_eval_completed', e.target.checked)}
                    disabled={!canEdit}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="phase_1_eval_completed" className="text-sm text-gray-700 dark:text-gray-300">
                    Evaluation Completed
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Eval Notes
                  </label>
                  <textarea
                    value={formData.phase_1_eval_notes}
                    onChange={(e) => handleInputChange('phase_1_eval_notes', e.target.value)}
                    disabled={!canEdit}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400">
                  2
                </div>
                Phase 2 - Evaluation
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.phase_2_start_date}
                      onChange={(e) => handleInputChange('phase_2_start_date', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.phase_2_end_date}
                      onChange={(e) => handleInputChange('phase_2_end_date', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Eval Scheduled
                  </label>
                  <input
                    type="date"
                    value={formData.phase_2_eval_scheduled}
                    onChange={(e) => handleInputChange('phase_2_eval_scheduled', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="phase_2_eval_completed"
                    checked={formData.phase_2_eval_completed}
                    onChange={(e) => handleInputChange('phase_2_eval_completed', e.target.checked)}
                    disabled={!canEdit}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="phase_2_eval_completed" className="text-sm text-gray-700 dark:text-gray-300">
                    Evaluation Completed
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Eval Notes
                  </label>
                  <textarea
                    value={formData.phase_2_eval_notes}
                    onChange={(e) => handleInputChange('phase_2_eval_notes', e.target.value)}
                    disabled={!canEdit}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Closeout */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                Closeout
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Closeout Meeting Date
                  </label>
                  <input
                    type="date"
                    value={formData.closeout_meeting_date}
                    onChange={(e) => handleInputChange('closeout_meeting_date', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="closeout_completed"
                    checked={formData.closeout_completed}
                    onChange={(e) => handleInputChange('closeout_completed', e.target.checked)}
                    disabled={!canEdit}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="closeout_completed" className="text-sm text-gray-700 dark:text-gray-300">
                    Closeout Completed
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section - Full Width */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            disabled={!canEdit}
            rows={4}
            placeholder="Add notes about this internship..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          />
        </div>

        {/* Meeting History */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Meeting History
            </h3>
          </div>

          {meetings.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No meetings recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {meetings.map(meeting => (
                <div key={meeting.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white capitalize">
                      {meeting.meeting_type.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Scheduled: {formatDate(meeting.scheduled_date)}
                      {meeting.completed_date && ` | Completed: ${formatDate(meeting.completed_date)}`}
                    </div>
                    {meeting.notes && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {meeting.notes}
                      </div>
                    )}
                  </div>
                  {meeting.completed_date ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
