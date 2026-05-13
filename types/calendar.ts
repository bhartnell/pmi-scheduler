export interface BusyPeriod {
  start: string;
  end: string;
}

export interface InstructorAvailability {
  connected: boolean;
  busy: BusyPeriod[];
  available: boolean; // true if no conflicts in requested window
  /**
   * Set when the user's stored Google token doesn't carry the
   * scopes the FreeBusy / Events APIs need (e.g. connected before
   * the events scope upgrade). UI can prompt the user to reconnect.
   * When true, `busy` is empty and `available` is the optimistic
   * "no data → assume available" default.
   */
  needsReconnect?: boolean;
}

export interface AvailabilityResponse {
  availability: Record<string, InstructorAvailability>;
}
