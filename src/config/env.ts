import { z } from "zod";

const envSchema = z.object({
    VITE_API_BASE_URL: z.string().optional().default("https://api.seekkrr.com"),
    VITE_APP_NAME: z.string().optional().default("SeekKrr Admin Portal"),
    VITE_MAPBOX_ACCESS_TOKEN: z.string().optional().default(""),
    VITE_MEDIA_DELIVERY_BASE: z.string().optional().default("https://img.seekkrr.com"),
    VITE_CLOUDINARY_CLOUD_NAME: z.string().optional().default("seekkrr"),
    VITE_GOOGLE_CLIENT_ID: z.string().optional().default(""),
    // Partner Portal (creator-portal) the admin links into, e.g. to finish an experience.
    // Unset: follows the API (api.dev.seekkrr.com → creator.dev.seekkrr.com, else creator.seekkrr.com).
    VITE_PARTNER_PORTAL_URL: z.string().optional().default(""),
});

type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
    const result = envSchema.safeParse({
        VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
        VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
        VITE_MAPBOX_ACCESS_TOKEN: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
        VITE_MEDIA_DELIVERY_BASE: import.meta.env.VITE_MEDIA_DELIVERY_BASE,
        VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
        VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        VITE_PARTNER_PORTAL_URL: import.meta.env.VITE_PARTNER_PORTAL_URL,
    });

    if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        const errorMessage = Object.entries(errors)
            .map(([key, value]) => `${key}: ${value?.join(", ")}`)
            .join("\n");
        throw new Error(`Environment validation failed:\n${errorMessage}`);
    }

    return result.data;
}

export const env = validateEnv();

export const config = {
    api: {
        baseUrl: env.VITE_API_BASE_URL,
        timeout: 30000,
    },
    app: {
        name: env.VITE_APP_NAME,
    },
    mapbox: {
        accessToken: env.VITE_MAPBOX_ACCESS_TOKEN,
        style: "mapbox://styles/mapbox/standard",
        defaultCenter: { lng: 77.5946, lat: 12.9716 } as const, // Bangalore
        defaultZoom: 12,
    },
    media: {
        deliveryBase: env.VITE_MEDIA_DELIVERY_BASE,
    },
    cloudinary: {
        cloudName: env.VITE_CLOUDINARY_CLOUD_NAME,
    },
    googleClientId: env.VITE_GOOGLE_CLIENT_ID,
    partnerPortal: {
        // No trailing slash, so paths can be appended.
        baseUrl: (
            env.VITE_PARTNER_PORTAL_URL.trim() ||
            (env.VITE_API_BASE_URL.includes("api.dev.") ? "https://creator.dev.seekkrr.com" : "https://creator.seekkrr.com")
        ).replace(/\/+$/, ""),
    },
} as const;

export type Config = typeof config;
