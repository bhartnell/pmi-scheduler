// LVFR AEMT — Instructor Availability Calculators
// Implements spec-defined shift patterns for Jimi, Trevor, and Ben.
// Pure functions, no database dependencies.

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface BlockAvailability {
  am1: boolean; // 0730-1000
  mid: boolean; // 1000-1200
  pm1: boolean; // 1300-1430
  pm2: boolean; // 1430-1530
}

export interface InstructorDayAvailability {
  blocks: BlockAvailability;
  status: 'available' | 'partial' | 'conflict' | 'on_shift' | 'coming_off' | 'working';
  label: string;
  notes: string;
}

export type CoverageStatus = 'covered' | 'short' | 'gap';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const MS_PER_DAY = 86400000;

// Jimi: A-shift Day 1 epoch
const JIMI_EPOCH = new Date('2026-01-02T12:00:00');

// Trevor: Monday of a known short week (Wed OFF)
const TREVOR_SHORT_WEEK_EPOCH = new Date('2026-03-09T12:00:00');

// Ben: Summer semester boundary and specific conflict dates
const SUMMER_END = '2026-08-13'; // Last day of summer semester
const PALS_DATE = '2026-07-16'; // Ben unavailable all day

// Minimum instructor requirements by course day number
const MIN_INSTRUCTORS: Record<number, number> = {
  3: 2,   // Lifting & Moving Lab
  7: 2,   // Pharmacology Lab
  8: 3,   // IV Lab Day 1 — SAFETY (sharps)
  9: 3,   // IV Lab Day 2 — SAFETY (sharps)
  11: 3,  // Airway Lab
  14: 2,  // BLS Resuscitation Lab
  17: 2,  // Stop the Bleed Lab
  18: 2,  // C-Spine Lab
  20: 2,  // Splinting Lab
  27: 2,  // OB Delivery / NRP Lab
};

export function getMinInstructors(dayNumber: number): number {
  return MIN_INSTRUCTORS[dayNumber] ?? 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Jimi Vargas — 48/96 A-Shift Fire Schedule
// ═══════════════════════════════════════════════════════════════════════════════

export function getJimiAvailability(date: Date): InstructorDayAvailability {
  const daysSinceEpoch = Math.floor((date.getTime() - JIMI_EPOCH.getTime()) / MS_PER_DAY);
  const cyclePosition = ((daysSinceEpoch % 6) + 6) % 6; // handle negatives

  // Position 0-1: A-shift working (48 hrs on)
  if (cyclePosition === 0 || cyclePosition === 1) {
    return {
      blocks: { am1: false, mid: false, pm1: false, pm2: false },
      status: 'on_shift',
      label: 'On Shift (A-shift)',
      notes: 'Working 48-hour tour. Not available.',
    };
  }

  // Check if coming off shift (yesterday was position 1 = last day of tour)
  const yesterdayPosition = (((daysSinceEpoch - 1) % 6) + 6) % 6;
  if (yesterdayPosition === 1) {
    return {
      blocks: { am1: false, mid: false, pm1: true, pm2: true },
      status: 'coming_off',
      label: 'Coming Off Shift',
      notes: 'Off A-shift this morning. Available PM only (~noon+).',
    };
  }

  return {
    blocks: { am1: true, mid: true, pm1: true, pm2: true },
    status: 'available',
    label: 'Available',
    notes: 'Off shift. Full day available.',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Trevor Paul — Weekly Work Schedule
// ═══════════════════════════════════════════════════════════════════════════════

export function getTrevorAvailability(date: Date): InstructorDayAvailability {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Sunday (0), Monday (1), Tuesday (2) — ALWAYS working
  if (dayOfWeek >= 0 && dayOfWeek <= 2) {
    return {
      blocks: { am1: false, mid: false, pm1: false, pm2: false },
      status: 'working',
      label: 'Working (Sun-Tue)',
      notes: 'Works Sunday through Tuesday every week. Never available.',
    };
  }

  // Thursday (4), Friday (5), Saturday (6) — ALWAYS off
  if (dayOfWeek >= 4) {
    return {
      blocks: { am1: true, mid: true, pm1: true, pm2: true },
      status: 'available',
      label: 'Available',
      notes: 'Always off Thursday-Saturday.',
    };
  }

  // Wednesday (3) — alternates between short week (off) and long week (working)
  // Find the Monday of this date's week
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7)); // roll back to Monday

  const weeksSinceEpoch = Math.round(
    (monday.getTime() - TREVOR_SHORT_WEEK_EPOCH.getTime()) / (7 * MS_PER_DAY)
  );
  const isShortWeek = ((weeksSinceEpoch % 2) + 2) % 2 === 0; // even = short week = Wed OFF

  if (isShortWeek) {
    return {
      blocks: { am1: true, mid: true, pm1: true, pm2: true },
      status: 'available',
      label: 'Available (short week)',
      notes: 'Short week — Wednesday off.',
    };
  }

  return {
    blocks: { am1: false, mid: false, pm1: false, pm2: false },
    status: 'working',
    label: 'Working (long week)',
    notes: 'Long week — works Wednesday.',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Benjamin Hartnell — Pima Schedule Conflicts
// ═══════════════════════════════════════════════════════════════════════════════

export function getBenAvailability(date: Date): InstructorDayAvailability {
  const dateStr = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay();

  // PALS conflict — hardcoded date
  if (dateStr === PALS_DATE) {
    return {
      blocks: { am1: false, mid: false, pm1: false, pm2: false },
      status: 'conflict',
      label: 'PALS — OUT',
      notes: 'PALS Course at Pima. Unavailable all day.',
    };
  }

  // After summer semester — fully available all days
  if (dateStr > SUMMER_END) {
    return {
      blocks: { am1: true, mid: true, pm1: true, pm2: true },
      status: 'available',
      label: 'Available',
      notes: 'Fall semester = Fridays only at Pima. Full day available for AEMT.',
    };
  }

  // During summer semester:

  // TUESDAY — Pima Airway class 1030-1200 + Airway Lab 1430-1700
  // Only available 0730-1015
  if (dayOfWeek === 2) {
    return {
      blocks: { am1: true, mid: false, pm1: false, pm2: false },
      status: 'partial',
      label: 'AM Only',
      notes: 'Pima: Airway 1030-1200 + Airway Lab 1430-1700. Available 0730-1015 only.',
    };
  }

  // WEDNESDAY — No Pima conflicts
  if (dayOfWeek === 3) {
    return {
      blocks: { am1: true, mid: true, pm1: true, pm2: true },
      status: 'available',
      label: 'Available',
      notes: 'No Pima conflicts on Wednesdays.',
    };
  }

  // THURSDAY — Pima Peds 1000-1200 + Paramedic Lab 1430-1700
  // Available 0730-0945 and 1200-1415 (split)
  if (dayOfWeek === 4) {
    return {
      blocks: { am1: true, mid: false, pm1: true, pm2: false },
      status: 'partial',
      label: 'Split',
      notes: 'Pima: Peds 1000-1200 + Lab 1430-1700. Available 0730-0945 + 1200-1415.',
    };
  }

  // Other days (Mon, Fri, Sat, Sun — shouldn't hit for AEMT Tue/Wed/Thu schedule)
  return {
    blocks: { am1: true, mid: true, pm1: true, pm2: true },
    status: 'available',
    label: 'Available',
    notes: '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dispatcher — matches instructor by name
// ═══════════════════════════════════════════════════════════════════════════════

export function getInstructorAvailability(
  instructorName: string,
  date: Date
): InstructorDayAvailability | null {
  const name = instructorName.toLowerCase();

  if (name.includes('jimi') || name.includes('vargas')) {
    return getJimiAvailability(date);
  }
  if (name.includes('trevor') || name.includes('paul')) {
    // Avoid matching generic "Paul" — require "trevor" or exact "paul" as surname
    if (name.includes('trevor') || name.endsWith('paul') || name.includes(' paul')) {
      return getTrevorAvailability(date);
    }
  }
  if (name.includes('hartnell') || name.includes('benjamin')) {
    return getBenAvailability(date);
  }
  // "Ben" alone is too short — only match if it's clearly the first name
  if (name.startsWith('ben ') || name === 'ben') {
    return getBenAvailability(date);
  }

  return null; // Unknown instructor — no calculated availability
}

// ═══════════════════════════════════════════════════════════════════════════════
// Coverage Calculator
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateDayCoverage(
  instructorBlocks: BlockAvailability[],
  dayNumber: number
): { status: CoverageStatus; blockCounts: BlockAvailability extends infer T ? { [K in keyof T]: number } : never } {
  const blockCounts = { am1: 0, mid: 0, pm1: 0, pm2: 0 };

  for (const blocks of instructorBlocks) {
    if (blocks.am1) blockCounts.am1++;
    if (blocks.mid) blockCounts.mid++;
    if (blocks.pm1) blockCounts.pm1++;
    if (blocks.pm2) blockCounts.pm2++;
  }

  const minRequired = getMinInstructors(dayNumber);
  const counts = [blockCounts.am1, blockCounts.mid, blockCounts.pm1, blockCounts.pm2];
  const hasZero = counts.some(c => c === 0);
  const hasShort = counts.some(c => c < minRequired);

  let status: CoverageStatus;
  if (hasZero) status = 'gap';
  else if (hasShort) status = 'short';
  else status = 'covered';

  return { status, blockCounts };
}
