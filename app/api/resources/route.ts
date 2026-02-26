import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, getRoleLevel } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/resources
//
// Query params:
//   ?category=protocols   - filter by category
//   ?search=cpr           - search title and description
//   ?minRole=instructor   - filter by min_role
//
// Only returns resources where user's role level >= resource's min_role level
// Only returns is_active=true resources by default
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let query = supabase
      .from('resources')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filter by role level: user must have >= the resource's min_role level
    const userLevel = getRoleLevel(currentUser.role);
    const accessible = (data ?? []).filter((r) => {
      const minLevel = getRoleLevel(r.min_role || 'instructor');
      return userLevel >= minLevel;
    });

    return NextResponse.json({ success: true, resources: accessible });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/resources
//
// Create a new resource. Requires instructor+ role.
// Body: { title, description?, category, resource_type, url?, file_path?,
//         file_name?, file_size?, min_role?, linked_skill_ids?,
//         linked_scenario_ids? }
// Auto-creates the first resource_versions entry.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
    }

    const body = await request.json() as {
      title: string;
      description?: string;
      category: string;
      resource_type: string;
      url?: string;
      file_path?: string;
      file_name?: string;
      file_size?: number;
      min_role?: string;
      linked_skill_ids?: string[];
      linked_scenario_ids?: string[];
    };

    const { title, description, category, resource_type, url, file_path, file_name, file_size, min_role, linked_skill_ids, linked_scenario_ids } = body;

    if (!title || !category || !resource_type) {
      return NextResponse.json({ error: 'title, category, and resource_type are required' }, { status: 400 });
    }

    const validCategories = ['protocols', 'skill_sheets', 'policies', 'forms', 'other'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: `category must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    const validTypes = ['file', 'link'];
    if (!validTypes.includes(resource_type)) {
      return NextResponse.json({ error: `resource_type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    if (resource_type === 'link' && !url) {
      return NextResponse.json({ error: 'url is required for link resources' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const resourceData = {
      title,
      description: description || null,
      category,
      resource_type,
      url: url || null,
      file_path: file_path || null,
      file_name: file_name || null,
      file_size: file_size || null,
      version: 1,
      uploaded_by: currentUser.email,
      min_role: min_role || 'instructor',
      linked_skill_ids: linked_skill_ids || null,
      linked_scenario_ids: linked_scenario_ids || null,
      is_active: true,
    };

    const { data: resource, error: insertError } = await supabase
      .from('resources')
      .insert(resourceData)
      .select('*')
      .single();

    if (insertError) throw insertError;

    // Auto-create first version entry
    const { error: versionError } = await supabase
      .from('resource_versions')
      .insert({
        resource_id: resource.id,
        version: 1,
        file_path: file_path || null,
        file_name: file_name || null,
        url: url || null,
        uploaded_by: currentUser.email,
        notes: 'Initial version',
      });

    if (versionError) {
      console.error('Error creating initial version record:', versionError);
      // Non-fatal: resource was created successfully
    }

    return NextResponse.json({ success: true, resource }, { status: 201 });
  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/resources
//
// Update resource metadata or upload a new version.
// Body must include `id`. If file_path changes, increments version and logs it.
// Requires instructor+ role.
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
    }

    const body = await request.json() as {
      id: string;
      title?: string;
      description?: string;
      category?: string;
      resource_type?: string;
      url?: string;
      file_path?: string;
      file_name?: string;
      file_size?: number;
      min_role?: string;
      linked_skill_ids?: string[];
      linked_scenario_ids?: string[];
      version_notes?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch current resource to compare file_path
    const { data: existing, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', body.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const fileChanged = body.file_path && body.file_path !== existing.file_path;
    const urlChanged = body.url && body.url !== existing.url;
    const newVersion = fileChanged || urlChanged ? existing.version + 1 : existing.version;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = body.category;
    if (body.resource_type !== undefined) updates.resource_type = body.resource_type;
    if (body.url !== undefined) updates.url = body.url;
    if (body.file_path !== undefined) updates.file_path = body.file_path;
    if (body.file_name !== undefined) updates.file_name = body.file_name;
    if (body.file_size !== undefined) updates.file_size = body.file_size;
    if (body.min_role !== undefined) updates.min_role = body.min_role;
    if (body.linked_skill_ids !== undefined) updates.linked_skill_ids = body.linked_skill_ids;
    if (body.linked_scenario_ids !== undefined) updates.linked_scenario_ids = body.linked_scenario_ids;
    if (fileChanged || urlChanged) {
      updates.version = newVersion;
      updates.uploaded_by = currentUser.email;
    }

    const { data: updated, error: updateError } = await supabase
      .from('resources')
      .update(updates)
      .eq('id', body.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    // If file or URL changed, record a new version entry
    if (fileChanged || urlChanged) {
      const { error: versionError } = await supabase
        .from('resource_versions')
        .insert({
          resource_id: body.id,
          version: newVersion,
          file_path: body.file_path || null,
          file_name: body.file_name || null,
          url: body.url || null,
          uploaded_by: currentUser.email,
          notes: body.version_notes || null,
        });

      if (versionError) {
        console.error('Error creating version record:', versionError);
      }
    }

    return NextResponse.json({ success: true, resource: updated });
  } catch (error) {
    console.error('Error updating resource:', error);
    return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/resources
//
// Soft-delete a resource (set is_active=false). Requires admin+ role.
// Query param: ?id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('resources')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 });
  }
}
