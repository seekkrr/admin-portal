import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

export interface PlaceCategory {
    id: string;
    name: string;
    sub_categories: string[];
    is_active: boolean;
    color: string | null;
    icon: string | null;
    /** Map pin frame image URL. */
    cdn_frame: string | null;
}

export interface PlaceCategoryInput {
    name: string;
    sub_categories: string[];
    is_active: boolean;
    color: string | null;
    icon: string | null;
    cdn_frame: string | null;
}

function normalise(raw: Partial<PlaceCategory> & { id: string }): PlaceCategory {
    return {
        id: raw.id,
        name: raw.name ?? "",
        sub_categories: raw.sub_categories ?? [],
        is_active: raw.is_active !== false,
        color: raw.color ?? null,
        icon: raw.icon ?? null,
        cdn_frame: raw.cdn_frame ?? null,
    };
}

/** Place (marker) categories — admin list / create / update. */
export const placeCategoriesService = {
    async list(): Promise<PlaceCategory[]> {
        const { data } = await api.get<{ categories?: Array<Partial<PlaceCategory> & { id: string }> }>(API_ENDPOINTS.CATEGORIES.ADMIN);
        return (data.categories ?? []).map(normalise);
    },
    async create(input: PlaceCategoryInput): Promise<PlaceCategory> {
        const { data } = await api.post<{ category: Partial<PlaceCategory> & { id: string } }>(API_ENDPOINTS.CATEGORIES.ADMIN, input);
        return normalise(data.category);
    },
    async update(id: string, patch: Partial<PlaceCategoryInput>): Promise<PlaceCategory> {
        const { data } = await api.put<{ category: Partial<PlaceCategory> & { id: string } }>(API_ENDPOINTS.CATEGORIES.ADMIN_BY_ID(id), patch);
        return normalise(data.category);
    },
};
