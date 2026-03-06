import { NextRequest } from 'next/server';
import { processDigest } from '../daily-digest/route';

/**
 * GET /api/cron/weekly-digest
 *
 * Vercel cron endpoint. Runs Sunday at 6am UTC.
 * Sends weekly summary emails to users with mode = 'weekly_digest'.
 *
 * Auth: Bearer token via CRON_SECRET env var (standard Vercel cron pattern).
 */
export async function GET(request: NextRequest) {
  return processDigest(request, 'weekly');
}
