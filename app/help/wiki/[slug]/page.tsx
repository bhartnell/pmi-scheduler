'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, ChevronRight, BookOpen, AlertTriangle, ArrowRight } from 'lucide-react';
import { PageLoader } from '@/components/ui';
import type { WikiRole } from '@/lib/wiki-constants';
import { WIKI_ROLE_LABELS, WIKI_SECTIONS } from '@/lib/wiki-constants';

interface ArticleResponse {
  slug: string;
  title: string;
  section: string;
  roles: WikiRole[];
  summary: string;
  verified: boolean;
  updated: string;
  html: string;
  related: { slug: string; title: string }[];
}

export default function WikiArticlePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleResponse | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !params?.slug) return;
    fetch(`/api/help/wiki/${params.slug}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setArticle(data.article);
        } else {
          setError(data.error || 'Article not found');
        }
      })
      .catch(() => setError('Failed to load article'))
      .finally(() => setLoading(false));
  }, [status, params?.slug]);

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }
  if (!session) return null;

  const sectionMeta = article ? WIKI_SECTIONS.find((s) => s.id === article.section) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 flex-wrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/help" className="hover:text-blue-600 dark:hover:text-blue-400">
              Help
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/help/wiki" className="hover:text-blue-600 dark:hover:text-blue-400">
              Wiki
            </Link>
            {sectionMeta && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 dark:text-white">{sectionMeta.title}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-sm text-red-700 dark:text-red-400">
            {error}. It may have moved — try the{' '}
            <Link href="/help/wiki" className="underline">
              Wiki index
            </Link>
            .
          </div>
        )}

        {article && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{article.title}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{article.summary}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {article.roles.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    {WIKI_ROLE_LABELS[role]}
                  </span>
                ))}
                {article.updated && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">
                    Updated {article.updated}
                  </span>
                )}
              </div>

              {!article.verified && (
                <div className="mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Some steps in this article have not been verified against the live app. Treat them as a starting
                    point and confirm before relying on them.
                  </p>
                </div>
              )}
            </div>

            <article
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed
                [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:dark:text-white [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:first:mt-0
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:dark:text-white [&_h3]:mt-5 [&_h3]:mb-2
                [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1
                [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1
                [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:hover:underline
                [&_code]:font-mono [&_code]:text-xs [&_code]:bg-gray-100 [&_code]:dark:bg-gray-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded
                [&_strong]:font-semibold [&_strong]:text-gray-900 [&_strong]:dark:text-white
                [&_blockquote]:border-l-4 [&_blockquote]:border-amber-300 [&_blockquote]:dark:border-amber-700 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:dark:text-gray-400"
              dangerouslySetInnerHTML={{ __html: article.html }}
            />

            {article.related.length > 0 && (
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  Related
                </p>
                <div className="flex flex-col gap-2">
                  {article.related.map((rel) => (
                    <Link
                      key={rel.slug}
                      href={`/help/wiki/${rel.slug}`}
                      className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline min-h-[44px]"
                    >
                      <ArrowRight className="w-4 h-4 flex-shrink-0" />
                      {rel.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
