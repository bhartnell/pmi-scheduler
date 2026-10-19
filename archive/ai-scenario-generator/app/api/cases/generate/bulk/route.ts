// ---------------------------------------------------------------------------
// POST /api/cases/generate/bulk — Bulk Case Generation
// ---------------------------------------------------------------------------
// Generates up to 10 cases sequentially from an array of briefs, with
// 2-second delays between each generation to avoid rate limiting.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  generateSingleCase,
  fetchPromptTemplate,
  type CaseBrief,
} from '@/lib/case-generation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BRIEFS = 10;
const DELAY_BETWEEN_MS = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth — require admin+
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    // 2. Parse body
    const body = await request.json();
    const briefs: CaseBrief[] = body.briefs;

    if (!Array.isArray(briefs) || briefs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'briefs must be a non-empty array' },
        { status: 400 }
      );
    }

    if (briefs.length > MAX_BRIEFS) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_BRIEFS} briefs per request` },
        { status: 400 }
      );
    }

    // 3. Fetch prompt template once for all cases
    const promptTemplate = await fetchPromptTemplate();

    // 4. Process sequentially with delays
    const cases: {
      id?: string;
      title?: string;
      status: string;
      errors?: { field: string; message: string; severity: string }[];
      error?: string;
    }[] = [];
    let generated = 0;
    let failed = 0;

    for (let i = 0; i < briefs.length; i++) {
      const brief = briefs[i];

      // Add delay between generations (not before the first one)
      if (i > 0) {
        await sleep(DELAY_BETWEEN_MS);
      }

      const result = await generateSingleCase(brief, promptTemplate, auth.user.id);

      if (result.success) {
        generated++;
        cases.push({
          id: result.caseId,
          title: result.title,
          status: 'draft',
          errors: result.validationErrors.length > 0
            ? result.validationErrors
            : undefined,
        });
      } else {
        failed++;
        cases.push({
          title: result.title,
          status: 'failed',
          errors: result.validationErrors.length > 0
            ? result.validationErrors
            : undefined,
          error: result.error,
        });
      }
    }

    // 5. Return summary
    return NextResponse.json({
      success: true,
      total: briefs.length,
      generated,
      failed,
      cases,
    });
  } catch (error) {
    console.error('Error in POST /api/cases/generate/bulk:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Bulk generation failed: ${message}` },
      { status: 500 }
    );
  }
}
