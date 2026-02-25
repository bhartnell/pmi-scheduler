import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCallerUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role, email')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerUser = await getCallerUser(session.user.email);
  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('student_notes')
      .select(`
        id,
        student_id,
        author_id,
        author_email,
        content,
        category,
        is_flagged,
        flag_level,
        created_at,
        updated_at,
        author:lab_users!author_id(id, name, email)
      `)
      .eq('student_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, notes: data || [] });
  } catch (error) {
    console.error('Error fetching student notes:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerUser = await getCallerUser(session.user.email);
  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const validCategories = ['academic', 'behavioral', 'medical', 'other'];
    const category = validCategories.includes(body.category) ? body.category : 'other';

    const validFlagLevels = ['yellow', 'red', null];
    const flagLevel = validFlagLevels.includes(body.flag_level) ? body.flag_level : null;
    const isFlagged = flagLevel !== null;

    const { data, error } = await supabase
      .from('student_notes')
      .insert({
        student_id: id,
        author_id: callerUser.id,
        author_email: callerUser.email,
        content: body.content.trim(),
        category,
        is_flagged: isFlagged,
        flag_level: flagLevel,
      })
      .select(`
        id,
        student_id,
        author_id,
        author_email,
        content,
        category,
        is_flagged,
        flag_level,
        created_at,
        updated_at,
        author:lab_users!author_id(id, name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, note: data });
  } catch (error) {
    console.error('Error creating student note:', error);
    return NextResponse.json({ success: false, error: 'Failed to create note' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerUser = await getCallerUser(session.user.email);
  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    if (!body.noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    // Fetch the existing note to check ownership
    const { data: existingNote, error: fetchError } = await supabase
      .from('student_notes')
      .select('id, author_id, student_id')
      .eq('id', body.noteId)
      .eq('student_id', id)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Only the author or admin/lead_instructor can edit
    const isAuthor = existingNote.author_id === callerUser.id;
    const isAdmin = hasMinRole(callerUser.role, 'lead_instructor');
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Cannot edit another instructor\'s note' }, { status: 403 });
    }

    const validCategories = ['academic', 'behavioral', 'medical', 'other'];
    const category = body.category && validCategories.includes(body.category) ? body.category : undefined;

    const validFlagLevels = ['yellow', 'red', null];
    const flagLevelProvided = 'flag_level' in body;
    const flagLevel = flagLevelProvided && validFlagLevels.includes(body.flag_level) ? body.flag_level : undefined;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.content?.trim()) updatePayload.content = body.content.trim();
    if (category !== undefined) updatePayload.category = category;
    if (flagLevel !== undefined) {
      updatePayload.flag_level = flagLevel;
      updatePayload.is_flagged = flagLevel !== null;
    }

    const { data, error } = await supabase
      .from('student_notes')
      .update(updatePayload)
      .eq('id', body.noteId)
      .select(`
        id,
        student_id,
        author_id,
        author_email,
        content,
        category,
        is_flagged,
        flag_level,
        created_at,
        updated_at,
        author:lab_users!author_id(id, name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, note: data });
  } catch (error) {
    console.error('Error updating student note:', error);
    return NextResponse.json({ success: false, error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerUser = await getCallerUser(session.user.email);
  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ error: 'noteId query param is required' }, { status: 400 });
    }

    // Fetch the existing note to check ownership
    const { data: existingNote, error: fetchError } = await supabase
      .from('student_notes')
      .select('id, author_id, student_id')
      .eq('id', noteId)
      .eq('student_id', id)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Only the author or admin/lead_instructor can delete
    const isAuthor = existingNote.author_id === callerUser.id;
    const isAdmin = hasMinRole(callerUser.role, 'lead_instructor');
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Cannot delete another instructor\'s note' }, { status: 403 });
    }

    const { error } = await supabase
      .from('student_notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student note:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete note' }, { status: 500 });
  }
}
