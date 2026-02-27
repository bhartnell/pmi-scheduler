import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Check if tour has been completed for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_preferences')
      .select('tour_completed, tour_step, tour_completed_at')
      .eq('user_email', session.user.email)
      .single();

    // If no preferences row exists yet, tour is not completed
    if (error || !data) {
      return NextResponse.json({
        success: true,
        tour_completed: false,
        tour_step: 0,
        tour_completed_at: null,
      });
    }

    return NextResponse.json({
      success: true,
      tour_completed: data.tour_completed ?? false,
      tour_step: data.tour_step ?? 0,
      tour_completed_at: data.tour_completed_at ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tour status';
    console.error('Error fetching tour status:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST - Update tour status for the current user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tour_completed, tour_step } = body as {
      tour_completed?: boolean;
      tour_step?: number;
    };

    const supabase = getSupabaseAdmin();

    const updateData: Record<string, unknown> = {
      user_email: session.user.email,
      updated_at: new Date().toISOString(),
    };

    if (tour_completed !== undefined) {
      updateData.tour_completed = tour_completed;
      if (tour_completed) {
        updateData.tour_completed_at = new Date().toISOString();
      }
    }

    if (tour_step !== undefined) {
      updateData.tour_step = tour_step;
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(updateData, {
        onConflict: 'user_email',
        ignoreDuplicates: false,
      })
      .select('tour_completed, tour_step, tour_completed_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      tour_completed: data?.tour_completed ?? false,
      tour_step: data?.tour_step ?? 0,
      tour_completed_at: data?.tour_completed_at ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update tour status';
    console.error('Error updating tour status:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
