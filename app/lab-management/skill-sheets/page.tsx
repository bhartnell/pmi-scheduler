'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  FileText,
  Search,
  X,
  Plus,
  Upload,
  Link as LinkIcon,
  ExternalLink,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';

interface SkillDocument {
  id: string;
  document_name: string;
  document_url: string;
  document_type: string;
  file_type: string | null;
  display_order: number;
  created_at: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  certification_levels: string[];
  documents: SkillDocument[];
}

const DOC_TYPE_STYLES: Record<string, string> = {
  skill_sheet: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  checkoff: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  reference: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  protocol: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  skill_sheet: 'Skill Sheet',
  checkoff: 'Checkoff',
  reference: 'Reference',
  protocol: 'Protocol',
};

const EMPTY_DOC_FORM = {
  documentName: '',
  documentType: 'skill_sheet' as string,
  mode: 'file' as 'file' | 'url',
  url: '',
};

export default function SkillSheetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add document modal
  const [addDocSkill, setAddDocSkill] = useState<Skill | null>(null);
  const [docForm, setDocForm] = useState({ ...EMPTY_DOC_FORM });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ skill: Skill; doc: SkillDocument } | null>(null);
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
      fetchSkills();
    }
  }, [session]);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lab-management/skills?includeDocuments=true');
      const data = await res.json();
      if (data.success) {
        setSkills(data.skills || []);
      }
    } catch (err) {
      console.error('Error fetching skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  const openAddDoc = (skill: Skill) => {
    setAddDocSkill(skill);
    setDocForm({ ...EMPTY_DOC_FORM });
    setSelectedFile(null);
    setUploadError('');
  };

  const closeAddDoc = () => {
    setAddDocSkill(null);
    setUploadError('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file && !docForm.documentName) {
      // Auto-fill name from filename (strip extension)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setDocForm(f => ({ ...f, documentName: nameWithoutExt }));
    }
  };

  const handleUpload = async () => {
    if (!addDocSkill) return;

    if (!docForm.documentName.trim()) {
      setUploadError('Document name is required.');
      return;
    }

    if (docForm.mode === 'url') {
      if (!docForm.url.trim()) {
        setUploadError('Please enter a URL.');
        return;
      }
      setUploading(true);
      setUploadError('');
      try {
        const res = await fetch(`/api/lab-management/skills/${addDocSkill.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentName: docForm.documentName.trim(),
            documentType: docForm.documentType,
            url: docForm.url.trim(),
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setUploadError(data.error || 'Failed to add document.');
          return;
        }
        closeAddDoc();
        await fetchSkills();
        showToast('Document added successfully.');
      } catch {
        setUploadError('An unexpected error occurred.');
      } finally {
        setUploading(false);
      }
      return;
    }

    // File upload path
    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentName', docForm.documentName.trim());
      formData.append('documentType', docForm.documentType);

      const res = await fetch(`/api/lab-management/skills/${addDocSkill.id}/documents`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        setUploadError(data.error || 'Upload failed.');
        return;
      }
      closeAddDoc();
      await fetchSkills();
      showToast('Document uploaded successfully.');
    } catch {
      setUploadError('An unexpected error occurred.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/lab-management/skills/${deleteTarget.skill.id}/documents?documentId=${deleteTarget.doc.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Failed to delete document.', 'error');
        return;
      }
      setDeleteTarget(null);
      await fetchSkills();
      showToast('Document deleted.');
    } catch {
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Group skills by category
  const filteredSkills = skills.filter(skill => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      skill.name.toLowerCase().includes(q) ||
      skill.category.toLowerCase().includes(q) ||
      skill.documents.some(d => d.document_name.toLowerCase().includes(q))
    );
  });

  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const sortedCategories = Object.keys(skillsByCategory).sort();

  const totalDocs = skills.reduce((sum, s) => sum + s.documents.length, 0);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading skill sheets...</p>
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
            <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
              <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">PMI</span>
              </div>
            </Link>
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
            <span className="text-gray-900 dark:text-white">Skill Sheets</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <FileText className="w-7 h-7 text-lime-600 dark:text-lime-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Skill Sheets</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {skills.length} skills &middot; {totalDocs} document{totalDocs !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by skill name, category, or document..."
              className="w-full pl-10 pr-10 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
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

        {/* Skills by Category */}
        {sortedCategories.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No skills found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {search ? 'Try adjusting your search.' : 'No skills are configured yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedCategories.map(category => (
              <div key={category} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                {/* Category header */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                  <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                    {category}
                    <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal">
                      ({skillsByCategory[category].length})
                    </span>
                  </h2>
                </div>

                {/* Skills in this category */}
                <div className="divide-y dark:divide-gray-700">
                  {skillsByCategory[category].map(skill => (
                    <div key={skill.id} className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{skill.name}</h3>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {skill.certification_levels.map(lvl => (
                              <span
                                key={lvl}
                                className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                              >
                                {lvl}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => openAddDoc(skill)}
                          className="flex-shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Document
                        </button>
                      </div>

                      {/* Documents for this skill */}
                      {skill.documents.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No documents attached</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {skill.documents.map(doc => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-600 rounded-lg group"
                            >
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${DOC_TYPE_STYLES[doc.document_type] || 'bg-gray-100 text-gray-700'}`}>
                                {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                              </span>
                              <a
                                href={doc.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 max-w-xs truncate"
                              >
                                {doc.document_name}
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                              <button
                                onClick={() => setDeleteTarget({ skill, doc })}
                                className="ml-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Document Modal */}
      {addDocSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-lime-600" />
                  Add Document
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{addDocSkill.name}</p>
              </div>
              <button
                onClick={closeAddDoc}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {uploadError}
                </div>
              )}

              {/* Document Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={docForm.documentName}
                  onChange={(e) => setDocForm(f => ({ ...f, documentName: e.target.value }))}
                  placeholder="e.g., IV Start Skill Sheet"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>

              {/* Document Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Type
                </label>
                <select
                  value={docForm.documentType}
                  onChange={(e) => setDocForm(f => ({ ...f, documentType: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="skill_sheet">Skill Sheet</option>
                  <option value="checkoff">Checkoff</option>
                  <option value="reference">Reference</option>
                  <option value="protocol">Protocol</option>
                </select>
              </div>

              {/* Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source</label>
                <div className="flex rounded-lg border dark:border-gray-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDocForm(f => ({ ...f, mode: 'file' }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                      docForm.mode === 'file'
                        ? 'bg-lime-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocForm(f => ({ ...f, mode: 'url' }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                      docForm.mode === 'url'
                        ? 'bg-lime-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <LinkIcon className="w-4 h-4" />
                    Paste URL
                  </button>
                </div>
              </div>

              {/* File upload or URL input */}
              {docForm.mode === 'file' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={handleFileChange}
                    className="hidden"
                    id="skill-doc-file"
                  />
                  <label
                    htmlFor="skill-doc-file"
                    className="flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-center"
                  >
                    {selectedFile ? (
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {(selectedFile.size / 1024).toFixed(0)} KB &middot; Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Click to choose file
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          PDF, DOCX, JPG, PNG up to 10 MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Document URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={docForm.url}
                    onChange={(e) => setDocForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={closeAddDoc}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:bg-gray-400 text-sm"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {uploading ? 'Saving...' : 'Add Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Delete Document</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{deleteTarget.doc.document_name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              This will permanently delete the document from{' '}
              <strong className="text-gray-900 dark:text-white">{deleteTarget.skill.name}</strong>.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 text-sm"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleting ? 'Deleting...' : 'Delete'}
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
