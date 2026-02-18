'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  FileText,
  BookOpen,
  ClipboardList,
  Heart,
  Wind,
  AlertTriangle,
  Activity,
  Baby,
  Users,
  Brain,
  Sparkles
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  cohort?: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string };
  };
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface ProtocolCompletion {
  id: string;
  protocol_category: string;
  case_count: number;
  completed_at: string;
  notes: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
  };
  logged_by_user: {
    id: string;
    name: string;
  };
}

interface CategorySummary {
  category: string;
  total_cases: number;
}

const PROTOCOL_CATEGORIES = [
  { value: 'cardiac', label: 'Cardiac', icon: Heart, color: 'red' },
  { value: 'respiratory', label: 'Respiratory', icon: Wind, color: 'blue' },
  { value: 'trauma', label: 'Trauma', icon: AlertTriangle, color: 'orange' },
  { value: 'medical', label: 'Medical', icon: Activity, color: 'green' },
  { value: 'pediatric', label: 'Pediatric', icon: Baby, color: 'pink' },
  { value: 'obstetric', label: 'Obstetric', icon: Users, color: 'purple' },
  { value: 'behavioral', label: 'Behavioral', icon: Brain, color: 'teal' },
  { value: 'other', label: 'Other', icon: Sparkles, color: 'gray' }
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', border: 'border-red-300 dark:border-red-700' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-700' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-700' },
  gray: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-700' }
};

export default function ProtocolTrackingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [completions, setCompletions] = useState<ProtocolCompletion[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);

  const [selectedCohort, setSelectedCohort] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [caseCount, setCaseCount] = useState(1);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
    }
  }, [session]);

  useEffect(() => {
    if (selectedCohort) {
      fetchStudents();
      fetchCompletions();
      fetchCategorySummary();
    } else {
      setStudents([]);
      setCompletions([]);
      setCategorySummary([]);
    }
  }, [selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
    setLoading(false);
  };

  const fetchStudents = async () => {
    if (!selectedCohort) return;

    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${selectedCohort}&status=active`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchCompletions = async () => {
    if (!selectedCohort) return;

    try {
      const res = await fetch(`/api/tracking/protocol-completions?cohortId=${selectedCohort}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setCompletions(data.completions);
      }
    } catch (error) {
      console.error('Error fetching completions:', error);
    }
  };

  const fetchCategorySummary = async () => {
    if (!selectedCohort) return;

    try {
      const res = await fetch(`/api/tracking/protocol-completions?cohortId=${selectedCohort}`);
      const data = await res.json();
      if (data.success) {
        // Calculate summary from completions
        const summary: Record<string, number> = {};
        data.completions.forEach((c: ProtocolCompletion) => {
          summary[c.protocol_category] = (summary[c.protocol_category] || 0) + c.case_count;
        });

        const summaryArray = PROTOCOL_CATEGORIES.map(cat => ({
          category: cat.value,
          total_cases: summary[cat.value] || 0
        }));

        setCategorySummary(summaryArray);
      }
    } catch (error) {
      console.error('Error fetching category summary:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudent || !selectedCategory) {
      alert('Please select a student and category');
      return;
    }

    if (caseCount < 1 || caseCount > 10) {
      alert('Case count must be between 1 and 10');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/tracking/protocol-completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent,
          protocol_category: selectedCategory,
          case_count: caseCount,
          notes: notes.trim() || null
        })
      });

      const data = await res.json();

      if (data.success) {
        // Reset form
        setSelectedStudent('');
        setSelectedCategory('');
        setCaseCount(1);
        setNotes('');

        // Refresh data
        fetchCompletions();
        fetchCategorySummary();
      } else {
        alert(data.error || 'Failed to log completion');
      }
    } catch (error) {
      console.error('Error logging completion:', error);
      alert('Failed to log completion');
    }

    setSubmitting(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white shadow-sm dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Protocol Tracking</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Protocol Case Cards</h1>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Log Completion Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Log Completion</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Cohort Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort
                </label>
                <select
                  value={selectedCohort}
                  onChange={(e) => {
                    setSelectedCohort(e.target.value);
                    setSelectedStudent('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  required
                >
                  <option value="">Select Cohort</option>
                  {cohorts.map(cohort => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.program.abbreviation} Group {cohort.cohort_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  required
                  disabled={!selectedCohort || students.length === 0}
                >
                  <option value="">Select Student</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
                {selectedCohort && students.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No active students in this cohort
                  </p>
                )}
              </div>

              {/* Protocol Category Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Protocol Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  required
                >
                  <option value="">Select Category</option>
                  {PROTOCOL_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Case Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Case Count
                </label>
                <input
                  type="number"
                  value={caseCount}
                  onChange={(e) => setCaseCount(parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  required
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Range: 1-10
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional notes about the case cards..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !selectedStudent || !selectedCategory}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Logging...' : 'Log Completion'}
              </button>
            </form>
          </div>

          {/* Right: Summary and Recent Completions */}
          <div className="space-y-6">
            {/* Category Summary Grid */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Category Summary</h2>
              </div>

              {!selectedCohort ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Select a cohort to view summary
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {PROTOCOL_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const colors = CATEGORY_COLORS[cat.color];
                    const summary = categorySummary.find(s => s.category === cat.value);
                    const total = summary?.total_cases || 0;

                    return (
                      <div
                        key={cat.value}
                        className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`w-5 h-5 ${colors.text}`} />
                          <span className={`text-sm font-medium ${colors.text}`}>
                            {cat.label}
                          </span>
                        </div>
                        <div className={`text-2xl font-bold ${colors.text}`}>
                          {total}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {total === 1 ? 'case' : 'cases'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Completions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Completions</h2>
              </div>

              {!selectedCohort ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Select a cohort to view completions
                </p>
              ) : completions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No completions logged yet
                </p>
              ) : (
                <div className="space-y-3">
                  {completions.map(completion => {
                    const category = PROTOCOL_CATEGORIES.find(c => c.value === completion.protocol_category);
                    const Icon = category?.icon || FileText;
                    const colors = CATEGORY_COLORS[category?.color || 'gray'];

                    return (
                      <div
                        key={completion.id}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 ${colors.bg}`}>
                            <Icon className={`w-4 h-4 ${colors.text}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {completion.student.last_name}, {completion.student.first_name}
                              </span>
                              <span className={`text-sm font-medium ${colors.text}`}>
                                {category?.label || completion.protocol_category}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {completion.case_count} {completion.case_count === 1 ? 'case' : 'cases'} •{' '}
                              {new Date(completion.completed_at).toLocaleDateString()}
                            </div>
                            {completion.notes && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {completion.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
