'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  Download,
  Upload,
  Eye,
  Save,
  AlertCircle,
  CheckCircle2,
  FileJson,
  GripVertical,
  Star,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RubricCriterion {
  id?: string;
  name: string;
  description: string;
  points: number;
  sort_order: number;
}

interface RubricAssignment {
  id?: string;
  scenario_id: string;
  assigned_at?: string;
}

interface Rubric {
  id: string;
  name: string;
  description: string | null;
  rating_scale: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  criteria: RubricCriterion[];
  assignments: RubricAssignment[];
}

interface Scenario {
  id: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Rating scale config
// ---------------------------------------------------------------------------

const RATING_SCALES: Record<string, { label: string; description: string; levels: string[] }> = {
  numeric_5: {
    label: '1-5 Numeric',
    description: 'Scored 1 through 5 per criterion',
    levels: ['1', '2', '3', '4', '5'],
  },
  pass_fail: {
    label: 'Pass / Fail',
    description: 'Binary pass or fail per criterion',
    levels: ['Fail', 'Pass'],
  },
  four_level: {
    label: 'Excellent / Good / Needs Improvement / Unsatisfactory',
    description: 'Four-level qualitative scale',
    levels: ['Unsatisfactory', 'Needs Improvement', 'Good', 'Excellent'],
  },
};

// ---------------------------------------------------------------------------
// Blank criterion factory
// ---------------------------------------------------------------------------

function blankCriterion(sortOrder: number): RubricCriterion {
  return { name: '', description: '', points: 5, sort_order: sortOrder };
}

// ---------------------------------------------------------------------------
// Preview modal
// ---------------------------------------------------------------------------

function RubricPreview({
  rubric,
  onClose,
}: {
  rubric: { name: string; description: string; rating_scale: string; criteria: RubricCriterion[] };
  onClose: () => void;
}) {
  const scale = RATING_SCALES[rubric.rating_scale] ?? RATING_SCALES.numeric_5;
  const totalPoints = rubric.criteria.reduce((sum, c) => sum + (c.points || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rubric Preview</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Rubric title & meta */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {rubric.name || 'Untitled Rubric'}
            </h3>
            {rubric.description && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{rubric.description}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                {scale.label}
              </span>
              <span>Total points: {totalPoints}</span>
            </div>
          </div>

          {rubric.criteria.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No criteria added yet.</p>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="text-left px-4 py-2.5 text-gray-700 dark:text-gray-300 font-semibold w-1/2">
                      Criterion
                    </th>
                    {scale.levels.map((lvl) => (
                      <th
                        key={lvl}
                        className="text-center px-2 py-2.5 text-gray-700 dark:text-gray-300 font-semibold"
                      >
                        {lvl}
                      </th>
                    ))}
                    <th className="text-center px-2 py-2.5 text-gray-700 dark:text-gray-300 font-semibold">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rubric.criteria.map((criterion, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{criterion.name || '—'}</p>
                        {criterion.description && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {criterion.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                          Max: {criterion.points} pts
                        </p>
                      </td>
                      {scale.levels.map((lvl) => (
                        <td key={lvl} className="text-center px-2 py-3">
                          <div className="w-6 h-6 rounded border-2 border-gray-300 dark:border-gray-600 mx-auto" />
                        </td>
                      ))}
                      <td className="text-center px-2 py-3">
                        <div className="w-12 h-6 rounded border border-gray-300 dark:border-gray-600 mx-auto bg-gray-50 dark:bg-gray-800" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <td
                      colSpan={scale.levels.length + 1}
                      className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      Total Points Possible:
                    </td>
                    <td className="text-center px-2 py-2.5 font-bold text-gray-900 dark:text-white">
                      {totalPoints}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rubric builder / editor modal
// ---------------------------------------------------------------------------

function RubricEditor({
  rubric,
  scenarios,
  onSave,
  onClose,
  saving,
}: {
  rubric: Partial<Rubric> | null;
  scenarios: Scenario[];
  onSave: (data: {
    name: string;
    description: string;
    rating_scale: string;
    criteria: RubricCriterion[];
    scenario_ids: string[];
  }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(rubric?.name ?? '');
  const [description, setDescription] = useState(rubric?.description ?? '');
  const [ratingScale, setRatingScale] = useState(rubric?.rating_scale ?? 'numeric_5');
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    rubric?.criteria && rubric.criteria.length > 0
      ? rubric.criteria.map((c, i) => ({ ...c, sort_order: i }))
      : [blankCriterion(0)]
  );
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>(
    rubric?.assignments?.map((a) => a.scenario_id) ?? []
  );
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Rubric name is required.';
    criteria.forEach((c, i) => {
      if (!c.name.trim()) errs[`criterion_${i}`] = 'Criterion name is required.';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddCriterion = () => {
    setCriteria((prev) => [...prev, blankCriterion(prev.length)]);
  };

  const handleRemoveCriterion = (idx: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, sort_order: i })));
  };

  const handleCriterionChange = (idx: number, field: keyof RubricCriterion, value: string | number) => {
    setCriteria((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    setCriteria((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((c, i) => ({ ...c, sort_order: i }));
    });
  };

  const handleMoveDown = (idx: number) => {
    if (idx === criteria.length - 1) return;
    setCriteria((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((c, i) => ({ ...c, sort_order: i }));
    });
  };

  const handleScenarioToggle = (id: string) => {
    setSelectedScenarioIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!validate()) return;
    await onSave({
      name: name.trim(),
      description: description.trim(),
      rating_scale: ratingScale,
      criteria: criteria.map((c, i) => ({ ...c, sort_order: i })),
      scenario_ids: selectedScenarioIds,
    });
  };

  const scale = RATING_SCALES[ratingScale] ?? RATING_SCALES.numeric_5;

  return (
    <>
      {showPreview && (
        <RubricPreview
          rubric={{ name, description, rating_scale: ratingScale, criteria }}
          onClose={() => setShowPreview(false)}
        />
      )}

      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {rubric?.id ? 'Edit Rubric' : 'New Rubric'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic info */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Rubric Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rubric Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Cardiac Arrest Response Rubric"
                  className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name
                      ? 'border-red-400 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional instructions or context for evaluators..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rating Scale
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Object.entries(RATING_SCALES).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRatingScale(key)}
                      className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-colors ${
                        ratingScale === key
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          ratingScale === key
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {val.label}
                      </span>
                      <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {val.description}
                      </span>
                      <div className="mt-1.5 flex gap-1 flex-wrap">
                        {val.levels.map((lvl) => (
                          <span
                            key={lvl}
                            className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                          >
                            {lvl}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Criteria */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Criteria
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Total: {criteria.reduce((s, c) => s + (c.points || 0), 0)} pts
                </span>
              </div>

              <div className="space-y-2">
                {criteria.map((criterion, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-2">
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0.5 pt-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                          aria-label="Move criterion up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === criteria.length - 1}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                          aria-label="Move criterion down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={criterion.name}
                              onChange={(e) => handleCriterionChange(idx, 'name', e.target.value)}
                              placeholder={`Criterion ${idx + 1} name (e.g., Patient Assessment)`}
                              className={`w-full px-3 py-1.5 rounded-lg border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors[`criterion_${idx}`]
                                  ? 'border-red-400 dark:border-red-600'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            />
                            {errors[`criterion_${idx}`] && (
                              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                                {errors[`criterion_${idx}`]}
                              </p>
                            )}
                          </div>
                          {/* Max points */}
                          <div className="shrink-0">
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={criterion.points}
                                onChange={(e) =>
                                  handleCriterionChange(
                                    idx,
                                    'points',
                                    Math.max(1, parseInt(e.target.value) || 1)
                                  )
                                }
                                className="w-16 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title="Max points"
                                aria-label="Maximum points for this criterion"
                              />
                            </div>
                            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              max pts
                            </p>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={criterion.description}
                          onChange={(e) => handleCriterionChange(idx, 'description', e.target.value)}
                          placeholder="Optional: description or instructions for evaluator"
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveCriterion(idx)}
                        disabled={criteria.length === 1}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 shrink-0"
                        aria-label="Remove criterion"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddCriterion}
                className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Criterion
              </button>
            </section>

            {/* Scenario assignment */}
            {scenarios.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Assign to Scenarios
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select which scenarios this rubric applies to.
                </p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                  {scenarios.map((scenario) => (
                    <label
                      key={scenario.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScenarioIds.includes(scenario.id)}
                        onChange={() => handleScenarioToggle(scenario.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{scenario.title}</span>
                    </label>
                  ))}
                </div>
                {selectedScenarioIds.length > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {selectedScenarioIds.length} scenario{selectedScenarioIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </section>
            )}
          </div>

          {/* Footer actions */}
          <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : rubric?.id ? 'Save Changes' : 'Create Rubric'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RubricsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [fetchingData, setFetchingData] = useState(false);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Partial<Rubric> | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Import
  const importRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Auth / session
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.user) {
            if (!canAccessAdmin(d.user.role)) {
              router.push('/');
              return;
            }
            setCurrentUser(d.user);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [session, router]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchRubrics = useCallback(async () => {
    setFetchingData(true);
    try {
      const res = await fetch('/api/admin/rubrics');
      const data = await res.json();
      if (data.success) {
        setRubrics(data.rubrics ?? []);
      }
    } catch {
      toast.error('Failed to load rubrics.');
    } finally {
      setFetchingData(false);
    }
  }, [toast]);

  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch('/api/scenarios');
      const data = await res.json();
      if (data.scenarios) {
        setScenarios(data.scenarios);
      } else if (Array.isArray(data)) {
        setScenarios(data);
      }
    } catch {
      // Scenarios are optional - don't block if unavailable
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchRubrics();
      fetchScenarios();
    }
  }, [currentUser, fetchRubrics, fetchScenarios]);

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------

  const handleSaveRubric = async (formData: {
    name: string;
    description: string;
    rating_scale: string;
    criteria: RubricCriterion[];
    scenario_ids: string[];
  }) => {
    setSaving(true);
    try {
      const isEdit = !!editingRubric?.id;
      const url = isEdit ? `/api/admin/rubrics/${editingRubric!.id}` : '/api/admin/rubrics';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save rubric.');
        return;
      }

      toast.success(isEdit ? 'Rubric updated.' : 'Rubric created.');
      setEditorOpen(false);
      setEditingRubric(null);
      fetchRubrics();
    } catch {
      toast.error('Network error saving rubric.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRubric = async (id: string, force = false) => {
    try {
      const url = force ? `/api/admin/rubrics/${id}?force=true` : `/api/admin/rubrics/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (res.status === 409) {
        const confirmed = window.confirm(
          `This rubric is assigned to ${data.assignment_count} scenario(s). Delete anyway?`
        );
        if (confirmed) {
          await handleDeleteRubric(id, true);
        }
        return;
      }

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete rubric.');
        return;
      }

      toast.success('Rubric deleted.');
      setDeletingId(null);
      setRubrics((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error('Network error deleting rubric.');
    }
  };

  const handleOpenCreate = () => {
    setEditingRubric(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (rubric: Rubric) => {
    setEditingRubric(rubric);
    setEditorOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Export / Import
  // ---------------------------------------------------------------------------

  const handleExport = (rubric: Rubric) => {
    const exportData = {
      name: rubric.name,
      description: rubric.description,
      rating_scale: rubric.rating_scale,
      criteria: rubric.criteria.map((c) => ({
        name: c.name,
        description: c.description,
        points: c.points,
        sort_order: c.sort_order,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rubric_${rubric.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Rubric exported as JSON.');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.name || !Array.isArray(parsed.criteria)) {
          toast.error('Invalid rubric JSON format. Must include "name" and "criteria" array.');
          return;
        }
        // Open editor with imported data
        setEditingRubric({
          name: parsed.name ?? '',
          description: parsed.description ?? '',
          rating_scale: parsed.rating_scale ?? 'numeric_5',
          criteria: (parsed.criteria ?? []).map((c: any, i: number) => ({
            name: c.name ?? '',
            description: c.description ?? '',
            points: c.points ?? 5,
            sort_order: c.sort_order ?? i,
          })),
          assignments: [],
        });
        setEditorOpen(true);
        toast.info('Rubric imported. Review and save.');
      } catch {
        toast.error('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (importRef.current) importRef.current.value = '';
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getScenarioTitle = (id: string): string => {
    return scenarios.find((s) => s.id === id)?.title ?? id.slice(0, 8) + '...';
  };

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hidden import input */}
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImport}
        aria-label="Import rubric JSON file"
      />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Assessment Rubrics</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Assessment Rubrics</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Build and manage scenario grading rubrics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => importRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Import rubric from JSON file"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <Plus className="w-4 h-4" />
                New Rubric
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Loading / empty */}
        {fetchingData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : rubrics.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
              No rubrics yet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Create your first assessment rubric to start grading scenarios consistently.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Rubric
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rubrics.map((rubric) => {
              const scale = RATING_SCALES[rubric.rating_scale] ?? RATING_SCALES.numeric_5;
              const totalPoints = rubric.criteria.reduce((s, c) => s + (c.points || 0), 0);
              const isDeleting = deletingId === rubric.id;

              return (
                <div
                  key={rubric.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-md transition-shadow"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
                        <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {rubric.name}
                            </h3>
                            {rubric.description && (
                              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                {rubric.description}
                              </p>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleExport(rubric)}
                              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Export as JSON"
                              aria-label="Export rubric as JSON"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(rubric)}
                              className="p-2 rounded-lg text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="Edit rubric"
                              aria-label="Edit rubric"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {isDeleting ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
                                <button
                                  onClick={() => handleDeleteRubric(rubric.id)}
                                  className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(rubric.id)}
                                className="p-2 rounded-lg text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Delete rubric"
                                aria-label="Delete rubric"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Meta badges */}
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {scale.label}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            {rubric.criteria.length} {rubric.criteria.length === 1 ? 'criterion' : 'criteria'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            <Star className="w-3 h-3 text-yellow-500" />
                            {totalPoints} pts total
                          </span>
                          {rubric.assignments.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                              <CheckCircle2 className="w-3 h-3" />
                              {rubric.assignments.length} scenario{rubric.assignments.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Assigned scenarios */}
                        {rubric.assignments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {rubric.assignments.map((a) => (
                              <span
                                key={a.scenario_id}
                                className="px-2 py-0.5 rounded text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800"
                              >
                                {getScenarioTitle(a.scenario_id)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Criteria preview */}
                        {rubric.criteria.length > 0 && (
                          <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                              Criteria
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {rubric.criteria.slice(0, 6).map((c, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs"
                                  title={c.description || c.name}
                                >
                                  {c.name} ({c.points}pt)
                                </span>
                              ))}
                              {rubric.criteria.length > 6 && (
                                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs">
                                  +{rubric.criteria.length - 6} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p className="font-semibold">About Assessment Rubrics</p>
              <p>
                Rubrics define grading criteria for scenario assessments. Assign a rubric to one or
                more scenarios so evaluators follow a consistent scoring framework.
              </p>
              <p>
                Use <strong>Export</strong> to save a rubric as JSON, and <strong>Import</strong> to
                load one from a file or share across cohorts.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Rubric editor modal */}
      {editorOpen && (
        <RubricEditor
          rubric={editingRubric}
          scenarios={scenarios}
          onSave={handleSaveRubric}
          onClose={() => {
            setEditorOpen(false);
            setEditingRubric(null);
          }}
          saving={saving}
        />
      )}
    </div>
  );
}
