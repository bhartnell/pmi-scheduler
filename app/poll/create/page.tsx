'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import Scheduler from '@/components/scheduler';
import { pollLinkPath } from '@/lib/poll-link';
import { Home, ChevronRight, ArrowLeft, Calendar } from 'lucide-react';

// Human-readable label per internship meeting purpose. The internship
// page passes ?purpose= so the poll title is pre-filled with the
// right milestone — the coordinator shouldn't have to retype
// "Phase 1 Evaluation" every time.
const PURPOSE_LABELS: Record<string, string> = {
  pre_internship_meeting: 'Pre-Internship Agency Meeting',
  phase1_eval: 'Phase 1 Evaluation',
  phase2_eval: 'Phase 2 Evaluation',
  final_exam: 'Final Exam',
};

function CreatePollInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);

  // Internship context, when this poll was launched from an
  // internship's Meeting Scheduling row. All optional — a poll
  // created from the generic /poll/create entry point has none of
  // these and just opens a blank builder.
  const internshipId = searchParams.get('internship_id');
  const studentName = searchParams.get('student_name');
  const purpose = searchParams.get('purpose');

  // Pre-fill the builder's title/description from the context. The
  // Scheduler component reads pollData.title on first mount; the
  // coordinator can still edit it before creating.
  const pollData = useMemo(() => {
    if (!studentName && !purpose) return undefined;
    const purposeLabel = purpose ? PURPOSE_LABELS[purpose] ?? purpose : 'Meeting';
    const title = studentName
      ? `${studentName} — ${purposeLabel}`
      : purposeLabel;
    return {
      title,
      description: internshipId
        ? 'Scheduling poll created from the internship tracker.'
        : '',
      mode: 'individual' as const,
    };
  }, [studentName, purpose, internshipId]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleCreatePoll = async (pollConfig: any) => {
    setCreating(true);
    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pollConfig.title,
          description: pollConfig.description || '',
          mode: pollConfig.mode || 'individual',
          startDate: pollConfig.startDate,
          numWeeks: pollConfig.numWeeks || 2,
          weekdaysOnly: pollConfig.weekdaysOnly ?? true,
          createdBy: session?.user?.email,
          availableSlots: pollConfig.availableSlots || [],
        }),
      });

      const result = await response.json();

      if (result.success && result.poll) {
        // Redirect to the new poll's PARTICIPANT link path — that's
        // the shareable URL the coordinator sends out, and it's what
        // the /poll/[id] page is keyed on (participant_link contains
        // a nanoid, NOT the row's uuid). Redirecting with poll.id
        // produced a /poll/<uuid> URL the detail page couldn't
        // resolve → "Poll not found". pollLinkPath() extracts just
        // the path so router.push stays internal.
        router.push(pollLinkPath(result.poll));
      } else {
        alert('Failed to create poll: ' + (result.error || 'Unknown error'));
        setCreating(false);
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Failed to create poll. Please try again.');
      setCreating(false);
    }
    // Note: no setCreating(false) on success — we're navigating away,
    // and the spinner should stay up through the redirect.
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (creating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Creating poll...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/scheduling/polls" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scheduler
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Create Poll</span>
          </div>

          {/* Back Link & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Create New Poll</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {pollData?.title
                    ? `For: ${pollData.title}`
                    : 'Set up a new scheduling poll'}
                </p>
              </div>
            </div>
            {/* Back link — return to the internship when we came from
                there, otherwise the scheduler list. */}
            <Link
              href={internshipId ? `/clinical/internships/${internshipId}` : '/scheduling/polls'}
              className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              {internshipId ? 'Back to Internship' : 'Back to Scheduler'}
            </Link>
          </div>
        </div>
      </div>

      {/* Poll Creation Form */}
      <div className="p-4 sm:p-6">
        <Scheduler mode="create" pollData={pollData} onComplete={handleCreatePoll} />
      </div>
    </div>
  );
}

export default function CreatePollPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <CreatePollInner />
    </Suspense>
  );
}
