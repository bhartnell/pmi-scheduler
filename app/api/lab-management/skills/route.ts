import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const level = searchParams.get('level');
  const search = searchParams.get('search');

  try {
    let query = supabase
      .from('skills')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    if (level) {
      query = query.contains('certification_levels', [level]);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, skills: data });
  } catch (error) {
    console.error('Error fetching skills:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch skills' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('skills')
      .insert({
        name: body.name,
        category: body.category || 'Other',
        certification_levels: body.certification_levels || ['EMT', 'AEMT', 'Paramedic'],
        description: body.description || null,
        required_count: body.required_count || 1,
        display_order: body.display_order || 0
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, skill: data });
  } catch (error) {
    console.error('Error creating skill:', error);
    return NextResponse.json({ success: false, error: 'Failed to create skill' }, { status: 500 });
  }
}
