import { NextRequest } from 'next/server';
import { withPreinternship } from '@/lib/preinternship-server';

/**
 * /api/preinternship/windows (follow-up to RAE R3/3)
 *
 * One row per active cohort for the review page's Windows strip. All writes
 * are instructor-role+ only (enforced in lib/preinternship.ts), run with the
 * service role (preinternship_windows has RLS on with no policies), and
 * created_by is always the signed-in actor's email — never client-supplied.
 */

// storage-adapter: listWindows() — instructor only
export async function GET() {
  return withPreinternship((svc, actor) => svc.listWindows(actor));
}

// Body: { cohortId: string, closesAt?: string | null } — opens (or reopens) a window.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const cohortId = body?.cohortId;
  const closesAt = body?.closesAt ?? null;
  return withPreinternship((svc, actor) => svc.openWindow(actor, cohortId, closesAt));
}

// Body: { cohortId: string, closesAt: string | null } — change or clear the close date;
// a past/now closesAt closes the window immediately, null re-opens it with no close date.
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const cohortId = body?.cohortId;
  const closesAt = body?.closesAt ?? null;
  return withPreinternship((svc, actor) => svc.setWindowCloseDate(actor, cohortId, closesAt));
}
