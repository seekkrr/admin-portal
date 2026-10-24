import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, ExternalLink, Footprints, MapPin, Move, Navigation } from "lucide-react";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Field";
import { GeoMap } from "@/components/maps/GeoMap";
import { PlaceSearchInput } from "@/components/maps/PlaceSearchInput";
import { Notice } from "@/components/detail/DetailStates";
import { MARKER_SEARCH_TYPES, INDIA_PROXIMITY, type ResolvedPlace } from "@/services/geocoding.service";
import { placeDetailApi } from "@/services/admin-detail.service";
import { formatDateTime } from "@/utils/date";
import type { Marker } from "@/types";
import type { MarkerExtras, MovedMarker } from "@/types/admin-detail";

function metres(m: number | null | undefined): string | null {
    if (m === null || m === undefined) return null;
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function minutes(s: number | null | undefined): string | null {
    if (s === null || s === undefined) return null;
    const total = Math.round(s / 60);
    if (total < 1) return "<1 min";
    if (total < 60) return `${total} min`;
    return total % 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${Math.floor(total / 60)} h`;
}
/** Rough distance in metres between two [lon, lat] points. */
function distance(a: [number, number], b: [number, number]): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** Move the pin (search, click or drag), then save; the server works out the region again. */
export function MarkerLocationTab({ marker, canEdit, onSaved }: { marker: Marker & MarkerExtras; canEdit: boolean; onSaved: () => void }) {
    const current = (marker.location?.coordinates ?? null) as [number, number] | null;
    const [pin, setPin] = useState<[number, number] | null>(current);
    const [newAddress, setNewAddress] = useState<string | null>(null);
    const [useAddress, setUseAddress] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [moved, setMoved] = useState<{ from: string | null; to: MovedMarker } | null>(null);
    // The map is built once per saved position; the pin moves on top of it.
    const lon = current?.[0];
    const lat = current?.[1];
    const center = useMemo<[number, number] | null>(() => (lon !== undefined && lat !== undefined ? [lon, lat] : null), [lon, lat]);

    const changed = !!pin && (!current || pin[0] !== current[0] || pin[1] !== current[1]);
    const far = changed && current && pin ? distance(current, pin) : 0;

    const save = useMutation({
        mutationFn: () => {
            if (!pin) throw new Error("Pick a spot first");
            return placeDetailApi.move(marker.id, pin[1], pin[0], useAddress && newAddress ? newAddress : undefined);
        },
        onSuccess: (res) => {
            setConfirming(false);
            setMoved({ from: marker.region_name ?? marker.region_id ?? null, to: res });
            setNewAddress(null);
            const regionChanged = (res.region_id ?? null) !== (marker.region_id ?? null);
            toast.success(regionChanged ? `Pin moved · now in ${res.region_name ?? "a different region"}` : "Pin moved");
            onSaved();
        },
        onError: (e: Error) => {
            setConfirming(false);
            toast.error(e.message);
        },
    });

    const pick = (place: ResolvedPlace) => {
        setPin(place.center);
        setNewAddress(place.fullAddress || place.name);
    };
    const googleUrl = current ? `https://www.google.com/maps/search/?api=1&query=${current[1]},${current[0]}` : null;
    const cd = marker.center_distance;

    return (
        <div className="space-y-5">
            {moved && (
                <Notice tone="good" title="Pin moved">
                    Region: {moved.from ?? "none"} → {moved.to.region_name ?? moved.to.region_id ?? "none"}. Map data for both regions is being refreshed.
                </Notice>
            )}
            <Panel
                title="Location"
                icon={MapPin}
                description={canEdit ? "Search, click the map or drag the pin. Nothing changes until you save." : undefined}
                actions={
                    googleUrl ? (
                        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline">
                            Google Maps <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                    ) : undefined
                }
            >
                <div className="space-y-4">
                    {canEdit && (
                        <PlaceSearchInput
                            mode="forward"
                            searchTypes={MARKER_SEARCH_TYPES}
                            proximity={current ?? INDIA_PROXIMITY}
                            placeholder="Search an address or place to move the pin"
                            onSelect={pick}
                            onError={(msg) => toast.error(msg)}
                        />
                    )}
                    <GeoMap
                        height="360px"
                        center={center}
                        zoom={15}
                        points={canEdit ? [] : current ? [{ coordinates: current, label: marker.title, color: "#00a49e" }] : []}
                        draggable={canEdit}
                        pinColor="#00a49e"
                        markerPosition={canEdit ? pin : null}
                        onPick={canEdit ? (c) => setPin(c) : undefined}
                        onMarkerDragEnd={canEdit ? (c) => setPin(c) : undefined}
                    />
                    <DetailList>
                        <DetailRow label="Saved position" value={current ? `${current[1]}, ${current[0]} (lat, lon)` : "Not set"} />
                        {changed && pin && (
                            <DetailRow
                                label="New position"
                                value={
                                    <span>
                                        {pin[1]}, {pin[0]} <span className="text-ink-faint">· {metres(far)} away</span>
                                    </span>
                                }
                            />
                        )}
                        <DetailRow
                            label="Region"
                            value={
                                marker.region_id ? (
                                    <Link to={`/regions/${marker.region_id}`} className="text-accent-700 hover:underline">
                                        {marker.region_name ?? marker.region_id}
                                    </Link>
                                ) : (
                                    "None"
                                )
                            }
                        />
                        <DetailRow label="Address" value={marker.address || "—"} />
                    </DetailList>
                    {changed && canEdit && (
                        <div className="space-y-3 rounded-control border border-accent-200 bg-accent-50/60 p-3">
                            {newAddress && (
                                <Checkbox checked={useAddress} onChange={setUseAddress} label="Also update the address" hint={newAddress} />
                            )}
                            {far > 5000 && <Notice tone="warn">That's more than 5 km from where it was. Check it's the same place.</Notice>}
                            <div className="flex flex-wrap gap-2">
                                <Button variant="primary" icon={Move} onClick={() => setConfirming(true)}>
                                    Save new location
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setPin(current);
                                        setNewAddress(null);
                                    }}
                                >
                                    Put it back
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Panel>

            {cd && (
                <Panel title="Distance to the region centre" icon={Navigation}>
                    <DetailList>
                        <DetailRow
                            label={
                                <span className="inline-flex items-center gap-1.5">
                                    <Footprints className="h-3.5 w-3.5" aria-hidden /> Walking
                                </span>
                            }
                            value={[metres(cd.walk_distance_m), minutes(cd.walk_duration_s)].filter(Boolean).join(" · ") || "—"}
                        />
                        <DetailRow
                            label={
                                <span className="inline-flex items-center gap-1.5">
                                    <Car className="h-3.5 w-3.5" aria-hidden /> Driving
                                </span>
                            }
                            value={[metres(cd.drive_distance_m), minutes(cd.drive_duration_s)].filter(Boolean).join(" · ") || "—"}
                        />
                        {cd.computed_at && <DetailRow label="Worked out" value={formatDateTime(cd.computed_at)} />}
                    </DetailList>
                </Panel>
            )}

            <ConfirmDialog
                open={confirming}
                title="Move this place?"
                description={`The pin moves ${metres(far) ?? ""}. If it lands in another region, the place moves to that region and both regions' map data is refreshed.`}
                confirmLabel="Move place"
                isPending={save.isPending}
                onConfirm={() => save.mutate()}
                onCancel={() => setConfirming(false)}
            />
        </div>
    );
}
