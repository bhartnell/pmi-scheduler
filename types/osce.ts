export type OsceEventStatus = 'draft' | 'open' | 'closed' | 'archived';

export interface OsceEvent {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  max_observers_per_block: number;
  status: OsceEventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  observer_count?: number;
  block_count?: number;
}

export interface OsceTimeBlock {
  id: string;
  event_id: string;
  day_number: number;
  label: string;
  date: string;
  start_time: string;
  end_time: string;
  max_observers: number;
  sort_order: number;
  observer_count?: number;
}

export interface OsceObserver {
  id: string;
  event_id: string;
  name: string;
  title: string;
  agency: string;
  email: string;
  phone: string | null;
  role: string | null;
  agency_preference: boolean;
  agency_preference_note: string | null;
  created_at: string;
  blocks?: OsceObserverBlock[];
}

export interface OsceObserverBlock {
  block_id: string;
  day_number: number;
  label: string;
  date: string;
  start_time: string;
  end_time: string;
}

/** Evaluator role recorded on a guest token (matches osce_guest_tokens_evaluator_role_check). */
export type OsceGuestTokenRole = 'md' | 'faculty' | 'agency';

/**
 * A guest-token grading-access link generated for one external evaluator.
 * The token itself is the credential — `${APP_URL}/osce-scoring/enter?token=...`
 * signs the evaluator straight into the scoring dashboard, no login required.
 * Scoped to one osce_events row (event_id) per the Repeatability Rule — every
 * OSCE event gets its own independent set of tokens.
 */
export interface OsceGuestToken {
  id: string;
  token: string;
  evaluator_name: string;
  evaluator_role: OsceGuestTokenRole | null;
  email: string | null;
  agency: string | null;
  event_id: string | null;
  valid_from: string;
  valid_until: string;
  created_at: string;
  /** Set when an invite email has been sent at least once. */
  invited_at: string | null;
  /** How many times an invite email was successfully sent for this token. */
  invite_send_count: number;
  /** Error message from the most recent failed invite send, if any. */
  invite_last_error: string | null;
}
