import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, MapPin, Check, Loader2 } from "lucide-react";
import { markersService } from "@/features/markers/services/markers.service";
import { regionsService } from "@/features/regions/services/regions.service";
import { questsService } from "@/features/quests/services/quests.service";
import type { NarrativeAttachType } from "@/types";

const SEARCH_DEBOUNCE_MS = 350;

// A normalized attach target the picker emits to its parent.
export interface AttachTarget {
    id: string;
    title: string;
    // Short human-readable location / context line for the confirmation card.
    location: string | null;
}

interface AttachTargetPickerProps {
    attachType: NarrativeAttachType;
    value: AttachTarget | null;
    onChange: (target: AttachTarget | null) => void;
    disabled?: boolean;
}

const TYPE_LABEL: Record<NarrativeAttachType, string> = {
    marker: "marker",
    quest: "quest",
    region: "region",
};

function formatCoords(coords: [number, number] | null | undefined): string | null {
    if (!coords) return null;
    const [lon, lat] = coords;
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

export function AttachTargetPicker({
    attachType,
    value,
    onChange,
    disabled,
}: AttachTargetPickerProps) {
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [search]);

    // Reset the open search whenever the type changes (results no longer apply).
    useEffect(() => {
        setSearch("");
        setDebounced("");
    }, [attachType]);

    const { data: results = [], isFetching } = useQuery({
        queryKey: ["narrative-attach-search", attachType, debounced],
        // Only search once the dropdown is "active" (no confirmed value).
        enabled: !value && !disabled,
        staleTime: 30 * 1000,
        queryFn: async (): Promise<AttachTarget[]> => {
            if (attachType === "marker") {
                const res = await markersService.list({
                    search: debounced || undefined,
                    page: 1,
                    page_size: 15,
                });
                return res.markers.map((m) => ({
                    id: m.id,
                    title: m.title || "Untitled marker",
                    location: m.address || formatCoords(m.location?.coordinates) || null,
                }));
            }
            if (attachType === "quest") {
                const res = await questsService.listQuests({
                    q: debounced || undefined,
                    page: 1,
                    per_page: 15,
                });
                return res.quests.map((q) => ({
                    id: q.id,
                    title: q.title || "Untitled quest",
                    location: q.region_name || null,
                }));
            }
            // region
            const res = debounced
                ? await regionsService.search(debounced, 1, 15)
                : await regionsService.list({ page: 1, page_size: 15 });
            return res.regions.map((r) => ({
                id: r.id,
                title: r.name || "Untitled region",
                location: r.type || null,
            }));
        },
    });

    const label = TYPE_LABEL[attachType];

    const placeholder = useMemo(
        () => `Search ${label}s by name…`,
        [label],
    );

    if (value) {
        // Confirmation card — title + location, with a "change" affordance.
        return (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">
                            {value.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                            <span className="capitalize">{label}</span>
                            {value.location && (
                                <>
                                    <span className="text-neutral-300">•</span>
                                    <span className="truncate">{value.location}</span>
                                </>
                            )}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-neutral-400">{value.id}</div>
                    </div>
                </div>
                {!disabled && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="flex-shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-orange-100 hover:text-orange-700"
                        title={`Change ${label}`}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                    type="text"
                    autoFocus
                    disabled={disabled}
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 py-2.5 pl-10 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                />
                {isFetching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />
                )}
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                {results.length === 0 && !isFetching && (
                    <div className="px-4 py-6 text-center text-xs text-neutral-400">
                        {debounced ? `No ${label}s match “${debounced}”.` : `No ${label}s found.`}
                    </div>
                )}
                {results.map((r) => (
                    <button
                        key={r.id}
                        type="button"
                        onClick={() => onChange(r)}
                        className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-orange-50/70"
                    >
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-neutral-800">
                                {r.title}
                            </div>
                            {r.location && (
                                <div className="truncate text-xs text-neutral-500">{r.location}</div>
                            )}
                        </div>
                        <Check className="h-4 w-4 flex-shrink-0 text-orange-500 opacity-0 group-hover:opacity-100" />
                    </button>
                ))}
            </div>
        </div>
    );
}
