import { api } from "./api";
import type { CategoryPinKind } from "@/types";

export interface Category {
    id: string;
    name: string;
    sub_categories: string[];
    is_active?: boolean;
    /** Map pin image URL: the pin on the Explore map for this category's places. */
    cdn_frame?: string | null;
    /** What the map pin image is: "icon" sits inside the pin, "photo" fills it; null/absent = the app decides. */
    cdn_frame_kind?: CategoryPinKind | null;
}

export const categoryService = {
    async getCategories(): Promise<Category[]> {
        const { data } = await api.get<{ categories: Category[] }>("/api/v2/categories/public");
        return data.categories;
    }
};
