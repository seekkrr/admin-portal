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

export const searchService = {
    async search(q: string, signal?: AbortSignal): Promise<SearchResponse> {
        // A 404 means "not deployed yet", not an error — resolve it instead of throwing.
        const res = await api.get<{ success?: boolean; results?: Partial<Record<SearchType, SearchHit[]>> }>(API_ENDPOINTS.ADMIN_SEARCH, {
            params: { q, limit: 5 },
            signal,
            validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
        });
        if (res.status === 404) return { available: false };
        return { available: true, results: res.data?.results ?? {} };
    },
};
