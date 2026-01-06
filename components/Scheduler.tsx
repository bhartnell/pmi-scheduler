'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Users, CheckCircle, Send, UserCheck, UsersRound, ExternalLink, Copy, Eye, ArrowLeft, X, Sparkles, Filter } from 'lucide-react';

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
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [linksCopied, setLinksCopied] = useState({ participant: false, admin: false });
  const [loading, setLoading] = useState(false);
  
  // New admin view state
  const [selectedRespondents, setSelectedRespondents] = useState<string[]>([]);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<string>('all');
  const [showBestTimes, setShowBestTimes] = useState(false);

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

  const timeSlots = generateTimeSlots();
  const dates = generateDates();

  // Filter submissions by meeting type
  const filteredSubmissions = useMemo(() => {
    if (meetingTypeFilter === 'all') return submissions;
    return submissions.filter(sub => sub.meeting_type === meetingTypeFilter);
  }, [submissions, meetingTypeFilter]);

  // Get respondents to show (either selected or all filtered)
  const activeRespondents = useMemo(() => {
    if (selectedRespondents.length > 0) {
      return filteredSubmissions.filter(sub => selectedRespondents.includes(sub.id));
    }
    return filteredSubmissions;
  }, [filteredSubmissions, selectedRespondents]);

  // Parse availability helper
  const getAvailability = (sub: any): string[] => {
    return typeof sub.availability === 'string' ? JSON.parse(sub.availability) : sub.availability;
  };

  // Get who is available at a specific slot
  const getAvailableAt = (dateIndex: number, timeIndex: number) => {
    const key = `${dateIndex}-${timeIndex}`;
    return activeRespondents.filter(sub => getAvailability(sub).includes(key));
  };

  // Find best times (where most/all active respondents are available)
  const bestTimes = useMemo(() => {
    if (activeRespondents.length === 0) return [];
    const slots: { key: string; count: number; names: string[] }[] = [];
    
    dates.forEach((_, di) => {
      timeSlots.forEach((_, ti) => {
        const available = getAvailableAt(di, ti);
        if (available.length === activeRespondents.length && activeRespondents.length > 0) {
          slots.push({
            key: `${di}-${ti}`,
            count: available.length,
            names: available.map(s => s.name)
          });
        }
      });
    });
    return slots;
  }, [activeRespondents, dates, timeSlots]);

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

  const toggleRespondentSelection = (id: string) => {
    setSelectedRespondents(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedRespondents([]);
  };

  const getCellColor = (dateIndex: number, timeIndex: number) => {
    const available = getAvailableAt(dateIndex, timeIndex);
    const count = available.length;
    const total = activeRespondents.length;
    
    if (total === 0) return 'bg-gray-50';
    
    const key = `${dateIndex}-${timeIndex}`;
    const isBestTime = showBestTimes && bestTimes.some(bt => bt.key === key);
    
    if (count === 0) return 'bg-gray-50';
    if (count === total) return isBestTime ? 'bg-green-400 ring-2 ring-green-600 ring-inset' : 'bg-green-400';
    if (count >= total * 0.7) return 'bg-green-200';
    if (count >= total * 0.4) return 'bg-yellow-200';
    return 'bg-red-100';
  };

  const copyLink = (type: 'participant' | 'admin') => {
    const link = type === 'participant' ? pollData?.participant_link : pollData?.admin_link;
    navigator.clipboard.writeText(link);
    setLinksCopied(p => ({ ...p, [type]: true }));
    setTimeout(() => setLinksCopied(p => ({ ...p, [type]: false })), 2000);
  };

  const getMeetingTypeLabel = (value: string) => {
    const type = [...meetingTypes, ...groupSessionTypes].find(t => t.value === value);
    return type?.label || value;
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
              <h2 className="text-2xl font-bold text-gray-900">Individual Meeting</h2>
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
              <h2 className="text-2xl font-bold text-gray-900">Group Session</h2>
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
    
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Poll Preview: {pollConfig.title || 'New Poll'}</h1>
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
            <button onClick={() => setView('mode-select')} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-900">
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Calendar Preview</h2>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full select-none">
              <div className="grid" style={{ gridTemplateColumns: `${schedulingMode === 'group' ? '180px' : '80px'} repeat(${dates.length}, ${schedulingMode === 'group' ? '110px' : '100px'})` }}>
                <div className="p-2 bg-gray-50 border-b-2"></div>
                {dates.map((d, i) => <div key={i} className="p-2 text-center text-sm bg-gray-50 border-b-2 font-medium text-gray-900">{d.display}</div>)}
                {timeSlots.map((t, ti) => (
                  <React.Fragment key={ti}>
                    <div className="p-2 text-sm font-medium bg-gray-50 border-r border-b text-gray-900">{t}</div>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{pollData?.title}</h1>
          {pollData?.description && <p className="text-gray-700">{pollData.description}</p>}
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Information</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input type="text" value={studentData.name} onChange={(e) => setStudentData(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="px-3 py-2 border rounded-md text-gray-900 bg-white" />
            <input type="email" value={studentData.email} onChange={(e) => setStudentData(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="px-3 py-2 border rounded-md text-gray-900 bg-white" />
            <select value={studentData.agency} onChange={(e) => setStudentData(p => ({ ...p, agency: e.target.value }))} className="px-3 py-2 border rounded-md text-gray-900 bg-white">
              <option value="">Select agency</option>
              {agencies.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={studentData.meetingType} onChange={(e) => setStudentData(p => ({ ...p, meetingType: e.target.value }))} className="px-3 py-2 border rounded-md text-gray-900 bg-white">
              {(schedulingMode === 'individual' ? meetingTypes : groupSessionTypes).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Available Times</h2>
          <p className="text-sm text-gray-700 mb-4"><strong>Click and drag</strong> to select multiple slots.</p>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full select-none">
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(${dates.length}, 100px)` }}>
                <div className="p-2 bg-gray-50 border-b-2"></div>
                {dates.map((d, i) => <div key={i} className="p-2 text-center text-sm bg-gray-50 border-b-2 text-gray-900">{d.display}</div>)}
                {timeSlots.map((t, ti) => (
                  <React.Fragment key={ti}>
                    <div className="p-2 text-sm font-medium bg-gray-50 border-r border-b text-gray-900">{t}</div>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Availability Submitted!</h1>
        <p className="text-gray-700 mb-6">Thank you, {studentData.name}. The coordinator will contact you with the meeting time.</p>
        <button onClick={() => setView('participant-form')} className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit My Availability</button>
      </div>
    );
  }

  // Admin Results View - IMPROVED
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with links */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{pollData?.title}</h1>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2"><ExternalLink className="w-5 h-5 text-blue-600" /><span className="font-semibold text-gray-900">Participant Link</span></div>
              <button onClick={() => copyLink('participant')} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm">
                {linksCopied.participant ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {linksCopied.participant ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-blue-700">Share with students/FTOs</p>
          </div>
          <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2"><Eye className="w-5 h-5 text-purple-600" /><span className="font-semibold text-gray-900">Admin Link</span></div>
              <button onClick={() => copyLink('admin')} className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded text-sm">
                {linksCopied.admin ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {linksCopied.admin ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-purple-700">Keep private - admin only</p>
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <p className="text-sm text-green-800"><strong>Total Responses: {submissions.length}</strong></p>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Submissions sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-4 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Submissions ({filteredSubmissions.length})</h2>
              {selectedRespondents.length > 0 && (
                <button onClick={clearSelection} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            
            {/* Filter by meeting type */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Filter by type:</label>
              <select 
                value={meetingTypeFilter} 
                onChange={(e) => setMeetingTypeFilter(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm text-gray-900 bg-white"
              >
                <option value="all">All Types</option>
                {meetingTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Respondent list */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredSubmissions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No submissions yet</p>
              ) : (
                filteredSubmissions.map((sub) => {
                  const isSelected = selectedRespondents.includes(sub.id);
                  const avail = getAvailability(sub);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => toggleRespondentSelection(sub.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{sub.name}</div>
                      <div className="text-xs text-gray-500 truncate">{sub.email}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-600">{getMeetingTypeLabel(sub.meeting_type)}</span>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{avail.length} slots</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedRespondents.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{selectedRespondents.length}</strong> selected - showing only their availability
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Calendar grid */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Availability Results</h2>
              <button
                onClick={() => setShowBestTimes(!showBestTimes)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showBestTimes 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {showBestTimes ? 'Highlighting Best Times' : 'Find Best Times'}
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Legend:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-gray-50 border rounded"></div>
                <span className="text-xs text-gray-600">None</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-red-100 border rounded"></div>
                <span className="text-xs text-gray-600">&lt;40%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-yellow-200 border rounded"></div>
                <span className="text-xs text-gray-600">40-70%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-green-200 border rounded"></div>
                <span className="text-xs text-gray-600">70-99%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-green-400 border rounded"></div>
                <span className="text-xs text-gray-600">All ✓</span>
              </div>
            </div>

            {/* Best times summary */}
            {showBestTimes && bestTimes.length > 0 && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Best Times ({bestTimes.length} slots where everyone is available)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {bestTimes.slice(0, 10).map((bt, idx) => {
                    const [di, ti] = bt.key.split('-').map(Number);
                    return (
                      <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {dates[di]?.display} @ {timeSlots[ti]}
                      </span>
                    );
                  })}
                  {bestTimes.length > 10 && (
                    <span className="px-2 py-1 text-green-700 text-sm">+{bestTimes.length - 10} more</span>
                  )}
                </div>
              </div>
            )}

            {showBestTimes && bestTimes.length === 0 && activeRespondents.length > 0 && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  No times found where all {activeRespondents.length} selected respondent(s) are available. 
                  Try selecting fewer people or check the calendar for partial overlaps.
                </p>
              </div>
            )}

            {filteredSubmissions.length === 0 ? (
              <p className="text-gray-700 text-center py-8">No submissions yet. Share the participant link to collect availability.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full select-none">
                  <div className="grid" style={{ gridTemplateColumns: `80px repeat(${dates.length}, 90px)` }}>
                    <div className="p-2 bg-gray-50 border-b-2"></div>
                    {dates.map((d, i) => (
                      <div key={i} className="p-2 text-center text-xs bg-gray-50 border-b-2 font-medium text-gray-900">{d.display}</div>
                    ))}
                    {timeSlots.map((t, ti) => (
                      <React.Fragment key={ti}>
                        <div className="p-2 text-xs font-medium bg-gray-50 border-r border-b text-gray-900">{t}</div>
                        {dates.map((d, di) => {
                          const available = getAvailableAt(di, ti);
                          const count = available.length;
                          const total = activeRespondents.length;
                          const cellKey = `${di}-${ti}`;
                          const isHovered = hoveredCell === cellKey;
                          
                          return (
                            <div 
                              key={cellKey} 
                              className={`relative p-2 border-r border-b flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${getCellColor(di, ti)} ${isHovered ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}`}
                              onMouseEnter={() => setHoveredCell(cellKey)}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {total > 0 && (
                                <span className={count === total ? 'text-green-800' : count > 0 ? 'text-gray-700' : 'text-gray-400'}>
                                  {count}/{total}
                                </span>
                              )}
                              
                              {/* Tooltip */}
                              {isHovered && count > 0 && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                    <div className="font-semibold mb-1">{dates[di]?.display} @ {timeSlots[ti]}</div>
                                    <div className="text-green-300 mb-1">{count} available:</div>
                                    {available.map((sub, idx) => (
                                      <div key={idx} className="text-gray-300">• {sub.name}</div>
                                    ))}
                                    {total - count > 0 && (
                                      <div className="text-red-300 mt-1">{total - count} unavailable</div>
                                    )}
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}