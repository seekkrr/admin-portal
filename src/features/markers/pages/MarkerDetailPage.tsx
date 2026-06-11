import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { markersService } from "../services/markers.service";
import {
    ArrowLeft,
    MapPin,
    Trash2,
    Save,
    Globe,
    ExternalLink,
    Phone,
    Clock,
    IndianRupee,
    Image as ImageIcon,
    Edit2,
} from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { GeoMap } from "@/components/maps/GeoMap";
import { toast } from "sonner";
import { LoadingFallback } from "@components/LoadingFallback";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/Card";
import type { UpdateMarkerPayload, MarkerStatus } from "@/types";

const STATUS_VALUES: MarkerStatus[] = ["approved", "pending", "hidden", "rejected"];

interface EditForm {
    title: string;
    category: string;
    description: string;
    address: string;
    tags: string;
    status: MarkerStatus;
    websiteUrl: string;
    contact: string;
    minExpense: string;
    maxExpense: string;
    regionId: string;
    media: string;
}

export function MarkerDetailPage() {
    const { markerId } = useParams<{ markerId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const CAN_MANAGE = user?.role?.some((r) => ["admin", "super_admin"].includes(r));

    const IS_SUPER = user?.role?.includes("super_admin");

    const [form, setForm] = useState<EditForm | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);

    const { data: marker, isLoading, error } = useQuery({
        queryKey: ["marker-detail", markerId],
        queryFn: () => markersService.getById(markerId!),
        enabled: !!markerId,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (marker) {
            setForm({
                title: marker.title,
                category: marker.category ?? "",
                description: marker.description ?? "",
                address: marker.address ?? "",
                tags: (marker.tags ?? []).join(", "),
                status: marker.status,
                websiteUrl: marker.website_url ?? "",
                contact: marker.contact ?? "",
                minExpense: marker.min_expense !== null ? String(marker.min_expense) : "",
                maxExpense: marker.max_expense !== null ? String(marker.max_expense) : "",
                regionId: marker.region_id ?? "",
                media: (marker.media ?? []).join(", "),
            });
        }
    }, [marker]);

    const updateMutation = useMutation({
        mutationFn: (payload: UpdateMarkerPayload) => markersService.update(markerId!, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["marker-detail", markerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            toast.success("Marker updated");
        },
        onError: () => {
            toast.error("Failed to update marker");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => markersService.remove(markerId!, IS_SUPER ? hardDelete : false),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            toast.success("Marker deleted");
            navigate("/markers", { replace: true });
        },
        onError: () => {
            toast.error("Failed to delete marker");
            setShowDelete(false);
        },
    });

    if (isLoading) return <LoadingFallback message="Loading marker..." />;

    if (error || !marker) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load marker or it does not exist.</p>
                <Link to="/markers" className="text-orange-600 hover:underline">
                    Back to Markers
                </Link>
            </div>
        );
    }

    const handleSave = () => {
        if (!form) return;
        if (!form.title.trim()) {
            toast.error("Title is required");
            return;
        }
        const payload: UpdateMarkerPayload = {};
        if (form.title.trim() !== marker.title) payload.title = form.title.trim();
        if (form.category.trim() !== (marker.category ?? "")) payload.category = form.category.trim();
        if (form.description.trim() !== (marker.description ?? "")) payload.description = form.description.trim();
        if (form.address.trim() !== (marker.address ?? "")) payload.address = form.address.trim();
        const nextTags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
        if (nextTags.join(",") !== (marker.tags ?? []).join(",")) payload.tags = nextTags;
        if (form.status !== marker.status) payload.status = form.status;

        if (form.websiteUrl.trim() !== (marker.website_url ?? ""))
            payload.website_url = form.websiteUrl.trim();
        if (form.contact.trim() !== (marker.contact ?? ""))
            payload.contact = form.contact.trim();
        if (form.regionId.trim() !== (marker.region_id ?? ""))
            payload.region_id = form.regionId.trim();

        const nextMedia = form.media.split(",").map((m) => m.trim()).filter(Boolean);
        if (nextMedia.join(",") !== (marker.media ?? []).join(","))
            payload.media = nextMedia;

        const currentMin = marker.min_expense !== null ? String(marker.min_expense) : "";
        if (form.minExpense.trim() !== currentMin) {
            if (form.minExpense.trim() === "") {
                payload.min_expense = undefined;
            } else {
                const n = Number(form.minExpense.trim());
                if (Number.isNaN(n)) {
                    toast.error("Min expense must be a number");
                    return;
                }
                payload.min_expense = n;
            }
        }
        const currentMax = marker.max_expense !== null ? String(marker.max_expense) : "";
        if (form.maxExpense.trim() !== currentMax) {
            if (form.maxExpense.trim() === "") {
                payload.max_expense = undefined;
            } else {
                const n = Number(form.maxExpense.trim());
                if (Number.isNaN(n)) {
                    toast.error("Max expense must be a number");
                    return;
                }
                payload.max_expense = n;
            }
        }

        if (Object.keys(payload).length === 0) {
            toast.info("No changes to save");
            return;
        }
        updateMutation.mutate(payload);
        setIsEditing(false);
    };

    const coords = marker.location?.coordinates ?? null;
    const lon = coords ? coords[0] : null;
    const lat = coords ? coords[1] : null;
    const googleMapsUrl =
        lat !== null && lon !== null
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
            : null;

    const mediaItems = (marker.media ?? []).filter(Boolean);
    const hasExpense = marker.min_expense !== null || marker.max_expense !== null;
    const expenseLabel = hasExpense
        ? `₹${marker.min_expense ?? "?"} – ₹${marker.max_expense ?? "?"}`
        : null;
    const fmtTime = (iso: string | null): string => {
        if (!iso) return "?";
        const d = new Date(iso);
        return Number.isNaN(d.getTime())
            ? iso
            : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    };
    const hasHours = !!marker.opens_at || !!marker.closes_at;
    const hoursLabel = hasHours ? `${fmtTime(marker.opens_at)} – ${fmtTime(marker.closes_at)}` : null;
    const propertyEntries = (marker as any).properties ? Object.entries((marker as any).properties) : [];

    const inputClass = "w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all";

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <Link
                    to="/markers"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                {CAN_MANAGE && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                        >
                            <Edit2 className="w-4 h-4" />
                            {isEditing ? "Cancel Edit" : "Edit Marker"}
                        </button>
                        <button
                            onClick={() => setShowDelete(true)}
                            disabled={deleteMutation.isPending}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            <Card padding="md">
                <div className="flex items-start gap-4">
                    <div className="bg-orange-100 text-orange-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">{marker.title}</h1>
                        <p className="text-neutral-500 mt-1 capitalize">
                            {marker.category || "Uncategorized"} · {marker.status} · {marker.usage_count} uses
                        </p>
                    </div>
                </div>
            </Card>

            {coords && (
                <Card padding="sm" className="overflow-hidden">
                    <GeoMap
                        points={[{ coordinates: coords, label: marker.title, color: "#ea580c" }]}
                        center={coords}
                        height="320px"
                        zoom={14}
                    />
                </Card>
            )}

            {mediaItems.length > 0 && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-orange-600" />
                            Media
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {mediaItems.map((url, i) => (
                                <a
                                    key={`${url}-${i}`}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 hover:ring-2 hover:ring-orange-500 transition"
                                >
                                    <img
                                        src={url}
                                        alt={`Marker media ${i + 1}`}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                </a>
                            ))}
                        </div>
                    </div>
                </Card>
            )}

            {!isEditing && (expenseLabel ||
                hoursLabel ||
                marker.website_url ||
                marker.contact ||
                googleMapsUrl) && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold">Information & Links</h3>
                    </div>
                    <div className="p-6 space-y-4 text-sm">
                        {expenseLabel && (
                            <div className="flex items-center gap-3 text-neutral-700">
                                <IndianRupee className="w-4 h-4 text-orange-600 shrink-0" />
                                <span className="font-medium text-neutral-500 w-28 shrink-0">Expense range</span>
                                <span className="text-neutral-800">{expenseLabel}</span>
                            </div>
                        )}
                        {hoursLabel && (
                            <div className="flex items-center gap-3 text-neutral-700">
                                <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                                <span className="font-medium text-neutral-500 w-28 shrink-0">Opening hours</span>
                                <span className="text-neutral-800">{hoursLabel}</span>
                            </div>
                        )}
                        {marker.website_url && (
                            <div className="flex items-center gap-3">
                                <Globe className="w-4 h-4 text-orange-600 shrink-0" />
                                <span className="font-medium text-neutral-500 w-28 shrink-0">Website</span>
                                <a
                                    href={marker.website_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-600 hover:underline break-all inline-flex items-center gap-1.5"
                                >
                                    {marker.website_url}
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                </a>
                            </div>
                        )}
                        {googleMapsUrl && (
                            <div className="flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                                <span className="font-medium text-neutral-500 w-28 shrink-0">Maps</span>
                                <a
                                    href={googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-600 hover:underline inline-flex items-center gap-1.5"
                                >
                                    View on Google Maps
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                </a>
                            </div>
                        )}
                        {marker.contact && (
                            <div className="flex items-center gap-3">
                                <Phone className="w-4 h-4 text-orange-600 shrink-0" />
                                <span className="font-medium text-neutral-500 w-28 shrink-0">Contact</span>
                                <a
                                    href={`tel:${marker.contact}`}
                                    className="text-orange-600 hover:underline break-all"
                                >
                                    {marker.contact}
                                </a>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {!isEditing && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold">Details</h3>
                    </div>
                    <div className="p-6 space-y-4 text-sm">
                        <DetailRow label="Address" value={marker.address} />
                        <DetailRow label="Description" value={marker.description} />
                        <DetailRow label="Tags" value={(marker.tags ?? []).join(", ") || null} />
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                            <span className="w-32 shrink-0 font-medium text-neutral-500">Region</span>
                            {marker.region_id ? (
                                <Link
                                    to={`/regions/${marker.region_id}`}
                                    className="text-orange-600 hover:underline inline-flex items-center gap-1.5 break-all"
                                >
                                    {marker.region_id}
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                </Link>
                            ) : (
                                <span className="text-neutral-800">—</span>
                            )}
                        </div>
                        <DetailRow label="Source" value={marker.source} />
                        <DetailRow label="Created by" value={marker.created_by} />
                        <DetailRow
                            label="Coordinates"
                            value={coords ? `${coords[0]}, ${coords[1]} (lon, lat)` : null}
                        />
                        <DetailRow
                            label="Created"
                            value={marker.created_at ? new Date(marker.created_at).toLocaleString() : null}
                        />
                        {propertyEntries.length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                                <span className="w-32 shrink-0 font-medium text-neutral-500">Properties</span>
                                <div className="flex flex-wrap gap-2">
                                    {propertyEntries.map(([k, v]) => (
                                        <span
                                            key={k}
                                            className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
                                        >
                                            <span className="font-medium text-neutral-500">{k}:</span>
                                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {CAN_MANAGE && isEditing && form && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold">Edit Marker</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Title</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Category</label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Status</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value as MarkerStatus })}
                                    className={`${inputClass} bg-white capitalize`}
                                >
                                    {STATUS_VALUES.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Tags (comma-separated)</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={form.tags}
                                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Address</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Website URL</label>
                                <input
                                    type="text"
                                    placeholder="https://..."
                                    className={inputClass}
                                    value={form.websiteUrl}
                                    onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Contact</label>
                                <input
                                    type="text"
                                    placeholder="Phone or email"
                                    className={inputClass}
                                    value={form.contact}
                                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Min expense (₹)</label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    className={inputClass}
                                    value={form.minExpense}
                                    onChange={(e) => setForm({ ...form, minExpense: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Max expense (₹)</label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    className={inputClass}
                                    value={form.maxExpense}
                                    onChange={(e) => setForm({ ...form, maxExpense: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Region ID</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={form.regionId}
                                onChange={(e) => setForm({ ...form, regionId: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Media image URLs (comma-separated)</label>
                            <input
                                type="text"
                                placeholder="https://img1.jpg, https://img2.jpg"
                                className={inputClass}
                                value={form.media}
                                onChange={(e) => setForm({ ...form, media: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
                            <textarea
                                rows={3}
                                className={`${inputClass} resize-none`}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                                className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                            >
                                {updateMutation.isPending ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            <ConfirmModal
                open={showDelete}
                title="Delete Marker"
                message={`Are you sure you want to delete "${marker.title}"? This action cannot be undone.`}
                confirmLabel={IS_SUPER && hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => { setShowDelete(false); setHardDelete(false); }}
                isPending={deleteMutation.isPending}
            >
                {IS_SUPER && (
                    <label className="flex items-center gap-2 mt-3 mb-1 px-1 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={hardDelete}
                            onChange={(e) => setHardDelete(e.target.checked)}
                            className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 accent-red-600"
                        />
                        <span className="text-xs text-red-600 font-medium">Permanently delete (cannot be recovered)</span>
                    </label>
                )}
            </ConfirmModal>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="w-32 shrink-0 font-medium text-neutral-500">{label}</span>
            <span className="text-neutral-800 whitespace-pre-wrap">{value || "—"}</span>
        </div>
    );
}
