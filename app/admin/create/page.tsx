'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function CreatePoll() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'individual' | 'group' | null>(null);
  const [pollData, setPollData] = useState({
    title: '',
    description: '',
    startDate: '',
    numWeeks: 2,
    weekdaysOnly: true,
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const response = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: pollData.title,
        description: pollData.description,
        mode: mode,
        startDate: pollData.startDate || tomorrow.toISOString().split('T')[0],
        numWeeks: pollData.numWeeks,
        weekdaysOnly: pollData.weekdaysOnly,
        createdBy: session?.user?.email,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      router.push('/');
    }
    
    setCreating(false);
  };

  if (creating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Creating poll...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        {step === 1 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Select Poll Type</h1>
            <div className="grid md:grid-cols-2 gap-6">
              <button onClick={() => { setMode('individual'); setStep(2); }} className="p-8 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all text-left">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Individual Meeting</h2>
                <p className="text-gray-700">One-on-one internship check-ins</p>
              </button>
              <button onClick={() => { setMode('group'); setPollData(prev => ({ ...prev, numWeeks: 3 })); setStep(2); }} className="p-8 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:shadow-lg transition-all text-left">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Group Session</h2>
                <p className="text-gray-700">Testing days with multiple students</p>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Poll Details</h1>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Title *</label>
                <input type="text" value={pollData.title} onChange={(e) => setPollData(prev => ({ ...prev, title: e.target.value }))} className="w-full px-4 py-3 border rounded-lg text-gray-900" placeholder="e.g., Sarah Johnson - Initial Meeting" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Description (Optional)</label>
                <textarea value={pollData.description} onChange={(e) => setPollData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-4 py-3 border rounded-lg text-gray-900" rows={3} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Start Date</label>
                  <input type="date" value={pollData.startDate} onChange={(e) => setPollData(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-4 py-3 border rounded-lg text-gray-900" />
                  <p className="text-xs text-gray-600 mt-1">Leave blank to start tomorrow</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Number of Weeks</label>
                  <input type="number" min="1" max="8" value={pollData.numWeeks} onChange={(e) => setPollData(prev => ({ ...prev, numWeeks: parseInt(e.target.value) }))} className="w-full px-4 py-3 border rounded-lg text-gray-900" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="weekdays" checked={pollData.weekdaysOnly} onChange={(e) => setPollData(prev => ({ ...prev, weekdaysOnly: e.target.checked }))} className="w-5 h-5" />
                <label htmlFor="weekdays" className="text-sm font-medium text-gray-900">Weekdays only (exclude weekends)</label>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="px-6 py-3 border rounded-lg hover:bg-gray-50 text-gray-900">Back</button>
                <button onClick={handleCreate} disabled={!pollData.title} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">Create Poll</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
