import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/stations/pool/favorites
 * Returns the current user's favorited station IDs from user_preferences.preferences.station_favorites
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_email', session.user.email)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      throw error;
    }

    const favorites: string[] = (data?.preferences as any)?.station_favorites || [];

    return NextResponse.json({ success: true, favorites });
  } catch (error) {
    console.error('Error fetching station favorites:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

/**
 * POST /api/stations/pool/favorites
 * Add a station to the current user's favorites
 * Body: { station_id: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { station_id } = body;

    if (!station_id) {
      return NextResponse.json({ error: 'station_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get current preferences
    const { data: current } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_email', session.user.email)
      .single();

    const existingPrefs = (current?.preferences as any) || {};
    const currentFavorites: string[] = existingPrefs.station_favorites || [];

    // Add if not already present
    if (!currentFavorites.includes(station_id)) {
      const updatedFavorites = [...currentFavorites, station_id];
      const updatedPrefs = { ...existingPrefs, station_favorites: updatedFavorites };

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_email: session.user.email,
            preferences: updatedPrefs,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_email', ignoreDuplicates: false }
        );

      if (error) throw error;
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error adding station favorite:', error);
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
  }
}

/**
 * DELETE /api/stations/pool/favorites
 * Remove a station from the current user's favorites
 * Query param: ?station_id=
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stationId = request.nextUrl.searchParams.get('station_id');

    if (!stationId) {
      return NextResponse.json({ error: 'station_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get current preferences
    const { data: current } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_email', session.user.email)
      .single();

    const existingPrefs = (current?.preferences as any) || {};
    const currentFavorites: string[] = existingPrefs.station_favorites || [];

    const updatedFavorites = currentFavorites.filter((id) => id !== stationId);
    const updatedPrefs = { ...existingPrefs, station_favorites: updatedFavorites };

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_email: session.user.email,
          preferences: updatedPrefs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email', ignoreDuplicates: false }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing station favorite:', error);
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
  }
}
