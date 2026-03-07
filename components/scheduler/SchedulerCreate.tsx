'use client';

import React, { useState, useEffect } from 'react';
import { UserCheck, UsersRound, ArrowLeft } from 'lucide-react';
import SchedulerCalendar from './SchedulerCalendar';
import { generateTimeSlots, generateDates } from './utils';
import type { PollConfig } from './types';

interface SchedulerCreateProps {
  pollData?: any;
  onComplete?: (data: any) => void;
}

export default function SchedulerCreate({ pollData, onComplete }: SchedulerCreateProps) {
  const [schedulingMode, setSchedulingMode] = useState<'individual' | 'group' | null>(pollData?.mode || null);
  const [view, setView] = useState<'mode-select' | 'setup'>('mode-select');
  const [pollConfig, setPollConfig] = useState<PollConfig>({
    title: pollData?.title || '',
    description: pollData?.description || '',
    startDate: pollData?.start_date || '',
    numWeeks: pollData?.num_weeks || 2,
    weekdaysOnly: pollData?.weekdays_only ?? true,
  });
  const [creatorSelectedSlots, setCreatorSelectedSlots] = useState<string[]>(
    pollData?.available_slots
      ? typeof pollData.available_slots === 'string'
        ? JSON.parse(pollData.available_slots)
        : pollData.available_slots
      : []
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ date: number; time: number } | null>(null);
  const [loading] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const timeSlots = generateTimeSlots(schedulingMode);
  const dates = generateDates(pollConfig, schedulingMode);

  // Toggle slot selection for creator (single click / tap)
  const toggleCreatorSlot = (dateIdx: number, timeIdx: number) => {
    const key = `${dateIdx}-${timeIdx}`;
    setCreatorSelectedSlots(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Drag selection handlers for creator
  const handleCreatorMouseDown = (dateIdx: number, timeIdx: number) => {
    if (isMobile) {
      toggleCreatorSlot(dateIdx, timeIdx);
      return;
    }
    setIsSelecting(true);
    setSelectionStart({ date: dateIdx, time: timeIdx });
    toggleCreatorSlot(dateIdx, timeIdx);
  };

  const handleCreatorMouseEnter = (dateIdx: number, timeIdx: number) => {
    if (isMobile || !isSelecting || !selectionStart) return;
    const key = `${dateIdx}-${timeIdx}`;
    const startKey = `${selectionStart.date}-${selectionStart.time}`;
    const shouldSelect = creatorSelectedSlots.includes(startKey);

    setCreatorSelectedSlots(prev => {
      if (shouldSelect && !prev.includes(key)) return [...prev, key];
      if (!shouldSelect && prev.includes(key)) return prev.filter(k => k !== key);
      return prev;
    });
  };

  const handleCreatorMouseUp = () => {
    setIsSelecting(false);
    setSelectionStart(null);
  };

  // Select all slots
  const selectAllSlots = () => {
    const allSlots: string[] = [];
    dates.forEach((_, di) => {
      timeSlots.forEach((_, ti) => {
        allSlots.push(`${di}-${ti}`);
      });
    });
    setCreatorSelectedSlots(allSlots);
  };

  // Clear all slots
  const clearAllSlots = () => {
    setCreatorSelectedSlots([]);
  };

  // Mode Selection View
  if (view === 'mode-select') {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 md:mb-3">Select Poll Type</h1>
          <p className="text-gray-700 text-sm md:text-base">Choose the type of scheduling poll to create</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <button
            onClick={() => { setSchedulingMode('individual'); setView('setup'); }}
            className="bg-white rounded-xl shadow-lg p-6 md:p-8 hover:shadow-xl transition-all active:scale-98 text-left"
          >
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-blue-100 rounded-lg"><UserCheck className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /></div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Individual Meeting</h2>
            </div>
            <p className="text-gray-700 mb-3 md:mb-4 text-sm md:text-base">One-on-one internship check-ins with student, FTO, and instructor.</p>
            <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-600">
              <li>{'\u2022'} Hourly time slots (6 AM - 8 PM)</li>
              <li>{'\u2022'} Initial, mid-point, or final meetings</li>
            </ul>
          </button>
          <button
            onClick={() => { setSchedulingMode('group'); setPollConfig(p => ({ ...p, numWeeks: 3 })); setView('setup'); }}
            className="bg-white rounded-xl shadow-lg p-6 md:p-8 hover:shadow-xl transition-all active:scale-98 text-left"
          >
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-purple-100 rounded-lg"><UsersRound className="w-6 h-6 md:w-8 md:h-8 text-purple-600" /></div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Group Session</h2>
            </div>
            <p className="text-gray-700 mb-3 md:mb-4 text-sm md:text-base">Testing days, competencies, or orientation with multiple students.</p>
            <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-600">
              <li>{'\u2022'} Half-day or full-day blocks</li>
              <li>{'\u2022'} Skills testing or assessments</li>
            </ul>
          </button>
        </div>
      </div>
    );
  }

  // Setup/Preview View
  const canCreate = pollConfig.title.trim() && pollConfig.startDate && creatorSelectedSlots.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">
          Create {schedulingMode === 'individual' ? 'Individual Meeting' : 'Group Session'} Poll
        </h1>

        {/* Poll Configuration Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poll Title *</label>
            <input
              type="text"
              value={pollConfig.title}
              onChange={(e) => setPollConfig(p => ({ ...p, title: e.target.value }))}
              placeholder={schedulingMode === 'individual' ? 'e.g., John Smith - Phase 1 Meeting' : 'e.g., Capstone Skills Testing - Group A'}
              className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={pollConfig.description}
              onChange={(e) => setPollConfig(p => ({ ...p, description: e.target.value }))}
              placeholder="Additional details about this scheduling poll..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={pollConfig.startDate}
                onChange={(e) => {
                  setPollConfig(p => ({ ...p, startDate: e.target.value }));
                  setCreatorSelectedSlots([]);
                }}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Weeks</label>
              <select
                value={pollConfig.numWeeks}
                onChange={(e) => {
                  setPollConfig(p => ({ ...p, numWeeks: parseInt(e.target.value) }));
                  setCreatorSelectedSlots([]);
                }}
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
              >
                <option value={1}>1 week</option>
                <option value={2}>2 weeks</option>
                <option value={3}>3 weeks</option>
                <option value={4}>4 weeks</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Days to Include</label>
              <select
                value={pollConfig.weekdaysOnly ? 'weekdays' : 'all'}
                onChange={(e) => {
                  setPollConfig(p => ({ ...p, weekdaysOnly: e.target.value === 'weekdays' }));
                  setCreatorSelectedSlots([]);
                }}
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
              >
                <option value="weekdays">Weekdays Only</option>
                <option value="all">All Days (incl. weekends)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-3 md:p-4 rounded-lg mb-4">
          <h3 className="font-semibold text-blue-900 mb-2 text-sm md:text-base">Poll Settings Summary:</h3>
          <ul className="space-y-1 text-xs md:text-sm text-blue-800">
            <li>{'\u2022'} Type: {schedulingMode === 'individual' ? 'Individual Meeting' : 'Group Session'}</li>
            <li>{'\u2022'} Time Slots: {schedulingMode === 'individual' ? 'Hourly (6 AM - 8 PM)' : 'Half-day blocks'}</li>
            <li>{'\u2022'} Duration: {pollConfig.numWeeks} week{pollConfig.numWeeks > 1 ? 's' : ''}, {pollConfig.weekdaysOnly ? 'weekdays only' : 'all days'}</li>
            <li>{'\u2022'} <strong>{creatorSelectedSlots.length} time slots selected</strong> for participants to choose from</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => setView('mode-select')} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-900 text-sm md:text-base">
            <ArrowLeft className="w-4 h-4 inline mr-2" />Back
          </button>
          <button
            onClick={() => {
              if (onComplete) {
                onComplete({ ...pollConfig, mode: schedulingMode, availableSlots: creatorSelectedSlots });
              }
            }}
            disabled={!canCreate || loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm md:text-base"
          >
            {loading ? 'Creating...' : `\u2713 Create Poll (${creatorSelectedSlots.length} slots)`}
          </button>
        </div>
        {!creatorSelectedSlots.length && pollConfig.startDate && (
          <p className="text-sm text-red-600 mt-2">Please select at least one time slot below for participants to choose from.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Select Available Time Slots *</h2>
            <p className="text-sm text-gray-600">Click on cells to select which times participants can choose from.</p>
          </div>
          {pollConfig.startDate && (
            <div className="flex gap-2">
              <button
                onClick={selectAllSlots}
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                Select All
              </button>
              <button
                onClick={clearAllSlots}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {!pollConfig.startDate && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">Select a start date above to see the calendar.</p>
          </div>
        )}
        {pollConfig.startDate && (
          <SchedulerCalendar
            dates={dates}
            timeSlots={timeSlots}
            isMobile={isMobile}
            schedulingMode={schedulingMode}
            currentDayIndex={currentDayIndex}
            onDayChange={setCurrentDayIndex}
            onMouseUp={handleCreatorMouseUp}
            renderDesktopCell={(di, ti, slotKey) => {
              const isSelected = creatorSelectedSlots.includes(slotKey);
              return (
                <div
                  onMouseDown={() => handleCreatorMouseDown(di, ti)}
                  onMouseEnter={() => handleCreatorMouseEnter(di, ti)}
                  onTouchStart={() => toggleCreatorSlot(di, ti)}
                  className={`p-2 md:p-3 border-r border-b transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-green-400 hover:bg-green-500'
                      : 'bg-white hover:bg-blue-50'
                  }`}
                />
              );
            }}
            renderMobileSlot={(di, ti) => {
              const slotKey = `${di}-${ti}`;
              const isSelected = creatorSelectedSlots.includes(slotKey);
              return (
                <button
                  onClick={() => toggleCreatorSlot(di, ti)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-green-500 bg-green-100 text-green-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{timeSlots[ti]}</span>
                    {isSelected && (
                      <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            }}
          >
            {/* Legend and instructions */}
            <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Legend:</span>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 bg-white border-2 border-gray-300 rounded"></div>
                <span className="text-xs text-gray-600">Not available</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 bg-green-400 border-2 border-green-500 rounded"></div>
                <span className="text-xs text-gray-600">Available for selection</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {isMobile ? (
                <><strong>Tap</strong> time slots to select. Scroll horizontally to see all dates {'\u2192'}</>
              ) : (
                <><strong>Click and drag</strong> to select multiple slots at once</>
              )}
            </p>
          </SchedulerCalendar>
        )}
      </div>
    </div>
  );
}
