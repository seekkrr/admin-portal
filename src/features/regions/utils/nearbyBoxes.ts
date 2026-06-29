import type { Region, GeoPolygon } from "@/types";
import type { ReferenceBox } from "@components/maps/BboxDrawMap";

interface Box {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
}

/** Coerce a region's stored bbox (GeoJSON Polygon or legacy array) to a GeoPolygon. */
export function regionBboxPolygon(bbox: Region["bbox"]): GeoPolygon | null {
    if (bbox && !Array.isArray(bbox) && bbox.type === "Polygon") {
        return { type: "Polygon", coordinates: bbox.coordinates };
    }
    return null;
}

function boxOf(poly: GeoPolygon): Box | null {
    const ring = poly.coordinates?.[0];
    if (!ring || ring.length < 4) return null;
    const lons = ring.map((c) => c[0] ?? 0);
    const lats = ring.map((c) => c[1] ?? 0);
    return { minLon: Math.min(...lons), minLat: Math.min(...lats), maxLon: Math.max(...lons), maxLat: Math.max(...lats) };
}

/** True when box `b` intersects box `a` after `a` is expanded by `margin` × its own size. */
function near(a: Box, b: Box, margin: number): boolean {
    const dw = (a.maxLon - a.minLon) * margin;
    const dh = (a.maxLat - a.minLat) * margin;
    return !(b.minLon > a.maxLon + dw || b.maxLon < a.minLon - dw || b.minLat > a.maxLat + dh || b.maxLat < a.minLat - dh);
}

/**
 * Pick the neighbouring regions worth showing as an overlap-guard reference layer: same type as
 * the region being edited (cities don't conflict with their own hotspots), geographically near
 * the anchor bbox, excluding the region itself. Capped so a dense area can't flood the map.
 */
export function nearbyReferenceBoxes(params: {
    regions: Region[];
    anchor: GeoPolygon | null;
    type?: "city" | "hotspot";
    excludeId?: string;
    margin?: number;
    max?: number;
}): ReferenceBox[] {
    const { regions, anchor, type, excludeId, margin = 1, max = 80 } = params;
    if (!anchor) return [];
    const ab = boxOf(anchor);
    if (!ab) return [];

    const out: ReferenceBox[] = [];
    for (const r of regions) {
        if (excludeId && r.id === excludeId) continue;
        if (type && r.type !== type) continue;
        const poly = regionBboxPolygon(r.bbox);
        if (!poly) continue;
        const rb = boxOf(poly);
        if (!rb) continue;
        // Note: we intentionally DON'T skip boxes geometrically identical to the anchor — siblings
        // that share the anchor's bbox (a seed-data issue) are exactly the overlaps an admin needs
        // to see. Self is excluded by `excludeId`.
        if (!near(ab, rb, margin)) continue;
        out.push({ id: r.id, name: r.name, bbox: poly });
        if (out.length >= max) break;
    }
    return out;
}
