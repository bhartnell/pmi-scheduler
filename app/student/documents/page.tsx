'use client';

/**
 * Student Document Portal Page
 *
 * Two tabs:
 *  1. My Documents – view, upload, delete, download student documents
 *  2. Requests     – view admin document requests and mark them submitted
 *
 * Summary cards show total, approved, pending, and expiring-soon counts.
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  X,
  ChevronRight,
  Home,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Download,
  Trash2,
  Search,
  Filter,
  Upload,
  CalendarDays,
  Shield,
  GraduationCap,
  Stethoscope,
  IdCard,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentStatus = 'pending' | 'approved' | 'rejected' | 'expired';
type DocumentType = 'certificate' | 'transcript' | 'compliance' | 'identification' | 'medical' | 'other';
type RequestStatus = 'pending' | 'submitted' | 'completed';

interface StudentDocument {
  id: string;
  document_type: DocumentType;
  name: string;
  file_url: string | null;
  status: DocumentStatus;
  uploaded_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  expires_at: string | null;
  created_at: string;
}

interface DocumentRequest {
  id: string;
  document_type: string;
  description: string | null;
  due_date: string | null;
  status: RequestStatus;
  requested_by: string;
  created_at: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────

const DOC_STATUS_CONFIG: Record<DocumentStatus, {
  label: string;
  badge: string;
  icon: React.ElementType;
}> = {
  pending: {
    label: 'Pending Review',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    icon: XCircle,
  },
  expired: {
    label: 'Expired',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    icon: AlertCircle,
  },
};

const REQUEST_STATUS_CONFIG: Record<RequestStatus, {
  label: string;
  badge: string;
}> = {
  pending: {
    label: 'Awaiting Upload',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  submitted: {
    label: 'Submitted',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  },
  completed: {
    label: 'Completed',
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  certificate: 'Certificate',
  transcript: 'Transcript',
  compliance: 'Compliance',
  identification: 'Identification',
  medical: 'Medical',
  other: 'Other',
};

const DOC_TYPE_ICONS: Record<DocumentType, React.ElementType> = {
  certificate: GraduationCap,
  transcript: FileText,
  compliance: Shield,
  identification: IdCard,
  medical: Stethoscope,
  other: FolderOpen,
};

const DOC_TYPE_OPTIONS: DocumentType[] = [
  'certificate',
  'transcript',
  'compliance',
  'identification',
  'medical',
  'other',
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function StudentDocumentsPage() {
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState<'documents' | 'requests'>('documents');
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Upload form state
  const [uploadType, setUploadType] = useState<DocumentType>('other');
  const [uploadName, setUploadName] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');

  useEffect(() => {
    if (session?.user?.email) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsRes, reqsRes] = await Promise.all([
        fetch('/api/student/documents'),
        fetch('/api/student/documents/requests'),
      ]);
      const docsData = await docsRes.json();
      const reqsData = await reqsRes.json();
      if (docsData.success) setDocuments(docsData.documents || []);
      if (reqsData.success) setRequests(reqsData.requests || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
    setLoading(false);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const resetUploadForm = () => {
    setUploadType('other');
    setUploadName('');
    setUploadUrl('');
    setFormError(null);
    setShowUploadForm(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!uploadName.trim()) {
      setFormError('Document name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/student/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: uploadType,
          name: uploadName.trim(),
          file_url: uploadUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Document uploaded successfully.', 'success');
        resetUploadForm();
        fetchData();
      } else {
        setFormError(data.error || 'Failed to upload document.');
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      setFormError('An unexpected error occurred.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/student/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Document deleted.', 'success');
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } else {
        showToast(data.error || 'Failed to delete document.', 'error');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      showToast('An unexpected error occurred.', 'error');
    }
    setDeletingId(null);
  };

  const handleMarkSubmitted = async (reqId: string) => {
    setMarkingId(reqId);
    try {
      const res = await fetch('/api/student/documents/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: reqId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Request marked as submitted.', 'success');
        fetchData();
      } else {
        showToast(data.error || 'Failed to update request.', 'error');
      }
    } catch (err) {
      console.error('Error marking request:', err);
      showToast('An unexpected error occurred.', 'error');
    }
    setMarkingId(null);
  };

  // ─── Derived stats ──────────────────────────────────────────────────────────

  const today = new Date();
  const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const totalDocs = documents.length;
  const approvedDocs = documents.filter(d => d.status === 'approved').length;
  const pendingDocs = documents.filter(d => d.status === 'pending').length;
  const expiringSoon = documents.filter(d => {
    if (!d.expires_at) return false;
    const exp = new Date(d.expires_at);
    return exp > today && exp <= thirtyDays;
  }).length;

  // ─── Filtered documents ─────────────────────────────────────────────────────

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || doc.document_type === typeFilter;
    const matchesStatus = !statusFilter || doc.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link
          href="/student"
          className="hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1"
        >
          <Home className="w-3 h-3" />
          Student Portal
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 dark:text-gray-300">Documents</span>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
            <FileText className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Documents</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your program documents and certificates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {activeTab === 'documents' && !showUploadForm && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Documents" value={totalDocs} color="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" />
        <SummaryCard label="Approved" value={approvedDocs} color="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" />
        <SummaryCard label="Pending Review" value={pendingDocs} color="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" />
        <SummaryCard label="Expiring Soon" value={expiringSoon} color="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'documents'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          My Documents
          {totalDocs > 0 && (
            <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
              {totalDocs}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'requests'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Requests
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
              {requests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Upload Form */}
      {activeTab === 'documents' && showUploadForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-cyan-200 dark:border-cyan-800 mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Upload New Document</h2>
            <button
              onClick={resetUploadForm}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleUpload} className="p-6 space-y-5">
            {formError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Document Type */}
              <div>
                <label
                  htmlFor="upload-type"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="upload-type"
                  value={uploadType}
                  onChange={e => setUploadType(e.target.value as DocumentType)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {DOC_TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Document Name */}
              <div>
                <label
                  htmlFor="upload-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Document Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="upload-name"
                  type="text"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="e.g. CPR Certification 2026"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* File URL */}
            <div>
              <label
                htmlFor="upload-url"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                File URL{' '}
                <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                id="upload-url"
                type="url"
                value={uploadUrl}
                onChange={e => setUploadUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Paste a link to your document hosted on Google Drive, Dropbox, or similar.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                {submitting ? 'Uploading...' : 'Upload Document'}
              </button>
              <button
                type="button"
                onClick={resetUploadForm}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All Types</option>
                {DOC_TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Document Grid */}
          {filteredDocuments.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full inline-block mb-4">
                <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {documents.length === 0 ? 'No Documents Yet' : 'No Documents Match Your Filters'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {documents.length === 0
                  ? 'Upload your program documents to get started.'
                  : 'Try adjusting your search or filter criteria.'}
              </p>
              {documents.length === 0 && (
                <button
                  onClick={() => setShowUploadForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Upload Document
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={handleDelete}
                  deleting={deletingId === doc.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div>
          {requests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full inline-block mb-4">
                <CheckCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Document Requests
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your instructors have not requested any documents at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <RequestCard
                  key={req.id}
                  request={req}
                  onMarkSubmitted={handleMarkSubmitted}
                  marking={markingId === req.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
    </div>
  );
}

// ─── Document Card ─────────────────────────────────────────────────────────────

function DocumentCard({
  document,
  onDelete,
  deleting,
}: {
  document: StudentDocument;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const cfg = DOC_STATUS_CONFIG[document.status];
  const StatusIcon = cfg.icon;
  const TypeIcon = DOC_TYPE_ICONS[document.document_type];

  const today = new Date();
  const isExpiringSoon = document.expires_at
    ? (() => {
        const exp = new Date(document.expires_at);
        const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        return exp > today && exp <= thirtyDays;
      })()
    : false;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg shrink-0">
          <TypeIcon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white text-sm leading-tight truncate">
            {document.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {DOC_TYPE_LABELS[document.document_type]}
          </p>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
          <StatusIcon className="w-3 h-3" />
          {cfg.label}
        </span>
        {isExpiringSoon && (
          <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">
            Expiring Soon
          </span>
        )}
      </div>

      {/* Dates */}
      <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
        <div className="flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          Uploaded {new Date(document.created_at).toLocaleDateString()}
        </div>
        {document.expires_at && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Expires {new Date(document.expires_at + 'T12:00:00').toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Review Notes */}
      {document.review_notes && (
        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Reviewer Notes:</p>
          <p className="text-xs text-gray-700 dark:text-gray-300">{document.review_notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
        {document.file_url && (
          <a
            href={document.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        )}
        {document.status === 'pending' && (
          <button
            onClick={() => onDelete(document.id)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Request Card ──────────────────────────────────────────────────────────────

function RequestCard({
  request,
  onMarkSubmitted,
  marking,
}: {
  request: DocumentRequest;
  onMarkSubmitted: (id: string) => void;
  marking: boolean;
}) {
  const cfg = REQUEST_STATUS_CONFIG[request.status];
  const today = new Date();
  const isOverdue =
    request.status === 'pending' &&
    request.due_date &&
    new Date(request.due_date + 'T23:59:59') < today;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 ${
        isOverdue
          ? 'border-red-200 dark:border-red-800'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-gray-900 dark:text-white text-sm">
              {request.document_type}
            </p>
            {isOverdue && (
              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                Overdue
              </span>
            )}
          </div>
          {request.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
              {request.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            {request.due_date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                Due {new Date(request.due_date + 'T12:00:00').toLocaleDateString()}
              </span>
            )}
            <span>Requested by {request.requested_by}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
          {request.status === 'pending' && (
            <button
              onClick={() => onMarkSubmitted(request.id)}
              disabled={marking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Upload className="w-3 h-3" />
              {marking ? 'Updating...' : 'Mark Submitted'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
