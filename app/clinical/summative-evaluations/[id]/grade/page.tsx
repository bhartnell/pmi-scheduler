'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  MapPin,
  Stethoscope,
  Activity,
  Pill,
  Heart,
  ClipboardList,
  Info,
  Radio,
  Printer,
  Thermometer,
  Zap
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
  expected_interventions: string[] | null;
  linked_scenario_id: string | null;
}

// Full scenario details from linked scenarios table
interface LinkedScenario {
  id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  chief_complaint: string | null;
  patient_name: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  patient_weight: string | null;
  medical_history: string[] | null;
  medications: string[] | null;
  allergies: string | null;
  instructor_notes: string | null;
  learning_objectives: string[] | null;
  dispatch_time: string | null;
  dispatch_location: string | null;
  dispatch_notes: string | null;
  phases: Phase[] | null;
  critical_actions: string[] | null;
  // Initial vitals (legacy field)
  initial_vitals: {
    bp?: string;
    hr?: number | string;
    rr?: number | string;
    spo2?: number | string;
    temp?: number | string;
    bgl?: number | string;
    etco2?: number | string;
    gcs?: number | string;
  } | null;
  // SAMPLE History
  sample_history: {
    signs_symptoms?: string;
    last_oral_intake?: string;
    events_leading?: string;
  } | null;
  // OPQRST
  opqrst: {
    onset?: string;
    provocation?: string;
    quality?: string;
    radiation?: string;
    severity?: string;
    time_onset?: string;
  } | null;
  // Assessment XABCDE
  assessment_x: string | null;
  assessment_a: string | null;
  assessment_b: string | null;
  assessment_c: string | null;
  assessment_d: string | null;
  assessment_e: string | null;
  // Neurological (part of D)
  gcs: string | null;
  pupils: string | null;
  // General impression
  general_impression: string | null;
  // AVPU
  avpu: string | null;
  // Secondary Survey
  secondary_survey: {
    head?: string;
    neck?: string;
    chest?: string;
    abdomen?: string;
    back?: string;
    pelvis?: string;
    extremities?: string;
  } | null;
  // EKG/Cardiac Findings
  ekg_findings: {
    rhythm?: string;
    rate?: string;
    interpretation?: string;
    twelve_lead?: string;
  } | null;
  // Debrief Points
  debrief_points: string[] | null;
}

interface Phase {
  name: string;
  vitals?: {
    bp?: string;
    hr?: number | string;
    rr?: number | string;
    spo2?: number | string;
    temp?: number | string;
    bgl?: number | string;
    etco2?: number | string;
    gcs?: number | string;
    rhythm?: string;
    ekg?: string;
    ekg_rhythm?: string;
  };
  presentation_notes?: string;
  expected_actions?: string[];
  instructor_cues?: string;
}

interface Evaluation {
  id: string;
  scenario: Scenario;
  linked_scenario?: LinkedScenario;
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
  const [showScenarioDetails, setShowScenarioDetails] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([0])); // Start with first phase open

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
              {/* Print Scenario Button */}
              {evaluation.linked_scenario && (
                <Link
                  href={`/api/clinical/summative-evaluations/${evaluationId}/scenario-print`}
                  target="_blank"
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Printer className="w-4 h-4" />
                  Print Scenario
                </Link>
              )}
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
            {/* Scenario Details Section - Always visible above grading */}
            {(evaluation.linked_scenario || evaluation.scenario) && (
              <div className="mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                  <button
                    onClick={() => setShowScenarioDetails(!showScenarioDetails)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center gap-3">
                      <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Scenario Details
                      </span>
                      {evaluation.linked_scenario && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          Full Details Available
                        </span>
                      )}
                    </div>
                    {showScenarioDetails ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>

                  {showScenarioDetails && (
                    <div className="p-6">
                      {evaluation.linked_scenario ? (
                        // Full linked scenario details - REORDERED for instructor workflow
                        <div className="space-y-6">
                          {/* 1. INSTRUCTOR NOTES (TOP - READ FIRST!) */}
                          {evaluation.linked_scenario.instructor_notes && (
                            <div className="bg-yellow-100 dark:bg-yellow-900/40 p-4 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
                              <h4 className="font-bold text-yellow-900 dark:text-yellow-200 mb-2 flex items-center gap-2 text-lg">
                                <Info className="w-5 h-5" />
                                INSTRUCTOR NOTES (READ FIRST)
                              </h4>
                              <p className="text-sm text-yellow-800 dark:text-yellow-300 whitespace-pre-wrap">{evaluation.linked_scenario.instructor_notes}</p>
                            </div>
                          )}

                          {/* 2. DISPATCH INFORMATION */}
                          {(evaluation.linked_scenario.dispatch_time || evaluation.linked_scenario.dispatch_location || evaluation.linked_scenario.dispatch_notes) && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Radio className="w-4 h-4" />
                                Dispatch Information
                              </h4>
                              <div className="grid md:grid-cols-3 gap-4 text-sm">
                                {evaluation.linked_scenario.dispatch_time && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Time:</span>{' '}
                                    <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.dispatch_time}</span>
                                  </div>
                                )}
                                {evaluation.linked_scenario.dispatch_location && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Location:</span>{' '}
                                    <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.dispatch_location}</span>
                                  </div>
                                )}
                                {evaluation.linked_scenario.dispatch_notes && (
                                  <div className="md:col-span-3">
                                    <span className="text-gray-500 dark:text-gray-400">Notes:</span>{' '}
                                    <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.dispatch_notes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 3. PATIENT INFORMATION & SCENE */}
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Patient Information & Scene
                            </h4>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  {evaluation.linked_scenario.patient_name && (
                                    <p><strong>Name:</strong> {evaluation.linked_scenario.patient_name}</p>
                                  )}
                                  {evaluation.linked_scenario.patient_age && (
                                    <p><strong>Age:</strong> {evaluation.linked_scenario.patient_age} years</p>
                                  )}
                                  {evaluation.linked_scenario.patient_sex && (
                                    <p><strong>Sex:</strong> {evaluation.linked_scenario.patient_sex}</p>
                                  )}
                                  {evaluation.linked_scenario.patient_weight && (
                                    <p><strong>Weight:</strong> {evaluation.linked_scenario.patient_weight}</p>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h5 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                  <Heart className="w-4 h-4" />
                                  Chief Complaint
                                </h5>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {evaluation.linked_scenario.chief_complaint || 'Not specified'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* 4. PRIMARY ASSESSMENT (XABCDE) */}
                          {(evaluation.linked_scenario.assessment_x || evaluation.linked_scenario.assessment_a ||
                            evaluation.linked_scenario.assessment_b || evaluation.linked_scenario.assessment_c ||
                            evaluation.linked_scenario.assessment_d || evaluation.linked_scenario.assessment_e ||
                            evaluation.linked_scenario.general_impression || evaluation.linked_scenario.avpu ||
                            evaluation.linked_scenario.gcs || evaluation.linked_scenario.pupils) && (
                            <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg border border-cyan-200 dark:border-cyan-800">
                              <h4 className="font-semibold text-cyan-800 dark:text-cyan-300 mb-3 flex items-center gap-2">
                                <Stethoscope className="w-4 h-4" />
                                Primary Assessment (XABCDE)
                              </h4>
                              <div className="space-y-2 text-sm">
                                {evaluation.linked_scenario.general_impression && (
                                  <div>
                                    <span className="font-medium text-cyan-700 dark:text-cyan-400">General Impression:</span>{' '}
                                    <span className="text-gray-700 dark:text-gray-300">{evaluation.linked_scenario.general_impression}</span>
                                  </div>
                                )}
                                {evaluation.linked_scenario.avpu && (
                                  <div>
                                    <span className="font-medium text-cyan-700 dark:text-cyan-400">AVPU:</span>{' '}
                                    <span className="text-gray-700 dark:text-gray-300">{evaluation.linked_scenario.avpu}</span>
                                  </div>
                                )}
                                <div className="grid gap-2 mt-2">
                                  {evaluation.linked_scenario.assessment_x && (
                                    <div className="flex items-start gap-2">
                                      <span className="inline-block w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded text-center font-bold text-sm leading-6">X</span>
                                      <span className="text-gray-700 dark:text-gray-300 flex-1">{evaluation.linked_scenario.assessment_x}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.assessment_a && (
                                    <div className="flex items-start gap-2">
                                      <span className="inline-block w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded text-center font-bold text-sm leading-6">A</span>
                                      <span className="text-gray-700 dark:text-gray-300 flex-1">{evaluation.linked_scenario.assessment_a}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.assessment_b && (
                                    <div className="flex items-start gap-2">
                                      <span className="inline-block w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded text-center font-bold text-sm leading-6">B</span>
                                      <span className="text-gray-700 dark:text-gray-300 flex-1">{evaluation.linked_scenario.assessment_b}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.assessment_c && (
                                    <div className="flex items-start gap-2">
                                      <span className="inline-block w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded text-center font-bold text-sm leading-6">C</span>
                                      <span className="text-gray-700 dark:text-gray-300 flex-1">{evaluation.linked_scenario.assessment_c}</span>
                                    </div>
                                  )}
                                  {(evaluation.linked_scenario.assessment_d || evaluation.linked_scenario.gcs || evaluation.linked_scenario.pupils) && (
                                    <div className="flex items-start gap-2">
                                      <span className="inline-block w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded text-center font-bold text-sm leading-6">D</span>
                                      <span className="text-gray-700 dark:text-gray-300 flex-1">
                                        {[
                                          evaluation.linked_scenario.assessment_d,
                                          evaluation.linked_scenario.gcs && `GCS: ${evaluation.linked_scenario.gcs}`,
                                          evaluation.linked_scenario.pupils && `Pupils: ${evaluation.linked_scenario.pupils}`
                                        ].filter(Boolean).join(' | ')}
                                      </span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.assessment_e && (
                                    <div className="flex items-start gap-2">
                                      <span className="inline-block w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded text-center font-bold text-sm leading-6">E</span>
                                      <span className="text-gray-700 dark:text-gray-300 flex-1">{evaluation.linked_scenario.assessment_e}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 5. SECONDARY ASSESSMENT (grouped) */}
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4">
                            <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                              <Thermometer className="w-4 h-4" />
                              Secondary Assessment
                            </h4>

                            {/* Vitals with EKG inline */}
                            {(evaluation.linked_scenario.initial_vitals && Object.values(evaluation.linked_scenario.initial_vitals).some(v => v)) && (
                              <div>
                                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Vital Signs</h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                  {evaluation.linked_scenario.initial_vitals.bp && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500 dark:text-gray-400">BP:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.initial_vitals.bp}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.initial_vitals.hr && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500 dark:text-gray-400">HR:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.initial_vitals.hr}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.initial_vitals.rr && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500 dark:text-gray-400">RR:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.initial_vitals.rr}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.initial_vitals.spo2 && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500 dark:text-gray-400">SpO2:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.initial_vitals.spo2}%</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.initial_vitals.temp && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500 dark:text-gray-400">Temp:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.initial_vitals.temp}°F</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.initial_vitals.bgl && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500 dark:text-gray-400">BGL:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.initial_vitals.bgl}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.initial_vitals.gcs && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500 dark:text-gray-400">GCS:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.initial_vitals.gcs}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.initial_vitals.etco2 && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500 dark:text-gray-400">ETCO2:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">{evaluation.linked_scenario.initial_vitals.etco2}</span>
                                    </div>
                                  )}
                                  {/* EKG inline with vitals */}
                                  {evaluation.linked_scenario.ekg_findings?.rhythm && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded col-span-2">
                                      <span className="text-gray-500 dark:text-gray-400">EKG:</span>{' '}
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {evaluation.linked_scenario.ekg_findings.rhythm}
                                        {evaluation.linked_scenario.ekg_findings.rate && ` @ ${evaluation.linked_scenario.ekg_findings.rate}`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {/* Additional EKG details if present */}
                                {evaluation.linked_scenario.ekg_findings && (evaluation.linked_scenario.ekg_findings.interpretation || evaluation.linked_scenario.ekg_findings.twelve_lead) && (
                                  <div className="mt-2 text-sm space-y-1">
                                    {evaluation.linked_scenario.ekg_findings.interpretation && (
                                      <p><span className="text-gray-500 dark:text-gray-400">EKG Interpretation:</span> <span className="text-gray-700 dark:text-gray-300">{evaluation.linked_scenario.ekg_findings.interpretation}</span></p>
                                    )}
                                    {evaluation.linked_scenario.ekg_findings.twelve_lead && (
                                      <p><span className="text-gray-500 dark:text-gray-400">12-Lead:</span> <span className="text-gray-700 dark:text-gray-300">{evaluation.linked_scenario.ekg_findings.twelve_lead}</span></p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Medical History */}
                            {(evaluation.linked_scenario.medical_history?.length ||
                              evaluation.linked_scenario.medications?.length ||
                              evaluation.linked_scenario.allergies) && (
                              <div>
                                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Medical History</h5>
                                <div className="grid md:grid-cols-3 gap-4 text-sm">
                                  {evaluation.linked_scenario.medical_history?.length ? (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">PMHx:</span>
                                      <ul className="text-gray-600 dark:text-gray-400 list-disc list-inside">
                                        {evaluation.linked_scenario.medical_history.map((item, idx) => (
                                          <li key={idx}>{item}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                  {evaluation.linked_scenario.medications?.length ? (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                        <Pill className="w-3 h-3" /> Medications:
                                      </span>
                                      <ul className="text-gray-600 dark:text-gray-400 list-disc list-inside">
                                        {evaluation.linked_scenario.medications.map((item, idx) => (
                                          <li key={idx}>{item}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                  {evaluation.linked_scenario.allergies && (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Allergies:</span>
                                      <p className="text-red-600 dark:text-red-400">{evaluation.linked_scenario.allergies}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* SAMPLE History - Complete format */}
                            <div>
                              <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
                                <ClipboardList className="w-3 h-3" /> SAMPLE History
                              </h5>
                              <div className="space-y-1 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">S - Signs/Symptoms:</span>{' '}
                                  <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.sample_history?.signs_symptoms || evaluation.linked_scenario.chief_complaint || '—'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">A - Allergies:</span>{' '}
                                  <span className={`${evaluation.linked_scenario.allergies ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {evaluation.linked_scenario.allergies || 'NKDA'}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">M - Medications:</span>{' '}
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {evaluation.linked_scenario.medications?.length ? evaluation.linked_scenario.medications.join(', ') : 'None'}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">P - Past Medical Hx:</span>{' '}
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {evaluation.linked_scenario.medical_history?.length ? evaluation.linked_scenario.medical_history.join(', ') : 'None'}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">L - Last Oral Intake:</span>{' '}
                                  <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.sample_history?.last_oral_intake || '—'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">E - Events Leading:</span>{' '}
                                  <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.sample_history?.events_leading || '—'}</span>
                                </div>
                              </div>
                            </div>

                            {/* OPQRST */}
                            {evaluation.linked_scenario.opqrst && Object.values(evaluation.linked_scenario.opqrst).some(v => v) && (
                              <div>
                                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> OPQRST (Pain Assessment)
                                </h5>
                                <div className="grid md:grid-cols-2 gap-1 text-sm">
                                  {evaluation.linked_scenario.opqrst.onset && (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">O - Onset:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.opqrst.onset}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.opqrst.provocation && (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">P - Provocation:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.opqrst.provocation}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.opqrst.quality && (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Q - Quality:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.opqrst.quality}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.opqrst.radiation && (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">R - Radiation:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.opqrst.radiation}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.opqrst.severity && (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">S - Severity:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.opqrst.severity}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.opqrst.time_onset && (
                                    <div>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">T - Time:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.opqrst.time_onset}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Secondary Survey */}
                            {evaluation.linked_scenario.secondary_survey && Object.values(evaluation.linked_scenario.secondary_survey).some(v => v) && (
                              <div>
                                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
                                  <Activity className="w-3 h-3" /> Secondary Survey (Physical Exam)
                                </h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                  {evaluation.linked_scenario.secondary_survey.head && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Head:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.secondary_survey.head}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.secondary_survey.neck && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Neck:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.secondary_survey.neck}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.secondary_survey.chest && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Chest:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.secondary_survey.chest}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.secondary_survey.abdomen && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Abdomen:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.secondary_survey.abdomen}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.secondary_survey.back && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Back:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.secondary_survey.back}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.secondary_survey.pelvis && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Pelvis:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.secondary_survey.pelvis}</span>
                                    </div>
                                  )}
                                  {evaluation.linked_scenario.secondary_survey.extremities && (
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded col-span-2 md:col-span-1">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Extremities:</span>{' '}
                                      <span className="text-gray-600 dark:text-gray-400">{evaluation.linked_scenario.secondary_survey.extremities}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 6. CRITICAL ACTIONS */}
                          {evaluation.linked_scenario.critical_actions?.length ? (
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                              <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Critical Actions (Must Perform)
                              </h4>
                              <ul className="text-sm text-red-700 dark:text-red-400 list-disc list-inside">
                                {evaluation.linked_scenario.critical_actions.map((action, idx) => (
                                  <li key={idx}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {/* 7. SCENARIO PHASES */}
                          {evaluation.linked_scenario.phases?.length ? (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                Scenario Phases
                              </h4>
                              <div className="space-y-2">
                                {evaluation.linked_scenario.phases.map((phase, idx) => (
                                  <div key={idx} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                                    <button
                                      onClick={() => {
                                        const newSet = new Set(expandedPhases);
                                        if (newSet.has(idx)) {
                                          newSet.delete(idx);
                                        } else {
                                          newSet.add(idx);
                                        }
                                        setExpandedPhases(newSet);
                                      }}
                                      className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {/* Show phase title - use actual name if it's not just "Phase X" */}
                                        {phase.name && !phase.name.match(/^Phase \d+$/i)
                                          ? `Phase ${idx + 1}: ${phase.name}`
                                          : `Phase ${idx + 1}`}
                                      </span>
                                      {expandedPhases.has(idx) ? (
                                        <ChevronUp className="w-4 h-4 text-gray-500" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                      )}
                                    </button>
                                    {expandedPhases.has(idx) && (
                                      <div className="p-4 space-y-3">
                                        {phase.vitals && (
                                          <div>
                                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vitals</h5>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                              {phase.vitals.bp && (
                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                                  <span className="text-gray-500 dark:text-gray-400">BP:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.bp}</span>
                                                </div>
                                              )}
                                              {phase.vitals.hr && (
                                                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                                  <span className="text-gray-500 dark:text-gray-400">HR:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.hr}</span>
                                                </div>
                                              )}
                                              {phase.vitals.rr && (
                                                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                                  <span className="text-gray-500 dark:text-gray-400">RR:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.rr}</span>
                                                </div>
                                              )}
                                              {phase.vitals.spo2 && (
                                                <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                                                  <span className="text-gray-500 dark:text-gray-400">SpO2:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.spo2}%</span>
                                                </div>
                                              )}
                                              {phase.vitals.temp && (
                                                <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                                                  <span className="text-gray-500 dark:text-gray-400">Temp:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.temp}°F</span>
                                                </div>
                                              )}
                                              {phase.vitals.bgl && (
                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                                                  <span className="text-gray-500 dark:text-gray-400">BGL:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.bgl}</span>
                                                </div>
                                              )}
                                              {phase.vitals.gcs && (
                                                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                                  <span className="text-gray-500 dark:text-gray-400">GCS:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.gcs}</span>
                                                </div>
                                              )}
                                              {phase.vitals.etco2 && (
                                                <div className="bg-cyan-50 dark:bg-cyan-900/20 p-2 rounded">
                                                  <span className="text-gray-500 dark:text-gray-400">ETCO2:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.etco2}</span>
                                                </div>
                                              )}
                                              {(phase.vitals.rhythm || phase.vitals.ekg || phase.vitals.ekg_rhythm) && (
                                                <div className="bg-pink-50 dark:bg-pink-900/20 p-2 rounded col-span-2">
                                                  <span className="text-gray-500 dark:text-gray-400">EKG Rhythm:</span>{' '}
                                                  <span className="font-medium text-gray-900 dark:text-white">{phase.vitals.ekg_rhythm || phase.vitals.rhythm || phase.vitals.ekg}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {phase.presentation_notes && (
                                          <div>
                                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Presentation</h5>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{phase.presentation_notes}</p>
                                          </div>
                                        )}
                                        {phase.expected_actions?.length ? (
                                          <div>
                                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Actions</h5>
                                            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                                              {phase.expected_actions.map((action, aIdx) => (
                                                <li key={aIdx}>{action}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        ) : null}
                                        {phase.instructor_cues && (
                                          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                                            <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">Instructor Cues</h5>
                                            <p className="text-sm text-yellow-700 dark:text-yellow-400">{phase.instructor_cues}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* 8. DEBRIEF POINTS */}
                          {evaluation.linked_scenario.debrief_points?.length ? (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                              <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Debrief Discussion Points
                              </h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                {evaluation.linked_scenario.debrief_points.map((point, idx) => (
                                  <li key={idx}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        // Basic summative scenario info (no linked scenario)
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {evaluation.scenario.description || 'No description available'}
                            </p>
                          </div>
                          {evaluation.scenario.patient_presentation && (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Patient Presentation</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {evaluation.scenario.patient_presentation}
                              </p>
                            </div>
                          )}
                          {evaluation.scenario.expected_interventions?.length ? (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <ClipboardList className="w-4 h-4" />
                                Expected Interventions
                              </h4>
                              <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                                {evaluation.scenario.expected_interventions.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
