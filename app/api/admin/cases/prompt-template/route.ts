// ---------------------------------------------------------------------------
// GET/PUT /api/admin/cases/prompt-template — AI Prompt Template Management
// ---------------------------------------------------------------------------
// GET: Fetch the active prompt template (latest version)
// PUT: Create a new version of the prompt template (deactivates old)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const TEMPLATE_NAME = 'case_generation_master';

// ---------------------------------------------------------------------------
// GET — Fetch active template
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('ai_prompt_templates')
      .select('*')
      .eq('name', TEMPLATE_NAME)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching prompt template:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: data || null,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/cases/prompt-template:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Create new version (deactivates old versions)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    if (!body.prompt_text || !body.prompt_text.trim()) {
      return NextResponse.json(
        { success: false, error: 'prompt_text is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get current max version
    const { data: currentMax } = await supabase
      .from('ai_prompt_templates')
      .select('version')
      .eq('name', TEMPLATE_NAME)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (currentMax?.version || 0) + 1;

    // Deactivate all existing versions
    await supabase
      .from('ai_prompt_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('name', TEMPLATE_NAME);

    // Insert new version
    const { data, error } = await supabase
      .from('ai_prompt_templates')
      .insert({
        name: TEMPLATE_NAME,
        prompt_text: body.prompt_text.trim(),
        version: nextVersion,
        is_active: true,
        created_by: auth.user.email,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error inserting prompt template:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: data,
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/cases/prompt-template:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
