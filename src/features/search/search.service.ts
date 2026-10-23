import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

export type SearchType = "user" | "business" | "place" | "quest" | "experience" | "region";

export const SEARCH_TYPES: SearchType[] = ["user", "business", "place", "quest", "experience", "region"];

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
    user: "People",
    business: "Businesses",
    place: "Places",
    quest: "Quests",
    experience: "Experiences",
    region: "Regions",
};

export interface SearchHit {
    type: SearchType;
    id: string;
    title: string;
    subtitle: string | null;
    image_url: string | null;
    /** Admin portal route to open, e.g. `/markers/<id>`. */
    url_path: string;
}

export type SearchResponse =
    | { available: true; results: Partial<Record<SearchType, SearchHit[]>> }
    /** The backend doesn't have the search endpoint yet. */
    | { available: false };

/**
 * Older search results point at list pages with `?focus=<id>` because the
 * records had no detail page then. Users and experiences have one now.
 */
export function normalizeAdminPath(path: string): string {
    const m = /^\/(users|collabs\/experiences)\?(?:.*&)?focus=([^&#]+)/.exec(path);
    if (m) return `/${m[1]}/${m[2]}`;
    return path;
}

export const searchService = {
    async search(q: string, signal?: AbortSignal, opts: { types?: SearchType[]; limit?: number } = {}): Promise<SearchResponse> {
        // A 404 means "not deployed yet", not an error — resolve it instead of throwing.
        const res = await api.get<{ success?: boolean; results?: Partial<Record<SearchType, SearchHit[]>> }>(API_ENDPOINTS.ADMIN_SEARCH, {
            params: { q, limit: opts.limit ?? 5, types: opts.types?.length ? opts.types.join(",") : undefined },
            signal,
            validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
        });
        if (res.status === 404) return { available: false };
        const results = res.data?.results ?? {};
        for (const hits of Object.values(results)) {
            hits?.forEach((h) => {
                h.url_path = normalizeAdminPath(h.url_path);
            });
        }
        return { available: true, results };
    },

    /** Hits of one kind (pickers). `null` = search isn't available on this server. */
    async searchType(type: SearchType, q: string, limit = 8, signal?: AbortSignal): Promise<SearchHit[] | null> {
        const res = await searchService.search(q, signal, { types: [type], limit });
        if (!res.available) return null;
        return res.results[type] ?? [];
    },
};
