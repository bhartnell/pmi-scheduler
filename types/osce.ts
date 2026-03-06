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
