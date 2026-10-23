/**
 * Endpoints that a backend deploy may not have yet.
 *
 * FastAPI answers an unknown route with 404 `{"detail": "Not Found"}`, while a
 * missing record comes back as e.g. "User not found". The API client turns
 * every error into `Error(message)`, so a route that isn't deployed shows up as
 * the exact message "Not Found". Pages use this to show a calm "not available
 * yet" note instead of an error with Retry.
 */
export const NOT_AVAILABLE_TEXT = "This isn't available on the server yet. It will work once the backend is updated.";

export function isRouteMissing(error: unknown): boolean {
    return error instanceof Error && error.message.trim() === "Not Found";
}

/** React Query `retry` that doesn't retry a missing route. */
export function retryUnlessMissing(failureCount: number, error: unknown): boolean {
    return !isRouteMissing(error) && failureCount < 2;
}
