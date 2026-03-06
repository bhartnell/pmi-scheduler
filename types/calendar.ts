export interface BusyPeriod {
  start: string;
  end: string;
}

export interface InstructorAvailability {
  connected: boolean;
  busy: BusyPeriod[];
  available: boolean; // true if no conflicts in requested window
}

export interface AvailabilityResponse {
  availability: Record<string, InstructorAvailability>;
}
