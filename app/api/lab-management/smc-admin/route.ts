import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * SMC admin endpoints (lead_instructor+).
 *
 * GET  — list SMC requirements, optionally filtered by program+semester+status
 *        Includes programs list + skills catalog for the UI's dropdowns.
 * POST — create a new SMC requirement for a (program, semester, skill_name)
 *
 * Per-row edits (PATCH / DELETE) live at ./[id]/route.ts.
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const sp = request.nextUrl.searchParams;
    const programId = sp.get('program_id');
    const semesterParam = sp.get('semester');
    const semester =
      semesterParam && !isNaN(parseInt(semesterParam, 10))
        ? parseInt(semesterParam, 10)
        : null;
    // 'linked' | 'unlinked' | 'all' (default 'all')
    const linkFilter = sp.get('link_status') || 'all';

    // 1. Load programs + skills catalog (UI needs these for dropdowns)
    const [{ data: programs }, { data: skills }] = await Promise.all([
      supabase
        .from('programs')
        .select('id, name, abbreviation')
        .eq('is_active', true)
        .order('abbreviation'),
      supabase
        .from('skills')
        .select('id, name, category, certification_levels, cert_levels')
        .eq('is_active', true)
        .order('name'),
    ]);

    // 2. Load SMC rows
    let query = supabase
      .from('smc_requirements')
      .select(
        'id, program_id, semester, skill_id, skill_name, category, min_attempts, is_platinum, notes, display_order, is_active, created_at, updated_at'
      )
      .order('program_id')
      .order('semester')
      .order('display_order')
      .order('skill_name');
    if (programId) query = query.eq('program_id', programId);
    if (semester !== null) query = query.eq('semester', semester);
    if (linkFilter === 'linked') {
      query = query.not('skill_id', 'is', null);
    } else if (linkFilter === 'unlinked') {
      query = query.is('skill_id', null);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('[smc-admin] list error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load SMC requirements' },
        { status: 500 }
      );
    }

    // 3. Join the catalog name in for convenience (avoids a separate fetch on the client)
    const skillById = new Map<string, any>();
    for (const s of skills || []) skillById.set(s.id, s);
    const enriched = (rows || []).map((r) => ({
      ...r,
      linked_skill: r.skill_id
        ? {
            id: r.skill_id,
            name: skillById.get(r.skill_id)?.name || '(deleted skill)',
            category: skillById.get(r.skill_id)?.category || null,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      rows: enriched,
      programs: programs || [],
      skills: skills || [],
    });
  } catch (e) {
    console.error('[smc-admin] GET error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      program_id,
      semester,
      skill_id,
      skill_name,
      category,
      min_attempts,
      is_platinum,
      notes,
    } = body;

    if (!program_id || !semester || !skill_name) {
      return NextResponse.json(
        { success: false, error: 'program_id, semester, and skill_name are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('smc_requirements')
      .insert({
        program_id,
        semester: parseInt(String(semester), 10),
        skill_id: skill_id || null,
        skill_name: String(skill_name).trim(),
        category: category || null,
        min_attempts: min_attempts ? parseInt(String(min_attempts), 10) : 1,
        is_platinum: !!is_platinum,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      // Unique violation on (program_id, semester, skill_name)
      if ((error as any).code === '23505') {
        return NextResponse.json(
          { success: false, error: 'This skill is already in the SMC for this program/semester' },
          { status: 409 }
        );
      }
      console.error('[smc-admin] insert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create SMC requirement' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, row: data });
  } catch (e) {
    console.error('[smc-admin] POST error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
