import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit: 10 guest login attempts per minute per IP
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success: rateLimitOk } = rateLimit(`guest-login:${ip}`, 10, 60000);
  if (!rateLimitOk) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const { input } = body;

    if (!input?.trim()) {
      return NextResponse.json({ success: false, error: 'Name or access code is required' }, { status: 400 });
    }

    const searchTerm = input.trim();

    // Try to find by access code first (exact match)
    // FERPA: Do not select email - guests should not see PII
    let { data: guestAccess, error } = await supabase
      .from('guest_access')
      .select(`
        id,
        name,
        access_code,
        assigned_role,
        expires_at,
        lab_day_id,
        lab_day:lab_days(
          id,
          date,
          week_number,
          day_number,
          notes,
          cohort:cohorts(
            cohort_number,
            program:programs(name, abbreviation)
          )
        )
      `)
      .eq('access_code', searchTerm.toUpperCase())
      .single();

    // If not found by code, try by name (case-insensitive)
    if (!guestAccess) {
      const { data: byName } = await supabase
        .from('guest_access')
        .select(`
          id,
          name,
          access_code,
          assigned_role,
          expires_at,
          lab_day_id,
          lab_day:lab_days(
            id,
            date,
            week_number,
            day_number,
            notes,
            cohort:cohorts(
              cohort_number,
              program:programs(name, abbreviation)
            )
          )
        `)
        .ilike('name', searchTerm)
        .single();

      guestAccess = byName;
    }

    if (!guestAccess) {
      return NextResponse.json({
        success: false,
        error: 'No guest access found for that name or code'
      }, { status: 404 });
    }

    // Check if expired
    if (guestAccess.expires_at && new Date(guestAccess.expires_at) < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Your guest access has expired'
      }, { status: 403 });
    }

    // Get lab stations if there's a lab day
    let stations: any[] = [];
    if (guestAccess.lab_day_id) {
      const { data: stationData } = await supabase
        .from('lab_stations')
        .select(`
          id,
          station_number,
          station_type,
          custom_title,
          location,
          scenario:scenarios(id, title, category),
          instructor:lab_users!lab_stations_instructor_id_fkey(name)
        `)
        .eq('lab_day_id', guestAccess.lab_day_id)
        .order('station_number');

      stations = stationData || [];
    }

    return NextResponse.json({
      success: true,
      guest: {
        id: guestAccess.id,
        name: guestAccess.name,
        assigned_role: guestAccess.assigned_role,
        expires_at: guestAccess.expires_at,
        lab_day: guestAccess.lab_day,
        stations
      }
    });
  } catch (error) {
    console.error('Guest login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
