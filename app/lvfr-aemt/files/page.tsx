'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { canEditLVFR } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
  FileText, FileSpreadsheet, Image, File, Upload,
  Download, Search, ChevronDown, ChevronRight,
  Loader2, Eye, EyeOff, Pencil, Trash2, X,
  FolderOpen, Presentation, Lock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FileRecord {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  module_id: string | null;
  chapter_id: string | null;
  day_number: number | null;
  uploaded_at: string;
  visible_to_students: boolean;
  download_url: string;
  uploader: { name: string }[] | null;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  pptx: Presentation,
  image: Image,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  txt: FileText,
  other: File,
};

const FILE_COLORS: Record<string, string> = {
  pdf: 'text-red-500',
  docx: 'text-blue-500',
  pptx: 'text-orange-500',
  image: 'text-green-500',
  xlsx: 'text-emerald-500',
  csv: 'text-emerald-500',
  txt: 'text-gray-500',
  other: 'text-gray-400',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FilesPage() {
  const { data: session } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const effectiveRole = useEffectiveRole(userRole);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadModule, setUploadModule] = useState('');
  const [uploadChapter, setUploadChapter] = useState('');
  const [uploadDay, setUploadDay] = useState('');
  const [uploadVisible, setUploadVisible] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Edit modal
  const [editingFile, setEditingFile] = useState<FileRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVisible, setEditVisible] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const isInstructor = canEditLVFR(effectiveRole || '');
  const isStudent = effectiveRole === 'student';

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then(r => r.json())
      .then(d => { if (d.success) setUserRole(d.user.role); })
      .catch(() => {});
  }, [session?.user?.email]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('file_type', filterType);
      const res = await fetch(`/api/lvfr-aemt/files?${params}`);
      const data = await res.json();
      setFiles(data.files || []);
      // Expand all modules by default
      const modules = new Set<string>((data.files || []).map((f: FileRecord) => f.module_id || '__general'));
      setExpandedModules(modules);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterType]);

  useEffect(() => {
    if (effectiveRole !== null) loadFiles();
  }, [effectiveRole, loadFiles]);

  // Group files by module
  const groupedFiles = files.reduce((acc, file) => {
    const key = file.module_id || '__general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {} as Record<string, FileRecord[]>);

  // Filter by search
  const filteredGroups = Object.entries(groupedFiles).reduce((acc, [key, groupFiles]) => {
    const filtered = groupFiles.filter(f =>
      !searchTerm || f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) acc[key] = filtered;
    return acc;
  }, {} as Record<string, FileRecord[]>);

  const toggleModule = (mod: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  // Upload handler
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadProgress('Uploading...');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name);
      if (uploadDesc) formData.append('description', uploadDesc);
      if (uploadModule) formData.append('module_id', uploadModule);
      if (uploadChapter) formData.append('chapter_id', uploadChapter);
      if (uploadDay) formData.append('day_number', uploadDay);
      formData.append('visible_to_students', String(uploadVisible));

      const res = await fetch('/api/lvfr-aemt/files', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setUploadProgress('Done!');
        setShowUpload(false);
        resetUploadForm();
        loadFiles();
      } else {
        setUploadProgress(data.error || 'Upload failed');
      }
    } catch {
      setUploadProgress('Network error');
    }
    setUploading(false);
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadDesc('');
    setUploadModule('');
    setUploadChapter('');
    setUploadDay('');
    setUploadVisible(true);
    setUploadProgress('');
  };

  // Toggle visibility
  const toggleVisibility = async (file: FileRecord) => {
    try {
      await fetch(`/api/lvfr-aemt/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible_to_students: !file.visible_to_students }),
      });
      loadFiles();
    } catch { /* ignore */ }
  };

  // Delete handler
  const handleDelete = async (file: FileRecord) => {
    if (!confirm(`Delete "${file.title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/lvfr-aemt/files/${file.id}`, { method: 'DELETE' });
      loadFiles();
    } catch { /* ignore */ }
  };

  // Edit handler
  const handleEditSave = async () => {
    if (!editingFile) return;
    setEditSaving(true);
    try {
      await fetch(`/api/lvfr-aemt/files/${editingFile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc || null,
          visible_to_students: editVisible,
        }),
      });
      setEditingFile(null);
      loadFiles();
    } catch { /* ignore */ }
    setEditSaving(false);
  };

  const openEdit = (file: FileRecord) => {
    setEditingFile(file);
    setEditTitle(file.title);
    setEditDesc(file.description || '');
    setEditVisible(file.visible_to_students);
  };

  // Module name lookup (simple for now)
  const moduleLabel = (moduleId: string) => {
    if (moduleId === '__general') return 'General Resources';
    // Try to extract module name from ID pattern
    return `Module: ${moduleId}`;
  };

  if (!session) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-red-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs className="mb-3 [&_*]:!text-red-200 [&_a:hover]:!text-white" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg"><FolderOpen className="w-6 h-6" /></div>
              <div>
                <h1 className="text-2xl font-bold">Course Materials</h1>
                <p className="text-red-200 text-sm mt-0.5">PowerPoints, handouts, drug cards, and more</p>
              </div>
            </div>
            {isInstructor && (
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="pdf">PDF</option>
            <option value="pptx">PowerPoint</option>
            <option value="docx">Word</option>
            <option value="image">Images</option>
            <option value="xlsx">Spreadsheet</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Files grouped by module */}
        {!loading && Object.keys(filteredGroups).length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No files match your search' : 'No files uploaded yet'}
            </p>
          </div>
        )}

        {!loading && Object.entries(filteredGroups)
          .sort(([a], [b]) => {
            if (a === '__general') return -1;
            if (b === '__general') return 1;
            return a.localeCompare(b);
          })
          .map(([moduleId, moduleFiles]) => (
            <div key={moduleId} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <button
                onClick={() => toggleModule(moduleId)}
                className="w-full px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedModules.has(moduleId) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <FolderOpen className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">{moduleLabel(moduleId)}</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">({moduleFiles.length} file{moduleFiles.length !== 1 ? 's' : ''})</span>
                </div>
              </button>
              {expandedModules.has(moduleId) && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {moduleFiles.map(file => {
                    const IconComponent = FILE_ICONS[file.file_type || 'other'] || File;
                    const iconColor = FILE_COLORS[file.file_type || 'other'] || 'text-gray-400';
                    const isHidden = !file.visible_to_students;

                    return (
                      <div
                        key={file.id}
                        className={`px-4 py-3 flex items-center gap-3 ${isHidden && isInstructor ? 'bg-gray-50/50 dark:bg-gray-700/20' : ''}`}
                      >
                        <IconComponent className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.title}</p>
                            {isHidden && isInstructor && (
                              <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                            {file.file_type && <span>• {file.file_type.toUpperCase()}</span>}
                            {file.day_number && <span>• Day {file.day_number}</span>}
                            {file.description && <span className="hidden sm:inline truncate max-w-[200px]">• {file.description}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isInstructor && (
                            <>
                              <button
                                onClick={() => toggleVisibility(file)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                title={file.visible_to_students ? 'Visible to students' : 'Hidden from students'}
                              >
                                {file.visible_to_students ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => openEdit(file)}
                                className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(file)}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <a
                            href={file.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Upload File</h3>
              <button onClick={() => { setShowUpload(false); resetUploadForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-red-400 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) { setUploadFile(f); setUploadTitle(f.name.replace(/\.[^.]+$/, '')); }
                }}
              >
                {uploadFile ? (
                  <div className="flex items-center gap-2 justify-center">
                    <FileText className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-900 dark:text-white font-medium">{uploadFile.name}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(uploadFile.size)})</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Drag & drop or click to browse</p>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium cursor-pointer">
                      Choose File
                      <input type="file" className="hidden" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setUploadFile(f); setUploadTitle(f.name.replace(/\.[^.]+$/, '')); }
                      }} />
                    </label>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  placeholder="File title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                <textarea
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  placeholder="Brief description of this file"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module (optional)</label>
                  <input
                    value={uploadModule}
                    onChange={e => setUploadModule(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                    placeholder="e.g. mod-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day # (optional)</label>
                  <input
                    type="number"
                    value={uploadDay}
                    onChange={e => setUploadDay(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                    placeholder="1-30"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadVisible}
                  onChange={e => setUploadVisible(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Visible to students</span>
              </label>

              {uploadProgress && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{uploadProgress}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowUpload(false); resetUploadForm(); }} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit File</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editVisible}
                  onChange={e => setEditVisible(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Visible to students</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingFile(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
