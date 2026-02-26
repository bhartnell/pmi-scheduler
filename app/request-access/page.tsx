'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  Stethoscope,
  LogOut,
  Mail,
  Shield,
  Loader2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AccessRequestStatus {
  hasAccess: boolean;
  role?: string;
  request: {
    id: string;
    status: 'pending' | 'approved' | 'denied';
    denial_reason: string | null;
    created_at: string;
    reviewed_at: string | null;
  } | null;
}

type PageState = 'loading' | 'form' | 'pending' | 'denied' | 'submitted';

export default function RequestAccessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [requestData, setRequestData] = useState<AccessRequestStatus['request']>(null);

  // Form fields
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Redirect unauthenticated users to the sign-in page
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Once session is available, check if the user already has access or a request
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      // Pre-fill name from Google session
      setName(session.user.name || '');
      checkStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  async function checkStatus() {
    try {
      const res = await fetch('/api/access-requests/status');
      const data = await res.json();

      if (!data.success) {
        setPageState('form');
        return;
      }

      if (data.hasAccess) {
        // User already has a lab_users entry - redirect to home
        router.push('/');
        return;
      }

      if (!data.request) {
        // No prior request - show the form
        setPageState('form');
        return;
      }

      setRequestData(data.request);

      if (data.request.status === 'pending') {
        setPageState('pending');
      } else if (data.request.status === 'denied') {
        setPageState('denied');
      } else if (data.request.status === 'approved') {
        // Approved but no lab_users entry yet? Shouldn't happen normally,
        // but redirect to home so NextAuth can handle it.
        router.push('/');
      } else {
        setPageState('form');
      }
    } catch (err) {
      console.error('Error checking access request status:', err);
      setPageState('form');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.email) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session.user.email,
          name: name.trim() || session.user.email.split('@')[0],
          reason: reason.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Failed to submit request. Please try again.');
        return;
      }

      setPageState('submitted');
    } catch (err) {
      console.error('Error submitting access request:', err);
      setSubmitError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' || pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">PMI Paramedic Tools</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              {session.user?.email}
            </span>
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-16">
        {/* ---- Form state ---- */}
        {(pageState === 'form') && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Request Access</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                Your Google account is not yet authorized. Fill out the form below and an
                administrator will review your request.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Email - read-only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {session.user?.email}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  From your Google account
                </p>
              </div>

              {/* Role - read-only display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Requested Role
                </label>
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-sm">
                  <Shield className="w-4 h-4 text-teal-500" />
                  Volunteer Instructor
                </div>
              </div>

              {/* Reason / Affiliation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason / Affiliation{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Former paramedic, wanting to help with lab instruction..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Error */}
              {submitError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Submit Request
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ---- Submitted state ---- */}
        {pageState === 'submitted' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Request Submitted</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your request has been submitted. An administrator will review it shortly. You will be
              able to sign in once your access has been approved.
            </p>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="mt-6 flex items-center gap-2 mx-auto px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}

        {/* ---- Pending state ---- */}
        {pageState === 'pending' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Request Pending
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your access request has been received and is awaiting admin review. You will be
              notified once a decision has been made.
            </p>
            {requestData?.created_at && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Submitted{' '}
                {new Date(requestData.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="mt-6 flex items-center gap-2 mx-auto px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}

        {/* ---- Denied state ---- */}
        {pageState === 'denied' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Request Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your access request was not approved. If you believe this is an error, please contact
              a PMI administrator directly.
            </p>
            {requestData?.denial_reason && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-left">
                <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Reason:</p>
                <p className="text-sm text-red-700 dark:text-red-400">{requestData.denial_reason}</p>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="mt-6 flex items-center gap-2 mx-auto px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
