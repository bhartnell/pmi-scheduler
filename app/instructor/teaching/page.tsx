'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  ChevronRight,
  Trash2,
  Calendar,
  ArrowLeft,
  Users,
  Clock,
  MapPin,
  X
} from 'lucide-react';

interface TeachingEntry {
  id: string;
  course_name: string;
  course_type: string | null;
  date_taught: string;
  hours: number;
  location: string | null;
  student_count: number | null;
  notes: string | null;
  cohort?: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string };
  };
  lab_day?: {
    id: string;
    title: string;
    date: string;
  };
}

import type { CurrentUser } from '@/types';

interface Stats {
  totalClasses: number;
  totalHours: number;
  totalStudents: number;
}

// Parse date as local date
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function TeachingLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [entries, setEntries] = useState<TeachingEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ totalClasses: 0, totalHours: 0, totalStudents: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Form state
  const [courseName, setCourseName] = useState('');
  const [courseType, setCourseType] = useState('');
  const [dateTaught, setDateTaught] = useState('');
  const [hours, setHours] = useState('');
  const [location, setLocation] = useState('');
  const [studentCount, setStudentCount] = useState('');
  const [notes, setNotes] = useState('');

  const courseTypes = ['EMT', 'AEMT', 'Paramedic', 'ACLS', 'PALS', 'BLS', 'Lab Skills', 'Clinical', 'Other'];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadData();
    }
  }, [session, selectedYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get current user
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success) {
        setCurrentUser(userData.user);

        // Load teaching log
        const logRes = await fetch(`/api/instructor/teaching-log?year=${selectedYear}`);
        const logData = await logRes.json();
        if (logData.success) {
          setEntries(logData.entries || []);
          setStats(logData.stats || { totalClasses: 0, totalHours: 0, totalStudents: 0 });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setCourseName('');
    setCourseType('');
    setDateTaught('');
    setHours('');
    setLocation('');
    setStudentCount('');
    setNotes('');
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/instructor/teaching-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_name: courseName,
          course_type: courseType || null,
          date_taught: dateTaught,
          hours: parseFloat(hours),
          location: location || null,
          student_count: studentCount ? parseInt(studentCount) : null,
          notes: notes || null
        })
      });

      const data = await res.json();
      if (data.success) {
        setEntries([data.entry, ...entries]);
        setStats({
          totalClasses: stats.totalClasses + 1,
          totalHours: stats.totalHours + parseFloat(hours),
          totalStudents: stats.totalStudents + (studentCount ? parseInt(studentCount) : 0)
        });
        resetForm();
      } else {
        alert('Failed to add entry: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding teaching entry:', error);
      alert('Failed to add entry');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this teaching entry?')) return;

    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    try {
      const res = await fetch(`/api/instructor/teaching-log/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setEntries(entries.filter(e => e.id !== id));
        setStats({
          totalClasses: stats.totalClasses - 1,
          totalHours: stats.totalHours - entry.hours,
          totalStudents: stats.totalStudents - (entry.student_count || 0)
        });
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete');
    }
  };

  // Get available years for filter
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y.toString());
    }
    return years;
  };

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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/instructor" className="hover:text-blue-600">Instructor Portal</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Teaching Log</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/instructor" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Teaching Log</h1>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-amber-500"
            >
              {getYearOptions().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.totalClasses}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Classes Taught</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.totalHours.toFixed(1)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Hours Taught</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.totalStudents}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Students</div>
          </div>
        </div>

        {/* Teaching Log Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              Teaching History ({selectedYear})
            </h2>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                <Plus className="w-4 h-4" />
                Add Entry
              </button>
            )}
          </div>

          {/* Add Form */}
          {showForm && (
            <div className="p-4 border-b dark:border-gray-700 bg-amber-50 dark:bg-amber-900/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Add Teaching Entry</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Course Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    required
                    placeholder="e.g., EMT Initial, Paramedic Lab Day 5"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Type</label>
                    <select
                      value={courseType}
                      onChange={(e) => setCourseType(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Select type</option>
                      {courseTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date Taught <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dateTaught}
                      onChange={(e) => setDateTaught(e.target.value)}
                      required
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hours <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      required
                      placeholder="e.g., 8"
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Students</label>
                    <input
                      type="number"
                      min="0"
                      value={studentCount}
                      onChange={(e) => setStudentCount(e.target.value)}
                      placeholder="e.g., 24"
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Room 101"
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400"
                  >
                    {saving ? 'Adding...' : 'Add Entry'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Entries List */}
          <div className="p-4">
            {entries.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No teaching entries for {selectedYear}.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-3 text-amber-600 hover:text-amber-700"
                >
                  Add your first entry
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white">{entry.course_name}</span>
                          <span className="text-amber-600 font-medium">{entry.hours} hrs</span>
                          {entry.course_type && (
                            <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                              {entry.course_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {parseLocalDate(entry.date_taught).toLocaleDateString()}
                          </span>
                          {entry.student_count && (
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {entry.student_count} students
                            </span>
                          )}
                          {entry.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {entry.location}
                            </span>
                          )}
                        </div>
                        {entry.cohort && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {entry.cohort.program.abbreviation} Cohort {entry.cohort.cohort_number}
                          </div>
                        )}
                        {entry.notes && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{entry.notes}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
