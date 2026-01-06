'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Scheduler from '@/components/Scheduler';

export default function PollPage() {
  const params = useParams();
  const [poll, setPoll] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPoll = async () => {
      const pollId = params.id as string;
      
      // Try to find poll by the ID in the URL
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .like('participant_link', `%${pollId}%`)
        .single();

      if (data) {
        setPoll(data);
      }
      setLoading(false);
    };
    fetchPoll();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading poll...</p>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Poll Not Found</h1>
          <p className="text-gray-700">This scheduling poll doesn't exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <Scheduler mode="participant" pollData={poll} />
    </div>
  );
}