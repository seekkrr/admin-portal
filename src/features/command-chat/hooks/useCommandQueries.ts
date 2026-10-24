import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { commandsService, isCommandsApiError } from "@/services/commands.service";
import type { CommandSurface } from "@/services/commands.types";

export const commandQueryKeys = {
    catalog: (surface: CommandSurface) => ["commands", "catalog", surface] as const,
    history: () => ["commands", "history"] as const,
    suggest: (surface: CommandSurface, q: string) => ["commands", "suggest", surface, q] as const,
};

/** Don't hammer a server that doesn't have the endpoints (or refuses us). */
function retryUnlessFinal(failureCount: number, error: unknown): boolean {
    if (isCommandsApiError(error) && !error.retryable) return false;
    return failureCount < 2;
}

/** What the caller may run, for the "What you can do" rail. */
export function useCommandCatalog(surface: CommandSurface = "admin") {
    return useQuery({
        queryKey: commandQueryKeys.catalog(surface),
        queryFn: () => commandsService.catalog(surface),
        staleTime: 10 * 60_000,
        retry: retryUnlessFinal,
    });
}

/** The caller's own recent runs. */
export function useCommandHistory(limit = 30) {
    return useQuery({
        queryKey: commandQueryKeys.history(),
        queryFn: () => commandsService.history(limit),
        staleTime: 60_000,
        retry: retryUnlessFinal,
        refetchOnWindowFocus: false,
    });
}

function useDebounced<T>(value: T, ms: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), ms);
        return () => window.clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

/** Completions for what's typed so far (debounced 200 ms, at most 8). */
export function useCommandSuggestions(text: string, enabled: boolean, surface: CommandSurface = "admin") {
    const q = useDebounced(text.replace(/\s+/g, " ").trimStart(), 200);
    const query = useQuery({
        queryKey: commandQueryKeys.suggest(surface, q),
        queryFn: ({ signal }) => commandsService.suggest(q, surface, signal),
        enabled: enabled && q.trim().length > 0,
        staleTime: 30_000,
        retry: false,
        placeholderData: keepPreviousData,
    });
    const typed = text.trim().toLowerCase();
    const suggestions = enabled && q.trim()
        ? (query.data ?? []).filter((s) => s.text.trim().toLowerCase() !== typed).slice(0, 8)
        : [];
    return { suggestions, isFetching: query.isFetching };
}
