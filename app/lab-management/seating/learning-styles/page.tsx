'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Brain,
  Plus,
  Edit2,
  Trash2,
  Home,
  X,
  Search,
  Filter,
  Save,
  Table
} from 'lucide-react';
import { canManageContent, type Role } from '@/lib/permissions';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  agency: string | null;
  cohort_id: string;
  cohort?: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string };
  };
}

interface LearningStyle {
  id: string;
  student_id: string;
  primary_style: string;
  social_style: string;
  processing_style: string | null;
  structure_style: string | null;
  assessed_date: string | null;
  notes: string | null;
  student: Student;
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { name: string; abbreviation: string };
}

const PRIMARY_STYLES = [
  { value: 'audio', label: 'Audio', description: 'Learns best through listening' },
  { value: 'visual', label: 'Visual', description: 'Learns best through seeing' },
  { value: 'kinesthetic', label: 'Kinesthetic', description: 'Learns best through doing' },
];

const SOCIAL_STYLES = [
  { value: 'social', label: 'Social', description: 'Prefers group learning' },
  { value: 'independent', label: 'Independent', description: 'Prefers solo learning' },
];

const PROCESSING_STYLES = [
  { value: 'analytical', label: 'Analytical', description: 'Step-by-step processing' },
  { value: 'global', label: 'Global', description: 'Big-picture processing' },
];

const STRUCTURE_STYLES = [
  { value: 'structured', label: 'Structured', description: 'Prefers clear guidelines' },
  { value: 'flexible', label: 'Flexible', description: 'Adapts to situations' },
];

const STYLE_BADGES: Record<string, { bg: string; text: string }> = {
  audio: { bg: 'bg-blue-100', text: 'text-blue-700' },
  visual: { bg: 'bg-green-100', text: 'text-green-700' },
  kinesthetic: { bg: 'bg-orange-100', text: 'text-orange-700' },
  social: { bg: 'bg-purple-100', text: 'text-purple-700' },
  independent: { bg: 'bg-gray-100', text: 'text-gray-700' },
  analytical: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  global: { bg: 'bg-pink-100', text: 'text-pink-700' },
  structured: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  flexible: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

function LearningStylesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCohortId = searchParams.get('cohortId');

  const [learningStyles, setLearningStyles] = useState<LearningStyle[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCohort, setSelectedCohort] = useState<string>(initialCohortId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formStudentId, setFormStudentId] = useState('');
  const [formPrimaryStyle, setFormPrimaryStyle] = useState('');
  const [formSocialStyle, setFormSocialStyle] = useState('');
  const [formProcessingStyle, setFormProcessingStyle] = useState('');
  const [formStructureStyle, setFormStructureStyle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Bulk entry state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<Record<string, { primary: string; social: string }>>({});
  const [showOnlyUnassessed, setShowOnlyUnassessed] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch learning styles
      const lsUrl = selectedCohort
        ? `/api/seating/learning-styles?cohortId=${selectedCohort}`
        : '/api/seating/learning-styles';
      const lsRes = await fetch(lsUrl);
      const lsData = await lsRes.json();
      if (lsData.success) {
        setLearningStyles(lsData.learningStyles || []);
      }

      // Fetch students (for the add form)
      const studentsUrl = selectedCohort
        ? `/api/lab-management/students?cohortId=${selectedCohort}&status=active`
        : '/api/lab-management/students?status=active';
      const studentsRes = await fetch(studentsUrl);
      const studentsData = await studentsRes.json();
      if (studentsData.success) {
        setStudents(studentsData.students || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormStudentId('');
    setFormPrimaryStyle('');
    setFormSocialStyle('');
    setFormProcessingStyle('');
    setFormStructureStyle('');
    setFormNotes('');
  };

  const openEditForm = (ls: LearningStyle) => {
    setEditingId(ls.id);
    setFormStudentId(ls.student_id);
    setFormPrimaryStyle(ls.primary_style);
    setFormSocialStyle(ls.social_style);
    setFormProcessingStyle(ls.processing_style || '');
    setFormStructureStyle(ls.structure_style || '');
    setFormNotes(ls.notes || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId || !formPrimaryStyle || !formSocialStyle) {
      alert('Student, Primary Style, and Social Style are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/seating/learning-styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: formStudentId,
          primary_style: formPrimaryStyle,
          social_style: formSocialStyle,
          processing_style: formProcessingStyle || null,
          structure_style: formStructureStyle || null,
          notes: formNotes || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (editingId) {
          setLearningStyles(learningStyles.map(ls =>
            ls.student_id === formStudentId ? data.learningStyle : ls
          ));
        } else {
          setLearningStyles([data.learningStyle, ...learningStyles]);
        }
        resetForm();
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this learning style assessment?')) return;

    try {
      const res = await fetch(`/api/seating/learning-styles?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        setLearningStyles(learningStyles.filter(ls => ls.id !== id));
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  // Bulk entry functions
  const handleBulkEntryChange = (studentId: string, field: 'primary' | 'social', value: string) => {
    setBulkEntries(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const handleBulkSave = async () => {
    // Get entries that have both primary and social styles filled in
    const validEntries = Object.entries(bulkEntries).filter(
      ([_, entry]) => entry.primary && entry.social
    );

    if (validEntries.length === 0) {
      alert('No complete entries to save. Please fill in both Primary and Social styles for at least one student.');
      return;
    }

    setBulkSaving(true);
    let savedCount = 0;
    const newLearningStyles: LearningStyle[] = [];

    for (const [studentId, entry] of validEntries) {
      try {
        const res = await fetch('/api/seating/learning-styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: studentId,
            primary_style: entry.primary,
            social_style: entry.social,
          }),
        });

        const data = await res.json();
        if (data.success) {
          savedCount++;
          newLearningStyles.push(data.learningStyle);
        }
      } catch (error) {
        console.error(`Error saving for student ${studentId}:`, error);
      }
    }

    // Update local state with new entries
    setLearningStyles(prev => [...newLearningStyles, ...prev]);

    // Clear saved entries from bulk entries
    const savedIds = new Set(validEntries.map(([id]) => id));
    setBulkEntries(prev => {
      const updated = { ...prev };
      for (const id of savedIds) {
        delete updated[id];
      }
      return updated;
    });

    setBulkSaving(false);
    alert(`Successfully saved ${savedCount} assessment(s)!`);
  };

  const getBulkEntryProgress = () => {
    const validEntries = Object.values(bulkEntries).filter(e => e.primary && e.social).length;
    return validEntries;
  };

  // Students without learning styles (for add form)
  const assessedStudentIds = new Set(learningStyles.map(ls => ls.student_id));
  const unassessedStudents = students.filter(s => !assessedStudentIds.has(s.id));

  // Filter learning styles by search
  const filteredStyles = learningStyles.filter(ls => {
    if (!searchQuery) return true;
    const name = `${ls.student.first_name} ${ls.student.last_name}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Learning Styles</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Learning Styles</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage student learning style assessments</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setBulkMode(!bulkMode);
                  if (!bulkMode) {
                    setBulkEntries({});
                  }
                }}
                disabled={!selectedCohort}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                  bulkMode
                    ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                } disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:border-gray-200 dark:disabled:border-gray-600`}
                title={!selectedCohort ? 'Select a cohort to use bulk entry' : ''}
              >
                <Table className="w-5 h-5" />
                {bulkMode ? 'Exit Bulk Entry' : 'Bulk Entry'}
              </button>
              {!bulkMode && (
                <button
                  onClick={() => setShowForm(true)}
                  disabled={unassessedStudents.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                >
                  <Plus className="w-5 h-5" />
                  Add Assessment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Learning Style' : 'Add Learning Style Assessment'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Student Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student *</label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  disabled={!!editingId}
                  required
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-600"
                >
                  <option value="">Select a student...</option>
                  {(editingId ? students : unassessedStudents).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                      {s.cohort && ` (${s.cohort.program.abbreviation} ${s.cohort.cohort_number})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Primary & Social Style (Required) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Style *</label>
                  <select
                    value={formPrimaryStyle}
                    onChange={(e) => setFormPrimaryStyle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value="">Select...</option>
                    {PRIMARY_STYLES.map(s => (
                      <option key={s.value} value={s.value}>{s.label} - {s.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Social Style *</label>
                  <select
                    value={formSocialStyle}
                    onChange={(e) => setFormSocialStyle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value="">Select...</option>
                    {SOCIAL_STYLES.map(s => (
                      <option key={s.value} value={s.value}>{s.label} - {s.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Processing & Structure Style (Optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Processing Style</label>
                  <select
                    value={formProcessingStyle}
                    onChange={(e) => setFormProcessingStyle(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value="">Not assessed</option>
                    {PROCESSING_STYLES.map(s => (
                      <option key={s.value} value={s.value}>{s.label} - {s.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Structure Style</label>
                  <select
                    value={formStructureStyle}
                    onChange={(e) => setFormStructureStyle(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value="">Not assessed</option>
                    {STRUCTURE_STYLES.map(s => (
                      <option key={s.value} value={s.value}>{s.label} - {s.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional observations..."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                >
                  {saving ? 'Saving...' : (editingId ? 'Update' : 'Add Assessment')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bulk Entry Mode */}
        {bulkMode && selectedCohort && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Entry Mode</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Quickly assign learning styles to multiple students at once.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={showOnlyUnassessed}
                    onChange={(e) => setShowOnlyUnassessed(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Show only unassessed
                </label>
              </div>
            </div>

            {/* Progress Bar */}
            {getBulkEntryProgress() > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 dark:text-blue-400">
                    {getBulkEntryProgress()} student(s) ready to save
                  </span>
                  <button
                    onClick={handleBulkSave}
                    disabled={bulkSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                  >
                    <Save className="w-4 h-4" />
                    {bulkSaving ? 'Saving...' : 'Save All'}
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Entry Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Agency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Primary Style *</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Social Style *</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {(showOnlyUnassessed ? unassessedStudents : students).map((student) => {
                    const existingStyle = learningStyles.find(ls => ls.student_id === student.id);
                    const bulkEntry = bulkEntries[student.id] || { primary: '', social: '' };
                    const isComplete = bulkEntry.primary && bulkEntry.social;

                    return (
                      <tr key={student.id} className={isComplete ? 'bg-green-50 dark:bg-green-900/30' : ''}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {student.first_name} {student.last_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {student.agency || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {existingStyle ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${STYLE_BADGES[existingStyle.primary_style]?.bg} ${STYLE_BADGES[existingStyle.primary_style]?.text}`}>
                              {existingStyle.primary_style.charAt(0).toUpperCase() + existingStyle.primary_style.slice(1)}
                            </span>
                          ) : (
                            <select
                              value={bulkEntry.primary}
                              onChange={(e) => handleBulkEntryChange(student.id, 'primary', e.target.value)}
                              className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="">Select...</option>
                              {PRIMARY_STYLES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {existingStyle ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${STYLE_BADGES[existingStyle.social_style]?.bg} ${STYLE_BADGES[existingStyle.social_style]?.text}`}>
                              {existingStyle.social_style.charAt(0).toUpperCase() + existingStyle.social_style.slice(1)}
                            </span>
                          ) : (
                            <select
                              value={bulkEntry.social}
                              onChange={(e) => handleBulkEntryChange(student.id, 'social', e.target.value)}
                              className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="">Select...</option>
                              {SOCIAL_STYLES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {existingStyle ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">Assessed</span>
                          ) : isComplete ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">Ready to save</span>
                          ) : (
                            <span className="text-gray-400">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {(showOnlyUnassessed ? unassessedStudents : students).length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {showOnlyUnassessed
                  ? 'All students in this cohort have been assessed!'
                  : 'No students found in this cohort.'}
              </div>
            )}

            {/* Bulk Save Button (bottom) */}
            {getBulkEntryProgress() > 0 && (
              <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-end">
                <button
                  onClick={handleBulkSave}
                  disabled={bulkSaving}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                >
                  <Save className="w-5 h-5" />
                  {bulkSaving ? 'Saving...' : `Save ${getBulkEntryProgress()} Assessment(s)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filters - Hidden in bulk mode */}
        {!bulkMode && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.program.abbreviation} Group {c.cohort_number}
                </option>
              ))}
            </select>
          </div>
        </div>
        )}

        {/* Stats - Hidden in bulk mode */}
        {!bulkMode && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{learningStyles.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Assessed</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{unassessedStudents.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Not Assessed</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {learningStyles.filter(ls => ls.primary_style === 'audio').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Audio</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {learningStyles.filter(ls => ls.primary_style === 'visual').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Visual</div>
          </div>
        </div>
        )}

        {/* Learning Styles List - Hidden in bulk mode */}
        {!bulkMode && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filteredStyles.length === 0 ? (
            <div className="p-8 text-center">
              <Brain className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No matching students found' : 'No learning styles assessed yet'}
              </p>
              {!searchQuery && unassessedStudents.length > 0 && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add First Assessment
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Primary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Social</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Processing</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Structure</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStyles.map((ls) => (
                  <tr key={ls.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {ls.student.first_name} {ls.student.last_name}
                      </div>
                      {ls.student.cohort && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {ls.student.cohort.program.abbreviation} {ls.student.cohort.cohort_number}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STYLE_BADGES[ls.primary_style]?.bg} ${STYLE_BADGES[ls.primary_style]?.text}`}>
                        {ls.primary_style.charAt(0).toUpperCase() + ls.primary_style.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STYLE_BADGES[ls.social_style]?.bg} ${STYLE_BADGES[ls.social_style]?.text}`}>
                        {ls.social_style.charAt(0).toUpperCase() + ls.social_style.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      {ls.processing_style ? (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STYLE_BADGES[ls.processing_style]?.bg} ${STYLE_BADGES[ls.processing_style]?.text}`}>
                          {ls.processing_style.charAt(0).toUpperCase() + ls.processing_style.slice(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      {ls.structure_style ? (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STYLE_BADGES[ls.structure_style]?.bg} ${STYLE_BADGES[ls.structure_style]?.text}`}>
                          {ls.structure_style.charAt(0).toUpperCase() + ls.structure_style.slice(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditForm(ls)}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {userRole && canManageContent(userRole) && (
                        <button
                          onClick={() => handleDelete(ls.id)}
                          className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )}
      </main>
    </div>
  );
}

export default function LearningStylesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <LearningStylesContent />
    </Suspense>
  );
}
