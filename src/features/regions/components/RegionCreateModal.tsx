import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, X, Loader2, Search, MapPin, Check, Building2 } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { GeoMap } from "@components/maps/GeoMap";
import { config } from "@/config/env";
import type { RegionType, Region, CreateRegionPayload, GeoPolygon } from "@/types";

interface RegionCreateModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: (id: string) => void;
}

/** A geocoded place from Mapbox forward geocoding (v6). */
interface GeoPlace {
    mapboxId: string;
    name: string;
    fullAddress: string;
    featureType: string;
    /** [lon, lat] */
    center: [number, number];
    /** [west, south, east, north] or null */
    bbox: [number, number, number, number] | null;
}

/** Mapbox feature types that map to a SeekKrr "city" region; everything else → hotspot. */
const CITY_FEATURE_TYPES = new Set(["country", "region", "postcode", "district", "place", "locality"]);

async function geocodePlaces(query: string): Promise<GeoPlace[]> {
    const token = config.mapbox.accessToken;
    const url =
        `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}` +
        `&limit=6&types=country,region,district,place,locality,neighborhood,address&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Mapbox geocoding failed");
    const data = await res.json();
    const features: unknown[] = Array.isArray(data?.features) ? data.features : [];
    return features.map((raw): GeoPlace => {
        const f = raw as {
            properties?: {
                mapbox_id?: string;
                name?: string;
                full_address?: string;
                feature_type?: string;
                bbox?: number[];
            };
            geometry?: { coordinates?: number[] };
        };
        const props = f.properties ?? {};
        const coords = f.geometry?.coordinates ?? [0, 0];
        const bbox = Array.isArray(props.bbox) && props.bbox.length === 4
            ? ([props.bbox[0], props.bbox[1], props.bbox[2], props.bbox[3]] as [number, number, number, number])
            : null;
        return {
            mapboxId: props.mapbox_id ?? "",
            name: props.name ?? "",
            fullAddress: props.full_address ?? props.name ?? "",
            featureType: props.feature_type ?? "",
            center: [coords[0] ?? 0, coords[1] ?? 0],
            bbox,
        };
    });
}

/** Build a GeoJSON Polygon from a place's bbox, or a small box around its center. */
function placeToPolygon(place: GeoPlace): GeoPolygon {
    const [lon, lat] = place.center;
    const [w, s, e, n] = place.bbox ?? [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02];
    return { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
}

export function RegionCreateModal({ open, onClose, onSuccess }: RegionCreateModalProps) {
    const queryClient = useQueryClient();

    const [cName, setCName] = useState("");
    const [cType, setCType] = useState<RegionType>("city");
    const [cDescription, setCDescription] = useState("");
    const [cWeight, setCWeight] = useState("1.0");
    const [cParentId, setCParentId] = useState("");

    // Geocoding state
    const [geoInput, setGeoInput] = useState("");
    const [geoQ, setGeoQ] = useState("");
    const [selectedPlace, setSelectedPlace] = useState<GeoPlace | null>(null);

    // Debounce the geocoding query
    useEffect(() => {
        const t = window.setTimeout(() => setGeoQ(geoInput.trim()), 350);
        return () => window.clearTimeout(t);
    }, [geoInput]);

    const geoSearch = useQuery<GeoPlace[]>({
        queryKey: ["region-geocode", geoQ],
        queryFn: () => geocodePlaces(geoQ),
        enabled: open && !selectedPlace && geoQ.length >= 3,
        staleTime: 5 * 60 * 1000,
    });

    const citiesQuery = useQuery<Region[]>({
        queryKey: ["admin-regions-cities"],
        queryFn: () => regionsService.listAll({ type: "city" }),
        enabled: open && cType === "hotspot",
        staleTime: 5 * 60 * 1000,
    });

    const resetCreate = () => {
        setCName("");
        setCType("city");
        setCDescription("");
        setCWeight("1.0");
        setCParentId("");
        setGeoInput("");
        setGeoQ("");
        setSelectedPlace(null);
        onClose();
    };

    const createMutation = useMutation({
        mutationFn: (payload: CreateRegionPayload) => regionsService.create(payload),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            toast.success("Region created");
            resetCreate();
            if (onSuccess) onSuccess(created.id);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create region"),
    });

    const pickPlace = (place: GeoPlace) => {
        setSelectedPlace(place);
        if (!cName.trim()) setCName(place.name);
        const detected: RegionType = CITY_FEATURE_TYPES.has(place.featureType) ? "city" : "hotspot";
        setCType(detected);
        if (detected === "city") setCParentId("");
    };

    const clearPlace = () => {
        setSelectedPlace(null);
        setGeoInput("");
        setGeoQ("");
    };

    const handleCreate = (e: FormEvent) => {
        e.preventDefault();
        const name = cName.trim();
        if (!name) {
            toast.error("Name is required");
            return;
        }
        if (!selectedPlace) {
            toast.error("Search and select a place to anchor the region");
            return;
        }
        if (cType === "hotspot" && !cParentId) {
            toast.error("A hotspot requires a parent city");
            return;
        }
        const weight = Number(cWeight);
        if (!Number.isFinite(weight) || weight <= 0) {
            toast.error("Admin weight must be greater than 0");
            return;
        }
        const payload: CreateRegionPayload = {
            name,
            type: cType,
            admin_weight: weight,
            bbox: placeToPolygon(selectedPlace),
            center_point: { type: "Point", coordinates: selectedPlace.center },
        };
        if (selectedPlace.mapboxId) payload.mapbox_place_id = selectedPlace.mapboxId;
        const description = cDescription.trim();
        if (description) payload.description = description;
        if (cType === "hotspot" && cParentId) payload.parent_id = cParentId;
        createMutation.mutate(payload);
    };

    if (!open) return null;

    const results = geoSearch.data ?? [];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-neutral-200">
                    <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-100 text-cyan-600">
                            <Globe className="w-4 h-4" />
                        </span>
                        New Region
                    </h3>
                    <button
                        onClick={resetCreate}
                        disabled={createMutation.isPending}
                        className="p-1.5 rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleCreate} className="p-5 space-y-4">
                    {/* ── Place search (provides bbox + center) ───────────────────── */}
                    {!selectedPlace ? (
                        <div>
                            <label htmlFor="region-geo" className="block text-sm font-medium text-neutral-700 mb-1">
                                Find a place <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-neutral-500 mb-2">
                                Search a city or hotspot. We use its real geographic boundary (bbox) and center.
                            </p>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    id="region-geo"
                                    type="text"
                                    autoFocus
                                    value={geoInput}
                                    onChange={(e) => setGeoInput(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    placeholder="e.g. Paris, Gateway of India, Indiranagar…"
                                />
                                {geoSearch.isFetching && (
                                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 animate-spin" />
                                )}
                            </div>
                            {geoSearch.isError && (
                                <p className="mt-2 text-xs text-red-500">Geocoding failed. Try again.</p>
                            )}
                            {geoQ.length >= 3 && !geoSearch.isFetching && results.length === 0 && (
                                <p className="mt-2 text-xs text-neutral-500">No places found for “{geoQ}”.</p>
                            )}
                            {results.length > 0 && (
                                <ul className="mt-2 border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
                                    {results.map((place) => {
                                        const isCity = CITY_FEATURE_TYPES.has(place.featureType);
                                        return (
                                            <li key={place.mapboxId || place.fullAddress}>
                                                <button
                                                    type="button"
                                                    onClick={() => pickPlace(place)}
                                                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-cyan-50/60 transition-colors"
                                                >
                                                    <span className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${isCity ? "bg-cyan-100 text-cyan-600" : "bg-amber-100 text-amber-600"}`}>
                                                        {isCity ? <Building2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-medium text-neutral-800 truncate">{place.name}</span>
                                                        <span className="block text-xs text-neutral-500 truncate">{place.fullAddress}</span>
                                                        <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                                                            {place.featureType}{place.bbox ? "" : " · point only"}
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 min-w-0">
                                    <Check className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-neutral-800 truncate">{selectedPlace.name}</p>
                                        <p className="text-xs text-neutral-500 truncate">{selectedPlace.fullAddress}</p>
                                        <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                                            {selectedPlace.center[1].toFixed(4)}, {selectedPlace.center[0].toFixed(4)}
                                            {selectedPlace.bbox ? " · bbox" : " · synthetic bbox"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearPlace}
                                    className="text-xs text-cyan-700 hover:underline shrink-0"
                                >
                                    Change
                                </button>
                            </div>
                            <div className="mt-3 rounded-lg overflow-hidden border border-neutral-200">
                                <GeoMap
                                    points={[{ coordinates: selectedPlace.center, color: "#0891b2", label: selectedPlace.name }]}
                                    polygon={placeToPolygon(selectedPlace)}
                                    center={selectedPlace.center}
                                    height="200px"
                                    hideCoordsReadout
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="region-name" className="block text-sm font-medium text-neutral-700 mb-1">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="region-name"
                            type="text"
                            required
                            value={cName}
                            onChange={(e) => setCName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            placeholder="e.g. Paris"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="region-type" className="block text-sm font-medium text-neutral-700 mb-1">
                                Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="region-type"
                                value={cType}
                                onChange={(e) => {
                                    setCType(e.target.value as RegionType);
                                    setCParentId("");
                                }}
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="city">City</option>
                                <option value="hotspot">Hotspot</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="region-weight" className="block text-sm font-medium text-neutral-700 mb-1">
                                Admin weight ({">"} 0)
                            </label>
                            <input
                                id="region-weight"
                                type="number"
                                min={0}
                                step="0.1"
                                value={cWeight}
                                onChange={(e) => setCWeight(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </div>

                    {cType === "hotspot" && (
                        <div>
                            <label htmlFor="region-parent" className="block text-sm font-medium text-neutral-700 mb-1">
                                Parent city <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="region-parent"
                                value={cParentId}
                                onChange={(e) => setCParentId(e.target.value)}
                                disabled={citiesQuery.isLoading}
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                            >
                                <option value="">
                                    {citiesQuery.isLoading ? "Loading cities…" : "— Select a city —"}
                                </option>
                                {(citiesQuery.data ?? []).map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label htmlFor="region-description" className="block text-sm font-medium text-neutral-700 mb-1">
                            Description
                        </label>
                        <textarea
                            id="region-description"
                            rows={2}
                            value={cDescription}
                            onChange={(e) => setCDescription(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                        <button
                            type="button"
                            onClick={resetCreate}
                            disabled={createMutation.isPending}
                            className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || !selectedPlace}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create Region
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
