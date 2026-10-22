import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { VIEW_AS_STUDENT_COOKIE } from '@/lib/view-as-student';

/**
 * POST /api/admin/view-as/exit   (card STUDENT VIEW 3/4)
 *
 * Clears the view-as cookie only. Never touches the NextAuth session — the
 * admin stays signed in as themselves, no re-login (the bug Ben hit with
 * the old role-preview system).
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const response = NextResponse.json({ success: true });
  response.cookies.set(VIEW_AS_STUDENT_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
