/**
 * Shared fetch wrapper with error handling.
 * Does NOT retry — just throws with status info on failure.
 * Use this instead of raw fetch() in useEffect-based pages.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errorMessage = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) errorMessage = body.error;
    } catch {
      // couldn't parse error body
    }
    throw new ApiError(errorMessage, res.status);
  }
  return res.json();
}

/**
 * Check if an error is a specific HTTP status.
 */
export function isHttpError(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

/**
 * Check if an error is an auth error (401 or 403).
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}
