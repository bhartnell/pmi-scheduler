// Outside-email proctors (card 4225cd1c). Pure decision logic for the hub's proctors route.
// A non-PMI address with no account cannot sign in, so an admin adding one creates a
// student-level account for it; anyone below admin is refused. No change to sign-in.
import { hasMinRole } from './permissions.ts';

export function isPmiAddress(email: string): boolean {
  const d = email.trim().toLowerCase().split('@')[1] || '';
  return d === 'pmi.edu' || d === 'my.pmi.edu';
}

export type OutsideDecision = 'proceed' | 'create_account' | 'refuse';

/** What to do when adding `email` as a proctor, given whether an account already exists. */
export function outsideProctorDecision(email: string, hasAccount: boolean, callerRole: string): OutsideDecision {
  if (hasAccount || isPmiAddress(email)) return 'proceed';
  return hasMinRole(callerRole, 'admin') ? 'create_account' : 'refuse';
}

export const OUTSIDE_REFUSED_MESSAGE = 'This is not a PMI address and has no account yet. An admin has to add it.';

export function signInLine(email: string): string {
  return `Sign in at pmiparamedic.tools with Google using ${email}, then open Testing > NREMT.`;
}
