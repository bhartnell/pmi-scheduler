// Help Wiki content loader — reads markdown articles from content/wiki/.
// Source of truth is the markdown files themselves (versioned, agent-editable,
// reviewable in a PR). No CMS, no database table, per the v1 spec.
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import type { WikiSectionId, WikiRole, WikiArticleMeta } from '@/lib/wiki-constants';

export type { WikiSectionId, WikiRole, WikiArticleMeta } from '@/lib/wiki-constants';
export { WIKI_SECTIONS, WIKI_ROLE_LABELS } from '@/lib/wiki-constants';

const WIKI_DIR = path.join(process.cwd(), 'content', 'wiki');

interface WikiFrontmatter {
  title: string;
  section: WikiSectionId;
  roles: WikiRole[];
  summary: string;
  related?: string[];
  verified: boolean;
  updated: string;
}

export interface WikiArticle extends WikiArticleMeta {
  html: string;
  /** Plain-text rendering of the body, used for full-text search. */
  bodyText: string;
}

function readMarkdownFiles(): string[] {
  if (!fs.existsSync(WIKI_DIR)) return [];
  return fs.readdirSync(WIKI_DIR).filter((f) => f.endsWith('.md'));
}

function stripMarkdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ') // code fences
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^#{1,6}\s+/gm, '') // heading markers
    .replace(/[*_>#-]/g, ' ') // remaining markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFile(filename: string): WikiArticle {
  const slug = filename.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(WIKI_DIR, filename), 'utf-8');
  const { data, content } = matter(raw);
  const fm = data as WikiFrontmatter;

  if (!fm.title || !fm.section || !fm.summary) {
    throw new Error(`Wiki article "${filename}" is missing required frontmatter (title, section, summary)`);
  }

  return {
    slug,
    title: fm.title,
    section: fm.section,
    roles: fm.roles ?? [],
    summary: fm.summary,
    related: fm.related ?? [],
    verified: fm.verified ?? false,
    updated: fm.updated ?? '',
    html: marked.parse(content, { async: false }) as string,
    bodyText: stripMarkdownToText(content),
  };
}

let cache: WikiArticle[] | null = null;

/** All wiki articles, parsed and rendered. Cached per server process (content only changes via deploy). */
export function getAllWikiArticles(): WikiArticle[] {
  if (cache) return cache;
  cache = readMarkdownFiles()
    .map(parseFile)
    .sort((a, b) => a.title.localeCompare(b.title));
  return cache;
}

export function getWikiArticleBySlug(slug: string): WikiArticle | null {
  return getAllWikiArticles().find((a) => a.slug === slug) ?? null;
}

/** Resolve related-article slugs to their titles, dropping any that don't (or no longer) exist. */
export function resolveRelated(slugs: string[]): { slug: string; title: string }[] {
  const all = getAllWikiArticles();
  return slugs
    .map((slug) => {
      const match = all.find((a) => a.slug === slug);
      return match ? { slug: match.slug, title: match.title } : null;
    })
    .filter((x): x is { slug: string; title: string } => x !== null);
}
