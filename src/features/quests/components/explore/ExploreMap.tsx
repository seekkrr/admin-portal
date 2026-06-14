import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { RefreshCw, AlertTriangle, Map } from "lucide-react";
import { config } from "@/config/env";
import { useQuestExperience, type MarkerWithCoords } from "../../hooks/useQuestExperience";
import { MarkerOverlayCard } from "./MarkerOverlayCard";
import { ExploreLegend } from "./ExploreLegend";
import type { FeatureCollection } from "geojson";
import type { V2QuestDetail, GeoPolygon, AdminNarrative, Region } from "@/types";

// Inject pulse glow keyframes once
const STYLE_ID = "seekkrr-explore-pulse";
function injectPulseCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
        @keyframes sk-pulse {
            0%, 100% {
                box-shadow: 0 0 6px 2px rgba(139,92,246,0.7),
                            0 0 18px 4px rgba(139,92,246,0.3);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 14px 4px rgba(167,139,250,0.9),
                            0 0 32px 8px rgba(139,92,246,0.45);
                transform: scale(1.08);
            }
        }
        @keyframes sk-pulse-amber {
            0%, 100% { box-shadow: 0 0 6px 2px rgba(245,158,11,0.6), 0 0 16px rgba(245,158,11,0.2); }
            50%       { box-shadow: 0 0 12px 4px rgba(251,191,36,0.8), 0 0 28px rgba(245,158,11,0.4); }
        }
        .sk-marker       { animation: sk-pulse 2.8s ease-in-out infinite; cursor: pointer; }
        .sk-marker-opt   { animation: sk-pulse 3.2s ease-in-out infinite; cursor: pointer; }
        .sk-narrative    { animation: sk-pulse-amber 2.5s ease-in-out infinite; }
        .sk-marker:hover { animation: none; transform: scale(1.2) !important;
                           box-shadow: 0 0 24px 6px rgba(167,139,250,1) !important; transition: all 0.15s ease; }
    `;
    document.head.appendChild(s);
}

/** Compute centroid from a GeoPolygon or flat bbox number[] */
function regionCenter(region: Region): [number, number] | null {
    const bbox = region.bbox;
    if (!bbox) return null;
    if (Array.isArray(bbox) && bbox.length >= 4) {
        const b = bbox as [number, number, number, number];
        return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    }
    const poly = bbox as GeoPolygon;
    if (poly?.type === "Polygon" && poly.coordinates?.[0]?.length) {
        const ring = poly.coordinates[0];
        const lng = ring.reduce((s, c) => s + (c[0] ?? 0), 0) / ring.length;
        const lat = ring.reduce((s, c) => s + (c[1] ?? 0), 0) / ring.length;
        return [lng, lat];
    }
    return null;
}

interface ExploreMapProps {
    questId: string;
    detail: V2QuestDetail;
}

export function ExploreMap({ questId, detail }: ExploreMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markerRefs = useRef<mapboxgl.Marker[]>([]);
    const [mapReady, setMapReady] = useState(false);
    const [activeMarker, setActiveMarker] = useState<MarkerWithCoords | null>(null);
    const hasFitRef = useRef(false);
    const hasRegionFlewRef = useRef(false);

    const experience = useQuestExperience(questId, detail, true);

    // ── Init map ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;
        injectPulseCSS();
        mapboxgl.accessToken = config.mapbox.accessToken;

        const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: config.mapbox.style,           // mapbox://styles/mapbox/standard
            center: [config.mapbox.defaultCenter.lng, config.mapbox.defaultCenter.lat],
            zoom: 14,
            pitch: 55,
            bearing: -17,
            antialias: true,
        });
        mapRef.current = map;

        map.on("load", () => {
            // Standard style: set atmospheric dusk lighting
            try {
                map.setConfigProperty("basemap", "lightPreset", "dusk");
            } catch {
                // Non-standard style fallback — ignore
            }

            // Cinematic fog
            map.setFog({
                color: "rgba(12, 8, 30, 0.6)",
                "high-color": "rgba(30, 15, 70, 0.9)",
                "horizon-blend": 0.08,
                "space-color": "rgba(4, 2, 14, 1)",
                "star-intensity": 0.45,
            });

            setMapReady(true);
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-left");

        return () => {
            markerRefs.current.forEach((m) => m.remove());
            markerRefs.current = [];
            map.remove();
            mapRef.current = null;
            setMapReady(false);
            hasFitRef.current = false;
            hasRegionFlewRef.current = false;
        };
    }, []);

    // ── Marker pins + route polyline ─────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady || experience.isMarkersLoading) return;

        markerRefs.current.forEach((m) => m.remove());
        markerRefs.current = [];

        const sorted = [...experience.markers]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .filter((m): m is MarkerWithCoords & { realLng: number; realLat: number } =>
                m.realLng !== null && m.realLat !== null
            );

        if (sorted.length === 0) return;

        sorted.forEach((m, i) => {
            const el = document.createElement("div");
            el.className = m.is_required ? "sk-marker" : "sk-marker-opt";
            const gradient = m.is_required
                ? "linear-gradient(145deg,#6d28d9,#8b5cf6)"
                : "linear-gradient(145deg,#4c1d95,#6d28d9)";
            el.style.cssText = `
                width:36px;height:36px;border-radius:50%;
                background:${gradient};
                border:2px solid rgba(167,139,250,0.55);
                display:flex;align-items:center;justify-content:center;
                color:#fff;font-weight:800;font-size:13px;
                font-family:system-ui,sans-serif;line-height:1;
                user-select:none;
            `;
            el.textContent = String(m.order ?? i + 1);
            el.addEventListener("click", () => setActiveMarker(m));

            const pin = new mapboxgl.Marker({ element: el })
                .setLngLat([m.realLng, m.realLat])
                .addTo(map);
            markerRefs.current.push(pin);
        });

        // Fit bounds to markers (only first time)
        if (!hasFitRef.current) {
            const bounds = new mapboxgl.LngLatBounds();
            sorted.forEach((m) => bounds.extend([m.realLng, m.realLat]));
            map.fitBounds(bounds, {
                padding: 90,
                maxZoom: 17,
                pitch: 55,
                bearing: -17,
                duration: 1400,
            });
            hasFitRef.current = true;
        }

        // Vibrant quest route polyline
        const routeCoords = sorted.map((m): [number, number] => [m.realLng, m.realLat]);
        if (routeCoords.length >= 2) {
            const routeGeo = {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "LineString" as const, coordinates: routeCoords },
            };
            if (map.getSource("route")) {
                (map.getSource("route") as mapboxgl.GeoJSONSource).setData(routeGeo);
            } else {
                map.addSource("route", { type: "geojson", data: routeGeo });
                // Glow under-layer
                map.addLayer({
                    id: "route-glow",
                    type: "line",
                    source: "route",
                    paint: {
                        "line-color": "#a855f7",
                        "line-width": 8,
                        "line-opacity": 0.2,
                        "line-blur": 4,
                    },
                });
                // Main line
                map.addLayer({
                    id: "route-line",
                    type: "line",
                    source: "route",
                    paint: {
                        "line-color": "#c084fc",
                        "line-width": 2.5,
                        "line-opacity": 0.85,
                        "line-dasharray": [2, 1.5],
                    },
                });
            }
        }
    }, [mapReady, experience.markers, experience.isMarkersLoading]);

    // ── Region boundary + fly-to-region fallback ──────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady || !experience.region) return;

        const region = experience.region;

        // Fly to region center if no markers had real coords yet
        if (!hasFitRef.current && !hasRegionFlewRef.current) {
            const center = regionCenter(region);
            if (center) {
                map.flyTo({ center, zoom: 13, pitch: 55, bearing: -17, duration: 1200 });
                hasRegionFlewRef.current = true;
            }
        }

        const bbox = region.bbox;
        if (!bbox || Array.isArray(bbox)) return;
        const boundary = bbox as GeoPolygon;

        if (map.getSource("region-boundary")) {
            (map.getSource("region-boundary") as mapboxgl.GeoJSONSource).setData({
                type: "Feature", properties: {}, geometry: boundary,
            });
        } else {
            map.addSource("region-boundary", {
                type: "geojson",
                data: { type: "Feature", properties: {}, geometry: boundary },
            });
            map.addLayer({
                id: "region-fill",
                type: "fill",
                source: "region-boundary",
                paint: { "fill-color": "#7c3aed", "fill-opacity": 0.07 },
            });
            map.addLayer({
                id: "region-outline",
                type: "line",
                source: "region-boundary",
                paint: { "line-color": "#a78bfa", "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.7 },
            });
        }
    }, [mapReady, experience.region]);

    // ── Narrative trigger circles ─────────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady || experience.isNarrativesLoading) return;

        const points = (experience.narratives as AdminNarrative[])
            .filter((n): n is AdminNarrative & { trigger_location: NonNullable<AdminNarrative["trigger_location"]> } =>
                n.trigger_location !== null
            )
            .map((n) => ({
                type: "Feature" as const,
                properties: { radius: n.trigger_radius_m ?? 50 },
                geometry: { type: "Point" as const, coordinates: n.trigger_location.coordinates },
            }));

        if (points.length === 0) return;

        const fc: FeatureCollection = { type: "FeatureCollection", features: points };
        if (map.getSource("narrative-triggers")) {
            (map.getSource("narrative-triggers") as mapboxgl.GeoJSONSource).setData(fc);
        } else {
            // Narrative glow halo
            map.addSource("narrative-triggers", { type: "geojson", data: fc });
            map.addLayer({
                id: "narrative-halo",
                type: "circle",
                source: "narrative-triggers",
                paint: {
                    "circle-radius": 28,
                    "circle-color": "#f59e0b",
                    "circle-opacity": 0.12,
                    "circle-blur": 1,
                },
            });
            map.addLayer({
                id: "narrative-circles",
                type: "circle",
                source: "narrative-triggers",
                paint: {
                    "circle-radius": 14,
                    "circle-color": "#fbbf24",
                    "circle-opacity": 0.3,
                    "circle-stroke-color": "#f59e0b",
                    "circle-stroke-width": 1.5,
                    "circle-stroke-opacity": 0.75,
                },
            });
        }
    }, [mapReady, experience.narratives, experience.isNarrativesLoading]);

    // ── Legend fly-to ─────────────────────────────────────────────────────────
    const handleLegendSelect = useCallback((marker: MarkerWithCoords) => {
        if (marker.realLng !== null && marker.realLat !== null && mapRef.current) {
            mapRef.current.flyTo({
                center: [marker.realLng, marker.realLat],
                zoom: 17,
                pitch: 55,
                bearing: -17,
                duration: 900,
            });
        }
        setActiveMarker(marker);
    }, []);

    const hasErrors = experience.markersError || experience.tasksError ||
        experience.narrativesError || experience.regionError;
    const isLoading = experience.isMarkersLoading || experience.isNarrativesLoading || experience.isRegionLoading;
    const hasNoCoords = !experience.isMarkersLoading && experience.markers.length > 0 &&
        experience.markers.every((m) => m.realLng === null);

    return (
        <div
            className="relative rounded-2xl overflow-hidden border border-violet-900/30"
            style={{ height: 560, background: "#080614" }}
        >
            <div ref={mapContainer} className="w-full h-full" />

            {/* Loading */}
            {isLoading && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-violet-200 border border-violet-800/40">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                    Loading experience…
                </div>
            )}

            {/* Partial error */}
            {hasErrors && !isLoading && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-amber-950/80 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-amber-300 border border-amber-700/40">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Some layers unavailable
                </div>
            )}

            {/* No coords notice */}
            {hasNoCoords && !isLoading && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-neutral-400 border border-neutral-700/30">
                    <Map className="w-3.5 h-3.5" />
                    Marker coordinates not yet published
                </div>
            )}

            {/* Dark legend */}
            <ExploreLegend
                markers={experience.markers}
                activeMarkerId={activeMarker?.marker_id ?? null}
                onSelect={handleLegendSelect}
            />

            {/* Overlay card */}
            {activeMarker && (
                <MarkerOverlayCard
                    marker={activeMarker}
                    onClose={() => setActiveMarker(null)}
                />
            )}
        </div>
    );
}
