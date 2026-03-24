'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Users,
  Loader2,
  Check,
  X,
  Search,
  Link as LinkIcon,
  Copy,
  Send,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';

interface AvailabilityRecord {
  id: string;
  student_id: string;
  cohort_id: string | null;
  semester_id: string | null;
  available_days: Record<string, boolean>;
  preferred_shift_type: string[];
  preferred_dates: string[];
  unavailable_dates: string[];
  notes: string | null;
  submitted_at: string;
  updated_at: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface SemesterOption {
  id: string;
  name: string;
}

interface PollRecord {
  id: string;
  cohort_id: string;
  semester_id: string | null;
  token: string;
  title: string;
  deadline: string | null;
  status: string;
  created_at: string;
}

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function RideAlongAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Poll state
  const [polls, setPolls] = useState<PollRecord[]>([]);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollCohort, setPollCohort] = useState('');
  const [pollSemester, setPollSemester] = useState('');
  const [pollTitle, setPollTitle] = useState('EMT Ride-Along Availability');
  const [pollDeadline, setPollDeadline] = useState('');
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [sendingPollId, setSendingPollId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ pollId: string; message: string; sent: number; failed: number; failedEmails?: string[] } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (session) fetchInitialData();
  }, [session]);

  useEffect(() => {
    if (selectedCohort) {
      fetchCohortData();
    }
  }, [selectedCohort]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) { router.push('/'); return; }
      }

      const [cohortsRes, availRes, pollsRes, semestersRes] = await Promise.all([
        fetch('/api/lab-management/cohorts'),
        fetch('/api/clinical/ride-alongs/availability'),
        fetch('/api/clinical/ride-alongs/polls'),
        fetch('/api/scheduling/planner/semesters?active_only=true'),
      ]);

      const cohortsData = await cohortsRes.json();
      setCohorts(cohortsData.cohorts || []);

      const availData = await availRes.json();
      setAvailability(availData.availability || []);

      const pollsData = await pollsRes.json();
      setPolls(pollsData.polls || []);

      const semestersData = await semestersRes.json();
      setSemesters(semestersData.semesters || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const fetchCohortData = async () => {
    try {
      const [studentsRes, availRes] = await Promise.all([
        fetch(`/api/students?cohortId=${selectedCohort}`),
        fetch(`/api/clinical/ride-alongs/availability?cohort_id=${selectedCohort}`),
      ]);

      const studentsData = await studentsRes.json();
      const availData = await availRes.json();

      setStudents(studentsData.students || []);
      setAvailability(availData.availability || []);
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    }
  };

  const getStudentAvailability = (studentId: string): AvailabilityRecord | undefined => {
    return availability.find(a => a.student_id === studentId);
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  const createPoll = async () => {
    if (!pollCohort) return;
    setCreatingPoll(true);
    try {
      const res = await fetch('/api/clinical/ride-alongs/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: pollCohort,
          semester_id: pollSemester || null,
          title: pollTitle || 'EMT Ride-Along Availability',
          deadline: pollDeadline || null,
        }),
      });
      const data = await res.json();
      if (data.success && data.poll) {
        setPolls(prev => [data.poll, ...prev]);
        setShowPollModal(false);
        setPollCohort('');
        setPollSemester('');
        setPollTitle('EMT Ride-Along Availability');
        setPollDeadline('');
      }
    } catch (error) {
      console.error('Error creating poll:', error);
    }
    setCreatingPoll(false);
  };

  const copyPollLink = (token: string) => {
    const url = `${window.location.origin}/ride-along-poll/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const sendPollEmails = async (pollId: string, mode: 'all' | 'non_responders') => {
    setSendingPollId(pollId);
    setSendResult(null);
    try {
      const res = await fetch(`/api/clinical/ride-alongs/polls/${pollId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.success) {
        const failedEmails = (data.results || [])
          .filter((r: { success: boolean }) => !r.success)
          .map((r: { email: string }) => r.email);
        setSendResult({
          pollId,
          sent: data.sent ?? 0,
          failed: data.failed ?? 0,
          failedEmails: failedEmails.length > 0 ? failedEmails : undefined,
          message: data.failed > 0
            ? `${data.sent} sent, ${data.failed} failed`
            : `${data.sent}/${data.total} emails sent successfully`,
        });
      } else {
        setSendResult({ pollId, sent: 0, failed: 0, message: data.error || 'Failed to send' });
      }
    } catch (error) {
      console.error('Error sending poll emails:', error);
      setSendResult({ pollId, sent: 0, failed: 0, message: 'Network error' });
    }
    setSendingPollId(null);
    // Keep result visible longer if there were failures so user can retry
  };

  const retryFailedEmails = async (pollId: string) => {
    // Retry by sending to all — the failed emails need resending
    // In practice, "non_responders" mode re-targets students who haven't submitted
    // But for a true retry of failed sends, we re-send to all
    await sendPollEmails(pollId, 'all');
  };

  const getCohortLabel = (cohortId: string) => {
    const c = cohorts.find(co => co.id === cohortId);
    return c ? `${c.program?.abbreviation} C${c.cohort_number}` : 'Unknown';
  };

  const getResponseCount = (poll: PollRecord): number => {
    // Count how many students in this cohort have availability
    if (!poll.cohort_id) return 0;
    return availability.filter(a => a.cohort_id === poll.cohort_id).length;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Availability</h1>
                <p className="text-gray-600 dark:text-gray-400">View and manage ride-along availability submissions</p>
              </div>
            </div>
            <button
              onClick={() => setShowPollModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Availability Poll
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Active Polls */}
        {polls.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-teal-600" />
              Availability Polls
            </h2>
            <div className="space-y-3">
              {polls.map(poll => (
                <div
                  key={poll.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {poll.title}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        poll.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : poll.status === 'closed'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {poll.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>{getCohortLabel(poll.cohort_id)}</span>
                      {poll.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {new Date(poll.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {sendResult?.pollId === poll.id && (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${
                          sendResult.failed > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {sendResult.failed > 0 ? (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {sendResult.message}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {sendResult.message}
                            </span>
                          )}
                        </span>
                        {sendResult.failed > 0 && (
                          <button
                            onClick={() => retryFailedEmails(poll.id)}
                            disabled={sendingPollId === poll.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            Retry
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => copyPollLink(poll.token)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                      title="Copy poll link"
                    >
                      {copiedToken === poll.token ? (
                        <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                      )}
                    </button>
                    <button
                      onClick={() => sendPollEmails(poll.id, 'all')}
                      disabled={sendingPollId === poll.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-100 dark:bg-teal-900/30 hover:bg-teal-200 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      title="Send to all students"
                    >
                      {sendingPollId === poll.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Send to All
                    </button>
                    <button
                      onClick={() => sendPollEmails(poll.id, 'non_responders')}
                      disabled={sendingPollId === poll.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      title="Resend to non-responders only"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Resend
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">-- Select Cohort --</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.program?.abbreviation} C{c.cohort_number}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              {selectedCohort && (
                <>
                  {availability.length} of {students.length} students submitted availability
                </>
              )}
            </div>
          </div>
        </div>

        {!selectedCohort ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view student availability</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Student</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Submitted</th>
                    {DAY_LABELS.map(d => (
                      <th key={d} className="px-2 py-3 text-center font-medium text-gray-700 dark:text-gray-300">{d}</th>
                    ))}
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Shift Pref</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Unavailable Dates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={10 + DAY_LABELS.length} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const avail = getStudentAvailability(student.id);
                      return (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {student.first_name} {student.last_name}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {avail ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full">
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </span>
                            )}
                          </td>
                          {DAY_NAMES.map(day => (
                            <td key={day} className="px-2 py-3 text-center">
                              {avail ? (
                                avail.available_days[day] === true ? (
                                  <span className="inline-block w-5 h-5 bg-green-500 rounded-sm" title="Available" />
                                ) : avail.available_days[day] === false ? (
                                  <span className="inline-block w-5 h-5 bg-red-400 rounded-sm" title="Unavailable" />
                                ) : (
                                  <span className="inline-block w-5 h-5 bg-gray-200 dark:bg-gray-600 rounded-sm" title="No preference" />
                                )
                              ) : (
                                <span className="inline-block w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-sm" title="Not submitted" />
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {avail?.preferred_shift_type?.length
                              ? avail.preferred_shift_type.join(', ')
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                            {avail?.unavailable_dates?.length
                              ? avail.unavailable_dates.slice(0, 3).map(d =>
                                  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                ).join(', ') + (avail.unavailable_dates.length > 3 ? ` +${avail.unavailable_dates.length - 3}` : '')
                              : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Create Poll Modal */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create Availability Poll</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cohort *</label>
                <select
                  value={pollCohort}
                  onChange={e => setPollCohort(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">-- Select Cohort --</option>
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>{c.program?.abbreviation} C{c.cohort_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester (optional)</label>
                <select
                  value={pollSemester}
                  onChange={e => setPollSemester(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">-- Select Semester --</option>
                  {semesters.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Poll Title</label>
                <input
                  type="text"
                  value={pollTitle}
                  onChange={e => setPollTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline (optional)</label>
                <input
                  type="date"
                  value={pollDeadline}
                  onChange={e => setPollDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPollModal(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createPoll}
                disabled={!pollCohort || creatingPoll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creatingPoll ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  'Create Poll'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
