import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getWikiArticleBySlug, resolveRelated } from '@/lib/wiki';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await params;
  const article = getWikiArticleBySlug(slug);
  if (!article) {
    return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    article: {
      slug: article.slug,
      title: article.title,
      section: article.section,
      roles: article.roles,
      summary: article.summary,
      verified: article.verified,
      updated: article.updated,
      html: article.html,
      related: resolveRelated(article.related),
    },
  });
}
