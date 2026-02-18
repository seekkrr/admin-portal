import { useEffect, useRef, useCallback, memo } from "react";
import mapboxgl from "mapbox-gl";
import { config } from "@/config/env";
import type { QuestDetailLocation, QuestDetailStep } from "@/types";

mapboxgl.accessToken = config.mapbox.accessToken;

// ---- Time-based lighting ----
type LightPreset = "dawn" | "day" | "dusk" | "night";

const FOG_CONFIGS: Record<LightPreset, mapboxgl.FogSpecification> = {
    dawn: {
        color: "rgb(255, 200, 150)",
        "high-color": "rgb(255, 160, 100)",
        "horizon-blend": 0.08,
        "space-color": "rgb(40, 30, 50)",
        "star-intensity": 0.2,
    },
    day: {
        color: "rgb(220, 235, 255)",
        "high-color": "rgb(135, 206, 235)",
        "horizon-blend": 0.05,
    },
    dusk: {
        color: "rgb(255, 150, 120)",
        "high-color": "rgb(180, 100, 150)",
        "horizon-blend": 0.1,
        "space-color": "rgb(30, 20, 50)",
        "star-intensity": 0.4,
    },
    night: {
        color: "rgb(10, 20, 40)",
        "high-color": "rgb(5, 10, 30)",
        "horizon-blend": 0.12,
        "space-color": "rgb(0, 5, 15)",
        "star-intensity": 1.0,
    },
};

function getTimeBasedPreset(): LightPreset {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 7) return "dawn";
    if (hour >= 7 && hour < 18) return "day";
    if (hour >= 18 && hour < 20) return "dusk";
    return "night";
}

// ---- Props ----
interface QuestRouteMapProps {
    location: QuestDetailLocation;
    steps: QuestDetailStep[];
    height?: string;
    className?: string;
}

// ---- Marker helpers ----
function createWaypointMarker(index: number, total: number): HTMLDivElement {
    const el = document.createElement("div");
    const isStart = index === 0;
    const isEnd = index === total - 1;
    const label = isStart ? "S" : isEnd ? "E" : String(index);
    const gradient = isStart
        ? "from-emerald-500 to-emerald-600"
        : isEnd
            ? "from-red-500 to-red-600"
            : "from-indigo-500 to-purple-600";

    el.innerHTML = `
        <div class="relative group">
            <div class="w-9 h-9 bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white">
                ${label}
            </div>
            <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent ${isStart ? "border-t-emerald-600" : isEnd ? "border-t-red-600" : "border-t-purple-600"}"></div>
        </div>
    `;
    return el;
}

function createStepMarker(order: number): HTMLDivElement {
    const el = document.createElement("div");
    el.innerHTML = `
        <div class="relative">
            <div class="w-7 h-7 bg-gradient-to-br from-violet-400 to-violet-600 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-md border-2 border-white rotate-45">
                <span class="-rotate-45">${order}</span>
            </div>
        </div>
    `;
    return el;
}

// ---- Component ----
export const QuestRouteMap = memo(function QuestRouteMap({
    location,
    steps,
    height = "420px",
    className = "",
}: QuestRouteMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const abortRef = useRef<AbortController | null>(null);

    // Collect all coordinate points: waypoints + step locations
    const allCoords = useCallback((): [number, number][] => {
        const coords: [number, number][] = [];

        // Start
        if (location.start_location?.coordinates) {
            coords.push(location.start_location.coordinates);
        }

        // Waypoints (in order)
        const sortedWps = [...(location.route_waypoints ?? [])].sort(
            (a, b) => a.order - b.order
        );
        for (const wp of sortedWps) {
            if (wp.location?.coordinates) {
                coords.push(wp.location.coordinates);
            }
        }

        // End
        if (location.end_location?.coordinates) {
            coords.push(location.end_location.coordinates);
        }

        return coords;
    }, [location]);

    // Fetch walking route
    const fetchWalkingRoute = useCallback(
        async (coordinates: [number, number][]): Promise<number[][] | null> => {
            if (coordinates.length < 2) return null;
            abortRef.current?.abort();
            abortRef.current = new AbortController();

            try {
                const coordStr = coordinates
                    .map((c) => `${c[0]},${c[1]}`)
                    .join(";");
                const res = await fetch(
                    `https://api.mapbox.com/directions/v5/mapbox/walking/${coordStr}?geometries=geojson&overview=full&access_token=${config.mapbox.accessToken}`,
                    { signal: abortRef.current.signal }
                );
                if (!res.ok) return null;
                const data = await res.json();
                return data.routes?.[0]?.geometry?.coordinates ?? null;
            } catch {
                return null;
            }
        },
        []
    );

    // Initialize map
    useEffect(() => {
        if (!containerRef.current) return;

        const coords = allCoords();
        const center: [number, number] =
            coords.length > 0
                ? [
                    coords.reduce((s, c) => s + c[0], 0) / coords.length,
                    coords.reduce((s, c) => s + c[1], 0) / coords.length,
                ]
                : [config.mapbox.defaultCenter.lng, config.mapbox.defaultCenter.lat];

        const lightPreset = getTimeBasedPreset();

        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: config.mapbox.style,
            center,
            zoom: 15,
            pitch: 65,
            bearing: -17.6,
            antialias: true,
            maxPitch: 85,
            trackResize: true,
            fadeDuration: 0,
            config: {
                basemap: {
                    lightPreset,
                    showPointOfInterestLabels: true,
                    showPlaceLabels: true,
                    showRoadLabels: true,
                    showTransitLabels: true,
                },
            },
        });

        // Controls
        map.addControl(
            new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }),
            "top-right"
        );
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");
        map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

        map.on("style.load", async () => {
            // 3D Terrain
            if (!map.getSource("mapbox-dem")) {
                map.addSource("mapbox-dem", {
                    type: "raster-dem",
                    url: "mapbox://mapbox.mapbox-terrain-dem-v1",
                    tileSize: 512,
                    maxzoom: 14,
                });
            }
            map.setTerrain({ source: "mapbox-dem", exaggeration: 1.8 });
            map.setFog(FOG_CONFIGS[lightPreset]);

            // Route source
            map.addSource("route", {
                type: "geojson",
                data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
            });

            // Route layers: glow + main + dashed
            map.addLayer({
                id: "route-glow",
                type: "line",
                source: "route",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#818cf8", "line-width": 14, "line-blur": 10, "line-opacity": 0.4 },
            });
            map.addLayer({
                id: "route-line",
                type: "line",
                source: "route",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#6366f1", "line-width": 5, "line-opacity": 1 },
            });
            map.addLayer({
                id: "route-dashed",
                type: "line",
                source: "route",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [2, 3], "line-opacity": 0.9 },
            });

            // Add waypoint markers
            const sortedWps = [...(location.route_waypoints ?? [])].sort((a, b) => a.order - b.order);
            const wpPoints: { coords: [number, number]; label: string }[] = [];

            if (location.start_location?.coordinates) {
                wpPoints.push({ coords: location.start_location.coordinates, label: "start" });
            }
            sortedWps.forEach((wp, i) => {
                if (wp.location?.coordinates) {
                    wpPoints.push({ coords: wp.location.coordinates, label: `wp-${i}` });
                }
            });
            if (location.end_location?.coordinates) {
                wpPoints.push({ coords: location.end_location.coordinates, label: "end" });
            }

            wpPoints.forEach((pt, i) => {
                const el = createWaypointMarker(i, wpPoints.length);
                const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
                    .setLngLat(pt.coords)
                    .addTo(map);
                markersRef.current.push(marker);
            });

            // Add step markers (diamond shape, sorted by order)
            const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
            sortedSteps.forEach((step) => {
                if (step.waypoint_order !== null && step.waypoint_order !== undefined) {
                    const wp = sortedWps.find((w) => w.order === step.waypoint_order);
                    if (wp?.location?.coordinates) {
                        const el = createStepMarker(step.order);
                        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
                            .setHTML(`<div class="p-2"><p class="font-semibold text-sm">${step.title}</p><p class="text-xs text-gray-500">Step ${step.order}</p></div>`);

                        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
                            .setLngLat(wp.location.coordinates)
                            .setPopup(popup)
                            .addTo(map);
                        markersRef.current.push(marker);
                    }
                }
            });

            // Fetch and draw walking route
            if (coords.length >= 2) {
                const routeCoords = await fetchWalkingRoute(coords);
                const source = map.getSource("route") as mapboxgl.GeoJSONSource;
                if (source) {
                    source.setData({
                        type: "Feature",
                        properties: {},
                        geometry: { type: "LineString", coordinates: routeCoords ?? coords },
                    });
                }
            }

            // Fit bounds
            if (coords.length > 0) {
                const bounds = new mapboxgl.LngLatBounds();
                coords.forEach((c) => bounds.extend(c));
                map.fitBounds(bounds, {
                    padding: { top: 80, bottom: 40, left: 40, right: 40 },
                    pitch: 65,
                    bearing: -17.6,
                    duration: 1200,
                    maxZoom: 17,
                });
            }
        });

        mapRef.current = map;

        return () => {
            abortRef.current?.abort();
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="relative">
            <div
                ref={containerRef}
                className={`rounded-xl overflow-hidden shadow-lg ${className}`}
                style={{ height }}
                aria-label="Quest route map"
            />
            {/* Legend */}
            <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-neutral-200/60 flex items-center gap-3 text-[10px] font-medium text-neutral-600">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Start</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />End</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Waypoint</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-violet-500 rotate-45 scale-75" />Step</span>
            </div>
            <style>{`
                .mapboxgl-popup-content {
                    border-radius: 10px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                    padding: 0;
                }
                .mapboxgl-ctrl-group {
                    border-radius: 12px !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
                }
            `}</style>
        </div>
    );
});
