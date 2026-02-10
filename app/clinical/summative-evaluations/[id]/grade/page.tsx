'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Save,
  ArrowLeft,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Download,
  MapPin
} from 'lucide-react';
import { canAccessClinical, canEditClinical, type Role } from '@/lib/permissions';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Score {
  id: string;
  student_id: string;
  student: Student;
  leadership_scene_score: number | null;
  patient_assessment_score: number | null;
  patient_management_score: number | null;
  interpersonal_score: number | null;
  integration_score: number | null;
  total_score: number | null;
  critical_criteria_failed: boolean;
  critical_fails_mandatory: boolean;
  critical_harmful_intervention: boolean;
  critical_unprofessional: boolean;
  critical_criteria_notes: string | null;
  passed: boolean | null;
  start_time: string | null;
  end_time: string | null;
  examiner_notes: string | null;
  feedback_provided: string | null;
  grading_complete: boolean;
  graded_at: string | null;
}

interface Scenario {
  id: string;
  scenario_number: number;
  title: string;
  description: string | null;
  patient_presentation: string | null;
}

interface Evaluation {
  id: string;
  scenario: Scenario;
  cohort: {
    id: string;
    cohort_number: string;
    program: { abbreviation: string } | null;
  } | null;
  evaluation_date: string;
  start_time: string | null;
  examiner_name: string;
  examiner_email: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  scores: Score[];
}

// Score category descriptions - PMI's official 5 rubric categories
const SCORE_CATEGORIES = [
  {
    key: 'leadership_scene_score',
    label: 'Leadership and Scene Management',
    shortLabel: 'Leadership/Scene',
    description: 'Takes charge of scene, ensures safety, manages resources effectively'
  },
  {
    key: 'patient_assessment_score',
    label: 'Patient Assessment',
    shortLabel: 'Assessment',
    description: 'Performs thorough and systematic primary and secondary assessments'
  },
  {
    key: 'patient_management_score',
    label: 'Patient Management',
    shortLabel: 'Management',
    description: 'Provides appropriate interventions and treatment based on assessment'
  },
  {
    key: 'interpersonal_score',
    label: 'Interpersonal Relations',
    shortLabel: 'Interpersonal',
    description: 'Communicates effectively with patient, family, and team members'
  },
  {
    key: 'integration_score',
    label: 'Integration (Field Impression & Transport)',
    shortLabel: 'Integration',
    description: 'Forms accurate field impression and makes appropriate transport decisions'
  }
];

// Critical criteria types
const CRITICAL_CRITERIA = [
  {
    key: 'critical_fails_mandatory',
    label: 'Fails Mandatory Actions',
    description: 'Failed to perform required critical interventions'
  },
  {
    key: 'critical_harmful_intervention',
    label: 'Harmful Intervention',
    description: 'Performed intervention that could harm patient'
  },
  {
    key: 'critical_unprofessional',
    label: 'Unprofessional Behavior',
    description: 'Demonstrated unprofessional conduct'
  }
];

function GradingPageContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const evaluationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Local score state for editing
  const [localScores, setLocalScores] = useState<Record<string, Partial<Score>>>({});

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (session && evaluationId) {
      fetchData();
    }
  }, [session, evaluationId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get user role
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      // Fetch evaluation
      const evalRes = await fetch(`/api/clinical/summative-evaluations/${evaluationId}`);
      const evalData = await evalRes.json();

      if (evalData.success && evalData.evaluation) {
        setEvaluation(evalData.evaluation);

        // Initialize local scores
        const scores: Record<string, Partial<Score>> = {};
        evalData.evaluation.scores.forEach((score: Score) => {
          scores[score.student_id] = { ...score };
        });
        setLocalScores(scores);

        // Set active student to first one
        if (evalData.evaluation.scores.length > 0 && !activeStudentId) {
          setActiveStudentId(evalData.evaluation.scores[0].student_id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const updateLocalScore = (studentId: string, field: string, value: any) => {
    setLocalScores(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const saveScore = async (studentId: string, markComplete: boolean = false) => {
    setSaving(true);
    try {
      const scoreData = localScores[studentId];
      const payload: Record<string, any> = {
        student_id: studentId,
        leadership_scene_score: scoreData.leadership_scene_score,
        patient_assessment_score: scoreData.patient_assessment_score,
        patient_management_score: scoreData.patient_management_score,
        interpersonal_score: scoreData.interpersonal_score,
        integration_score: scoreData.integration_score,
        critical_criteria_failed: scoreData.critical_criteria_failed || false,
        critical_fails_mandatory: scoreData.critical_fails_mandatory || false,
        critical_harmful_intervention: scoreData.critical_harmful_intervention || false,
        critical_unprofessional: scoreData.critical_unprofessional || false,
        critical_criteria_notes: scoreData.critical_criteria_notes || null,
        examiner_notes: scoreData.examiner_notes || null,
        feedback_provided: scoreData.feedback_provided || null,
        start_time: scoreData.start_time || null,
        end_time: scoreData.end_time || null
      };

      if (markComplete) {
        payload.grading_complete = true;
      }

      const res = await fetch(`/api/clinical/summative-evaluations/${evaluationId}/scores`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast(markComplete ? 'Grading completed!' : 'Score saved', 'success');
        setHasChanges(false);
        await fetchData();
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch (error) {
      console.error('Error saving score:', error);
      showToast('Failed to save score', 'error');
    }
    setSaving(false);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateTotal = (studentId: string) => {
    const scores = localScores[studentId];
    if (!scores) return 0;
    return (
      (scores.leadership_scene_score || 0) +
      (scores.patient_assessment_score || 0) +
      (scores.patient_management_score || 0) +
      (scores.interpersonal_score || 0) +
      (scores.integration_score || 0)
    );
  };

  const getPassStatus = (studentId: string) => {
    const scores = localScores[studentId];
    if (!scores) return null;
    if (scores.critical_criteria_failed) return 'fail';
    const total = calculateTotal(studentId);
    return total >= 12 ? 'pass' : 'fail';
  };

  const canEdit = userRole ? canEditClinical(userRole) : false;

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!session || !evaluation) return null;

  const activeScore = activeStudentId ? localScores[activeStudentId] : null;
  const activeStudent = evaluation.scores.find(s => s.student_id === activeStudentId)?.student;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 dark:from-gray-900 dark:to-gray-800">
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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-orange-600 dark:hover:text-orange-400">Clinical</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Summative Evaluation</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>

              <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  S{evaluation.scenario?.scenario_number}
                </span>
              </div>

              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {evaluation.scenario?.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(evaluation.evaluation_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {evaluation.examiner_name}
                  </span>
                  {evaluation.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {evaluation.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Export PDF Button */}
              <Link
                href={`/api/clinical/summative-evaluations/${evaluationId}/export`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-600 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Student List Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden sticky top-4">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h3 className="font-semibold text-gray-900 dark:text-white">Students ({evaluation.scores.length})</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {evaluation.scores.map(score => {
                  const isActive = score.student_id === activeStudentId;
                  const studentScore = localScores[score.student_id];
                  const total = calculateTotal(score.student_id);
                  const status = getPassStatus(score.student_id);

                  return (
                    <button
                      key={score.id}
                      onClick={() => setActiveStudentId(score.student_id)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        isActive
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {score.student?.first_name} {score.student?.last_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {studentScore?.grading_complete ? (
                              <span className={`flex items-center gap-1 ${
                                status === 'pass' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {status === 'pass' ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                                {status === 'pass' ? 'Passed' : 'Failed'} ({total}/15)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-yellow-600">
                                <Clock className="w-3 h-3" />
                                In Progress ({total}/15)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Grading Form */}
          <div className="lg:col-span-3">
            {activeScore && activeStudent ? (
              <div className="space-y-6">
                {/* Student Header */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          {activeStudent.first_name} {activeStudent.last_name}
                        </h2>
                        <div className="text-sm text-gray-500">Grading for this student</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                          {calculateTotal(activeStudentId!)}/15
                        </div>
                        <div className={`text-sm font-medium ${
                          getPassStatus(activeStudentId!) === 'pass'
                            ? 'text-green-600'
                            : calculateTotal(activeStudentId!) > 0
                              ? 'text-red-600'
                              : 'text-gray-400'
                        }`}>
                          {getPassStatus(activeStudentId!) === 'pass'
                            ? 'Passing (≥80%)'
                            : calculateTotal(activeStudentId!) > 0
                              ? 'Below Passing'
                              : 'Not Scored'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Categories */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Scoring Categories</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Score each category 0-3 points</p>
                  </div>

                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {SCORE_CATEGORIES.map(category => {
                      const scoreKey = category.key as keyof Score;
                      const currentValue = (activeScore[scoreKey] as number | null) ?? null;

                      return (
                        <div key={category.key} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">{category.shortLabel}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{category.description}</div>
                            </div>

                            {canEdit ? (
                              <div className="flex items-center gap-2 ml-4">
                                {[0, 1, 2, 3].map(score => (
                                  <button
                                    key={score}
                                    onClick={() => updateLocalScore(activeStudentId!, category.key, score)}
                                    className={`w-12 h-12 rounded-lg font-bold text-lg transition-all ${
                                      currentValue === score
                                        ? score === 3
                                          ? 'bg-green-500 text-white shadow-lg scale-110'
                                          : score === 2
                                            ? 'bg-yellow-500 text-white shadow-lg scale-110'
                                            : score === 1
                                              ? 'bg-orange-500 text-white shadow-lg scale-110'
                                              : 'bg-red-500 text-white shadow-lg scale-110'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    {score}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {currentValue ?? '-'}/3
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Critical Criteria */}
                <div className={`bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden ${
                  activeScore.critical_criteria_failed ? 'ring-2 ring-red-500' : ''
                }`}>
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">Critical Criteria</h3>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400">Failure of any critical criteria = automatic fail</p>
                  </div>

                  <div className="p-6 space-y-4">
                    {CRITICAL_CRITERIA.map(criteria => {
                      const isChecked = (activeScore[criteria.key as keyof Score] as boolean) || false;
                      return (
                        <label key={criteria.key} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              updateLocalScore(activeStudentId!, criteria.key, e.target.checked);
                              // Update the main critical_criteria_failed flag
                              const newValue = e.target.checked;
                              const otherCriteria = CRITICAL_CRITERIA.filter(c => c.key !== criteria.key);
                              const anyOtherFailed = otherCriteria.some(c =>
                                (activeScore[c.key as keyof Score] as boolean) || false
                              );
                              updateLocalScore(activeStudentId!, 'critical_criteria_failed', newValue || anyOtherFailed);
                            }}
                            disabled={!canEdit}
                            className="w-5 h-5 text-red-600 rounded mt-0.5"
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{criteria.label}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{criteria.description}</div>
                          </div>
                        </label>
                      );
                    })}

                    {activeScore.critical_criteria_failed && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Additional details about critical failure:
                        </label>
                        <textarea
                          value={activeScore.critical_criteria_notes || ''}
                          onChange={(e) => updateLocalScore(activeStudentId!, 'critical_criteria_notes', e.target.value)}
                          disabled={!canEdit}
                          rows={3}
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          placeholder="Document the critical criteria failure..."
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes & Feedback */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">Notes & Feedback</h3>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={activeScore.start_time || ''}
                          onChange={(e) => updateLocalScore(activeStudentId!, 'start_time', e.target.value)}
                          disabled={!canEdit}
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={activeScore.end_time || ''}
                          onChange={(e) => updateLocalScore(activeStudentId!, 'end_time', e.target.value)}
                          disabled={!canEdit}
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Examiner Notes (Internal)
                      </label>
                      <textarea
                        value={activeScore.examiner_notes || ''}
                        onChange={(e) => updateLocalScore(activeStudentId!, 'examiner_notes', e.target.value)}
                        disabled={!canEdit}
                        rows={3}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="Internal notes about the evaluation..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Feedback for Student
                      </label>
                      <textarea
                        value={activeScore.feedback_provided || ''}
                        onChange={(e) => updateLocalScore(activeStudentId!, 'feedback_provided', e.target.value)}
                        disabled={!canEdit}
                        rows={3}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="Constructive feedback to share with the student..."
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {canEdit && (
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {hasChanges ? (
                        <span className="text-yellow-600">Unsaved changes</span>
                      ) : (
                        <span>All changes saved</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => saveScore(activeStudentId!, false)}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Draft
                      </button>

                      <button
                        onClick={() => saveScore(activeStudentId!, true)}
                        disabled={saving || activeScore.grading_complete}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {activeScore.grading_complete ? 'Grading Complete' : 'Complete Grading'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                <User className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Select a student to begin grading</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SummativeGradingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    }>
      <GradingPageContent />
    </Suspense>
  );
}
