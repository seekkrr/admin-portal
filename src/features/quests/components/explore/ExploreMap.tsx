import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { RefreshCw, AlertTriangle, Trophy, Flag } from "lucide-react";
import { config } from "@/config/env";
import { useQuestExperience } from "../../hooks/useQuestExperience";
import { ExperiencePanel } from "./ExperiencePanel";
import { ExploreLegend } from "./ExploreLegend";
import { NarrativeDrawer } from "./NarrativeDrawer";
import { MapHud } from "./MapHud";
import { useGuidedTour } from "./useGuidedTour";
import { TOD_THEMES, TIME_ORDER, timeOfDayForLongitude, type TimeOfDay } from "./theme";
import type { FeatureCollection } from "geojson";
import type { V2QuestDetail, ExperienceMarker, ExperienceNarrative, GeoPolygon } from "@/types";

// Up-close, immersive 3D camera (slight bearing gives the cinematic "game" angle).
const FOCUS_ZOOM = 17;
const PITCH = 55;
const BEARING = -17;

// Marker fills are FIXED (not time-of-day) so they stay high-contrast on any basemap.
const FILL_START = "linear-gradient(145deg,#059669,#10b981)";   // emerald — start
const FILL_REQUIRED = "linear-gradient(145deg,#7c3aed,#a855f7)"; // violet — required
const FILL_OPTIONAL = "linear-gradient(145deg,#4f46e5,#818cf8)"; // indigo — optional

// "Marching ants" dash sequence for an animated, directional route line.
const DASH_SEQUENCE: number[][] = [
    [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
    [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

const STYLE_ID = "seekkrr-explore-pulse";
function injectPulseCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
        @keyframes sk-pulse {
            0%,100% { box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 8px 2px rgba(168,85,247,0.55), 0 0 0 0 rgba(168,85,247,0.45); }
            50%     { box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 16px 4px rgba(168,85,247,0.9), 0 0 0 8px rgba(168,85,247,0); }
        }
        .sk-marker { cursor: pointer; transition: transform 0.15s ease; }
        .sk-marker:hover { transform: scale(1.16) !important; z-index: 4; }
        .sk-marker-active { transform: scale(1.3) !important; z-index: 6; }
        .sk-pin-circle { animation: sk-pulse 2.4s ease-in-out infinite; }
        .sk-marker-active .sk-pin-circle { animation: none;
            box-shadow: 0 0 0 4px rgba(255,255,255,0.75), 0 4px 14px rgba(0,0,0,0.6), 0 0 24px 7px rgba(168,85,247,0.95); }
        .sk-popup .mapboxgl-popup-content { padding:0; background:transparent; box-shadow:none; }
        .sk-popup .mapboxgl-popup-close-button { display:none; }
        .sk-popup .mapboxgl-popup-tip { border-width: 9px; }
        .sk-popup.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip { border-top-color: rgba(17,17,21,0.96); }
        .sk-popup.mapboxgl-popup-anchor-top .mapboxgl-popup-tip { border-bottom-color: rgba(17,17,21,0.96); }
        .sk-popup.mapboxgl-popup-anchor-left .mapboxgl-popup-tip { border-right-color: rgba(17,17,21,0.96); }
        .sk-popup.mapboxgl-popup-anchor-right .mapboxgl-popup-tip { border-left-color: rgba(17,17,21,0.96); }
    `;
    document.head.appendChild(s);
}

/** Haversine total length of an ordered coordinate list, in km. */
function routeDistanceKm(coords: [number, number][]): number {
    const R = 6371;
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1];
        const b = coords[i];
        if (!a || !b) continue;
        const [lng1, lat1] = a;
        const [lng2, lat2] = b;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        total += R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
    return total;
}

type PlacedMarker = ExperienceMarker & { coordinates: NonNullable<ExperienceMarker["coordinates"]> };

/** A closed ring approximating a circle of `radiusM` metres around a point. */
function ringCircle(lng: number, lat: number, radiusM: number, n = 56): [number, number][] {
    const dLat = radiusM / 111320;
    const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
    const ring: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * 2 * Math.PI;
        ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
    }
    return ring;
}

/** Fog-of-war: a dark polygon over the whole quest area with "windows" punched
 *  out around every discovered marker. */
function fogFeature(markers: PlacedMarker[], discovered: Set<string>, startId: string | null) {
    if (markers.length === 0) return null;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const m of markers) {
        minLng = Math.min(minLng, m.coordinates.lng); maxLng = Math.max(maxLng, m.coordinates.lng);
        minLat = Math.min(minLat, m.coordinates.lat); maxLat = Math.max(maxLat, m.coordinates.lat);
    }
    const pad = 0.04;
    const outer: [number, number][] = [
        [minLng - pad, minLat - pad], [maxLng + pad, minLat - pad],
        [maxLng + pad, maxLat + pad], [minLng - pad, maxLat + pad], [minLng - pad, minLat - pad],
    ];
    const holes = markers
        .filter((m) => discovered.has(m.marker_id) || m.marker_id === startId)
        .map((m) => ringCircle(m.coordinates.lng, m.coordinates.lat, 120));
    return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [outer, ...holes] } };
}

interface ExploreMapProps {
    questId: string;
    detail: V2QuestDetail;
    focusMarkerId?: string | null;
}

export function ExploreMap({ questId, detail, focusMarkerId }: ExploreMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markerEls = useRef<Map<string, HTMLDivElement>>(new Map());
    const markerObjs = useRef<mapboxgl.Marker[]>([]);
    const dashRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [activeMarker, setActiveMarker] = useState<ExperienceMarker | null>(null);
    const [discovered, setDiscovered] = useState<Set<string>>(new Set());
    const [completedTasks, setCompletedTasks] = useState<Map<string, number>>(new Map());
    const [showComplete, setShowComplete] = useState(false);
    const hasFitRef = useRef(false);

    const experience = useQuestExperience(questId, detail, true);

    const sortedMarkers = useMemo(
        () => [...experience.markers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        [experience.markers]
    );
    const placed = useMemo(
        () => sortedMarkers.filter((m): m is ExperienceMarker & { coordinates: NonNullable<ExperienceMarker["coordinates"]> } =>
            m.coordinates !== null
        ),
        [sortedMarkers]
    );
    const startMarkerId = experience.startPoint?.marker_id ?? null;

    // Map each marker to its attached narrative (for the left ExperiencePanel),
    // and keep quest/region narratives separately for the briefing drawer.
    const narrativeByMarker = useMemo(() => {
        const m = new Map<string, ExperienceNarrative>();
        for (const n of experience.narratives) {
            if (n.attach_type === "marker" && n.attach_id) m.set(n.attach_id, n);
        }
        return m;
    }, [experience.narratives]);
    const briefingNarratives = useMemo(
        () => experience.narratives.filter((n) => n.attach_type !== "marker"),
        [experience.narratives]
    );

    const regionLng = experience.startPoint?.lng ?? config.mapbox.defaultCenter.lng;
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | null>(null);
    const effectiveTod: TimeOfDay = timeOfDay ?? timeOfDayForLongitude(regionLng);
    const theme = TOD_THEMES[effectiveTod];

    const distanceKm = useMemo(() => {
        const coords = placed.map((m): [number, number] => [m.coordinates.lng, m.coordinates.lat]);
        return coords.length >= 2 ? routeDistanceKm(coords) : null;
    }, [placed]);

    const focusMarker = useCallback((marker: ExperienceMarker) => {
        setActiveMarker(marker);
        setDiscovered((prev) => (prev.has(marker.marker_id) ? prev : new Set(prev).add(marker.marker_id)));
        if (marker.coordinates && mapRef.current) {
            mapRef.current.flyTo({
                center: [marker.coordinates.lng, marker.coordinates.lat],
                zoom: FOCUS_ZOOM, pitch: PITCH, bearing: BEARING, duration: 1400, essential: true,
                // Frame the pin in the open map area between the left panel and the
                // right legend (panel ≈380px, legend ≈250px).
                padding: { left: 380, right: 250, top: 10, bottom: 90 },
            });
        }
    }, []);

    // Honor an externally requested marker (from the Manage playlist "Map" button)
    useEffect(() => {
        if (!focusMarkerId || !mapReady) return;
        const m = placed.find((x) => x.marker_id === focusMarkerId);
        if (m) focusMarker(m);
    }, [focusMarkerId, mapReady, placed, focusMarker]);

    const tour = useGuidedTour(placed, (m) => focusMarker(m));

    const onTaskComplete = useCallback((taskId: string, points: number) => {
        setCompletedTasks((prev) => (prev.has(taskId) ? prev : new Map(prev).set(taskId, points)));
    }, []);
    const score = useMemo(() => Array.from(completedTasks.values()).reduce((a, b) => a + b, 0), [completedTasks]);
    const discoveredCount = useMemo(
        () => placed.filter((m) => discovered.has(m.marker_id) || m.marker_id === startMarkerId).length,
        [placed, discovered, startMarkerId]
    );

    // Auto-play: advance to the next stop only after the narration finishes (+1s).
    const handleNarrationEnded = useCallback(() => {
        if (!tour.isPlaying) return;
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => tour.next(), 1000);
    }, [tour.isPlaying, tour.next]);

    // Init map
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;
        injectPulseCSS();
        mapboxgl.accessToken = config.mapbox.accessToken;
        const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: config.mapbox.style,
            center: [config.mapbox.defaultCenter.lng, config.mapbox.defaultCenter.lat],
            zoom: 15, pitch: PITCH, bearing: BEARING, antialias: true,
        });
        mapRef.current = map;
        map.on("load", () => {
            try {
                map.setConfigProperty("basemap", "lightPreset", TOD_THEMES.dusk.lightPreset);
                map.setConfigProperty("basemap", "show3dObjects", true);
                // Declutter: hide the basemap's own POI/transit pins so the quest pins dominate.
                map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
                map.setConfigProperty("basemap", "showTransitLabels", false);
            } catch { /* non-standard style */ }
            map.setFog(TOD_THEMES.dusk.fog);
            try {
                map.addSource("mapbox-dem", {
                    type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14,
                });
                map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
            } catch { /* terrain unavailable */ }
            setMapReady(true);
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-left");
        const els = markerEls.current;
        const objs = markerObjs.current;
        return () => {
            if (dashRef.current) { clearInterval(dashRef.current); dashRef.current = null; }
            if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
            objs.forEach((m) => m.remove());
            markerObjs.current = [];
            els.clear();
            map.remove();
            mapRef.current = null;
            setMapReady(false);
            hasFitRef.current = false;
        };
    }, []);

    // Time-of-day: only lighting + fog change (markers/route keep fixed high-contrast colors).
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        try { map.setConfigProperty("basemap", "lightPreset", theme.lightPreset); } catch { /* ignore */ }
        map.setFog(theme.fog);
    }, [theme, mapReady]);

    // Markers + route
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;

        markerObjs.current.forEach((m) => m.remove());
        markerObjs.current = [];
        markerEls.current.clear();
        if (placed.length === 0) return;

        placed.forEach((m, i) => {
            const isStart = m.marker_id === startMarkerId;
            const fill = isStart ? FILL_START : m.is_required ? FILL_REQUIRED : FILL_OPTIONAL;
            const tipColor = isStart ? "#10b981" : m.is_required ? "#a855f7" : "#818cf8";
            // Outer element is positioned by Mapbox (transform: translate). The inner
            // wrapper carries the scale/active transforms so Mapbox's positioning is
            // never clobbered. anchor:"bottom" lands the pin's tip on the coordinate.
            const el = document.createElement("div");
            el.style.cssText = "cursor:pointer;";
            const wrap = document.createElement("div");
            wrap.className = "sk-marker";
            wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;";
            const circle = document.createElement("div");
            circle.className = "sk-pin-circle";
            circle.style.cssText = `
                width:36px;height:36px;border-radius:50%;background:${fill};
                border:3px solid #ffffff;
                display:flex;align-items:center;justify-content:center;
                color:#fff;font-weight:800;font-size:14px;font-family:system-ui,sans-serif;line-height:1;user-select:none;`;
            circle.textContent = String(m.order ?? i + 1);
            const tip = document.createElement("div");
            tip.style.cssText = `width:0;height:0;margin-top:-2px;
                border-left:6px solid transparent;border-right:6px solid transparent;
                border-top:10px solid ${tipColor};filter:drop-shadow(0 2px 1px rgba(0,0,0,0.45));`;
            wrap.appendChild(circle);
            wrap.appendChild(tip);
            el.appendChild(wrap);
            el.addEventListener("click", () => focusMarker(m));
            markerEls.current.set(m.marker_id, wrap);
            const pin = new mapboxgl.Marker({ element: el, anchor: "bottom" })
                .setLngLat([m.coordinates.lng, m.coordinates.lat]).addTo(map);
            markerObjs.current.push(pin);
        });

        // Open up-close on the START marker (zoom 17 / pitch 50) — "feel the place".
        if (!hasFitRef.current && placed.length > 0) {
            const start = placed.find((m) => m.marker_id === startMarkerId) ?? placed[0];
            if (start) {
                map.easeTo({
                    center: [start.coordinates.lng, start.coordinates.lat],
                    zoom: FOCUS_ZOOM, pitch: PITCH, bearing: BEARING, duration: 1600,
                });
            }
            hasFitRef.current = true;
        }

        const routeCoords = placed.map((m): [number, number] => [m.coordinates.lng, m.coordinates.lat]);
        if (routeCoords.length >= 2) {
            const routeGeo = { type: "Feature" as const, properties: {},
                geometry: { type: "LineString" as const, coordinates: routeCoords } };
            const src = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
            if (src) { src.setData(routeGeo); }
            else {
                map.addSource("route", { type: "geojson", data: routeGeo });
                // Glow (atmosphere) + dark casing (contrast on LIGHT basemaps) + bright
                // animated core (contrast on DARK basemaps) → visible at all four times.
                map.addLayer({ id: "route-glow", type: "line", source: "route", slot: "top",
                    layout: { "line-cap": "round", "line-join": "round" },
                    paint: { "line-color": "#a855f7", "line-width": 14, "line-opacity": 0.45, "line-blur": 7 } });
                map.addLayer({ id: "route-casing", type: "line", source: "route", slot: "top",
                    layout: { "line-cap": "round", "line-join": "round" },
                    paint: { "line-color": "#0b0716", "line-width": 7, "line-opacity": 0.6 } });
                map.addLayer({ id: "route-line", type: "line", source: "route", slot: "top",
                    layout: { "line-cap": "round", "line-join": "round" },
                    paint: { "line-color": "#ede9fe", "line-width": 3.2, "line-opacity": 0.98, "line-dasharray": [0, 4, 3] } });
                // Animate the dashes so the route "flows" toward the next stop.
                if (!dashRef.current) {
                    let step = 0;
                    dashRef.current = setInterval(() => {
                        step = (step + 1) % DASH_SEQUENCE.length;
                        const mm = mapRef.current;
                        if (mm && mm.getLayer("route-line")) {
                            mm.setPaintProperty("route-line", "line-dasharray", DASH_SEQUENCE[step]);
                        }
                    }, 80);
                }
            }
        }
    }, [mapReady, placed, startMarkerId, focusMarker]);

    // Active marker highlight
    useEffect(() => {
        markerEls.current.forEach((el, id) => {
            el.classList.toggle("sk-marker-active", id === activeMarker?.marker_id);
        });
    }, [activeMarker]);

    // Fog of war: dark overlay with windows around discovered markers.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        const feat = fogFeature(placed, discovered, startMarkerId);
        if (!feat) return;
        const src = map.getSource("fog") as mapboxgl.GeoJSONSource | undefined;
        if (src) { src.setData(feat); return; }
        map.addSource("fog", { type: "geojson", data: feat });
        map.addLayer({ id: "fog-layer", type: "fill", source: "fog", slot: "middle",
            paint: { "fill-color": "#06040f", "fill-opacity": 0.6 } });
    }, [mapReady, placed, discovered, startMarkerId]);

    // Reveal: undiscovered markers are dimmed and masked with "?".
    useEffect(() => {
        markerEls.current.forEach((wrap, id) => {
            const circle = wrap.querySelector(".sk-pin-circle") as HTMLDivElement | null;
            const m = placed.find((x) => x.marker_id === id);
            const isDisc = discovered.has(id) || id === startMarkerId;
            if (circle) circle.textContent = isDisc ? String(m?.order ?? "") : "?";
            wrap.style.opacity = isDisc ? "1" : "0.55";
            wrap.style.filter = isDisc ? "none" : "grayscale(0.7) brightness(0.85)";
        });
    }, [discovered, placed, startMarkerId, activeMarker]);

    // Auto-play fallback: markers with no narration advance after a readable dwell.
    useEffect(() => {
        if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
        if (!tour.isPlaying || !activeMarker) return;
        const narr = narrativeByMarker.get(activeMarker.marker_id);
        if (!narr?.audio_url) {
            advanceTimerRef.current = setTimeout(() => tour.next(), 5000);
        }
    }, [activeMarker, tour.isPlaying, tour.next, narrativeByMarker]);

    // Quest complete when every stop has been discovered.
    useEffect(() => {
        if (placed.length > 0 && discoveredCount >= placed.length && !showComplete) {
            setShowComplete(true);
            tour.stop();
        }
    }, [discoveredCount, placed.length, showComplete, tour.stop]);

    // Region boundary
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady || !experience.region) return;
        const bbox = experience.region.bbox;
        if (!bbox || Array.isArray(bbox)) return;
        const boundary = bbox as GeoPolygon;
        if (boundary.type !== "Polygon") return;
        const data = { type: "Feature" as const, properties: {}, geometry: boundary };
        const src = map.getSource("region-boundary") as mapboxgl.GeoJSONSource | undefined;
        if (src) { src.setData(data); return; }
        map.addSource("region-boundary", { type: "geojson", data });
        map.addLayer({ id: "region-fill", type: "fill", source: "region-boundary", slot: "bottom",
            paint: { "fill-color": "#7c3aed", "fill-opacity": 0.05 } });
        map.addLayer({ id: "region-outline", type: "line", source: "region-boundary", slot: "middle",
            paint: { "line-color": "#a78bfa", "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.5 } });
    }, [mapReady, experience.region]);

    // Narrative trigger halos
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        const points = experience.narratives
            .filter((n): n is typeof n & { trigger_location: NonNullable<typeof n["trigger_location"]> } =>
                n.trigger_location !== null
            )
            .map((n) => ({ type: "Feature" as const, properties: { radius: n.trigger_radius_m ?? 50 },
                geometry: { type: "Point" as const, coordinates: n.trigger_location.coordinates } }));
        const fc: FeatureCollection = { type: "FeatureCollection", features: points };
        const src = map.getSource("narrative-triggers") as mapboxgl.GeoJSONSource | undefined;
        if (src) { src.setData(fc); return; }
        if (points.length === 0) return;
        map.addSource("narrative-triggers", { type: "geojson", data: fc });
        map.addLayer({ id: "narrative-halo", type: "circle", source: "narrative-triggers", slot: "middle",
            paint: { "circle-radius": 30, "circle-color": "#f59e0b", "circle-opacity": 0.14, "circle-blur": 1 } });
        map.addLayer({ id: "narrative-core", type: "circle", source: "narrative-triggers", slot: "middle",
            paint: { "circle-radius": 8, "circle-color": "#fbbf24", "circle-opacity": 0.55,
                     "circle-stroke-color": "#f59e0b", "circle-stroke-width": 1.5 } });
    }, [mapReady, experience.narratives]);

    const cycleTime = useCallback(() => {
        const cur = effectiveTod;
        const idx = TIME_ORDER.indexOf(cur);
        const next = TIME_ORDER[(idx + 1) % TIME_ORDER.length];
        if (next) setTimeOfDay(next);
    }, [effectiveTod]);

    const hasNoCoords = !experience.isLoading && experience.markers.length > 0 && placed.length === 0;

    return (
        <div className="relative rounded-2xl overflow-hidden border border-violet-900/30"
             style={{ height: 620, background: theme.pageBg }}>
            <div ref={mapContainer} className="w-full h-full" />

            {experience.isLoading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2
                                bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-violet-200 border border-violet-800/40">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" /> Loading experience…
                </div>
            )}
            {experience.error && !experience.isLoading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2
                                bg-amber-950/80 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-amber-300 border border-amber-700/40">
                    <AlertTriangle className="w-3.5 h-3.5" /> Couldn't load experience
                </div>
            )}
            {hasNoCoords && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 text-xs text-neutral-400
                                bg-black/70 rounded-xl px-3 py-2 border border-neutral-700/30">
                    Markers have no coordinates yet
                </div>
            )}

            {!experience.isLoading && (
                <>
                    {!activeMarker && <NarrativeDrawer narratives={briefingNarratives} />}
                    <ExploreLegend
                        markers={sortedMarkers}
                        activeMarkerId={activeMarker?.marker_id ?? null}
                        startMarkerId={startMarkerId}
                        onSelect={(m) => { tour.stop(); focusMarker(m); }}
                    />
                    <MapHud
                        title={detail.title ?? "Quest"}
                        markerCount={placed.length}
                        distanceKm={distanceKm}
                        timeOfDay={effectiveTod}
                        onCycleTime={cycleTime}
                        isPlaying={tour.isPlaying}
                        canTour={placed.length > 0}
                        onPlay={tour.start}
                        onStop={tour.stop}
                        onNext={tour.next}
                        onPrev={tour.prev}
                    />
                </>
            )}

            {activeMarker && (
                <ExperiencePanel
                    marker={activeMarker}
                    narrative={narrativeByMarker.get(activeMarker.marker_id) ?? null}
                    onClose={() => { tour.stop(); setActiveMarker(null); }}
                    onTaskComplete={onTaskComplete}
                    onAudioEnded={handleNarrationEnded}
                />
            )}

            {/* Quest Complete celebration */}
            {showComplete && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                     onClick={() => setShowComplete(false)}>
                    <div className="text-center px-8 py-7 rounded-3xl bg-gradient-to-br from-violet-900/90 to-fuchsia-900/90
                                    border border-violet-400/40 shadow-2xl max-w-sm">
                        <Trophy className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                        <h3 className="text-2xl font-bold text-white">Quest Complete!</h3>
                        <p className="text-violet-200/90 mt-1 text-sm">{detail.title}</p>
                        <div className="flex items-center justify-center gap-6 mt-4">
                            <div><div className="text-2xl font-bold text-amber-300">{score}</div><div className="text-[10px] uppercase tracking-wider text-violet-200/70">Points</div></div>
                            <div><div className="text-2xl font-bold text-emerald-300">{placed.length}</div><div className="text-[10px] uppercase tracking-wider text-violet-200/70">Stops</div></div>
                            <div><div className="text-2xl font-bold text-violet-200">{completedTasks.size}</div><div className="text-[10px] uppercase tracking-wider text-violet-200/70">Tasks</div></div>
                        </div>
                        <p className="text-[11px] text-violet-300/60 mt-5">Click anywhere to close</p>
                    </div>
                </div>
            )}
        </div>
    );
}
