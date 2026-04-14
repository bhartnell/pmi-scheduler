import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized singleton for client-side use
let _supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client for client-side use (anon key).
 * Uses singleton pattern to reuse the same client instance.
 * @returns Supabase client with public anon key
 */
export function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabaseClient;
}

/**
 * Get a new Supabase client with service role key (for API routes).
 * Creates a fresh client on each call for security - service role keys should not be cached.
 * @returns Supabase client with admin privileges
 */
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Legacy export - proxies to the singleton getSupabase() so we never end up
// with two GoTrueClient instances (which breaks Realtime auth and triggers
// "Multiple GoTrueClient instances detected" warnings).
// Accessing any property goes through the lazy singleton.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase client not initialized - missing environment variables');
    }
    const client = getSupabase() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});