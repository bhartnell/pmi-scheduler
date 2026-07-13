// PALS testing grading — offline queue + draft persistence (client-side only).
//
// Per docs/pals/PALS_Grading_Model_Spec.md §6: "local persistence surviving
// reload and sustained outage, sync on reconnect" — this is a HARD requirement
// because PALS certification testing happens on a tablet in a lab, where wifi
// is not guaranteed. The ACLS megacode station never built this piece beyond
// the client_uuid dedup key (see docs/CHANGELOG.md commit fe165b37 — "Pending:
// ...then offline phase"), so there's nothing to reuse here beyond that
// dedup convention.
//
// Two localStorage-backed pieces:
//   1. A DRAFT of the in-progress (not-yet-submitted) attempt, keyed by a
//      client_uuid minted when grading starts — survives a reload mid-grade.
//   2. A QUEUE of submitted-but-not-yet-synced attempts (save failed because
//      the tablet was offline) — flushed on reconnect / next load.

import type { SavePalsAttemptInput } from '@/types/pals';

const QUEUE_KEY = 'pals_offline_queue_v1';
const DRAFT_KEY_PREFIX = 'pals_draft_v1_';

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function mintClientUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers/webviews without crypto.randomUUID.
  return `pals-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ── Draft (in-progress, unsaved form state) ──

export function saveDraft(clientUuid: string, draft: unknown): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(DRAFT_KEY_PREFIX + clientUuid, JSON.stringify(draft));
  } catch {
    // best-effort — storage full/unavailable must not block grading
  }
}

export function loadDraft<T = unknown>(clientUuid: string): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY_PREFIX + clientUuid);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearDraft(clientUuid: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(DRAFT_KEY_PREFIX + clientUuid);
  } catch {
    // ignore
  }
}

// ── Queue (submitted, pending sync) ──

function readQueue(): SavePalsAttemptInput[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SavePalsAttemptInput[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: SavePalsAttemptInput[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best-effort
  }
}

export function queueAttempt(payload: SavePalsAttemptInput): void {
  const queue = readQueue();
  // client_uuid dedup — never enqueue the same attempt twice.
  if (queue.some((q) => q.client_uuid && q.client_uuid === payload.client_uuid)) return;
  queue.push(payload);
  writeQueue(queue);
}

export function getQueuedAttempts(): SavePalsAttemptInput[] {
  return readQueue();
}

export function removeQueuedAttempt(clientUuid: string | null | undefined): void {
  if (!clientUuid) return;
  writeQueue(readQueue().filter((q) => q.client_uuid !== clientUuid));
}

export function queueLength(): number {
  return readQueue().length;
}

/**
 * Try to POST every queued attempt. Each success (including a server-side
 * dedup — the row already exists) removes it from the queue; a network
 * failure stops the flush and leaves the remainder queued for next time.
 */
export async function flushQueue(
  post: (payload: SavePalsAttemptInput) => Promise<{ success: boolean }>
): Promise<{ synced: number; remaining: number }> {
  const queue = readQueue();
  let synced = 0;
  for (const payload of queue) {
    try {
      const res = await post(payload);
      if (res.success) {
        removeQueuedAttempt(payload.client_uuid);
        synced++;
      } else {
        break; // server rejected it (not a network error) — stop, keep the rest queued
      }
    } catch {
      break; // still offline — stop, keep the rest queued for the next attempt
    }
  }
  return { synced, remaining: queueLength() };
}
