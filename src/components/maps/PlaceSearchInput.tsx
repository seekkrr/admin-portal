import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, MapPin, Building2 } from "lucide-react";
import {
    suggestPlaces,
    retrievePlace,
    searchForward,
    newSessionToken,
    isAdminFeatureType,
    type ResolvedPlace,
} from "@/services/geocoding.service";

/**
 * "forward" — single-call search; results carry coordinates, so a pick resolves instantly (no
 *   retrieve step, no per-POI 404). Best for POI/landmark search (markers).
 * "suggest" — suggest + retrieve; surfaces administrative features (cities) better, used for
 *   region/city search.
 */
type SearchMode = "suggest" | "forward";

interface PlaceSearchInputProps {
    /** Search strategy (default "suggest"). */
    mode?: SearchMode;
    /** Comma-separated Mapbox feature types (see REGION_SEARCH_TYPES / MARKER_SEARCH_TYPES). */
    searchTypes: string;
    /** [lon, lat] proximity bias passed to the search. */
    proximity?: [number, number] | null;
    placeholder?: string;
    autoFocus?: boolean;
    /** Fires after a result is resolved to coordinates. */
    onSelect: (place: ResolvedPlace) => void;
    /** Optional error surfacing (e.g. toast). Inline message is shown regardless. */
    onError?: (message: string) => void;
}

/** A normalized dropdown row. `resolved` is set in forward mode; `mapboxId` drives retrieve in suggest mode. */
interface Option {
    key: string;
    name: string;
    secondary: string;
    featureType: string;
    resolved: ResolvedPlace | null;
    mapboxId: string | null;
}

/**
 * Reusable place finder backed by Mapbox SearchBox. Debounced search-as-you-type with a results
 * dropdown; on pick it yields a fully-resolved place (coordinates + bbox) via `onSelect`. Shared
 * by the Region (suggest) and Marker (forward) create modals.
 */
export function PlaceSearchInput({
    mode = "suggest",
    searchTypes,
    proximity = null,
    placeholder = "Search a place…",
    autoFocus = false,
    onSelect,
    onError,
}: PlaceSearchInputProps) {
    const [input, setInput] = useState("");
    const [q, setQ] = useState("");
    const [sessionToken, setSessionToken] = useState(() => newSessionToken());
    const [retrievingId, setRetrievingId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Debounce the query.
    useEffect(() => {
        const t = window.setTimeout(() => setQ(input.trim()), 350);
        return () => window.clearTimeout(t);
    }, [input]);

    const proximityKey = proximity ? `${proximity[0]},${proximity[1]}` : "";
    // sessionToken is part of the key so that after it rotates on a pick, a repeat search refetches
    // under the current token — keeping suggest+retrieve in the same Mapbox session.
    const optionsQuery = useQuery<Option[]>({
        queryKey: ["place-search", mode, q, searchTypes, proximityKey, sessionToken],
        queryFn: async () => {
            if (mode === "forward") {
                const places = await searchForward(q, { proximity, types: searchTypes });
                return places.map((p) => ({
                    key: p.mapboxId || p.fullAddress,
                    name: p.name,
                    secondary: p.fullAddress,
                    featureType: p.featureType,
                    resolved: p,
                    mapboxId: null,
                }));
            }
            const suggestions = await suggestPlaces(q, { sessionToken, proximity, types: searchTypes });
            return suggestions.map((s) => ({
                key: s.mapboxId || s.placeFormatted,
                name: s.name,
                secondary: s.placeFormatted,
                featureType: s.featureType,
                resolved: null,
                mapboxId: s.mapboxId,
            }));
        },
        enabled: q.length >= 3,
        staleTime: 5 * 60 * 1000,
    });

    const finishSelect = (place: ResolvedPlace) => {
        // Reset for the next search (close dropdown, fresh billing session) before notifying the
        // parent — `onSelect` may unmount this component (e.g. the region modal).
        setInput("");
        setQ("");
        setSessionToken(newSessionToken());
        onSelect(place);
    };

    const handlePick = async (option: Option) => {
        // Forward mode: already resolved, no network needed.
        if (option.resolved) {
            finishSelect(option.resolved);
            return;
        }
        if (!option.mapboxId) return;
        setRetrievingId(option.mapboxId);
        setErrorMsg(null);
        try {
            const resolved = await retrievePlace(option.mapboxId, sessionToken);
            if (!resolved) {
                const msg = "Could not resolve that place. Try another result.";
                setErrorMsg(msg);
                onError?.(msg);
                return;
            }
            finishSelect(resolved);
        } catch {
            const msg = "Place search failed. Try again.";
            setErrorMsg(msg);
            onError?.(msg);
        } finally {
            setRetrievingId(null);
        }
    };

    // Only show results while there is an active query (avoids a flash of stale rows after reset).
    const results = input.trim().length >= 3 ? (optionsQuery.data ?? []) : [];
    // A single source of truth for the message, shown inline and (for retrieve) via onError.
    const errorText = errorMsg ?? (optionsQuery.isError ? "Place search failed. Try again." : null);

    return (
        <div>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                    type="text"
                    autoFocus={autoFocus}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                    }}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder={placeholder}
                />
                {(optionsQuery.isFetching || retrievingId !== null) && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 animate-spin" />
                )}
            </div>

            {errorText && <p className="mt-2 text-xs text-red-500">{errorText}</p>}

            {!errorText && q.length >= 3 && !optionsQuery.isFetching && results.length === 0 && (
                <p className="mt-2 text-xs text-neutral-500">No places found for “{q}”.</p>
            )}

            {results.length > 0 && (
                <ul className="mt-2 border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
                    {results.map((option) => {
                        const isAdmin = isAdminFeatureType(option.featureType);
                        return (
                            <li key={option.key}>
                                <button
                                    type="button"
                                    onClick={() => handlePick(option)}
                                    disabled={retrievingId !== null}
                                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-cyan-50/60 transition-colors disabled:opacity-60"
                                >
                                    <span
                                        className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${
                                            isAdmin ? "bg-cyan-100 text-cyan-600" : "bg-amber-100 text-amber-600"
                                        }`}
                                    >
                                        {isAdmin ? (
                                            <Building2 className="w-3.5 h-3.5" />
                                        ) : (
                                            <MapPin className="w-3.5 h-3.5" />
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-neutral-800 truncate">
                                            {option.name}
                                        </span>
                                        <span className="block text-xs text-neutral-500 truncate">
                                            {option.secondary}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                                            {option.featureType}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
