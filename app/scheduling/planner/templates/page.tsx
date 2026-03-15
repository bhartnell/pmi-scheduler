'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Plus, X, Save, Trash2, Loader2, BookOpen, Clock, Pencil,
} from 'lucide-react';
import { safeArray } from '@/lib/safe-array';
import { PmiCourseTemplate } from '@/types/semester-planner';

const PROGRAM_TYPES = [
  { value: 'paramedic', label: 'Paramedic', color: '#3B82F6' },
  { value: 'emt', label: 'EMT', color: '#22C55E' },
  { value: 'aemt', label: 'AEMT', color: '#EAB308' },
];

const BLOCK_TYPE_OPTIONS = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'lab', label: 'Lab' },
  { value: 'class', label: 'Class' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'exam', label: 'Exam' },
  { value: 'other', label: 'Other' },
];

const DURATION_TYPES = [
  { value: 'full', label: 'Full Semester (15 wks)' },
  { value: 'first_half', label: 'First Half (Wks 1-8)' },
  { value: 'second_half', label: 'Second Half (Wks 9-15)' },
];

function formatTime(time: string): string {
  if (!time || time === '00:00') return '--';
  const parts = time.split(':');
  const h = parseInt(parts[0] || '0');
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

interface TemplateFormData {
  program_type: string;
  semester_number: number | null;
  course_code: string;
  course_name: string;
  duration_type: string;
  day_index: number;
  start_time: string;
  end_time: string;
  block_type: string;
  is_online: boolean;
  color: string;
  notes: string;
  sort_order: number;
  default_instructor_id: string;
  default_instructor_name: string;
}

function emptyForm(programType: string, semesterNumber: number | null): TemplateFormData {
  return {
    program_type: programType,
    semester_number: semesterNumber,
    course_code: '',
    course_name: '',
    duration_type: 'full',
    day_index: 1,
    start_time: '08:00',
    end_time: '09:00',
    block_type: 'lecture',
    is_online: false,
    color: '#3B82F6',
    notes: '',
    sort_order: 0,
    default_instructor_id: '',
    default_instructor_name: '',
  };
}

export default function TemplateEditorPage() {
  const [templates, setTemplates] = useState<PmiCourseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [selectedProgram, setSelectedProgram] = useState('paramedic');
  const [selectedSemester, setSelectedSemester] = useState<number | null>(1);

  // Instructors for dropdown
  const [instructors, setInstructors] = useState<Instructor[]>([]);

  // Edit state
  const [editingTemplate, setEditingTemplate] = useState<PmiCourseTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(emptyForm('paramedic', 1));
  const [showForm, setShowForm] = useState(false);

  const needsSemester = selectedProgram === 'paramedic';

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/scheduling/planner/templates?program_type=${selectedProgram}`;
      if (needsSemester && selectedSemester !== null) {
        url += `&semester_number=${selectedSemester}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTemplates(safeArray(data.templates));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [selectedProgram, selectedSemester, needsSemester]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load instructors once on mount
  useEffect(() => {
    async function loadInstructors() {
      try {
        const res = await fetch('/api/users/list');
        const data = await res.json();
        if (res.ok && data.users) {
          setInstructors(safeArray(data.users));
        }
      } catch {
        // Non-critical — instructor dropdown will just be empty
      }
    }
    loadInstructors();
  }, []);

  const setField = (field: keyof TemplateFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEdit = (t: PmiCourseTemplate) => {
    setEditingTemplate(t);
    setFormData({
      program_type: t.program_type,
      semester_number: t.semester_number,
      course_code: t.course_code,
      course_name: t.course_name,
      duration_type: t.duration_type || 'full',
      day_index: t.day_index,
      start_time: t.start_time,
      end_time: t.end_time,
      block_type: t.block_type || 'lecture',
      is_online: t.is_online || false,
      color: t.color || '#3B82F6',
      notes: t.notes || '',
      sort_order: t.sort_order || 0,
      default_instructor_id: t.default_instructor_id || '',
      default_instructor_name: t.default_instructor_name || '',
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setFormData(emptyForm(selectedProgram, needsSemester ? selectedSemester : null));
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const isNew = !editingTemplate;
      const url = isNew
        ? '/api/scheduling/planner/templates'
        : `/api/scheduling/planner/templates/${editingTemplate!.id}`;

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setSuccess(isNew ? 'Template created' : 'Template updated');
      setShowForm(false);
      setEditingTemplate(null);
      await loadTemplates();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/scheduling/planner/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error);
      }
      setSuccess('Template deleted');
      await loadTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  // Group templates by day_index
  const onGround = safeArray(templates).filter(t => !t.is_online);
  const online = safeArray(templates).filter(t => t.is_online);
  const dayIndices = [...new Set(onGround.map(t => t.day_index))].sort();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <a href="/scheduling/planner" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ChevronLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-500" />
                Course Templates
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Edit templates used by the Generate wizard
              </p>
            </div>
          </div>
          <button
            onClick={handleNew}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Template
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            {PROGRAM_TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => {
                  setSelectedProgram(pt.value);
                  if (pt.value !== 'paramedic') setSelectedSemester(null);
                  else if (selectedSemester === null) setSelectedSemester(1);
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  selectedProgram === pt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: pt.color }} />
                {pt.label}
              </button>
            ))}
          </div>

          {needsSemester && (
            <div className="flex items-center gap-1 ml-2">
              {[1, 2, 3, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedSemester(s)}
                  className={`px-2.5 py-1 text-sm rounded-md ${
                    selectedSemester === s
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  S{s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Templates grouped by day */}
            {dayIndices.length === 0 && online.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">No templates found</p>
                <p className="text-sm mt-1">Add a template to get started</p>
              </div>
            ) : (
              <div className="space-y-6">
                {dayIndices.map(di => {
                  const dayTemplates = onGround.filter(t => t.day_index === di);
                  return (
                    <div key={di} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Day {di}
                          <span className="text-gray-400 dark:text-gray-500 font-normal ml-2">
                            ({dayTemplates.length} course{dayTemplates.length !== 1 ? 's' : ''})
                          </span>
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {dayTemplates.map(t => (
                          <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 group">
                            <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#3B82F6' }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {t.course_code}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {t.course_name}
                                </span>
                                {t.duration_type !== 'full' && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    t.duration_type === 'first_half'
                                      ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                                      : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                  }`}>
                                    {t.duration_type === 'first_half' ? 'Wks 1-8' : 'Wks 9-15'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(t.start_time)} - {formatTime(t.end_time)}
                                </span>
                                <span className="capitalize">{t.block_type}</span>
                                {t.default_instructor_name && (
                                  <span className="text-purple-600 dark:text-purple-400">
                                    {t.default_instructor_name}
                                  </span>
                                )}
                                {t.notes && <span className="truncate max-w-[200px]">{t.notes}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(t)}
                                className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {online.length > 0 && (
                  <div className="border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
                    <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 border-b border-purple-200 dark:border-purple-800">
                      <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                        Online / DE Courses
                        <span className="text-purple-400 dark:text-purple-500 font-normal ml-2">
                          ({online.length})
                        </span>
                      </h3>
                    </div>
                    <div className="divide-y divide-purple-100 dark:divide-purple-800">
                      {online.map(t => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 group">
                          <div className="w-1.5 h-10 rounded-full flex-shrink-0 bg-purple-400" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {t.course_code} <span className="font-normal text-gray-600 dark:text-gray-400">{t.course_name}</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
                              {t.block_type} &middot; Online
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(t)} className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit/Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Code *</label>
                  <input
                    type="text"
                    value={formData.course_code}
                    onChange={(e) => setField('course_code', e.target.value)}
                    placeholder="EMS 141"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Name *</label>
                  <input
                    type="text"
                    value={formData.course_name}
                    onChange={(e) => setField('course_name', e.target.value)}
                    placeholder="Patient Assessment"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day Index *</label>
                  <select
                    value={formData.day_index}
                    onChange={(e) => setField('day_index', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {[1, 2, 3, 4].map(d => (
                      <option key={d} value={d}>Day {d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setField('start_time', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setField('end_time', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                  <select
                    value={formData.duration_type}
                    onChange={(e) => setField('duration_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {DURATION_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Block Type</label>
                  <select
                    value={formData.block_type}
                    onChange={(e) => setField('block_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {BLOCK_TYPE_OPTIONS.map(bt => (
                      <option key={bt.value} value={bt.value}>{bt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setField('sort_order', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setField('color', e.target.value)}
                    className="w-full h-[38px] px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-pointer"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.is_online}
                  onChange={(e) => setField('is_online', e.target.checked)}
                  className="rounded border-gray-300"
                />
                Online / Distance Education
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Instructor</label>
                <select
                  value={formData.default_instructor_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedInstructor = instructors.find(i => i.id === selectedId);
                    setField('default_instructor_id', selectedId);
                    setField('default_instructor_name', selectedInstructor?.name || '');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                >
                  <option value="">No default (use wizard fallback)</option>
                  {instructors.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Auto-assigned when generating a semester. Editable per-block after generation.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={2}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.course_code || !formData.course_name}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
