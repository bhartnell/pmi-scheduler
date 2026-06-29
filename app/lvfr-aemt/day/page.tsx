import { redirect } from 'next/navigation';

// /lvfr-aemt/day has no standalone content — the day runsheet always needs
// a date param (/lvfr-aemt/day/[date]). Redirect to today so breadcrumb
// links and stale bookmarks land somewhere useful.
export default function LVFRDayIndex() {
  const today = new Date().toISOString().slice(0, 10);
  redirect(`/lvfr-aemt/day/${today}`);
}
