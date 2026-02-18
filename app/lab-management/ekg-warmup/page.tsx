'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Heart,
  Activity,
  Save,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: string;
  program?: {
    name: string;
    abbreviation: string;
  };
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  cohort_id: string;
}

interface EKGScore {
  id: string;
  student_id: string;
  score: number;
  max_score: number;
  is_baseline: boolean;
  missed_rhythms: string[];
  date: string;
  notes: string | null;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  logged_by_user?: {
    name: string;
  };
}

const RHYTHM_OPTIONS = [
  'Sinus Rhythm',
  'Sinus Bradycardia',
  'Sinus Tachycardia',
  'Atrial Fibrillation',
  'Atrial Flutter',
  'SVT',
  'Ventricular Tachycardia',
  'Ventricular Fibrillation',
  'Asystole',
  'PEA',
  '1st Degree AV Block',
  '2nd Degree Type I',
  '2nd Degree Type II',
  '3rd Degree AV Block',
  'Bundle Branch Block',
  'Premature Atrial Complex',
  'Premature Ventricular Complex'
];

function EKGWarmupPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [recentScores, setRecentScores] = useState<EKGScore[]>([]);

  const [selectedCohort, setSelectedCohort] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [scoreDate, setScoreDate] = useState(new Date().toISOString().split('T')[0]);
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  const [isBaseline, setIsBaseline] = useState(false);
  const [missedRhythms, setMissedRhythms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      fetchStudents(selectedCohort);
      fetchRecentScores(selectedCohort);
    } else {
      setStudents([]);
      setRecentScores([]);
    }
  }, [selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch (err) {
      console.error('Error fetching cohorts:', err);
    }
    setLoading(false);
  };

  const fetchStudents = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${cohortId}&status=active`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const fetchRecentScores = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/tracking/ekg-scores?cohortId=${cohortId}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setRecentScores(data.scores || []);
      }
    } catch (err) {
      console.error('Error fetching recent scores:', err);
    }
  };

  const toggleRhythm = (rhythm: string) => {
    setMissedRhythms(prev =>
      prev.includes(rhythm)
        ? prev.filter(r => r !== rhythm)
        : [...prev, rhythm]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedStudent) {
      setError('Please select a student');
      return;
    }

    if (!score) {
      setError('Please enter a score');
      return;
    }

    const scoreNum = parseInt(score);
    const maxScoreNum = parseInt(maxScore);

    if (isNaN(scoreNum) || scoreNum < 0) {
      setError('Score must be a valid number');
      return;
    }

    if (scoreNum > maxScoreNum) {
      setError(`Score cannot exceed max score (${maxScoreNum})`);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/tracking/ekg-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent,
          score: scoreNum,
          max_score: maxScoreNum,
          is_baseline: isBaseline,
          missed_rhythms: missedRhythms,
          date: scoreDate,
          notes: notes.trim() || null
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Score logged successfully!');
        // Reset form
        setSelectedStudent('');
        setScore('');
        setMaxScore('10');
        setIsBaseline(false);
        setMissedRhythms([]);
        setNotes('');
        setScoreDate(new Date().toISOString().split('T')[0]);
        // Refresh recent scores
        if (selectedCohort) {
          fetchRecentScores(selectedCohort);
        }
      } else {
        setError(data.error || 'Failed to log score');
      }
    } catch (err) {
      console.error('Error logging score:', err);
      setError('Failed to log score');
    }

    setSubmitting(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">
              Lab Management
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">EKG Warmup</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Activity className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EKG Warmup Scores</h1>
              <p className="text-gray-600 dark:text-gray-400">Log student EKG rhythm recognition scores</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Log New Score */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-6">
              <Heart className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Log New Score</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Cohort Selection */}
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
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select cohort...</option>
                  {cohorts.map(cohort => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.program?.abbreviation || 'N/A'} - Cohort {cohort.cohort_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                  disabled={!selectedCohort}
                  required
                >
                  <option value="">Select student...</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={scoreDate}
                  onChange={(e) => setScoreDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Score and Max Score */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Score
                  </label>
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    min="0"
                    max={maxScore}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 7"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Score
                  </label>
                  <input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Baseline Test Checkbox */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBaseline}
                    onChange={(e) => setIsBaseline(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Baseline Test (Week 2)
                  </span>
                </label>
              </div>

              {/* Missed Rhythms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Missed Rhythms (Optional)
                </label>
                <div className="max-h-48 overflow-y-auto border dark:border-gray-600 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-700/50">
                  {RHYTHM_OPTIONS.map(rhythm => (
                    <label key={rhythm} className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-700 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={missedRhythms.includes(rhythm)}
                        onChange={() => toggleRhythm(rhythm)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{rhythm}</span>
                    </label>
                  ))}
                </div>
                {missedRhythms.length > 0 && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {missedRhythms.length} rhythm(s) selected
                  </p>
                )}
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
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes..."
                />
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {submitting ? 'Logging...' : 'Log Score'}
              </button>
            </form>
          </div>

          {/* Right: Recent Scores */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Scores</h2>
              </div>
              {selectedCohort && (
                <button
                  onClick={() => fetchRecentScores(selectedCohort)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              )}
            </div>

            {!selectedCohort ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a cohort to view recent scores</p>
              </div>
            ) : recentScores.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No scores logged yet for this cohort</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {recentScores.map((score) => (
                  <div
                    key={score.id}
                    className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {score.student?.last_name}, {score.student?.first_name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(score.date)}
                          {score.is_baseline && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded">
                              Baseline
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {score.score}/{score.max_score}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {Math.round((score.score / score.max_score) * 100)}%
                        </div>
                      </div>
                    </div>

                    {score.missed_rhythms && score.missed_rhythms.length > 0 && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span className="font-medium">Missed:</span>{' '}
                        {score.missed_rhythms.length === 1
                          ? '1 rhythm'
                          : `${score.missed_rhythms.length} rhythms`}
                      </div>
                    )}

                    {score.notes && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 italic mt-2 border-t dark:border-gray-700 pt-2">
                        {score.notes}
                      </div>
                    )}

                    {score.logged_by_user && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Logged by: {score.logged_by_user.name}
                      </div>
                    )}
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

export default function EKGWarmupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <EKGWarmupPageContent />
    </Suspense>
  );
}
