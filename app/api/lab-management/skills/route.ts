import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const level = searchParams.get('level');
  const search = searchParams.get('search');

  try {
    const supabase = getSupabase();
    const includeDocuments = searchParams.get('includeDocuments') === 'true';

    const buildQuery = (withDocuments: boolean, docSelect?: string) => {
      let selectStr = '*';
      if (withDocuments && docSelect) {
        selectStr = `*, documents:skill_documents(${docSelect})`;
      }

      let q = supabase
        .from('skills')
        .select(selectStr)
        .eq('is_active', true)
        .order('display_order')
        .order('name');

      if (category) q = q.eq('category', category);
      if (level) q = q.contains('certification_levels', [level]);
      if (search) q = q.or(`name.ilike.%${search}%,category.ilike.%${search}%`);

      return q;
    };

    let data, error;

    if (includeDocuments) {
      // Try full select with file_type
      const result = await buildQuery(true, 'id, document_name, document_url, document_type, file_type, display_order');
      data = result.data;
      error = result.error;

      // If file_type column doesn't exist, retry without it
      if (error && (error.message?.includes('file_type') || error.code === '42703')) {
        console.warn('skill_documents: file_type column not found, querying without it');
        const fallback = await buildQuery(true, 'id, document_name, document_url, document_type, display_order');
        data = fallback.data;
        error = fallback.error;
      }

      // If skill_documents table/relationship doesn't exist, query without join
      if (error && (error.message?.includes('skill_documents') || error.message?.includes('relationship') || error.code === 'PGRST200')) {
        console.warn('skill_documents: join failed, querying skills only');
        const fallback = await buildQuery(false);
        data = fallback.data;
        error = fallback.error;
      }
    } else {
      const result = await buildQuery(false);
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, skills: data });
  } catch (error) {
    console.error('Error fetching skills:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch skills' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

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
