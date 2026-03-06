'use client';

import { useState, useRef } from 'react';

interface CalendarEvent {
  title: string;
  start: string;
  end: string;
}

interface Props {
  status: 'free' | 'partial' | 'busy' | 'disconnected';
  events?: CalendarEvent[];
  size?: 'sm' | 'md';
}

const statusColors = {
  free: 'bg-green-500',
  partial: 'bg-yellow-500',
  busy: 'bg-red-500',
  disconnected: 'bg-gray-400',
};

const statusLabels = {
  free: 'Calendar free',
  partial: 'Partially busy',
  busy: 'Busy all day',
  disconnected: 'Calendar not connected',
};

export default function CalendarAvailabilityDot({ status, events, size = 'sm' }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      ref={ref}
    >
      <span
        className={`${sizeClass} rounded-full ${statusColors[status]} inline-block shrink-0`}
        title={statusLabels[status]}
      />
      {showTooltip && (events?.length || status === 'disconnected') && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-xs">
          <div className="font-medium mb-1">{statusLabels[status]}</div>
          {events?.map((e, i) => (
            <div key={i} className="text-gray-300">
              {e.title}: {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(e.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          ))}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
