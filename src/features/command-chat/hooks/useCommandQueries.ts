import { useQuery } from "@tanstack/react-query";
import { commandsService, isCommandsApiError } from "@/services/commands.service";
import type { CommandSurface } from "@/services/commands.types";

export const commandQueryKeys = {
    catalog: (surface: CommandSurface) => ["commands", "catalog", surface] as const,
    history: () => ["commands", "history"] as const,
};

/** Don't hammer a server that doesn't have the endpoints (or refuses us). */
function retryUnlessFinal(failureCount: number, error: unknown): boolean {
    if (isCommandsApiError(error) && !error.retryable) return false;
    return failureCount < 2;
}

/**
 * What the caller may run. The chat doesn't list it (no suggestions); the call
 * tells whether this server has the chat and whether it's on for the team.
 */
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
