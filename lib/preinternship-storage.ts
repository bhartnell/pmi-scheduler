// Client-side implementation of Rae's storage-adapter.js contract (same method
// names, arguments and return shapes), backed by /api/preinternship/*.
// The server enforces every access rule; this file only transports.
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.error || `Request failed (${res.status})`);
  return body.data as T;
}

export const SA_STORAGE = {
  isInstructor: () => call<boolean>('/api/preinternship/role'),
  async getMyResponse() {
    const r = await call<{ response: unknown | null }>('/api/preinternship/my-response');
    return r.response;
  },
  /** Also exposes lock state and the window's close date so the form can explain a reviewed (locked) response or a closing-soon window. */
  getMyStatus: () =>
    call<{ response: unknown | null; locked: boolean; open: boolean; closesAt: string | null }>('/api/preinternship/my-response'),
  saveMyResponse: (response: unknown) =>
    call<null>('/api/preinternship/my-response', { method: 'PUT', body: JSON.stringify(response) }),
  listResponses: () => call<{ id: string; data: unknown; locked: boolean }[]>('/api/preinternship/responses'),
  deleteResponse: (id: string) =>
    call<null>(`/api/preinternship/responses/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  unlockResponse: (id: string) =>
    call<null>(`/api/preinternship/responses/${encodeURIComponent(id)}/unlock`, { method: 'POST' }),
  listReviews: () => call<Record<string, unknown>>('/api/preinternship/reviews'),
  saveReview: (recordKey: string, review: unknown) =>
    call<null>(`/api/preinternship/reviews/${encodeURIComponent(recordKey)}`, { method: 'PUT', body: JSON.stringify(review) }),
  deleteReview: (recordKey: string) =>
    call<null>(`/api/preinternship/reviews/${encodeURIComponent(recordKey)}`, { method: 'DELETE' }),
  /** Instructor only: response with reflections r1/r2 removed, for agency output. */
  getAgencyView: (id: string) => call<unknown>(`/api/preinternship/responses/${encodeURIComponent(id)}/agency`),

  /** Instructor only: one row per active cohort, for the review page's Windows strip. */
  listWindows: () =>
    call<{ cohortId: string; cohortLabel: string; isTest: boolean; opensAt: string | null; closesAt: string | null }[]>(
      '/api/preinternship/windows',
    ),
  openWindow: (cohortId: string, closesAt: string | null) =>
    call<null>('/api/preinternship/windows', { method: 'POST', body: JSON.stringify({ cohortId, closesAt }) }),
  setWindowCloseDate: (cohortId: string, closesAt: string | null) =>
    call<null>('/api/preinternship/windows', { method: 'PATCH', body: JSON.stringify({ cohortId, closesAt }) }),
};
