// Client-safe Help Wiki types and constants — no Node APIs, safe to import
// from client components. Server-only loading logic lives in lib/wiki.ts.

export type WikiSectionId = 'running-the-program' | 'using-the-site';

export const WIKI_SECTIONS: { id: WikiSectionId; title: string; description: string }[] = [
  {
    id: 'running-the-program',
    title: 'Running the program',
    description: 'Cycle playbooks — the recurring things a program runs: lab days, cohorts, certifications.',
  },
  {
    id: 'using-the-site',
    title: 'Using the site',
    description: 'Task how-tos — how to do a specific thing in the app.',
  },
];

// Role tags are descriptive labels shown on an article, not an access gate —
// the wiki has no FERPA/grade data, so every signed-in user can read every article.
export type WikiRole = 'instructor' | 'lead_instructor' | 'admin_director' | 'student';

export const WIKI_ROLE_LABELS: Record<WikiRole, string> = {
  instructor: 'Instructor',
  lead_instructor: 'Lead Instructor',
  admin_director: 'Admin / Director',
  student: 'Student',
};

export interface WikiArticleMeta {
  slug: string;
  title: string;
  section: WikiSectionId;
  roles: WikiRole[];
  summary: string;
  related: string[];
  verified: boolean;
  updated: string;
}
