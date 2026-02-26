import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/dashboard/layout
// Returns the current user's saved layout, falling back to their role's default, then null.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Try to get the user's personal layout first
    const { data: userLayout } = await supabase
      .from('dashboard_layouts')
      .select('layout, updated_at')
      .eq('user_email', session.user.email)
      .single();

    if (userLayout?.layout) {
      return NextResponse.json({
        success: true,
        layout: userLayout.layout,
        source: 'user',
        updated_at: userLayout.updated_at,
      });
    }

    // No personal layout — look up the user's role and return the role default
    const { data: user } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (user?.role) {
      const { data: roleDefault } = await supabase
        .from('dashboard_layout_defaults')
        .select('layout, updated_at')
        .eq('role', user.role)
        .single();

      if (roleDefault?.layout) {
        return NextResponse.json({
          success: true,
          layout: roleDefault.layout,
          source: 'role_default',
          role: user.role,
          updated_at: roleDefault.updated_at,
        });
      }
    }

    // Nothing found — client should use its own hardcoded defaults
    return NextResponse.json({
      success: true,
      layout: null,
      source: 'none',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch layout';
    console.error('Error fetching dashboard layout:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/dashboard/layout
// Body: { layout: object }
// Upserts the user's personal layout in the database.
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.layout || typeof body.layout !== 'object') {
      return NextResponse.json({ error: 'Invalid layout payload' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('dashboard_layouts')
      .upsert(
        {
          user_email: session.user.email,
          layout: body.layout,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, layout: data.layout, updated_at: data.updated_at });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save layout';
    console.error('Error saving dashboard layout:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/dashboard/layout
// Removes the user's personal layout so they revert to the role/system default.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('dashboard_layouts')
      .delete()
      .eq('user_email', session.user.email);

    if (error) throw error;

    // After deleting, fetch and return the role default (if any)
    const { data: user } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    let defaultLayout = null;
    if (user?.role) {
      const { data: roleDefault } = await supabase
        .from('dashboard_layout_defaults')
        .select('layout')
        .eq('role', user.role)
        .single();
      defaultLayout = roleDefault?.layout ?? null;
    }

    return NextResponse.json({
      success: true,
      message: 'Layout reset to default',
      layout: defaultLayout,
      source: defaultLayout ? 'role_default' : 'none',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset layout';
    console.error('Error resetting dashboard layout:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
