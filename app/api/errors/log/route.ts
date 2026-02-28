import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/errors/log
 *
 * Logs client-side errors caught by ErrorBoundary components.
 * Rate-limited to 10 errors per user (or IP) per minute.
 *
 * Body fields:
 *   error_message  - string  (required) - the error message
 *   error_stack    - string  (optional) - the full stack trace
 *   component_name - string  (optional) - feature/component that threw
 *   url            - string  (optional) - window.location.href at time of error
 */
export async function POST(request: NextRequest) {
  try {
    // Auth is optional - we log errors from both authenticated and guest users,
    // but we use the session user ID when available to associate errors.
    const session = await getServerSession(authOptions);

    // Rate limit: 10 errors per identity (user email or IP) per minute
    const identity = session?.user?.email
      ? `error-log:user:${session.user.email}`
      : `error-log:ip:${request.headers.get('x-forwarded-for') || 'unknown'}`;

    const { success: rateLimitOk } = rateLimit(identity, 10, 60000);
    if (!rateLimitOk) {
      // Return 200 so the client ErrorBoundary doesn't throw again trying to report a rate-limit error
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 200 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { error_message, error_stack, component_name, url } = body as {
      error_message?: string;
      error_stack?: string;
      component_name?: string;
      url?: string;
    };

    if (!error_message || typeof error_message !== 'string' || !error_message.trim()) {
      return NextResponse.json({ success: false, error: 'error_message is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Resolve user_id from session email if available
    let userId: string | null = null;
    if (session?.user?.email) {
      const { data: userRow } = await supabase
        .from('lab_users')
        .select('id')
        .eq('email', session.user.email)
        .single();
      userId = userRow?.id ?? null;
    }

    const userAgent =
      request.headers.get('user-agent') || null;

    const { error: insertError } = await supabase
      .from('error_logs')
      .insert({
        user_id: userId,
        error_message: String(error_message).substring(0, 2000),
        error_stack: error_stack ? String(error_stack).substring(0, 10000) : null,
        component_name: component_name ? String(component_name).substring(0, 255) : null,
        page_url: url ? String(url).substring(0, 2000) : null,
        user_agent: userAgent ? userAgent.substring(0, 500) : null,
      });

    if (insertError) {
      // Log internally but don't expose DB error details to client
      console.error('[api/errors/log] Failed to insert error log:', insertError);

      // If the table doesn't exist yet, return 200 so clients don't loop
      if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
        return NextResponse.json({ success: false, error: 'Error log table not configured' }, { status: 200 });
      }

      return NextResponse.json({ success: false, error: 'Failed to log error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // Catch-all: never let the error logger itself crash and cause a loop
    console.error('[api/errors/log] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
