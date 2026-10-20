import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { ExploreRegion, ExploreRegionSettingsPayload } from "../types";

export const EXPLORE_REGIONS_QUERY_KEY = ["explore-admin-regions"] as const;

/** Merge fields into one cached region (optimistic updates and rollbacks). */
export function patchRegionInCache(queryClient: QueryClient, id: string, patch: Partial<ExploreRegion>) {
    queryClient.setQueryData<ExploreRegion[]>(EXPLORE_REGIONS_QUERY_KEY, (prev) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/** Swap in the server's copy of a region, keeping list order. */
export function replaceRegionInCache(queryClient: QueryClient, region: ExploreRegion) {
    queryClient.setQueryData<ExploreRegion[]>(EXPLORE_REGIONS_QUERY_KEY, (prev) => prev?.map((r) => (r.id === region.id ? region : r)));
}

/** Explore-map settings (admin `regions:manage`; moderators get 403). */
export const exploreMapService = {
    /** All cities, already in explore order (ranked first, then by weight/name). */
    listRegions: async (): Promise<ExploreRegion[]> => {
        const { data } = await api.get<{ regions: ExploreRegion[] }>(API_ENDPOINTS.EXPLORE.ADMIN_REGIONS);
        return data.regions ?? [];
    },

    /** Set the order. The first visible, active region becomes the default for new users and guests. */
    setOrder: async (regionIds: string[]): Promise<ExploreRegion[]> => {
        const { data } = await api.put<{ regions: ExploreRegion[] }>(API_ENDPOINTS.EXPLORE.ADMIN_ORDER, { region_ids: regionIds });
        return data.regions ?? [];
    },

    updateRegion: async (id: string, payload: ExploreRegionSettingsPayload): Promise<ExploreRegion> => {
        const { data } = await api.patch<{ region: ExploreRegion }>(API_ENDPOINTS.EXPLORE.ADMIN_REGION_BY_ID(id), payload);
        return data.region;
    },
};
