'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Loader2,
  AlertTriangle,
  X,
  Search
} from 'lucide-react';
import { parseDateSafe } from '@/lib/utils';

interface Scenario {
  id: string;
  scenario_number: number;
  title: string;
  description: string | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface EvaluationScore {
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
  passed: boolean | null;
  grading_complete: boolean;
}

interface Evaluation {
  id: string;
  scenario: Scenario;
  evaluation_date: string;
  start_time: string | null;
  examiner_name: string;
  location: string | null;
  status: string;
  scores: EvaluationScore[];
}

interface Props {
  internshipId: string;
  studentId: string;
  studentName: string;
  cohortId: string | null;
  canEdit: boolean;
}

export default function SummativeEvaluationsSection({
  internshipId,
  studentId,
  studentName,
  cohortId,
  canEdit
}: Props) {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New evaluation form
  const [newEval, setNewEval] = useState({
    scenario_id: '',
    evaluation_date: new Date().toISOString().split('T')[0],
    start_time: '',
    examiner_name: '',
    location: '',
    notes: ''
  });
  const [selectedStudents, setSelectedStudents] = useState<string[]>([studentId]);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [internshipId, studentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch evaluations for this student
      const evalRes = await fetch(`/api/clinical/summative-evaluations?studentId=${studentId}`);
      const evalData = await evalRes.json();
      if (evalData.success) {
        setEvaluations(evalData.evaluations || []);
      }

      // Fetch scenarios
      const scenarioRes = await fetch('/api/clinical/summative-scenarios');
      const scenarioData = await scenarioRes.json();
      if (scenarioData.success) {
        setScenarios(scenarioData.scenarios || []);
      }

      // Fetch cohort students if we have a cohort
      if (cohortId) {
        const studentsRes = await fetch(`/api/students?cohortId=${cohortId}`);
        const studentsData = await studentsRes.json();
        if (studentsData.success) {
          setCohortStudents(studentsData.students || []);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load evaluations');
    }
    setLoading(false);
  };

  const handleCreateEvaluation = async () => {
    if (!newEval.scenario_id) {
      setError('Please select a scenario');
      return;
    }
    if (!newEval.examiner_name.trim()) {
      setError('Please enter examiner name');
      return;
    }
    if (selectedStudents.length === 0) {
      setError('Please select at least one student');
      return;
    }
    if (selectedStudents.length > 6) {
      setError('Maximum 6 students per evaluation');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/clinical/summative-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEval,
          cohort_id: cohortId,
          internship_id: internshipId,
          student_ids: selectedStudents
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowNewModal(false);
        setNewEval({
          scenario_id: '',
          evaluation_date: new Date().toISOString().split('T')[0],
          start_time: '',
          examiner_name: '',
          location: '',
          notes: ''
        });
        setSelectedStudents([studentId]);
        await fetchData();
      } else {
        setError(data.error || 'Failed to create evaluation');
      }
    } catch (err) {
      console.error('Error creating evaluation:', err);
      setError('Failed to create evaluation');
    }
    setSaving(false);
  };

  const toggleStudent = (id: string) => {
    if (selectedStudents.includes(id)) {
      // Don't allow removing the primary student
      if (id === studentId) return;
      setSelectedStudents(selectedStudents.filter(s => s !== id));
    } else {
      if (selectedStudents.length >= 6) {
        setError('Maximum 6 students per evaluation');
        return;
      }
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const getStatusBadge = (evaluation: Evaluation) => {
    // Find score for this student
    const studentScore = evaluation.scores.find(s => s.student_id === studentId);

    if (!studentScore) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          Not Graded
        </span>
      );
    }

    if (!studentScore.grading_complete) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          In Progress
        </span>
      );
    }

    if (studentScore.passed) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Passed ({studentScore.total_score}/15)
        </span>
      );
    }

    return (
      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        {studentScore.critical_criteria_failed ? 'Critical Fail' : `Failed (${studentScore.total_score}/15)`}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return parseDateSafe(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredStudents = cohortStudents.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Summative Evaluations</h3>
          </div>
        </div>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Summative Evaluations</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">Semester 4 Final Scenarios</span>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Evaluation
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          {evaluations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No summative evaluations yet</p>
              {canEdit && (
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-3 text-orange-600 dark:text-orange-400 hover:underline text-sm"
                >
                  Create first evaluation
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {evaluations.map(evaluation => (
                <Link
                  key={evaluation.id}
                  href={`/clinical/summative-evaluations/${evaluation.id}/grade`}
                  className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          S{evaluation.scenario?.scenario_number}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {evaluation.scenario?.title}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(evaluation.evaluation_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {evaluation.examiner_name}
                          </span>
                          {evaluation.scores.length > 1 && (
                            <span className="text-xs text-gray-400">
                              +{evaluation.scores.length - 1} other students
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(evaluation)}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Evaluation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Summative Evaluation</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Scenario Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scenario *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {scenarios.map(scenario => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => setNewEval({ ...newEval, scenario_id: scenario.id })}
                      className={`p-3 text-left rounded-lg border-2 transition-colors ${
                        newEval.scenario_id === scenario.id
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-sm font-bold">
                          {scenario.scenario_number}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {scenario.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Evaluation Date *
                  </label>
                  <input
                    type="date"
                    value={newEval.evaluation_date}
                    onChange={(e) => setNewEval({ ...newEval, evaluation_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newEval.start_time}
                    onChange={(e) => setNewEval({ ...newEval, start_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Examiner Name *
                  </label>
                  <input
                    type="text"
                    value={newEval.examiner_name}
                    onChange={(e) => setNewEval({ ...newEval, examiner_name: e.target.value })}
                    placeholder="Enter examiner name"
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newEval.location}
                    onChange={(e) => setNewEval({ ...newEval, location: e.target.value })}
                    placeholder="e.g., Lab Room 101"
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Student Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Students (1-6) *
                </label>

                {/* Primary student is always selected */}
                <div className="mb-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{studentName}</span>
                    <span className="text-xs text-gray-500">(Primary - cannot remove)</span>
                  </div>
                </div>

                {cohortStudents.length > 0 && (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search students to add..."
                        className="w-full pl-9 pr-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto border rounded-lg border-gray-200 dark:border-gray-700">
                      {filteredStudents
                        .filter(s => s.id !== studentId)
                        .map(student => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => toggleStudent(student.id)}
                            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                              selectedStudents.includes(student.id)
                                ? 'bg-orange-50 dark:bg-orange-900/10'
                                : ''
                            }`}
                          >
                            <span className="text-sm text-gray-900 dark:text-white">
                              {student.first_name} {student.last_name}
                            </span>
                            {selectedStudents.includes(student.id) && (
                              <CheckCircle2 className="w-4 h-4 text-orange-600" />
                            )}
                          </button>
                        ))}
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={newEval.notes}
                  onChange={(e) => setNewEval({ ...newEval, notes: e.target.value })}
                  rows={2}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvaluation}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Evaluation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
