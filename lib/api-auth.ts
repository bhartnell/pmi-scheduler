// Standardized API route authentication & authorization utilities
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isSuperadmin, type Role } from '@/lib/permissions';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthResult {
  user: AuthUser;
  session: { user: { email: string } };
}

export interface VolunteerTokenResult {
  tokenId: string;
  volunteerName: string;
  role: string;
  labDayId: string;
  isVolunteerToken: true;
}

/**
 * Authenticate the request and optionally require a minimum role.
 * Returns the authenticated user or a NextResponse error.
 *
 * Usage:
 *   const auth = await requireAuth(minRole);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 */
export async function requireAuth(
  minRole?: Role
): Promise<AuthResult | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', session.user.email)
    .single();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'User not found' },
      { status: 401 }
    );
  }

  if (minRole) {
    if (minRole === 'superadmin') {
      if (!isSuperadmin(user.role)) {
        return NextResponse.json(
          { success: false, error: 'Superadmin access required' },
          { status: 403 }
        );
      }
    } else if (!hasMinRole(user.role, minRole)) {
      return NextResponse.json(
        { success: false, error: `Insufficient permissions (requires ${minRole}+)` },
        { status: 403 }
      );
    }
  }

  return { user, session: { user: { email: session.user!.email! } } };
}

/**
 * Validate a volunteer lab token from a request header or query param.
 * Returns the token info (including scoped lab_day_id) or null if invalid.
 *
 * Clients pass the token via `x-volunteer-token` header or `volunteer_token` query param.
 */
export async function validateVolunteerToken(
  request: NextRequest
): Promise<VolunteerTokenResult | null> {
  const token =
    request.headers.get('x-volunteer-token') ||
    request.nextUrl.searchParams.get('volunteer_token');

  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data: tokenData, error } = await supabase
    .from('volunteer_lab_tokens')
    .select('id, volunteer_name, role, lab_day_id, is_active, valid_from, valid_until')
    .eq('token', token)
    .single();

  if (error || !tokenData) return null;

  // Check active + validity window
  const now = new Date();
  if (
    !tokenData.is_active ||
    now < new Date(tokenData.valid_from) ||
    now > new Date(tokenData.valid_until)
  ) {
    return null;
  }

  return {
    tokenId: tokenData.id,
    volunteerName: tokenData.volunteer_name,
    role: tokenData.role,
    labDayId: tokenData.lab_day_id,
    isVolunteerToken: true,
  };
}

/**
 * Authenticate via session (requireAuth) OR a valid volunteer lab token.
 * Returns AuthResult, VolunteerTokenResult, or a NextResponse error.
 *
 * Use this on read-only / grading endpoints that volunteers need access to.
 */
export async function requireAuthOrVolunteerToken(
  request: NextRequest,
  minRole?: Role
): Promise<AuthResult | VolunteerTokenResult | NextResponse> {
  // Try session auth first
  const auth = await requireAuth(minRole);
  if (!(auth instanceof NextResponse)) return auth;

  // Session auth failed — try volunteer token
  const volunteerAuth = await validateVolunteerToken(request);
  if (volunteerAuth) return volunteerAuth;

  // Both failed — return the original 401/403
  return auth;
}
