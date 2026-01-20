'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Scheduler from '@/components/Scheduler';
import { Home, ChevronRight, ArrowLeft, Calendar } from 'lucide-react';

export default function CreatePollPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

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
        }),
      });

      const result = await response.json();

      if (result.success && result.poll) {
        // Redirect to the scheduler home to see the new poll
        router.push('/scheduler');
      } else {
        alert('Failed to create poll: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Failed to create poll. Please try again.');
    }
    setCreating(false);
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
            <Link href="/scheduler" className="hover:text-blue-600 dark:hover:text-blue-400">
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Set up a new scheduling poll</p>
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

      {/* Poll Creation Form */}
      <div className="p-4 sm:p-6">
        <Scheduler mode="create" onComplete={handleCreatePoll} />
      </div>
    </div>
  );
}
