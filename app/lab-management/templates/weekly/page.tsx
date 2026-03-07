'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Copy,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  Layers,
  Play,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

interface TemplateStation {
  station_number: number;
  station_type: string;
  scenario_id?: string | null;
  skill_name?: string | null;
  custom_title?: string | null;
  rotation_minutes?: number;
  num_rotations?: number;
  room?: string | null;
  notes?: string | null;
}

interface TemplateDay {
  day_number: number;
  title: string;
  start_time?: string;
  end_time?: string;
  stations: TemplateStation[];
}

interface Program {
  id: string;
  name: string;
  abbreviation: string;
}

interface WeeklyTemplate {
  id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  semester: string | null;
  week_number: number | null;
  num_days: number;
  days: TemplateDay[];
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  program?: Program | null;
}

interface Cohort {
  id: string;
  cohort_number: string;
  program?: Program | null;
  is_active: boolean;
}

interface Scenario {
  id: string;
  title: string;
  category: string;
  difficulty: string;
}

const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario' },
  { value: 'skill', label: 'Skill' },
  { value: 'skill_drill', label: 'Skill Drill' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'lecture', label: 'Lecture' },
  { value: 'testing', label: 'Testing' },
  { value: 'other', label: 'Other' },
];

const STATION_TYPE_COLORS: Record<string, string> = {
  scenario: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  skill: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  skill_drill: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  documentation: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  lecture: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  testing: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function emptyStation(stationNumber: number): TemplateStation {
  return {
    station_number: stationNumber,
    station_type: 'scenario',
    scenario_id: null,
    skill_name: null,
    custom_title: null,
    rotation_minutes: 20,
    num_rotations: 4,
    room: null,
    notes: null,
  };
}

function emptyDay(dayNumber: number): TemplateDay {
  return {
    day_number: dayNumber,
    title: `${DAY_LABELS[(dayNumber - 1) % 7] || `Day ${dayNumber}`} Lab`,
    stations: [emptyStation(1)],
  };
}

// ── Component ───────────────────────────────────────────────────────────

export default function WeeklyTemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Data
  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  // Toast
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Create/Edit modal
  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formProgramId, setFormProgramId] = useState('');
  const [formSemester, setFormSemester] = useState('');
  const [formWeekNumber, setFormWeekNumber] = useState('');
  const [formDays, setFormDays] = useState<TemplateDay[]>([emptyDay(1)]);
  const [formDefault, setFormDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number>(0);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Generate modal
  const [generateTemplateId, setGenerateTemplateId] = useState<string | null>(null);
  const [genCohortId, setGenCohortId] = useState('');
  const [genStartDate, setGenStartDate] = useState('');
  const [genSemester, setGenSemester] = useState('');
  const [genWeekNumber, setGenWeekNumber] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tmplRes, progRes, cohortRes, scenRes] = await Promise.all([
        fetch('/api/lab-management/weekly-templates'),
        fetch('/api/lab-management/programs'),
        fetch('/api/lab-management/cohorts'),
        fetch('/api/lab-management/scenarios?limit=100'),
      ]);
      const [tmplData, progData, cohortData, scenData] = await Promise.all([
        tmplRes.json(),
        progRes.json(),
        cohortRes.json(),
        scenRes.json(),
      ]);
      if (tmplData.success) setTemplates(tmplData.templates || []);
      if (progData.success) setPrograms(progData.programs || []);
      if (cohortData.success) setCohorts(cohortData.cohorts || []);
      if (scenData.success) setScenarios(scenData.scenarios || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchAll();
  }, [session, fetchAll]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(message);
    setTimeout(() => setToast(''), 4000);
  };

  // ── Editor helpers ──

  const openCreate = () => {
    setEditId(null);
    setFormName('');
    setFormDescription('');
    setFormProgramId('');
    setFormSemester('');
    setFormWeekNumber('');
    setFormDays([emptyDay(1)]);
    setFormDefault(false);
    setExpandedDay(0);
    setShowEditor(true);
  };

  const openEdit = (t: WeeklyTemplate) => {
    setEditId(t.id);
    setFormName(t.name);
    setFormDescription(t.description || '');
    setFormProgramId(t.program_id || '');
    setFormSemester(t.semester || '');
    setFormWeekNumber(t.week_number != null ? String(t.week_number) : '');
    setFormDays(t.days && t.days.length > 0 ? t.days : [emptyDay(1)]);
    setFormDefault(t.is_default);
    setExpandedDay(0);
    setShowEditor(true);
  };

  const handleDuplicate = (t: WeeklyTemplate) => {
    setEditId(null);
    setFormName(`${t.name} (Copy)`);
    setFormDescription(t.description || '');
    setFormProgramId(t.program_id || '');
    setFormSemester(t.semester || '');
    setFormWeekNumber(t.week_number != null ? String(t.week_number) : '');
    setFormDays(t.days && t.days.length > 0 ? JSON.parse(JSON.stringify(t.days)) : [emptyDay(1)]);
    setFormDefault(false);
    setExpandedDay(0);
    setShowEditor(true);
  };

  const addDay = () => {
    const next = formDays.length + 1;
    setFormDays([...formDays, emptyDay(next)]);
    setExpandedDay(formDays.length); // expand new day
  };

  const removeDay = (idx: number) => {
    if (formDays.length <= 1) return;
    const updated = formDays.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day_number: i + 1 }));
    setFormDays(updated);
    if (expandedDay >= updated.length) setExpandedDay(updated.length - 1);
  };

  const updateDay = (idx: number, field: keyof TemplateDay, value: unknown) => {
    setFormDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addStation = (dayIdx: number) => {
    setFormDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const nextNum = d.stations.length + 1;
      return { ...d, stations: [...d.stations, emptyStation(nextNum)] };
    }));
  };

  const removeStation = (dayIdx: number, stIdx: number) => {
    setFormDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      if (d.stations.length <= 1) return d;
      const updated = d.stations.filter((_, si) => si !== stIdx).map((s, si) => ({ ...s, station_number: si + 1 }));
      return { ...d, stations: updated };
    }));
  };

  const updateStation = (dayIdx: number, stIdx: number, field: keyof TemplateStation, value: unknown) => {
    setFormDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return {
        ...d,
        stations: d.stations.map((s, si) => si === stIdx ? { ...s, [field]: value } : s),
      };
    }));
  };

  // ── Save ──

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        id: editId || undefined,
        name: formName.trim(),
        description: formDescription.trim() || null,
        program_id: formProgramId || null,
        semester: formSemester || null,
        week_number: formWeekNumber ? parseInt(formWeekNumber, 10) : null,
        num_days: formDays.length,
        days: formDays,
        is_default: formDefault,
      };

      const res = await fetch('/api/lab-management/weekly-templates', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success && !data.template) throw new Error(data.error || 'Save failed');

      if (editId) {
        setTemplates(prev => prev.map(t => t.id === editId ? data.template : t));
        showToast('Template updated');
      } else {
        setTemplates(prev => [data.template, ...prev]);
        showToast('Template created');
      }
      setShowEditor(false);
    } catch (err) {
      console.error('Error saving template:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lab-management/weekly-templates?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setTemplates(prev => prev.filter(t => t.id !== deleteId));
      showToast('Template deleted');
      setDeleteId(null);
    } catch (err) {
      console.error('Error deleting:', err);
      showToast('Failed to delete template', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Generate ──

  const openGenerate = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    setGenerateTemplateId(templateId);
    setGenCohortId('');
    setGenStartDate('');
    setGenSemester(tmpl?.semester || '');
    setGenWeekNumber(tmpl?.week_number != null ? String(tmpl.week_number) : '');
  };

  const handleGenerate = async () => {
    if (!generateTemplateId || !genCohortId || !genStartDate) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/lab-management/weekly-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: generateTemplateId,
          cohort_id: genCohortId,
          start_date: genStartDate,
          semester: genSemester || undefined,
          week_number: genWeekNumber ? parseInt(genWeekNumber, 10) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(data.message || 'Lab days generated!');
      setGenerateTemplateId(null);
    } catch (err) {
      console.error('Error generating:', err);
      showToast(err instanceof Error ? err.message : 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // ── Render helpers ──

  const totalStations = (days: TemplateDay[]) =>
    days.reduce((acc, d) => acc + (d.stations?.length || 0), 0);

  const scenarioName = (id: string | null | undefined) => {
    if (!id) return null;
    return scenarios.find(s => s.id === id)?.title || id.slice(0, 8);
  };

  // ── Loading / Auth ──

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
      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/templates" className="hover:text-blue-600 dark:hover:text-blue-400">Templates</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Weekly Templates</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                Weekly Lab Templates
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Define a full week of labs, then generate all lab days at once
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Weekly Template
            </button>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{templates.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Templates</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {templates.filter(t => t.is_default).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Default Templates</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {new Set(templates.map(t => t.program_id).filter(Boolean)).size}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Programs Covered</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {templates.reduce((a, t) => a + (t.days?.length || 0), 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Days Defined</div>
          </div>
        </div>

        {/* Templates list */}
        {templates.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No weekly templates yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
              Create your first weekly template to define a reusable week of lab configurations, then generate all lab days at once for any cohort.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Weekly Template
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map(t => (
              <div
                key={t.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{t.name}</h3>
                        {t.is_default && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">Default</span>
                        )}
                        {t.program && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
                            {t.program.abbreviation || t.program.name}
                          </span>
                        )}
                        {t.semester && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                            Semester {t.semester}
                          </span>
                        )}
                        {t.week_number != null && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full font-medium">
                            Week {t.week_number}
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{t.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Day summary chips */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(t.days || []).map(d => (
                      <div
                        key={d.day_number}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600 text-xs"
                      >
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          Day {d.day_number}
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {d.stations?.length || 0} station{(d.stations?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t.days?.length || 0} day{(t.days?.length || 0) !== 1 ? 's' : ''}, {totalStations(t.days || [])} total station{totalStations(t.days || []) !== 1 ? 's' : ''}</span>
                    </div>
                    <span>
                      Updated {new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t dark:border-gray-700 flex flex-wrap items-center gap-2 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg">
                  <button
                    onClick={() => openGenerate(t.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Generate Labs
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate
                  </button>
                  <button
                    onClick={() => setDeleteId(t.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
          toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastType === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Delete Weekly Template?</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete &ldquo;{templates.find(t => t.id === deleteId)?.name}&rdquo;.
              Lab days previously generated from this template will not be affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} disabled={deleting} className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm">
                {deleting ? 'Deleting...' : <><Trash2 className="w-4 h-4" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Modal ── */}
      {generateTemplateId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Generate Lab Days</h3>
              </div>
              <button onClick={() => setGenerateTemplateId(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" aria-label="Close dialog">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Using template: <strong className="text-gray-900 dark:text-white">{templates.find(t => t.id === generateTemplateId)?.name}</strong>
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cohort <span className="text-red-500">*</span></label>
                <select
                  value={genCohortId}
                  onChange={e => setGenCohortId(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select cohort...</option>
                  {cohorts.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.program?.abbreviation ? `${c.program.abbreviation} ` : ''}{c.cohort_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date (Monday of the week) <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={genStartDate}
                  onChange={e => setGenStartDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                  <input
                    type="text"
                    value={genSemester}
                    onChange={e => setGenSemester(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Week Number</label>
                  <input
                    type="number"
                    value={genWeekNumber}
                    onChange={e => setGenWeekNumber(e.target.value)}
                    min={1}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This will create {templates.find(t => t.id === generateTemplateId)?.days?.length || 0} lab day(s) with all stations pre-configured. Each day will be dated sequentially starting from the start date.
                </p>
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setGenerateTemplateId(null)} className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!genCohortId || !genStartDate || generating}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Generate Lab Days
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full my-8">
            {/* Editor header */}
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 rounded-t-lg z-10">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {editId ? 'Edit' : 'Create'} Weekly Template
                </h3>
              </div>
              <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" aria-label="Close editor">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Sem 3 Week 5 - Cardiac Scenarios"
                    maxLength={150}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    autoFocus
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Optional notes about this week template"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program</label>
                  <select
                    value={formProgramId}
                    onChange={e => setFormProgramId(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">All programs</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.abbreviation ? `${p.abbreviation} - ` : ''}{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                    <input
                      type="text"
                      value={formSemester}
                      onChange={e => setFormSemester(e.target.value)}
                      placeholder="e.g. 3"
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Week #</label>
                    <input
                      type="number"
                      value={formWeekNumber}
                      onChange={e => setFormWeekNumber(e.target.value)}
                      min={1}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formDefault}
                  onChange={e => setFormDefault(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mark as default</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Auto-suggested when generating labs for matching semester/week</p>
                </div>
              </label>

              {/* Days section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Days ({formDays.length})</h4>
                  <button
                    onClick={addDay}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Day
                  </button>
                </div>

                <div className="space-y-2">
                  {formDays.map((day, dayIdx) => (
                    <div key={dayIdx} className="border dark:border-gray-600 rounded-lg overflow-hidden">
                      {/* Day header - accordion toggle */}
                      <button
                        onClick={() => setExpandedDay(expandedDay === dayIdx ? -1 : dayIdx)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                          Day {day.day_number}: {day.title || 'Untitled'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                          {day.stations?.length || 0} station{(day.stations?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        {formDays.length > 1 && (
                          <button
                            onClick={e => { e.stopPropagation(); removeDay(dayIdx); }}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Remove day"
                            aria-label="Remove day"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {expandedDay === dayIdx ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>

                      {/* Day content */}
                      {expandedDay === dayIdx && (
                        <div className="p-3 space-y-3 bg-white dark:bg-gray-800">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Day Title</label>
                              <input
                                type="text"
                                value={day.title}
                                onChange={e => updateDay(dayIdx, 'title', e.target.value)}
                                placeholder="e.g. Monday Lab"
                                className="w-full px-2.5 py-1.5 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Time</label>
                              <input
                                type="time"
                                value={day.start_time || ''}
                                onChange={e => updateDay(dayIdx, 'start_time', e.target.value || undefined)}
                                className="w-full px-2.5 py-1.5 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Time</label>
                              <input
                                type="time"
                                value={day.end_time || ''}
                                onChange={e => updateDay(dayIdx, 'end_time', e.target.value || undefined)}
                                className="w-full px-2.5 py-1.5 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                              />
                            </div>
                          </div>

                          {/* Stations */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Stations</span>
                              <button
                                onClick={() => addStation(dayIdx)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Add Station
                              </button>
                            </div>

                            <div className="space-y-2">
                              {day.stations.map((st, stIdx) => (
                                <div key={stIdx} className="border dark:border-gray-600 rounded p-2.5 bg-gray-50 dark:bg-gray-700/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Station {st.station_number}</span>
                                    {day.stations.length > 1 && (
                                      <button
                                        onClick={() => removeStation(dayIdx, stIdx)}
                                        className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                        aria-label="Remove station"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Type</label>
                                      <select
                                        value={st.station_type}
                                        onChange={e => updateStation(dayIdx, stIdx, 'station_type', e.target.value)}
                                        className="w-full px-2 py-1.5 border dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                      >
                                        {STATION_TYPES.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                    {st.station_type === 'scenario' ? (
                                      <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Scenario</label>
                                        <select
                                          value={st.scenario_id || ''}
                                          onChange={e => updateStation(dayIdx, stIdx, 'scenario_id', e.target.value || null)}
                                          className="w-full px-2 py-1.5 border dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                        >
                                          <option value="">None (TBD)</option>
                                          {scenarios.map(s => (
                                            <option key={s.id} value={s.id}>{s.title}</option>
                                          ))}
                                        </select>
                                      </div>
                                    ) : (
                                      <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                                          {st.station_type === 'skill' || st.station_type === 'skill_drill' ? 'Skill Name' : 'Custom Title'}
                                        </label>
                                        <input
                                          type="text"
                                          value={(st.station_type === 'skill' || st.station_type === 'skill_drill') ? (st.skill_name || '') : (st.custom_title || '')}
                                          onChange={e => {
                                            if (st.station_type === 'skill' || st.station_type === 'skill_drill') {
                                              updateStation(dayIdx, stIdx, 'skill_name', e.target.value || null);
                                            } else {
                                              updateStation(dayIdx, stIdx, 'custom_title', e.target.value || null);
                                            }
                                          }}
                                          placeholder="Optional"
                                          className="w-full px-2 py-1.5 border dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Rotation (min)</label>
                                      <input
                                        type="number"
                                        value={st.rotation_minutes || 20}
                                        onChange={e => updateStation(dayIdx, stIdx, 'rotation_minutes', parseInt(e.target.value, 10) || 20)}
                                        min={5}
                                        max={120}
                                        className="w-full px-2 py-1.5 border dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Room</label>
                                      <input
                                        type="text"
                                        value={st.room || ''}
                                        onChange={e => updateStation(dayIdx, stIdx, 'room', e.target.value || null)}
                                        placeholder="e.g. Lab A"
                                        className="w-full px-2 py-1.5 border dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Editor footer */}
            <div className="p-4 border-t dark:border-gray-700 flex gap-3 justify-end sticky bottom-0 bg-white dark:bg-gray-800 rounded-b-lg">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || formDays.length === 0 || saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editId ? 'Update Template' : 'Create Template'}
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
