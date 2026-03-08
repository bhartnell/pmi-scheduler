// Standardized API route authentication & authorization utilities
import { NextResponse } from 'next/server';
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
