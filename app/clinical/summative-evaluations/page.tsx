'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Home,
  ChevronRight,
  ClipboardList,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  X,
  Search,
  Filter,
  Users,
  FileText,
  Info
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';

interface Scenario {
  id: string;
  scenario_number: number;
  title: string;
  description: string | null;
  linked_scenario_id: string | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Cohort {
  id: string;
  cohort_number: string;
  program: { abbreviation: string } | null;
}

interface EvaluationScore {
  id: string;
  student_id: string;
  student: Student;
  total_score: number | null;
  critical_criteria_failed: boolean;
  passed: boolean | null;
  grading_complete: boolean;
}

interface Evaluation {
  id: string;
  scenario: Scenario | null;
  cohort: Cohort | null;
  evaluation_date: string;
  start_time: string | null;
  examiner_name: string;
  location: string | null;
  status: string;
  scores: EvaluationScore[];
}

export default function SummativeEvaluationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Filters
  const [filterCohort, setFilterCohort] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // New evaluation modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEval, setNewEval] = useState({
    scenario_id: '',
    cohort_id: '',
    evaluation_date: new Date().toISOString().split('T')[0],
    start_time: '',
    examiner_name: '',
    location: '',
    notes: ''
  });
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

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

  useEffect(() => {
    if (newEval.cohort_id) {
      fetchCohortStudents(newEval.cohort_id);
    } else {
      setCohortStudents([]);
      setSelectedStudents([]);
    }
  }, [newEval.cohort_id]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch current user
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      // Fetch all data in parallel
      const [evalRes, scenarioRes, cohortsRes] = await Promise.all([
        fetch('/api/clinical/summative-evaluations'),
        fetch('/api/clinical/summative-scenarios'),
        fetch('/api/lab-management/cohorts?activeOnly=true')
      ]);

      const evalData = await evalRes.json();
      const scenarioData = await scenarioRes.json();
      const cohortsData = await cohortsRes.json();

      if (evalData.success) {
        setEvaluations(evalData.evaluations || []);
      }
      if (scenarioData.success) {
        setScenarios(scenarioData.scenarios || []);
      }
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    }
    setLoading(false);
  };

  const fetchCohortStudents = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/students?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success) {
        setCohortStudents(data.students || []);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const handleCreateEvaluation = async () => {
    if (!newEval.scenario_id) {
      setError('Please select a scenario');
      return;
    }
    if (!newEval.cohort_id) {
      setError('Please select a cohort');
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
          student_ids: selectedStudents
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowNewModal(false);
        resetForm();
        await fetchInitialData();
      } else {
        setError(data.error || 'Failed to create evaluation');
      }
    } catch (err) {
      console.error('Error creating evaluation:', err);
      setError('Failed to create evaluation');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setNewEval({
      scenario_id: '',
      cohort_id: '',
      evaluation_date: new Date().toISOString().split('T')[0],
      start_time: '',
      examiner_name: '',
      location: '',
      notes: ''
    });
    setSelectedStudents([]);
    setStudentSearch('');
  };

  const toggleStudent = (id: string) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(s => s !== id));
    } else {
      if (selectedStudents.length >= 6) {
        setError('Maximum 6 students per evaluation');
        return;
      }
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getEvaluationStatus = (evaluation: Evaluation) => {
    const scores = evaluation.scores || [];
    if (scores.length === 0) return 'pending';

    const allComplete = scores.every(s => s.grading_complete);
    if (!allComplete) return 'in_progress';

    const allPassed = scores.every(s => s.passed === true);
    const someFailed = scores.some(s => s.passed === false);

    if (allPassed) return 'all_passed';
    if (someFailed) return 'some_failed';
    return 'completed';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'all_passed':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            All Passed
          </span>
        );
      case 'some_failed':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Some Failed
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Pending
          </span>
        );
    }
  };

  // Filter evaluations
  const filteredEvaluations = evaluations.filter(evaluation => {
    if (filterCohort && evaluation.cohort?.id !== filterCohort) return false;
    if (filterStatus) {
      const status = getEvaluationStatus(evaluation);
      if (filterStatus === 'completed' && !['all_passed', 'some_failed', 'completed'].includes(status)) return false;
      if (filterStatus === 'in_progress' && status !== 'in_progress') return false;
      if (filterStatus === 'pending' && status !== 'pending') return false;
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesExaminer = evaluation.examiner_name.toLowerCase().includes(search);
      const matchesScenario = evaluation.scenario?.title.toLowerCase().includes(search);
      const matchesStudent = evaluation.scores?.some(s =>
        `${s.student.first_name} ${s.student.last_name}`.toLowerCase().includes(search)
      );
      if (!matchesExaminer && !matchesScenario && !matchesStudent) return false;
    }
    return true;
  });

  const filteredStudents = cohortStudents.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const canEdit = userRole && ['superadmin', 'admin', 'instructor'].includes(userRole);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-orange-600 dark:hover:text-orange-400">
              Clinical
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Summative Evaluations</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <ClipboardList className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Summative Evaluations</h1>
                <p className="text-gray-600 dark:text-gray-400">Semester 4 Final Psychomotor Scenarios</p>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Evaluation
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow mb-6 p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by examiner, scenario, or student..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterCohort}
                onChange={(e) => setFilterCohort(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                <option value="">All Cohorts</option>
                {cohorts.map(cohort => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.program?.abbreviation} {cohort.cohort_number}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Evaluations List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {filteredEvaluations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No summative evaluations found</p>
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
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEvaluations.map(evaluation => (
                <Link
                  key={evaluation.id}
                  href={`/clinical/summative-evaluations/${evaluation.id}/grade`}
                  className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                        <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                          S{evaluation.scenario?.scenario_number || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {evaluation.scenario?.title || 'Unknown Scenario'}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(evaluation.evaluation_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {evaluation.examiner_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {evaluation.scores?.length || 0} student{evaluation.scores?.length !== 1 ? 's' : ''}
                          </span>
                          {evaluation.cohort && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                              {evaluation.cohort.program?.abbreviation} {evaluation.cohort.cohort_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(getEvaluationStatus(evaluation))}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Evaluation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Summative Evaluation</h2>
              <button
                onClick={() => { setShowNewModal(false); resetForm(); }}
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

              {/* Cohort Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort *
                </label>
                <select
                  value={newEval.cohort_id}
                  onChange={(e) => setNewEval({ ...newEval, cohort_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="">Select cohort...</option>
                  {cohorts.map(cohort => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.program?.abbreviation} {cohort.cohort_number}
                    </option>
                  ))}
                </select>
              </div>

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
                          : scenario.linked_scenario_id
                            ? 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${
                          scenario.linked_scenario_id
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {scenario.scenario_number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white block truncate">
                            {scenario.title}
                          </span>
                          <span className={`text-xs flex items-center gap-1 ${
                            scenario.linked_scenario_id
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {scenario.linked_scenario_id ? (
                              <>
                                <FileText className="w-3 h-3" />
                                Full Details
                              </>
                            ) : (
                              <>
                                <Info className="w-3 h-3" />
                                Basic Only
                              </>
                            )}
                          </span>
                        </div>
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
                  Students (1-6) * {selectedStudents.length > 0 && `(${selectedStudents.length} selected)`}
                </label>

                {!newEval.cohort_id ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Select a cohort first to see available students
                  </div>
                ) : cohortStudents.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No students found in this cohort
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search students..."
                        className="w-full pl-9 pr-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Selected students chips */}
                    {selectedStudents.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedStudents.map(id => {
                          const student = cohortStudents.find(s => s.id === id);
                          if (!student) return null;
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm"
                            >
                              {student.first_name} {student.last_name}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleStudent(id); }}
                                className="hover:text-orange-900 dark:hover:text-orange-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="max-h-40 overflow-y-auto border rounded-lg border-gray-200 dark:border-gray-700">
                      {filteredStudents.map(student => (
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
                onClick={() => { setShowNewModal(false); resetForm(); }}
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
    </div>
  );
}
