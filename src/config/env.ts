import { z } from "zod";

const envSchema = z.object({
    VITE_API_BASE_URL: z.string().url().default("https://api.seekkrr.com"),
    VITE_APP_NAME: z.string().default("SeekKrr Admin Portal"),
    VITE_MAPBOX_ACCESS_TOKEN: z.string().min(1, "Mapbox access token is required"),
    VITE_CLOUDINARY_CLOUD_NAME: z.string().min(1, "Cloudinary cloud name is required"),
    VITE_CLOUDINARY_UPLOAD_PRESET: z.string().default("seekkrr_admin"),
});

type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
    const result = envSchema.safeParse({
        VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
        VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
        VITE_MAPBOX_ACCESS_TOKEN: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
        VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
        VITE_CLOUDINARY_UPLOAD_PRESET: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
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
    cloudinary: {
        cloudName: env.VITE_CLOUDINARY_CLOUD_NAME,
        uploadPreset: env.VITE_CLOUDINARY_UPLOAD_PRESET,
        uploadUrl: `https://api.cloudinary.com/v1_1/${env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
    },
} as const;

export type Config = typeof config;
