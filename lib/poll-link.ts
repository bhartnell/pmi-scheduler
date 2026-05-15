/**
 * Poll-link helpers.
 *
 * A poll row has two link columns, each a FULL absolute URL stamped
 * at creation time:
 *   participant_link → `${baseUrl}/poll/{nanoid}`
 *   admin_link       → `${baseUrl}/admin/poll/{nanoid}`
 *
 * The /poll/[id] detail page is keyed on the nanoid embedded in
 * participant_link — NOT the poll's uuid primary key. Redirecting to
 * `/poll/${poll.id}` therefore lands on a page that can't resolve the
 * poll. These helpers extract the correct internal path so
 * router.push() navigations stay same-origin and resolvable.
 */

interface PollLike {
  id?: string;
  participant_link?: string | null;
}

/**
 * Internal path for a poll's participant (share) view. Falls back to
 * the uuid form only if participant_link is somehow absent — the
 * /poll/[id] page resolves both shapes, so the fallback still works.
 */
export function pollLinkPath(poll: PollLike): string {
  const link = poll.participant_link;
  if (link) {
    try {
      // Stored as an absolute URL — take just the path so the
      // redirect stays internal even if baseUrl differs between the
      // env that created the poll and the env serving it.
      return new URL(link).pathname;
    } catch {
      // Not a parseable URL — if it's already a bare path, use it.
      if (link.startsWith('/')) return link;
    }
  }
  // Last-resort fallback. /poll/[id] detects a uuid and queries by id.
  return poll.id ? `/poll/${poll.id}` : '/scheduling/polls';
}
