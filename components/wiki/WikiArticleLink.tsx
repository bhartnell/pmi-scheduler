'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';

/**
 * Small inline link from a feature page back to its Help Wiki article.
 * Drop this near a page's header wherever a wiki article covers that page's task.
 */
export function WikiArticleLink({ slug, label }: { slug: string; label: string }) {
  return (
    <Link
      href={`/help/wiki/${slug}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors min-h-[36px]"
    >
      <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </Link>
  );
}
