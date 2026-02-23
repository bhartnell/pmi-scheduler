'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  RefreshCw,
  Plus,
  Search,
  Edit2,
  Trash2,
  Clock,
  Package,
  BookOpen,
  X,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';

interface SkillDrill {
  id: string;
  name: string;
  description: string | null;
  category: string;
  estimated_duration: number;
  equipment_needed: string[] | null;
  instructions: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'airway', label: 'Airway', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'cardiac', label: 'Cardiac', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'trauma', label: 'Trauma', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'vascular_access', label: 'Vascular Access', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'pharmacology', label: 'Pharmacology', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'assessment', label: 'Assessment', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'general',
  estimated_duration: 15,
  equipment_needed: [''],
  instructions: '',
};

function getCategoryStyle(category: string) {
  return CATEGORIES.find(c => c.value === category)?.color
    || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
}

function getCategoryLabel(category: string) {
  return CATEGORIES.find(c => c.value === category)?.label || category;
}

export default function SkillDrillsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [drills, setDrills] = useState<SkillDrill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingDrill, setEditingDrill] = useState<SkillDrill | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchDrills();
    }
  }, [session]);

  const fetchDrills = async () => {
    try {
      const res = await fetch('/api/lab-management/skill-drills');
      const data = await res.json();
      if (data.success) {
        setDrills(data.drills || []);
      }
    } catch (error) {
      console.error('Error fetching skill drills:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  const openAddModal = () => {
    setEditingDrill(null);
    setForm({ ...EMPTY_FORM, equipment_needed: [''] });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (drill: SkillDrill) => {
    setEditingDrill(drill);
    setForm({
      name: drill.name,
      description: drill.description || '',
      category: drill.category,
      estimated_duration: drill.estimated_duration,
      equipment_needed: drill.equipment_needed?.length ? [...drill.equipment_needed] : [''],
      instructions: drill.instructions || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDrill(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!form.category) {
      setFormError('Category is required');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      estimated_duration: form.estimated_duration,
      equipment_needed: form.equipment_needed.filter(e => e.trim()),
      instructions: form.instructions.trim() || null,
    };

    try {
      const url = editingDrill
        ? `/api/lab-management/skill-drills/${editingDrill.id}`
        : '/api/lab-management/skill-drills';
      const method = editingDrill ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setFormError(data.error || 'Failed to save drill');
        return;
      }

      closeModal();
      await fetchDrills();
      showToast(editingDrill ? 'Drill updated successfully' : 'Drill created successfully');
    } catch (error) {
      setFormError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/lab-management/skill-drills/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!data.success) {
        showToast(data.error || 'Failed to delete drill', 'error');
        return;
      }

      setDeleteId(null);
      await fetchDrills();
      showToast(data.message || 'Drill deactivated');
    } catch (error) {
      showToast('An unexpected error occurred', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const addEquipmentField = () => {
    setForm(f => ({ ...f, equipment_needed: [...f.equipment_needed, ''] }));
  };

  const updateEquipment = (index: number, value: string) => {
    const updated = [...form.equipment_needed];
    updated[index] = value;
    setForm(f => ({ ...f, equipment_needed: updated }));
  };

  const removeEquipment = (index: number) => {
    setForm(f => ({ ...f, equipment_needed: f.equipment_needed.filter((_, i) => i !== index) }));
  };

  // Filtering
  const filteredDrills = drills.filter(drill => {
    const matchesSearch = !search ||
      drill.name.toLowerCase().includes(search.toLowerCase()) ||
      drill.description?.toLowerCase().includes(search.toLowerCase()) ||
      drill.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || drill.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group by category for display
  const drillsByCategory = filteredDrills.reduce((acc, drill) => {
    if (!acc[drill.category]) acc[drill.category] = [];
    acc[drill.category].push(drill);
    return acc;
  }, {} as Record<string, SkillDrill[]>);

  const sortedCategories = Object.keys(drillsByCategory).sort();

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading skill drills...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">
              Lab Management
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-900 dark:text-white">Skill Drills</span>
          </div>

          {/* Title + Add button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-7 h-7 text-orange-500 dark:text-orange-400" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Skill Drills Library</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{drills.length} drills available</p>
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Drill
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Search + Category Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search drills..."
                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Category tab pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                !categoryFilter
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All ({drills.length})
            </button>
            {CATEGORIES.map(cat => {
              const count = drills.filter(d => d.category === cat.value).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategoryFilter(categoryFilter === cat.value ? '' : cat.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    categoryFilter === cat.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Drills Table / Grid */}
        {filteredDrills.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <RefreshCw className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No drills found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {search || categoryFilter ? 'Try adjusting your search or filter.' : 'Add your first skill drill to get started.'}
            </p>
            {!search && !categoryFilter && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <Plus className="w-4 h-4" />
                Add First Drill
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedCategories.map(category => (
              <div key={category} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                {/* Category header */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getCategoryStyle(category)}`}>
                      {getCategoryLabel(category)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {drillsByCategory[category].length} drill{drillsByCategory[category].length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Drills in this category */}
                <div className="divide-y dark:divide-gray-700">
                  {drillsByCategory[category].map(drill => (
                    <div key={drill.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: name + description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{drill.name}</h3>
                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" />
                              {drill.estimated_duration} min
                            </span>
                          </div>
                          {drill.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {drill.description}
                            </p>
                          )}
                          {drill.equipment_needed && drill.equipment_needed.length > 0 && (
                            <div className="flex items-start gap-1.5 mt-2">
                              <Package className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                {drill.equipment_needed.join(', ')}
                              </p>
                            </div>
                          )}
                          {drill.instructions && (
                            <div className="flex items-start gap-1.5 mt-1">
                              <BookOpen className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                {drill.instructions}
                              </p>
                            </div>
                          )}
                          {drill.created_by !== 'system' && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Added by {drill.created_by}
                            </p>
                          )}
                        </div>

                        {/* Right: actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEditModal(drill)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(drill.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-500" />
                {editingDrill ? 'Edit Skill Drill' : 'Add Skill Drill'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., IV Start Practice"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Category + Duration row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    step="5"
                    value={form.estimated_duration}
                    onChange={(e) => setForm(f => ({ ...f, estimated_duration: parseInt(e.target.value) || 15 }))}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief overview of what students practice in this drill..."
                  rows={2}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>

              {/* Equipment needed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Equipment Needed
                </label>
                <div className="space-y-2">
                  {form.equipment_needed.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateEquipment(index, e.target.value)}
                        placeholder={`Equipment item ${index + 1}...`}
                        className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                      <button
                        type="button"
                        onClick={() => removeEquipment(index)}
                        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                        disabled={form.equipment_needed.length === 1}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEquipmentField}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    <Plus className="w-4 h-4" />
                    Add equipment item
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instructor Notes / Instructions
                </label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder="Setup instructions, rotation guidance, what to watch for, debrief points..."
                  rows={4}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={closeModal}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : editingDrill ? 'Save Changes' : 'Create Drill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Deactivate Drill</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {drills.find(d => d.id === deleteId)?.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              This drill will be hidden from the library. It can be restored by an admin if needed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {deleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
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
