'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, ExternalLink, Copy, CheckCircle, Eye } from 'lucide-react';

export default function AdminPollPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [poll, setPoll] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [linksCopied, setLinksCopied] = useState({ participant: false, admin: false });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchPoll = async () => {
      const currentUrl = window.location.href;
      
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('admin_link', currentUrl)
        .single();

      if (pollData) {
        setPoll(pollData);
        
        const { data: subData } = await supabase
          .from('submissions')
          .select('*')
          .eq('poll_id', pollData.id);
        
        if (subData) {
          setSubmissions(subData);
        }
      }
      setLoading(false);
    };
    fetchPoll();
  }, []);

  const generateTimeSlots = () => {
    if (poll?.mode === 'group') return ['Morning (8 AM-12 PM)', 'Afternoon (1-5 PM)', 'Full Day (8 AM-5 PM)'];
    const slots = [];
    for (let h = 6; h <= 20; h++) slots.push(h > 12 ? `${h-12}:00 PM` : h === 12 ? '12:00 PM' : `${h}:00 AM`);
    return slots;
  };

  const generateDates = () => {
    if (!poll) return [];
    const dates = [];
    const startDate = new Date(poll.start_date);
    const numDays = poll.num_weeks * 7;
    
    let daysAdded = 0;
    const currentDate = new Date(startDate);
    
    while (daysAdded < numDays) {
      const dayOfWeek = currentDate.getDay();
      const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;
      
      if (!poll.weekdays_only || isWeekday) {
        dates.push({
          full: new Date(currentDate),
          display: currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        });
        daysAdded++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  const getOverlapCount = (dateIndex: number, timeIndex: number) => {
    const key = `${dateIndex}-${timeIndex}`;
    return submissions.filter(sub => {
      const avail = typeof sub.availability === 'string' ? JSON.parse(sub.availability) : sub.availability;
      return avail.includes(key);
    }).length;
  };

  const getOverlapColor = (count: number) => {
    if (poll?.mode === 'group') {
      const pct = submissions.length > 0 ? count / submissions.length : 0;
      return pct === 0 ? 'bg-gray-100' : pct < 0.4 ? 'bg-red-100' : pct < 0.7 ? 'bg-yellow-200' : 'bg-green-300';
    }
    return count === 0 ? 'bg-gray-100' : count === 1 ? 'bg-red-100' : count === 2 ? 'bg-yellow-200' : 'bg-green-300';
  };

  const copyLink = (type: 'participant' | 'admin') => {
    const link = type === 'participant' ? poll?.participant_link : poll?.admin_link;
    navigator.clipboard.writeText(link);
    setLinksCopied(p => ({ ...p, [type]: true }));
    setTimeout(() => setLinksCopied(p => ({ ...p, [type]: false })), 2000);
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Poll Not Found</h1>
          <p className="text-gray-700">This poll doesn't exist.</p>
        </div>
      </div>
    );
  }

  const timeSlots = generateTimeSlots();
  const dates = generateDates();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">{poll.title}</h1>
          {poll.description && <p className="text-gray-700 mb-4">{poll.description}</p>}
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">Participant Link</span>
                </div>
                <button onClick={() => copyLink('participant')} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm">
                  {linksCopied.participant ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {linksCopied.participant ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-blue-700">Share with students/FTOs</p>
            </div>
            <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold">Admin Link</span>
                </div>
                <button onClick={() => copyLink('admin')} className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded text-sm">
                  {linksCopied.admin ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {linksCopied.admin ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-purple-700">Keep private - admin only</p>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-800"><strong>Responses: {submissions.length}</strong></p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Legend:</h3>
          <div className="flex gap-4 flex-wrap text-sm">
            <div className="flex items-center gap-2"><div className="w-6 h-6 bg-gray-100 border"></div><span>None</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-6 bg-red-100 border"></div><span>Low</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-6 bg-yellow-200 border"></div><span>Medium</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-6 bg-green-300 border"></div><span>{poll.mode === 'individual' ? 'All ✓' : 'High'}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Availability Results</h2>
          {submissions.length === 0 ? (
            <p className="text-gray-700 text-center py-8">No submissions yet. Share the participant link to collect availability.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="grid" style={{ gridTemplateColumns: `80px repeat(${dates.length}, 100px)` }}>
                  <div className="p-2 bg-gray-50 border-b-2"></div>
                  {dates.map((d, i) => <div key={i} className="p-2 text-center text-sm bg-gray-50 border-b-2">{d.display}</div>)}
                  {timeSlots.map((t, ti) => (
                    <>
                      <div key={`time-${ti}`} className="p-2 text-sm font-medium bg-gray-50 border-r border-b">{t}</div>
                      {dates.map((d, di) => {
                        const count = getOverlapCount(di, ti);
                        return (
                          <div key={`${di}-${ti}`} className={`p-3 border-r border-b flex items-center justify-center text-xs font-semibold ${getOverlapColor(count)}`}>
                            {poll.mode === 'group' ? `${count}/${submissions.length}` : count === submissions.length && count > 0 && <CheckCircle className="w-5 h-5 text-green-700" />}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {submissions.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Submissions ({submissions.length})</h2>
            <div className="space-y-2">
              {submissions.map((sub) => (
                <div key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{sub.name}</span>
                    <span className="text-gray-500 text-sm ml-2">{sub.email}</span>
                  </div>
                  <span className="text-sm text-gray-700">{sub.agency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}