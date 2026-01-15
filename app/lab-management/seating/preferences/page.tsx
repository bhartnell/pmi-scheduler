'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Users,
  Plus,
  Trash2,
  Home,
  X,
  AlertTriangle,
  Heart,
  Search,
  Filter
} from 'lucide-react';
import { canManageContent, type Role } from '@/lib/permissions';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  cohort_id: string;
  cohort?: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string };
  };
}

interface Preference {
  id: string;
  student_id: string;
  other_student_id: string;
  preference_type: 'avoid' | 'prefer_near';
  reason: string | null;
  created_at: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    cohort_id: string;
  };
  other_student: {
    id: string;
    first_name: string;
    last_name: string;
    cohort_id: string;
  };
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { name: string; abbreviation: string };
}

function SeatingPreferencesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCohortId = searchParams.get('cohortId');

  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCohort, setSelectedCohort] = useState<string>(initialCohortId || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formStudentId, setFormStudentId] = useState('');
  const [formOtherStudentId, setFormOtherStudentId] = useState('');
  const [formType, setFormType] = useState<'avoid' | 'prefer_near'>('avoid');
  const [formReason, setFormReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch preferences
      const prefUrl = selectedCohort
        ? `/api/seating/preferences?cohortId=${selectedCohort}`
        : '/api/seating/preferences';
      const prefRes = await fetch(prefUrl);
      const prefData = await prefRes.json();
      if (prefData.success) {
        setPreferences(prefData.preferences || []);
      }

      // Fetch students
      const studentsUrl = selectedCohort
        ? `/api/lab-management/students?cohortId=${selectedCohort}&status=active`
        : '/api/lab-management/students?status=active';
      const studentsRes = await fetch(studentsUrl);
      const studentsData = await studentsRes.json();
      if (studentsData.success) {
        setStudents(studentsData.students || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setFormStudentId('');
    setFormOtherStudentId('');
    setFormType('avoid');
    setFormReason('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId || !formOtherStudentId) {
      alert('Both students must be selected');
      return;
    }
    if (formStudentId === formOtherStudentId) {
      alert('Please select two different students');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/seating/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: formStudentId,
          other_student_id: formOtherStudentId,
          preference_type: formType,
          reason: formReason || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPreferences([data.preference, ...preferences]);
        resetForm();
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this preference?')) return;

    try {
      const res = await fetch(`/api/seating/preferences?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        setPreferences(preferences.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  // Filter preferences by search
  const filteredPreferences = preferences.filter(p => {
    if (!searchQuery) return true;
    const names = `${p.student.first_name} ${p.student.last_name} ${p.other_student.first_name} ${p.other_student.last_name}`.toLowerCase();
    return names.includes(searchQuery.toLowerCase());
  });

  const avoidCount = preferences.filter(p => p.preference_type === 'avoid').length;
  const preferCount = preferences.filter(p => p.preference_type === 'prefer_near').length;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Seating Preferences</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seating Preferences</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage student seating preferences and conflicts</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Preference
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Seating Preference</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Student A */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student A *</label>
                  <select
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value="">Select student...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name}
                        {s.cohort && ` (${s.cohort.program.abbreviation} ${s.cohort.cohort_number})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preference Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preference *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'avoid' | 'prefer_near')}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value="avoid">Should AVOID sitting near</option>
                    <option value="prefer_near">Should sit NEAR</option>
                  </select>
                </div>

                {/* Student B */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student B *</label>
                  <select
                    value={formOtherStudentId}
                    onChange={(e) => setFormOtherStudentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value="">Select student...</option>
                    {students.filter(s => s.id !== formStudentId).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name}
                        {s.cohort && ` (${s.cohort.program.abbreviation} ${s.cohort.cohort_number})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Why should these students be separated/together?"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                >
                  {saving ? 'Saving...' : 'Add Preference'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.program.abbreviation} Group {c.cohort_number}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{preferences.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Preferences</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{avoidCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Should Avoid</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{preferCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Should Be Near</div>
          </div>
        </div>

        {/* Preferences List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filteredPreferences.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No matching preferences found' : 'No seating preferences added yet'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add First Preference
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {filteredPreferences.map((pref) => (
                <div key={pref.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                  {/* Icon */}
                  <div className={`p-2 rounded-full ${pref.preference_type === 'avoid' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                    {pref.preference_type === 'avoid' ? (
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <Heart className="w-5 h-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {pref.student.first_name} {pref.student.last_name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        pref.preference_type === 'avoid'
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                          : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                      }`}>
                        {pref.preference_type === 'avoid' ? 'should avoid' : 'should sit near'}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {pref.other_student.first_name} {pref.other_student.last_name}
                      </span>
                    </div>
                    {pref.reason && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{pref.reason}</p>
                    )}
                  </div>

                  {/* Delete */}
                  {userRole && canManageContent(userRole) && (
                    <button
                      onClick={() => handleDelete(pref.id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
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

export default function SeatingPreferencesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SeatingPreferencesContent />
    </Suspense>
  );
}
