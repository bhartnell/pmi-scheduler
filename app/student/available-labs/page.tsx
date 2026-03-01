'use client';

/**
 * Student Available Labs Page
 *
 * Allows students to:
 * - Browse upcoming lab days with open spots
 * - Sign up for a lab (confirmed) or join the waitlist if full
 * - View their own scheduled and waitlisted labs
 * - Cancel a signup (with reason, subject to 24-hour deadline)
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Home,
  ChevronRight,
  Search,
  Plus,
  X,
  ClipboardList,
  CalendarCheck,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LabCohort {
  id: string;
  cohort_number: string;
  program: { name: string; abbreviation: string } | null;
}

interface AvailableLab {
  id: string;
  date: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  cohort: LabCohort | null;
  capacity: number;
  confirmed_count: number;
  waitlisted_count: number;
  spots_remaining: number;
  is_full: boolean;
  my_signup: {
    id: string;
    status: 'confirmed' | 'waitlisted';
    waitlist_position: number | null;
  } | null;
}

interface MySignup {
  id: string;
  lab_day_id: string;
  status: 'confirmed' | 'waitlisted' | 'cancelled';
  waitlist_position: number | null;
  signed_up_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  lab_day: {
    id: string;
    date: string;
    title: string | null;
    start_time: string | null;
    end_time: string | null;
    notes: string | null;
    cohort: LabCohort | null;
  } | null;
}

interface MySignups {
  upcoming: MySignup[];
  past: MySignup[];
  cancelled: MySignup[];
}

type TabType = 'available' | 'my-schedule';

// ─── Helper functions ─────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  if (start && end) return `${formatTime(start)} - ${formatTime(end)}`;
  if (start) return `Starts ${formatTime(start)}`;
  return '';
}

function hoursUntilLab(date: string, startTime: string | null): number {
  const labDateTime = new Date(`${date}T${startTime || '08:00'}`);
  return (labDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentAvailableLabsPage() {
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState<TabType>('available');
  const [availableLabs, setAvailableLabs] = useState<AvailableLab[]>([]);
  const [mySignups, setMySignups] = useState<MySignups>({ upcoming: [], past: [], cancelled: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Cancel dialog state
  const [cancelDialog, setCancelDialog] = useState<{
    signupId: string;
    labTitle: string;
    labDate: string;
    labStartTime: string | null;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchAvailableLabs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);

      const res = await fetch(`/api/student/available-labs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAvailableLabs(data.labs || []);
      }
    } catch (err) {
      console.error('Error fetching available labs:', err);
    }
  }, [startDate, endDate, search]);

  const fetchMySignups = useCallback(async () => {
    try {
      const res = await fetch('/api/student/available-labs/my-signups');
      const data = await res.json();
      if (data.success) {
        setMySignups(data.signups);
      }
    } catch (err) {
      console.error('Error fetching my signups:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchAvailableLabs(), fetchMySignups()]);
    setLoading(false);
  }, [fetchAvailableLabs, fetchMySignups]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchAll();
    }
  }, [session, fetchAll]);

  // Re-fetch available labs when filters change (with slight debounce for search)
  useEffect(() => {
    if (!session?.user?.email) return;
    const timer = setTimeout(() => {
      fetchAvailableLabs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, startDate, endDate, session, fetchAvailableLabs]);

  const handleSignUp = async (labId: string) => {
    setActionLoading(labId);
    try {
      const res = await fetch('/api/student/available-labs/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: labId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        await Promise.all([fetchAvailableLabs(), fetchMySignups()]);
      } else {
        showToast(data.error || 'Failed to sign up', 'error');
      }
    } catch (err) {
      console.error('Error signing up:', err);
      showToast('An unexpected error occurred', 'error');
    }
    setActionLoading(null);
  };

  const openCancelDialog = (signup: MySignup) => {
    const labDay = signup.lab_day;
    setCancelDialog({
      signupId: signup.id,
      labTitle: labDay?.title || 'Lab Day',
      labDate: labDay?.date || '',
      labStartTime: labDay?.start_time || null,
    });
    setCancelReason('');
    setCancelError(null);
  };

  const handleCancelConfirm = async () => {
    if (!cancelDialog) return;
    setCancelError(null);
    setActionLoading(cancelDialog.signupId);

    try {
      const res = await fetch('/api/student/available-labs/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signup_id: cancelDialog.signupId,
          cancel_reason: cancelReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Signup cancelled successfully.', 'success');
        setCancelDialog(null);
        await Promise.all([fetchAvailableLabs(), fetchMySignups()]);
      } else {
        setCancelError(data.error || 'Failed to cancel signup');
      }
    } catch (err) {
      console.error('Error cancelling:', err);
      setCancelError('An unexpected error occurred');
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const upcomingCount = mySignups.upcoming.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white max-w-sm ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Cancel Dialog */}
      {cancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Cancel Signup</h3>
              <button
                onClick={() => setCancelDialog(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to cancel your signup for{' '}
                <span className="font-semibold">{cancelDialog.labTitle}</span> on{' '}
                <span className="font-semibold">{formatDateShort(cancelDialog.labDate)}</span>?
              </p>

              {cancelDialog.labDate &&
                hoursUntilLab(cancelDialog.labDate, cancelDialog.labStartTime) < 48 &&
                hoursUntilLab(cancelDialog.labDate, cancelDialog.labStartTime) >= 24 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This lab is less than 48 hours away. The cancellation deadline is 24 hours before the lab.
                    </p>
                  </div>
                )}

              {cancelError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{cancelError}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="cancel-reason"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Reason{' '}
                  <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Let your instructor know why you're cancelling..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleCancelConfirm}
                  disabled={actionLoading === cancelDialog.signupId}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {actionLoading === cancelDialog.signupId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Cancel Signup
                </button>
                <button
                  onClick={() => setCancelDialog(null)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Keep My Spot
                </button>
              </div>
            </div>
          </div>
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
        <span className="text-gray-700 dark:text-gray-300">Available Labs</span>
      </div>

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
          <CalendarCheck className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Sign-Ups</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Browse and sign up for available lab sessions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'available'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Available Labs
          {availableLabs.length > 0 && (
            <span className="ml-1 text-xs bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 px-1.5 py-0.5 rounded-full">
              {availableLabs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('my-schedule')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'my-schedule'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          My Schedule
          {upcomingCount > 0 && (
            <span className="ml-1 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">
              {upcomingCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Available Labs Tab ─────────────────────────────────────────────── */}
      {activeTab === 'available' && (
        <div>
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search lab title or notes..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Date range */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  title="Start date"
                />
                <span className="text-gray-400 dark:text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  title="End date"
                />
                {(startDate || endDate || search) && (
                  <button
                    onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); }}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Clear filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lab Cards */}
          {availableLabs.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full inline-block mb-4">
                <CalendarDays className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Labs Found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {search || startDate || endDate
                  ? 'No labs match your current filters. Try adjusting the date range or search terms.'
                  : 'No upcoming lab days are available yet. Check back soon.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableLabs.map(lab => (
                <LabCard
                  key={lab.id}
                  lab={lab}
                  onSignUp={handleSignUp}
                  isLoading={actionLoading === lab.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Schedule Tab ────────────────────────────────────────────────── */}
      {activeTab === 'my-schedule' && (
        <div className="space-y-6">
          {/* Upcoming */}
          <section>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">Upcoming Labs</h2>
                </div>
                {mySignups.upcoming.length > 0 && (
                  <span className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-1 rounded-full font-medium">
                    {mySignups.upcoming.length} scheduled
                  </span>
                )}
              </div>
              <div className="p-4">
                {mySignups.upcoming.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                      <CalendarDays className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      You have no upcoming labs scheduled.
                    </p>
                    <button
                      onClick={() => setActiveTab('available')}
                      className="mt-3 flex items-center gap-1 text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      Browse available labs
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mySignups.upcoming.map(signup => (
                      <SignupCard
                        key={signup.id}
                        signup={signup}
                        onCancel={openCancelDialog}
                        isLoading={actionLoading === signup.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Past */}
          {mySignups.past.length > 0 && (
            <section>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Past Labs</h2>
                </div>
                <div className="p-4 space-y-3">
                  {mySignups.past.map(signup => (
                    <SignupCard
                      key={signup.id}
                      signup={signup}
                      onCancel={openCancelDialog}
                      isLoading={false}
                      isPast
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Cancelled */}
          {mySignups.cancelled.length > 0 && (
            <section>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="font-semibold text-gray-500 dark:text-gray-400">
                    Cancelled Signups
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {mySignups.cancelled.map(signup => (
                    <SignupCard
                      key={signup.id}
                      signup={signup}
                      onCancel={openCancelDialog}
                      isLoading={false}
                      isCancelled
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* All empty */}
          {mySignups.upcoming.length === 0 &&
            mySignups.past.length === 0 &&
            mySignups.cancelled.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full inline-block mb-4">
                  <CalendarDays className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No Lab Signups Yet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  You have not signed up for any labs. Browse the available labs to get started.
                </p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Browse Available Labs
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ─── Lab Card (Available tab) ─────────────────────────────────────────────────

function LabCard({
  lab,
  onSignUp,
  isLoading,
}: {
  lab: AvailableLab;
  onSignUp: (labId: string) => void;
  isLoading: boolean;
}) {
  const isSigned = lab.my_signup !== null;
  const isConfirmed = lab.my_signup?.status === 'confirmed';
  const isWaitlisted = lab.my_signup?.status === 'waitlisted';
  const capacityPct = Math.min(100, Math.round((lab.confirmed_count / lab.capacity) * 100));

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${
        isConfirmed
          ? 'border-green-500'
          : isWaitlisted
          ? 'border-amber-500'
          : lab.is_full
          ? 'border-gray-300 dark:border-gray-600'
          : 'border-cyan-500'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{lab.title}</h3>
              {lab.cohort && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                  Cohort {lab.cohort.cohort_number}
                  {lab.cohort.program && ` · ${lab.cohort.program.abbreviation}`}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                {formatDate(lab.date)}
              </span>
              {(lab.start_time || lab.end_time) && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  {formatTimeRange(lab.start_time, lab.end_time)}
                </span>
              )}
            </div>

            {/* Capacity bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {lab.confirmed_count} of {lab.capacity} spots filled
                  {lab.waitlisted_count > 0 && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">
                      · {lab.waitlisted_count} waitlisted
                    </span>
                  )}
                </span>
                <span
                  className={`font-medium ${
                    lab.is_full
                      ? 'text-red-600 dark:text-red-400'
                      : lab.spots_remaining <= 3
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {lab.is_full ? 'Full' : `${lab.spots_remaining} left`}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    capacityPct >= 100
                      ? 'bg-red-500'
                      : capacityPct >= 80
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
            </div>

            {lab.notes && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{lab.notes}</p>
            )}
          </div>

          {/* Action */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            {isSigned ? (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  isConfirmed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}
              >
                {isConfirmed ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Signed Up
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    Waitlisted #{lab.my_signup?.waitlist_position}
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => onSignUp(lab.id)}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                  lab.is_full
                    ? 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                    : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : lab.is_full ? (
                  <>
                    <Plus className="w-4 h-4" />
                    Join Waitlist
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Sign Up
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Signup Card (My Schedule tab) ───────────────────────────────────────────

function SignupCard({
  signup,
  onCancel,
  isLoading,
  isPast = false,
  isCancelled = false,
}: {
  signup: MySignup;
  onCancel: (signup: MySignup) => void;
  isLoading: boolean;
  isPast?: boolean;
  isCancelled?: boolean;
}) {
  const labDay = signup.lab_day;
  const title = labDay?.title || 'Lab Day';
  const date = labDay?.date || '';
  const hoursLeft = date ? hoursUntilLab(date, labDay?.start_time || null) : Infinity;
  const cancellationBlocked = hoursLeft < 24 && hoursLeft >= 0;

  const statusConfig = {
    confirmed: {
      label: 'Confirmed',
      badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      icon: CheckCircle,
      iconColor: 'text-green-600 dark:text-green-400',
    },
    waitlisted: {
      label: signup.waitlist_position
        ? `Waitlisted #${signup.waitlist_position}`
        : 'Waitlisted',
      badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      icon: Clock,
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    cancelled: {
      label: 'Cancelled',
      badge: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
      icon: XCircle,
      iconColor: 'text-gray-400 dark:text-gray-500',
    },
  } as const;

  const cfg = statusConfig[signup.status];
  const StatusIcon = cfg.icon;

  return (
    <div
      className={`p-4 rounded-lg border ${
        isCancelled
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 opacity-70'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
            {labDay?.cohort && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                Cohort {labDay.cohort.cohort_number}
              </span>
            )}
          </div>

          {date && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(date)}
              </span>
              {(labDay?.start_time || labDay?.end_time) && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTimeRange(labDay?.start_time || null, labDay?.end_time || null)}
                </span>
              )}
            </div>
          )}

          {/* Cancellation deadline warning */}
          {!isCancelled && !isPast && cancellationBlocked && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Cancellation deadline has passed (24h before lab)
            </div>
          )}
          {!isCancelled && !isPast && !cancellationBlocked && hoursLeft < 48 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Cancellation deadline: less than {Math.ceil(hoursLeft - 24)}h to cancel
            </div>
          )}

          {/* Cancel reason */}
          {isCancelled && signup.cancel_reason && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Reason: {signup.cancel_reason}
            </p>
          )}

          {isCancelled && signup.cancelled_at && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Cancelled {new Date(signup.cancelled_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
            {cfg.label}
          </span>

          {!isPast && !isCancelled && (
            <button
              onClick={() => onCancel(signup)}
              disabled={isLoading || cancellationBlocked}
              title={
                cancellationBlocked
                  ? 'Cancellation deadline has passed. Contact your instructor.'
                  : 'Cancel this signup'
              }
              className={`flex items-center gap-1 text-xs transition-colors px-2 py-1 rounded ${
                cancellationBlocked
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
