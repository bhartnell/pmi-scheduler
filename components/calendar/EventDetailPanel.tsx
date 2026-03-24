'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X,
  Clock,
  Users,
  MapPin,
  BookOpen,
  FileText,
  ExternalLink,
  Calendar,
  Layers,
  Loader2,
  CalendarPlus,
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  source: 'planner' | 'lab_day' | 'lvfr' | 'clinical' | 'shift' | 'meeting';
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  program?: 'paramedic' | 'emt' | 'aemt' | 'lvfr' | 'other';
  color: string;
  cohort_number?: number;
  instructor_names?: string[];
  room?: string;
  linked_id?: string;
  linked_url?: string;
  event_type: 'class' | 'lab' | 'exam' | 'clinical' | 'shift' | 'meeting' | 'other';
  status?: 'draft' | 'published' | 'cancelled';
  content_notes?: string;
  linked_lab_day_id?: string;
  metadata?: Record<string, unknown>;
}

interface LabDayDetail {
  id: string;
  title: string | null;
  date: string;
  stations: { id: string; station_name: string; instructor_name: string | null }[];
  attendance_count?: number;
}

interface EventDetailPanelProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
}

const PROGRAM_LABELS: Record<string, string> = {
  paramedic: 'Paramedic',
  emt: 'EMT',
  aemt: 'AEMT',
  lvfr: 'LVFR',
  other: 'Other',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  class: 'Class',
  lab: 'Lab',
  exam: 'Exam',
  clinical: 'Clinical',
  shift: 'Shift',
  meeting: 'Meeting',
  other: 'Other',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', label: 'Draft' },
  published: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Published' },
  cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Cancelled' },
};

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

function downloadSingleEventICS(event: CalendarEvent) {
  const toICSDate = (dateStr: string, time: string): string => {
    const [year, month, day] = dateStr.split('-');
    const timeParts = time.split(':');
    return `${year}${month}${day}T${timeParts[0] || '00'}${timeParts[1] || '00'}00`;
  };

  const descParts: string[] = [];
  if (event.cohort_number) {
    const progLabel = event.program && event.program !== 'other'
      ? event.program.charAt(0).toUpperCase() + event.program.slice(1)
      : '';
    descParts.push(`${progLabel} Group ${event.cohort_number}`.trim());
  }
  if (event.instructor_names && event.instructor_names.length > 0) {
    descParts.push(event.instructor_names.join(', '));
  }
  if (event.content_notes) {
    descParts.push(event.content_notes);
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PMI Paramedic Tools//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PMI Event',
    'X-WR-TIMEZONE:America/Phoenix',
    'BEGIN:VTIMEZONE',
    'TZID:America/Phoenix',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0700',
    'TZNAME:MST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${event.id}@pmi-scheduler`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART;TZID=America/Phoenix:${toICSDate(event.date, event.start_time)}`,
    `DTEND;TZID=America/Phoenix:${toICSDate(event.date, event.end_time)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
  ];

  if (event.room) {
    lines.push(`LOCATION:${escapeICSText(event.room)}`);
  }
  if (descParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeICSText(descParts.join('\n'))}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function EventDetailPanel({ event, open, onClose }: EventDetailPanelProps) {
  const [labDayDetail, setLabDayDetail] = useState<LabDayDetail | null>(null);
  const [labDayLoading, setLabDayLoading] = useState(false);

  // Fetch lab day details if the event is a lab or has a linked_lab_day_id
  useEffect(() => {
    if (!event || !open) {
      setLabDayDetail(null);
      return;
    }

    const labDayId = event.linked_lab_day_id || (event.source === 'lab_day' ? event.linked_id : null);
    if (!labDayId) {
      setLabDayDetail(null);
      return;
    }

    setLabDayLoading(true);
    fetch(`/api/lab-management/lab-days/${labDayId}`)
      .then(r => r.json())
      .then(data => {
        if (data.labDay) {
          setLabDayDetail({
            id: data.labDay.id,
            title: data.labDay.title,
            date: data.labDay.date,
            stations: data.labDay.stations || [],
            attendance_count: data.labDay.attendance_count,
          });
        }
      })
      .catch(() => setLabDayDetail(null))
      .finally(() => setLabDayLoading(false));
  }, [event, open]);

  if (!open || !event) return null;

  const status = event.status || (event.source === 'planner' ? 'draft' : undefined);
  const statusStyle = status ? STATUS_STYLES[status] : undefined;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: event.color }}>
                {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
              </span>
              {statusStyle && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                  {statusStyle.label}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {event.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(event.date)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(event.start_time)} - {formatTime(event.end_time)}
              </div>
            </div>
          </div>

          {/* Program / Cohort */}
          {(event.program || event.cohort_number) && (
            <div className="flex items-start gap-3">
              <BookOpen className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                {event.program && event.program !== 'other' && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block"
                    style={{ backgroundColor: event.color + '20', color: event.color }}
                  >
                    {PROGRAM_LABELS[event.program]}
                  </span>
                )}
                {event.cohort_number && (
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                    Cohort {event.cohort_number}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Room */}
          {event.room && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-900 dark:text-white">{event.room}</span>
            </div>
          )}

          {/* Instructors */}
          {event.instructor_names && event.instructor_names.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-900 dark:text-white">
                {event.instructor_names.map((name, i) => (
                  <div key={i}>{name}</div>
                ))}
              </div>
            </div>
          )}

          {/* Content Notes */}
          {event.content_notes && (
            <div className="flex items-start gap-3">
              <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Content Notes
                </div>
                <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {event.content_notes}
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="flex items-start gap-3">
              <Layers className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                {event.metadata.block_type ? (
                  <div>{'Type: ' + String(event.metadata.block_type)}</div>
                ) : null}
                {event.metadata.program_label ? (
                  <div>{'Schedule: ' + String(event.metadata.program_label)}</div>
                ) : null}
                {event.metadata.station_count !== undefined ? (
                  <div>{String(event.metadata.station_count) + ' station(s)'}</div>
                ) : null}
                {event.metadata.site_name ? (
                  <div>{'Site: ' + String(event.metadata.site_name)}</div>
                ) : null}
                {event.metadata.department ? (
                  <div>{'Department: ' + String(event.metadata.department)}</div>
                ) : null}
              </div>
            </div>
          )}

          {/* Lab Day Details (for linked blocks or lab_day events) */}
          {labDayLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading lab day details...
            </div>
          )}

          {labDayDetail && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers className="h-3 w-3" />
                Lab Day Details
              </div>

              {labDayDetail.attendance_count !== undefined && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Attendance: {labDayDetail.attendance_count} student(s)
                </div>
              )}

              {labDayDetail.stations.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Stations ({labDayDetail.stations.length})
                  </div>
                  {labDayDetail.stations.map((station) => (
                    <div
                      key={station.id}
                      className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-sm"
                    >
                      <span className="text-gray-900 dark:text-white">{station.station_name}</span>
                      {station.instructor_name && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{station.instructor_name}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 space-y-2">
          {/* Open Lab Day */}
          {(event.source === 'lab_day' || event.linked_lab_day_id || labDayDetail) && (
            <Link
              href={labDayDetail ? `/labs/schedule/${labDayDetail.id}` : (event.linked_url || '#')}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open Lab Day
            </Link>
          )}

          {/* Edit in Planner */}
          {event.source === 'planner' && (
            <Link
              href="/academics/planner"
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Edit in Planner
            </Link>
          )}

          {/* View Full Week */}
          <Link
            href={`/calendar?view=week&date=${event.date}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Calendar className="h-4 w-4" />
            View Full Week
          </Link>

          {/* Open source link for non-planner/lab events */}
          {event.source !== 'planner' && event.source !== 'lab_day' && event.linked_url && (
            <Link
              href={event.linked_url}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open Details
            </Link>
          )}

          {/* Add to Calendar (.ics download) */}
          <button
            onClick={() => downloadSingleEventICS(event)}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          >
            <CalendarPlus className="h-4 w-4" />
            Add to Calendar
          </button>
        </div>
      </div>
    </>
  );
}
