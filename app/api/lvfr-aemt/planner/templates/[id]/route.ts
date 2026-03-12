import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// DELETE /api/lvfr-aemt/planner/templates/[id] — Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Nullify any instance references to this template
  await supabase
    .from('lvfr_aemt_plan_instances')
    .update({ template_id: null })
    .eq('template_id', id);

  const { error } = await supabase
    .from('lvfr_aemt_plan_templates')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
