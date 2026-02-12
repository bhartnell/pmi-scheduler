'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home,
  ClipboardCheck,
  Check,
  X,
  Clock,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { formatTime } from '@/types/scheduling';

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PendingSignup {
  id: string;
  shift_id: string;
  instructor_id: string;
  status: string;
  is_partial_shift: boolean;
  requested_start_time: string | null;
  requested_end_time: string | null;
  notes: string | null;
  created_at: string;
  shift?: {
    id: string;
    title: string;
    date: string;
    start_time: string;
    end_time: string;
    department: string;
    location: string;
  };
  instructor?: {
    id: string;
    name: string;
    email: string;
  };
}

export default function PendingSignupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signups, setSignups] = useState<PendingSignup[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [declineModal, setDeclineModal] = useState<{ signup: PendingSignup | null; reason: string }>({
    signup: null,
    reason: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  useEffect(() => {
    if (currentUser) {
      // Check if user is director
      const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
      if (!isAdmin) {
        alert('Only directors can view pending signups');
        router.push('/scheduling');
        return;
      }
      fetchPendingSignups();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  const fetchPendingSignups = async () => {
    try {
      const res = await fetch('/api/scheduling/signups/pending');
      const data = await res.json();
      if (data.success) {
        setSignups(data.signups || []);
      }
    } catch (error) {
      console.error('Error fetching pending signups:', error);
    }
  };

  const handleConfirm = async (signup: PendingSignup) => {
    setProcessing(signup.id);
    setError(null);

    try {
      const res = await fetch(`/api/scheduling/shifts/${signup.shift_id}/signup/${signup.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Confirmed ${signup.instructor?.name}'s signup for ${signup.shift?.title}`);
        // Remove from list
        setSignups(prev => prev.filter(s => s.id !== signup.id));
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Failed to confirm signup');
      }
    } catch (error) {
      console.error('Error confirming signup:', error);
      setError('Failed to confirm signup');
    }

    setProcessing(null);
  };

  const handleDecline = async () => {
    if (!declineModal.signup || !declineModal.reason.trim()) {
      setError('Please provide a reason for declining');
      return;
    }

    setProcessing(declineModal.signup.id);
    setError(null);

    try {
      const res = await fetch(`/api/scheduling/shifts/${declineModal.signup.shift_id}/signup/${declineModal.signup.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', reason: declineModal.reason })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Declined ${declineModal.signup.instructor?.name}'s signup`);
        // Remove from list
        setSignups(prev => prev.filter(s => s.id !== declineModal.signup!.id));
        setDeclineModal({ signup: null, reason: '' });
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Failed to decline signup');
      }
    } catch (error) {
      console.error('Error declining signup:', error);
      setError('Failed to decline signup');
    }

    setProcessing(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
              </Link>
            </div>
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
            <span className="text-gray-400">/</span>
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scheduling
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">Pending Signups</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Signups</h1>
            <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Director View</span>
            {signups.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500 text-white rounded-full">{signups.length}</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="w-5 h-5" />
            {successMessage}
          </div>
        )}

        {/* Signups List */}
        {signups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <ClipboardCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Pending Signups</h3>
            <p className="text-gray-500 dark:text-gray-400">All shift signups have been reviewed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {signups.map(signup => {
              const shift = signup.shift;
              const instructor = signup.instructor;
              const isPartial = signup.is_partial_shift;

              return (
                <div
                  key={signup.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Signup Info */}
                    <div className="flex-1">
                      {/* Instructor */}
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {instructor?.name || 'Unknown'}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {instructor?.email}
                        </span>
                      </div>

                      {/* Shift Details */}
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-3">
                        <div className="font-medium text-gray-900 dark:text-white mb-1">
                          {shift?.title || 'Unknown Shift'}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {shift?.date ? formatDate(shift.date) : 'Unknown Date'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {shift?.start_time && shift?.end_time
                              ? `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`
                              : 'Unknown Time'}
                          </span>
                          {shift?.department && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                              {shift.department}
                            </span>
                          )}
                          {shift?.location && (
                            <span className="text-gray-500">{shift.location}</span>
                          )}
                        </div>
                      </div>

                      {/* Partial Shift Info */}
                      {isPartial && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                            Partial Shift
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {signup.requested_start_time && signup.requested_end_time
                              ? `${formatTime(signup.requested_start_time)} - ${formatTime(signup.requested_end_time)}`
                              : 'Custom times requested'}
                          </span>
                        </div>
                      )}

                      {/* Notes */}
                      {signup.notes && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Notes:</span> {signup.notes}
                        </div>
                      )}

                      {/* Signup Time */}
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                        Signed up: {new Date(signup.created_at).toLocaleString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConfirm(signup)}
                        disabled={processing === signup.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {processing === signup.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeclineModal({ signup, reason: '' })}
                        disabled={processing === signup.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Decline Modal */}
      {declineModal.signup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Decline Signup
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You are declining <strong>{declineModal.signup.instructor?.name}</strong>'s signup for{' '}
              <strong>{declineModal.signup.shift?.title}</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason for declining <span className="text-red-500">*</span>
              </label>
              <textarea
                value={declineModal.reason}
                onChange={e => setDeclineModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Please provide a reason..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeclineModal({ signup: null, reason: '' })}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={!declineModal.reason.trim() || processing === declineModal.signup.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {processing === declineModal.signup.id ? 'Declining...' : 'Decline Signup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
