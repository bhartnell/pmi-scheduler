import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { canAccessAdmin } from '@/lib/permissions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper to get current user with role
async function getCurrentUser(email: string) {
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// Required certifications for instructors
const REQUIRED_CERTS = ['NREMT-P', 'BLS Instructor', 'ACLS', 'PALS'];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get all instructors (not guests or pending)
    const { data: users, error: usersError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .not('role', 'in', '("guest","pending")')
      .order('name');

    if (usersError) throw usersError;

    // Get all certifications
    const { data: certifications, error: certsError } = await supabase
      .from('certifications')
      .select('*')
      .in('user_id', (users || []).map(u => u.id));

    if (certsError) throw certsError;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Build status for each user
    const statuses = (users || []).map(user => {
      const userCerts = (certifications || []).filter(c => c.user_id === user.id);

      const certStatuses = REQUIRED_CERTS.map(certName => {
        const cert = userCerts.find(c =>
          c.name.toLowerCase().includes(certName.toLowerCase()) ||
          certName.toLowerCase().includes(c.name.toLowerCase())
        );

        if (!cert) {
          return { name: certName, status: 'missing' as const, expiresAt: null };
        }

        const expiresAt = cert.expires_at ? new Date(cert.expires_at) : null;

        if (!expiresAt) {
          return { name: certName, status: 'current' as const, expiresAt: null };
        }

        if (expiresAt < now) {
          return { name: certName, status: 'expired' as const, expiresAt: cert.expires_at };
        }

        if (expiresAt < thirtyDaysFromNow) {
          return { name: certName, status: 'expiring' as const, expiresAt: cert.expires_at };
        }

        return { name: certName, status: 'current' as const, expiresAt: cert.expires_at };
      });

      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        certifications: certStatuses
      };
    });

    return NextResponse.json({ success: true, statuses });
  } catch (error) {
    console.error('Error fetching certification compliance:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch compliance data' }, { status: 500 });
  }
}
