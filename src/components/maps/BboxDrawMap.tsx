import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { config } from "@/config/env";
import type { GeoPolygon, GeoPoint } from "@/types";

mapboxgl.accessToken = config.mapbox.accessToken;

interface Box {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
}

/** A neighbouring region drawn as a read-only reference outline so admins avoid overlap. */
export interface ReferenceBox {
    id: string;
    name: string;
    bbox: GeoPolygon;
}

export interface BboxDrawMapProps {
    /** Current bbox as a GeoJSON Polygon (closed 5-point ring), or null when none. */
    value: GeoPolygon | null;
    /** Fires with the edited bbox polygon + its center whenever the box changes. */
    onChange: (bbox: GeoPolygon, center: GeoPoint) => void;
    /** Initial map center [lon, lat]; falls back to the bbox center or the app default. */
    center?: [number, number] | null;
    /** Read-only neighbouring region boxes drawn as a muted reference layer (overlap guard). */
    referenceBoxes?: ReferenceBox[];
    height?: string;
}

// ── Geometry helpers — a bbox is fully defined by two opposite corners. ───────
function ringToBox(poly: GeoPolygon | null): Box | null {
    const ring = poly?.coordinates?.[0];
    if (!ring || ring.length < 4) return null;
    const lons = ring.map((c) => c[0] ?? 0);
    const lats = ring.map((c) => c[1] ?? 0);
    return { minLon: Math.min(...lons), minLat: Math.min(...lats), maxLon: Math.max(...lons), maxLat: Math.max(...lats) };
}

function boxToRing(b: Box): number[][] {
    return [
        [b.minLon, b.minLat],
        [b.maxLon, b.minLat],
        [b.maxLon, b.maxLat],
        [b.minLon, b.maxLat],
        [b.minLon, b.minLat],
    ];
}

function boxToPolygon(b: Box): GeoPolygon {
    return { type: "Polygon", coordinates: [boxToRing(b)] };
}

function boxCenter(b: Box): [number, number] {
    return [Number(((b.minLon + b.maxLon) / 2).toFixed(6)), Number(((b.minLat + b.maxLat) / 2).toFixed(6))];
}

function cornersToBox(a: [number, number], c: [number, number]): Box {
    return {
        minLon: Math.min(a[0], c[0]),
        minLat: Math.min(a[1], c[1]),
        maxLon: Math.max(a[0], c[0]),
        maxLat: Math.max(a[1], c[1]),
    };
}

function cornerEl(): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText =
        "width:14px;height:14px;background:#fff;border:2px solid #0891b2;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.3);cursor:grab;";
    return el;
}

/**
 * Draw / adjust a region bounding box directly on the map. Click two opposite corners to draw a
 * box from scratch, or drag the two corner handles to fine-tune an existing one. Emits an
 * axis-aligned GeoJSON Polygon + center. Built on the bare mapbox-gl already used by GeoMap —
 * no extra draw dependency — and self-contained so it never destabilises the generic GeoMap.
 */
export function BboxDrawMap({ value, onChange, center = null, referenceBoxes = [], height = "300px" }: BboxDrawMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const swRef = useRef<mapboxgl.Marker | null>(null);
    const neRef = useRef<mapboxgl.Marker | null>(null);
    const boxRef = useRef<Box | null>(ringToBox(value));
    const drawFirstRef = useRef<[number, number] | null>(null);
    const onChangeRef = useRef(onChange);
    const refBoxesRef = useRef(referenceBoxes);
    const [mode, setMode] = useState<"idle" | "draw">(ringToBox(value) ? "idle" : "draw");
    const modeRef = useRef(mode);

    useEffect(() => {
        onChangeRef.current = onChange;
        modeRef.current = mode;
        refBoxesRef.current = referenceBoxes;
    });

    const setSourceData = (poly: GeoPolygon | null) => {
        const map = mapRef.current;
        const src = map?.getSource("bbox-draw") as mapboxgl.GeoJSONSource | undefined;
        src?.setData(
            poly
                ? { type: "Feature", properties: {}, geometry: poly }
                : { type: "FeatureCollection", features: [] },
        );
    };

    const setRefData = (boxes: ReferenceBox[]) => {
        const map = mapRef.current;
        const src = map?.getSource("bbox-ref") as mapboxgl.GeoJSONSource | undefined;
        src?.setData({
            type: "FeatureCollection",
            features: boxes
                .filter((b) => b.bbox?.coordinates?.length)
                .map((b) => ({ type: "Feature" as const, properties: { name: b.name ?? "" }, geometry: b.bbox })),
        });
    };

    const positionHandles = (box: Box | null) => {
        const map = mapRef.current;
        if (!map) return;
        if (!box) {
            swRef.current?.remove();
            neRef.current?.remove();
            return;
        }
        swRef.current?.setLngLat([box.minLon, box.minLat]).addTo(map);
        neRef.current?.setLngLat([box.maxLon, box.maxLat]).addTo(map);
    };

    const commit = (box: Box) => {
        boxRef.current = box;
        setSourceData(boxToPolygon(box));
        positionHandles(box);
        onChangeRef.current(boxToPolygon(box), { type: "Point", coordinates: boxCenter(box) });
    };

    // Build the map once. Callbacks/state are read through refs so we never rebuild on prop change.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const initial = center ?? (boxRef.current ? boxCenter(boxRef.current) : [config.mapbox.defaultCenter.lng, config.mapbox.defaultCenter.lat]);

        const map = new mapboxgl.Map({
            container,
            style: config.mapbox.style,
            center: initial,
            zoom: 9,
            attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        // The editor mounts inside a card that may not be at its final size when the map is created
        // (e.g. the edit form revealing). Without this, Mapbox measures the wrong viewport and the
        // basemap tiles never paint (blank map). Re-measure whenever the container resizes.
        const resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(container);

        const sw = new mapboxgl.Marker({ element: cornerEl(), draggable: true, anchor: "center" });
        const ne = new mapboxgl.Marker({ element: cornerEl(), draggable: true, anchor: "center" });
        swRef.current = sw;
        neRef.current = ne;

        const onCornerDrag = () => {
            const a = sw.getLngLat();
            const b = ne.getLngLat();
            setSourceData(boxToPolygon(cornersToBox([a.lng, a.lat], [b.lng, b.lat])));
        };
        const onCornerDragEnd = () => {
            const a = sw.getLngLat();
            const b = ne.getLngLat();
            commit(cornersToBox([Number(a.lng.toFixed(6)), Number(a.lat.toFixed(6))], [Number(b.lng.toFixed(6)), Number(b.lat.toFixed(6))]));
        };
        sw.on("drag", onCornerDrag);
        ne.on("drag", onCornerDrag);
        sw.on("dragend", onCornerDragEnd);
        ne.on("dragend", onCornerDragEnd);

        map.on("style.load", () => {
            if (mapRef.current !== map) return;
            // Reference layer for neighbouring regions (added first so the editable box sits on top).
            map.addSource("bbox-ref", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            map.addLayer({ id: "bbox-ref-fill", type: "fill", source: "bbox-ref", paint: { "fill-color": "#f59e0b", "fill-opacity": 0.06 } });
            map.addLayer({ id: "bbox-ref-line", type: "line", source: "bbox-ref", paint: { "line-color": "#b45309", "line-width": 1.5, "line-dasharray": [2, 1], "line-opacity": 0.7 } });
            map.addLayer({
                id: "bbox-ref-label",
                type: "symbol",
                source: "bbox-ref",
                layout: { "text-field": ["get", "name"], "text-size": 11, "symbol-placement": "point" },
                paint: { "text-color": "#92400e", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
            });
            setRefData(refBoxesRef.current);

            map.addSource("bbox-draw", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            map.addLayer({ id: "bbox-draw-fill", type: "fill", source: "bbox-draw", paint: { "fill-color": "#06b6d4", "fill-opacity": 0.12 } });
            map.addLayer({ id: "bbox-draw-line", type: "line", source: "bbox-draw", paint: { "line-color": "#0891b2", "line-width": 2 } });
            if (boxRef.current) {
                setSourceData(boxToPolygon(boxRef.current));
                positionHandles(boxRef.current);
                const b = boxRef.current;
                map.fitBounds([[b.minLon, b.minLat], [b.maxLon, b.maxLat]], { padding: 48, duration: 0 });
            } else {
                map.getCanvas().style.cursor = "crosshair";
            }
        });

        // Two-click draw-from-scratch.
        map.on("click", (e) => {
            if (modeRef.current !== "draw") return;
            const pt: [number, number] = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];
            if (!drawFirstRef.current) {
                drawFirstRef.current = pt;
                return;
            }
            commit(cornersToBox(drawFirstRef.current, pt));
            drawFirstRef.current = null;
            map.getCanvas().style.cursor = "";
            setMode("idle");
        });

        // Live preview of the box while placing the second corner.
        map.on("mousemove", (e) => {
            if (modeRef.current !== "draw" || !drawFirstRef.current) return;
            setSourceData(boxToPolygon(cornersToBox(drawFirstRef.current, [e.lngLat.lng, e.lngLat.lat])));
        });

        return () => {
            resizeObserver.disconnect();
            sw.remove();
            ne.remove();
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync when the bbox is replaced from outside (e.g. a new place picked in the create modal).
    useEffect(() => {
        const next = ringToBox(value);
        const cur = boxRef.current;
        const same =
            (!next && !cur) ||
            (next && cur && next.minLon === cur.minLon && next.minLat === cur.minLat && next.maxLon === cur.maxLon && next.maxLat === cur.maxLat);
        if (same) return;
        boxRef.current = next;
        if (!mapRef.current?.isStyleLoaded()) return;
        setSourceData(next ? boxToPolygon(next) : null);
        positionHandles(next);
        if (next) {
            setMode("idle");
            mapRef.current.fitBounds([[next.minLon, next.minLat], [next.maxLon, next.maxLat]], { padding: 48, duration: 300 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(value)]);

    // Sync the neighbouring-region reference layer when the supplied boxes change (e.g. once the
    // nearby-regions query resolves, or the picked place changes in the create modal).
    useEffect(() => {
        if (!mapRef.current?.isStyleLoaded()) return;
        setRefData(referenceBoxes);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(referenceBoxes)]);

    const startRedraw = () => {
        boxRef.current = null;
        drawFirstRef.current = null;
        setSourceData(null);
        positionHandles(null);
        setMode("draw");
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = "crosshair";
    };

    return (
        <div className="relative">
            <div
                ref={containerRef}
                className="rounded-xl overflow-hidden shadow-sm border border-neutral-200"
                style={{ height }}
                aria-label="Bounding box editor"
            />
            <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-neutral-200/60 text-[11px] font-medium text-neutral-600">
                {mode === "draw"
                    ? drawFirstRef.current
                        ? "Click the opposite corner"
                        : "Click two opposite corners to draw the box"
                    : "Drag the corner handles to adjust"}
            </div>
            {mode === "idle" && (
                <button
                    type="button"
                    onClick={startRedraw}
                    className="absolute top-3 right-12 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-neutral-200/60 text-[11px] font-medium text-cyan-700 hover:bg-white"
                >
                    Redraw box
                </button>
            )}
            {referenceBoxes.length > 0 && (
                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-neutral-200/60 text-[11px] font-medium text-neutral-600">
                    <span className="inline-block w-3 h-2.5 rounded-sm border border-dashed" style={{ borderColor: "#b45309", background: "rgba(245,158,11,0.12)" }} />
                    Nearby regions ({referenceBoxes.length}) — avoid overlap
                </div>
            )}
        </div>
    );
}
