/**
 * Pure wording for the OSCE signup confirmation email (OSCE CAL 3/4). No imports so it is unit-testable.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface OsceConfirmationBlock { label: string; date: string; start_time: string; end_time: string; standby?: boolean }

const hhmm = (t: string) => t.slice(0, 5);

function dateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Pure builder so the wording is testable. Standard keyboard characters only. */
export function buildOsceConfirmation(opts: {
  name: string;
  eventLabel: string;
  slug: string;
  blocks: OsceConfirmationBlock[];
  baseUrl: string;
}): { subject: string; title: string; message: string; actionUrl: string; actionText: string } {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/osce/${opts.slug}`;
  const lines = [...opts.blocks]
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .map((b) => `${esc(b.label)}: ${esc(dateLabel(b.date))}, ${hhmm(b.start_time)} - ${hhmm(b.end_time)}${b.standby ? ' (standby)' : ''}`);
  const hasStandby = opts.blocks.some((b) => b.standby);
  const message = [
    `Hello ${esc(opts.name)},`,
    `Thank you for signing up as an evaluator for ${esc(opts.eventLabel)}. You are signed up for:`,
    lines.join('<br>'),
    ...(hasStandby
      ? ['Blocks marked standby are over our planned evaluator count. You are welcome to come and may be asked to switch in or work alongside another evaluator; Ben will confirm with you directly.']
      : []),
    'A Google Calendar invite for each block comes separately from bhartnell@pmi.edu. If you do not see it within a day, check your spam folder or reply to this message.',
    'Questions: Ben Hartnell, EMS Clinical Director, Pima Medical Institute.',
  ].join('<br><br>');
  return {
    subject: `Evaluator signup ${hasStandby ? 'received' : 'confirmed'} - ${opts.eventLabel}`,
    title: hasStandby ? 'Your evaluator signup is received' : 'Your evaluator signup is confirmed',
    message,
    actionUrl: url,
    actionText: 'Event details',
  };
}

