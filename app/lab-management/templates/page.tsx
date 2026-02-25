'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  LayoutTemplate,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Share2,
  Lock,
  Search,
  Calendar,
  Layers,
  X,
  Save,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface TemplateData {
  stations: Array<{
    station_type: string;
    scenario_id?: string;
    selected_skills?: string[];
    custom_skills?: string[];
    notes?: string;
    room?: string;
    rotation_minutes?: number;
    num_rotations?: number;
  }>;
  rotation_duration?: number;
  num_rotations?: number;
}

type TemplateCategory = 'skills_lab' | 'scenario_lab' | 'assessment' | 'mixed' | 'other';

interface LabDayTemplate {
  id: string;
  name: string;
  description: string | null;
  template_data: TemplateData;
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  category: TemplateCategory;
}

const CATEGORY_OPTIONS: { value: TemplateCategory; label: string }[] = [
  { value: 'skills_lab', label: 'Skills Lab' },
  { value: 'scenario_lab', label: 'Scenario Lab' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  skills_lab: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  scenario_lab: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  assessment: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  mixed: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

type FilterType = 'all' | 'mine' | 'shared';
type SortType = 'updated_at' | 'created_at' | 'name';
type CategoryFilter = 'all' | TemplateCategory;

export default function LabDayTemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [templates, setTemplates] = useState<LabDayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortType>('updated_at');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal state
  const [editTemplate, setEditTemplate] = useState<LabDayTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editShared, setEditShared] = useState(false);
  const [editCategory, setEditCategory] = useState<TemplateCategory>('other');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchTemplates();
    }
  }, [session]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lab-management/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lab-management/templates/${deleteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setTemplates(prev => prev.filter(t => t.id !== deleteId));
      showToast('Template deleted');
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast('Failed to delete template', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (template: LabDayTemplate) => {
    setEditTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description || '');
    setEditShared(template.is_shared);
    setEditCategory(template.category || 'other');
  };

  const handleEditSave = async () => {
    if (!editTemplate || !editName.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/lab-management/templates/${editTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          is_shared: editShared,
          category: editCategory,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setTemplates(prev => prev.map(t => (t.id === editTemplate.id ? data.template : t)));
      showToast('Template updated');
      setEditTemplate(null);
    } catch (error) {
      console.error('Error updating template:', error);
      showToast('Failed to update template', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const getStationTypeSummary = (template: LabDayTemplate) => {
    const stations = template.template_data?.stations || [];
    const counts: Record<string, number> = {};
    stations.forEach(s => {
      counts[s.station_type] = (counts[s.station_type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
  };

  const filteredAndSorted = templates
    .filter(t => {
      if (filter === 'mine') return t.created_by === session?.user?.email;
      if (filter === 'shared') return t.is_shared;
      return true;
    })
    .filter(t => {
      if (categoryFilter === 'all') return true;
      return (t.category || 'other') === categoryFilter;
    })
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const myTemplates = templates.filter(t => t.created_by === session?.user?.email);
  const sharedTemplates = templates.filter(t => t.is_shared && t.created_by !== session?.user?.email);

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
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Templates</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <LayoutTemplate className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                Lab Day Templates
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Save and reuse lab day configurations
              </p>
            </div>
            <Link
              href="/lab-management/schedule/new"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{myTemplates.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">My Templates</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{sharedTemplates.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Shared with Me</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{templates.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Available</div>
          </div>
        </div>

        {/* Filters and search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {([
                { key: 'all', label: 'All' },
                { key: 'mine', label: 'Mine' },
                { key: 'shared', label: 'Shared' },
              ] as { key: FilterType; label: string }[]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    filter === f.key
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortType)}
              className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
            >
              <option value="updated_at">Sort: Last Updated</option>
              <option value="created_at">Sort: Date Created</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All Categories
            </button>
            {CATEGORY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setCategoryFilter(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === opt.value
                    ? 'bg-indigo-600 text-white'
                    : `${CATEGORY_COLORS[opt.value]} hover:opacity-80`
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates grid */}
        {filteredAndSorted.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <LayoutTemplate className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            {templates.length === 0 ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No templates yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
                  Create your first template by setting up a lab day and clicking &ldquo;Save as Template&rdquo;.
                </p>
                <Link
                  href="/lab-management/schedule/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create a Lab Day
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No templates match</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Try changing your filter or search term.</p>
                <button
                  onClick={() => { setFilter('all'); setCategoryFilter('all'); setSearch(''); }}
                  className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAndSorted.map(template => {
              const isOwner = template.created_by === session?.user?.email;
              const stationCount = template.template_data?.stations?.length ?? 0;
              const stationSummary = getStationTypeSummary(template);

              return (
                <div
                  key={template.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{template.name}</h3>
                          {/* Category badge */}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${CATEGORY_COLORS[template.category || 'other']}`}>
                            {CATEGORY_OPTIONS.find(o => o.value === (template.category || 'other'))?.label ?? 'Other'}
                          </span>
                          {template.is_shared ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs flex-shrink-0">
                              <Share2 className="w-3 h-3" />
                              Shared
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs flex-shrink-0">
                              <Lock className="w-3 h-3" />
                              Private
                            </span>
                          )}
                          {!isOwner && (
                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs flex-shrink-0">
                              From team
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{template.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{stationCount} station{stationCount !== 1 ? 's' : ''}</span>
                        {stationSummary && <span className="text-gray-400">({stationSummary})</span>}
                      </div>
                      {template.template_data?.num_rotations && (
                        <div className="flex items-center gap-1">
                          <span>{template.template_data.num_rotations} rotations</span>
                          {template.template_data.rotation_duration && (
                            <span>x {template.template_data.rotation_duration} min</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(template.updated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg">
                    <Link
                      href={`/lab-management/schedule/new?templateId=${template.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Use Template
                    </Link>
                    {isOwner && (
                      <>
                        <button
                          onClick={() => openEdit(template)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(template.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm transition-colors ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
          toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastType === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Delete Template?</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete &ldquo;{templates.find(t => t.id === deleteId)?.name}&rdquo;. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Edit Template</h3>
              </div>
              <button
                onClick={() => setEditTemplate(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as TemplateCategory)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editShared}
                  onChange={(e) => setEditShared(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Share with team</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">All instructors can load this template</p>
                </div>
              </label>
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Note: Editing a template here only updates the name, description, and sharing settings.
                  To update the stations or rotation settings, load the template on the new lab day form and save it again.
                </p>
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setEditTemplate(null)}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!editName.trim() || editSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editSaving ? (
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
                    Save Changes
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
