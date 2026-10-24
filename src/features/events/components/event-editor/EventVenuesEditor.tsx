import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, MapPin, Star, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { Tag } from "@/components/ui/StatusPill";
import { PlaceSearchPicker } from "@/components/detail/PlaceSearchPicker";
import type { Marker } from "@/types";
import type { EventVenue } from "@/types/admin-detail";

/** Venues are SeekKrr places; one is the main venue (directions, "Open in Maps"). */
export function EventVenuesEditor({
    venues,
    mainId,
    onChange,
    onMainChange,
    disabled,
}: {
    venues: EventVenue[];
    mainId: string;
    onChange: (next: EventVenue[]) => void;
    onMainChange: (markerId: string) => void;
    disabled?: boolean;
}) {
    const effectiveMain = venues.some((v) => v.marker_id === mainId) ? mainId : (venues.find((v) => v.marker_id)?.marker_id ?? "");
    const move = (i: number, to: number) => {
        if (to < 0 || to >= venues.length) return;
        const next = [...venues];
        const [v] = next.splice(i, 1);
        if (!v) return;
        next.splice(to, 0, v);
        onChange(next);
    };
    const add = (m: Marker) => {
        const coords = m.location?.coordinates;
        onChange([
            ...venues,
            {
                marker_id: m.id,
                name: m.title,
                category: m.categories?.[0] ?? null,
                thumbnail_url: m.media?.[0] ?? null,
                coordinates: coords && coords.length === 2 ? [coords[0], coords[1]] : null,
            },
        ]);
    };

    return (
        <div className="space-y-4">
            {venues.length === 0 ? (
                <p className="text-sm text-ink-faint">No venues yet. Add stages, food courts, gates…</p>
            ) : (
                <ol className="divide-y divide-line rounded-control border border-line">
                    {venues.map((v, i) => {
                        const isMain = !!v.marker_id && v.marker_id === effectiveMain;
                        return (
                            <li key={`${v.marker_id}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                                {v.thumbnail_url ? (
                                    <img src={v.thumbnail_url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                                ) : (
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-500">
                                        <MapPin className="h-4 w-4" aria-hidden />
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {v.marker_id ? (
                                            <Link to={`/markers/${v.marker_id}`} className="truncate text-sm font-medium text-ink hover:text-accent-700 hover:underline">
                                                {v.name || v.marker_id}
                                            </Link>
                                        ) : (
                                            <span className="truncate text-sm font-medium text-ink">{v.name || "Unnamed venue"}</span>
                                        )}
                                        {isMain && <Tag tone="brand">Main venue</Tag>}
                                    </div>
                                    {v.category && <p className="truncate text-xs text-ink-muted">{v.category}</p>}
                                </div>
                                {!disabled && (
                                    <div className="flex shrink-0 gap-0.5">
                                        {v.marker_id && !isMain && <IconButton icon={Star} size="sm" label={`Make ${v.name ?? "this"} the main venue`} onClick={() => onMainChange(v.marker_id)} />}
                                        <IconButton icon={ArrowUp} size="sm" label={`Move ${v.name ?? "venue"} up`} disabled={i === 0} onClick={() => move(i, i - 1)} />
                                        <IconButton icon={ArrowDown} size="sm" label={`Move ${v.name ?? "venue"} down`} disabled={i === venues.length - 1} onClick={() => move(i, i + 1)} />
                                        <IconButton
                                            icon={Trash2}
                                            size="sm"
                                            label={`Remove ${v.name ?? "venue"}`}
                                            className="hover:bg-bad-soft hover:text-bad"
                                            onClick={() => onChange(venues.filter((_, j) => j !== i))}
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
            {!disabled && <PlaceSearchPicker onPick={add} excludeIds={venues.map((v) => v.marker_id).filter(Boolean)} placeholder="Add a venue: search places by name" />}
        </div>
    );
}
