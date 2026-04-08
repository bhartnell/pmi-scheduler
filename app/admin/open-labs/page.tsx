'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  QrCode,
  Users,
  XCircle,
  RotateCcw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenLabSignup {
  id: string;
  student_name: string;
  student_email: string;
  program_level: string;
  what_to_work_on: string;
  requested_instructor_id: string | null;
  requested_instructor: { id: string; name: string; email: string } | null;
  created_at: string;
  cancelled_at: string | null;
}

interface OpenLabSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  notes: string | null;
  signups: OpenLabSignup[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSessionDate(dateStr: string): string {
  const safe = dateStr.includes('T') || dateStr.includes(' ') ? dateStr : dateStr + 'T12:00:00';
  return new Date(safe).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Cancel Modal
// ---------------------------------------------------------------------------

function CancelModal({
  session,
  onClose,
  onConfirm,
  saving,
}: {
  session: OpenLabSession;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  saving: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Cancel Session
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Cancel the open lab on{' '}
          <span className="font-medium">{formatSessionDate(session.date)}</span>?
          {session.signups.filter(s => !s.cancelled_at).length > 0 && (
            <span className="text-red-600 dark:text-red-400 block mt-1">
              {session.signups.filter(s => !s.cancelled_at).length} student(s) are currently signed up.
            </span>
          )}
        </p>
        <div className="mb-4">
          <label
            htmlFor="cancelReason"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Reason (optional)
          </label>
          <input
            id="cancelReason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Holiday, instructor unavailable"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Keep Session
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={saving}
            className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Cancel Session
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function OpenLabManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sessions, setSessions] = useState<OpenLabSession[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState<OpenLabSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auth + role check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated' && session?.user?.email) {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((data) => {
          const user = data.user || data;
          setCurrentUser(user);
          if (!canAccessAdmin(user.role)) {
            router.push('/');
          }
        })
        .catch(() => router.push('/'));
    }
  }, [status, session, router]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/open-labs');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || data || []);
      }
    } catch {
      setError('Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchSessions();
  }, [currentUser, fetchSessions]);

  const handleToggleExpand = (sessionId: string) => {
    setExpandedSession(expandedSession === sessionId ? null : sessionId);
  };

  // Cancel a session
  const handleCancelSession = async (reason: string) => {
    if (!cancelModal) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/open-labs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cancelModal.id,
          is_cancelled: true,
          cancellation_reason: reason || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to cancel session.');
      setCancelModal(null);
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel.');
    } finally {
      setSaving(false);
    }
  };

  // Restore a session
  const handleRestore = async (sessionId: string) => {
    try {
      const res = await fetch('/api/admin/open-labs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          is_cancelled: false,
          cancellation_reason: null,
        }),
      });
      if (!res.ok) throw new Error('Failed to restore session.');
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore.');
    }
  };

  // Export
  const handleExport = (sessionId?: string) => {
    const url = sessionId
      ? `/api/admin/open-labs/export?session_id=${sessionId}`
      : '/api/admin/open-labs/export';
    window.open(url, '_blank');
  };

  if (status === 'loading' || loading || !currentUser) {
    return <PageLoader message="Loading open labs..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Breadcrumbs
        customSegments={{ 'admin/open-labs': 'Open Labs' }}
        className="mb-4"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Open Lab Management
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/open-labs/qr-code"
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <QrCode className="w-4 h-4" />
            QR Code
          </Link>
          <button
            onClick={() => handleExport()}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export All CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Sessions */}
      {sessions.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No upcoming open lab sessions.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${
                sess.is_cancelled
                  ? 'border-red-200 dark:border-red-800/50'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Session header */}
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        sess.is_cancelled
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : 'bg-emerald-100 dark:bg-emerald-900/30'
                      }`}
                    >
                      <Calendar
                        className={`w-5 h-5 ${
                          sess.is_cancelled
                            ? 'text-red-500'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-semibold ${
                            sess.is_cancelled
                              ? 'text-gray-500 dark:text-gray-400 line-through'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {formatSessionDate(sess.date)}
                        </h3>
                        {sess.is_cancelled && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{sess.start_time} &ndash; {sess.end_time}</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {sess.signups.filter(s => !s.cancelled_at).length} signup{sess.signups.filter(s => !s.cancelled_at).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {sess.cancellation_reason && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Reason: {sess.cancellation_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {sess.is_cancelled ? (
                      <button
                        onClick={() => handleRestore(sess.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => setCancelModal(sess)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel This Date
                      </button>
                    )}
                    {sess.signups.filter(s => !s.cancelled_at).length > 0 && (
                      <button
                        onClick={() => handleExport(sess.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleExpand(sess.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      {expandedSession === sess.id ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Hide Signups
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          View Signups
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded signups table */}
              {expandedSession === sess.id && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {sess.signups.filter(s => !s.cancelled_at).length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No signups for this session.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700/50">
                            <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                              Student
                            </th>
                            <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                              Email
                            </th>
                            <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                              Level
                            </th>
                            <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                              Working On
                            </th>
                            <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                              Instructor
                            </th>
                            <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                              Signed Up
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {sess.signups.filter(s => !s.cancelled_at).map((su) => (
                            <tr
                              key={su.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                            >
                              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                {su.student_name}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {su.student_email}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  {su.program_level}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                {su.what_to_work_on}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {su.requested_instructor?.name || '—'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {formatTimestamp(su.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cancel modal */}
      {cancelModal && (
        <CancelModal
          session={cancelModal}
          onClose={() => setCancelModal(null)}
          onConfirm={handleCancelSession}
          saving={saving}
        />
      )}
    </div>
  );
}
