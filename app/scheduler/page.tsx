'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Calendar, LogOut, Plus, ExternalLink, Eye, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function SchedulerHome() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const deletePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll? This will also delete all submissions.')) {
      return;
    }
    
    setDeleting(pollId);
    try {
      const response = await fetch(`/api/polls?id=${pollId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setPolls(polls.filter(p => p.id !== pollId));
      } else {
        alert('Failed to delete poll');
      }
    } catch (error) {
      console.error('Error deleting poll:', error);
      alert('Failed to delete poll');
    }
    setDeleting(null);
  };

  // Helper function to extract the poll ID from admin_link
  // Handles both full URLs and plain IDs
  const getAdminLinkId = (adminLink: string) => {
    if (adminLink.includes('/')) {
      // It's a full URL, extract the last segment
      return adminLink.split('/').pop() || adminLink;
    }
    // It's already just the ID
    return adminLink;
  };

  // Helper function to extract the poll ID from participant_link
  const getParticipantLinkId = (participantLink: string) => {
    if (participantLink.includes('/')) {
      return participantLink.split('/').pop() || participantLink;
    }
    return participantLink;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header with Home Link */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Home Link */}
            <Link 
              href="/" 
              className="flex items-center gap-2 text-blue-900 hover:text-blue-700 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">PMI</span>
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">PMI Paramedic Tools</div>
                <div className="text-xs text-gray-500">Scheduling Polls</div>
              </div>
            </Link>

            {/* Right side - Auth info */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:block">
                {session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Title and Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheduling Polls</h1>
            <p className="text-gray-600">Create and manage availability polls</p>
          </div>
          <button
            onClick={() => router.push('/poll/create')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" />
            Create New Poll
          </button>
        </div>

        {/* Polls List */}
        {polls.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No polls yet</h3>
            <p className="text-gray-600 mb-6">Create your first scheduling poll to get started.</p>
            <button
              onClick={() => router.push('/poll/create')}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Poll
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => (
              <div key={poll.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{poll.title}</h3>
                    {poll.description && (
                      <p className="text-gray-600 mt-1 text-sm">{poll.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(poll.start_date).toLocaleDateString()} - {poll.num_weeks} weeks
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        poll.mode === 'individual' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {poll.mode === 'individual' ? 'Individual' : 'Group'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const participantId = getParticipantLinkId(poll.participant_link);
                        navigator.clipboard.writeText(`${window.location.origin}/poll/${participantId}`);
                        alert('Participant link copied!');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Share
                    </button>
                    <button
                      onClick={() => {
                        const adminId = getAdminLinkId(poll.admin_link);
                        router.push(`/admin/poll/${adminId}`);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Eye className="w-4 h-4" />
                      Results
                    </button>
                    <button
                      onClick={() => deletePoll(poll.id)}
                      disabled={deleting === poll.id}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === poll.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete
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
