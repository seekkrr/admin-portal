import { api } from "@/services/api";
import type { CloudinaryUploadResponse } from "@/types";

export interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export interface UploadOptions {
    onProgress?: (progress: UploadProgress) => void;
    /** Backend media category or a human folder name (resolved via alias map). */
    category?: string;
    folder?: string;
    /** Owning entity id (marker/quest/narrative/user) — scopes the S3 key. */
    entity_id?: string;
    /** Singleton slot (e.g. "cover", "things-to-do", "avatar"): replacement overwrites. */
    slot?: string;
}

/** Longest edge, in px, we keep. Comfortably above any display size we render. */
const MAX_DIMENSION = 1440;
/** Files at or under this are sent untouched — re-encoding them only loses quality. */
const COMPRESS_THRESHOLD_BYTES = 350_000;
/** Hard client-side ceiling on the ORIGINAL file (pre-compression sanity guard). */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Backend media categories (mirror of v2 settings.MEDIA_FOLDERS). */
const VALID_CATEGORIES = new Set([
    "icons", "logo", "marker", "narrative", "onboarding", "profile", "quest", "region", "website",
]);
/** Human-facing folder names → canonical backend category. */
const CATEGORY_ALIASES: Record<string, string> = {
    markers: "marker", quests: "quest", narratives: "narrative", regions: "region",
    avatars: "profile", avatar: "profile", profiles: "profile", logos: "logo",
    "things-to-do": "marker",
};

/** Resolve a caller-supplied folder/category to a valid backend category, or throw. */
function resolveCategory(raw: string | undefined): string {
    const seg = (raw || "marker").split("/").pop()?.toLowerCase().trim() || "marker";
    if (VALID_CATEGORIES.has(seg)) return seg;
    if (CATEGORY_ALIASES[seg]) return CATEGORY_ALIASES[seg];
    const singular = seg.replace(/s$/, "");
    if (VALID_CATEGORIES.has(singular)) return singular;
    throw new Error(`Unsupported upload category: "${raw}"`);
}

/** Downscale + re-encode an oversized photo before upload. */
async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file;
    if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        const longestEdge = Math.max(bitmap.width, bitmap.height);
        const scale = Math.min(1, MAX_DIMENSION / longestEdge);

        if (scale === 1 && file.size <= COMPRESS_THRESHOLD_BYTES) {
            bitmap.close();
            return file;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            bitmap.close();
            return file;
        }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/webp", 0.78)
        );
        if (!blob || blob.size >= file.size) return file;

        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
            type: "image/webp",
            lastModified: Date.now(),
        });
    } catch {
        return file;
    }
}

/** SHA-256 hex string for S3 content deduplication. */
async function computeSha256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export const MEDIA_DELIVERY_BASE = "https://img.seekkrr.com";

export const mediaService = {
    /** Upload an image to S3 via the backend presigned-URL broker (Cloudflare CDN delivery). */
    async uploadImage(file: File, options: UploadOptions = {}): Promise<CloudinaryUploadResponse> {
        // ── Client-side safety guards (fail fast, clear message) ──
        if (file.type === "image/svg+xml") {
            throw new Error("SVG images aren't supported for upload.");
        }
        if (file.type && !file.type.startsWith("image/")) {
            throw new Error("Only image files can be uploaded.");
        }
        if (file.size > MAX_INPUT_BYTES) {
            throw new Error("Image is too large (max 25 MB).");
        }
        const category = resolveCategory(options.category || options.folder);

        const upload = await compressImage(file);
        const ext = (upload.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const contentType = upload.type || "image/jpeg";

        const presignPayload: Record<string, unknown> = {
            category,
            content_type: contentType,
            ext,
            entity_id: options.entity_id || null,
        };
        if (options.slot) {
            presignPayload.slot = options.slot;
        } else {
            presignPayload.sha256 = await computeSha256(upload);
        }

        const presignRes = await api.post("/api/v2/media/presign", presignPayload);
        const { key, url, fields, delivery_url, deduped } = presignRes.data;

        const result = (): CloudinaryUploadResponse => ({
            public_id: key,
            secure_url: delivery_url,
            url: delivery_url,
            resource_type: "image",
            format: ext,
            width: 0,
            height: 0,
            bytes: upload.size,
            created_at: new Date().toISOString(),
        });

        // Server already has this exact content — nothing to upload.
        if (deduped) {
            options.onProgress?.({ loaded: upload.size, total: upload.size, percentage: 100 });
            return result();
        }

        const formData = new FormData();
        if (fields) {
            Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
        }
        formData.append("file", upload);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable && options.onProgress) {
                    options.onProgress({
                        loaded: event.loaded,
                        total: event.total,
                        percentage: Math.round((event.loaded / event.total) * 100),
                    });
                }
            });
            xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve(result());
                else reject(new Error(`S3 upload failed with status ${xhr.status}`));
            });
            xhr.addEventListener("error", () => reject(new Error("Upload failed due to network error")));
            xhr.addEventListener("abort", () => reject(new Error("Upload was aborted")));
            xhr.open("POST", url);
            xhr.send(formData);
        });
    },

    /** Build a delivery URL for an S3 key (or return an already-absolute URL untouched). */
    getOptimizedUrl(publicIdOrUrl: string): string {
        if (!publicIdOrUrl) return "";
        if (publicIdOrUrl.startsWith("http://") || publicIdOrUrl.startsWith("https://")) {
            return publicIdOrUrl;
        }
        return `${MEDIA_DELIVERY_BASE}/${publicIdOrUrl.replace(/^\//, "")}`;
    },
};
