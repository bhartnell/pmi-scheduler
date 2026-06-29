'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Scheduler from '@/components/scheduler';
import { Home, ChevronRight, ArrowLeft, Calendar } from 'lucide-react';

export default function PollPage() {
  const params = useParams();
  const [poll, setPoll] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPoll = async () => {
      const pollId = params.id as string;
      if (!pollId) {
        setLoading(false);
        return;
      }

      // The URL segment can be one of two things:
      //   1. The nanoid embedded in participant_link
      //      ("…/poll/AbC123XyZ0") — the normal share-link case.
      //   2. The poll row's uuid primary key — e.g. a redirect
      //      straight after creation that used poll.id.
      // Resolve both. A uuid has the canonical 8-4-4-4-12 hex shape;
      // anything else is treated as a participant-link token.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pollId);

      // maybeSingle() instead of single() — single() raises a 406
      // (PGRST116) whenever the row count isn't exactly 1, which
      // turned a simple "not found" into a console error. maybeSingle
      // returns null cleanly.
      let query = supabase.from('polls').select('*');
      query = isUuid
        ? query.eq('id', pollId)
        : query.like('participant_link', `%${pollId}%`);

      const { data } = await query.maybeSingle();

      if (data) {
        setPoll(data);
      }
      setLoading(false);
    };
    fetchPoll();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading poll...</p>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Poll Not Found</h1>
          <p className="text-gray-700 dark:text-gray-300">This scheduling poll doesn&apos;t exist or has been deleted.</p>
          <Link
            href="/scheduling/polls"
            className="inline-flex items-center gap-2 mt-4 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Scheduler
          </Link>
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
            <span className="text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
              {poll.title}
            </span>
          </div>

          {/* Back Link & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{poll.title}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Submit your availability</p>
              </div>
            </div>
            <Link
              href="/scheduling/polls"
              className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Scheduler
            </Link>
          </div>
        </div>
      </div>

      {/* Poll Content */}
      <div className="p-4 sm:p-6">
        <Scheduler mode="participant" pollData={poll} />
      </div>
    </div>
  );
}