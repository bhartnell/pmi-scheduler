import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { CASE_BRIEF_CATALOG } from '@/data/case-studies/case-brief-catalog';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    let seeded = 0;
    let skipped = 0;

    for (const brief of CASE_BRIEF_CATALOG) {
      // Check for existing brief by unique combination
      const { data: existing } = await supabase
        .from('case_briefs')
        .select('id')
        .eq('category', brief.category)
        .eq('subcategory', brief.subcategory)
        .eq('difficulty', brief.difficulty)
        .eq('scenario', brief.scenario)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('case_briefs')
        .insert({
          category: brief.category,
          subcategory: brief.subcategory,
          difficulty: brief.difficulty,
          programs: brief.programs,
          scenario: brief.scenario,
          special_instructions: brief.special_instructions,
          batch_name: brief.batch_name,
          status: 'pending',
        });

      if (error) {
        console.error('Error inserting brief:', error.message, brief.scenario.substring(0, 60));
        // Continue with remaining briefs
      } else {
        seeded++;
      }
    }

    return NextResponse.json({
      success: true,
      seeded,
      skipped,
    });
  } catch (error) {
    console.error('Error seeding case briefs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
