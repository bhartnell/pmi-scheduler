import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { checkInstructorAvailability } from '@/lib/calendar-availability';

// ─── In-memory cache ────────────────────────────────────────────────
// 2026-05-26 perf incident: live lab logs showed 7 availability
// requests each taking 3–4 seconds (Google FreeBusy round trips).
// Most are repeat lookups within seconds of each other — coordinators
// clicking around the schedule view, picker components fanning out
// the same date/time range for the same instructor pool.
//
// Cache hits are keyed by the exact query shape (sorted emails +
// date + start + end). 5-min TTL is short enough that schedule
// changes are quickly reflected but long enough to absorb the burst
// of repeat lookups during a planning session.
//
// Per-instance memory (Vercel functions share state across warm
// requests but not cold starts) — exactly the cache shape we need
// for this workload. No external store dependency.
type CacheEntry = { value: unknown; expiresAt: number };
const availabilityCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(emails: string[], date: string, startTime: string, endTime: string): string {
  // Lowercase emails before sorting so `Bob@pmi.edu` and `bob@pmi.edu`
  // hash to the same cache entry. The downstream Google FreeBusy API
  // is case-insensitive on email so the result IS the same either way.
  const normalized = [...emails].map((e) => e.toLowerCase()).sort();
  return `${normalized.join(',')}|${date}|${startTime}|${endTime}`;
}

function getCached(key: string): unknown | null {
  const hit = availabilityCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    availabilityCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key: string, value: unknown): void {
  availabilityCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  // Cheap GC: if the map balloons, drop the oldest 25%. Cap at 500.
  if (availabilityCache.size > 500) {
    const keys = Array.from(availabilityCache.keys()).slice(0, 125);
    for (const k of keys) availabilityCache.delete(k);
  }
}

/**
 * GET /api/calendar/availability
 * Query instructor calendar availability via Google FreeBusy API.
 *
 * Query params:
 *   emails - comma-separated email addresses
 *   date   - ISO date string (YYYY-MM-DD)
 *   startTime - HH:mm
 *   endTime   - HH:mm
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const emailsParam = searchParams.get('emails');
  const date = searchParams.get('date');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');

  if (!emailsParam || !date || !startTime || !endTime) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required query params: emails, date, startTime, endTime',
      },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { success: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
      { status: 400 }
    );
  }

  // Validate time format
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return NextResponse.json(
      { success: false, error: 'Invalid time format. Expected HH:mm' },
      { status: 400 }
    );
  }

  const emails = emailsParam
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid emails provided' },
      { status: 400 }
    );
  }

  // Limit to 20 emails per request to prevent abuse
  if (emails.length > 20) {
    return NextResponse.json(
      { success: false, error: 'Maximum 20 emails per request' },
      { status: 400 }
    );
  }

  try {
    // Cache hit path — Google FreeBusy round-trips are 3-4s on a
    // good day and the answer is the same across rapid repeats.
    const key = cacheKey(emails, date, startTime, endTime);
    const cached = getCached(key);
    if (cached !== null) {
      const res = NextResponse.json({ success: true, availability: cached, cached: true });
      res.headers.set('X-Cache', 'HIT');
      return res;
    }

    const availability = await checkInstructorAvailability(
      emails,
      date,
      startTime,
      endTime
    );
    setCached(key, availability);

    const res = NextResponse.json({ success: true, availability });
    res.headers.set('X-Cache', 'MISS');
    return res;
  } catch (err) {
    console.error('Calendar availability error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}
