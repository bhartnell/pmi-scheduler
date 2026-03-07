'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Send } from 'lucide-react';
import SchedulerCalendar from './SchedulerCalendar';
import { generateTimeSlots, generateDates, agencies, respondentRoles } from './utils';
import type { PollConfig, StudentData } from './types';

interface SchedulerParticipantProps {
  pollData?: any;
  onComplete?: (data: any) => void;
}

export default function SchedulerParticipant({ pollData, onComplete }: SchedulerParticipantProps) {
  const [view, setView] = useState<'participant-form' | 'submitted'>('participant-form');
  const [studentData, setStudentData] = useState<StudentData>({
    name: '', email: '', agency: '', role: 'student', availability: [],
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ date: number; time: number } | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const schedulingMode = pollData?.mode || null;

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

  // Get available slots from poll data (if creator selected specific slots)
  const pollAvailableSlots: string[] = pollData?.available_slots
    ? (typeof pollData.available_slots === 'string' ? JSON.parse(pollData.available_slots) : pollData.available_slots)
    : [];
  const hasSlotRestrictions = pollAvailableSlots.length > 0;

  const isSlotAvailable = (di: number, ti: number) => {
    if (!hasSlotRestrictions) return true;
    return pollAvailableSlots.includes(`${di}-${ti}`);
  };

  const dayHasAvailableSlots = (dayIndex: number) => {
    if (!hasSlotRestrictions) return true;
    return timeSlots.some((_, ti) => isSlotAvailable(dayIndex, ti));
  };

  // Touch-friendly toggle for mobile
  const handleCellTap = useCallback((dateIdx: number, timeIdx: number) => {
    const key = `${dateIdx}-${timeIdx}`;
    setStudentData(prev => ({
      ...prev,
      availability: prev.availability.includes(key)
        ? prev.availability.filter(k => k !== key)
        : [...prev.availability, key],
    }));
  }, []);

  // Desktop drag handlers
  const handleMouseDown = (dateIdx: number, timeIdx: number) => {
    if (isMobile) {
      handleCellTap(dateIdx, timeIdx);
      return;
    }
    setIsSelecting(true);
    setSelectionStart({ date: dateIdx, time: timeIdx });
    toggleAvailability(dateIdx, timeIdx, true);
  };

  const handleMouseEnter = (dateIdx: number, timeIdx: number) => {
    if (isMobile) return;
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
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pollId: pollData?.id,
        name: studentData.name,
        email: studentData.email,
        agency: studentData.agency,
        respondentRole: studentData.role,
        availability: studentData.availability,
      }),
    });
    const result = await response.json();
    if (result.success) {
      setSubmissionId(result.submission.id);
      setView('submitted');
    }
    setLoading(false);
  };

  // Submitted View
  if (view === 'submitted') {
    return (
      <div className="max-w-md mx-auto px-4 bg-white rounded-xl shadow-lg p-6 md:p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">Availability Submitted!</h1>
        <p className="text-gray-700 mb-6 text-sm md:text-base">Thank you, {studentData.name}. The coordinator will contact you with the meeting time.</p>
        <button onClick={() => setView('participant-form')} className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-base">
          Edit My Availability
        </button>
      </div>
    );
  }

  // Participant Form View
  return (
    <div className="max-w-7xl mx-auto px-4" onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp}>
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{pollData?.title}</h1>
        {pollData?.description && <p className="text-gray-700 text-sm md:text-base">{pollData.description}</p>}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">Your Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <input
            type="text"
            value={studentData.name}
            onChange={(e) => setStudentData(p => ({ ...p, name: e.target.value }))}
            placeholder="Name"
            className="px-3 py-3 md:py-2 border rounded-md text-gray-900 bg-white text-base"
          />
          <input
            type="email"
            value={studentData.email}
            onChange={(e) => setStudentData(p => ({ ...p, email: e.target.value }))}
            placeholder="Email"
            className="px-3 py-3 md:py-2 border rounded-md text-gray-900 bg-white text-base"
          />
          <select
            value={studentData.agency}
            onChange={(e) => setStudentData(p => ({ ...p, agency: e.target.value }))}
            className="px-3 py-3 md:py-2 border rounded-md text-gray-900 bg-white text-base"
          >
            <option value="">Select agency</option>
            {agencies.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={studentData.role}
            onChange={(e) => setStudentData(p => ({ ...p, role: e.target.value }))}
            className="px-3 py-3 md:py-2 border rounded-md text-gray-900 bg-white text-base"
          >
            <option value="">Select your role</option>
            {respondentRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Select Available Times</h2>
          {studentData.availability.length > 0 && (
            <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full">
              {studentData.availability.length} slot{studentData.availability.length !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>

        <SchedulerCalendar
          dates={dates}
          timeSlots={timeSlots}
          isMobile={isMobile}
          schedulingMode={schedulingMode}
          columnWidth="100px"
          currentDayIndex={currentDayIndex}
          onDayChange={setCurrentDayIndex}
          onMouseUp={handleMouseUp}
          renderDesktopCell={(di, ti, slotKey) => {
            const isSelected = studentData.availability.includes(slotKey);
            const isAvail = isSlotAvailable(di, ti);

            if (!isAvail) {
              return (
                <div
                  className="border-r border-b bg-gray-200"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(156, 163, 175, 0.4) 5px, rgba(156, 163, 175, 0.4) 10px)',
                  }}
                  title="Not available for this poll"
                />
              );
            }

            return (
              <button
                onMouseDown={() => handleMouseDown(di, ti)}
                onMouseEnter={() => handleMouseEnter(di, ti)}
                className={`p-3 border-r border-b transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-green-400 hover:bg-green-500'
                    : 'bg-white hover:bg-blue-50'
                }`}
              />
            );
          }}
          renderMobileSlot={(di, ti) => {
            const slotKey = `${di}-${ti}`;
            const isSelected = studentData.availability.includes(slotKey);
            const isAvail = isSlotAvailable(di, ti);

            if (!isAvail) return null;

            return (
              <button
                onClick={() => handleCellTap(di, ti)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-green-500 bg-green-100 text-green-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{timeSlots[ti]}</span>
                  {isSelected && <CheckCircle className="w-5 h-5 text-green-600" />}
                </div>
              </button>
            );
          }}
          renderDayDot={(i) => {
            const hasSelections = timeSlots.some((_, ti) =>
              studentData.availability.includes(`${i}-${ti}`)
            );
            const hasAvailable = dayHasAvailableSlots(i);
            return (
              <button
                onClick={() => setCurrentDayIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === currentDayIndex
                    ? 'bg-blue-600 scale-125'
                    : hasSelections
                      ? 'bg-green-400'
                      : hasAvailable
                        ? 'bg-gray-300'
                        : 'bg-gray-200 opacity-50'
                }`}
              />
            );
          }}
        >
          {/* Instruction text */}
          <p className="text-sm text-gray-700 mb-4">
            {isMobile ? (
              <><strong>Tap</strong> time slots to select your availability</>
            ) : (
              <><strong>Click and drag</strong> to select multiple slots</>
            )}
          </p>

          {/* Legend for desktop */}
          {!isMobile && hasSlotRestrictions && (
            <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Legend:</span>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 bg-white border-2 border-gray-300 rounded"></div>
                <span className="text-xs text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 bg-green-400 border-2 border-green-500 rounded"></div>
                <span className="text-xs text-gray-600">Selected</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-5 h-5 bg-gray-200 border rounded"
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(156, 163, 175, 0.4) 3px, rgba(156, 163, 175, 0.4) 6px)' }}
                ></div>
                <span className="text-xs text-gray-600">Not available</span>
              </div>
            </div>
          )}
        </SchedulerCalendar>

        {/* Mobile: "No available slots" message */}
        {isMobile && !dayHasAvailableSlots(currentDayIndex) && (
          <p className="text-center text-gray-500 py-4">No available time slots on this day.</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!studentData.name || !studentData.email || !studentData.availability.length || loading}
          className="mt-6 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-base"
        >
          <Send className="w-5 h-5" /> {loading ? 'Submitting...' : 'Submit Availability'}
        </button>
      </div>
    </div>
  );
}
