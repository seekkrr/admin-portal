/**
 * localStorage that never throws (private windows, blocked storage, quota).
 * Values are JSON; a missing or unreadable value returns the fallback.
 */
export const safeStorage = {
    get<T>(key: string, fallback: T): T {
        try {
            const raw = window.localStorage.getItem(key);
            return raw === null ? fallback : (JSON.parse(raw) as T);
        } catch {
            return fallback;
        }
    },
    set(key: string, value: unknown): void {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* storage unavailable — keep working without it */
        }
    },
    remove(key: string): void {
        try {
            window.localStorage.removeItem(key);
        } catch {
            /* ignore */
        }
    },
};
