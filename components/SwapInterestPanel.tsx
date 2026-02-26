'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Hand,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  RefreshCw,
  UserCheck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type InterestStatus = 'interested' | 'selected' | 'declined';

interface SwapInterestRecord {
  id: string;
  swap_request_id: string;
  interested_by: string;
  status: InterestStatus;
  notes: string | null;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface SwapDetails {
  date: string;
  shift: string;
  original_instructor?: string;
}

interface SwapInterestPanelProps {
  swapRequestId: string;
  swapDetails: SwapDetails;
  userRole: string;
  userEmail: string;
}

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InterestStatus, {
  label: string;
  bg: string;
  text: string;
  icon: React.ReactNode;
}> = {
  interested: {
    label: 'Interested',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    icon: <Hand className="w-3 h-3" />,
  },
  selected: {
    label: 'Selected',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  declined: {
    label: 'Not Selected',
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
    icon: <XCircle className="w-3 h-3" />,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'superadmin';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SwapInterestPanel({
  swapRequestId,
  swapDetails,
  userRole,
  userEmail,
}: SwapInterestPanelProps) {
  const [interests, setInterests] = useState<SwapInterestRecord[]>([]);
  const [myInterest, setMyInterest] = useState<SwapInterestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = isAdminRole(userRole);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchInterests = useCallback(async () => {
    try {
      const res = await fetch(`/api/scheduling/swaps/${swapRequestId}/interest`);
      const data = await res.json();
      if (data.success) {
        setInterests(data.interests || []);
        setMyInterest(data.my_interest || null);
      }
    } catch (err) {
      console.error('Error fetching swap interests:', err);
    } finally {
      setLoading(false);
    }
  }, [swapRequestId]);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  // ── Clear transient messages ───────────────────────────────────────────────

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // ── Express interest ───────────────────────────────────────────────────────

  async function handleExpressInterest() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/scheduling/swaps/${swapRequestId}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesInput.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('You are now listed as interested. The requester and admins have been notified.');
        setShowNotesForm(false);
        setNotesInput('');
        await fetchInterests();
      } else {
        setError(data.error || 'Failed to express interest');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Withdraw interest ──────────────────────────────────────────────────────

  async function handleWithdraw() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/scheduling/swaps/${swapRequestId}/interest`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Your interest has been withdrawn.');
        await fetchInterests();
      } else {
        setError(data.error || 'Failed to withdraw interest');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Assign replacement (admin only) ───────────────────────────────────────

  async function handleAssign(interestId: string) {
    setAssigning(interestId);
    setError(null);
    try {
      const res = await fetch(`/api/scheduling/swaps/${swapRequestId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest_id: interestId }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(
          `Assignment confirmed. ${data.declined_count > 0 ? `${data.declined_count} other volunteer(s) have been notified.` : ''}`
        );
        await fetchInterests();
      } else {
        setError(data.error || 'Failed to assign replacement');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setAssigning(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const interestedCount = interests.filter((i) => i.status === 'interested').length;
  const selectedRecord = interests.find((i) => i.status === 'selected');
  const alreadyAssigned = !!selectedRecord;

  const currentUserEmail = userEmail.toLowerCase();
  const myCurrentInterest = myInterest;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Swap Volunteers
          </h3>
          {interestedCount > 0 && !alreadyAssigned && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {interestedCount} interested
            </span>
          )}
          {alreadyAssigned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-3 h-3" />
              Filled
            </span>
          )}
        </div>
        <button
          onClick={fetchInterests}
          disabled={loading}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Shift context pill */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">{swapDetails.shift}</span>
          <span>{swapDetails.date}</span>
          {swapDetails.original_instructor && (
            <span>Originally: {swapDetails.original_instructor}</span>
          )}
        </div>
      </div>

      {/* Feedback messages */}
      {(error || successMsg) && (
        <div className="px-4 pt-2">
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Interest list */}
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading volunteers...
          </div>
        ) : interests.length === 0 ? (
          <p className="py-3 text-sm text-gray-400 dark:text-gray-500 text-center">
            No volunteers yet
          </p>
        ) : (
          interests.map((interest) => {
            const cfg = STATUS_CONFIG[interest.status];
            const displayName = interest.user?.name || interest.interested_by.split('@')[0];
            const initials = getInitials(displayName);
            const isMe = interest.interested_by.toLowerCase() === currentUserEmail;
            const isBeingAssigned = assigning === interest.id;

            return (
              <div
                key={interest.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  interest.status === 'selected'
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : interest.status === 'declined'
                    ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700 opacity-60'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isMe
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {initials}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {displayName}
                      {isMe && (
                        <span className="ml-1 text-xs text-blue-500 font-normal">(you)</span>
                      )}
                    </span>

                    {/* Status badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>

                  {/* Notes */}
                  {interest.notes && (
                    <div className="mt-1 flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{interest.notes}</span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(interest.created_at)}
                  </div>
                </div>

                {/* Admin assign button */}
                {isAdmin && interest.status === 'interested' && !alreadyAssigned && (
                  <button
                    onClick={() => handleAssign(interest.id)}
                    disabled={isBeingAssigned || !!assigning}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
                  >
                    {isBeingAssigned ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserCheck className="w-3 h-3" />
                    )}
                    Assign
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Action area for current instructor */}
      {!alreadyAssigned && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
          {myCurrentInterest ? (
            /* Already interested — show withdraw option */
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                You are listed as a volunteer.
              </span>
              <button
                onClick={handleWithdraw}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                Withdraw
              </button>
            </div>
          ) : showNotesForm ? (
            /* Notes + submit form */
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Optional note (availability, constraints, etc.)
              </label>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="e.g. Available all day, prefer morning..."
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExpressInterest}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Hand className="w-3.5 h-3.5" />
                  )}
                  Submit
                </button>
                <button
                  onClick={() => {
                    setShowNotesForm(false);
                    setNotesInput('');
                    setError(null);
                  }}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Primary "I'm Interested" button */
            <button
              onClick={() => setShowNotesForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Hand className="w-4 h-4" />
              I&apos;m Interested in Covering This Shift
            </button>
          )}
        </div>
      )}

      {/* Filled state footer */}
      {alreadyAssigned && selectedRecord && (
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300">
            <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Assigned to{' '}
              <strong>
                {selectedRecord.user?.name || selectedRecord.interested_by.split('@')[0]}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
