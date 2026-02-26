'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  FileText,
  Link as LinkIcon,
  Upload,
  Search,
  Plus,
  Pencil,
  Trash2,
  Clock,
  FolderOpen,
  X,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: 'protocols' | 'skill_sheets' | 'policies' | 'forms' | 'other';
  resource_type: 'file' | 'link';
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  version: number;
  uploaded_by: string;
  min_role: string;
  linked_skill_ids: string[] | null;
  linked_scenario_ids: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ResourceVersion {
  id: string;
  resource_id: string;
  version: number;
  file_path: string | null;
  file_name: string | null;
  url: string | null;
  uploaded_by: string;
  notes: string | null;
  created_at: string;
}

interface CurrentUser {
  id: string;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'protocols', label: 'Protocols' },
  { key: 'skill_sheets', label: 'Skill Sheets' },
  { key: 'policies', label: 'Policies' },
  { key: 'forms', label: 'Forms' },
  { key: 'other', label: 'Other' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  protocols: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Protocols' },
  skill_sheets: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Skill Sheets' },
  policies: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Policies' },
  forms: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Forms' },
  other: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Other' },
};

const MIN_ROLE_OPTIONS = [
  { value: 'student', label: 'Student (all users)' },
  { value: 'instructor', label: 'Instructor+' },
  { value: 'admin', label: 'Admin+' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getResourceHref(resource: Resource): string | null {
  if (resource.resource_type === 'link') return resource.url;
  if (resource.resource_type === 'file') return resource.file_path || resource.url;
  return null;
}

// ---------------------------------------------------------------------------
// Resource Form (Add/Edit Modal)
// ---------------------------------------------------------------------------

interface ResourceFormData {
  title: string;
  description: string;
  category: string;
  resource_type: 'file' | 'link';
  url: string;
  file_path: string;
  file_name: string;
  min_role: string;
}

const EMPTY_FORM: ResourceFormData = {
  title: '',
  description: '',
  category: 'protocols',
  resource_type: 'link',
  url: '',
  file_path: '',
  file_name: '',
  min_role: 'instructor',
};

interface ResourceModalProps {
  resource: Resource | null; // null = add mode
  onClose: () => void;
  onSave: (data: ResourceFormData) => Promise<void>;
}

function ResourceModal({ resource, onClose, onSave }: ResourceModalProps) {
  const [form, setForm] = useState<ResourceFormData>(
    resource
      ? {
          title: resource.title,
          description: resource.description || '',
          category: resource.category,
          resource_type: resource.resource_type,
          url: resource.url || '',
          file_path: resource.file_path || '',
          file_name: resource.file_name || '',
          min_role: resource.min_role || 'instructor',
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [versionNotes, setVersionNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof ResourceFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {resource ? 'Edit Resource' : 'Add Resource'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 flex-1 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Cardiac Arrest Protocol"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Brief description of this resource..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => set('resource_type', 'link')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.resource_type === 'link'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                External Link
              </button>
              <button
                type="button"
                onClick={() => set('resource_type', 'file')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.resource_type === 'file'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Upload className="w-4 h-4" />
                File
              </button>
            </div>
          </div>

          {/* URL (for link type) */}
          {form.resource_type === 'link' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                required={form.resource_type === 'link'}
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* File path/name (for file type) */}
          {form.resource_type === 'file' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  value={form.file_name}
                  onChange={(e) => set('file_name', e.target.value)}
                  placeholder="e.g. cardiac-arrest-protocol-v3.pdf"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  File Path / URL
                </label>
                <input
                  type="text"
                  value={form.file_path}
                  onChange={(e) => set('file_path', e.target.value)}
                  placeholder="Storage path or direct URL to file"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter the storage path or a direct URL to the file.
                </p>
              </div>
            </>
          )}

          {/* Version notes (edit mode when file changed) */}
          {resource && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Version Notes
              </label>
              <input
                type="text"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                placeholder="What changed? (optional)"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Access Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Access Level
            </label>
            <select
              value={form.min_role}
              onChange={(e) => set('min_role', e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MIN_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Who can see this resource in the library.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            form="resource-form"
            type="submit"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              // Manually trigger form submission
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              // Call handler directly
              if (!saving) {
                setSaving(true);
                onSave({ ...form })
                  .then(() => onClose())
                  .catch(console.error)
                  .finally(() => setSaving(false));
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {resource ? 'Save Changes' : 'Add Resource'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version History Panel
// ---------------------------------------------------------------------------

interface VersionHistoryProps {
  resourceId: string;
  currentVersion: number;
}

function VersionHistoryPanel({ resourceId, currentVersion }: VersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<ResourceVersion[]>([]);
  const [fetched, setFetched] = useState(false);

  const loadVersions = async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/resources/versions?resourceId=${resourceId}`);
      const data = await res.json();
      if (data.success) setVersions(data.versions);
    } catch (err) {
      console.error('Error loading versions:', err);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  const toggle = () => {
    if (!open) loadVersions();
    setOpen(!open);
  };

  if (currentVersion <= 1 && !open) {
    return null;
  }

  return (
    <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <Clock className="w-3.5 h-3.5" />
        Version History ({currentVersion} {currentVersion === 1 ? 'version' : 'versions'})
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">No version history found.</p>
          ) : (
            <div className="space-y-1.5">
              {versions.map((v) => (
                <div key={v.id} className="flex items-start gap-2 text-xs">
                  <span className="font-medium text-gray-600 dark:text-gray-400 w-8 flex-shrink-0">
                    v{v.version}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-500 dark:text-gray-400">
                      {formatDate(v.created_at)} &mdash; {v.uploaded_by}
                    </p>
                    {v.notes && (
                      <p className="text-gray-400 dark:text-gray-500 truncate">{v.notes}</p>
                    )}
                    {(v.url || v.file_path) && (
                      <a
                        href={v.url || v.file_path || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                      >
                        {v.file_name || 'Open file'}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resource Card
// ---------------------------------------------------------------------------

interface ResourceCardProps {
  resource: Resource;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
}

function ResourceCard({ resource, canEdit, canDelete, onEdit, onDelete }: ResourceCardProps) {
  const catStyle = CATEGORY_STYLES[resource.category] || CATEGORY_STYLES.other;
  const href = getResourceHref(resource);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
      {/* Top row: icon + title + version badge */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mt-0.5">
          {resource.resource_type === 'link' ? (
            <LinkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug truncate">
              {resource.title}
            </h3>
            <span className="flex-shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500">
              v{resource.version}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${catStyle.bg} ${catStyle.text}`}>
              {catStyle.label}
            </span>
            {resource.file_size && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatFileSize(resource.file_size)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {resource.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-snug">
          {resource.description}
        </p>
      )}

      {/* Meta */}
      <div className="text-xs text-gray-400 dark:text-gray-500">
        {resource.uploaded_by} &bull; {formatDate(resource.created_at)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View
          </a>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed">
            <ExternalLink className="w-3.5 h-3.5" />
            No link
          </span>
        )}

        {canEdit && (
          <button
            onClick={() => onEdit(resource)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}

        {canDelete && (
          <button
            onClick={() => onDelete(resource)}
            className="ml-auto flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Version History */}
      <VersionHistoryPanel
        resourceId={resource.id}
        currentVersion={resource.version}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  resource: Resource;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function DeleteModal({ resource, onConfirm, onClose }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Delete Resource
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete{' '}
          <span className="font-medium text-gray-900 dark:text-white">"{resource.title}"</span>?
          This will hide it from all users but preserve the record.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ResourcesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<Resource[]>([]);
  const [fetching, setFetching] = useState(false);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  // Load current user
  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [session]);

  // Load resources
  const fetchResources = useCallback(async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (search) params.set('search', search);

      const res = await fetch(`/api/resources?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setResources(data.resources);
      }
    } catch (err) {
      console.error('Error fetching resources:', err);
      toast.error('Failed to load resources');
    } finally {
      setFetching(false);
    }
  }, [activeCategory, search, toast]);

  useEffect(() => {
    if (currentUser) {
      fetchResources();
    }
  }, [currentUser, fetchResources]);

  // Debounced search
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      fetchResources();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Permissions
  const canEdit = currentUser ? hasMinRole(currentUser.role, 'instructor') : false;
  const canDelete = currentUser ? hasMinRole(currentUser.role, 'admin') : false;

  // Handlers
  const handleAddResource = async (form: ResourceFormData) => {
    const res = await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        category: form.category,
        resource_type: form.resource_type,
        url: form.resource_type === 'link' ? form.url : null,
        file_path: form.resource_type === 'file' ? form.file_path : null,
        file_name: form.resource_type === 'file' ? form.file_name : null,
        min_role: form.min_role,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create resource');
    toast.success('Resource added successfully');
    await fetchResources();
  };

  const handleEditResource = async (form: ResourceFormData) => {
    if (!editingResource) return;
    const res = await fetch('/api/resources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingResource.id,
        title: form.title,
        description: form.description || null,
        category: form.category,
        resource_type: form.resource_type,
        url: form.resource_type === 'link' ? form.url : editingResource.url,
        file_path: form.resource_type === 'file' ? form.file_path : editingResource.file_path,
        file_name: form.resource_type === 'file' ? form.file_name : editingResource.file_name,
        min_role: form.min_role,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update resource');
    toast.success('Resource updated successfully');
    await fetchResources();
  };

  const handleDeleteResource = async () => {
    if (!deletingResource) return;
    const res = await fetch(`/api/resources?id=${deletingResource.id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete resource');
    toast.success('Resource deleted');
    await fetchResources();
  };

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Resources</span>
          </div>

          {/* Title + Action */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FolderOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Resources</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Program materials, protocols, and reference documents
                </p>
              </div>
            </div>

            {canEdit && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add Resource
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key as CategoryKey)}
              className={`flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeCategory === cat.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Resources Grid */}
        {fetching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-48"
              />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
              <FolderOpen className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
              No resources found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              {search || activeCategory !== 'all'
                ? 'Try adjusting your search or category filter.'
                : canEdit
                ? 'Get started by adding the first resource.'
                : 'No resources have been added yet.'}
            </p>
            {canEdit && !search && activeCategory === 'all' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add First Resource
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {resources.length} {resources.length === 1 ? 'resource' : 'resources'}
              {activeCategory !== 'all' && ` in ${CATEGORY_STYLES[activeCategory]?.label || activeCategory}`}
              {search && ` matching "${search}"`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={(r) => setEditingResource(r)}
                  onDelete={(r) => setDeletingResource(r)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <ResourceModal
          resource={null}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddResource}
        />
      )}

      {/* Edit Modal */}
      {editingResource && (
        <ResourceModal
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onSave={handleEditResource}
        />
      )}

      {/* Delete Confirmation */}
      {deletingResource && (
        <DeleteModal
          resource={deletingResource}
          onConfirm={handleDeleteResource}
          onClose={() => setDeletingResource(null)}
        />
      )}
    </div>
  );
}
