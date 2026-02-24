'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  Calendar,
  FileText,
  User,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface PreceptorInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  agency_name: string | null;
  station: string | null;
  credentials: string | null;
}

interface PreceptorAssignment {
  id: string;
  internship_id: string;
  preceptor_id: string;
  role: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  preceptor: PreceptorInfo | null;
}

interface AvailablePreceptor {
  id: string;
  first_name: string;
  last_name: string;
  agency_name: string | null;
  station: string | null;
}

interface PreceptorsSectionProps {
  internshipId: string;
  canEdit: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  tertiary: 'Backup',
  backup: 'Backup',
};

const ROLE_COLORS: Record<string, string> = {
  primary: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  secondary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  tertiary: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  backup: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const ROLE_SHORT: Record<string, string> = {
  primary: '1°',
  secondary: '2°',
  tertiary: 'BU',
  backup: 'BU',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PreceptorsSection({ internshipId, canEdit }: PreceptorsSectionProps) {
  const [assignments, setAssignments] = useState<PreceptorAssignment[]>([]);
  const [availablePreceptors, setAvailablePreceptors] = useState<AvailablePreceptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Add modal form state
  const [modalPreceptorId, setModalPreceptorId] = useState('');
  const [modalRole, setModalRole] = useState<'primary' | 'secondary' | 'tertiary'>('primary');
  const [modalStartDate, setModalStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [modalNotes, setModalNotes] = useState('');

  useEffect(() => {
    fetchAssignments();
    fetchPreceptors();
  }, [internshipId]);

  const fetchAssignments = async () => {
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/preceptors`);
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error('Error fetching preceptor assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreceptors = async () => {
    try {
      const res = await fetch('/api/clinical/preceptors?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setAvailablePreceptors(data.preceptors || []);
      }
    } catch (err) {
      console.error('Error fetching preceptors:', err);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddAssignment = async () => {
    if (!modalPreceptorId) {
      showToast('Please select a preceptor', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/clinical/internships/${internshipId}/preceptors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preceptor_id: modalPreceptorId,
          role: modalRole,
          start_date: modalStartDate || new Date().toISOString().split('T')[0],
          notes: modalNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchAssignments();
        setShowAddModal(false);
        setModalPreceptorId('');
        setModalRole('primary');
        setModalStartDate(new Date().toISOString().split('T')[0]);
        setModalNotes('');
        showToast('Preceptor assigned successfully', 'success');
      } else {
        showToast(data.error || 'Failed to add preceptor', 'error');
      }
    } catch (err) {
      console.error('Error adding assignment:', err);
      showToast('Failed to add preceptor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndAssignment = async (assignmentId: string) => {
    setEndingId(assignmentId);
    try {
      const res = await fetch(
        `/api/clinical/internships/${internshipId}/preceptors/${assignmentId}`,
        { method: 'DELETE' }
      );

      const data = await res.json();
      if (data.success) {
        await fetchAssignments();
        showToast('Assignment ended', 'success');
      } else {
        showToast(data.error || 'Failed to end assignment', 'error');
      }
    } catch (err) {
      console.error('Error ending assignment:', err);
      showToast('Failed to end assignment', 'error');
    } finally {
      setEndingId(null);
    }
  };

  const active = assignments.filter((a) => a.is_active);
  const historical = assignments.filter((a) => !a.is_active);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
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

      {/* Section Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-teal-50 dark:bg-teal-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Preceptors</h3>
            {active.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                {active.length} active
              </span>
            )}
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Preceptor
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            {/* Active Preceptors */}
            {active.length === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No preceptors currently assigned</p>
                {canEdit && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-2 text-sm text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    Assign a preceptor
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {active.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10"
                  >
                    {/* Role Badge */}
                    <div className="flex-shrink-0 mt-0.5">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                          ROLE_COLORS[assignment.role] || ROLE_COLORS.primary
                        }`}
                      >
                        {ROLE_SHORT[assignment.role] || '?'}
                      </span>
                    </div>

                    {/* Preceptor Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {assignment.preceptor?.first_name} {assignment.preceptor?.last_name}
                          {assignment.preceptor?.credentials && (
                            <span className="text-gray-500 dark:text-gray-400 font-normal">
                              {', '}
                              {assignment.preceptor.credentials}
                            </span>
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            ROLE_COLORS[assignment.role] || ROLE_COLORS.primary
                          }`}
                        >
                          {ROLE_LABELS[assignment.role] || assignment.role}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      </div>

                      {assignment.preceptor?.agency_name && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {assignment.preceptor.agency_name}
                          {assignment.preceptor.station && ` — ${assignment.preceptor.station}`}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {assignment.start_date && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <Calendar className="w-3 h-3" />
                            Since {formatDate(assignment.start_date)}
                          </span>
                        )}
                        {assignment.notes && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <FileText className="w-3 h-3" />
                            {assignment.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* End Assignment Button */}
                    {canEdit && (
                      <button
                        onClick={() => handleEndAssignment(assignment.id)}
                        disabled={endingId === assignment.id}
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-700 transition-colors"
                        title="End this assignment"
                      >
                        {endingId === assignment.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        End
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Historical Assignments */}
            {historical.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  {showHistory ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Clock className="w-3.5 h-3.5" />
                  {historical.length} previous assignment{historical.length !== 1 ? 's' : ''}
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                    {historical.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/30"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                              ROLE_COLORS[assignment.role] || ROLE_COLORS.primary
                            } opacity-70`}
                          >
                            {ROLE_SHORT[assignment.role] || '?'}
                          </span>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {assignment.preceptor?.first_name} {assignment.preceptor?.last_name}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            ({ROLE_LABELS[assignment.role] || assignment.role})
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {assignment.start_date ? formatDate(assignment.start_date) : 'Unknown start'}
                            {' '}
                            &rarr;
                            {' '}
                            {assignment.end_date ? formatDate(assignment.end_date) : 'Unknown end'}
                          </span>
                          {assignment.preceptor?.agency_name && (
                            <>
                              <span>&middot;</span>
                              <span>{assignment.preceptor.agency_name}</span>
                            </>
                          )}
                        </div>

                        {assignment.notes && (
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 flex items-start gap-1">
                            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>{assignment.notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Preceptor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Assign Preceptor</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preceptor Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Preceptor <span className="text-red-500">*</span>
                </label>
                <select
                  value={modalPreceptorId}
                  onChange={(e) => setModalPreceptorId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select a preceptor...</option>
                  {availablePreceptors.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.agency_name ? ` (${p.agency_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['primary', 'secondary', 'tertiary'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setModalRole(role)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        modalRole === role
                          ? `${ROLE_COLORS[role]} border-current`
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
                {modalRole === 'primary' && active.some((a) => a.role === 'primary') && (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    A primary preceptor is already active. Assigning a new primary will end the current one.
                  </p>
                )}
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={modalStartDate}
                  onChange={(e) => setModalStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={3}
                  placeholder="Reason for assignment, special considerations..."
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAssignment}
                disabled={submitting || !modalPreceptorId}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {submitting ? 'Assigning...' : 'Assign Preceptor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
