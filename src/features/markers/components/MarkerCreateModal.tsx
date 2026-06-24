import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markersService } from "../services/markers.service";
import { GeoMap } from "@/components/maps/GeoMap";
import { MapPin, X, Upload, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { config } from "@/config/env";
import type { CreateMarkerPayload } from "@/types";

interface CreateForm {
    title: string;
    category: string;
    description: string;
    address: string;
    tags: string;
    coordinates: [number, number] | null;
    websiteUrl: string;
    contact: string;
    mapUrl: string;
    minExpense: string;
    maxExpense: string;
    regionId: string;
    media: string[];
    thingsToDoText: string;
    thingsToDoImageUrl: string;
}

const EMPTY_FORM: CreateForm = {
    title: "",
    category: "",
    description: "",
    address: "",
    tags: "",
    coordinates: null,
    websiteUrl: "",
    contact: "",
    mapUrl: "",
    minExpense: "",
    maxExpense: "",
    regionId: "",
    media: [],
    thingsToDoText: "",
    thingsToDoImageUrl: "",
};

interface MarkerCreateModalProps {
    open: boolean;
    onClose: () => void;
}

export function MarkerCreateModal({ open, onClose }: MarkerCreateModalProps) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const mediaFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingTtd, setUploadingTtd] = useState(false);
    const ttdFileInputRef = useRef<HTMLInputElement>(null);

    // ── Media upload (unsigned Cloudinary, mirrors CreateNarrativeModal) ──
    const handleMediaUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingMedia(true);
        try {
            const results = await Promise.allSettled(
                Array.from(files).map(async (file) => {
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("upload_preset", config.cloudinary.uploadPreset);
                    const res = await fetch(config.cloudinary.uploadUrl, { method: "POST", body: fd });
                    if (!res.ok) throw new Error(`Upload failed: ${file.name}`);
                    const json = (await res.json()) as { secure_url: string };
                    return json.secure_url;
                }),
            );
            const urls = results
                .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
                .map((r) => r.value);
            const failures = results.filter((r) => r.status === "rejected");

            if (urls.length > 0) {
                setForm((f) => ({ ...f, media: [...f.media, ...urls] }));
                toast.success(`${urls.length} file(s) uploaded successfully`);
            }
            if (failures.length > 0) {
                toast.error(`${failures.length} file(s) failed to upload`);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingMedia(false);
            if (mediaFileInputRef.current) mediaFileInputRef.current.value = "";
        }
    };

    const removeMedia = (url: string) =>
        setForm((f) => ({ ...f, media: f.media.filter((m) => m !== url) }));

    const handleTtdImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingTtd(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("upload_preset", config.cloudinary.uploadPreset);
            const res = await fetch(config.cloudinary.uploadUrl, { method: "POST", body: fd });
            if (!res.ok) throw new Error("Upload failed");
            const json = (await res.json()) as { secure_url: string };
            setForm((f) => ({ ...f, thingsToDoImageUrl: json.secure_url }));
            toast.success("Image uploaded");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingTtd(false);
            if (ttdFileInputRef.current) ttdFileInputRef.current.value = "";
        }
    };

    const createMutation = useMutation({
        mutationFn: (payload: CreateMarkerPayload) => markersService.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            toast.success("Marker created");
            onClose();
            setForm(EMPTY_FORM);
        },
        onError: () => {
            toast.error("Failed to create marker");
        },
    });

    const handleCreate = () => {
        if (!form.title.trim()) {
            toast.error("Title is required");
            return;
        }
        if (!form.coordinates) {
            toast.error("Pick a location on the map");
            return;
        }
        const tagList = form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        const mediaList = form.media.map((m) => m.trim()).filter(Boolean);

        let minExpense: number | undefined;
        if (form.minExpense.trim()) {
            minExpense = Number(form.minExpense.trim());
            if (Number.isNaN(minExpense)) {
                toast.error("Min expense must be a number");
                return;
            }
        }
        let maxExpense: number | undefined;
        if (form.maxExpense.trim()) {
            maxExpense = Number(form.maxExpense.trim());
            if (Number.isNaN(maxExpense)) {
                toast.error("Max expense must be a number");
                return;
            }
        }
        if (
            minExpense !== undefined &&
            maxExpense !== undefined &&
            minExpense > maxExpense
        ) {
            toast.error("Min expense cannot exceed max expense");
            return;
        }

        const payload: CreateMarkerPayload = {
            title: form.title.trim(),
            location: { type: "Point", coordinates: form.coordinates },
            category: form.category.trim() || undefined,
            description: form.description.trim() || undefined,
            address: form.address.trim() || undefined,
            tags: tagList.length ? tagList : undefined,
            website_url: form.websiteUrl.trim() || undefined,
            contact: form.contact.trim() || undefined,
            map_url: form.mapUrl.trim() || undefined,
            region_id: form.regionId.trim() || undefined,
            media: mediaList.length ? mediaList : undefined,
            things_to_do_text: form.thingsToDoText.trim() || undefined,
            things_to_do_image_url: form.thingsToDoImageUrl.trim() || undefined,
            min_expense: minExpense,
            max_expense: maxExpense,
        };
        createMutation.mutate(payload);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full mx-4 animate-slide-up max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-neutral-200 sticky top-0 bg-white z-10">
                    <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-orange-600" />
                        New Marker
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Title *</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Tags (comma-separated)</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={form.tags}
                                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Address</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Website URL</label>
                            <input
                                type="text"
                                placeholder="https://..."
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={form.websiteUrl}
                                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Contact</label>
                            <input
                                type="text"
                                placeholder="Phone or email"
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={form.contact}
                                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Map URL</label>
                        <input
                            type="text"
                            placeholder="https://maps..."
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            value={form.mapUrl}
                            onChange={(e) => setForm({ ...form, mapUrl: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Min expense (₹)</label>
                            <input
                                type="number"
                                inputMode="numeric"
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={form.minExpense}
                                onChange={(e) => setForm({ ...form, minExpense: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Max expense (₹)</label>
                            <input
                                type="number"
                                inputMode="numeric"
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                value={form.maxExpense}
                                onChange={(e) => setForm({ ...form, maxExpense: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Region <span className="text-neutral-400 font-normal">(ID)</span></label>
                        <input
                            type="text"
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            value={form.regionId}
                            onChange={(e) => setForm({ ...form, regionId: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Media images</label>
                        <div className="flex flex-wrap gap-3">
                            {form.media.map((url) => (
                                <div
                                    key={url}
                                    className="group relative h-20 w-20 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
                                >
                                    <img src={url} alt="Marker media" className="h-full w-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeMedia(url)}
                                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                                        title="Remove"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                            <label
                                className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600 ${
                                    uploadingMedia ? "pointer-events-none opacity-60" : ""
                                }`}
                            >
                                {uploadingMedia ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Upload className="h-5 w-5" />
                                        <span className="text-[10px] font-medium">Upload</span>
                                    </>
                                )}
                                <input
                                    ref={mediaFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handleMediaUpload}
                                    disabled={uploadingMedia}
                                />
                            </label>
                        </div>
                    </div>
                    <div className="rounded-xl border border-neutral-200 p-4 space-y-4">
                        <h4 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                            <ListChecks className="w-4 h-4 text-orange-600" />
                            Things to Do
                        </h4>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Things to do (text)</label>
                            <textarea
                                rows={3}
                                placeholder="Suggested activities at this place..."
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                                value={form.thingsToDoText}
                                onChange={(e) => setForm({ ...form, thingsToDoText: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Things to do image</label>
                            <div className="flex flex-wrap gap-3">
                                {form.thingsToDoImageUrl ? (
                                    <div className="group relative h-24 w-24 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                                        <img
                                            src={form.thingsToDoImageUrl}
                                            alt="Things to do"
                                            className="h-full w-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, thingsToDoImageUrl: "" })}
                                            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600 ${
                                            uploadingTtd ? "pointer-events-none opacity-60" : ""
                                        }`}
                                    >
                                        {uploadingTtd ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Upload className="h-5 w-5" />
                                                <span className="text-[10px] font-medium">Upload</span>
                                            </>
                                        )}
                                        <input
                                            ref={ttdFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleTtdImageUpload}
                                            disabled={uploadingTtd}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
                        <textarea
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Location *</label>
                        <GeoMap
                            height="280px"
                            onPick={(coords) => setForm((f) => ({ ...f, coordinates: coords }))}
                            points={
                                form.coordinates
                                    ? [{ coordinates: form.coordinates, color: "#ea580c" }]
                                    : []
                            }
                            center={form.coordinates}
                        />
                        <p className="mt-2 text-xs text-neutral-500">
                            {form.coordinates
                                ? `Selected: ${form.coordinates[0]}, ${form.coordinates[1]} (lon, lat)`
                                : "Click the map to choose coordinates."}
                        </p>
                    </div>
                </div>
                <div className="p-6 border-t border-neutral-200 flex justify-end gap-3 sticky bottom-0 bg-white z-10">
                    <button
                        onClick={onClose}
                        disabled={createMutation.isPending}
                        className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={createMutation.isPending}
                        className="px-4 py-2.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {createMutation.isPending && (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        Create Marker
                    </button>
                </div>
            </div>
        </div>
    );
}
