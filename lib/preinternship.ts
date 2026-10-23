// Pre-Internship Self-Assessment: access rules and storage service.
//
// All rules live here (pure, store-injected) so they are unit-testable without
// a database or HTTP layer; the API routes are thin wrappers that pass the
// signed-in lab_users row and a Supabase-backed store.
//
// Rules (Rae's HANDOFF.md + Ben's 2026-10-19 decisions):
//  - A student reads/updates only their own response.
//  - Students never read other responses or any review.
//  - Instructor-role users read all responses, write reviews, delete a response.
//  - Reflections r1 and r2 are instructor-only and never go into agency output.
//  - A response locks once a review is saved; only an instructor unlocks it.
//  - Deletes are soft (deleted_at); nothing is hard-deleted.

export const INSTRUCTOR_ROLES = ['superadmin', 'admin', 'lead_instructor', 'instructor'] as const;

/** Instructor-side access. Excludes volunteer_instructor (former students) and agency roles. */
export function isPreinternshipInstructor(role: string | null | undefined): boolean {
  return !!role && (INSTRUCTOR_ROLES as readonly string[]).includes(role);
}

export interface Actor {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
  cohortId?: string | null;
}

export interface ResponseData {
  v: number;
  name?: string;
  cohort?: string;
  email?: string;
  ratings: Record<string, number>;
  scenarios: Record<string, string>;
  reflections: Record<string, string>;
  prefs: Record<string, unknown>;
  ack: boolean;
  submittedAt?: string;
  source?: string;
}

export interface ReviewData {
  instr: Record<string, number>;
  academic?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  preparedBy?: string;
  updatedAt?: string;
  recordKey?: string;
}

export interface StoredResponse {
  id: string; // = lab_users.id of the student
  cohortId: string | null;
  locked: boolean;
  data: ResponseData;
}

export interface CohortWindow {
  cohortId: string;
  cohortLabel: string;
  isTest: boolean;
  opensAt: string | null; // null = no window row for this cohort = closed
  closesAt: string | null; // null = open-ended
}

export interface Store {
  getResponse(userId: string): Promise<StoredResponse | null>;
  upsertResponse(userId: string, cohortId: string | null, data: ResponseData): Promise<void>;
  listResponses(): Promise<StoredResponse[]>;
  softDeleteResponse(userId: string): Promise<boolean>;
  setLocked(userId: string, locked: boolean): Promise<boolean>;
  listReviews(): Promise<Record<string, ReviewData>>;
  upsertReview(recordKey: string, userId: string, review: ReviewData): Promise<void>;
  softDeleteReview(recordKey: string): Promise<boolean>;
  /** True when the cohort has an open pre-internship window right now. No window row = closed. */
  isWindowOpen(cohortId: string | null): Promise<boolean>;
  /** The open window's closes_at for a cohort (null = no close date, or no window row). */
  getWindowCloseDate(cohortId: string | null): Promise<string | null>;
  /** One row per active cohort (not just cohorts with a window) for the instructor Windows strip. */
  listCohortWindows(): Promise<CohortWindow[]>;
  /** Opens (or reopens) a cohort's window: opens_at = now, closes_at as given (null = open-ended). */
  openWindow(cohortId: string, closesAt: string | null, createdBy: string | null): Promise<void>;
  /** Changes closes_at on an existing window row (a past/now value closes it immediately). */
  setWindowCloseDate(cohortId: string, closesAt: string | null): Promise<boolean>;
}

export class AccessError extends Error {
  status: 400 | 403 | 404 | 423;
  constructor(status: 400 | 403 | 404 | 423, message: string) {
    super(message);
    this.status = status;
  }
}

const DOMAIN_IDS = ['lead', 'judg', 'crit', 'pcom', 'team', 'fdbk', 'prof', 'comp', 'init', 'advo'];
const SCENARIO_IDS = ['s1', 's2', 's3', 's4', 's5'];
const LETTERS = ['A', 'B', 'C', 'D'];
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Shape check for a student's response. Throws AccessError(400). */
export function validateResponse(input: unknown): ResponseData {
  if (!isObj(input)) throw new AccessError(400, 'Response must be an object');
  const { ratings, scenarios, reflections, prefs } = input;
  if (!isObj(ratings) || !isObj(scenarios) || !isObj(reflections) || !isObj(prefs)) {
    throw new AccessError(400, 'ratings, scenarios, reflections and prefs are required');
  }
  for (const [k, val] of Object.entries(ratings)) {
    if (!DOMAIN_IDS.includes(k) || !Number.isInteger(val) || (val as number) < 1 || (val as number) > 4) {
      throw new AccessError(400, `Invalid rating: ${k}`);
    }
  }
  for (const [k, val] of Object.entries(scenarios)) {
    if (!SCENARIO_IDS.includes(k) || typeof val !== 'string' || !LETTERS.includes(val)) {
      throw new AccessError(400, `Invalid scenario answer: ${k}`);
    }
  }
  for (const [k, val] of Object.entries(reflections)) {
    if (!['r1', 'r2', 'r3'].includes(k) || typeof val !== 'string') {
      throw new AccessError(400, `Invalid reflection: ${k}`);
    }
  }
  if (input.ack !== true) throw new AccessError(400, 'Acknowledgment is required to submit');
  return {
    v: typeof input.v === 'number' ? input.v : 1,
    name: typeof input.name === 'string' ? input.name : undefined,
    cohort: typeof input.cohort === 'string' ? input.cohort : undefined,
    email: typeof input.email === 'string' ? input.email : undefined,
    ratings: ratings as Record<string, number>,
    scenarios: scenarios as Record<string, string>,
    reflections: reflections as Record<string, string>,
    prefs,
    ack: true,
    // Server owns the timestamp; a client cannot backdate a submission.
    submittedAt: new Date().toISOString(),
    source: 'form',
  };
}

export function validateReview(input: unknown): ReviewData {
  if (!isObj(input) || !isObj(input.instr)) throw new AccessError(400, 'Review must include instr ratings');
  for (const [k, val] of Object.entries(input.instr)) {
    if (!DOMAIN_IDS.includes(k) || !Number.isInteger(val) || (val as number) < 1 || (val as number) > 4) {
      throw new AccessError(400, `Invalid instructor rating: ${k}`);
    }
  }
  return {
    instr: input.instr as Record<string, number>,
    academic: isObj(input.academic) ? input.academic : {},
    summary: isObj(input.summary) ? input.summary : {},
    preparedBy: typeof input.preparedBy === 'string' ? input.preparedBy : undefined,
    updatedAt: new Date().toISOString(),
  };
}

/** Response fields that may leave the building to an agency: r1/r2 removed. */
export function agencySafeResponse(data: ResponseData): ResponseData {
  const { r3 } = data.reflections || {};
  return { ...data, reflections: r3 !== undefined ? { r3 } : {} };
}

export const recordKeyFor = (responseId: string) => `r-${responseId}`;

export function createPreinternshipService(store: Store) {
  const requireInstructor = (actor: Actor) => {
    if (!isPreinternshipInstructor(actor.role)) throw new AccessError(403, 'Instructor access required');
  };
  const requireStudent = (actor: Actor) => {
    if (actor.role !== 'student') throw new AccessError(403, 'Student access required');
  };

  return {
    async isInstructor(actor: Actor) {
      return isPreinternshipInstructor(actor.role);
    },

    async getMyResponse(actor: Actor): Promise<ResponseData | null> {
      requireStudent(actor);
      if (!(await store.isWindowOpen(actor.cohortId ?? null))) return null;
      const r = await store.getResponse(actor.id); // keyed by the actor, never by input
      return r ? r.data : null;
    },

    /** Lock and window state ride along so the UI can explain a locked or not-yet-open form. */
    async getMyStatus(actor: Actor) {
      requireStudent(actor);
      const open = await store.isWindowOpen(actor.cohortId ?? null);
      if (!open) return { response: null, locked: false, open, closesAt: null };
      const [r, closesAt] = await Promise.all([
        store.getResponse(actor.id),
        store.getWindowCloseDate(actor.cohortId ?? null),
      ]);
      return { response: r ? r.data : null, locked: !!r?.locked, open, closesAt };
    },

    async saveMyResponse(actor: Actor, input: unknown): Promise<void> {
      requireStudent(actor);
      if (!(await store.isWindowOpen(actor.cohortId ?? null))) {
        throw new AccessError(403, 'The self-assessment is not open for your cohort yet.');
      }
      const data = validateResponse(input);
      const existing = await store.getResponse(actor.id);
      if (existing?.locked) {
        throw new AccessError(423, 'This response is locked because it has been reviewed. Ask an instructor to unlock it.');
      }
      await store.upsertResponse(actor.id, actor.cohortId ?? null, data);
    },

    async listResponses(actor: Actor) {
      requireInstructor(actor);
      return (await store.listResponses()).map((r) => ({ id: r.id, data: r.data, locked: r.locked }));
    },

    async deleteResponse(actor: Actor, id: string) {
      requireInstructor(actor);
      if (!(await store.softDeleteResponse(id))) throw new AccessError(404, 'Response not found');
    },

    async unlockResponse(actor: Actor, id: string) {
      requireInstructor(actor);
      if (!(await store.setLocked(id, false))) throw new AccessError(404, 'Response not found');
    },

    async listReviews(actor: Actor) {
      requireInstructor(actor);
      return store.listReviews();
    },

    async saveReview(actor: Actor, recordKey: string, input: unknown) {
      requireInstructor(actor);
      if (!recordKey.startsWith('r-')) throw new AccessError(400, 'Invalid record key');
      const userId = recordKey.slice(2);
      const response = await store.getResponse(userId);
      if (!response) throw new AccessError(404, 'No response for this record');
      const review = validateReview(input);
      review.recordKey = recordKey;
      review.preparedBy = review.preparedBy || actor.name || actor.email || undefined;
      await store.upsertReview(recordKey, userId, review);
      await store.setLocked(userId, true); // lock once reviewed
    },

    async deleteReview(actor: Actor, recordKey: string) {
      requireInstructor(actor);
      if (!(await store.softDeleteReview(recordKey))) throw new AccessError(404, 'Review not found');
    },

    /** Everything an agency summary may be built from: r1/r2 stripped. Instructor only. */
    async getAgencyView(actor: Actor, id: string) {
      requireInstructor(actor);
      const r = await store.getResponse(id);
      if (!r) throw new AccessError(404, 'Response not found');
      const reviews = await store.listReviews();
      return { id: r.id, response: agencySafeResponse(r.data), review: reviews[recordKeyFor(id)] ?? null };
    },

    async listWindows(actor: Actor) {
      requireInstructor(actor);
      return store.listCohortWindows();
    },

    async openWindow(actor: Actor, cohortId: string, closesAt: string | null) {
      requireInstructor(actor);
      if (!cohortId) throw new AccessError(400, 'cohortId is required');
      if (closesAt !== null && Number.isNaN(Date.parse(closesAt))) throw new AccessError(400, 'Invalid close date');
      await store.openWindow(cohortId, closesAt, actor.email ?? actor.name ?? null);
    },

    async setWindowCloseDate(actor: Actor, cohortId: string, closesAt: string | null) {
      requireInstructor(actor);
      if (!cohortId) throw new AccessError(400, 'cohortId is required');
      if (closesAt !== null && Number.isNaN(Date.parse(closesAt))) throw new AccessError(400, 'Invalid close date');
      if (!(await store.setWindowCloseDate(cohortId, closesAt))) {
        throw new AccessError(404, 'No open window for this cohort yet');
      }
    },
  };
}
