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
}

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
}: LabDayChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState(0);
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

  // Realtime subscription + presence
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`lab-day-chat-${labDayId}`)
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
          setMessages((prev) => [...prev, newMsg]);
          if (!isOpenRef.current && newMsg.sender_email !== senderEmail) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    // Presence tracking
    channel.track({
      name: senderName,
      role: senderRole,
      online_at: new Date().toISOString(),
    });

    const presenceInterval = setInterval(() => {
      const state = channel.presenceState();
      setConnectedUsers(Object.keys(state).length);
    }, 5000);

    return () => {
      clearInterval(presenceInterval);
      supabase.removeChannel(channel);
    };
  }, [labDayId, senderName, senderEmail, senderRole]);

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
          onClick={() => setIsOpen(true)}
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
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {connectedUsers} connected
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
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
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                          {msg.sender_name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleBadgeColor(msg.sender_role)}`}
                        >
                          {msg.sender_role}
                        </span>
                      </div>
                      {msg.station_context && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 italic">
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
                      {!isOwn && (
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[13px] font-medium">
                            {msg.sender_name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleBadgeColor(msg.sender_role)}`}
                          >
                            {msg.sender_role}
                          </span>
                        </div>
                      )}
                      {msg.station_context && (
                        <div
                          className={`text-[11px] italic ${
                            isOwn ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
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
