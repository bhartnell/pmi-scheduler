// LVFR Instructor Shift Pattern Calculators
// Calculates instructor availability based on shift patterns (48/96, weekly, etc.)

export type ShiftStatus = 'available' | 'on_shift' | 'coming_off' | 'unavailable' | 'unknown';

export interface ShiftPatternConfig {
  pattern_type: '48_96' | 'weekly' | 'custom' | 'conditional';
  pattern_config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 48/96 Rotation (e.g., Jimi's fire schedule)
// 48 hours on, 96 hours off in a 6-day cycle
// ---------------------------------------------------------------------------

export function calculate48_96(
  date: Date,
  epoch: Date,
  _shift?: string
): ShiftStatus {
  const msPerDay = 86400000;
  const daysSinceEpoch = Math.floor((date.getTime() - epoch.getTime()) / msPerDay);
  const positionInCycle = ((daysSinceEpoch % 6) + 6) % 6;

  if (positionInCycle === 0 || positionInCycle === 1) return 'on_shift';
  if (positionInCycle === 2) return 'coming_off'; // Available PM only
  return 'available';
}

// ---------------------------------------------------------------------------
// Weekly Pattern (e.g., Trevor's schedule)
// ---------------------------------------------------------------------------

export function calculateWeekly(
  date: Date,
  config: {
    unavailable_days?: string[];
    available_days?: string[];
    alternating_days?: Record<string, boolean>;
    epoch?: string;
  }
): ShiftStatus {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];

  if (config.unavailable_days?.includes(dayName)) return 'unavailable';
  if (config.available_days?.includes(dayName)) return 'available';

  if (config.alternating_days && config.alternating_days[dayName] !== undefined) {
    const epochDate = config.epoch ? new Date(config.epoch) : new Date('2026-01-01');
    const weeksSinceEpoch = Math.floor((date.getTime() - epochDate.getTime()) / (7 * 86400000));
    return weeksSinceEpoch % 2 === 0 ? 'available' : 'unavailable';
  }

  return 'available'; // Default: assume available if not specified
}

// ---------------------------------------------------------------------------
// Universal calculator
// ---------------------------------------------------------------------------

export function calculateShiftStatus(
  date: Date,
  pattern: ShiftPatternConfig
): ShiftStatus {
  const config = pattern.pattern_config;

  switch (pattern.pattern_type) {
    case '48_96': {
      const epoch = config.epoch ? new Date(config.epoch as string) : new Date('2026-01-01');
      return calculate48_96(date, epoch, config.shift as string | undefined);
    }
    case 'weekly': {
      return calculateWeekly(date, config as {
        unavailable_days?: string[];
        available_days?: string[];
        alternating_days?: Record<string, boolean>;
        epoch?: string;
      });
    }
    case 'custom':
    case 'conditional':
      return 'unknown';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Generate availability for a date range
// ---------------------------------------------------------------------------

export interface AvailabilityEntry {
  date: string; // ISO date
  status: ShiftStatus;
  am1_available: boolean; // 0730-1000
  mid_available: boolean; // 1000-1200
  pm1_available: boolean; // 1300-1430
  pm2_available: boolean; // 1430-1530
}

export function generateAvailability(
  startDate: Date,
  endDate: Date,
  pattern: ShiftPatternConfig
): AvailabilityEntry[] {
  const entries: AvailabilityEntry[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const status = calculateShiftStatus(current, pattern);
    const dateStr = current.toISOString().split('T')[0];

    entries.push({
      date: dateStr,
      status,
      am1_available: status === 'available',
      mid_available: status === 'available',
      pm1_available: status === 'available' || status === 'coming_off',
      pm2_available: status === 'available' || status === 'coming_off',
    });

    current.setDate(current.getDate() + 1);
  }

  return entries;
}
