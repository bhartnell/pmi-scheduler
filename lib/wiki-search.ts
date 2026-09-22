// Client-safe search scoring for the Help Wiki — no Node APIs, works in the browser.
import type { WikiArticleMeta } from '@/lib/wiki-constants';

export interface WikiSearchResult<T extends WikiArticleMeta & { bodyText: string }> {
  article: T;
  score: number;
}

/**
 * Scores an article against a query: title matches count most, then summary,
 * then body text. A word must appear somewhere (title/summary/body) to count —
 * this is a simple relevance ranker, not a fuzzy matcher, which is enough for
 * the handful of articles v1 ships with and scales fine to a few hundred.
 */
export function searchWikiArticles<T extends WikiArticleMeta & { bodyText: string }>(
  articles: T[],
  query: string
): WikiSearchResult<T>[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return articles.map((article) => ({ article, score: 0 }));
  }

  const results: WikiSearchResult<T>[] = [];
  for (const article of articles) {
    const title = article.title.toLowerCase();
    const summary = article.summary.toLowerCase();
    const body = article.bodyText.toLowerCase();

    let score = 0;
    let matchedAnyWord = false;
    for (const word of words) {
      const titleHits = countOccurrences(title, word);
      const summaryHits = countOccurrences(summary, word);
      const bodyHits = countOccurrences(body, word);
      if (titleHits + summaryHits + bodyHits > 0) matchedAnyWord = true;
      score += titleHits * 5 + summaryHits * 3 + bodyHits * 1;
    }

    if (matchedAnyWord) {
      results.push({ article, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count += 1;
    pos += needle.length;
  }
  return count;
}
