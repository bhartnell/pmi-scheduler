'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Mail,
  Users,
  MessageSquare,
  FileText,
  Star,
  AlertCircle,
  Plus,
  X,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CommType = 'phone' | 'email' | 'meeting' | 'text' | 'other';

interface Communication {
  id: string;
  student_id: string;
  type: CommType;
  summary: string;
  details: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  follow_up_completed: boolean;
  flagged: boolean;
  created_by: string;
  created_at: string;
}

interface StudentCommunicationsProps {
  studentId: string;
  studentName: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<CommType, {
  label: string;
  icon: React.ReactNode;
  badgeBg: string;
  badgeText: string;
}> = {
  phone: {
    label: 'Phone Call',
    icon: <Phone className="w-3.5 h-3.5" />,
    badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
    badgeText: 'text-blue-700 dark:text-blue-300',
  },
  email: {
    label: 'Email',
    icon: <Mail className="w-3.5 h-3.5" />,
    badgeBg: 'bg-green-100 dark:bg-green-900/30',
    badgeText: 'text-green-700 dark:text-green-300',
  },
  meeting: {
    label: 'Meeting',
    icon: <Users className="w-3.5 h-3.5" />,
    badgeBg: 'bg-purple-100 dark:bg-purple-900/30',
    badgeText: 'text-purple-700 dark:text-purple-300',
  },
  text: {
    label: 'Text Message',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    badgeBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
  },
  other: {
    label: 'Other',
    icon: <FileText className="w-3.5 h-3.5" />,
    badgeBg: 'bg-gray-100 dark:bg-gray-700',
    badgeText: 'text-gray-700 dark:text-gray-300',
  },
};

const TYPE_FILTER_OPTIONS: Array<{ value: CommType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'text', label: 'Text' },
  { value: 'other', label: 'Other' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function shortEmail(email: string): string {
  return email.split('@')[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentCommunications({ studentId, studentName }: StudentCommunicationsProps) {
  // List state
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CommType | 'all'>('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formType, setFormType] = useState<CommType>('phone');
  const [formSummary, setFormSummary] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formFollowUpNeeded, setFormFollowUpNeeded] = useState(false);
  const [formFollowUpDate, setFormFollowUpDate] = useState('');
  const [formFlagged, setFormFlagged] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Toggling state: record id being toggled
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCommunications = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/lab-management/students/${studentId}/communications`, window.location.origin);
      if (typeFilter !== 'all') url.searchParams.set('type', typeFilter);
      if (showFlaggedOnly) url.searchParams.set('flagged', 'true');
      if (searchQuery.trim()) url.searchParams.set('search', searchQuery.trim());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok && data.success) {
        setCommunications(data.communications || []);
      }
    } catch (err) {
      console.error('Error fetching communications:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId, typeFilter, showFlaggedOnly, searchQuery]);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  // ── Add communication ──────────────────────────────────────────────────────

  const openAddModal = () => {
    setFormType('phone');
    setFormSummary('');
    setFormDetails('');
    setFormFollowUpNeeded(false);
    setFormFollowUpDate('');
    setFormFlagged(false);
    setFormError('');
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (submitting) return;
    setShowAddModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formSummary.trim()) {
      setFormError('Summary is required.');
      return;
    }
    if (formFollowUpNeeded && !formFollowUpDate) {
      setFormError('Please set a follow-up date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          summary: formSummary.trim(),
          details: formDetails.trim() || null,
          follow_up_needed: formFollowUpNeeded,
          follow_up_date: formFollowUpNeeded ? formFollowUpDate : null,
          flagged: formFlagged,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Failed to save. Please try again.');
        return;
      }
      setShowAddModal(false);
      // Prepend optimistically then re-fetch to get server truth
      setCommunications(prev => [data.communication, ...prev]);
    } catch (err) {
      console.error('Error submitting communication:', err);
      setFormError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle helpers ─────────────────────────────────────────────────────────

  const toggleFlag = async (comm: Communication) => {
    setTogglingId(comm.id);
    const newValue = !comm.flagged;
    // Optimistic update
    setCommunications(prev => prev.map(c => c.id === comm.id ? { ...c, flagged: newValue } : c));
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/communications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: comm.id, flagged: newValue }),
      });
      if (!res.ok) {
        // Revert on failure
        setCommunications(prev => prev.map(c => c.id === comm.id ? { ...c, flagged: comm.flagged } : c));
      }
    } catch (err) {
      console.error('Error toggling flag:', err);
      setCommunications(prev => prev.map(c => c.id === comm.id ? { ...c, flagged: comm.flagged } : c));
    } finally {
      setTogglingId(null);
    }
  };

  const toggleFollowUpComplete = async (comm: Communication) => {
    setTogglingId(comm.id);
    const newValue = !comm.follow_up_completed;
    // Optimistic update
    setCommunications(prev => prev.map(c => c.id === comm.id ? { ...c, follow_up_completed: newValue } : c));
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/communications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: comm.id, follow_up_completed: newValue }),
      });
      if (!res.ok) {
        setCommunications(prev => prev.map(c => c.id === comm.id ? { ...c, follow_up_completed: comm.follow_up_completed } : c));
      }
    } catch (err) {
      console.error('Error toggling follow-up:', err);
      setCommunications(prev => prev.map(c => c.id === comm.id ? { ...c, follow_up_completed: comm.follow_up_completed } : c));
    } finally {
      setTogglingId(null);
    }
  };

  // ── Derived counts ─────────────────────────────────────────────────────────

  const pendingFollowUps = communications.filter(c => c.follow_up_needed && !c.follow_up_completed).length;
  const flaggedCount = communications.filter(c => c.flagged).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base">
            Communication Log
          </h3>
          {communications.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
              {communications.length}
            </span>
          )}
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full font-medium">
              <Star className="w-3 h-3" />
              {flaggedCount} flagged
            </span>
          )}
          {pendingFollowUps > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full font-medium">
              <AlertCircle className="w-3 h-3" />
              {pendingFollowUps} follow-up{pendingFollowUps !== 1 ? 's' : ''} pending
            </span>
          )}
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Communication
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter chips */}
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value as CommType | 'all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Flagged filter */}
        <button
          onClick={() => setShowFlaggedOnly(v => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            showFlaggedOnly
              ? 'bg-yellow-400 text-yellow-900'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Star className="w-3 h-3" />
          Flagged
        </button>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="pl-7 pr-3 py-1 border dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={fetchCommunications}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse border dark:border-gray-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : communications.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {searchQuery || typeFilter !== 'all' || showFlaggedOnly
              ? 'No communications match your filters.'
              : `No communications logged for ${studentName} yet.`}
          </p>
          {!searchQuery && typeFilter === 'all' && !showFlaggedOnly && (
            <button
              onClick={openAddModal}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log First Communication
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {communications.map(comm => {
            const typeConf = TYPE_CONFIG[comm.type];
            const isExpanded = expandedId === comm.id;
            const isOverdue =
              comm.follow_up_needed &&
              !comm.follow_up_completed &&
              comm.follow_up_date &&
              new Date(comm.follow_up_date) < new Date();

            return (
              <div
                key={comm.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  comm.flagged
                    ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10'
                    : isOverdue
                    ? 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/10'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                {/* Card header - always visible */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Type badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${typeConf.badgeBg} ${typeConf.badgeText}`}
                    >
                      {typeConf.icon}
                      {typeConf.label}
                    </span>

                    {/* Summary and meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {comm.flagged && (
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                        )}
                        {comm.follow_up_needed && !comm.follow_up_completed && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                              isOverdue
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {isOverdue ? 'Overdue' : 'Follow-up'}
                            {comm.follow_up_date && ` ${formatDate(comm.follow_up_date)}`}
                          </span>
                        )}
                        {comm.follow_up_needed && comm.follow_up_completed && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex-shrink-0">
                            <Check className="w-3 h-3" />
                            Follow-up done
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDate(comm.created_at)} &middot; {shortEmail(comm.created_by)}
                      </p>

                      {/* Summary preview when collapsed */}
                      {!isExpanded && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2">
                          {comm.summary}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Flag toggle */}
                      <button
                        onClick={() => toggleFlag(comm)}
                        disabled={togglingId === comm.id}
                        title={comm.flagged ? 'Remove flag' : 'Flag as important'}
                        className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
                          comm.flagged
                            ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                            : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${comm.flagged ? 'fill-yellow-500' : ''}`} />
                      </button>

                      {/* Expand/collapse */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : comm.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t dark:border-gray-700 space-y-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {comm.summary}
                      </p>
                      {comm.details && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                          {comm.details}
                        </p>
                      )}

                      {comm.follow_up_needed && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Follow-up{comm.follow_up_date ? ` by ${formatDate(comm.follow_up_date)}` : ' needed'}
                            </span>
                          </div>
                          {!comm.follow_up_completed ? (
                            <button
                              onClick={() => toggleFollowUpComplete(comm)}
                              disabled={togglingId === comm.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Mark Complete
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleFollowUpComplete(comm)}
                              disabled={togglingId === comm.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reopen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Communication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70"
            onClick={closeAddModal}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Log Communication</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{studentName}</p>
              </div>
              <button
                onClick={closeAddModal}
                disabled={submitting}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Error message */}
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(TYPE_CONFIG) as [CommType, typeof TYPE_CONFIG[CommType]][]).map(([type, conf]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormType(type)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        formType === type
                          ? `${conf.badgeBg} ${conf.badgeText} border-current`
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {conf.icon}
                      {conf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div>
                <label htmlFor="comm-summary" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="comm-summary"
                  value={formSummary}
                  onChange={e => setFormSummary(e.target.value)}
                  placeholder="Describe what was discussed, any action items, outcomes..."
                  rows={4}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                />
              </div>

              {/* Details */}
              <div>
                <label htmlFor="comm-details" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Additional Details
                </label>
                <textarea
                  id="comm-details"
                  value={formDetails}
                  onChange={e => setFormDetails(e.target.value)}
                  placeholder="Optional additional details..."
                  rows={3}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                />
              </div>

              {/* Follow-up needed */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFollowUpNeeded}
                    onChange={e => {
                      setFormFollowUpNeeded(e.target.checked);
                      if (!e.target.checked) setFormFollowUpDate('');
                    }}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    disabled={submitting}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Follow-up needed</span>
                </label>

                {formFollowUpNeeded && (
                  <div className="ml-6">
                    <label htmlFor="comm-followup-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Follow-up date
                    </label>
                    <input
                      id="comm-followup-date"
                      type="date"
                      value={formFollowUpDate}
                      onChange={e => setFormFollowUpDate(e.target.value)}
                      className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>

              {/* Flag as important */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formFlagged}
                  onChange={e => setFormFlagged(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-yellow-500 focus:ring-yellow-400"
                  disabled={submitting}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Star className={`w-4 h-4 ${formFlagged ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                  Flag as important
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={submitting}
                  className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {submitting && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {submitting ? 'Saving...' : 'Save Communication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
