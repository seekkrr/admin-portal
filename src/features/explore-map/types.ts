/** A city as configured for the app's region-based explore map (admin view). */
export interface ExploreRegion {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    tagline: string | null;
    cover_image: string | null;
    badge: string | null;
    banner: string | null;
    default_filters: string[];
    /** [lon, lat] */
    center: [number, number] | null;
    bounds: { min_lon: number; min_lat: number; max_lon: number; max_lat: number } | null;
    counts: { places: number; quests: number; open_collabs: number };
    /** Position in the admin order; null = never ordered (sorted after ranked regions). */
    rank: number | null;
    /** Explore-map visibility toggle. */
    visible: boolean;
    /** Region-level active flag (Regions page). Inactive regions never show in the app. */
    is_active: boolean;
}

/** PATCH body. `""` or `null` clears a field. */
export interface ExploreRegionSettingsPayload {
    visible?: boolean;
    cover_image?: string | null;
    tagline?: string | null;
    badge?: string | null;
    banner?: string | null;
    default_filters?: string[] | null;
}

/** Backend limits (v2 explore routes). */
export const EXPLORE_LIMITS = {
    tagline: 120,
    badge: 24,
    banner: 200,
    filters: 10,
} as const;

/** App filter names that aren't place categories. Exact strings — the app matches on them. */
export const SPECIAL_FILTERS = ["Collabs", "Bookmarked"] as const;

export const BADGE_PRESETS = ["New", "Festival live", "Trending"] as const;
