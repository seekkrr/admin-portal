import type { FogSpecification, LightsSpecification } from "mapbox-gl";

type Fog = FogSpecification;
type Lights = LightsSpecification[];

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";
export const TIME_ORDER: TimeOfDay[] = ["dawn", "day", "dusk", "night"];

export interface TodTheme {
    lightPreset: TimeOfDay;
    fog: Fog;
    /** Ambient + directional 3D lighting. The directional light casts shadows
     *  off the Standard style's 3D buildings; its angle tracks the sun for each
     *  time-of-day (low + long at dawn/dusk, high + crisp at midday). */
    lights: Lights;
    routeGlow: string;
    routeLine: string;
    markerRequired: string;   // CSS gradient
    markerOptional: string;
    pageBg: string;
}

// direction = [azimuth° clockwise-from-north, polar° from straight-up].
// Larger polar = lower sun = longer building shadows.
const dirLight = (color: string, intensity: number, direction: [number, number]): LightsSpecification => ({
    id: "sun", type: "directional",
    properties: { color, intensity, direction, "cast-shadows": true, "shadow-intensity": 0.85 },
});
const ambLight = (color: string, intensity: number): LightsSpecification => ({
    id: "sky", type: "ambient", properties: { color, intensity },
});

export const TOD_THEMES: Record<TimeOfDay, TodTheme> = {
    dawn: {
        lightPreset: "dawn",
        fog: { color: "rgba(255,200,150,0.25)", "high-color": "rgba(255,170,120,0.6)",
               "horizon-blend": 0.1, "space-color": "rgba(40,30,60,1)", "star-intensity": 0.0 },
        lights: [ambLight("#5a4a6a", 0.45), dirLight("#ffd9a8", 0.55, [105, 82])],
        routeGlow: "#fb923c", routeLine: "#fed7aa",
        markerRequired: "linear-gradient(145deg,#c2410c,#fb923c)",
        markerOptional: "linear-gradient(145deg,#9a3412,#c2410c)",
        pageBg: "#1a1410",
    },
    day: {
        lightPreset: "day",
        fog: { color: "rgba(220,235,255,0.2)", "high-color": "rgba(150,200,255,0.5)",
               "horizon-blend": 0.05, "space-color": "rgba(120,170,230,1)", "star-intensity": 0.0 },
        lights: [ambLight("#bcd2f0", 0.55), dirLight("#fffaf0", 0.7, [185, 30])],
        routeGlow: "#0ea5e9", routeLine: "#7dd3fc",
        markerRequired: "linear-gradient(145deg,#1d4ed8,#3b82f6)",
        markerOptional: "linear-gradient(145deg,#1e40af,#2563eb)",
        pageBg: "#0a1020",
    },
    dusk: {
        lightPreset: "dusk",
        fog: { color: "rgba(12,8,30,0.6)", "high-color": "rgba(120,60,180,0.9)",
               "horizon-blend": 0.08, "space-color": "rgba(8,4,20,1)", "star-intensity": 0.4 },
        lights: [ambLight("#3a2a5a", 0.4), dirLight("#e9b8ff", 0.5, [255, 84])],
        routeGlow: "#a855f7", routeLine: "#c084fc",
        markerRequired: "linear-gradient(145deg,#6d28d9,#8b5cf6)",
        markerOptional: "linear-gradient(145deg,#4c1d95,#6d28d9)",
        pageBg: "#080614",
    },
    night: {
        lightPreset: "night",
        fog: { color: "rgba(4,6,20,0.75)", "high-color": "rgba(40,40,120,0.8)",
               "horizon-blend": 0.06, "space-color": "rgba(2,2,10,1)", "star-intensity": 0.9 },
        lights: [ambLight("#2a2e50", 0.5), dirLight("#9fb0ff", 0.3, [20, 70])],
        routeGlow: "#6366f1", routeLine: "#a5b4fc",
        markerRequired: "linear-gradient(145deg,#4338ca,#6366f1)",
        markerOptional: "linear-gradient(145deg,#312e81,#4338ca)",
        pageBg: "#04050f",
    },
};

/** Approximate local time-of-day from a longitude using a fixed UTC clock.
 *  Longitude → hour offset (15°/hr). Pure + deterministic for preview. */
export function timeOfDayForLongitude(lng: number | null, utcDate = new Date()): TimeOfDay {
    const offsetHours = lng === null ? 0 : lng / 15;
    const localHour = (((utcDate.getUTCHours() + offsetHours) % 24) + 24) % 24;
    if (localHour >= 5 && localHour < 8) return "dawn";
    if (localHour >= 8 && localHour < 17) return "day";
    if (localHour >= 17 && localHour < 20) return "dusk";
    return "night";
}
