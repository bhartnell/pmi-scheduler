import { redirect } from 'next/navigation';

// TRIM 6/7b-2a: one Scenarios page (Ben 2026-10-26). The old tools hub redirects
// to /labs/scenarios with the Admin expander open (admin+ only sees it).
export default function ScenariosHubRedirect() {
  redirect('/labs/scenarios?admin=1');
}
