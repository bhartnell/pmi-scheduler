import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * POST /api/triggers/notion-webhook
 *
 * Self-hosted webhook forwarder (replaces Zapier/Make). Notion's "Send webhook"
 * database automation POSTs here; we authenticate it against a shared secret,
 * then forward to the Claude Code routine's API-trigger URL with the routine
 * trigger token. Lets a Notion task-queue change fire the Code routine
 * immediately instead of waiting for the hourly poll.
 *
 * Auth: Notion webhooks can't attach arbitrary auth headers reliably, so the
 * shared secret is accepted EITHER as the `x-webhook-secret` header OR a
 * `?secret=` query param. Compared in constant time. Anything without the right
 * secret gets 401.
 *
 * Secrets live ONLY in Vercel env vars — never in code/repo/logs:
 *   NOTION_WEBHOOK_SECRET       inbound shared secret (Notion must present this)
 *   CODE_ROUTINE_TRIGGER_URL    the Code routine's trigger endpoint
 *   CODE_ROUTINE_TRIGGER_TOKEN  bearer token for that endpoint (never logged)
 *
 * Additive + reversible: new route only, no existing code or schema touched.
 */

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — guard first (length isn't secret).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  const triggerUrl = process.env.CODE_ROUTINE_TRIGGER_URL;
  const triggerToken = process.env.CODE_ROUTINE_TRIGGER_TOKEN;

  // Misconfigured — don't reveal which var is missing.
  if (!secret || !triggerUrl || !triggerToken) {
    console.error('[notion-webhook] forwarder not configured (missing env)');
    return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 });
  }

  // Authenticate the inbound request (header preferred, query param fallback).
  const provided =
    request.headers.get('x-webhook-secret') ||
    request.nextUrl.searchParams.get('secret');
  if (!secretsMatch(provided, secret)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Forward to the Code routine trigger. Pass the original body through so the
  // routine can see what changed; never log the token or the body.
  let forwarded = false;
  let downstreamStatus = 0;
  try {
    const incoming = await request.text().catch(() => '');
    const res = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${triggerToken}`,
      },
      body: incoming && incoming.trim() ? incoming : '{}',
    });
    forwarded = res.ok;
    downstreamStatus = res.status;
  } catch (err) {
    console.error('[notion-webhook] forward failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'forward failed' }, { status: 502 });
  }

  // Acknowledge fast — Notion only needs a 200; surface forward result for debugging.
  return NextResponse.json({ ok: true, forwarded, downstreamStatus });
}

/**
 * GET /api/triggers/notion-webhook
 * Health check — reports whether the env is configured WITHOUT exposing values.
 * Lets Ben confirm the Vercel env vars are set after wiring.
 */
export async function GET() {
  const configured = !!(
    process.env.NOTION_WEBHOOK_SECRET &&
    process.env.CODE_ROUTINE_TRIGGER_URL &&
    process.env.CODE_ROUTINE_TRIGGER_TOKEN
  );
  return NextResponse.json({ ok: true, configured });
}
