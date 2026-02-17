'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Building2,
  Plus,
  Search,
  Calendar,
  Clock,
  User,
  Users,
  FileSpreadsheet,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Filter,
  ChevronDown,
  ChevronUp,
  MapPin
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';
import SiteVisitAlerts from '@/components/SiteVisitAlerts';

interface ClinicalSite {
  id: string;
  name: string;
  abbreviation: string;
  system: string | null;
  site_type?: 'clinical_site' | 'field_agency';
  departments?: { id: string; department: string; is_active: boolean }[];
}

interface Program {
  id: string;
  name: string;
  abbreviation: string;
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: Program;
  is_active: boolean;
  // Computed display name
  displayName: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

interface SiteVisit {
  id: string;
  site_id: string | null;
  agency_id: string | null;
  departments: string[];
  visitor_id: string | null;
  visitor_name: string;
  visit_date: string;
  visit_time: string | null;
  cohort_id: string | null;
  entire_class: boolean;
  comments: string | null;
  created_at: string;
  site: {
    id: string;
    name: string;
    abbreviation: string;
    system: string | null;
  } | null;
  agency: {
    id: string;
    name: string;
    abbreviation: string;
  } | null;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      id: string;
      name: string;
      abbreviation: string;
    };
  } | null;
  visitor: {
    id: string;
    name: string;
    email: string;
  } | null;
  students: {
    student: {
      id: string;
      first_name: string;
      last_name: string;
    };
  }[];
}

export default function SiteVisitsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<Instructor | null>(null);

  // Data
  const [sites, setSites] = useState<ClinicalSite[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);

  // UI State
  const [showForm, setShowForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState<SiteVisit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Form State
  const [formSiteId, setFormSiteId] = useState('');
  const [formDepartments, setFormDepartments] = useState<string[]>([]);
  const [formVisitorId, setFormVisitorId] = useState('');
  const [formVisitorName, setFormVisitorName] = useState('');
  // Use local date to avoid timezone issues (toISOString uses UTC which can shift the date)
  const [formVisitDate, setFormVisitDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [formVisitTime, setFormVisitTime] = useState('');
  const [formCohortId, setFormCohortId] = useState('');
  const [formEntireClass, setFormEntireClass] = useState(true);
  const [formStudentIds, setFormStudentIds] = useState<string[]>([]);
  const [formComments, setFormComments] = useState('');

  // Filter State
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterCohortId, setFilterCohortId] = useState('');
  const [filterVisitorId, setFilterVisitorId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Students for selected cohort
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Get departments for selected site
  const selectedSite = useMemo(() =>
    sites.find(s => s.id === formSiteId),
    [sites, formSiteId]
  );

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchInitialData();
    }
  }, [session]);

  // Fetch students when cohort changes
  useEffect(() => {
    if (formCohortId) {
      fetchCohortStudents(formCohortId);
    } else {
      setCohortStudents([]);
      setFormStudentIds([]);
    }
  }, [formCohortId]);

  // Auto-fill visitor name when instructor selected
  useEffect(() => {
    if (formVisitorId) {
      const instructor = instructors.find(i => i.id === formVisitorId);
      if (instructor) {
        setFormVisitorName(instructor.name);
      }
    }
  }, [formVisitorId, instructors]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch current user
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        setCurrentUser(userData.user);

        // Check permission
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }

        // Set default visitor to current user
        setFormVisitorId(userData.user.id);
        setFormVisitorName(userData.user.name);
      }

      // Fetch all reference data in parallel
      const [sitesRes, cohortsRes, instructorsRes] = await Promise.all([
        fetch('/api/clinical/sites?includeDepartments=true&includeAgencies=true'),
        fetch('/api/lab-management/cohorts'), // Get all cohorts, not just active
        fetch('/api/lab-management/instructors'),
      ]);

      const sitesData = await sitesRes.json();
      const cohortsData = await cohortsRes.json();
      const instructorsData = await instructorsRes.json();

      if (sitesData.success) setSites(sitesData.sites || []);
      if (cohortsData.success) {
        // Transform cohorts to add displayName
        const transformedCohorts = (cohortsData.cohorts || []).map((c: any) => ({
          ...c,
          displayName: `${c.program?.abbreviation || 'Unknown'} ${c.cohort_number}`,
        }));
        setCohorts(transformedCohorts);
      }
      if (instructorsData.success) setInstructors(instructorsData.instructors || []);

      // Fetch visits
      await fetchVisits();
    } catch (error) {
      console.error('Error fetching data:', error);
      setErrorMessage('Failed to load data');
    }
    setLoading(false);
  };

  const fetchVisits = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSiteId) params.append('siteId', filterSiteId);
      if (filterCohortId) params.append('cohortId', filterCohortId);
      if (filterVisitorId) params.append('visitorId', filterVisitorId);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`/api/clinical/site-visits?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setVisits(data.visits || []);
        setTotalVisits(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching visits:', error);
    }
  };

  const fetchCohortStudents = async (cohortId: string) => {
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success) {
        setCohortStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
    setLoadingStudents(false);
  };

  const resetForm = () => {
    setFormSiteId('');
    setFormDepartments([]);
    setFormVisitorId(currentUser?.id || '');
    setFormVisitorName(currentUser?.name || '');
    // Use local date to avoid timezone issues
    const today = new Date();
    setFormVisitDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    // Auto-fill current time in HH:MM format
    const now = new Date();
    setFormVisitTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    setFormCohortId('');
    setFormEntireClass(true);
    setFormStudentIds([]);
    // Default comment for quick logging
    setFormComments('Observed student(s) interaction with staff and patients.');
    setEditingVisit(null);
  };

  const openEditForm = (visit: SiteVisit) => {
    setEditingVisit(visit);
    // Reconstruct the site/agency ID for the form
    // If it's an agency, use the prefixed format
    if (visit.agency_id) {
      setFormSiteId(`agency-${visit.agency_id}`);
    } else {
      setFormSiteId(visit.site_id || '');
    }
    setFormDepartments(visit.departments || []);
    setFormVisitorId(visit.visitor_id || '');
    setFormVisitorName(visit.visitor_name);
    setFormVisitDate(visit.visit_date);
    setFormVisitTime(visit.visit_time || '');
    setFormCohortId(visit.cohort_id || '');
    setFormEntireClass(visit.entire_class);
    setFormStudentIds(visit.students?.map(s => s.student.id) || []);
    setFormComments(visit.comments || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        site_id: formSiteId,
        departments: formDepartments,
        visitor_id: formVisitorId || null,
        visitor_name: formVisitorName,
        visit_date: formVisitDate,
        visit_time: formVisitTime || null,
        cohort_id: formCohortId || null,
        entire_class: formEntireClass,
        student_ids: formEntireClass ? [] : formStudentIds,
        comments: formComments,
      };

      const url = editingVisit
        ? `/api/clinical/site-visits/${editingVisit.id}`
        : '/api/clinical/site-visits';

      const res = await fetch(url, {
        method: editingVisit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(editingVisit ? 'Visit updated successfully' : 'Visit logged successfully');
        setShowForm(false);
        resetForm();
        await fetchVisits();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to save visit');
      }
    } catch (error) {
      console.error('Error saving visit:', error);
      setErrorMessage('Failed to save visit');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/clinical/site-visits/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage('Visit deleted successfully');
        setDeleteConfirm(null);
        await fetchVisits();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to delete visit');
      }
    } catch (error) {
      console.error('Error deleting visit:', error);
      setErrorMessage('Failed to delete visit');
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filterSiteId) params.append('siteId', filterSiteId);
    if (filterCohortId) params.append('cohortId', filterCohortId);
    if (filterVisitorId) params.append('visitorId', filterVisitorId);
    if (filterStartDate) params.append('startDate', filterStartDate);
    if (filterEndDate) params.append('endDate', filterEndDate);

    window.open(`/api/clinical/site-visits/export?${params.toString()}`, '_blank');
  };

  const toggleDepartment = (dept: string) => {
    setFormDepartments(prev =>
      prev.includes(dept)
        ? prev.filter(d => d !== dept)
        : [...prev, dept]
    );
  };

  const toggleStudent = (studentId: string) => {
    setFormStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

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
            <span>Site Visits</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Building2 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Site Visits</h1>
                <p className="text-gray-600 dark:text-gray-400">Track instructor visits to clinical sites and field agencies</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Log Visit
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Site Visit Coverage Alerts */}
        <div className="mb-6">
          <SiteVisitAlerts showOnlyWhenNeeded={false} />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-6 py-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-white">Filters</span>
              {(filterSiteId || filterCohortId || filterVisitorId || filterStartDate || filterEndDate) && (
                <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs rounded-full">
                  Active
                </span>
              )}
            </div>
            {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {showFilters && (
            <div className="px-6 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="grid md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site/Agency</label>
                  <select
                    value={filterSiteId}
                    onChange={(e) => setFilterSiteId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">All Sites & Agencies</option>
                    <optgroup label="Clinical Sites">
                      {sites.filter(s => s.site_type !== 'field_agency').map(site => (
                        <option key={site.id} value={site.id}>
                          {site.abbreviation} - {site.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Field Agencies">
                      {sites.filter(s => s.site_type === 'field_agency').map(site => (
                        <option key={site.id} value={site.id}>
                          {site.abbreviation} - {site.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cohort</label>
                  <select
                    value={filterCohortId}
                    onChange={(e) => setFilterCohortId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">All Cohorts</option>
                    {cohorts.map(cohort => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visitor</label>
                  <select
                    value={filterVisitorId}
                    onChange={(e) => setFilterVisitorId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">All Visitors</option>
                    {instructors.map(instructor => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={fetchVisits}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
                >
                  Apply Filters
                </button>
                <button
                  onClick={() => {
                    setFilterSiteId('');
                    setFilterCohortId('');
                    setFilterVisitorId('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setTimeout(fetchVisits, 0);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Visits List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Visit Log ({totalVisits} total)
            </h2>
          </div>

          {visits.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No site visits logged yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-teal-600 dark:text-teal-400 hover:underline"
              >
                Log your first visit
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {visits.map((visit) => (
                <div key={visit.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {visit.site?.abbreviation || visit.agency?.abbreviation || 'Unknown'}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {visit.site?.name || visit.agency?.name}
                        </span>
                        {visit.agency && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                            Field Agency
                          </span>
                        )}
                        {visit.departments && visit.departments.length > 0 && (
                          <div className="flex gap-1">
                            {visit.departments.map(dept => (
                              <span
                                key={dept}
                                className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs rounded-full"
                              >
                                {dept}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(visit.visit_date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            timeZone: 'America/Phoenix'
                          })}
                        </div>
                        {visit.visit_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {visit.visit_time}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {visit.visitor_name}
                        </div>
                        {visit.cohort && (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {visit.cohort.program?.abbreviation} {visit.cohort.cohort_number}
                            {visit.entire_class && ' (Entire Class)'}
                          </div>
                        )}
                      </div>

                      {!visit.entire_class && visit.students && visit.students.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <strong>Students:</strong>{' '}
                          {visit.students.map(s => `${s.student.first_name} ${s.student.last_name}`).join(', ')}
                        </div>
                      )}

                      {visit.comments && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
                          "{visit.comments}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openEditForm(visit)}
                        className="p-2 text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit visit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(visit.id)}
                        className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Delete visit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Delete Confirmation */}
                  {deleteConfirm === visit.id && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-800 dark:text-red-200 mb-3">
                        Are you sure you want to delete this visit?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(visit.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Log Visit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingVisit ? 'Edit Site Visit' : 'Log Site Visit'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Site Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Site / Agency *
                </label>
                <select
                  value={formSiteId}
                  onChange={(e) => {
                    setFormSiteId(e.target.value);
                    setFormDepartments([]);
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a site or agency...</option>
                  <optgroup label="Clinical Sites (Hospitals)">
                    {sites.filter(s => s.site_type !== 'field_agency').map(site => (
                      <option key={site.id} value={site.id}>
                        {site.abbreviation} - {site.name} {site.system ? `(${site.system})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Field Agencies (EMS)">
                    {sites.filter(s => s.site_type === 'field_agency').map(site => (
                      <option key={site.id} value={site.id}>
                        {site.abbreviation} - {site.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Departments */}
              {selectedSite && selectedSite.departments && selectedSite.departments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Departments Visited
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSite.departments.filter(d => d.is_active).map(dept => (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => toggleDepartment(dept.department)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          formDepartments.includes(dept.department)
                            ? 'bg-teal-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {dept.department}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date and Time */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Visit Date *
                  </label>
                  <input
                    type="date"
                    value={formVisitDate}
                    onChange={(e) => setFormVisitDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Visit Time
                  </label>
                  <input
                    type="time"
                    value={formVisitTime}
                    onChange={(e) => setFormVisitTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Visitor - Simplified display */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Visiting as:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formVisitorName || 'Unknown'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newName = prompt('Enter visitor name:', formVisitorName);
                      if (newName !== null) {
                        setFormVisitorName(newName);
                        // Clear visitor ID if name doesn't match any instructor
                        const matchingInstructor = instructors.find(i => i.name === newName);
                        setFormVisitorId(matchingInstructor?.id || '');
                      }
                    }}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Cohort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort
                </label>
                <select
                  value={formCohortId}
                  onChange={(e) => setFormCohortId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select cohort...</option>
                  {cohorts.map(cohort => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Students Selection */}
              {formCohortId && (
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={formEntireClass}
                        onChange={() => setFormEntireClass(true)}
                        className="text-teal-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Entire Class</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!formEntireClass}
                        onChange={() => setFormEntireClass(false)}
                        className="text-teal-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Specific Students</span>
                    </label>
                  </div>

                  {!formEntireClass && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                      {loadingStudents ? (
                        <div className="text-center text-gray-500 py-4">Loading students...</div>
                      ) : cohortStudents.length === 0 ? (
                        <div className="text-center text-gray-500 py-4">No students in this cohort</div>
                      ) : (
                        <div className="space-y-2">
                          {cohortStudents.map(student => (
                            <label
                              key={student.id}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={formStudentIds.includes(student.id)}
                                onChange={() => toggleStudent(student.id)}
                                className="text-teal-600 rounded"
                              />
                              <span className="text-gray-700 dark:text-gray-300">
                                {student.first_name} {student.last_name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Comments - Pre-filled with default */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Comments <span className="text-gray-400 font-normal">(tap to edit)</span>
                </label>
                <textarea
                  value={formComments}
                  onChange={(e) => setFormComments(e.target.value)}
                  rows={2}
                  placeholder="Notes about the visit..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formSiteId || !formVisitDate || !formVisitorName}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingVisit ? 'Update Visit' : 'Log Visit'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
