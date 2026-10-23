/** A readable message from anything thrown (API errors are already Error(message)). */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return fallback;
}
