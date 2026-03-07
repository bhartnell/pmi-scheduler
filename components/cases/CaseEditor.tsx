'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Save,
  Upload,
  Eye,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ArrowLeft,
  X,
  FileUp,
} from 'lucide-react';
import TagInput from '@/components/TagInput';
import {
  CaseStudy,
  CaseFormData,
  CasePhase,
  CaseQuestion,
  QuestionOption,
  PhaseVitals,
  DispatchInfo,
  SceneInfo,
  CASE_CATEGORIES,
  DIFFICULTY_LEVELS,
  PROGRAM_OPTIONS,
  VISIBILITY_OPTIONS,
  QUESTION_TYPES,
} from '@/types/case-studies';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CaseEditorProps {
  /** If provided, we are editing an existing case */
  existingCase?: CaseStudy | null;
  /** "edit" or "new" */
  mode: 'edit' | 'new';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultPhase(): CasePhase {
  return {
    id: generateId('phase'),
    title: '',
    presentation_text: '',
    transition_text: '',
    vitals: {},
    physical_findings: [],
    instructor_cues: [],
    questions: [],
  };
}

function defaultQuestion(): CaseQuestion {
  return {
    id: generateId('q'),
    type: 'multiple_choice',
    text: '',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
    ],
    correct_answer: '',
    explanation: '',
    points: 10,
    time_limit: null,
    hint: '',
  };
}

function caseToFormData(c: CaseStudy): CaseFormData {
  return {
    title: c.title || '',
    description: c.description || '',
    chief_complaint: c.chief_complaint || '',
    category: c.category || '',
    subcategory: c.subcategory || '',
    difficulty: (c.difficulty as CaseFormData['difficulty']) || 'intermediate',
    applicable_programs: c.applicable_programs || ['Paramedic'],
    estimated_duration_minutes: c.estimated_duration_minutes || 30,
    visibility: c.visibility || 'private',

    patient_age: c.patient_age || '',
    patient_sex: c.patient_sex || '',
    patient_weight: c.patient_weight || '',
    patient_medical_history: c.patient_medical_history || [],
    patient_medications: c.patient_medications || [],
    patient_allergies: c.patient_allergies || '',

    dispatch_info: c.dispatch_info || {},
    scene_info: c.scene_info || {},

    phases: Array.isArray(c.phases) && c.phases.length > 0 ? c.phases : [defaultPhase()],

    learning_objectives: c.learning_objectives || [],
    critical_actions: c.critical_actions || [],
    common_errors: c.common_errors || [],
    debrief_points: c.debrief_points || [],
    equipment_needed: c.equipment_needed || [],
  };
}

function emptyFormData(): CaseFormData {
  return {
    title: '',
    description: '',
    chief_complaint: '',
    category: '',
    subcategory: '',
    difficulty: 'intermediate',
    applicable_programs: ['Paramedic'],
    estimated_duration_minutes: 30,
    visibility: 'private',

    patient_age: '',
    patient_sex: '',
    patient_weight: '',
    patient_medical_history: [],
    patient_medications: [],
    patient_allergies: '',

    dispatch_info: {},
    scene_info: {},

    phases: [defaultPhase()],

    learning_objectives: [],
    critical_actions: [],
    common_errors: [],
    debrief_points: [],
    equipment_needed: [],
  };
}

// ---------------------------------------------------------------------------
// Main Editor Component
// ---------------------------------------------------------------------------

export default function CaseEditor({ existingCase, mode }: CaseEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<CaseFormData>(
    existingCase ? caseToFormData(existingCase) : emptyFormData()
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activePhaseTab, setActivePhaseTab] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');

  // Collapsible sections
  const [sections, setSections] = useState({
    metadata: true,
    patient: false,
    dispatch: false,
    phases: true,
    educational: false,
  });

  const toggleSection = useCallback((key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Populate form when existingCase loads (async)
  useEffect(() => {
    if (existingCase) {
      setForm(caseToFormData(existingCase));
    }
  }, [existingCase]);

  // -----------------------------------------------------------------------
  // Form field updaters
  // -----------------------------------------------------------------------

  function updateField<K extends keyof CaseFormData>(key: K, value: CaseFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateDispatch<K extends keyof DispatchInfo>(key: K, value: string) {
    setForm((prev) => ({
      ...prev,
      dispatch_info: { ...prev.dispatch_info, [key]: value },
    }));
  }

  function updateScene<K extends keyof SceneInfo>(key: K, value: string) {
    setForm((prev) => ({
      ...prev,
      scene_info: { ...prev.scene_info, [key]: value },
    }));
  }

  // Phase helpers
  function updatePhase(index: number, partial: Partial<CasePhase>) {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      newPhases[index] = { ...newPhases[index], ...partial };
      return { ...prev, phases: newPhases };
    });
  }

  function updatePhaseVitals(phaseIdx: number, key: keyof PhaseVitals, value: string) {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      newPhases[phaseIdx] = {
        ...newPhases[phaseIdx],
        vitals: { ...newPhases[phaseIdx].vitals, [key]: value },
      };
      return { ...prev, phases: newPhases };
    });
  }

  function addPhase() {
    const newPhase = defaultPhase();
    setForm((prev) => ({ ...prev, phases: [...prev.phases, newPhase] }));
    setActivePhaseTab(form.phases.length);
  }

  function removePhase(index: number) {
    if (form.phases.length <= 1) return;
    if (!confirm('Delete this phase? This cannot be undone.')) return;
    setForm((prev) => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== index),
    }));
    if (activePhaseTab >= form.phases.length - 1) {
      setActivePhaseTab(Math.max(0, form.phases.length - 2));
    }
  }

  // Question helpers
  function updateQuestion(phaseIdx: number, qIdx: number, partial: Partial<CaseQuestion>) {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      const questions = [...(newPhases[phaseIdx].questions || [])];
      questions[qIdx] = { ...questions[qIdx], ...partial };
      newPhases[phaseIdx] = { ...newPhases[phaseIdx], questions };
      return { ...prev, phases: newPhases };
    });
  }

  function addQuestion(phaseIdx: number) {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      const questions = [...(newPhases[phaseIdx].questions || []), defaultQuestion()];
      newPhases[phaseIdx] = { ...newPhases[phaseIdx], questions };
      return { ...prev, phases: newPhases };
    });
  }

  function removeQuestion(phaseIdx: number, qIdx: number) {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      const questions = (newPhases[phaseIdx].questions || []).filter((_, i) => i !== qIdx);
      newPhases[phaseIdx] = { ...newPhases[phaseIdx], questions };
      return { ...prev, phases: newPhases };
    });
  }

  function addOption(phaseIdx: number, qIdx: number) {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      const questions = [...(newPhases[phaseIdx].questions || [])];
      const opts = [...(questions[qIdx].options || [])];
      const nextLetter = String.fromCharCode(97 + opts.length); // a, b, c, ...
      opts.push({ id: nextLetter, text: '' });
      questions[qIdx] = { ...questions[qIdx], options: opts };
      newPhases[phaseIdx] = { ...newPhases[phaseIdx], questions };
      return { ...prev, phases: newPhases };
    });
  }

  function removeOption(phaseIdx: number, qIdx: number, optIdx: number) {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      const questions = [...(newPhases[phaseIdx].questions || [])];
      const opts = (questions[qIdx].options || []).filter((_, i) => i !== optIdx);
      questions[qIdx] = { ...questions[qIdx], options: opts };
      newPhases[phaseIdx] = { ...newPhases[phaseIdx], questions };
      return { ...prev, phases: newPhases };
    });
  }

  function updateOption(phaseIdx: number, qIdx: number, optIdx: number, text: string) {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      const questions = [...(newPhases[phaseIdx].questions || [])];
      const opts = [...(questions[qIdx].options || [])];
      opts[optIdx] = { ...opts[optIdx], text };
      questions[qIdx] = { ...questions[qIdx], options: opts };
      newPhases[phaseIdx] = { ...newPhases[phaseIdx], questions };
      return { ...prev, phases: newPhases };
    });
  }

  function moveQuestion(phaseIdx: number, fromIdx: number, toIdx: number) {
    if (toIdx < 0) return;
    setForm((prev) => {
      const newPhases = [...prev.phases];
      const questions = [...(newPhases[phaseIdx].questions || [])];
      if (toIdx >= questions.length) return prev;
      const [moved] = questions.splice(fromIdx, 1);
      questions.splice(toIdx, 0, moved);
      newPhases[phaseIdx] = { ...newPhases[phaseIdx], questions };
      return { ...prev, phases: newPhases };
    });
  }

  // -----------------------------------------------------------------------
  // Program checkbox toggling
  // -----------------------------------------------------------------------

  function toggleProgram(program: string) {
    setForm((prev) => {
      const progs = prev.applicable_programs.includes(program)
        ? prev.applicable_programs.filter((p) => p !== program)
        : [...prev.applicable_programs, program];
      return { ...prev, applicable_programs: progs };
    });
  }

  // -----------------------------------------------------------------------
  // Import JSON
  // -----------------------------------------------------------------------

  function handleImport() {
    try {
      const parsed = JSON.parse(importJson);
      // Accept either a full case object or just the form data shape
      const imported = caseToFormData(parsed as CaseStudy);
      setForm(imported);
      setShowImportModal(false);
      setImportJson('');
    } catch {
      alert('Invalid JSON. Please check the format and try again.');
    }
  }

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------

  async function handleSave(publish: boolean) {
    if (!form.title.trim()) {
      setSaveError('Title is required');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const payload = {
        ...form,
        is_published: publish,
      };

      let res: Response;
      if (mode === 'edit' && existingCase) {
        res = await fetch(`/api/cases/${existingCase.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save');
        return;
      }

      // Redirect to the case detail page
      router.push(`/cases/${data.case.id}`);
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const phase = form.phases[activePhaseTab];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {mode === 'edit' ? 'Edit Case Study' : 'New Case Study'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <FileUp className="h-4 w-4" />
              Import JSON
            </button>
            {mode === 'edit' && existingCase && (
              <Link
                href={`/cases/${existingCase.id}/practice?preview=true`}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Link>
            )}
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Publish
            </button>
          </div>
        </div>

        {saveError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {saveError}
          </div>
        )}

        {/* ============================================================== */}
        {/* 1. Metadata Section */}
        {/* ============================================================== */}
        <CollapsibleSection
          title="Metadata"
          open={sections.metadata}
          onToggle={() => toggleSection('metadata')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Acute STEMI with Cardiogenic Shock"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the overall scenario..."
              />
            </div>

            {/* Chief complaint */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chief Complaint
              </label>
              <input
                type="text"
                value={form.chief_complaint}
                onChange={(e) => updateField('chief_complaint', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder='e.g., "Chest pain for 2 hours"'
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category...</option>
                {CASE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subcategory
              </label>
              <input
                type="text"
                value={form.subcategory}
                onChange={(e) => updateField('subcategory', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., STEMI, Asthma"
              />
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Difficulty
              </label>
              <select
                value={form.difficulty}
                onChange={(e) => updateField('difficulty', e.target.value as CaseFormData['difficulty'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {DIFFICULTY_LEVELS.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Estimated duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estimated Duration (minutes)
              </label>
              <input
                type="number"
                min={1}
                value={form.estimated_duration_minutes}
                onChange={(e) => updateField('estimated_duration_minutes', parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Programs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Applicable Programs
              </label>
              <div className="flex flex-wrap gap-3 mt-1">
                {PROGRAM_OPTIONS.map((prog) => (
                  <label key={prog} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.applicable_programs.includes(prog)}
                      onChange={() => toggleProgram(prog)}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{prog}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Visibility
              </label>
              <select
                value={form.visibility}
                onChange={(e) => updateField('visibility', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {VISIBILITY_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CollapsibleSection>

        {/* ============================================================== */}
        {/* 2. Patient Info */}
        {/* ============================================================== */}
        <CollapsibleSection
          title="Patient Information"
          open={sections.patient}
          onToggle={() => toggleSection('patient')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age</label>
              <input
                type="text"
                value={form.patient_age}
                onChange={(e) => updateField('patient_age', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 62"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sex</label>
              <select
                value={form.patient_sex}
                onChange={(e) => updateField('patient_sex', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight</label>
              <input
                type="text"
                value={form.patient_weight}
                onChange={(e) => updateField('patient_weight', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 80 kg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-4">
            <TagInput
              label="Medical History"
              value={form.patient_medical_history}
              onChange={(val) => updateField('patient_medical_history', val)}
              placeholder="e.g., Hypertension, Diabetes..."
            />
            <TagInput
              label="Medications"
              value={form.patient_medications}
              onChange={(val) => updateField('patient_medications', val)}
              placeholder="e.g., Metoprolol, Lisinopril..."
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Allergies
              </label>
              <input
                type="text"
                value={form.patient_allergies}
                onChange={(e) => updateField('patient_allergies', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., NKDA, Penicillin"
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* ============================================================== */}
        {/* 3. Dispatch & Scene */}
        {/* ============================================================== */}
        <CollapsibleSection
          title="Dispatch & Scene Information"
          open={sections.dispatch}
          onToggle={() => toggleSection('dispatch')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Call Type
              </label>
              <input
                type="text"
                value={form.dispatch_info.call_type || ''}
                onChange={(e) => updateDispatch('call_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Chest Pain"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={form.dispatch_info.location || ''}
                onChange={(e) => updateDispatch('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 123 Main St, Apt 4B"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Dispatch Info
              </label>
              <input
                type="text"
                value={form.dispatch_info.additional_info || ''}
                onChange={(e) => updateDispatch('additional_info', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Patient is conscious and breathing"
              />
            </div>
          </div>

          <hr className="my-4 border-gray-200 dark:border-gray-700" />

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Scene Description
              </label>
              <textarea
                value={form.scene_info.scene_description || ''}
                onChange={(e) => updateScene('scene_description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what the crew encounters on arrival..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Safety Hazards
              </label>
              <textarea
                value={form.scene_info.safety_hazards || ''}
                onChange={(e) => updateScene('safety_hazards', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Any safety concerns..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Findings
              </label>
              <textarea
                value={form.scene_info.additional_findings || ''}
                onChange={(e) => updateScene('additional_findings', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Medications bottles, medical devices, etc."
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* ============================================================== */}
        {/* 4. Phases Editor */}
        {/* ============================================================== */}
        <CollapsibleSection
          title={`Phases (${form.phases.length})`}
          open={sections.phases}
          onToggle={() => toggleSection('phases')}
        >
          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700">
            {form.phases.map((p, i) => (
              <button
                key={p.id || i}
                type="button"
                onClick={() => setActivePhaseTab(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-t-lg text-sm font-medium transition-colors ${
                  activePhaseTab === i
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-b-2 border-blue-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {p.title || `Phase ${i + 1}`}
              </button>
            ))}
            <button
              type="button"
              onClick={addPhase}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              title="Add Phase"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Active phase editor */}
          {phase && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Phase {activePhaseTab + 1}
                </h3>
                {form.phases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhase(activePhaseTab)}
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Phase
                  </button>
                )}
              </div>

              {/* Phase title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phase Title
                </label>
                <input
                  type="text"
                  value={phase.title}
                  onChange={(e) => updatePhase(activePhaseTab, { title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Initial Assessment"
                />
              </div>

              {/* Presentation text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Presentation Text
                </label>
                <textarea
                  value={phase.presentation_text || ''}
                  onChange={(e) => updatePhase(activePhaseTab, { presentation_text: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="What the student reads at this phase..."
                />
              </div>

              {/* Transition text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Transition Text
                </label>
                <textarea
                  value={phase.transition_text || ''}
                  onChange={(e) => updatePhase(activePhaseTab, { transition_text: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Narrative bridge to the next phase..."
                />
              </div>

              {/* Vitals grid */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vitals
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {(
                    [
                      ['bp', 'BP'],
                      ['hr', 'HR'],
                      ['rr', 'RR'],
                      ['spo2', 'SpO2'],
                      ['etco2', 'EtCO2'],
                      ['temp', 'Temp'],
                      ['glucose', 'Glucose'],
                      ['gcs', 'GCS'],
                      ['pupils', 'Pupils'],
                      ['skin', 'Skin'],
                      ['ekg', 'EKG'],
                    ] as [keyof PhaseVitals, string][]
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={phase.vitals?.[key] || ''}
                        onChange={(e) => updatePhaseVitals(activePhaseTab, key, e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder={label}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Physical findings */}
              <TagInput
                label="Physical Findings"
                value={phase.physical_findings || []}
                onChange={(val) => updatePhase(activePhaseTab, { physical_findings: val })}
                placeholder="e.g., Diaphoretic, JVD..."
              />

              {/* Instructor cues */}
              <TagInput
                label="Instructor Cues"
                value={phase.instructor_cues || []}
                onChange={(val) => updatePhase(activePhaseTab, { instructor_cues: val })}
                placeholder="e.g., Patient grimaces when palpating abdomen..."
              />

              {/* -------------------------------------------------------- */}
              {/* Questions sub-editor */}
              {/* -------------------------------------------------------- */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Questions ({(phase.questions || []).length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => addQuestion(activePhaseTab)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    <Plus className="h-3 w-3" />
                    Add Question
                  </button>
                </div>

                <div className="space-y-4">
                  {(phase.questions || []).map((q, qIdx) => (
                    <QuestionEditor
                      key={q.id || qIdx}
                      question={q}
                      index={qIdx}
                      total={(phase.questions || []).length}
                      onChange={(partial) => updateQuestion(activePhaseTab, qIdx, partial)}
                      onRemove={() => removeQuestion(activePhaseTab, qIdx)}
                      onMoveUp={() => moveQuestion(activePhaseTab, qIdx, qIdx - 1)}
                      onMoveDown={() => moveQuestion(activePhaseTab, qIdx, qIdx + 1)}
                      onAddOption={() => addOption(activePhaseTab, qIdx)}
                      onRemoveOption={(optIdx) => removeOption(activePhaseTab, qIdx, optIdx)}
                      onUpdateOption={(optIdx, text) => updateOption(activePhaseTab, qIdx, optIdx, text)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* ============================================================== */}
        {/* 5. Educational Section */}
        {/* ============================================================== */}
        <CollapsibleSection
          title="Educational"
          open={sections.educational}
          onToggle={() => toggleSection('educational')}
        >
          <div className="space-y-4">
            <TagInput
              label="Learning Objectives"
              value={form.learning_objectives}
              onChange={(val) => updateField('learning_objectives', val)}
              placeholder="e.g., Identify STEMI on 12-lead ECG..."
            />
            <TagInput
              label="Critical Actions"
              value={form.critical_actions}
              onChange={(val) => updateField('critical_actions', val)}
              placeholder="e.g., Activate cath lab within 10 minutes..."
            />
            <TagInput
              label="Common Errors"
              value={form.common_errors}
              onChange={(val) => updateField('common_errors', val)}
              placeholder="e.g., Failing to obtain 12-lead ECG..."
            />
            <TagInput
              label="Debrief Points"
              value={form.debrief_points}
              onChange={(val) => updateField('debrief_points', val)}
              placeholder="e.g., Discuss door-to-balloon time..."
            />
            <TagInput
              label="Equipment Needed"
              value={form.equipment_needed}
              onChange={(val) => updateField('equipment_needed', val)}
              placeholder="e.g., 12-lead ECG monitor, IV supplies..."
            />
          </div>
        </CollapsibleSection>

        {/* Bottom save bar */}
        <div className="sticky bottom-4 mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Publish
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Import JSON modal */}
      {/* ================================================================ */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import JSON</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="Paste case JSON here..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        {open ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question Editor
// ---------------------------------------------------------------------------

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
}: {
  question: CaseQuestion;
  index: number;
  total: number;
  onChange: (partial: Partial<CaseQuestion>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddOption: () => void;
  onRemoveOption: (optIdx: number) => void;
  onUpdateOption: (optIdx: number, text: string) => void;
}) {
  const showOptions = question.type === 'multiple_choice' || question.type === 'multi_select';
  const showItems = question.type === 'ordered_list';
  const showNumeric = question.type === 'numeric';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
              title="Move up"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
              title="Move down"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Q{index + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 dark:text-red-400 text-xs flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* Type select */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
            Type
          </label>
          <select
            value={question.type}
            onChange={(e) => onChange({ type: e.target.value as CaseQuestion['type'] })}
            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            {QUESTION_TYPES.map((qt) => (
              <option key={qt.value} value={qt.value}>
                {qt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Points */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
              Points
            </label>
            <input
              type="number"
              min={0}
              value={question.points || 0}
              onChange={(e) => onChange({ points: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
              Time Limit (s)
            </label>
            <input
              type="number"
              min={0}
              value={question.time_limit ?? ''}
              onChange={(e) =>
                onChange({ time_limit: e.target.value ? parseInt(e.target.value) : null })
              }
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="None"
            />
          </div>
        </div>
      </div>

      {/* Question text */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
          Question Text
        </label>
        <textarea
          value={question.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          placeholder="Enter the question..."
        />
      </div>

      {/* Options (MC / multi_select) */}
      {showOptions && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Options
          </label>
          <div className="space-y-2">
            {(question.options || []).map((opt, optIdx) => (
              <div key={opt.id || optIdx} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-center font-medium uppercase">
                  {opt.id}
                </span>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => onUpdateOption(optIdx, e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder={`Option ${opt.id}`}
                />
                {(question.options || []).length > 2 && (
                  <button
                    type="button"
                    onClick={() => onRemoveOption(optIdx)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onAddOption}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Option
          </button>
        </div>
      )}

      {/* Ordered list items */}
      {showItems && (
        <div className="mb-3">
          <TagInput
            label="Items to Order (correct sequence)"
            value={question.items || []}
            onChange={(val) => onChange({ items: val })}
            placeholder="Add items in correct order..."
          />
        </div>
      )}

      {/* Correct answer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
            Correct Answer{question.type === 'multi_select' ? ' (comma-separated IDs)' : ''}
          </label>
          {showNumeric ? (
            <div className="flex gap-2">
              <input
                type="number"
                value={typeof question.correct_answer === 'number' ? question.correct_answer : ''}
                onChange={(e) =>
                  onChange({ correct_answer: e.target.value ? parseFloat(e.target.value) : '' })
                }
                className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Correct value"
              />
              <input
                type="number"
                min={0}
                value={question.tolerance ?? ''}
                onChange={(e) =>
                  onChange({ tolerance: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="w-24 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Tolerance"
              />
            </div>
          ) : (
            <input
              type="text"
              value={
                Array.isArray(question.correct_answer)
                  ? question.correct_answer.join(', ')
                  : (question.correct_answer?.toString() || '')
              }
              onChange={(e) => {
                const val = e.target.value;
                if (question.type === 'multi_select') {
                  onChange({ correct_answer: val.split(',').map((s) => s.trim()).filter(Boolean) });
                } else {
                  onChange({ correct_answer: val });
                }
              }}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              placeholder={showOptions ? 'e.g., a' : 'Correct answer'}
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
            Hint (optional)
          </label>
          <input
            type="text"
            value={question.hint || ''}
            onChange={(e) => onChange({ hint: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="A helpful hint..."
          />
        </div>
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
          Explanation
        </label>
        <textarea
          value={question.explanation || ''}
          onChange={(e) => onChange({ explanation: e.target.value })}
          rows={2}
          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          placeholder="Explain why this answer is correct..."
        />
      </div>
    </div>
  );
}
