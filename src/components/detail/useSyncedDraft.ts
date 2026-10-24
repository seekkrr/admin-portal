import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Form state seeded from server data. It re-seeds only when the server data
 * really changes (after a save or someone else's edit) — not on a background
 * refetch that returns the same record — so typing is never lost to a refetch.
 */
export function useSyncedDraft<T>(base: T): [T, Dispatch<SetStateAction<T>>, () => void] {
    const key = JSON.stringify(base);
    const [draft, setDraft] = useState<T>(base);
    const [seenKey, setSeenKey] = useState(key);
    if (seenKey !== key) {
        setSeenKey(key);
        setDraft(base);
    }
    const reset = useCallback(() => setDraft(JSON.parse(key) as T), [key]);
    return [draft, setDraft, reset];
}
