import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - List all active onboarding templates
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: templates, error } = await supabase
      .from('onboarding_templates')
      .select('id, name, description, instructor_type')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      templates: templates || [],
    });

  } catch (error) {
    console.error('Error fetching onboarding templates:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
