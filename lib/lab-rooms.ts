import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve a station's `room` display name to its pmi_rooms id (null when the text
 * is not a known room, e.g. legacy free text). The free-text `room` column stays
 * the readable value; room_id is the canonical reference.
 */
export async function resolveRoomId(
  supabase: SupabaseClient,
  roomName: string | null | undefined
): Promise<string | null> {
  const name = roomName?.trim();
  if (!name) return null;
  const { data } = await supabase.from('pmi_rooms').select('id').eq('name', name).maybeSingle();
  return data?.id ?? null;
}
