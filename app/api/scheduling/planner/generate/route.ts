import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      program_type,
      semester_number,
      semester_id,
      program_schedule_id,
      day_mapping,       // { 1: 4, 2: 5 } → day_index 1 maps to Thursday (4), etc.
      instructor_id,
      clear_existing,    // if true, delete existing blocks for this program_schedule before generating
    } = body;

    if (!program_type || !semester_id || !day_mapping) {
      return NextResponse.json({
        error: 'program_type, semester_id, and day_mapping are required'
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch matching templates
    let templateQuery = supabase
      .from('pmi_course_templates')
      .select('*')
      .eq('program_type', program_type)
      .order('sort_order')
      .order('day_index')
      .order('start_time');

    if (semester_number) {
      templateQuery = templateQuery.eq('semester_number', semester_number);
    } else {
      templateQuery = templateQuery.is('semester_number', null);
    }

    const { data: templates, error: tplError } = await templateQuery;
    if (tplError) throw tplError;

    if (!templates || templates.length === 0) {
      return NextResponse.json({
        error: `No templates found for ${program_type}${semester_number ? ` S${semester_number}` : ''}`
      }, { status: 404 });
    }

    // 2. Optionally clear existing blocks
    if (clear_existing && program_schedule_id) {
      const { error: delError } = await supabase
        .from('pmi_schedule_blocks')
        .delete()
        .eq('program_schedule_id', program_schedule_id)
        .eq('semester_id', semester_id);
      if (delError) throw delError;
    }

    // 3. Generate blocks from templates (skip online courses — they go to sidebar)
    const onGroundTemplates = templates.filter(t => !t.is_online);
    const onlineTemplates = templates.filter(t => t.is_online);

    const blocksToInsert = onGroundTemplates.map(t => {
      const dayOfWeek = day_mapping[String(t.day_index)] ?? day_mapping[t.day_index];
      if (dayOfWeek === undefined) return null;

      // Build title with duration hint
      let title = `${t.course_code} ${t.course_name}`;
      if (t.duration_type === 'first_half') {
        title += ' (Wks 1-8)';
      } else if (t.duration_type === 'second_half') {
        title += ' (Wks 9-15)';
      }

      return {
        semester_id,
        program_schedule_id: program_schedule_id || null,
        day_of_week: dayOfWeek,
        start_time: t.start_time,
        end_time: t.end_time,
        block_type: t.block_type || 'lecture',
        title,
        course_name: `${t.course_code} ${t.course_name}`,
        content_notes: t.notes || null,
        color: t.color || null,
        is_recurring: true,
        sort_order: t.sort_order || 0,
      };
    }).filter(Boolean);

    if (blocksToInsert.length === 0) {
      return NextResponse.json({
        error: 'No blocks to generate — check day_mapping matches template day_index values'
      }, { status: 400 });
    }

    const { data: createdBlocks, error: insertError } = await supabase
      .from('pmi_schedule_blocks')
      .insert(blocksToInsert)
      .select('*');

    if (insertError) throw insertError;

    // 4. Assign instructor to all created blocks if provided
    if (instructor_id && createdBlocks && createdBlocks.length > 0) {
      const instructorAssignments = createdBlocks.map(block => ({
        schedule_block_id: block.id,
        instructor_id,
        role: 'primary',
      }));

      await supabase
        .from('pmi_block_instructors')
        .insert(instructorAssignments);
    }

    return NextResponse.json({
      blocks: createdBlocks || [],
      online_courses: onlineTemplates.map(t => ({
        course_code: t.course_code,
        course_name: t.course_name,
        duration_type: t.duration_type,
        notes: t.notes,
      })),
      generated_count: createdBlocks?.length || 0,
      online_count: onlineTemplates.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const detail = (err as { details?: string })?.details || '';
    console.error('Generate semester error:', { message, detail, err });
    return NextResponse.json({
      error: message,
      detail: detail || undefined,
    }, { status: 500 });
  }
}
