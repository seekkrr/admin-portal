import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Globe,
    MapPin,
    ArrowLeft,
    Scale,
    Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { LoadingFallback } from "@components/LoadingFallback";
import { GeoMap, type GeoMapPoint } from "@components/maps/GeoMap";
import { useAuthStore } from "@store/auth.store";
import type { Region, UpdateRegionPayload, GeoPolygon } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

import { CrowdMeterSection } from "../components/CrowdMeterSection";
import { TravelTimeMatrix } from "../components/TravelTimeMatrix";
import { LinkedQuests } from "../components/LinkedQuests";
import { DangerZone } from "../components/DangerZone";

const EDIT_ROLES = ["admin", "super_admin"];

function regionCenter(region: Region): [number, number] | null {
    const cp = region.center_point;
    if (cp && !Array.isArray(cp) && cp.type === "Point") {
        return [cp.coordinates[0], cp.coordinates[1]];
    }
    if (Array.isArray(cp) && cp.length >= 2) {
        return [Number(cp[0]), Number(cp[1])];
    }
    return null;
}

function regionPolygon(region: Region): GeoPolygon | null {
    const bbox = region.bbox;
    if (bbox && !Array.isArray(bbox) && bbox.type === "Polygon") {
        return { type: "Polygon", coordinates: bbox.coordinates };
    }
    return null;
}

export function RegionDetailPage() {
    const { regionId: regionIdParam } = useParams<{ regionId: string }>();
    const regionId = regionIdParam ?? "";
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const CAN_EDIT = !!user?.role?.some((r) => EDIT_ROLES.includes(r));
    const CAN_APPROVE = CAN_EDIT;
    const IS_SUPER = !!user?.role?.includes("super_admin");

    const [form, setForm] = useState<UpdateRegionPayload | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [weightInput, setWeightInput] = useState("");
    const [confirmWeight, setConfirmWeight] = useState(false);

    const { data: region, isLoading, error } = useQuery<Region>({
        queryKey: ["region-detail", regionId],
        queryFn: () => regionsService.getById(regionId),
        enabled: !!regionId,
        staleTime: 60 * 1000,
    });

    const hotspotsQuery = useQuery<{ hotspots: Region[]; total: number }>({
        queryKey: ["region-hotspots", regionId],
        queryFn: () => regionsService.getHotspots(regionId),
        enabled: !!regionId && region?.type === "city",
    });

    const updateMutation = useMutation({
        mutationFn: (payload: UpdateRegionPayload) => regionsService.update(regionId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-detail", regionId] });
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            toast.success("Region updated");
            setForm(null);
            setIsEditing(false);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update region"),
    });



    if (isLoading) return <LoadingFallback message="Loading region..." />;

    if (error || !region) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load region or it does not exist.</p>
                <Link to="/regions" className="text-cyan-600 hover:underline">
                    Back to Regions
                </Link>
            </div>
        );
    }

    const center = regionCenter(region);
    const polygon = regionPolygon(region);
    const points: GeoMapPoint[] = center
        ? [{ coordinates: center, label: region.name, color: "#0891b2" }]
        : [];

    const editValues: UpdateRegionPayload = form ?? {
        name: region.name,
        description: region.description ?? "",
        is_active: region.is_active,
        mapbox_place_id: region.mapbox_place_id ?? "",
    };


    return (
        <div className="animate-fade-in max-w-5xl mx-auto space-y-4">
            {/* Header & Back */}
            <div className="flex items-center justify-between">
                <Link
                    to="/regions"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                {CAN_EDIT && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                        >
                            <Edit2 className="w-4 h-4" />
                            {isEditing ? "Cancel Edit" : "Edit Region"}
                        </button>
                    </div>
                )}
            </div>

            <Card padding="md">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-100 text-cyan-600 rounded-xl w-10 h-10 flex items-center justify-center flex-shrink-0">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900">
                                {region.name}
                            </h1>
                            <div className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
                                <span className="capitalize px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-medium text-xs">
                                    {region.type}
                                </span>
                                <span className="font-mono text-xs">{region.slug}</span>
                                <span className="text-xs">{region.marker_count} markers</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Map */}
            {(points.length > 0 || polygon) && (
                <Card padding="none" className="overflow-hidden">
                    <GeoMap
                        points={points}
                        polygon={polygon}
                        center={center}
                        height="360px"
                        zoom={10}
                    />
                </Card>
            )}

            {/* Details (Read Only) */}
            {!isEditing && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold">Details</h3>
                    </div>
                    <div className="p-6 space-y-4 text-sm">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                            <span className="w-40 shrink-0 font-medium text-neutral-500">Name</span>
                            <span className="text-neutral-800">{region.name}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                            <span className="w-40 shrink-0 font-medium text-neutral-500">Mapbox Place ID</span>
                            <span className="text-neutral-800 font-mono">{region.mapbox_place_id || "—"}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                            <span className="w-40 shrink-0 font-medium text-neutral-500">Description</span>
                            <span className="text-neutral-800 whitespace-pre-wrap">{region.description || "—"}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                            <span className="w-40 shrink-0 font-medium text-neutral-500">Status</span>
                            <span className="text-neutral-800">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${region.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-neutral-50 text-neutral-600 border-neutral-200"}`}>
                                    {region.is_active ? "Active" : "Inactive"}
                                </span>
                            </span>
                        </div>
                    </div>
                </Card>
            )}

            {/* Edit Region */}
            {CAN_EDIT && isEditing && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold">Edit Region</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editValues.name ?? ""}
                                    onChange={(e) => setForm({ ...editValues, name: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Mapbox Place ID</label>
                                <input
                                    type="text"
                                    value={editValues.mapbox_place_id ?? ""}
                                    onChange={(e) => setForm({ ...editValues, mapbox_place_id: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm font-mono focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
                            <textarea
                                rows={3}
                                value={editValues.description ?? ""}
                                onChange={(e) => setForm({ ...editValues, description: e.target.value })}
                                className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                            />
                        </div>
                        <div>
                            <label className="flex items-center justify-between w-full max-w-sm cursor-pointer p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors">
                                <span className="text-sm font-medium text-neutral-700">Region Active</span>
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={editValues.is_active ?? false}
                                        onChange={(e) => setForm({ ...editValues, is_active: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                </div>
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => { setForm(null); setIsEditing(false); }}
                                className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => updateMutation.mutate(editValues)}
                                disabled={updateMutation.isPending || !form}
                                className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            <CrowdMeterSection regionId={regionId} canApprove={CAN_APPROVE} />

            {/* Admin Ranking Weight */}
            {CAN_APPROVE && (
                <Card padding="md">
                    <CardHeader className="border-b border-neutral-100 pb-4 mb-4">
                        <div className="flex items-center gap-2">
                            <Scale className="w-5 h-5 text-cyan-600" />
                            <CardTitle>Admin Ranking Weight</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm text-neutral-600 mb-1">
                                Current weight: <span className="font-semibold text-neutral-900">{region.admin_weight}</span>
                            </p>
                            <p className="text-xs font-medium text-amber-600 mb-4">Affects discovery ranking</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">New weight ({">"} 0)</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    value={weightInput}
                                    onChange={(e) => setWeightInput(e.target.value)}
                                    className="w-36 rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const w = Number(weightInput);
                                    if (!Number.isFinite(w) || w <= 0) {
                                        toast.error("Weight must be greater than 0");
                                        return;
                                    }
                                    setConfirmWeight(true);
                                }}
                                disabled={weightInput === ""}
                                className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
                            >
                                Apply Weight
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <TravelTimeMatrix regionId={regionId} canApprove={CAN_APPROVE} />
            
            <LinkedQuests regionId={regionId} questIds={region.quest_ids} canEdit={CAN_EDIT} />

            {/* Hotspots (cities only) */}
            {region.type === "city" && (
                <Card padding="md">
                    <CardHeader className="border-b border-neutral-100 pb-4 mb-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-cyan-600" />
                            <CardTitle>Hotspots</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {hotspotsQuery.isLoading ? (
                            <p className="text-sm text-neutral-500">Loading hotspots...</p>
                        ) : (hotspotsQuery.data?.hotspots.length ?? 0) === 0 ? (
                            <p className="text-sm text-neutral-500">No hotspots in this city yet.</p>
                        ) : (
                            <ul className="divide-y divide-neutral-100">
                                {hotspotsQuery.data?.hotspots.map((h) => (
                                    <li key={h.id} className="py-3 flex items-center justify-between">
                                        <Link to={`/regions/${h.id}`} className="text-sm font-medium text-cyan-700 hover:text-cyan-900">
                                            {h.name}
                                        </Link>
                                        <span className="text-xs text-neutral-500">{h.marker_count} markers</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            )}

            <DangerZone regionId={regionId} regionName={region.name} canEdit={CAN_EDIT} isSuper={IS_SUPER} />

            {/* Confirm weight modal */}
            <ConfirmModal
                open={confirmWeight}
                title="Apply Ranking Weight"
                message={
                    <>
                        Set admin weight to <strong>{weightInput}</strong>? This <strong>affects discovery ranking</strong>.
                    </>
                }
                confirmLabel="Apply"
                confirmStyle="bg-cyan-600 hover:bg-cyan-700"
                onConfirm={async () => {
                    const weightMutation = regionsService.setAdminWeight(regionId, Number(weightInput));
                    try {
                        await weightMutation;
                        queryClient.invalidateQueries({ queryKey: ["region-detail", regionId] });
                        queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
                        toast.success("Admin weight updated");
                        setWeightInput("");
                        setConfirmWeight(false);
                    } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed to update admin weight");
                        setConfirmWeight(false);
                    }
                }}
                onCancel={() => setConfirmWeight(false)}
            />
        </div>
    );
}
