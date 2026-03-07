'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, CheckCircle, Send, ExternalLink, Copy, Eye, X, Sparkles,
  ChevronLeft, ChevronRight, CalendarPlus, Loader2, MapPin, Mail,
} from 'lucide-react';
import {
  generateTimeSlots, generateDates, respondentRoles, requiredRoles,
  getCellColor, getRoleConfig, getAvailability,
} from './utils';
import type { PollConfig, MeetingForm, MeetingResult, EmailForm, EmailResult, BestTimeSlot } from './types';

interface SchedulerAdminProps {
  pollData?: any;
  onComplete?: (data: any) => void;
}

export default function SchedulerAdmin({ pollData, onComplete }: SchedulerAdminProps) {
  const schedulingMode = pollData?.mode || null;

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedRespondents, setSelectedRespondents] = useState<string[]>([]);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showBestTimes, setShowBestTimes] = useState(false);
  const [linksCopied, setLinksCopied] = useState({ participant: false, admin: false });

  // Mobile state
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Create Meeting modal state
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedMeetingSlot, setSelectedMeetingSlot] = useState<{ dateIndex: number; timeIndex: number } | null>(null);
  const [meetingForm, setMeetingForm] = useState<MeetingForm>({
    title: '', location: '', description: '', duration: 60,
  });
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [meetingResult, setMeetingResult] = useState<MeetingResult | null>(null);

  // Send Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState<EmailForm>({ subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const pollConfig: PollConfig = {
    title: pollData?.title || '',
    description: pollData?.description || '',
    startDate: pollData?.start_date || '',
    numWeeks: pollData?.num_weeks || 2,
    weekdaysOnly: pollData?.weekdays_only ?? true,
  };

  const timeSlots = generateTimeSlots(schedulingMode);
  const dates = generateDates(pollConfig, schedulingMode);

  useEffect(() => {
    if (pollData) fetchSubmissions();
  }, [pollData]);

  const fetchSubmissions = async () => {
    const response = await fetch(`/api/submissions?pollId=${pollData.id}`);
    const result = await response.json();
    if (result.success) {
      setSubmissions(result.submissions);
    }
  };

  // Filter submissions by role
  const filteredSubmissions = useMemo(() => {
    if (roleFilter === 'all') return submissions;
    return submissions.filter(sub => (sub.respondent_role || sub.meeting_type) === roleFilter);
  }, [submissions, roleFilter]);

  // Get respondents to show (either selected or all filtered)
  const activeRespondents = useMemo(() => {
    if (selectedRespondents.length > 0) {
      return filteredSubmissions.filter(sub => selectedRespondents.includes(sub.id));
    }
    return filteredSubmissions;
  }, [filteredSubmissions, selectedRespondents]);

  // Get who is available at a specific slot
  const getAvailableAt = (dateIndex: number, timeIndex: number) => {
    const key = `${dateIndex}-${timeIndex}`;
    return activeRespondents.filter(sub => getAvailability(sub).includes(key));
  };

  // Find best times
  const bestTimes: BestTimeSlot[] = useMemo(() => {
    if (activeRespondents.length === 0) return [];
    const slots: BestTimeSlot[] = [];
    dates.forEach((_, di) => {
      timeSlots.forEach((_, ti) => {
        const available = getAvailableAt(di, ti);
        if (available.length === activeRespondents.length && activeRespondents.length > 0) {
          slots.push({
            key: `${di}-${ti}`,
            count: available.length,
            names: available.map((s: any) => s.name),
          });
        }
      });
    });
    return slots;
  }, [activeRespondents, dates, timeSlots]);

  const toggleRespondentSelection = (id: string) => {
    setSelectedRespondents(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedRespondents([]);

  const copyLink = (type: 'participant' | 'admin') => {
    const link = type === 'participant' ? pollData?.participant_link : pollData?.admin_link;
    navigator.clipboard.writeText(link);
    setLinksCopied(p => ({ ...p, [type]: true }));
    setTimeout(() => setLinksCopied(p => ({ ...p, [type]: false })), 2000);
  };

  // Calculate which required roles have been filled
  const getRolesStatus = useMemo(() => {
    const rolesCovered: Record<string, { filled: boolean; names: string[] }> = {};
    requiredRoles.forEach(role => {
      const matching = filteredSubmissions.filter(sub => (sub.respondent_role || sub.meeting_type) === role);
      rolesCovered[role] = {
        filled: matching.length > 0,
        names: matching.map((s: any) => s.name),
      };
    });
    return rolesCovered;
  }, [filteredSubmissions]);

  // Navigation for mobile day view
  const goToPreviousDay = () => setCurrentDayIndex(Math.max(0, currentDayIndex - 1));
  const goToNextDay = () => setCurrentDayIndex(Math.min(dates.length - 1, currentDayIndex + 1));

  // Open meeting modal for a specific time slot
  const openMeetingModal = (dateIndex: number, timeIndex: number) => {
    setSelectedMeetingSlot({ dateIndex, timeIndex });
    setMeetingForm({
      title: pollData?.title || '',
      location: '',
      description: pollData?.description || '',
      duration: schedulingMode === 'group' ? 240 : 60,
    });
    setMeetingResult(null);
    setShowMeetingModal(true);
  };

  // Create Google Calendar meeting
  const handleCreateMeeting = async () => {
    if (!selectedMeetingSlot) return;

    setCreatingMeeting(true);
    setMeetingResult(null);

    try {
      const { dateIndex, timeIndex } = selectedMeetingSlot;
      const date = dates[dateIndex];
      const timeSlot = timeSlots[timeIndex];

      let startHour = 0;
      if (schedulingMode === 'group') {
        if (timeSlot.includes('Morning')) startHour = 8;
        else if (timeSlot.includes('Afternoon')) startHour = 13;
        else startHour = 8;
      } else {
        const match = timeSlot.match(/(\d+):00\s*(AM|PM)/);
        if (match) {
          startHour = parseInt(match[1]);
          if (match[2] === 'PM' && startHour !== 12) startHour += 12;
          if (match[2] === 'AM' && startHour === 12) startHour = 0;
        }
      }

      const startDate = new Date(date.full);
      startDate.setHours(startHour, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + meetingForm.duration);

      const attendees = activeRespondents.map((sub: any) => ({
        email: sub.email,
        name: sub.name,
      }));

      const response = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingForm.title,
          description: meetingForm.description,
          location: meetingForm.location,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          attendees,
          sendNotifications: true,
          pollId: pollData?.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMeetingResult({
          success: true,
          message: `Meeting created! Invites sent to ${attendees.length} attendee(s).`,
          link: result.event?.htmlLink,
        });
      } else {
        setMeetingResult({
          success: false,
          message: result.error || 'Failed to create meeting',
        });
      }
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      setMeetingResult({
        success: false,
        message: error?.message || 'Failed to create meeting',
      });
    }

    setCreatingMeeting(false);
  };

  // Open email modal
  const openEmailModal = () => {
    setEmailForm({
      subject: pollData?.title ? `Regarding: ${pollData.title}` : '',
      body: '',
    });
    setEmailResult(null);
    setShowEmailModal(true);
  };

  // Send email to selected respondents
  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.body) return;

    setSendingEmail(true);
    setEmailResult(null);

    try {
      const recipients = activeRespondents.map((sub: any) => ({
        email: sub.email,
        name: sub.name,
      }));

      const htmlBody = emailForm.body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      const response = await fetch('/api/notifications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject: emailForm.subject,
          body: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${htmlBody}</div>`,
          plainText: emailForm.body,
          pollId: pollData?.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setEmailResult({
          success: true,
          message: `Email sent to ${result.recipientCount} recipient(s)!`,
        });
      } else {
        setEmailResult({
          success: false,
          message: result.error || 'Failed to send email',
        });
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      setEmailResult({
        success: false,
        message: error?.message || 'Failed to send email',
      });
    }

    setSendingEmail(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header with links */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{pollData?.title}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
          <div className="border-2 border-blue-200 rounded-lg p-3 md:p-4 bg-blue-50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                <span className="font-semibold text-gray-900 text-sm md:text-base">Participant Link</span>
              </div>
              <button onClick={() => copyLink('participant')} className="flex items-center gap-1 px-2 md:px-3 py-1 bg-blue-600 text-white rounded text-xs md:text-sm">
                {linksCopied.participant ? <CheckCircle className="w-3 h-3 md:w-4 md:h-4" /> : <Copy className="w-3 h-3 md:w-4 md:h-4" />}
                {linksCopied.participant ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-blue-700">Share with students/FTOs</p>
          </div>
          <div className="border-2 border-purple-200 rounded-lg p-3 md:p-4 bg-purple-50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                <span className="font-semibold text-gray-900 text-sm md:text-base">Admin Link</span>
              </div>
              <button onClick={() => copyLink('admin')} className="flex items-center gap-1 px-2 md:px-3 py-1 bg-purple-600 text-white rounded text-xs md:text-sm">
                {linksCopied.admin ? <CheckCircle className="w-3 h-3 md:w-4 md:h-4" /> : <Copy className="w-3 h-3 md:w-4 md:h-4" />}
                {linksCopied.admin ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-purple-700">Keep private - admin only</p>
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg mb-4">
          <p className="text-sm text-green-800"><strong>Total Responses: {submissions.length}</strong></p>
        </div>

        {/* Required Roles Status */}
        <div className="border rounded-lg p-3 md:p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Required Roles Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {requiredRoles.map(role => {
              const roleConfig = getRoleConfig(role);
              const status = getRolesStatus[role];
              const RoleIcon = roleConfig.icon;
              return (
                <div
                  key={role}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    status?.filled
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className={`p-1.5 rounded ${status?.filled ? 'bg-green-200' : 'bg-red-200'}`}>
                    {status?.filled ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <RoleIcon className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${status?.filled ? 'text-green-800' : 'text-red-800'}`}>
                      {roleConfig.label}
                    </div>
                    {status?.filled ? (
                      <div className="text-xs text-green-600 truncate">{status.names.join(', ')}</div>
                    ) : (
                      <div className="text-xs text-red-500">Missing</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: Toggle sidebar button */}
      {isMobile && (
        <button
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          className="w-full mb-4 flex items-center justify-center gap-2 py-3 bg-white rounded-lg shadow text-gray-700 font-medium"
        >
          <Users className="w-5 h-5" />
          {showMobileSidebar ? 'Hide Respondents' : `Show Respondents (${filteredSubmissions.length})`}
        </button>
      )}

      {/* Main content grid */}
      <div className="grid lg:grid-cols-4 gap-4 md:gap-6">
        {/* Submissions sidebar - collapsible on mobile */}
        <div className={`lg:col-span-1 ${isMobile && !showMobileSidebar ? 'hidden' : ''}`}>
          <div className="bg-white rounded-lg shadow-lg p-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base md:text-lg font-semibold text-gray-900">Submissions ({filteredSubmissions.length})</h2>
              {selectedRespondents.length > 0 && (
                <button onClick={clearSelection} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* Filter by role */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Filter by role:</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-2 py-2 border rounded text-sm text-gray-900 bg-white"
              >
                <option value="all">All Roles</option>
                {respondentRoles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Respondent list */}
            <div className="space-y-2 max-h-64 md:max-h-96 overflow-y-auto">
              {filteredSubmissions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No submissions yet</p>
              ) : (
                filteredSubmissions.map((sub) => {
                  const isSelected = selectedRespondents.includes(sub.id);
                  const avail = getAvailability(sub);
                  const roleConfig = getRoleConfig(sub.respondent_role || sub.meeting_type);
                  const RoleIcon = roleConfig.icon;
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
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${roleConfig.bgColor}`}>
                          <RoleIcon className={`w-3 h-3 ${roleConfig.color}`} />
                        </div>
                        <div className="font-medium text-gray-900 text-sm">{sub.name}</div>
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-1">{sub.email}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${roleConfig.bgColor} ${roleConfig.color}`}>
                          {roleConfig.label}
                        </span>
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
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">Availability Results</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={openEmailModal}
                  disabled={activeRespondents.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  title={activeRespondents.length === 0 ? 'Select respondents first' : 'Send email to selected respondents'}
                >
                  <Mail className="w-4 h-4" />
                  Email ({activeRespondents.length})
                </button>
                <button
                  onClick={() => setShowBestTimes(!showBestTimes)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showBestTimes
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {showBestTimes ? 'Highlighting Best' : 'Find Best Times'}
                </button>
              </div>
            </div>

            {/* Legend - responsive */}
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-4 p-2 md:p-3 bg-gray-50 rounded-lg">
              <span className="text-xs md:text-sm font-medium text-gray-700 w-full sm:w-auto">Legend:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 md:w-5 md:h-5 bg-gray-50 border rounded"></div>
                <span className="text-xs text-gray-600">None</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 md:w-5 md:h-5 bg-red-100 border rounded"></div>
                <span className="text-xs text-gray-600">&lt;40%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 md:w-5 md:h-5 bg-yellow-200 border rounded"></div>
                <span className="text-xs text-gray-600">40-70%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 md:w-5 md:h-5 bg-green-200 border rounded"></div>
                <span className="text-xs text-gray-600">70-99%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 md:w-5 md:h-5 bg-green-400 border rounded"></div>
                <span className="text-xs text-gray-600">All {'\u2713'}</span>
              </div>
            </div>

            {/* Best times summary */}
            {showBestTimes && bestTimes.length > 0 && (
              <div className="mb-4 p-3 md:p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2 text-sm md:text-base">
                  <Sparkles className="w-4 h-4" />
                  Best Times ({bestTimes.length} slots)
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {bestTimes.slice(0, isMobile ? 5 : 10).map((bt, idx) => {
                    const [di, ti] = bt.key.split('-').map(Number);
                    return (
                      <button
                        key={idx}
                        onClick={() => openMeetingModal(di, ti)}
                        className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs md:text-sm hover:bg-green-200 transition-colors flex items-center gap-1"
                        title="Click to create meeting"
                      >
                        {dates[di]?.shortDisplay} @ {timeSlots[ti]}
                        <CalendarPlus className="w-3 h-3" />
                      </button>
                    );
                  })}
                  {bestTimes.length > (isMobile ? 5 : 10) && (
                    <span className="px-2 py-1 text-green-700 text-xs md:text-sm">+{bestTimes.length - (isMobile ? 5 : 10)} more</span>
                  )}
                </div>
                <p className="text-xs text-green-600">Click a time slot to create a Google Calendar meeting and send invites</p>
              </div>
            )}

            {showBestTimes && bestTimes.length === 0 && activeRespondents.length > 0 && (
              <div className="mb-4 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-xs md:text-sm">
                  No times found where all {activeRespondents.length} selected respondent(s) are available.
                  Try selecting fewer people or check the calendar for partial overlaps.
                </p>
              </div>
            )}

            {filteredSubmissions.length === 0 ? (
              <p className="text-gray-700 text-center py-8 text-sm md:text-base">No submissions yet. Share the participant link to collect availability.</p>
            ) : isMobile ? (
              /* Mobile: Day-by-day admin view */
              <div>
                {/* Day navigation */}
                <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-lg p-2">
                  <button
                    onClick={goToPreviousDay}
                    disabled={currentDayIndex === 0}
                    className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:shadow-none"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">{dates[currentDayIndex]?.dayName}</div>
                    <div className="text-sm text-gray-600">{dates[currentDayIndex]?.fullDate}</div>
                  </div>
                  <button
                    onClick={goToNextDay}
                    disabled={currentDayIndex === dates.length - 1}
                    className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:shadow-none"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                </div>

                {/* Day indicator dots */}
                <div className="flex justify-center gap-1 mb-4 flex-wrap">
                  {dates.map((_, i) => {
                    const hasAvailability = timeSlots.some((__, ti) =>
                      getAvailableAt(i, ti).length > 0
                    );
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentDayIndex(i)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          i === currentDayIndex
                            ? 'bg-blue-600 scale-125'
                            : hasAvailability
                              ? 'bg-green-400'
                              : 'bg-gray-300'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Time slots for current day */}
                <div className="space-y-2">
                  {timeSlots.map((t, ti) => {
                    const available = getAvailableAt(currentDayIndex, ti);
                    const count = available.length;
                    const total = activeRespondents.length;
                    const cellKey = `${currentDayIndex}-${ti}`;
                    const isBestTime = showBestTimes && bestTimes.some(bt => bt.key === cellKey);

                    let bgColor = 'bg-gray-50';
                    if (total > 0) {
                      if (count === total) bgColor = isBestTime ? 'bg-green-400 ring-2 ring-green-600' : 'bg-green-400';
                      else if (count >= total * 0.7) bgColor = 'bg-green-200';
                      else if (count >= total * 0.4) bgColor = 'bg-yellow-200';
                      else if (count > 0) bgColor = 'bg-red-100';
                    }

                    return (
                      <div
                        key={ti}
                        onClick={() => openMeetingModal(currentDayIndex, ti)}
                        className={`p-4 rounded-lg border ${bgColor} cursor-pointer hover:ring-2 hover:ring-green-500 transition-all`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{t}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${count === total && total > 0 ? 'text-green-800' : 'text-gray-700'}`}>
                              {count}/{total} available
                            </span>
                            <CalendarPlus className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                        {count > 0 && (
                          <div className="text-xs text-gray-600">
                            {available.map((s: any) => s.name).join(', ')}
                          </div>
                        )}
                        <div className="text-xs text-green-600 mt-2">Tap to create meeting</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Desktop: Grid view */
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
                        {dates.map((_, di) => {
                          const available = getAvailableAt(di, ti);
                          const count = available.length;
                          const total = activeRespondents.length;
                          const cellKey = `${di}-${ti}`;
                          const isHovered = hoveredCell === cellKey;

                          return (
                            <div
                              key={cellKey}
                              className={`relative p-2 border-r border-b flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${getCellColor(di, ti, activeRespondents, getAvailableAt, showBestTimes, bestTimes)} ${isHovered ? 'ring-2 ring-blue-500 ring-inset z-10' : ''} hover:ring-2 hover:ring-green-500`}
                              onMouseEnter={() => setHoveredCell(cellKey)}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => openMeetingModal(di, ti)}
                              title="Click to create meeting"
                            >
                              {total > 0 && (
                                <span className={count === total ? 'text-green-800' : count > 0 ? 'text-gray-700' : 'text-gray-400'}>
                                  {count}/{total}
                                </span>
                              )}

                              {/* Tooltip */}
                              {isHovered && count > 0 && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 pointer-events-none">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                    <div className="font-semibold mb-1">{dates[di]?.display} @ {timeSlots[ti]}</div>
                                    <div className="text-green-300 mb-1">{count} available:</div>
                                    {available.map((sub: any, idx: number) => (
                                      <div key={idx} className="text-gray-300">{'\u2022'} {sub.name}</div>
                                    ))}
                                    {total - count > 0 && (
                                      <div className="text-red-300 mt-1">{total - count} unavailable</div>
                                    )}
                                    <div className="text-blue-300 mt-2 text-center">Click to create meeting</div>
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

      {/* Create Meeting Modal */}
      {showMeetingModal && selectedMeetingSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Create Meeting & Send Invites</h3>
              </div>
              <button
                onClick={() => setShowMeetingModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Selected Time */}
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <div className="text-sm text-green-800 dark:text-green-300 font-medium">Selected Time:</div>
                <div className="text-lg text-green-900 dark:text-green-200 font-semibold">
                  {dates[selectedMeetingSlot.dateIndex]?.fullDate} @ {timeSlots[selectedMeetingSlot.timeIndex]}
                </div>
              </div>

              {/* Meeting Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  placeholder="e.g., John Smith - Phase 1 Meeting"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Location
                </label>
                <input
                  type="text"
                  value={meetingForm.location}
                  onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                  placeholder="e.g., PMI Campus Room 101 or Google Meet link"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration
                </label>
                <select
                  value={meetingForm.duration}
                  onChange={(e) => setMeetingForm({ ...meetingForm, duration: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                  <option value={240}>4 hours</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={meetingForm.description}
                  onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                  placeholder="Additional details about the meeting..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Attendees ({activeRespondents.length})
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {activeRespondents.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No respondents selected</p>
                  ) : (
                    <div className="space-y-1">
                      {activeRespondents.map((sub: any, idx: number) => (
                        <div key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span>{sub.name}</span>
                          <span className="text-gray-400 text-xs">({sub.email})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Google Calendar will send invites to all attendees automatically
                </p>
              </div>

              {/* Result Message */}
              {meetingResult && (
                <div className={`p-3 rounded-lg ${
                  meetingResult.success
                    ? 'bg-green-100 dark:bg-green-900/30 border border-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 border border-red-300'
                }`}>
                  <p className={`text-sm ${meetingResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {meetingResult.message}
                  </p>
                  {meetingResult.link && (
                    <a
                      href={meetingResult.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Google Calendar
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowMeetingModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {meetingResult?.success ? 'Close' : 'Cancel'}
              </button>
              {!meetingResult?.success && (
                <button
                  onClick={handleCreateMeeting}
                  disabled={creatingMeeting || !meetingForm.title || activeRespondents.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {creatingMeeting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="w-4 h-4" />
                      Create Meeting & Send Invites
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Send Email</h3>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  To ({activeRespondents.length} recipients)
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-24 overflow-y-auto">
                  {activeRespondents.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No respondents selected</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {activeRespondents.map((sub: any, idx: number) => (
                        <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  placeholder="Email subject line"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message *
                </label>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  placeholder="Type your message here..."
                  rows={8}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Result Message */}
              {emailResult && (
                <div className={`p-3 rounded-lg ${
                  emailResult.success
                    ? 'bg-green-100 dark:bg-green-900/30 border border-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 border border-red-300'
                }`}>
                  <p className={`text-sm ${emailResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {emailResult.message}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {emailResult?.success ? 'Close' : 'Cancel'}
              </button>
              {!emailResult?.success && (
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailForm.subject || !emailForm.body || activeRespondents.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
