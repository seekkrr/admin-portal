/**
 * Shared formatting utilities for the quests feature.
 */

/**
 * Formats a duration in minutes to a human-readable string like "1h 30m".
 * Returns "—" for null, undefined, or zero values.
 */
export function formatDuration(minutes: number | null | undefined): string {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

/**
 * Validates that a string looks like a valid 24-character MongoDB ObjectId.
 */
export function isValidObjectId(id: string | undefined): boolean {
    return !!id && /^[a-f\d]{24}$/i.test(id);
}
