'use client';

// ──────────────────────────────────────────────────────────────────────
// LabDayChat — TEMPORARILY DISABLED (2026-05-26)
//
// Mitigation for site-wide performance issues during live lab. Even
// after the May 23 + May 26 reconnect fixes (commits 56a03c1d,
// a1f29c2d), instructors continued to report sluggishness during a
// live lab session. To eliminate the entire LabDayChat surface as a
// possible cause without removing the call sites, the component now
// renders an inert placeholder (or nothing, when collapsed). The
// realtime subscription, presence tracking, message polling,
// reconnect machinery, and DOM-heavy chat UI are all SHORT-CIRCUITED.
//
// The original ~700-line implementation is preserved in git history:
//   git show 90ecef68:components/lab-day/LabDayChat.tsx
//
// Restore plan (when the cause is identified or a lighter chat is
// designed): revert this file to the prior version, OR build a new
// chat component behind a feature flag.
//
// Call sites that still import this component (no edits needed —
// component honors the same prop signature):
//   - app/labs/schedule/[id]/page.tsx
//   - app/labs/grade/station/[id]/page.tsx
// ──────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

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

export default function LabDayChat(_props: LabDayChatProps) {
  // Use the bottomOffset prop so it doesn't show as unused, but never
  // actually mount the chat UI. The dismissible banner above is
  // optional — operators can hide it if they don't want any visual.
  const { bottomOffset } = _props;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="fixed right-4 z-30 print:hidden"
      style={{ bottom: `${bottomOffset ?? 16}px` }}
      role="status"
      aria-label="Chat temporarily unavailable"
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 max-w-xs">
        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1">Chat temporarily unavailable</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
