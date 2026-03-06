'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

type AvailabilityStatus = 'free' | 'partial' | 'busy' | 'disconnected';

interface BusyPeriod {
  start: string;
  end: string;
}

interface AvailabilityInfo {
  status: AvailabilityStatus;
  events: { title: string; start: string; end: string }[];
}

/**
 * Hook to fetch Google Calendar availability for a list of instructor emails
 * on a given date and time range.
 *
 * Uses the existing /api/calendar/availability endpoint which expects:
 *   ?emails=a@b.com,c@d.com&date=YYYY-MM-DD&startTime=HH:mm&endTime=HH:mm
 *
 * Returns a Map keyed by email with status + events info.
 */
export function useCalendarAvailability(
  date: string | null,
  emails: string[],
  startTime: string = '08:00',
  endTime: string = '17:00'
) {
  const [availability, setAvailability] = useState<Map<string, AvailabilityInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ free: 0, total: 0 });

  // Stable key derived from sorted, filtered emails to avoid refetching on reference changes
  const filteredEmails = useMemo(() => emails.filter(Boolean), [emails]);
  const emailsKey = useMemo(() => filteredEmails.sort().join(','), [filteredEmails]);
  const prevKeyRef = useRef('');

  // Determine if we should fetch
  const shouldFetch = Boolean(date && filteredEmails.length > 0);

  useEffect(() => {
    if (!shouldFetch || !date) {
      return;
    }

    // Skip if same request
    const requestKey = `${date}:${emailsKey}:${startTime}:${endTime}`;
    if (requestKey === prevKeyRef.current) return;
    prevKeyRef.current = requestKey;

    let cancelled = false;

    const fetchAvailability = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          emails: filteredEmails.join(','),
          date,
          startTime,
          endTime,
        });

        const res = await fetch(`/api/calendar/availability?${params}`);
        if (cancelled) return;

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (!data.success || !data.availability) {
          setLoading(false);
          return;
        }

        const availMap = new Map<string, AvailabilityInfo>();
        let freeCount = 0;

        // data.availability is Record<string, InstructorAvailability>
        // where InstructorAvailability = { connected: boolean; busy: BusyPeriod[]; available: boolean }
        for (const [email, item] of Object.entries(data.availability) as [string, { connected: boolean; busy: BusyPeriod[]; available: boolean }][]) {
          let status: AvailabilityStatus;

          if (!item.connected) {
            status = 'disconnected';
          } else if (item.busy.length === 0) {
            status = 'free';
            freeCount++;
          } else {
            // Determine if busy covers most of the time window
            const dayStart = new Date(`${date}T${startTime}:00`).getTime();
            const dayEnd = new Date(`${date}T${endTime}:00`).getTime();
            const totalBusy = item.busy.reduce((acc: number, b: BusyPeriod) => {
              const bStart = Math.max(new Date(b.start).getTime(), dayStart);
              const bEnd = Math.min(new Date(b.end).getTime(), dayEnd);
              return acc + Math.max(0, bEnd - bStart);
            }, 0);
            const dayLength = dayEnd - dayStart;

            if (dayLength > 0 && totalBusy >= dayLength * 0.8) {
              status = 'busy';
            } else {
              status = 'partial';
              freeCount++;
            }
          }

          availMap.set(email.toLowerCase(), {
            status,
            events: item.busy.map((b: BusyPeriod) => ({
              title: 'Busy',
              start: b.start,
              end: b.end,
            })),
          });
        }

        if (!cancelled) {
          setAvailability(availMap);
          setSummary({ free: freeCount, total: filteredEmails.length });
        }
      } catch (err) {
        console.error('Error fetching calendar availability:', err);
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    fetchAvailability();

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, date, emailsKey, startTime, endTime, filteredEmails]);

  // Return empty map when there's nothing to fetch
  if (!shouldFetch) {
    return { availability: new Map<string, AvailabilityInfo>(), loading: false, summary: { free: 0, total: 0 } };
  }

  return { availability, loading, summary };
}
