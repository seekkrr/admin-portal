import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, MapPin, Check, Loader2 } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/FilterBar";
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
    marker: "place",
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
                    title: m.title || "Untitled place",
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
            <div className="flex items-start justify-between gap-3 rounded-control border border-accent-200 bg-accent-50 px-4 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-700" aria-hidden />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{value.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                            <span className="capitalize">{label}</span>
                            {value.location && (
                                <>
                                    <span aria-hidden>·</span>
                                    <span className="truncate">{value.location}</span>
                                </>
                            )}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-ink-faint">{value.id}</div>
                    </div>
                </div>
                {!disabled && <IconButton icon={X} size="sm" label={`Change ${label}`} onClick={() => onChange(null)} />}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <SearchInput value={search} onChange={setSearch} placeholder={placeholder} label={`Search ${label}s`} autoFocus />

            <div className="max-h-56 divide-y divide-line overflow-y-auto rounded-control border border-line" role="listbox" aria-label={`${label}s`} aria-busy={isFetching || undefined}>
                {results.length === 0 &&
                    (isFetching ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-ink-muted">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Searching…
                        </div>
                    ) : (
                        <div className="px-4 py-6 text-center text-xs text-ink-muted">
                            {debounced ? `No ${label}s match “${debounced}”.` : `No ${label}s found.`}
                        </div>
                    ))}
                {results.map((r) => (
                    <button
                        key={r.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => onChange(r)}
                        className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
                    >
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-ink">{r.title}</div>
                            {r.location && <div className="truncate text-xs text-ink-muted">{r.location}</div>}
                        </div>
                        <Check className="h-4 w-4 shrink-0 text-accent-600 opacity-0 group-hover:opacity-100 group-focus:opacity-100" aria-hidden />
                    </button>
                ))}
            </div>
        </div>
    );
}
