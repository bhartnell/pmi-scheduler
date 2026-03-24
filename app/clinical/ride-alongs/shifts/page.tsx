'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Plus,
  FileDown,
  Loader2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Zap,
  Ambulance,
  Check,
} from 'lucide-react';
import { canAccessClinical, canEditClinical, type Role } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';

interface Assignment {
  id: string;
  student_id: string;
  status: string;
  hours_completed: number | null;
  preceptor_name: string | null;
  notes: string | null;
  assigned_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
}

interface Shift {
  id: string;
  semester_id: string | null;
  cohort_id: string | null;
  agency_id: string | null;
  shift_date: string;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  max_students: number;
  location: string | null;
  unit_number: string | null;
  preceptor_name: string | null;
  notes: string | null;
  status: string;
  assignments: Assignment[];
}

interface Template {
  id: string;
  name: string;
  agency_id: string | null;
  day_of_week: number | null;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  max_students: number;
  unit_number: string | null;
  preceptor_name: string | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Agency {
  id: string;
  name: string;
}

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

export default function RideAlongShiftsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterShiftType, setFilterShiftType] = useState('');
  const [filterAgency, setFilterAgency] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [showAutoAssignPreview, setShowAutoAssignPreview] = useState(false);

  // Form state
  const [createForm, setCreateForm] = useState({
    shift_date: '', shift_type: 'day', start_time: '08:00', end_time: '16:00',
    max_students: 1, location: '', unit_number: '', preceptor_name: '',
    notes: '', agency_id: '', cohort_id: '',
  });
  const [templateForm, setTemplateForm] = useState({
    template_ids: [] as string[], start_date: '', end_date: '', cohort_id: '',
  });

  // Auto-assign
  const [autoAssignProposed, setAutoAssignProposed] = useState<Array<{
    shift_id: string; student_id: string; score: number; shift_date: string; shift_type: string | null;
  }>>([]);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (session) fetchInitialData();
  }, [session]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) { router.push('/'); return; }
      }

      const [shiftsRes, templatesRes, agenciesRes, cohortsRes] = await Promise.all([
        fetch('/api/clinical/ride-alongs'),
        fetch('/api/clinical/ride-alongs/templates'),
        fetch('/api/clinical/agencies?type=ems'),
        fetch('/api/cohorts?active_only=true'),
      ]);

      const [shiftsData, templatesData, agenciesData, cohortsData] = await Promise.all([
        shiftsRes.json(), templatesRes.json(), agenciesRes.json(), cohortsRes.json(),
      ]);

      setShifts(shiftsData.shifts || []);
      setTemplates(templatesData.templates || []);
      setAgencies(agenciesData.agencies || []);
      setCohorts(cohortsData.cohorts || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const fetchShifts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterShiftType) params.set('shift_type', filterShiftType);
      if (filterAgency) params.set('agency_id', filterAgency);
      if (filterStartDate) params.set('start_date', filterStartDate);
      if (filterEndDate) params.set('end_date', filterEndDate);

      const res = await fetch(`/api/clinical/ride-alongs?${params.toString()}`);
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  }, [filterStatus, filterShiftType, filterAgency, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (!loading) fetchShifts();
  }, [filterStatus, filterShiftType, filterAgency, filterStartDate, filterEndDate, fetchShifts, loading]);

  const fetchStudentsForCohort = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/students?cohort_id=${cohortId}&status=active`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleCreateShift = async () => {
    if (!createForm.shift_date) return;
    setSaving(true);
    try {
      const res = await fetch('/api/clinical/ride-alongs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          agency_id: createForm.agency_id || null,
          cohort_id: createForm.cohort_id || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setCreateForm({
          shift_date: '', shift_type: 'day', start_time: '08:00', end_time: '16:00',
          max_students: 1, location: '', unit_number: '', preceptor_name: '',
          notes: '', agency_id: '', cohort_id: '',
        });
        fetchShifts();
      }
    } catch (error) {
      console.error('Error creating shift:', error);
    }
    setSaving(false);
  };

  const handleGenerateFromTemplates = async () => {
    if (!templateForm.start_date || !templateForm.end_date || templateForm.template_ids.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/clinical/ride-alongs/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_ids: templateForm.template_ids,
          start_date: templateForm.start_date,
          end_date: templateForm.end_date,
          cohort_id: templateForm.cohort_id || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowTemplateModal(false);
        setTemplateForm({ template_ids: [], start_date: '', end_date: '', cohort_id: '' });
        fetchShifts();
        alert(`Generated ${data.count} shifts from templates.`);
      }
    } catch (error) {
      console.error('Error generating from templates:', error);
    }
    setSaving(false);
  };

  const handleAssignStudent = async (shiftId: string, studentId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/clinical/ride-alongs/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId, student_id: studentId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAssignModal(null);
        fetchShifts();
      } else {
        alert(data.error || 'Failed to assign student');
      }
    } catch (error) {
      console.error('Error assigning student:', error);
    }
    setSaving(false);
  };

  const handleAutoAssignPreview = async () => {
    setAutoAssignLoading(true);
    try {
      const res = await fetch('/api/clinical/ride-alongs/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: false }),
      });
      const data = await res.json();
      if (data.success) {
        setAutoAssignProposed(data.proposed || []);
        setShowAutoAssignPreview(true);
      }
    } catch (error) {
      console.error('Error auto-assigning:', error);
    }
    setAutoAssignLoading(false);
  };

  const handleAutoAssignConfirm = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/clinical/ride-alongs/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAutoAssignPreview(false);
        setAutoAssignProposed([]);
        fetchShifts();
        alert(`Assigned ${data.count} students to shifts.`);
      }
    } catch (error) {
      console.error('Error confirming auto-assign:', error);
    }
    setSaving(false);
  };

  const handleCancelShift = async (shiftId: string) => {
    if (!confirm('Cancel this shift?')) return;
    try {
      await fetch(`/api/clinical/ride-alongs/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      fetchShifts();
    } catch (error) {
      console.error('Error cancelling shift:', error);
    }
  };

  const getAgencyName = (agencyId: string | null) => {
    if (!agencyId) return 'N/A';
    return agencies.find(a => a.id === agencyId)?.name || 'Unknown';
  };

  const getStudentName = (studentId: string) => {
    const s = students.find(st => st.id === studentId);
    return s ? `${s.first_name} ${s.last_name}` : studentId.slice(0, 8);
  };

  const filteredShifts = shifts.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.location?.toLowerCase().includes(q) ||
      s.unit_number?.toLowerCase().includes(q) ||
      s.preceptor_name?.toLowerCase().includes(q) ||
      getAgencyName(s.agency_id).toLowerCase().includes(q)
    );
  });

  const canEdit = userRole ? canEditClinical(userRole) : false;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shift Manager</h1>
                <p className="text-gray-600 dark:text-gray-400">Create and manage ride-along shifts</p>
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={handleAutoAssignPreview}
                  disabled={autoAssignLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {autoAssignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Auto-Assign
                </button>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  From Template
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Shift
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search location, unit, preceptor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="filled">Filled</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filterShiftType}
              onChange={(e) => setFilterShiftType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Types</option>
              <option value="day">Day</option>
              <option value="night">Night</option>
              <option value="swing">Swing</option>
            </select>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="Start date"
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="End date"
            />
          </div>
        </div>

        {/* Shifts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Agency</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Students</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No shifts found. Create one or generate from templates.
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map((shift) => {
                    const activeAssignments = shift.assignments.filter(a => a.status !== 'cancelled');
                    return (
                      <tr key={shift.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {new Date(shift.shift_date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {getAgencyName(shift.agency_id)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {shift.unit_number || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {shift.start_time?.slice(0, 5) || '?'} - {shift.end_time?.slice(0, 5) || '?'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            shift.shift_type === 'day' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            shift.shift_type === 'night' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' :
                            'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}>
                            {shift.shift_type || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {activeAssignments.length}/{shift.max_students}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            shift.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            shift.status === 'filled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {shift.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {canEdit && shift.status === 'open' && (
                              <button
                                onClick={() => {
                                  setShowAssignModal(shift.id);
                                  if (shift.cohort_id) fetchStudentsForCohort(shift.cohort_id);
                                }}
                                className="px-2 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
                              >
                                Assign
                              </button>
                            )}
                            {canEdit && shift.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancelShift(shift.id)}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Shift</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                <input type="date" value={createForm.shift_date} onChange={e => setCreateForm({...createForm, shift_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift Type</label>
                  <select value={createForm.shift_type} onChange={e => setCreateForm({...createForm, shift_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                    <option value="swing">Swing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Students</label>
                  <input type="number" min="1" max="5" value={createForm.max_students} onChange={e => setCreateForm({...createForm, max_students: parseInt(e.target.value) || 1})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                  <input type="time" value={createForm.start_time} onChange={e => setCreateForm({...createForm, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                  <input type="time" value={createForm.end_time} onChange={e => setCreateForm({...createForm, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agency</label>
                <select value={createForm.agency_id} onChange={e => setCreateForm({...createForm, agency_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">-- Select Agency --</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cohort</label>
                <select value={createForm.cohort_id} onChange={e => setCreateForm({...createForm, cohort_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">-- Select Cohort --</option>
                  {cohorts.map(c => <option key={c.id} value={c.id}>{c.program?.abbreviation} C{c.cohort_number}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Number</label>
                  <input type="text" value={createForm.unit_number} onChange={e => setCreateForm({...createForm, unit_number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preceptor</label>
                  <input type="text" value={createForm.preceptor_name} onChange={e => setCreateForm({...createForm, preceptor_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <input type="text" value={createForm.location} onChange={e => setCreateForm({...createForm, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={createForm.notes} onChange={e => setCreateForm({...createForm, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button onClick={handleCreateShift} disabled={saving || !createForm.shift_date}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Generate Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Generate Shifts from Templates</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Templates</label>
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-500">No templates available. Create templates first.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                    {templates.map(t => (
                      <label key={t.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={templateForm.template_ids.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTemplateForm({...templateForm, template_ids: [...templateForm.template_ids, t.id]});
                            } else {
                              setTemplateForm({...templateForm, template_ids: templateForm.template_ids.filter(id => id !== t.id)});
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">{t.name}</span>
                        <span className="text-xs text-gray-500">
                          {t.shift_type && `(${t.shift_type})`}
                          {t.start_time && ` ${t.start_time.slice(0, 5)}-${t.end_time?.slice(0, 5) || '?'}`}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
                  <input type="date" value={templateForm.start_date} onChange={e => setTemplateForm({...templateForm, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date *</label>
                  <input type="date" value={templateForm.end_date} onChange={e => setTemplateForm({...templateForm, end_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cohort (optional)</label>
                <select value={templateForm.cohort_id} onChange={e => setTemplateForm({...templateForm, cohort_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">-- All Cohorts --</option>
                  {cohorts.map(c => <option key={c.id} value={c.id}>{c.program?.abbreviation} C{c.cohort_number}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button onClick={handleGenerateFromTemplates} disabled={saving || templateForm.template_ids.length === 0 || !templateForm.start_date || !templateForm.end_date}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Generate Shifts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Student Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Student</h2>
              <button onClick={() => setShowAssignModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {students.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400 mb-2">No students loaded. Select a cohort on the shift first, or load students for a cohort:</p>
                <select
                  onChange={(e) => { if (e.target.value) fetchStudentsForCohort(e.target.value); }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">-- Select Cohort --</option>
                  {cohorts.map(c => <option key={c.id} value={c.id}>{c.program?.abbreviation} C{c.cohort_number}</option>)}
                </select>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleAssignStudent(showAssignModal, s.id)}
                    disabled={saving}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    <span>{s.first_name} {s.last_name}</span>
                    <Users className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auto-Assign Preview Modal */}
      {showAutoAssignPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Auto-Assign Preview</h2>
              <button onClick={() => setShowAutoAssignPreview(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {autoAssignProposed.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 py-4 text-center">
                No assignments proposed. Make sure there are open shifts and student availability records.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {autoAssignProposed.length} proposed assignment(s). Review and confirm.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                  {autoAssignProposed.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(p.shift_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {p.shift_type || 'N/A'} shift - Student: {p.student_id.slice(0, 8)}...
                        </div>
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        Score: {p.score}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAutoAssignPreview(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    Cancel
                  </button>
                  <button onClick={handleAutoAssignConfirm} disabled={saving}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Check className="w-4 h-4" />
                    Confirm Assignments
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
