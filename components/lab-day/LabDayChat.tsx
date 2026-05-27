'use client';

// ──────────────────────────────────────────────────────────────────────
// LabDayChat — feature-flag gated wrapper.
//
// The realtime chat component (in LabDayChatInner) was stubbed out
// during the 2026-05-26 perf incident (commit fcfd4ec5). It's been
// restored, but now lives behind the `feature.lab_day_chat` system
// setting so admins can toggle it on/off without redeploying.
//
//   Setting value | Behavior
//   ──────────────┼──────────────────────────────────────────────
//   'true'        | Renders the full LabDayChatInner with realtime
//   'false' / ⌀   | Renders nothing — zero realtime, zero DOM
//
// The flag is fetched once per mount via /api/system-settings/feature.lab_day_chat.
// Browser cache (Cache-Control: private, max-age=10) absorbs the
// repeat reads from multiple call sites on the same page.
//
// Toggle from /admin/settings.
// ──────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import LabDayChatInner from './LabDayChatInner';

interface LabDayChatProps {
  labDayId: string;
  senderName: string;
  senderEmail: string;
  senderRole: string;
  stationContext?: string;
  volunteerToken?: string;
  bottomOffset?: number;
  defaultOpen?: boolean;
}

// Module-level cache so multiple <LabDayChat> mounts on the same
// page (lab day view + grading panel + …) only fetch the flag once.
// Cleared on full page reload; that's fine, flag changes are rare.
let cachedEnabled: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

async function fetchChatEnabled(): Promise<boolean> {
  if (cachedEnabled !== null) return cachedEnabled;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/system-settings/feature.lab_day_chat');
      if (!res.ok) {
        cachedEnabled = false;
        return false;
      }
      const data = await res.json();
      cachedEnabled = data?.value === 'true';
      return cachedEnabled;
    } catch {
      cachedEnabled = false;
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export default function LabDayChat(props: LabDayChatProps) {
  // null while we're checking; once known, true renders the chat,
  // false renders nothing. Don't flash any "loading" UI — a brief
  // delay before chat appears is fine, and a stub banner during
  // a fast page swap would be jarring.
  const [enabled, setEnabled] = useState<boolean | null>(cachedEnabled);

  useEffect(() => {
    let cancelled = false;
    fetchChatEnabled().then((val) => {
      if (!cancelled) setEnabled(val);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;
  return <LabDayChatInner {...props} />;
}
