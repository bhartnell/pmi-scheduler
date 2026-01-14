'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Home, ChevronRight, BarChart3 } from 'lucide-react';
import Scheduler from '@/components/Scheduler';

export default function AdminPollPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [poll, setPoll] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchPoll = async () => {
      const pollId = params.id as string;

      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .like('admin_link', `%${pollId}%`)
        .single();

      if (pollData) {
        setPoll(pollData);
      }
      setLoading(false);
    };
    fetchPoll();
  }, [params.id]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Poll Not Found</h1>
          <p className="text-gray-700 dark:text-gray-300">This poll doesn't exist or has been deleted.</p>
          <Link
            href="/scheduler"
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
            <Link href="/scheduler" className="hover:text-blue-600 dark:hover:text-blue-400">
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
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{poll.title}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Poll Results & Management</p>
              </div>
            </div>
            <Link
              href="/scheduler"
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
        <div className="max-w-7xl mx-auto">
          <Scheduler mode="admin-view" pollData={poll} />
        </div>
      </div>
    </div>
  );
}
