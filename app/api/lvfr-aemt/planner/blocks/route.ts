import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lvfr-aemt/planner/blocks — Get all content blocks + prerequisites
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const [blocksResult, prereqsResult] = await Promise.all([
    supabase
      .from('lvfr_aemt_content_blocks')
      .select('*')
      .order('id'),
    supabase
      .from('lvfr_aemt_prerequisites')
      .select('id, block_id, requires_block_id, rule_type'),
  ]);

  // Group blocks by type
  const blocks = blocksResult.data || [];
  const grouped: Record<string, typeof blocks> = {};
  for (const b of blocks) {
    if (!grouped[b.block_type]) grouped[b.block_type] = [];
    grouped[b.block_type].push(b);
  }

  return NextResponse.json({
    blocks,
    grouped,
    prerequisites: prereqsResult.data || [],
  });
}
