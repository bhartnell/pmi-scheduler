import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get current user
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Compute the date 90 days from now
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ninetyDaysOut = new Date(today);
    ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

    const todayStr = today.toISOString().split('T')[0];
    const ninetyDaysOutStr = ninetyDaysOut.toISOString().split('T')[0];

    // Fetch certs expiring within 90 days (including already expired)
    // We include expired certs by not applying a lower bound on expiration_date
    const { data: certifications, error } = await supabase
      .from('instructor_certifications')
      .select('id, cert_name, expiration_date, issuing_body')
      .eq('instructor_id', currentUser.id)
      .lte('expiration_date', ninetyDaysOutStr)
      .order('expiration_date', { ascending: true });

    if (error) throw error;

    // Compute days remaining for each cert and attach to result
    const certsWithDays = (certifications || []).map((cert) => {
      const [year, month, day] = cert.expiration_date.split('-').map(Number);
      const expDate = new Date(year, month - 1, day);
      const daysRemaining = Math.ceil(
        (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { ...cert, days_remaining: daysRemaining };
    });

    return NextResponse.json({
      success: true,
      certifications: certsWithDays,
    });
  } catch (error) {
    console.error('Error fetching cert expiry data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch certification expiry data' },
      { status: 500 }
    );
  }
}
