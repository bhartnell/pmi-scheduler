import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getAllWikiArticles } from '@/lib/wiki';

// Index of every wiki article (metadata + search text, no rendered HTML —
// keeps the list payload small; the article route returns the rendered body).
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const articles = getAllWikiArticles().map((a) => ({
    slug: a.slug,
    title: a.title,
    section: a.section,
    roles: a.roles,
    summary: a.summary,
    related: a.related,
    verified: a.verified,
    updated: a.updated,
    bodyText: a.bodyText,
  }));

  return NextResponse.json({ success: true, articles });
}
