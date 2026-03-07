'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateInfo } from './types';

interface SchedulerCalendarProps {
  dates: DateInfo[];
  timeSlots: string[];
  isMobile: boolean;
  schedulingMode: 'individual' | 'group' | null;
  // Desktop grid
  columnWidth?: string;
  labelWidth?: string;
  onMouseUp?: () => void;
  renderDesktopCell: (dateIndex: number, timeIndex: number, slotKey: string) => React.ReactNode;
  // Mobile day-by-day
  currentDayIndex: number;
  onDayChange: (index: number) => void;
  renderMobileSlot: (dateIndex: number, timeIndex: number, slotKey: string) => React.ReactNode;
  renderDayDot?: (dateIndex: number) => React.ReactNode;
  // Optional: extra content above the grid (legend, instructions)
  children?: React.ReactNode;
}

export default function SchedulerCalendar({
  dates,
  timeSlots,
  isMobile,
  schedulingMode,
  columnWidth,
  labelWidth,
  onMouseUp,
  renderDesktopCell,
  currentDayIndex,
  onDayChange,
  renderMobileSlot,
  renderDayDot,
  children,
}: SchedulerCalendarProps) {
  const goToPreviousDay = () => onDayChange(Math.max(0, currentDayIndex - 1));
  const goToNextDay = () => onDayChange(Math.min(dates.length - 1, currentDayIndex + 1));

  const effectiveLabelWidth = labelWidth || (schedulingMode === 'group' ? '140px' : '80px');
  const effectiveColumnWidth = columnWidth || (schedulingMode === 'group' ? '90px' : '80px');

  return (
    <>
      {children}

      {isMobile ? (
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
            {dates.map((_, i) => (
              <React.Fragment key={i}>
                {renderDayDot ? renderDayDot(i) : (
                  <button
                    onClick={() => onDayChange(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === currentDayIndex ? 'bg-blue-600 scale-125' : 'bg-gray-300'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Time slots for current day */}
          <div className="space-y-2">
            {timeSlots.map((_, ti) => {
              const slotKey = `${currentDayIndex}-${ti}`;
              return (
                <React.Fragment key={ti}>
                  {renderMobileSlot(currentDayIndex, ti, slotKey)}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        /* Desktop: Grid view */
        <div
          className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0"
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div className="inline-block min-w-full select-none">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${effectiveLabelWidth} repeat(${dates.length}, ${effectiveColumnWidth})`,
              }}
            >
              <div className="p-2 bg-gray-50 border-b-2"></div>
              {dates.map((d, i) => (
                <div
                  key={i}
                  className="p-2 text-center text-xs md:text-sm bg-gray-50 border-b-2 font-medium text-gray-900"
                >
                  {isMobile ? d.shortDisplay : d.display}
                </div>
              ))}
              {timeSlots.map((t, ti) => (
                <React.Fragment key={ti}>
                  <div className="p-2 text-xs md:text-sm font-medium bg-gray-50 border-r border-b text-gray-900">
                    {t}
                  </div>
                  {dates.map((_, di) => {
                    const slotKey = `${di}-${ti}`;
                    return (
                      <React.Fragment key={slotKey}>
                        {renderDesktopCell(di, ti, slotKey)}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
