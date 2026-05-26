'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, SendHorizontal } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LabDayChatProps {
  labDayId: string;
  senderName: string;
  senderEmail: string;
  senderRole: string;
  stationContext?: string;
  volunteerToken?: string;
  bottomOffset?: number;
  /**
   * Default open state used ONLY on first mount when the user has no
   * explicit localStorage preference yet. Grading pages pass `true` on
   * NREMT days so the chat surfaces automatically, while still respecting
   * a user who has explicitly closed it before (we persist the choice).
   */
  defaultOpen?: boolean;
}

// localStorage key for persisting open/closed state across navigations.
const CHAT_OPEN_KEY = 'labday-chat-open';

interface ChatMessage {
  id: string;
  lab_day_id: string;
  sender_name: string;
  sender_email: string;
  sender_role: string;
  message: string;
  message_type: 'chat' | 'alert' | 'system';
  station_context?: string;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function roleBadgeColor(role: string): string {
  switch (role) {
    case 'coordinator':
    case 'superadmin':
    case 'admin':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'instructor':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'volunteer':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

// ─── Quick Actions ──────────────────────────────────────────────────────────

const QUICK_ACTIONS: { label: string; type: 'chat' | 'alert' }[] = [
  { label: '✓ Station Ready', type: 'chat' },
  { label: '⏳ Running Behind', type: 'chat' },
  { label: '🆘 Need Assistance', type: 'alert' },
  { label: '→ Send Next', type: 'chat' },
  { label: '✔ Student Complete', type: 'chat' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function LabDayChat({
  labDayId,
  senderName,
  senderEmail,
  senderRole,
  stationContext,
  volunteerToken,
  bottomOffset = 24,
  defaultOpen = false,
}: LabDayChatProps) {
  // Persist open/closed across page navigations (NREMT-day fix: chat was
  // closing every time an instructor moved to the next student). On first
  // mount we read the localStorage value; if none exists yet the caller's
  // `defaultOpen` wins — which lets the grading view auto-open on NREMT
  // days while still respecting a user who has explicitly closed it.
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultOpen;
    try {
      const stored = window.localStorage.getItem(CHAT_OPEN_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch {
      // localStorage may be unavailable (Safari private mode, etc.)
    }
    return defaultOpen;
  });

  // Wrap the setter so we always persist to localStorage.
  const setChatOpen = useCallback((next: boolean) => {
    setIsOpen(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CHAT_OPEN_KEY, next ? 'true' : 'false');
      } catch {
        // noop — storage quota / private mode
      }
    }
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState(0);
  // Channel state for the small status indicator. 'connecting' is
  // the bootstrap state, 'connected' is steady-state, 'reconnecting'
  // fires during the exponential-backoff retries, 'offline' means
  // we gave up after MAX_ATTEMPTS. The chat still loads message
  // history via the initial GET in either failure state so the UI
  // is usable for read-only purposes when realtime is offline.
  const [channelStatus, setChannelStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isOpenRef = useRef(isOpen);

  // Keep ref in sync with state for use in realtime callback
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Reset unread when opening
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]);

  // Build headers helper
  const buildHeaders = useCallback((): HeadersInit => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (volunteerToken) h['x-volunteer-token'] = volunteerToken;
    return h;
  }, [volunteerToken]);

  // Load initial messages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/lab-management/lab-days/${labDayId}/messages?limit=50`,
          { headers: buildHeaders() }
        );
        if (!res.ok) throw new Error('Failed to load messages');
        const data = await res.json();
        if (!cancelled && data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Chat: failed to load messages', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [labDayId, buildHeaders]);

  // Realtime subscription + presence.
  //
  // NOTES ON THE SHAPE OF THIS EFFECT (fixes NREMT-day "0 connected" bug):
  //   1. `channel.track()` MUST be called inside the `.subscribe()` status
  //      callback after status === 'SUBSCRIBED'. Calling it synchronously
  //      right after `.subscribe()` is a race — the WebSocket isn't joined
  //      yet and the track is dropped, which is why presence count stuck
  //      at 0 on production.
  //   2. We also wire a `presence` 'sync' event handler so the
  //      connectedUsers count updates immediately when anyone joins or
  //      leaves. The previous polling-only approach worked but was lagged
  //      by up to 5 seconds.
  //   3. The subscribe callback logs every status transition. If Realtime
  //      breaks again in production we can see CHANNEL_ERROR / TIMED_OUT /
  //      CLOSED in the browser console without instrumenting a redeploy.
  //   4. Realtime evaluates postgres_changes against RLS using the client
  //      JWT — which for this project is the anon key since NextAuth does
  //      not flow a Supabase JWT. The companion migration
  //      20260414_lab_day_chat_realtime_rls.sql adds an anon SELECT policy
  //      so the filter actually returns rows to the subscriber.
  // Sender props captured in a ref so they're readable from the
  // subscribe closure without forcing the connect effect to re-run
  // on every parent re-render. The prior version had
  // [senderName, senderEmail, senderRole] in the effect deps, so any
  // unstable parent (e.g. an unmemoized session?.user?.name) would
  // tear down and rebuild the channel on every render. With rapid
  // CHANNEL_ERROR retries also in flight, that piled listener
  // references onto the same channel name and exploded Supabase's
  // `_trigger` array with "Maximum call stack size exceeded".
  const senderRef = useRef({ senderName, senderEmail, senderRole });
  useEffect(() => {
    senderRef.current = { senderName, senderEmail, senderRole };
  }, [senderName, senderEmail, senderRole]);

  // Reconnect attempt counter survives effect re-runs caused by
  // labDayId stability work above and any future dep changes.
  // Only reset on a real SUBSCRIBED or on labDayId change.
  const attemptRef = useRef(0);
  // Mutex: true while a subscribe() call is in flight OR a retry
  // is scheduled. Prevents overlapping connects when state changes
  // race the backoff timer.
  const subscribingRef = useRef(false);

  useEffect(() => {
    const supabase = getSupabase();
    const channelName = `lab-day-chat-${labDayId}`;

    // Resilient subscribe with exponential backoff. Channels can
    // drop for legit reasons that aren't our bug — Supabase mid-deploy,
    // tab backgrounding pausing the websocket, mobile WiFi/cellular
    // handoff. Originally we logged and gave up forever, flooding the
    // console with repeated CHANNEL_ERROR / CLOSED lines (May 21 lab).
    // Then we added backoff but with two regressions (May 26):
    //   - attempt counter reset every retry because of unstable deps
    //   - rapid reconnects overflowed Supabase's listener arrays
    // Current behavior (post-fix):
    //   - attempt persists in attemptRef across effect re-runs.
    //   - subscribingRef guards against concurrent reconnects.
    //   - Each retry FULLY tears down the prior channel
    //     (unsubscribe + removeChannel) before creating a new one.
    //   - 1s → 2s → 4s → 8s → 16s, max 5 attempts, then 'offline'.
    //   - Direct API actions (timer, cleanup) DO NOT depend on this
    //     channel, so chat going dark never breaks the lab.
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const MAX_ATTEMPTS = 5;
    attemptRef.current = 0; // fresh count for this labDayId

    // Full teardown helper. unsubscribe() first to send the LEAVE
    // frame so server-side presence drops us; THEN removeChannel()
    // to drop the local handle and its accumulated listeners.
    // removeChannel alone leaves the server-side subscription
    // active and the local listener array still attached, which is
    // how rapid reconnects piled up references and overflowed the
    // _trigger stack.
    const teardown = (ch: ReturnType<typeof supabase.channel> | null) => {
      if (!ch) return;
      try { ch.unsubscribe(); } catch { /* ignore */ }
      try { supabase.removeChannel(ch); } catch { /* ignore */ }
    };

    const subscribe = () => {
      if (cancelled) return;
      // Mutex: if another subscribe is already in flight, no-op.
      // Without this, a race between the retry timer firing and a
      // dep-change-triggered effect re-run could call subscribe()
      // twice in the same tick → two channels with the same name,
      // duplicated listeners, listener-array stack overflow.
      if (subscribingRef.current) {
        console.warn('[LabDayChat] subscribe() called while already subscribing — skipped');
        return;
      }
      subscribingRef.current = true;

      // Tear down any prior channel before creating a new one. This
      // is the cleanup the original code did on the "drop" branch
      // but NOT on the "fresh attempt" branch — leaving a stale
      // handle around if subscribe() was called for any other
      // reason.
      teardown(currentChannel);
      currentChannel = null;

      console.log(`[LabDayChat] subscribing to ${channelName} (attempt ${attemptRef.current + 1}/${MAX_ATTEMPTS})`);

      const { senderName: sn, senderEmail: se, senderRole: sr } = senderRef.current;
      const channel = supabase
        .channel(channelName, {
          config: { presence: { key: se || sn || 'anon' } },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lab_day_messages',
            filter: `lab_day_id=eq.${labDayId}`,
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (!isOpenRef.current && newMsg.sender_email !== senderRef.current.senderEmail) {
              setUnreadCount((c) => c + 1);
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          setConnectedUsers(Object.keys(state).length);
        })
        .subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            subscribingRef.current = false;
            attemptRef.current = 0;
            setChannelStatus('connected');
            try {
              const { senderName: sn2, senderEmail: se2, senderRole: sr2 } = senderRef.current;
              const trackRes = await channel.track({
                name: sn2,
                email: se2,
                role: sr2,
                online_at: new Date().toISOString(),
              });
              console.log('[LabDayChat] track result=', trackRes);
            } catch (trackErr) {
              console.warn('[LabDayChat] track() failed (non-fatal):', trackErr);
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            const n = attemptRef.current + 1;
            console.warn(
              `[LabDayChat] subscription dropped (${status}, attempt ${n}/${MAX_ATTEMPTS})`,
              err || '',
            );
            teardown(channel);
            if (cancelled) {
              subscribingRef.current = false;
              return;
            }
            attemptRef.current = n;
            if (n > MAX_ATTEMPTS) {
              subscribingRef.current = false;
              setChannelStatus('offline');
              console.error(
                `[LabDayChat] giving up after ${MAX_ATTEMPTS} attempts. Chat is offline; ` +
                `direct API actions (timer, cleanup, etc.) still work.`,
              );
              return;
            }
            setChannelStatus('reconnecting');
            // 1s, 2s, 4s, 8s, 16s.
            const delayMs = Math.min(16000, 1000 * 2 ** (n - 1));
            // Keep subscribingRef = true through the wait so a
            // racing effect re-run can't kick off a parallel attempt.
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              retryTimer = null;
              subscribingRef.current = false;
              subscribe();
            }, delayMs);
          }
          // For any other status ('CHANNEL_*' partial states) leave
          // subscribingRef true and let the protocol settle.
        });

      currentChannel = channel;
    };

    setChannelStatus('connecting');
    subscribe();

    // Backup presence poll in case sync events are dropped.
    const presenceInterval = setInterval(() => {
      if (currentChannel) {
        try {
          const state = currentChannel.presenceState();
          setConnectedUsers(Object.keys(state).length);
        } catch {
          /* ignore — channel may be mid-teardown */
        }
      }
    }, 5000);

    return () => {
      cancelled = true;
      subscribingRef.current = false;
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(presenceInterval);
      teardown(currentChannel);
      currentChannel = null;
    };
    // CRITICAL: only depend on labDayId. Sender props read via
    // senderRef so they update without forcing the effect to
    // tear down and re-subscribe. That's what caused the May 26
    // attempt-counter-reset-on-every-retry bug AND fed listener
    // duplicates into Supabase's _trigger array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labDayId]);

  // Send message
  const handleSend = useCallback(
    async (text?: string, type: 'chat' | 'alert' = 'chat') => {
      const msg = (text ?? newMessage).trim();
      if (!msg || sending) return;

      setSending(true);
      setSendError(null);
      try {
        const body: Record<string, string> = {
          message: msg,
          message_type: type,
        };
        if (stationContext) body.station_context = stationContext;

        const res = await fetch(
          `/api/lab-management/lab-days/${labDayId}/messages`,
          {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) {
          let errBody: { error?: string } = {};
          try { errBody = await res.json(); } catch { /* noop */ }
          const errMsg = errBody.error || `HTTP ${res.status}`;
          console.error('Chat: message POST failed', res.status, errMsg);
          throw new Error(errMsg);
        }
        if (!text) setNewMessage('');

        // Fire assistance alert so coordinator gets a flash banner.
        // Endpoint: /api/lab-management/lab-days/[id]/assistance-alerts
        // (not a no-op — previous code posted to a non-existent route)
        if (type === 'alert' && stationContext) {
          try {
            const alertRes = await fetch(
              `/api/lab-management/lab-days/${labDayId}/assistance-alerts`,
              {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({
                  station_name: stationContext,
                  sender_name: senderName,
                  notes: `Need assistance requested by ${senderName}${stationContext ? ` at ${stationContext}` : ''}`,
                }),
              }
            );
            if (!alertRes.ok) {
              let errBody: { error?: string } = {};
              try { errBody = await alertRes.json(); } catch { /* noop */ }
              console.error(
                'Chat: assistance-alert POST failed',
                alertRes.status,
                errBody.error || ''
              );
            }
          } catch (alertErr) {
            console.error('Chat: assistance-alert fetch threw', alertErr);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Send failed';
        console.error('Chat: send failed', err);
        setSendError(errMsg);
      } finally {
        setSending(false);
      }
    },
    [newMessage, sending, labDayId, stationContext, senderName, buildHeaders]
  );

  // Key handler for textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors print:hidden"
          style={{ bottom: `${bottomOffset}px`, right: '16px' }}
          aria-label="Open chat"
        >
          <MessageSquare className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold px-1">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed z-40 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl print:hidden
            inset-x-0 bottom-0 h-[70vh] rounded-t-xl
            sm:inset-auto sm:bottom-auto sm:right-4 sm:w-[350px] sm:h-[450px] sm:rounded-xl"
          style={{
            // Desktop: position above the floating button area
            ...(typeof window !== 'undefined' && window.innerWidth >= 640
              ? { bottom: `${bottomOffset + 56}px` }
              : {}),
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                Lab Day Chat
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                {/* Status dot colors mirror the channelStatus state:
                    green = subscribed, amber = trying to reconnect,
                    red = gave up after MAX_ATTEMPTS. The number is
                    only meaningful when connected; when offline we
                    label it explicitly. */}
                <span
                  className={`w-2 h-2 rounded-full inline-block ${
                    channelStatus === 'connected'
                      ? 'bg-green-500'
                      : channelStatus === 'reconnecting' || channelStatus === 'connecting'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-red-500'
                  }`}
                  aria-label={channelStatus}
                />
                {channelStatus === 'offline'
                  ? 'offline — direct actions still work'
                  : `${connectedUsers} connected${channelStatus === 'reconnecting' ? ' · reconnecting…' : ''}`}
              </span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender_email === senderEmail;

                // System message
                if (msg.message_type === 'system') {
                  return (
                    <div
                      key={msg.id}
                      className="text-center text-[12px] italic text-gray-400 dark:text-gray-500 py-1"
                    >
                      {msg.message}
                    </div>
                  );
                }

                // Alert message
                if (msg.message_type === 'alert') {
                  return (
                    <div
                      key={msg.id}
                      className="w-full bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">
                          {msg.sender_name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${roleBadgeColor(msg.sender_role)}`}
                        >
                          {msg.sender_role}
                        </span>
                      </div>
                      {msg.station_context && (
                        <div className="text-[11px] text-gray-600 dark:text-gray-400 italic mb-1">
                          {msg.station_context}
                        </div>
                      )}
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        {'\u{1F6A8}'} {msg.message}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {relativeTime(msg.created_at)}
                      </div>
                    </div>
                  );
                }

                // Regular chat message
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        isOwn
                          ? 'bg-blue-600 text-white ml-auto'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 mr-auto'
                      }`}
                    >
                      {/* Sender identity header — shown for every message so
                          any reader can tell at a glance WHO sent it and from
                          WHERE, even for their own messages on a shared
                          device. */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[13px] font-bold ${isOwn ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                          {msg.sender_name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${roleBadgeColor(msg.sender_role)}`}
                        >
                          {msg.sender_role}
                        </span>
                      </div>
                      {msg.station_context && (
                        <div
                          className={`text-[11px] italic mb-1 ${
                            isOwn ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {msg.station_context}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {msg.message}
                      </div>
                      <div
                        className={`text-[10px] mt-1 ${
                          isOwn ? 'text-blue-200' : 'text-gray-400'
                        }`}
                      >
                        {relativeTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="shrink-0 px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
            <div className="flex gap-1.5 whitespace-nowrap">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.label, action.type)}
                  disabled={sending}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Send error banner */}
          {sendError && (
            <div className="shrink-0 px-3 py-1.5 border-t border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 flex items-center justify-between">
              <span className="text-[11px] text-red-700 dark:text-red-300">
                Send failed: {sendError}
              </span>
              <button
                onClick={() => setSendError(null)}
                className="text-[11px] text-red-600 dark:text-red-400 hover:underline"
              >
                dismiss
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="shrink-0 px-3 py-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  maxLength={500}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newMessage.length > 400 && (
                  <span className="absolute bottom-1 right-2 text-[10px] text-gray-400">
                    {newMessage.length}/500
                  </span>
                )}
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!newMessage.trim() || sending}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <SendHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
