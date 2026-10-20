import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { loadAgencyAliases } from '@/lib/agency-aliases';
import { selectableAgencies } from '@/lib/agency-match';

// GET - Public: canonical agencies an evaluator can pick for a student preference at signup
export async function GET() {
  try {
    const aliases = await loadAgencyAliases(getSupabaseAdmin());
    return NextResponse.json({ success: true, agencies: selectableAgencies(aliases) });
  } catch (error) {
    console.error('Error loading agencies:', error);
    return NextResponse.json({ success: false, error: 'Could not load agencies', agencies: [] }, { status: 500 });
  }
}
