import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Broadcast a realtime update to all subscribers of a session channel.
 *
 * Uses Supabase Realtime broadcast to push events to connected clients
 * (instructor dashboard, student devices) without requiring a database write.
 *
 * @param sessionCode - The 6-char session code (channel scoping)
 * @param event - Event name (e.g. 'student_joined', 'next_question')
 * @param payload - Arbitrary data to broadcast
 */
export async function broadcastSessionUpdate(
  sessionCode: string,
  event: string,
  payload: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin();
  const channel = supabase.channel(`session:${sessionCode}`);

  await channel.send({
    type: 'broadcast',
    event: 'session_update',
    payload: { event, ...payload, timestamp: Date.now() },
  });

  await supabase.removeChannel(channel);
}
