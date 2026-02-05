import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - List endorsements (optionally filtered by user)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const type = searchParams.get('type');

    let query = supabase
      .from('user_endorsements')
      .select(`
        *,
        user:lab_users!user_id(id, email, name, role),
        department:departments!department_id(id, name, abbreviation)
      `)
      .eq('is_active', true);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (email) {
      // Need to get user ID first
      const { data: user } = await supabase
        .from('lab_users')
        .select('id')
        .eq('email', email)
        .single();

      if (!user) {
        return NextResponse.json({ success: true, endorsements: [] });
      }
      query = query.eq('user_id', user.id);
    }

    if (type) {
      query = query.eq('endorsement_type', type);
    }

    const { data: endorsements, error } = await query.order('granted_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, endorsements: endorsements || [] });
  } catch (error: any) {
    console.error('Error fetching endorsements:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch endorsements' },
      { status: 500 }
    );
  }
}

// POST - Grant an endorsement (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { user_email, endorsement_type, title, department_id } = body;

    if (!user_email || !endorsement_type) {
      return NextResponse.json(
        { success: false, error: 'user_email and endorsement_type are required' },
        { status: 400 }
      );
    }

    // Get target user
    const { data: targetUser } = await supabase
      .from('lab_users')
      .select('id, name')
      .eq('email', user_email)
      .single();

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Grant endorsement (upsert to handle reactivation)
    const { data: endorsement, error } = await supabase
      .from('user_endorsements')
      .upsert({
        user_id: targetUser.id,
        endorsement_type,
        title: title || null,
        department_id: department_id || null,
        granted_by: session.user.email,
        granted_at: new Date().toISOString(),
        is_active: true,
      }, {
        onConflict: 'user_id,endorsement_type,department_id'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, endorsement });
  } catch (error: any) {
    console.error('Error granting endorsement:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to grant endorsement' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke an endorsement (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const endorsementId = searchParams.get('id');

    if (!endorsementId) {
      return NextResponse.json(
        { success: false, error: 'Endorsement ID required' },
        { status: 400 }
      );
    }

    // Soft delete (set inactive)
    const { error } = await supabase
      .from('user_endorsements')
      .update({ is_active: false })
      .eq('id', endorsementId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error revoking endorsement:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to revoke endorsement' },
      { status: 500 }
    );
  }
}
