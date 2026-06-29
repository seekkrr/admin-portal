/**
 * Mapbox SearchBox geocoding (suggest + retrieve).
 *
 * We use the interactive SearchBox API rather than the raw Geocoding `/forward`
 * endpoint because SearchBox indexes POIs/landmarks (e.g. "Bir Billing") and
 * disambiguates same-named places far better. A search "session" is a series of
 * `suggest` calls terminated by a single `retrieve`; sharing one session token
 * across them is both the recommended billing model and required for retrieve to
 * resolve the suggestion.
 *
 * @see https://docs.mapbox.com/api/search/search-box/
 */
import { config } from "@/config/env";

/** A lightweight suggestion from `/suggest` — has no coordinates until retrieved. */
export interface PlaceSuggestion {
    mapboxId: string;
    name: string;
    /** Human-readable context, e.g. "Baijnath, 176077, India". */
    placeFormatted: string;
    featureType: string;
}

/** A fully resolved place from `/retrieve` — carries coordinates and (maybe) a bbox. */
export interface ResolvedPlace {
    mapboxId: string;
    name: string;
    fullAddress: string;
    featureType: string;
    /** [lon, lat] */
    center: [number, number];
    /** [west, south, east, north] or null (POIs usually have none). */
    bbox: [number, number, number, number] | null;
}

export interface SuggestOpts {
    /** Stable per search session — pass the same token to the matching `retrievePlace`. */
    sessionToken: string;
    /** [lon, lat] proximity bias for ranking; omitted when null. */
    proximity?: [number, number] | null;
    /** Comma-separated Mapbox feature types to include. */
    types?: string;
    /** Max suggestions (default 6). */
    limit?: number;
}

/** Feature types that represent administrative/place units (vs. POIs). Used for icon choice
 *  in search results and city/hotspot detection when anchoring a region. */
export const ADMIN_FEATURE_TYPES = new Set([
    "country",
    "region",
    "postcode",
    "district",
    "place",
    "city",
    "locality",
]);

/** True for administrative/place feature types; false for POIs, addresses, streets, etc. */
export function isAdminFeatureType(featureType: string): boolean {
    return ADMIN_FEATURE_TYPES.has(featureType);
}

/** Region anchors: administrative units + POIs (so "Bir Billing" and cities both surface). */
export const REGION_SEARCH_TYPES = "country,region,district,place,locality,neighborhood,poi";
/** Marker anchors: POIs/addresses first (landmarks the admin pins). */
export const MARKER_SEARCH_TYPES = "poi,address,street,place,locality,neighborhood";
/** Neutral India centroid — biases ranking toward India without a hard country filter. */
export const INDIA_PROXIMITY: [number, number] = [79, 22];

const SEARCHBOX_BASE = "https://api.mapbox.com/search/searchbox/v1";

/** Start a new search session. */
export function newSessionToken(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID — non-cryptographic, sufficient as a session id.
    return `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Forward search-as-you-type. Returns suggestions (no coordinates — call `retrievePlace`). */
export async function suggestPlaces(query: string, opts: SuggestOpts): Promise<PlaceSuggestion[]> {
    const params = new URLSearchParams({
        q: query,
        access_token: config.mapbox.accessToken,
        session_token: opts.sessionToken,
        language: "en",
        limit: String(opts.limit ?? 6),
    });
    if (opts.types) params.set("types", opts.types);
    if (opts.proximity) params.set("proximity", `${opts.proximity[0]},${opts.proximity[1]}`);

    const res = await fetch(`${SEARCHBOX_BASE}/suggest?${params.toString()}`);
    if (!res.ok) throw new Error("Place search failed");
    const data = (await res.json()) as { suggestions?: unknown[] };
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    return suggestions.map((raw): PlaceSuggestion => {
        const s = raw as {
            mapbox_id?: string;
            name?: string;
            place_formatted?: string;
            full_address?: string;
            feature_type?: string;
        };
        return {
            mapboxId: s.mapbox_id ?? "",
            name: s.name ?? "",
            placeFormatted: s.place_formatted ?? s.full_address ?? "",
            featureType: s.feature_type ?? "",
        };
    });
}

/** Resolve a suggestion to coordinates (+ bbox). Returns null if Mapbox returns no feature. */
export async function retrievePlace(
    mapboxId: string,
    sessionToken: string,
): Promise<ResolvedPlace | null> {
    const params = new URLSearchParams({
        access_token: config.mapbox.accessToken,
        session_token: sessionToken,
    });
    const res = await fetch(`${SEARCHBOX_BASE}/retrieve/${encodeURIComponent(mapboxId)}?${params.toString()}`);
    if (!res.ok) throw new Error("Place search failed");
    const data = (await res.json()) as { features?: unknown[] };
    const feature = Array.isArray(data.features) ? data.features[0] : undefined;
    if (!feature) return null;

    const f = feature as {
        bbox?: number[];
        properties?: {
            mapbox_id?: string;
            name?: string;
            full_address?: string;
            place_formatted?: string;
            feature_type?: string;
            bbox?: number[];
        };
        geometry?: { coordinates?: number[] };
    };
    const props = f.properties ?? {};
    // Treat a feature with no usable coordinates as a failed resolve rather than silently
    // returning [0,0] (which would drop a marker/region off the coast of Africa).
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") {
        return null;
    }
    const rawBbox = props.bbox ?? f.bbox;
    const bbox =
        Array.isArray(rawBbox) && rawBbox.length === 4
            ? ([rawBbox[0], rawBbox[1], rawBbox[2], rawBbox[3]] as [number, number, number, number])
            : null;

    return {
        mapboxId: props.mapbox_id ?? mapboxId,
        name: props.name ?? "",
        fullAddress: props.full_address ?? props.place_formatted ?? props.name ?? "",
        featureType: props.feature_type ?? "",
        center: [coords[0], coords[1]],
        bbox,
    };
}
