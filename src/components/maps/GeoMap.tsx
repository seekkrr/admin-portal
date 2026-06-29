import { useEffect, useRef, memo, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { config } from "@/config/env";
import type { GeoPolygon } from "@/types";

/** Minimal GeoJSON Feature shape for a Polygon — avoids relying on the ambient GeoJSON global. */
interface PolygonFeature {
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: GeoPolygon;
}

mapboxgl.accessToken = config.mapbox.accessToken;

export interface GeoMapPoint {
    /** [lon, lat] */
    coordinates: [number, number];
    label?: string;
    /** Tailwind-ish hex used for the pin background. Defaults to indigo. */
    color?: string;
    /** Optional popup HTML (already escaped by caller). */
    popupHtml?: string;
}

export interface GeoMapProps {
    /** Marker pins to render. */
    points?: GeoMapPoint[];
    /** Optional GeoJSON polygon (e.g. a region bbox) drawn as a filled outline. */
    polygon?: GeoPolygon | null;
    /** Optional explicit center [lon, lat]. Falls back to points/polygon centroid. */
    center?: [number, number] | null;
    /** Draws a translucent circle (metres) around the first point — used for narrative triggers. */
    radiusMeters?: number | null;
    height?: string;
    className?: string;
    /** Initial zoom when there is a single point / explicit center. */
    zoom?: number;
    /** When set, clicking the map calls this with the picked [lon, lat]. */
    onPick?: (coords: [number, number]) => void;
    /** Hide the floating coordinate readout. */
    hideCoordsReadout?: boolean;
    /** Make the picker pin draggable; fires `onMarkerDragEnd` when released. */
    draggable?: boolean;
    /** Fired with [lon, lat] after the draggable pin is dragged. */
    onMarkerDragEnd?: (coords: [number, number]) => void;
    /**
     * Committed [lon, lat] of the draggable pin (source of truth). The pin moves here whenever
     * this changes; the map only recenters when the point would fall outside the current view.
     * Pass `null` to hide the pin.
     */
    markerPosition?: [number, number] | null;
    /** Color for the managed draggable pin (defaults to indigo). */
    pinColor?: string;
}

function circlePolygon(center: [number, number], radiusM: number, steps = 64): PolygonFeature {
    const [lng, lat] = center;
    const coords: [number, number][] = [];
    const earth = 6378137;
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const dx = radiusM * Math.cos(angle);
        const dy = radiusM * Math.sin(angle);
        const dLng = (dx / (earth * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
        const dLat = (dy / earth) * (180 / Math.PI);
        coords.push([lng + dLng, lat + dLat]);
    }
    return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

function pinElement(color: string, label?: string): HTMLDivElement {
    const el = document.createElement("div");
    el.innerHTML = `
        <div class="relative group" style="cursor:pointer">
            <div style="width:28px;height:28px;background:${color};" class="rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg border-2 border-white">
                ${label ? label.slice(0, 2) : ""}
            </div>
            <div style="border-top-color:${color}" class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent"></div>
        </div>`;
    return el;
}

/**
 * Generic, offline-friendly Mapbox display used across Markers, Regions and
 * Narratives. Renders point pins, an optional region polygon and an optional
 * trigger-radius circle, and can act as a coordinate picker via `onPick`.
 */
export const GeoMap = memo(function GeoMap({
    points = [],
    polygon = null,
    center = null,
    radiusMeters = null,
    height = "360px",
    className = "",
    zoom = 13,
    onPick,
    hideCoordsReadout = false,
    draggable = false,
    onMarkerDragEnd,
    markerPosition = null,
    pinColor,
}: GeoMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const dragMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const onPickRef = useRef(onPick);
    const onMarkerDragEndRef = useRef(onMarkerDragEnd);
    const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);

    // Keep latest callbacks in refs so the build-once map effect never holds stale ones.
    useEffect(() => {
        onPickRef.current = onPick;
        onMarkerDragEndRef.current = onMarkerDragEnd;
    });

    useEffect(() => {
        if (!containerRef.current) return;

        const allCoords: [number, number][] = points.map((p) => p.coordinates);
        const ring = polygon?.coordinates?.[0];
        if (ring) {
            ring.forEach((c) => allCoords.push([c[0] ?? 0, c[1] ?? 0]));
        }

        const resolvedCenter: [number, number] =
            center ??
            (allCoords.length
                ? [
                    allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length,
                    allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length,
                ]
                : [config.mapbox.defaultCenter.lng, config.mapbox.defaultCenter.lat]);

        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: config.mapbox.style,
            center: resolvedCenter,
            zoom,
            attributionControl: false,
        });
        mapRef.current = map;

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");

        map.on("style.load", () => {
            if (mapRef.current !== map) return;
            // Region polygon
            if (polygon) {
                map.addSource("geo-polygon", { type: "geojson", data: { type: "Feature", properties: {}, geometry: polygon } });
                map.addLayer({ id: "geo-polygon-fill", type: "fill", source: "geo-polygon", paint: { "fill-color": "#06b6d4", "fill-opacity": 0.12 } });
                map.addLayer({ id: "geo-polygon-line", type: "line", source: "geo-polygon", paint: { "line-color": "#0891b2", "line-width": 2 } });
            }

            // Trigger radius circle around first point
            if (radiusMeters && points[0]) {
                map.addSource("geo-radius", { type: "geojson", data: circlePolygon(points[0].coordinates, radiusMeters) });
                map.addLayer({ id: "geo-radius-fill", type: "fill", source: "geo-radius", paint: { "fill-color": "#6366f1", "fill-opacity": 0.15 } });
                map.addLayer({ id: "geo-radius-line", type: "line", source: "geo-radius", paint: { "line-color": "#4f46e5", "line-width": 1.5, "line-dasharray": [2, 2] } });
            }

            // Pins
            points.forEach((p) => {
                const el = pinElement(p.color ?? "#6366f1", p.label);
                const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat(p.coordinates);
                if (p.popupHtml) {
                    marker.setPopup(new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(p.popupHtml));
                }
                marker.addTo(map);
                markersRef.current.push(marker);
            });

            // Fit bounds when we have more than one coordinate
            if (allCoords.length > 1) {
                const bounds = new mapboxgl.LngLatBounds();
                allCoords.forEach((c) => bounds.extend(c));
                map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 0 });
            }
        });

        if (onPick) {
            map.getCanvas().style.cursor = "crosshair";
            // The managed pin (if any) follows the committed coordinate via the position effect,
            // so the click handler only needs to report the picked point.
            map.on("click", (e) =>
                onPickRef.current?.([Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))]),
            );
        }

        if (!hideCoordsReadout) {
            map.on("mousemove", (e) => setCursor({ lng: Number(e.lngLat.lng.toFixed(5)), lat: Number(e.lngLat.lat.toFixed(5)) }));
            map.on("mouseout", () => setCursor(null));
        }

        return () => {
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(points), JSON.stringify(polygon), JSON.stringify(center), radiusMeters, zoom]);

    // Draggable picker pin — created ONCE (so its DOM node and drag handler are stable) and moved
    // imperatively, so adjusting the location never tears down and rebuilds the map. Assumes
    // structural props (points/polygon/center/zoom) stay stable in draggable mode; the marker
    // create modal honours this by not feeding the live coordinate back into those props.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !draggable) return;

        const el = pinElement(pinColor ?? "#6366f1");
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom", draggable: true });
        marker.on("dragend", () => {
            const { lng, lat } = marker.getLngLat();
            onMarkerDragEndRef.current?.([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
        });
        dragMarkerRef.current = marker;

        return () => {
            marker.remove();
            if (dragMarkerRef.current === marker) dragMarkerRef.current = null;
        };
    }, [draggable, pinColor]);

    // Move the managed pin to the committed coordinate (source of truth). Recenter the map only
    // when the point would fall outside the current view, so search-picks fly there but a small
    // drag/click never yanks the camera.
    useEffect(() => {
        const map = mapRef.current;
        const marker = dragMarkerRef.current;
        if (!map || !draggable || !marker) return;
        if (!markerPosition) {
            marker.remove();
            return;
        }
        marker.setLngLat(markerPosition).addTo(map);
        if (!map.getBounds()?.contains(markerPosition)) {
            map.flyTo({ center: markerPosition, zoom: Math.max(map.getZoom(), 13), duration: 800 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draggable, markerPosition?.[0], markerPosition?.[1]]);

    return (
        <div className="relative">
            <div
                ref={containerRef}
                className={`rounded-xl overflow-hidden shadow-sm border border-neutral-200 ${className}`}
                style={{ height }}
                aria-label="Map"
            />
            {onPick && (
                <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-neutral-200/60 text-[11px] font-medium text-neutral-600">
                    Click the map to set coordinates
                </div>
            )}
            {!hideCoordsReadout && cursor && (
                <div className="absolute bottom-3 right-3 z-10 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm text-[11px] font-mono text-white/90">
                    {cursor.lat}, {cursor.lng}
                </div>
            )}
        </div>
    );
});
