import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user from lab_users table
    const { data: user, error } = await supabase
      .from('lab_users')
      .select('id, name, email, role, is_active, approved_at, created_at')
      .ilike('email', session.user.email)
      .single();

    if (error) {
      // User might not exist yet - create them
      if (error.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
          .from('lab_users')
          .insert({
            email: session.user.email,
            name: session.user.name || session.user.email.split('@')[0],
            role: 'guest', // Default to guest - admin must promote to instructor
            is_active: true,
            approved_at: new Date().toISOString(), // Auto-approve PMI users
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating user:', createError);
          return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
        }

        return NextResponse.json({ success: true, user: newUser });
      }

      throw error;
    }

    // Fetch endorsements for this user
    let endorsements: any[] = [];
    try {
      const { data: endorsementData } = await supabase
        .from('user_endorsements')
        .select('id, endorsement_type, title, department_id, granted_at')
        .eq('user_id', user.id)
        .eq('is_active', true);
      endorsements = endorsementData || [];
    } catch {
      // Table may not exist yet, ignore
    }

    return NextResponse.json({ success: true, user: { ...user, endorsements } });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
}
