/**
 * api-client.ts
 * A thin wrapper around fetch that:
 *   - Detects offline status before making a request
 *   - Returns user-friendly errors for network failures
 *   - Optionally retries failed requests with exponential back-off
 */

export interface ApiFetchOptions extends RequestInit {
  /** Number of times to retry on network failure (default: 0 — no retry) */
  retries?: number;
  /** Initial delay in ms before the first retry (doubles each attempt) */
  retryDelay?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly offline?: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wraps `fetch` with offline detection and optional retry logic.
 *
 * Usage:
 *   const data = await apiFetch('/api/lab-management/labs');
 *   const result = await apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify(payload) });
 *
 * On offline or network failure the function throws an `ApiError` with
 * `offline: true` so callers can show a contextual message.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { retries = 0, retryDelay = 500, ...fetchOptions } = options;

  // Fast-fail when the browser knows it is offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiError(
      "You're offline. Please check your connection and try again.",
      undefined,
      true,
    );
  }

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Wait before retrying (exponential back-off)
      await delay(retryDelay * Math.pow(2, attempt - 1));

      // Re-check offline status before each retry
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new ApiError(
          "You're offline. Please check your connection and try again.",
          undefined,
          true,
        );
      }
    }

    try {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        // Non-retryable HTTP errors (4xx are client errors, don't retry)
        const shouldRetry = response.status >= 500 && attempt < retries;
        const errorBody = await safeJson(response);
        const message =
          errorBody?.error ||
          errorBody?.message ||
          `Request failed with status ${response.status}`;

        if (!shouldRetry) {
          throw new ApiError(message, response.status, false);
        }

        lastError = new ApiError(message, response.status, false);
        continue;
      }

      // Parse JSON response
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }

      // Return raw response for non-JSON (cast required)
      return response as unknown as T;
    } catch (err) {
      if (err instanceof ApiError) {
        // ApiError thrown above — re-throw immediately unless retrying server errors
        if (err.offline || err.status == null || err.status < 500 || attempt >= retries) {
          throw err;
        }
        lastError = err;
        continue;
      }

      // Network-level error (fetch itself threw — e.g. DNS failure, no connection)
      const isNetworkError = err instanceof TypeError;
      if (isNetworkError) {
        lastError = new ApiError(
          "You're offline or the server is unreachable. Please try again.",
          undefined,
          true,
        );
        if (attempt < retries) continue;
        throw lastError;
      }

      // Unknown error — re-throw as-is
      throw err;
    }
  }

  // All retries exhausted
  throw lastError ?? new ApiError('Request failed after multiple attempts.');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJson(response: Response): Promise<Record<string, string> | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
