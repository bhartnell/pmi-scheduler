'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Calendar, LogOut, Plus, ExternalLink, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchPolls();
    }
  }, [session]);

  const fetchPolls = async () => {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .eq('created_by', session?.user?.email)
      .order('created_at', { ascending: false });

    if (data) {
      setPolls(data);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">PMI EMS Scheduler</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">{session.user?.email}</span>
              <button onClick={() => signOut()} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Scheduling Polls</h1>
          <p className="mt-2 text-gray-700">Create and manage internship meeting and group session schedules</p>
        </div>

        <div className="mb-6">
          <button onClick={() => router.push('/admin/create')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            <Plus className="h-5 w-5" />
            Create New Poll
          </button>
        </div>

        {polls.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No polls yet</h3>
            <p className="text-gray-700 mb-6">Create your first scheduling poll to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {polls.map((poll) => (
              <div key={poll.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{poll.title}</h3>
                    <p className="text-gray-700 text-sm mt-1">{poll.description}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{poll.mode === 'individual' ? 'Individual' : 'Group'}</span>
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">{poll.num_weeks} weeks</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigator.clipboard.writeText(poll.participant_link)} 
                      className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Copy Participant Link
                    </button>
                    <button 
                      onClick={() => window.open(poll.admin_link, '_blank')} 
                      className="flex items-center gap-1 px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                    >
                      <Eye className="h-4 w-4" />
                      View Results
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}