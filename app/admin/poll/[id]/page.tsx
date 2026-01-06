'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Poll Not Found</h1>
          <p className="text-gray-700">This poll doesn't exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
        
        <Scheduler mode="admin-view" pollData={poll} />
      </div>
    </div>
  );
}
