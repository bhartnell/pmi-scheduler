import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Create Supabase client lazily to avoid build-time errors
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

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
      // User might not exist yet - create them with pending role
      if (error.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
          .from('lab_users')
          .insert({
            email: session.user.email,
            name: session.user.name || session.user.email.split('@')[0],
            role: 'pending', // Default to pending - admin must approve and assign role
            is_active: true,
            // approved_at is left NULL until admin approves
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
