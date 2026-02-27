'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  FileText,
  Upload,
  Trash2,
  Download,
  Loader2,
  CheckSquare,
  AlertCircle,
  XCircle,
} from 'lucide-react';

interface ChecklistItem {
  key: string;
  label: string;
  auto_checked: boolean;
  manual_override: boolean;
  details: string;
}

interface CloseoutDocument {
  id: string;
  internship_id: string;
  doc_type: string;
  file_name: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

interface CloseoutSectionProps {
  internshipId: string;
  canEdit: boolean;
  isAdmin: boolean;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  completion_form: 'Completion Form',
  preceptor_eval: 'Preceptor Eval',
  field_docs: 'Field Docs',
  exam_results: 'Exam Results',
  other: 'Other',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  completion_form: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  preceptor_eval: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  field_docs: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  exam_results: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export default function CloseoutSection({ internshipId, canEdit, isAdmin }: CloseoutSectionProps) {
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [documents, setDocuments] = useState<CloseoutDocument[]>([]);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [completedBy, setCompletedBy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('other');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Completion state
  const [completing, setCompleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCloseoutData();
  }, [internshipId]);

  const fetchCloseoutData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout`);
      const data = await res.json();
      if (data.success) {
        setChecklist(data.checklist || []);
        setDocuments(data.documents || []);
        setCompletedAt(data.completed_at || null);
        setCompletedBy(data.completed_by || null);
      }
    } catch (error) {
      console.error('Error fetching closeout data:', error);
    }
    setLoading(false);
  };

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleManualOverride = (key: string, checked: boolean) => {
    setChecklist(prev =>
      prev.map(item => (item.key === key ? { ...item, manual_override: checked } : item))
    );
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', selectedDocType);

      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout/documents`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => [data.document, ...prev]);
        showToastMessage('Document uploaded successfully', 'success');
      } else {
        showToastMessage(data.error || 'Failed to upload document', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToastMessage('Failed to upload document', 'error');
    }
    setUploading(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingId(docId);
    try {
      const res = await fetch(
        `/api/clinical/internships/${internshipId}/closeout/documents?docId=${docId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
        showToastMessage('Document deleted', 'success');
      } else {
        showToastMessage(data.error || 'Failed to delete document', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToastMessage('Failed to delete document', 'error');
    }
    setDeletingId(null);
  };

  const handleMarkComplete = async () => {
    setCompleting(true);
    setShowCompleteConfirm(false);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/closeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist }),
      });
      const data = await res.json();
      if (data.success) {
        setCompletedAt(data.internship.completed_at);
        setCompletedBy(data.internship.completed_by);
        showToastMessage('Internship marked as complete!', 'success');
      } else {
        showToastMessage(data.error || 'Failed to mark complete', 'error');
      }
    } catch (error) {
      console.error('Complete error:', error);
      showToastMessage('Failed to mark complete', 'error');
    }
    setCompleting(false);
  };

  const allChecked = checklist.every(item => item.auto_checked || item.manual_override);
  const pendingItems = checklist.filter(item => !item.auto_checked && !item.manual_override);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Closeout Documents &amp; Completion</h3>
          </div>
        </div>
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Section Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Closeout Documents &amp; Completion</h3>
          </div>
          {completedAt && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Completed
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Completed Banner */}
        {completedAt && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-green-800 dark:text-green-300">Internship Officially Closed Out</div>
              <div className="text-sm text-green-700 dark:text-green-400">
                Completed {formatDateTime(completedAt)}
                {completedBy && <> by {completedBy}</>}
              </div>
            </div>
          </div>
        )}

        {/* Checklist */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Completion Checklist</h4>
          <div className="space-y-2">
            {checklist.map(item => {
              const isChecked = item.auto_checked || item.manual_override;
              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    isChecked
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-gray-50 dark:bg-gray-700/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          isChecked
                            ? 'text-green-800 dark:text-green-300'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {item.label}
                        {item.auto_checked && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                            (auto)
                          </span>
                        )}
                      </div>
                      {item.details && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.details}</div>
                      )}
                    </div>
                  </div>
                  {/* Manual override checkbox for non-auto items */}
                  {canEdit && !item.auto_checked && !completedAt && (
                    <label className="flex items-center gap-1.5 ml-3 flex-shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.manual_override}
                        onChange={e => handleManualOverride(item.key, e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Override</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Document Upload */}
        {canEdit && !completedAt && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Upload Documents</h4>
            <div className="flex gap-2 mb-3">
              <select
                value={selectedDocType}
                onChange={e => setSelectedDocType(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div
              className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-7 h-7 text-gray-400" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Click to upload</span>
                    {' '}or drag and drop
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">PDF, JPG, PNG up to 10MB</div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={uploading}
              />
            </div>
          </div>
        )}

        {/* Documents List */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Uploaded Documents
            {documents.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                ({documents.length})
              </span>
            )}
          </h4>
          {documents.length === 0 ? (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No documents uploaded yet
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
                >
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {doc.file_name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          DOC_TYPE_COLORS[doc.doc_type] || DOC_TYPE_COLORS.other
                        }`}
                      >
                        {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(doc.uploaded_at)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        by {doc.uploaded_by}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {isAdmin && !completedAt && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deletingId === doc.id}
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mark Complete Button */}
        {isAdmin && !completedAt && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            {!allChecked && (
              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                      {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} still pending:
                    </div>
                    <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                      {pendingItems.map(item => (
                        <li key={item.key} className="flex items-center gap-1">
                          <XCircle className="w-3 h-3 flex-shrink-0" />
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {showCompleteConfirm ? (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300 mb-3 font-medium">
                  Are you sure you want to mark this internship as officially complete? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkComplete}
                    disabled={completing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm Complete
                  </button>
                  <button
                    onClick={() => setShowCompleteConfirm(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCompleteConfirm(true)}
                disabled={!allChecked}
                title={
                  !allChecked
                    ? `${pendingItems.length} item(s) still pending`
                    : 'Mark internship as officially complete'
                }
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  allChecked
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                Mark Internship Complete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
