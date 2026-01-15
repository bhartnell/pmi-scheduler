'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
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
  Eye
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
  internship_start_date: string | null;
  expected_end_date: string | null;
  current_phase: string;
  phase_1_eval_completed: boolean;
  phase_2_eval_completed: boolean;
  status: string;
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

export default function InternshipTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [internships, setInternships] = useState<Internship[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [preceptors, setPreceptors] = useState<Preceptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Filters
  const [selectedCohort, setSelectedCohort] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAgency, setFilterAgency] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    cohort_id: '',
    agency_id: '',
    preceptor_id: '',
    shift_type: '12_hour',
    placement_date: '',
    status: 'not_started',
  });

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
    }
  }, [selectedCohort, filterPhase, filterStatus, filterAgency]);

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

  const fetchStudentsForCohort = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const openAddModal = () => {
    setFormData({
      student_id: '',
      cohort_id: selectedCohort,
      agency_id: '',
      preceptor_id: '',
      shift_type: '12_hour',
      placement_date: '',
      status: 'not_started',
    });
    if (selectedCohort) {
      fetchStudentsForCohort(selectedCohort);
    }
    setShowAddModal(true);
  };

  const handleAddInternship = async () => {
    if (!formData.student_id) {
      alert('Please select a student');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/clinical/internships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        fetchInternships();
      } else {
        alert(data.error || 'Failed to create internship record');
      }
    } catch (error) {
      console.error('Error creating internship:', error);
      alert('Failed to create internship record');
    }
    setSaving(false);
  };

  // Filter internships by search
  const filteredInternships = internships.filter(i => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const studentName = `${i.students?.first_name || ''} ${i.students?.last_name || ''}`.toLowerCase();
    const preceptorName = `${i.field_preceptors?.first_name || ''} ${i.field_preceptors?.last_name || ''}`.toLowerCase();
    return studentName.includes(search) || preceptorName.includes(search) || i.agency_name?.toLowerCase().includes(search);
  });

  // Stats
  const stats = {
    total: internships.length,
    phase1: internships.filter(i => i.current_phase === 'phase_1_mentorship').length,
    phase2: internships.filter(i => i.current_phase === 'phase_2_evaluation').length,
    atRisk: internships.filter(i => i.status === 'at_risk').length,
    completed: internships.filter(i => i.status === 'completed').length,
  };

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
                <p className="text-gray-600 dark:text-gray-400">Track student progress through internship phases</p>
              </div>
            </div>
            {canEdit && selectedCohort && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-5 h-5" />
                Add Student
              </button>
            )}
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
                <option value="">Select Cohort</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation || 'PMD'} Group {c.cohort_number}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
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
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.atRisk}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">At Risk</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
              </div>
            </div>

            {/* Internships Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {filteredInternships.length === 0 ? (
                <div className="p-8 text-center">
                  <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {internships.length === 0
                      ? 'No internship records for this cohort'
                      : 'No internships match your filters'}
                  </p>
                  {canEdit && internships.length === 0 && (
                    <button
                      onClick={openAddModal}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Student
                    </button>
                  )}
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
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">P1 Eval</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">P2 Eval</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredInternships.map((internship) => {
                        const statusConfig = STATUS_CONFIG[internship.status] || STATUS_CONFIG.not_started;
                        return (
                          <tr
                            key={internship.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {internship.students?.first_name} {internship.students?.last_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {internship.agencies?.abbreviation || internship.agency_name || '-'}
                            </td>
                            <td className="px-4 py-3">
                              {internship.field_preceptors ? (
                                <div>
                                  <div className="text-gray-900 dark:text-white">
                                    {internship.field_preceptors.first_name} {internship.field_preceptors.last_name}
                                  </div>
                                  {internship.field_preceptors.station && (
                                    <div className="text-xs text-gray-500">{internship.field_preceptors.station}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">Not assigned</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {formatDate(internship.internship_start_date)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {PHASE_LABELS[internship.current_phase] || internship.current_phase}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {internship.phase_1_eval_completed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <Clock className="w-5 h-5 text-gray-300 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {internship.phase_2_eval_completed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <Clock className="w-5 h-5 text-gray-300 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color} dark:bg-opacity-20`}>
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/clinical/internships/${internship.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </Link>
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

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Student to Internship Tracker
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Student */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student *
                </label>
                <select
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">Select Student</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agency
                </label>
                <select
                  value={formData.agency_id}
                  onChange={(e) => setFormData({ ...formData, agency_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">Select Agency</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preceptor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preceptor
                </label>
                <select
                  value={formData.preceptor_id}
                  onChange={(e) => setFormData({ ...formData, preceptor_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">Select Preceptor</option>
                  {preceptors
                    .filter(p => !formData.agency_id || p.agency_name === agencies.find(a => a.id === formData.agency_id)?.name)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} {p.agency_name ? `(${p.agency_name})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Shift Type & Placement Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Shift Type
                  </label>
                  <select
                    value={formData.shift_type}
                    onChange={(e) => setFormData({ ...formData, shift_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  >
                    <option value="12_hour">12 Hour</option>
                    <option value="24_hour">24 Hour</option>
                    <option value="48_hour">48 Hour</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Placement Date
                  </label>
                  <input
                    type="date"
                    value={formData.placement_date}
                    onChange={(e) => setFormData({ ...formData, placement_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddInternship}
                disabled={saving || !formData.student_id}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                {saving ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
