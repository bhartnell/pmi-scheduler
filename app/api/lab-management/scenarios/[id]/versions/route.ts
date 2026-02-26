import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Helper to get current user with role
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// GET /api/lab-management/scenarios/[id]/versions
// List all versions of a scenario, ordered by version_number desc
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scenario_versions')
      .select('id, version_number, title, description, content, changed_by, change_summary, created_at')
      .eq('scenario_id', id)
      .order('version_number', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, versions: data || [] });
  } catch (error) {
    console.error('Error fetching scenario versions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch versions' }, { status: 500 });
  }
}

// POST /api/lab-management/scenarios/[id]/versions
// Save a new version snapshot of the scenario
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, content, change_summary } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get the next version number for this scenario
    const { data: maxRow } = await supabase
      .from('scenario_versions')
      .select('version_number')
      .eq('scenario_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = maxRow ? maxRow.version_number + 1 : 1;

    const { data, error } = await supabase
      .from('scenario_versions')
      .insert({
        scenario_id: id,
        version_number: nextVersion,
        title: title.trim(),
        description: description || null,
        content: content || null,
        changed_by: session.user.email,
        change_summary: change_summary?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, version: data });
  } catch (error) {
    console.error('Error saving scenario version:', error);
    return NextResponse.json({ success: false, error: 'Failed to save version' }, { status: 500 });
  }
}

// PUT /api/lab-management/scenarios/[id]/versions
// Restore a previous version — copies it back to the main scenarios record
// and creates a new version entry marking the restore
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Insufficient permissions — lead instructor or above required' }, { status: 403 });
    }

    const body = await request.json();
    const { version_id } = body;

    if (!version_id) {
      return NextResponse.json({ error: 'version_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the target version
    const { data: targetVersion, error: fetchErr } = await supabase
      .from('scenario_versions')
      .select('*')
      .eq('id', version_id)
      .eq('scenario_id', id)
      .single();

    if (fetchErr || !targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Fetch the current scenario state so we can save it as a version before overwriting
    const { data: currentScenario, error: scenarioErr } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .single();

    if (scenarioErr || !currentScenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Get next version number
    const { data: maxRow } = await supabase
      .from('scenario_versions')
      .select('version_number')
      .eq('scenario_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = maxRow ? maxRow.version_number + 1 : 1;

    // Save current state as a new version (auto-snapshot before overwrite)
    await supabase.from('scenario_versions').insert({
      scenario_id: id,
      version_number: nextVersion,
      title: currentScenario.title || '',
      description: currentScenario.chief_complaint || null,
      content: currentScenario,
      changed_by: session.user.email,
      change_summary: `Restored from version ${targetVersion.version_number} — current state auto-saved`,
    });

    // Apply restored content to the scenarios table
    const restoredContent = targetVersion.content as Record<string, unknown> | null;
    if (restoredContent && typeof restoredContent === 'object') {
      // Build update from the stored content, excluding system fields
      const { id: _id, created_at: _ca, ...restoreFields } = restoredContent as any;
      void _id; void _ca;
      await supabase
        .from('scenarios')
        .update({ ...restoreFields, updated_at: new Date().toISOString() })
        .eq('id', id);
    } else {
      // Minimal restore — just update title from version record
      await supabase
        .from('scenarios')
        .update({ title: targetVersion.title, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({
      success: true,
      message: `Restored to version ${targetVersion.version_number}`,
      restored_version: targetVersion.version_number,
    });
  } catch (error) {
    console.error('Error restoring scenario version:', error);
    return NextResponse.json({ success: false, error: 'Failed to restore version' }, { status: 500 });
  }
}
