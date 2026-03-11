'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { canEditLVFR, isAgencyRole as checkAgencyRole } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronRight, Loader2, Search,
  ClipboardCheck, Activity, Users, BarChart3,
  Grid3X3, User, Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Skill {
  id: string;
  category: string;
  name: string;
  description: string | null;
  nremt_tested: boolean;
  introduced_day: number | null;
  practice_days: number[] | null;
  evaluation_day: number | null;
  min_practice_attempts: number;
  equipment_needed: string[] | null;
  safety_note: string | null;
}

interface SkillStatus {
  status: string;
  total_attempts: number;
  last_attempt_date: string | null;
  completed_date: string | null;
}

interface SkillDetail extends Skill {
  status: SkillStatus;
  attempts: Array<{
    id: string;
    attempt_number: number;
    date: string;
    result: string;
    notes: string | null;
    evaluator: { name: string }[] | null;
  }>;
}

interface StudentSummary {
  student_id: string;
  first_name: string;
  last_name: string;
  total_skills: number;
  satisfactory: number;
  in_progress: number;
  needs_remediation: number;
  not_started: number;
  completion_pct: number;
  category_breakdown: Record<string, { total: number; satisfactory: number; in_progress: number; needs_remediation: number }>;
}

interface MatrixData {
  skills: Array<{ id: string; name: string; category: string; nremt_tested: boolean; min_practice_attempts: number }>;
  students: Array<{ id: string; first_name: string; last_name: string }>;
  matrix: Record<string, Record<string, { status: string; total_attempts: number }>>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-700', dotColor: 'bg-gray-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', dotColor: 'bg-blue-500' },
  satisfactory: { label: 'Satisfactory', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', dotColor: 'bg-green-500' },
  needs_remediation: { label: 'Needs Remediation', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', dotColor: 'bg-orange-500' },
  failed: { label: 'Failed', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', dotColor: 'bg-red-500' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SkillsPage() {
  const { data: session } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const effectiveRole = useEffectiveRole(userRole);
  const [loading, setLoading] = useState(true);

  // Student-specific state
  const [skillDetails, setSkillDetails] = useState<SkillDetail[]>([]);
  const [summary, setSummary] = useState<{ total: number; satisfactory: number; in_progress: number; needs_remediation: number; not_started: number } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Instructor state
  const [view, setView] = useState<'individual' | 'matrix'>('individual');
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [matrixCategory, setMatrixCategory] = useState<string>('');
  const [matrixNremtOnly, setMatrixNremtOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Add attempt modal
  const [showAttemptModal, setShowAttemptModal] = useState(false);
  const [attemptSkillId, setAttemptSkillId] = useState<string | null>(null);
  const [attemptSkillName, setAttemptSkillName] = useState('');
  const [attemptStudentId, setAttemptStudentId] = useState<string | null>(null);
  const [attemptResult, setAttemptResult] = useState<'pass' | 'fail'>('pass');
  const [attemptNotes, setAttemptNotes] = useState('');
  const [attemptDate, setAttemptDate] = useState(new Date().toISOString().split('T')[0]);
  const [attemptSaving, setAttemptSaving] = useState(false);

  // Observer state
  const [cohortSummary, setCohortSummary] = useState<Record<string, unknown> | null>(null);

  // Student summaries for instructor
  const [studentSummaries, setStudentSummaries] = useState<StudentSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const isInstructor = canEditLVFR(effectiveRole || '');
  const isStudent = effectiveRole === 'student';
  const isObserver = effectiveRole === 'agency_observer';
  const isLiaison = effectiveRole === 'agency_liaison';
  const isAgency = checkAgencyRole(effectiveRole || '');

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then(r => r.json())
      .then(d => { if (d.success) setUserRole(d.user.role); })
      .catch(() => {});
  }, [session?.user?.email]);

  // Fetch data based on role
  useEffect(() => {
    if (effectiveRole === null) return;

    if (isStudent) {
      loadStudentSkills();
    } else if (isObserver) {
      loadObserverSummary();
    } else if (isInstructor || isLiaison) {
      loadStudentList();
      loadSummaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRole]);

  const loadStudentSkills = async () => {
    setLoading(true);
    try {
      // Get own student ID first
      const meRes = await fetch('/api/lvfr-aemt/skills');
      const meData = await meRes.json();
      if (!meRes.ok) { setLoading(false); return; }

      // Fetch detailed view
      const res = await fetch('/api/instructor/me');
      const userData = await res.json();
      const email = userData.success ? userData.user.email : session?.user?.email;

      // Get student record to find ID
      const skillsRes = await fetch('/api/lvfr-aemt/skills');
      const skillsData = await skillsRes.json();

      // Use the skills list + statuses
      const statusMap = new Map<string, SkillStatus>();
      for (const s of skillsData.statuses || []) {
        statusMap.set(s.skill_id, s);
      }

      const details: SkillDetail[] = (skillsData.skills || []).map((skill: Skill) => ({
        ...skill,
        status: statusMap.get(skill.id) || { status: 'not_started', total_attempts: 0, last_attempt_date: null, completed_date: null },
        attempts: [],
      }));

      setSkillDetails(details);
      const total = details.length;
      const satisfactory = details.filter(d => d.status.status === 'satisfactory').length;
      const inProgress = details.filter(d => d.status.status === 'in_progress').length;
      const needsRemediation = details.filter(d => d.status.status === 'needs_remediation').length;
      setSummary({ total, satisfactory, in_progress: inProgress, needs_remediation: needsRemediation, not_started: total - satisfactory - inProgress - needsRemediation });

      // Expand all categories by default
      const cats = new Set<string>(details.map(d => d.category));
      setExpandedCategories(cats);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadObserverSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lvfr-aemt/skills/summary');
      const data = await res.json();
      setCohortSummary(data.cohort_summary || null);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadStudentList = async () => {
    try {
      const res = await fetch('/api/lvfr-aemt/skills/matrix?nremt_only=false');
      const data = await res.json();
      setStudents(data.students || []);
    } catch { /* ignore */ }
  };

  const loadSummaries = async () => {
    try {
      const res = await fetch('/api/lvfr-aemt/skills/summary');
      const data = await res.json();
      setStudentSummaries(data.students || []);
      setCategories(data.categories || []);
    } catch { /* ignore */ }
  };

  const loadStudentDetail = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lvfr-aemt/skills/${studentId}`);
      const data = await res.json();
      setSkillDetails(data.skills || []);
      setSummary(data.summary || null);
      const cats = new Set<string>((data.skills || []).map((s: SkillDetail) => s.category));
      setExpandedCategories(cats);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (matrixCategory) params.set('category', matrixCategory);
      if (matrixNremtOnly) params.set('nremt_only', 'true');
      const res = await fetch(`/api/lvfr-aemt/skills/matrix?${params}`);
      const data = await res.json();
      setMatrixData(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [matrixCategory, matrixNremtOnly]);

  useEffect(() => {
    if (selectedStudentId && view === 'individual') {
      loadStudentDetail(selectedStudentId);
    }
  }, [selectedStudentId, view, loadStudentDetail]);

  useEffect(() => {
    if (view === 'matrix' && (isInstructor || isLiaison)) {
      loadMatrix();
    }
  }, [view, isInstructor, isLiaison, loadMatrix]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Log attempt handler
  const openAttemptModal = (skillId: string, skillName: string, studentId?: string) => {
    setAttemptSkillId(skillId);
    setAttemptSkillName(skillName);
    setAttemptStudentId(studentId || selectedStudentId);
    setAttemptResult('pass');
    setAttemptNotes('');
    setAttemptDate(new Date().toISOString().split('T')[0]);
    setShowAttemptModal(true);
  };

  const handleLogAttempt = async () => {
    if (!attemptSkillId || !attemptStudentId) return;
    setAttemptSaving(true);
    try {
      const res = await fetch('/api/lvfr-aemt/skills/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: attemptStudentId,
          skill_id: attemptSkillId,
          result: attemptResult,
          notes: attemptNotes || null,
          date: attemptDate,
        }),
      });
      if (res.ok) {
        setShowAttemptModal(false);
        // Reload data
        if (view === 'individual' && selectedStudentId) {
          loadStudentDetail(selectedStudentId);
        } else if (view === 'matrix') {
          loadMatrix();
        }
        loadSummaries();
      }
    } catch { /* ignore */ }
    setAttemptSaving(false);
  };

  // Group skills by category
  const groupedSkills = skillDetails.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, SkillDetail[]>);

  if (!session) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-red-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs className="mb-3 [&_*]:!text-red-200 [&_a:hover]:!text-white" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg"><ClipboardCheck className="w-6 h-6" /></div>
              <div>
                <h1 className="text-2xl font-bold">
                  {isStudent ? 'My Skills Progress' : isObserver ? 'Skills Overview' : 'Skills Tracking'}
                </h1>
                <p className="text-red-200 text-sm mt-0.5">Psychomotor skill competencies</p>
              </div>
            </div>
            {isInstructor && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView('individual')}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === 'individual' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                >
                  <User className="w-4 h-4 inline mr-1" />Individual
                </button>
                <button
                  onClick={() => setView('matrix')}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === 'matrix' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                >
                  <Grid3X3 className="w-4 h-4 inline mr-1" />Matrix
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Observer: Cohort Summary */}
        {isObserver && cohortSummary && (
          <ObserverSummaryView data={cohortSummary} />
        )}

        {/* Instructor: Student selector for individual view */}
        {(isInstructor || isLiaison) && view === 'individual' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Select Student:</label>
              <select
                value={selectedStudentId || ''}
                onChange={e => setSelectedStudentId(e.target.value || null)}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              >
                <option value="">— Choose a student —</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Instructor: Matrix View */}
        {(isInstructor || isLiaison) && view === 'matrix' && (
          <MatrixView
            data={matrixData}
            loading={loading}
            category={matrixCategory}
            setCategory={setMatrixCategory}
            nremtOnly={matrixNremtOnly}
            setNremtOnly={setMatrixNremtOnly}
            onCellClick={isInstructor ? (studentId, skillId, skillName) => {
              setAttemptStudentId(studentId);
              openAttemptModal(skillId, skillName, studentId);
            } : undefined}
          />
        )}

        {/* Student / Individual View: Summary + Skill cards */}
        {(isStudent || ((isInstructor || isLiaison) && view === 'individual' && selectedStudentId)) && !loading && summary && (
          <>
            {/* Progress bar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Overall Progress</h3>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {summary.satisfactory} of {summary.total} satisfactory
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-green-500 transition-all"
                  style={{ width: `${summary.total > 0 ? Math.round((summary.satisfactory / summary.total) * 100) : 0}%` }}
                />
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-green-600">{summary.satisfactory} Satisfactory</span>
                <span className="text-blue-600">{summary.in_progress} In Progress</span>
                <span className="text-orange-600">{summary.needs_remediation} Needs Remediation</span>
                <span className="text-gray-500">{summary.not_started} Not Started</span>
              </div>
            </div>

            {/* Skills by category */}
            {Object.entries(groupedSkills).map(([cat, catSkills]) => (
              <div key={cat} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedCategories.has(cat) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cat}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({catSkills.filter(s => s.status.status === 'satisfactory').length}/{catSkills.length})
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {catSkills.map(s => (
                      <div key={s.id} className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s.status.status]?.dotColor || 'bg-gray-400'}`} />
                    ))}
                  </div>
                </button>
                {expandedCategories.has(cat) && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {catSkills.map(skill => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        expanded={expandedSkill === skill.id}
                        onToggle={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}
                        onLogAttempt={isInstructor ? () => openAttemptModal(skill.id, skill.name) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Instructor summaries table when no student selected */}
        {(isInstructor || isLiaison) && view === 'individual' && !selectedStudentId && !loading && studentSummaries.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Student Skills Summary</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Student</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Progress</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-green-600">Satisfactory</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-blue-600">In Progress</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-orange-600">Remediation</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Not Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {studentSummaries
                    .filter(s => !searchTerm || `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(s => (
                      <tr
                        key={s.student_id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => { setSelectedStudentId(s.student_id); }}
                      >
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                          {s.last_name}, {s.first_name}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div className="h-2 rounded-full bg-green-500" style={{ width: `${s.completion_pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{s.completion_pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center text-green-600 font-medium">{s.satisfactory}</td>
                        <td className="px-4 py-2 text-center text-blue-600">{s.in_progress}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={s.needs_remediation > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>{s.needs_remediation}</span>
                        </td>
                        <td className="px-4 py-2 text-center text-gray-400">{s.not_started}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (isStudent || ((isInstructor || isLiaison) && selectedStudentId)) && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Log Attempt Modal */}
      {showAttemptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Log Attempt</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{attemptSkillName}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={attemptDate}
                  onChange={e => setAttemptDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Result</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={attemptResult === 'pass'} onChange={() => setAttemptResult('pass')} className="text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Pass</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={attemptResult === 'fail'} onChange={() => setAttemptResult('fail')} className="text-red-600" />
                    <span className="text-sm text-red-600 font-medium">Fail</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                <textarea
                  value={attemptNotes}
                  onChange={e => setAttemptNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  placeholder="Observations, feedback..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAttemptModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              <button
                onClick={handleLogAttempt}
                disabled={attemptSaving}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
              >
                {attemptSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Log Attempt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillCard
// ---------------------------------------------------------------------------
function SkillCard({ skill, expanded, onToggle, onLogAttempt }: {
  skill: SkillDetail;
  expanded: boolean;
  onToggle: () => void;
  onLogAttempt?: () => void;
}) {
  const statusCfg = STATUS_CONFIG[skill.status.status] || STATUS_CONFIG.not_started;
  const progress = skill.min_practice_attempts > 0
    ? Math.min(100, Math.round((skill.status.total_attempts / skill.min_practice_attempts) * 100))
    : 0;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <button onClick={onToggle} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusCfg.dotColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{skill.name}</p>
              {skill.nremt_tested && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">NREMT</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {skill.status.total_attempts} of {skill.min_practice_attempts} attempt{skill.min_practice_attempts !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mini progress bar */}
          <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 hidden sm:block">
            <div className={`h-1.5 rounded-full ${statusCfg.dotColor}`} style={{ width: `${progress}%` }} />
          </div>
          {onLogAttempt && (
            <button
              onClick={e => { e.stopPropagation(); onLogAttempt(); }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Log Attempt"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {/* Expanded: attempt history */}
      {expanded && skill.attempts.length > 0 && (
        <div className="mt-3 ml-5 pl-3 border-l-2 border-gray-200 dark:border-gray-600 space-y-2">
          {skill.attempts.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              {a.result === 'pass' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              )}
              <span className="text-gray-500 dark:text-gray-400">{a.date}</span>
              <span className={a.result === 'pass' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {a.result === 'pass' ? 'Pass' : 'Fail'}
              </span>
              {a.evaluator?.[0]?.name && <span className="text-gray-400">by {a.evaluator[0].name}</span>}
              {a.notes && <span className="text-gray-400 truncate max-w-[200px]" title={a.notes}>— {a.notes}</span>}
            </div>
          ))}
        </div>
      )}
      {expanded && skill.attempts.length === 0 && (
        <p className="mt-2 ml-5 text-xs text-gray-400">No attempts recorded yet</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MatrixView
// ---------------------------------------------------------------------------
function MatrixView({ data, loading, category, setCategory, nremtOnly, setNremtOnly, onCellClick }: {
  data: MatrixData | null;
  loading: boolean;
  category: string;
  setCategory: (v: string) => void;
  nremtOnly: boolean;
  setNremtOnly: (v: boolean) => void;
  onCellClick?: (studentId: string, skillId: string, skillName: string) => void;
}) {
  const categories = data ? [...new Set(data.skills.map(s => s.category))] : [];

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }
  if (!data || data.students.length === 0) {
    return <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">No data available</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 flex flex-wrap gap-3 items-center">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-1.5 text-gray-900 dark:text-white"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={nremtOnly} onChange={e => setNremtOnly(e.target.checked)} className="rounded border-gray-300 text-red-600" />
          NREMT Only
        </label>
      </div>

      {/* Matrix table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 min-w-[140px]">Student</th>
                {data.skills.map(s => (
                  <th key={s.id} className="px-1 py-2 text-center font-medium text-gray-500 dark:text-gray-400 min-w-[32px]" title={s.name}>
                    <div className="writing-mode-vertical text-[10px] leading-tight max-h-[80px] overflow-hidden">
                      {s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name}
                    </div>
                    {s.nremt_tested && <div className="text-[8px] text-red-500 font-bold">N</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.students.map(st => (
                <tr key={st.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-1.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {st.last_name}, {st.first_name}
                  </td>
                  {data.skills.map(sk => {
                    const cell = data.matrix[st.id]?.[sk.id];
                    const status = cell?.status || 'not_started';
                    const cfg = STATUS_CONFIG[status];
                    return (
                      <td
                        key={sk.id}
                        className={`px-1 py-1.5 text-center ${onCellClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
                        onClick={() => onCellClick?.(st.id, sk.id, sk.name)}
                        title={`${st.last_name}: ${sk.name} — ${cfg?.label || 'Not Started'}${cell ? ` (${cell.total_attempts} attempts)` : ''}`}
                      >
                        <div className={`w-3 h-3 rounded-full mx-auto ${cfg?.dotColor || 'bg-gray-300'}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${cfg.dotColor}`} />
            {cfg.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObserverSummaryView
// ---------------------------------------------------------------------------
function ObserverSummaryView({ data }: { data: Record<string, unknown> }) {
  const totalStudents = data.total_students as number || 0;
  const totalSkills = data.total_skills as number || 0;
  const avgCompletion = data.avg_completion_pct as number || 0;
  const atRisk = data.at_risk_count as number || 0;
  const categoryBreakdown = data.category_breakdown as Record<string, { total: number; avg_satisfactory_pct: number }> || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-600">Students</p>
          <p className="text-2xl font-bold text-blue-600">{totalStudents}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-purple-600">Total Skills</p>
          <p className="text-2xl font-bold text-purple-600">{totalSkills}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-green-600">Avg Completion</p>
          <p className="text-2xl font-bold text-green-600">{avgCompletion}%</p>
        </div>
        <div className={`${atRisk > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-green-50 dark:bg-green-900/20'} rounded-lg p-3`}>
          <p className={`text-xs font-medium ${atRisk > 0 ? 'text-orange-600' : 'text-green-600'}`}>At Risk</p>
          <p className={`text-2xl font-bold ${atRisk > 0 ? 'text-orange-600' : 'text-green-600'}`}>{atRisk}</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Skills by Category</h3>
        </div>
        <div className="p-4 space-y-3">
          {Object.entries(categoryBreakdown).map(([cat, info]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">{cat}</span>
                <span className="text-xs text-gray-500">{info.avg_satisfactory_pct}% avg satisfactory ({info.total} skills)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div className="h-2 rounded-full bg-green-500" style={{ width: `${info.avg_satisfactory_pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
