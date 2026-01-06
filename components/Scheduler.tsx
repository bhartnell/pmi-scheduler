'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, CheckCircle, Send, UserCheck, UsersRound, ExternalLink, Copy, Eye, ArrowLeft } from 'lucide-react';

interface SchedulerProps {
  mode: 'create' | 'participant' | 'admin-view';
  pollData?: any;
  onComplete?: (data: any) => void;
}

export default function Scheduler({ mode, pollData, onComplete }: SchedulerProps) {
  const [schedulingMode, setSchedulingMode] = useState<'individual' | 'group' | null>(pollData?.mode || null);
  const [view, setView] = useState(mode === 'create' ? 'mode-select' : mode === 'participant' ? 'participant-form' : 'admin-results');
  const [studentData, setStudentData] = useState({
    name: '', email: '', agency: '', meetingType: 'initial', availability: [] as string[]
  });
  const [pollConfig, setPollConfig] = useState({
    title: pollData?.title || '',
    description: pollData?.description || '',
    startDate: pollData?.start_date || '',
    numWeeks: pollData?.num_weeks || 2,
    weekdaysOnly: pollData?.weekdays_only ?? true
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{date: number, time: number} | null>(null);
  const [isPreviewSelecting, setIsPreviewSelecting] = useState(false);
  const [previewSelectionStart, setPreviewSelectionStart] = useState<{date: number, time: number} | null>(null);
  const [adminPreviewSelections, setAdminPreviewSelections] = useState<string[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [linksCopied, setLinksCopied] = useState({ participant: false, admin: false });
  const [loading, setLoading] = useState(false);

  const agencies = ['Las Vegas Fire & Rescue', 'AMR', 'MedicWest', 'Community Ambulance', 'Henderson Fire', 'Pima Paramedic Program (Instructors/Staff)', 'Other'];
  const meetingTypes = [
    { value: 'initial', label: 'Initial Meeting' },
    { value: 'midpoint', label: 'Mid-Point Check-In' },
    { value: 'final', label: 'Final Evaluation' },
    { value: 'other', label: 'Other Meeting' }
  ];
  const groupSessionTypes = [
    { value: 'capstone', label: 'Capstone Skills Testing' },
    { value: 'competency', label: 'Competency Assessment' },
    { value: 'remediation', label: 'Group Remediation' },
    { value: 'orientation', label: 'Internship Orientation' }
  ];

  useEffect(() => {
    if (mode === 'admin-view' && pollData) {
      fetchSubmissions();
    }
  }, [mode, pollData]);

  const fetchSubmissions = async () => {
    const response = await fetch(`/api/submissions?pollId=${pollData.id}`);
    const result = await response.json();
    if (result.success) {
      setSubmissions(result.submissions);
    }
  };

  const generateTimeSlots = () => {
    if (schedulingMode === 'group') return ['Morning (8 AM-12 PM)', 'Afternoon (1-5 PM)', 'Full Day (8 AM-5 PM)'];
    const slots = [];
    for (let h = 6; h <= 20; h++) slots.push(h > 12 ? `${h-12}:00 PM` : h === 12 ? '12:00 PM' : `${h}:00 AM`);
    return slots;
  };

  const generateDates = () => {
    const dates = [];
    const startDate = pollConfig.startDate ? new Date(pollConfig.startDate) : new Date();
    const numDays = (pollConfig.numWeeks || (schedulingMode === 'group' ? 3 : 2)) * 7;
    
    if (!pollConfig.startDate) startDate.setDate(startDate.getDate() + 1);
    
    let daysAdded = 0;
    const currentDate = new Date(startDate);
    
    while (daysAdded < numDays) {
      const dayOfWeek = currentDate.getDay();
      const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;
      
      if (!pollConfig.weekdaysOnly || isWeekday) {
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

  const getDefaultSelections = () => {
    if (schedulingMode !== 'individual') return [];
    const timeSlots = generateTimeSlots();
    const startIdx = timeSlots.findIndex(t => t === '9:00 AM');
    const endIdx = timeSlots.findIndex(t => t === '5:00 PM');
    const selections = [];
    const numDates = generateDates().length;
    for (let dateIdx = 0; dateIdx < numDates; dateIdx++) {
      for (let timeIdx = startIdx; timeIdx <= endIdx; timeIdx++) {
        selections.push(`${dateIdx}-${timeIdx}`);
      }
    }
    return selections;
  };

  const timeSlots = generateTimeSlots();
  const dates = generateDates();

  const handleMouseDown = (dateIdx: number, timeIdx: number) => {
    setIsSelecting(true);
    setSelectionStart({ date: dateIdx, time: timeIdx });
    toggleAvailability(dateIdx, timeIdx, true);
  };

  const handleMouseEnter = (dateIdx: number, timeIdx: number) => {
    if (isSelecting && selectionStart) toggleAvailability(dateIdx, timeIdx, false);
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setSelectionStart(null);
  };

  const toggleAvailability = (dateIdx: number, timeIdx: number, isStart: boolean) => {
    const key = `${dateIdx}-${timeIdx}`;
    setStudentData(prev => {
      if (isStart) {
        return { ...prev, availability: prev.availability.includes(key) ? prev.availability.filter(k => k !== key) : [...prev.availability, key] };
      }
      if (!selectionStart) return prev;
      const startKey = `${selectionStart.date}-${selectionStart.time}`;
      const shouldSelect = prev.availability.includes(startKey);
      if (shouldSelect && !prev.availability.includes(key)) return { ...prev, availability: [...prev.availability, key] };
      if (!shouldSelect && prev.availability.includes(key)) return { ...prev, availability: prev.availability.filter(k => k !== key) };
      return prev;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    if (mode === 'participant') {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollId: pollData?.id,
          name: studentData.name,
          email: studentData.email,
          agency: studentData.agency,
          meetingType: studentData.meetingType,
          availability: studentData.availability,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setSubmissionId(result.submission.id);
        setView('submitted');
      }
    }
    setLoading(false);
  };

  const getOverlapCount = (dateIndex: number, timeIndex: number) => {
    const key = `${dateIndex}-${timeIndex}`;
    return submissions.filter(sub => {
      const avail = typeof sub.availability === 'string' ? JSON.parse(sub.availability) : sub.availability;
      return avail.includes(key);
    }).length;
  };

  const getOverlapColor = (count: number) => {
    if (schedulingMode === 'group') {
      const pct = submissions.length > 0 ? count / submissions.length : 0;
      return pct === 0 ? 'bg-gray-100' : pct < 0.4 ? 'bg-red-100' : pct < 0.7 ? 'bg-yellow-200' : 'bg-green-300';
    }
    return count === 0 ? 'bg-gray-100' : count === 1 ? 'bg-red-100' : count === 2 ? 'bg-yellow-200' : 'bg-green-300';
  };

  const copyLink = (type: 'participant' | 'admin') => {
    const link = type === 'participant' ? pollData?.participant_link : pollData?.admin_link;
    navigator.clipboard.writeText(link);
    setLinksCopied(p => ({ ...p, [type]: true }));
    setTimeout(() => setLinksCopied(p => ({ ...p, [type]: false })), 2000);
  };

  // Mode Selection View
  if (view === 'mode-select') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-3">Select Poll Type</h1>
          <p className="text-gray-700">Choose the type of scheduling poll to create</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => { setSchedulingMode('individual'); setView('setup'); }}
            className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:scale-105 text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg"><UserCheck className="w-8 h-8 text-blue-600" /></div>
              <h2 className="text-2xl font-bold">Individual Meeting</h2>
            </div>
            <p className="text-gray-700 mb-4">One-on-one internship check-ins with student, FTO, and instructor.</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Hourly time slots (6 AM - 8 PM)</li>
              <li>• Initial, mid-point, or final meetings</li>
            </ul>
          </button>
          <button
            onClick={() => { setSchedulingMode('group'); setPollConfig(p => ({ ...p, numWeeks: 3 })); setView('setup'); }}
            className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:scale-105 text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-100 rounded-lg"><UsersRound className="w-8 h-8 text-purple-600" /></div>
              <h2 className="text-2xl font-bold">Group Session</h2>
            </div>
            <p className="text-gray-700 mb-4">Testing days, competencies, or orientation with multiple students.</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Half-day or full-day blocks</li>
              <li>• Skills testing or assessments</li>
            </ul>
          </button>
        </div>
      </div>
    );
  }

  // Setup/Preview View
  if (view === 'setup') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultStart = pollConfig.startDate || tomorrow.toISOString().split('T')[0];
    
    if (adminPreviewSelections.length === 0 && schedulingMode === 'individual') {
      setAdminPreviewSelections(getDefaultSelections());
    }
    
    return (
      <div className="max-w-6xl mx-auto" onMouseUp={() => { setIsPreviewSelecting(false); setPreviewSelectionStart(null); }}>
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Poll Preview: {pollConfig.title || 'New Poll'}</h1>
          <p className="text-gray-700 mb-4">Review settings and calendar grid. Adjust as needed before finalizing.</p>
          
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <h3 className="font-semibold text-blue-900 mb-2">Settings:</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Type: {schedulingMode === 'individual' ? 'Individual Meeting' : 'Group Session'}</li>
              <li>• Time Slots: {schedulingMode === 'individual' ? 'Hourly (6 AM - 8 PM)' : 'Half-day blocks'}</li>
              <li>• Dates: {pollConfig.numWeeks} weeks, {pollConfig.weekdaysOnly ? 'Weekdays only' : 'All days'}</li>
            </ul>
          </div>
          
          <div className="flex gap-3">
            <button onClick={() => setView('mode-select')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4 inline mr-2" />Back
            </button>
            <button 
              onClick={() => {if (onComplete) onComplete(pollConfig);}}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              ✓ Create Poll
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Calendar Preview</h2>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full select-none">
              <div className="grid" style={{ gridTemplateColumns: `${schedulingMode === 'group' ? '180px' : '80px'} repeat(${dates.length}, ${schedulingMode === 'group' ? '110px' : '100px'})` }}>
                <div className="p-2 bg-gray-50 border-b-2"></div>
                {dates.map((d, i) => <div key={i} className="p-2 text-center text-sm bg-gray-50 border-b-2 font-medium">{d.display}</div>)}
                {timeSlots.map((t, ti) => (
                  <React.Fragment key={ti}>
                    <div className="p-2 text-sm font-medium bg-gray-50 border-r border-b">{t}</div>
                    {dates.map((d, di) => (
                      <div key={`${di}-${ti}`} className="p-3 border-r border-b bg-blue-100" />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Participant Form View
  if (view === 'participant-form') {
    return (
      <div className="max-w-6xl mx-auto" onMouseUp={handleMouseUp}>
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">{pollData?.title}</h1>
          {pollData?.description && <p className="text-gray-700">{pollData.description}</p>}
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Information</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input type="text" value={studentData.name} onChange={(e) => setStudentData(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="px-3 py-2 border rounded-md" />
            <input type="email" value={studentData.email} onChange={(e) => setStudentData(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="px-3 py-2 border rounded-md" />
            <select value={studentData.agency} onChange={(e) => setStudentData(p => ({ ...p, agency: e.target.value }))} className="px-3 py-2 border rounded-md">
              <option value="">Select agency</option>
              {agencies.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={studentData.meetingType} onChange={(e) => setStudentData(p => ({ ...p, meetingType: e.target.value }))} className="px-3 py-2 border rounded-md">
              {(schedulingMode === 'individual' ? meetingTypes : groupSessionTypes).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Select Available Times</h2>
          <p className="text-sm text-gray-700 mb-4"><strong>Click and drag</strong> to select multiple slots.</p>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full select-none">
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(${dates.length}, 100px)` }}>
                <div className="p-2 bg-gray-50 border-b-2"></div>
                {dates.map((d, i) => <div key={i} className="p-2 text-center text-sm bg-gray-50 border-b-2">{d.display}</div>)}
                {timeSlots.map((t, ti) => (
                  <React.Fragment key={ti}>
                    <div className="p-2 text-sm font-medium bg-gray-50 border-r border-b">{t}</div>
                    {dates.map((d, di) => (
                      <button key={`${di}-${ti}`} onMouseDown={() => handleMouseDown(di, ti)} onMouseEnter={() => handleMouseEnter(di, ti)} 
                        className={`p-3 border-r border-b transition-colors ${studentData.availability.includes(`${di}-${ti}`) ? 'bg-green-400' : 'bg-white hover:bg-blue-50'}`} />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={!studentData.name || !studentData.email || !studentData.availability.length || loading} 
            className="mt-6 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
            <Send className="w-5 h-5" /> {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    );
  }

  // Submitted View
  if (view === 'submitted') {
    return (
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mb-6"><div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"><CheckCircle className="w-10 h-10 text-green-600" /></div></div>
        <h1 className="text-2xl font-bold mb-3">Availability Submitted!</h1>
        <p className="text-gray-700 mb-6">Thank you, {studentData.name}. The coordinator will contact you with the meeting time.</p>
        <button onClick={() => setView('participant-form')} className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit My Availability</button>
      </div>
    );
  }

  // Admin Results View
  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">{pollData?.title}</h1>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><ExternalLink className="w-5 h-5 text-blue-600" /><span className="font-semibold">Participant Link</span></div>
              <button onClick={() => copyLink('participant')} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm">
                {linksCopied.participant ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {linksCopied.participant ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><Eye className="w-5 h-5 text-purple-600" /><span className="font-semibold">Admin Link</span></div>
              <button onClick={() => copyLink('admin')} className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded text-sm">
                {linksCopied.admin ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {linksCopied.admin ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg"><p className="text-sm text-green-800"><strong>Responses: {submissions.length}</strong></p></div>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Availability Results</h2>
        {submissions.length === 0 ? (
          <p className="text-gray-700 text-center py-8">No submissions yet. Share the participant link to collect availability.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid" style={{ gridTemplateColumns: `80px repeat(${dates.length}, 100px)` }}>
              <div className="p-2 bg-gray-50 border-b-2"></div>
              {dates.map((d, i) => <div key={i} className="p-2 text-center text-sm bg-gray-50 border-b-2">{d.display}</div>)}
              {timeSlots.map((t, ti) => (
                <React.Fragment key={ti}>
                  <div className="p-2 text-sm font-medium bg-gray-50 border-r border-b">{t}</div>
                  {dates.map((d, di) => {
                    const count = getOverlapCount(di, ti);
                    return <div key={`${di}-${ti}`} className={`p-3 border-r border-b flex items-center justify-center text-xs font-semibold ${getOverlapColor(count)}`}>
                      {schedulingMode === 'group' ? `${count}/${submissions.length}` : count === submissions.length && <CheckCircle className="w-5 h-5 text-green-700" />}
                    </div>;
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}