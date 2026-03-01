'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Filter,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  BarChart3,
  ChevronDown,
  Info,
} from 'lucide-react';
import LabHeader from '@/components/LabHeader';
import { hasMinRole } from '@/lib/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

type CompetencyLevel = 'introduced' | 'practiced' | 'competent' | 'proficient';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { name: string; abbreviation: string } | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
}

interface CompetencyRecord {
  student_id: string;
  skill_id: string;
  level: CompetencyLevel;
  demonstrations: number;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<CompetencyLevel, { label: string; short: string; bg: string; text: string; border: string; darkBg: string; darkText: string }> = {
  introduced: {
    label: 'Introduced',
    short: 'I',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    darkBg: 'dark:bg-gray-700',
    darkText: 'dark:text-gray-300',
  },
  practiced: {
    label: 'Practiced',
    short: 'P',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    darkBg: 'dark:bg-blue-900/40',
    darkText: 'dark:text-blue-300',
  },
  competent: {
    label: 'Competent',
    short: 'C',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    darkBg: 'dark:bg-amber-900/40',
    darkText: 'dark:text-amber-300',
  },
  proficient: {
    label: 'Proficient',
    short: 'Pr',
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    darkBg: 'dark:bg-green-900/40',
    darkText: 'dark:text-green-300',
  },
};

const LEVEL_ORDER: CompetencyLevel[] = ['introduced', 'practiced', 'competent', 'proficient'];

function nextLevel(current: CompetencyLevel | null): CompetencyLevel {
  if (!current) return 'introduced';
  const idx = LEVEL_ORDER.indexOf(current);
  return LEVEL_ORDER[(idx + 1) % LEVEL_ORDER.length];
}

// ─── Competency Cell ──────────────────────────────────────────────────────────

function CompetencyCell({
  level,
  saving,
  onClick,
}: {
  level: CompetencyLevel | null;
  saving: boolean;
  onClick: () => void;
}) {
  if (saving) {
    return (
      <div className="w-full h-full min-h-[2.25rem] flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!level) {
    return (
      <button
        onClick={onClick}
        title="Click to set competency level"
        className="w-full h-full min-h-[2.25rem] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded"
        aria-label="No competency set - click to add"
      >
        <span className="text-xs">—</span>
      </button>
    );
  }

  const cfg = LEVEL_CONFIG[level];
  return (
    <button
      onClick={onClick}
      title={`${cfg.label} - click to advance`}
      aria-label={`${cfg.label} - click to change level`}
      className={`w-full h-full min-h-[2.25rem] flex items-center justify-center rounded border font-semibold text-xs transition-all hover:opacity-80 active:scale-95 ${cfg.bg} ${cfg.text} ${cfg.border} ${cfg.darkBg} ${cfg.darkText}`}
    >
      {cfg.short}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SkillCompetenciesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [compMap, setCompMap] = useState<Record<string, Record<string, CompetencyRecord>>>({});

  const [loading, setLoading] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null); // "studentId:skillId"

  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Edit modal
  const [editModal, setEditModal] = useState<{
    student: Student;
    skill: Skill;
    current: CompetencyRecord | null;
  } | null>(null);
  const [editLevel, setEditLevel] = useState<CompetencyLevel>('introduced');
  const [editDemos, setEditDemos] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [showLegend, setShowLegend] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Auth
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  const userRole = (session?.user as { role?: string })?.role || 'guest';
  const canEdit = hasMinRole(userRole, 'instructor');

  // Load cohorts
  useEffect(() => {
    if (!session) return;
    fetch('/api/lab-management/cohorts')
      .then(r => r.json())
      .then(d => {
        if (d.success) setCohorts(d.cohorts || []);
      })
      .catch(console.error);
  }, [session]);

  // Load skills when category changes (independent of cohort)
  useEffect(() => {
    if (!session) return;
    let url = '/api/lab-management/skills';
    if (selectedCategory) url += `?category=${encodeURIComponent(selectedCategory)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.success) setSkills(d.skills || []);
      })
      .catch(console.error);
  }, [session, selectedCategory]);

  // Load grid data when cohort changes
  const loadGrid = useCallback(async () => {
    if (!selectedCohort) {
      setStudents([]);
      setCompMap({});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/competencies?cohort_id=${selectedCohort}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStudents(data.students || []);

      // Build compMap: { studentId: { skillId: record } }
      const map: Record<string, Record<string, CompetencyRecord>> = {};
      for (const comp of data.competencies || []) {
        if (!map[comp.student_id]) map[comp.student_id] = {};
        map[comp.student_id][comp.skill_id] = comp;
      }
      setCompMap(map);
    } catch (err) {
      showToast('Failed to load competency data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3500);
  };

  // Quick-click: cycle to next level
  const handleCellClick = async (student: Student, skill: Skill) => {
    if (!canEdit) return;
    const current = compMap[student.id]?.[skill.id] ?? null;
    const newLevel = nextLevel(current?.level ?? null);
    const cellKey = `${student.id}:${skill.id}`;
    setSavingCell(cellKey);
    try {
      const res = await fetch('/api/lab-management/competencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.id,
          skill_id: skill.id,
          level: newLevel,
          demonstrations: current?.demonstrations ?? 0,
          notes: current?.notes ?? null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setCompMap(prev => ({
        ...prev,
        [student.id]: {
          ...(prev[student.id] || {}),
          [skill.id]: data.competency,
        },
      }));
    } catch {
      showToast('Failed to update competency.', 'error');
    } finally {
      setSavingCell(null);
    }
  };

  // Right-click or long-press: open edit modal
  const handleCellContextMenu = (e: React.MouseEvent, student: Student, skill: Skill) => {
    e.preventDefault();
    if (!canEdit) return;
    const current = compMap[student.id]?.[skill.id] ?? null;
    setEditModal({ student, skill, current });
    setEditLevel(current?.level ?? 'introduced');
    setEditDemos(current?.demonstrations ?? 0);
    setEditNotes(current?.notes ?? '');
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      const res = await fetch('/api/lab-management/competencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: editModal.student.id,
          skill_id: editModal.skill.id,
          level: editLevel,
          demonstrations: editDemos,
          notes: editNotes || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setCompMap(prev => ({
        ...prev,
        [editModal.student.id]: {
          ...(prev[editModal.student.id] || {}),
          [editModal.skill.id]: data.competency,
        },
      }));
      setEditModal(null);
      showToast('Competency saved.');
    } catch {
      showToast('Failed to save competency.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  // Get unique categories from loaded skills
  const categories = Array.from(new Set(skills.map(s => s.category))).sort();

  // Filter skills by selected category
  const filteredSkills = selectedCategory
    ? skills.filter(s => s.category === selectedCategory)
    : skills;

  // Export CSV
  const handleExportCSV = () => {
    if (!students.length || !filteredSkills.length) return;
    const headers = ['Student', ...filteredSkills.map(s => s.name)];
    const rows = students.map(student => {
      const cells = filteredSkills.map(skill => {
        const comp = compMap[student.id]?.[skill.id];
        return comp?.level ?? '';
      });
      return [`${student.last_name}, ${student.first_name}`, ...cells];
    });
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competencies-${selectedCohort}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) return null;

  const selectedCohortObj = cohorts.find(c => c.id === selectedCohort);
  const cohortLabel = selectedCohortObj
    ? `${selectedCohortObj.program?.abbreviation ?? ''} Cohort ${selectedCohortObj.cohort_number}`
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <LabHeader
        breadcrumbs={[
          { label: 'Skills', href: '/lab-management/skill-sheets' },
          { label: 'Competency Tracker' },
        ]}
        title="Skill Competency Tracker"
        actions={
          <div className="flex items-center gap-2">
            {selectedCohort && (
              <Link
                href={`/lab-management/skills/competencies/report?cohort_id=${selectedCohort}${selectedCategory ? `&category=${encodeURIComponent(selectedCategory)}` : ''}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Cohort Report
              </Link>
            )}
            {students.length > 0 && filteredSkills.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        }
      />

      <main className="max-w-full px-4 py-6 space-y-4">

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />

            {/* Cohort selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Cohort
              </label>
              <select
                value={selectedCohort}
                onChange={e => setSelectedCohort(e.target.value)}
                className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-w-[180px]"
              >
                <option value="">Select cohort...</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation ?? ''} Cohort {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Skill Category
              </label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-w-[160px]"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory('')}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              >
                <X className="w-3.5 h-3.5" />
                Clear filter
              </button>
            )}

            {/* Legend toggle */}
            <button
              onClick={() => setShowLegend(v => !v)}
              className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <Info className="w-3.5 h-3.5" />
              Legend
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLegend ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Legend */}
          {showLegend && (
            <div className="mt-3 pt-3 border-t dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Competency Levels</p>
              <div className="flex flex-wrap gap-2">
                {LEVEL_ORDER.map(lvl => {
                  const cfg = LEVEL_CONFIG[lvl];
                  return (
                    <div key={lvl} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border} ${cfg.darkBg} ${cfg.darkText}`}>
                      <span className="font-bold">{cfg.short}</span>
                      <span>{cfg.label}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600">
                  <span>—</span>
                  <span>Not tracked</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Left-click a cell to cycle to the next level. Right-click to open the detail editor.
              </p>
            </div>
          )}
        </div>

        {/* Grid */}
        {!selectedCohort ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a Cohort</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Choose a cohort above to view and manage skill competency levels.
            </p>
          </div>
        ) : loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Active Students</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              This cohort has no active students enrolled.
            </p>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Skills Found</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No active skills found{selectedCategory ? ` in category "${selectedCategory}"` : ''}.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {/* Table header info */}
            <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {cohortLabel}
                  {selectedCategory && (
                    <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal">
                      &mdash; {selectedCategory}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {students.length} student{students.length !== 1 ? 's' : ''} &middot;{' '}
                  {filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''}
                  {canEdit && ' &middot; Left-click to cycle level, right-click for details'}
                </p>
              </div>
            </div>

            {/* Scrollable grid */}
            <div className="overflow-x-auto">
              <table className="border-collapse" style={{ minWidth: '100%' }}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    {/* Sticky student name column header */}
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 border-r dark:border-gray-600 whitespace-nowrap min-w-[160px]">
                      Student
                    </th>
                    {filteredSkills.map(skill => (
                      <th
                        key={skill.id}
                        className="px-1 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300 border-r dark:border-gray-600 min-w-[3rem] max-w-[5rem]"
                        title={`${skill.name} (${skill.category})`}
                      >
                        <div
                          className="writing-mode-vertical text-center overflow-hidden text-ellipsis"
                          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '100px', fontSize: '10px' }}
                        >
                          {skill.name}
                        </div>
                      </th>
                    ))}
                    {/* Summary column */}
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[80px]">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {students.map(student => {
                    const studentComps = compMap[student.id] || {};
                    const trackedCount = filteredSkills.filter(s => studentComps[s.id]).length;
                    const competentCount = filteredSkills.filter(s => {
                      const lvl = studentComps[s.id]?.level;
                      return lvl === 'competent' || lvl === 'proficient';
                    }).length;
                    const progressPct = filteredSkills.length > 0
                      ? Math.round((competentCount / filteredSkills.length) * 100)
                      : 0;

                    return (
                      <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                        {/* Sticky name cell */}
                        <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/20 px-3 py-1 border-r dark:border-gray-600 whitespace-nowrap">
                          <Link
                            href={`/lab-management/students/${student.id}`}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {student.last_name}, {student.first_name}
                          </Link>
                        </td>

                        {filteredSkills.map(skill => {
                          const comp = studentComps[skill.id] ?? null;
                          const cellKey = `${student.id}:${skill.id}`;
                          const isSaving = savingCell === cellKey;

                          return (
                            <td
                              key={skill.id}
                              className="p-0.5 border-r dark:border-gray-600"
                              onContextMenu={e => handleCellContextMenu(e, student, skill)}
                            >
                              <CompetencyCell
                                level={comp?.level ?? null}
                                saving={isSaving}
                                onClick={() => handleCellClick(student, skill)}
                              />
                            </td>
                          );
                        })}

                        {/* Progress summary */}
                        <td className="px-2 py-1 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              {competentCount}/{filteredSkills.length}
                            </span>
                            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Edit Competency
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {editModal.student.first_name} {editModal.student.last_name} &mdash; {editModal.skill.name}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Level selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Competency Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LEVEL_ORDER.map(lvl => {
                    const cfg = LEVEL_CONFIG[lvl];
                    const isSelected = editLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => setEditLevel(lvl)}
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          isSelected
                            ? `${cfg.bg} ${cfg.text} ${cfg.border} ${cfg.darkBg} ${cfg.darkText} border-opacity-100`
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Demonstrations count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Successful Demonstrations
                </label>
                <input
                  type="number"
                  min={0}
                  value={editDemos}
                  onChange={e => setEditDemos(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes about this competency assessment..."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm resize-none"
                />
              </div>

              {/* Last updated info */}
              {editModal.current && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Last updated {new Date(editModal.current.updated_at).toLocaleDateString()}
                  {editModal.current.updated_by && ` by ${editModal.current.updated_by}`}
                </p>
              )}
            </div>

            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
              >
                {editSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastType === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast}
        </div>
      )}
    </div>
  );
}
