'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { ThemeToggle } from '@/components/ThemeToggle';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { CurrentUser } from '@/types';

interface EmailLogEntry {
  id: string;
  to_email: string;
  subject: string;
  template: string;
  status: string;
  error: string | null;
  resend_id: string | null;
  created_at: string;
  sent_at: string | null;
}

interface PendingEvaluation {
  id: string;
  evaluation_type: string;
  result: string;
  email_status: string;
  created_at: string;
  student: { first_name: string; last_name: string } | null;
  skill_sheet: { skill_name: string } | null;
  lab_day: { id: string; date: string } | null;
}

const TEMPLATE_LABELS: Record<string, string> = {
  skill_evaluation: 'Skill Evaluation',
  scenario_feedback: 'Scenario Feedback',
  task_assigned: 'Task Assigned',
  task_completed: 'Task Completed',
  lab_assigned: 'Lab Assignment',
  lab_reminder: 'Lab Reminder',
  shift_available: 'Shift Available',
  shift_confirmed: 'Shift Confirmed',
  general: 'General',
};

function formatTemplate(template: string): string {
  return TEMPLATE_LABELS[template] || template.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'sent':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-yellow-500" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'sent':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
}

const PAGE_SIZE = 20;

export default function EmailHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const effectiveRole = useEffectiveRole(currentUser?.role ?? null);
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [pendingEvals, setPendingEvals] = useState<PendingEvaluation[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendingAll, setResendingAll] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (effectiveRole && !hasMinRole(effectiveRole, 'instructor')) {
      router.push('/');
    }
  }, [effectiveRole, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get user info
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success) {
        setCurrentUser(userData.user);
      }

      // Get email history
      const res = await fetch(`/api/instructor/email-history?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails);
        setTotal(data.total);
        setPendingEvals(data.pending_evaluations || []);
      }
    } catch (err) {
      console.error('Error loading email history:', err);
    }
    setLoading(false);
  }, [offset]);

  useEffect(() => {
    if (session?.user?.email) {
      loadData();
    }
  }, [session, loadData]);

  const handleResendEmail = async (emailId: string) => {
    setResendingId(emailId);
    setMessage(null);
    try {
      const res = await fetch('/api/instructor/email-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend_email', email_id: emailId }),
      });
      const data = await res.json();
      setMessage({
        text: data.message || (data.success ? 'Email resent' : 'Failed to resend'),
        type: data.success ? 'success' : 'error',
      });
      if (data.success) {
        await loadData();
      }
    } catch {
      setMessage({ text: 'Failed to resend email', type: 'error' });
    }
    setResendingId(null);
  };

  const handleResendPendingResults = async () => {
    if (!confirm(`Resend ${pendingEvals.length} pending evaluation result(s)? Students will receive email notifications.`)) {
      return;
    }
    setResendingAll(true);
    setMessage(null);
    try {
      const res = await fetch('/api/instructor/email-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend_pending_results' }),
      });
      const data = await res.json();
      setMessage({
        text: data.message || (data.success ? 'Results sent' : 'Failed to send'),
        type: data.success && data.errors === 0 ? 'success' : 'error',
      });
      if (data.success) {
        await loadData();
      }
    } catch {
      setMessage({ text: 'Failed to resend results', type: 'error' });
    }
    setResendingAll(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                Email History
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                View sent and failed emails, resend notifications
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadData()}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto text-sm underline">Dismiss</button>
          </div>
        )}

        {/* Pending Results Section */}
        {pendingEvals.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Pending Evaluation Results ({pendingEvals.length})
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  These evaluation results have not been emailed to students yet.
                </p>
              </div>
              <button
                onClick={handleResendPendingResults}
                disabled={resendingAll}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
              >
                {resendingAll ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Resend All Pending Results
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {pendingEvals.slice(0, 10).map((ev) => (
                <div key={ev.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {ev.skill_sheet?.skill_name || 'Evaluation'} — {ev.student?.first_name} {ev.student?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {ev.evaluation_type === 'formative' ? 'Formative' : 'Final'} | Result: {ev.result?.toUpperCase()} | {ev.lab_day?.date ? new Date(ev.lab_day.date + 'T12:00:00').toLocaleDateString() : new Date(ev.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(ev.email_status)}`}>
                    {ev.email_status}
                  </span>
                </div>
              ))}
              {pendingEvals.length > 10 && (
                <div className="px-4 py-2 text-center text-sm text-gray-500 dark:text-gray-400">
                  +{pendingEvals.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Email History Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Recent Emails ({total})
            </h2>
          </div>

          {emails.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No email history found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {emails.map((email) => (
                      <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {new Date(email.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          <br />
                          <span className="text-xs text-gray-400">
                            {new Date(email.created_at).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {formatTemplate(email.template)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                          {email.subject}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(email.status)}
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(email.status)}`}>
                              {email.status}
                            </span>
                          </div>
                          {email.error && (
                            <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={email.error}>
                              {email.error}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {email.status === 'failed' && (
                            <button
                              onClick={() => handleResendEmail(email.id)}
                              disabled={resendingId === email.id}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm flex items-center gap-1 ml-auto disabled:opacity-50"
                              title="Resend this email"
                            >
                              {resendingId === email.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              Resend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages} ({total} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                      disabled={offset === 0}
                      className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <button
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                      disabled={offset + PAGE_SIZE >= total}
                      className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
