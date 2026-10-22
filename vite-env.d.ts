/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_APP_NAME: string;
    readonly VITE_MAPBOX_ACCESS_TOKEN: string;
    readonly VITE_CLOUDINARY_CLOUD_NAME: string;
    readonly VITE_CLOUDINARY_UPLOAD_PRESET: string;
    readonly VITE_PARTNER_PORTAL_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
