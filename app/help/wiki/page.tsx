'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Home, ChevronRight, BookOpen, Search, X, GraduationCap, ShieldCheck, UserCog, Users } from 'lucide-react';
import { PageLoader } from '@/components/ui';
import type { WikiArticleMeta, WikiRole, WikiSectionId } from '@/lib/wiki-constants';
import { WIKI_SECTIONS, WIKI_ROLE_LABELS } from '@/lib/wiki-constants';
import { searchWikiArticles } from '@/lib/wiki-search';

type IndexedArticle = WikiArticleMeta & { bodyText: string };

const ROLE_ICONS: Record<WikiRole, React.ComponentType<{ className?: string }>> = {
  instructor: Users,
  lead_instructor: ShieldCheck,
  admin_director: UserCog,
  student: GraduationCap,
};

export default function HelpWikiPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<IndexedArticle[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<WikiRole | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/help/wiki')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setArticles(data.articles);
        } else {
          setError(data.error || 'Failed to load wiki articles');
        }
      })
      .catch(() => setError('Failed to load wiki articles'))
      .finally(() => setLoading(false));
  }, [status]);

  const roleFiltered = useMemo(
    () => (roleFilter ? articles.filter((a) => a.roles.includes(roleFilter)) : articles),
    [articles, roleFilter]
  );

  const searched = useMemo(
    () => searchWikiArticles(roleFiltered, query).map((r) => r.article),
    [roleFiltered, query]
  );

  const bySection = (sectionId: WikiSectionId) => searched.filter((a) => a.section === sectionId);

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/help" className="hover:text-blue-600 dark:hover:text-blue-400">
              Help
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Wiki</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help Wiki</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  How to run the program and how to use the site — organized by task, not by feature.
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the wiki — try what you're trying to do"
                className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Role filter chips */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1">
            Role
          </span>
          <button
            onClick={() => setRoleFilter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[36px] ${
              roleFilter === null
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'
            }`}
          >
            All
          </button>
          {(Object.keys(WIKI_ROLE_LABELS) as WikiRole[]).map((role) => {
            const Icon = ROLE_ICONS[role];
            const active = roleFilter === role;
            return (
              <button
                key={role}
                onClick={() => setRoleFilter(active ? null : role)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[36px] ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {WIKI_ROLE_LABELS[role]}
              </button>
            );
          })}
        </div>

        {articles.length === 0 && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No wiki articles yet.
          </div>
        )}

        {query && searched.length === 0 && articles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No articles match &ldquo;{query}&rdquo;. Try different words, or use the Report an Issue link on the{' '}
            <Link href="/help" className="text-blue-600 dark:text-blue-400 hover:underline">
              Help
            </Link>{' '}
            page to ask for one.
          </div>
        )}

        <div className="grid gap-8 max-md:gap-6">
          {WIKI_SECTIONS.map((section) => {
            const sectionArticles = bySection(section.id);
            if (sectionArticles.length === 0) return null;
            return (
              <section key={section.id}>
                <div className="mb-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{section.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
                </div>
                <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                  {sectionArticles.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: IndexedArticle }) {
  return (
    <Link
      href={`/help/wiki/${article.slug}`}
      className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all min-h-[44px]"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{article.title}</h3>
        {!article.verified && (
          <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            Unverified
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{article.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {article.roles.map((role) => (
          <span
            key={role}
            className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            {WIKI_ROLE_LABELS[role]}
          </span>
        ))}
      </div>
    </Link>
  );
}
