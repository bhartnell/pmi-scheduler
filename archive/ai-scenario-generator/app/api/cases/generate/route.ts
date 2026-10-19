// ---------------------------------------------------------------------------
// POST /api/cases/generate — Single Case Generation
// ---------------------------------------------------------------------------
// Generates a single AI case study from a brief, validates it, and saves
// it as a draft in the case_studies table.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  generateSingleCase,
  fetchPromptTemplate,
  type CaseBrief,
} from '@/lib/case-generation';

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory, 6s between requests per user)
// ---------------------------------------------------------------------------

const lastGenerationByUser = new Map<string, number>();
const MIN_INTERVAL_MS = 6000;

function checkRateLimit(userEmail: string): string | null {
  const now = Date.now();
  const last = lastGenerationByUser.get(userEmail);
  if (last && now - last < MIN_INTERVAL_MS) {
    const waitSec = Math.ceil((MIN_INTERVAL_MS - (now - last)) / 1000);
    return `Rate limited. Please wait ${waitSec} more second(s) before generating again.`;
  }
  return null;
}

function recordGeneration(userEmail: string) {
  lastGenerationByUser.set(userEmail, Date.now());
  // Cleanup stale entries
  if (lastGenerationByUser.size > 50) {
    const cutoff = Date.now() - MIN_INTERVAL_MS * 2;
    for (const [email, ts] of lastGenerationByUser) {
      if (ts < cutoff) lastGenerationByUser.delete(email);
    }
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth — require admin+
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    // 2. Rate limit
    const rateLimitError = checkRateLimit(auth.user.email);
    if (rateLimitError) {
      return NextResponse.json(
        { success: false, error: rateLimitError },
        { status: 429 }
      );
    }

    // 3. Parse body
    const body = await request.json();
    const brief: CaseBrief = body.brief || {};

    if (!brief.category && !brief.scenario) {
      return NextResponse.json(
        { success: false, error: 'At least one of brief.category or brief.scenario is required' },
        { status: 400 }
      );
    }

    // 4. Fetch prompt template (DB or fallback)
    const promptTemplate = await fetchPromptTemplate();

    // 5. Record rate limit and generate
    recordGeneration(auth.user.email);
    const result = await generateSingleCase(brief, promptTemplate, auth.user.id);

    // 6. Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        case_id: result.caseId,
        title: result.title,
        validation_errors: result.validationErrors,
        status: 'draft',
      });
    }

    // Generation failed — return errors + raw JSON for debugging
    const statusCode = result.error?.includes('API') ? 502 : 422;
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        title: result.title,
        validation_errors: result.validationErrors,
        raw_json: result.rawJson,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('Error in POST /api/cases/generate:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to generate case: ${message}` },
      { status: 500 }
    );
  }
}
