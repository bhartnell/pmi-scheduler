'use client';

/**
 * Student Peer Evaluation Page
 *
 * Students can:
 * - See peers in their cohort that they need to evaluate
 * - Submit star-rated evaluations (communication, teamwork, leadership + comments)
 * - Optionally include a self-evaluation
 * - View their submitted evaluations (read-only) and scores they have received
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Star,
  Users,
  Home,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Send,
  X,
  MessageSquare,
  BarChart2,
  UserCheck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentBasic {
  id: string;
  first_name: string;
  last_name: string;
  cohort_id: string | null;
}

interface LabDay {
  id: string;
  date: string;
  title: string | null;
}

interface EvalGiven {
  id: string;
  lab_day_id: string | null;
  is_self_eval: boolean;
  communication_score: number;
  teamwork_score: number;
  leadership_score: number;
  comments: string | null;
  created_at: string;
  evaluated: { id: string; first_name: string; last_name: string } | null;
  lab_day: LabDay | null;
}

interface EvalReceived {
  id: string;
  lab_day_id: string | null;
  is_self_eval: boolean;
  communication_score: number;
  teamwork_score: number;
  leadership_score: number;
  comments: string | null;
  created_at: string;
  lab_day: LabDay | null;
}

interface CohortPeer {
  id: string;
  first_name: string;
  last_name: string;
}

interface EvalFormState {
  peerId: string;
  peerName: string;
  isSelf: boolean;
  communication: number;
  teamwork: number;
  leadership: number;
  comments: string;
  labDayId: string;
}

// ─── Star Rating Component ─────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  label,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  label: string;
  readOnly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-400 w-32 shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => !readOnly && setHovered(0)}
            className={`transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
            aria-label={`${star} star${star !== 1 ? 's' : ''} for ${label}`}
          >
            <Star
              className={`w-6 h-6 ${
                star <= (hovered || value)
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">
            {value}/5
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 4
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : score >= 3
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';

  return (
    <div className={`flex flex-col items-center p-2 rounded-lg ${color}`}>
      <span className="text-lg font-bold">{score}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentPeerEvalPage() {
  const { data: session } = useSession();

  const [student, setStudent] = useState<StudentBasic | null>(null);
  const [peers, setPeers] = useState<CohortPeer[]>([]);
  const [given, setGiven] = useState<EvalGiven[]>([]);
  const [received, setReceived] = useState<EvalReceived[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EvalFormState>({
    peerId: '',
    peerName: '',
    isSelf: false,
    communication: 0,
    teamwork: 0,
    leadership: 0,
    comments: '',
    labDayId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // UI toggles
  const [showGiven, setShowGiven] = useState(true);
  const [showReceived, setShowReceived] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      loadData();
    }
  }, [session]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load evaluations (given + received) and student info
      const evalRes = await fetch('/api/peer-evaluations');
      const evalData = await evalRes.json();

      if (evalData.success) {
        setStudent(evalData.student);
        setGiven(evalData.given || []);
        setReceived(evalData.received || []);

        // Load cohort peers if we have a cohort
        if (evalData.student?.cohort_id) {
          const peersRes = await fetch(
            `/api/lab-management/students?cohortId=${evalData.student.cohort_id}&status=active`
          );
          const peersData = await peersRes.json();
          if (peersData.students) {
            // Exclude self from peer list
            setPeers(
              peersData.students.filter((p: CohortPeer) => p.id !== evalData.student.id)
            );
          }
        }

        // Load recent lab days for the student's cohort
        if (evalData.student?.cohort_id) {
          const labDaysRes = await fetch(
            `/api/lab-management/lab-days?cohortId=${evalData.student.cohort_id}&limit=10`
          );
          const labDaysData = await labDaysRes.json();
          if (labDaysData.data) {
            // Sort newest first
            const sorted = [...labDaysData.data].sort(
              (a: LabDay, b: LabDay) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setLabDays(sorted.slice(0, 10));
          }
        }
      }
    } catch (err) {
      console.error('Error loading peer eval data:', err);
    }
    setLoading(false);
  };

  const openFormFor = (peer: CohortPeer | null, isSelf = false) => {
    setForm({
      peerId: peer?.id || (student?.id ?? ''),
      peerName: peer
        ? `${peer.first_name} ${peer.last_name}`
        : student
        ? `${student.first_name} ${student.last_name} (You)`
        : '',
      isSelf,
      communication: 0,
      teamwork: 0,
      leadership: 0,
      comments: '',
      labDayId: labDays[0]?.id || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.isSelf && !form.peerId) {
      setFormError('Please select a peer to evaluate.');
      return;
    }
    if (form.communication === 0 || form.teamwork === 0 || form.leadership === 0) {
      setFormError('Please provide all three ratings before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/peer-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: form.labDayId || null,
          evaluated_student_id: form.peerId,
          is_self_eval: form.isSelf,
          communication_score: form.communication,
          teamwork_score: form.teamwork,
          leadership_score: form.leadership,
          comments: form.comments.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          form.isSelf
            ? 'Self-evaluation submitted successfully.'
            : `Evaluation for ${form.peerName} submitted.`,
          'success'
        );
        setShowForm(false);
        loadData();
      } else {
        setFormError(data.error || 'Failed to submit evaluation.');
      }
    } catch (err) {
      setFormError('An unexpected error occurred. Please try again.');
    }
    setSubmitting(false);
  };

  // Check if a peer already has a given eval (for current lab day)
  const alreadyEvaluated = (peerId: string) =>
    given.some(
      e => e.evaluated?.id === peerId && (!form.labDayId || e.lab_day_id === form.labDayId)
    );

  const hasSelfEval = given.some(e => e.is_self_eval);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
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
        <span className="text-gray-700 dark:text-gray-300">Peer Evaluations</span>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
            <Users className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Peer Evaluations</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Rate your teammates and track how others rate you
            </p>
          </div>
        </div>
      </div>

      {/* No student record warning */}
      {!student && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-200">Student Record Not Found</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Your account is not yet linked to a student record. Please contact your instructor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-cyan-200 dark:border-cyan-800 mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {form.isSelf ? 'Self-Evaluation' : `Evaluating: ${form.peerName}`}
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Form Error */}
            {formError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
              </div>
            )}

            {/* Lab Day Selector */}
            {labDays.length > 0 && (
              <div>
                <label
                  htmlFor="lab-day-select"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Lab Day <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  id="lab-day-select"
                  value={form.labDayId}
                  onChange={e => setForm(f => ({ ...f, labDayId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Not tied to a specific lab day --</option>
                  {labDays.map(ld => (
                    <option key={ld.id} value={ld.id}>
                      {new Date(ld.date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {ld.title ? ` - ${ld.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Ratings */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ratings <span className="text-red-500">*</span>
              </p>
              <StarRating
                value={form.communication}
                onChange={v => setForm(f => ({ ...f, communication: v }))}
                label="Communication"
              />
              <StarRating
                value={form.teamwork}
                onChange={v => setForm(f => ({ ...f, teamwork: v }))}
                label="Teamwork"
              />
              <StarRating
                value={form.leadership}
                onChange={v => setForm(f => ({ ...f, leadership: v }))}
                label="Leadership"
              />
            </div>

            {/* Rating Legend */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Rating Guide</p>
              <div className="grid grid-cols-5 gap-1 text-xs text-gray-500 dark:text-gray-400 text-center">
                {['1 Needs Work', '2 Developing', '3 Competent', '4 Proficient', '5 Excellent'].map((l, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="leading-tight">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <label
                htmlFor="eval-comments"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Comments{' '}
                <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                id="eval-comments"
                value={form.comments}
                onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                rows={3}
                placeholder="Share specific observations or feedback..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit Evaluation'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cohort Peers - Evaluation Targets */}
      {student && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Evaluate a Peer</h2>
              </div>
              <span className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-1 rounded-full">
                {peers.length} peers
              </span>
            </div>
          </div>
          <div className="p-4">
            {peers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                  <Users className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No cohort peers found. Your cohort may not be assigned yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {peers.map(peer => {
                  const evaluated = given.some(e => e.evaluated?.id === peer.id && !e.is_self_eval);
                  return (
                    <div
                      key={peer.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center text-sm font-semibold text-cyan-700 dark:text-cyan-400">
                          {peer.first_name[0]}{peer.last_name[0]}
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {peer.first_name} {peer.last_name}
                        </span>
                      </div>
                      {evaluated ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Evaluated
                        </span>
                      ) : (
                        <button
                          onClick={() => openFormFor(peer)}
                          disabled={showForm}
                          className="text-xs px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                        >
                          Evaluate
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Self-Evaluation CTA */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Self-Evaluation
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Rate your own performance
                  </span>
                </div>
                {hasSelfEval ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Submitted
                  </span>
                ) : (
                  <button
                    onClick={() => openFormFor(null, true)}
                    disabled={showForm}
                    className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                  >
                    Evaluate Yourself
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluations Given */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
        <button
          onClick={() => setShowGiven(v => !v)}
          className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Evaluations Given</h2>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {given.length}
            </span>
          </div>
          {showGiven ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {showGiven && (
          <div className="p-4">
            {given.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                  <Send className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No evaluations submitted yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {given.map(ev => (
                  <EvalCard
                    key={ev.id}
                    type="given"
                    eval={ev}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evaluations Received */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <button
          onClick={() => setShowReceived(v => !v)}
          className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Feedback Received</h2>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
              {received.filter(e => !e.is_self_eval).length}
            </span>
          </div>
          {showReceived ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {showReceived && (
          <div className="p-4">
            {received.filter(e => !e.is_self_eval).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                  <BarChart2 className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No peer evaluations received yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {received
                  .filter(e => !e.is_self_eval)
                  .map(ev => (
                    <EvalCard key={ev.id} type="received" eval={ev} />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Eval Card ─────────────────────────────────────────────────────────────────

function EvalCard({
  type,
  eval: ev,
}: {
  type: 'given' | 'received';
  eval: EvalGiven | EvalReceived;
}) {
  const evGiven = ev as EvalGiven;

  const heading =
    type === 'given'
      ? ev.is_self_eval
        ? 'Self-Evaluation'
        : `To: ${evGiven.evaluated?.first_name} ${evGiven.evaluated?.last_name}`
      : 'From: Anonymous Peer';

  const labDayLabel = ev.lab_day
    ? new Date(ev.lab_day.date + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) + (ev.lab_day.title ? ` - ${ev.lab_day.title}` : '')
    : null;

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{heading}</p>
          {labDayLabel && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{labDayLabel}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
          {new Date(ev.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Scores */}
      <div className="flex gap-3 mb-3">
        <ScoreBadge score={ev.communication_score} label="Comm." />
        <ScoreBadge score={ev.teamwork_score} label="Team." />
        <ScoreBadge score={ev.leadership_score} label="Lead." />
        <div className="flex flex-col items-center p-2 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
          <span className="text-lg font-bold">
            {(
              (ev.communication_score + ev.teamwork_score + ev.leadership_score) /
              3
            ).toFixed(1)}
          </span>
          <span className="text-xs">Avg.</span>
        </div>
      </div>

      {/* Stars display */}
      <div className="space-y-1">
        <StarRating value={ev.communication_score} label="Communication" readOnly />
        <StarRating value={ev.teamwork_score} label="Teamwork" readOnly />
        <StarRating value={ev.leadership_score} label="Leadership" readOnly />
      </div>

      {/* Comments */}
      {ev.comments && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">&ldquo;{ev.comments}&rdquo;</p>
          </div>
        </div>
      )}
    </div>
  );
}
