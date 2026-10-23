import { useCallback } from "react";
import { useUrlState } from "@/hooks/useUrlState";

/**
 * The open tab of a detail page, kept in the address (?tab=…) so a reload or
 * a shared link opens the same tab. Unknown values fall back to the first tab.
 */
export function useDetailTab<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
    const { state, set } = useUrlState({ tab: fallback as string });
    const current = (tabs as readonly string[]).includes(state.tab) ? (state.tab as T) : fallback;
    const setTab = useCallback((tab: T) => set({ tab }, { replace: true }), [set]);
    return [current, setTab];
}
