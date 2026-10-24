import { useState } from "react";
import { Globe, Handshake, Map as MapIcon, MapPin, Megaphone } from "lucide-react";
import type { ExploreRegion } from "../types";

const plural = (n: number, one: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : `${one}s`}`;

/**
 * Approximates a card in the app's region picker: cover photo with the badge
 * on top, then name, tagline and counts. The banner shows on the map itself,
 * so it is previewed separately underneath.
 */
export function RegionPreviewCard({
    name,
    coverImage,
    tagline,
    badge,
    banner,
    counts,
}: {
    name: string;
    coverImage: string;
    tagline: string;
    badge: string;
    banner: string;
    counts: ExploreRegion["counts"];
}) {
    // Remember which URL failed so a new URL gets a fresh attempt.
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const showImage = !!coverImage && failedUrl !== coverImage;

    return (
        <div className="mx-auto w-full max-w-[300px] space-y-2">
            <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                <div className="relative aspect-[16/10] bg-brand-700">
                    {showImage ? (
                        <img
                            src={coverImage}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={() => setFailedUrl(coverImage)}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-1">
                            <Globe className="w-8 h-8" />
                            {coverImage && <span className="text-[11px]">Image failed to load</span>}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    {badge.trim() && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-highlight text-highlight-ink text-[11px] font-bold shadow-sm max-w-[85%] truncate">
                            {badge.trim()}
                        </span>
                    )}
                    <h4 className="absolute bottom-2 left-3 right-3 text-lg font-bold text-white leading-tight truncate drop-shadow">
                        {name}
                    </h4>
                </div>
                <div className="px-3 py-2.5 space-y-1.5">
                    <p className={`text-xs leading-snug line-clamp-2 ${tagline.trim() ? "text-ink" : "italic text-ink-faint"}`}>
                        {tagline.trim() || "No tagline"}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{plural(counts.places, "place")}</span>
                        <span className="inline-flex items-center gap-1"><MapIcon className="w-3 h-3" />{plural(counts.quests, "quest")}</span>
                        <span className="inline-flex items-center gap-1"><Handshake className="w-3 h-3" />{plural(counts.open_collabs, "collab")}</span>
                    </div>
                </div>
            </div>
            {banner.trim() && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-control bg-brand-900 text-white text-xs shadow-sm">
                    <Megaphone className="w-3.5 h-3.5 mt-px shrink-0" />
                    <span className="leading-snug break-words min-w-0">{banner.trim()}</span>
                </div>
            )}
        </div>
    );
}
