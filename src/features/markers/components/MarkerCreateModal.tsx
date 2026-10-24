import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { markersService } from "../services/markers.service";
import { GeoMap } from "@/components/maps/GeoMap";
import { PlaceSearchInput } from "@/components/maps/PlaceSearchInput";
import { MARKER_SEARCH_TYPES, INDIA_PROXIMITY, type ResolvedPlace } from "@/services/geocoding.service";
import { MapPin, X, Upload, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { mediaService } from "@/services/media.service";
import { RegionPicker } from "@/features/regions/components/RegionPicker";
import { type CreateMarkerPayload } from "@/types";
import { categoryService } from "@/services/category.service";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, TextArea, TextInput } from "@/components/ui/Field";
import { cx } from "@/utils/cx";

interface CreateForm {
    title: string;
    categories: string[];
    subCategories: string[];
    description: string;
    address: string;
    tags: string;
    coordinates: [number, number] | null;
    websiteUrl: string;
    contact: string;
    mapUrl: string;
    minExpense: string;
    maxExpense: string;
    opensAt: string;
    closesAt: string;
    regionId: string;
    media: string[];
    thingsToDoText: string;
    thingsToDoImageUrl: string;
}

const EMPTY_FORM: CreateForm = {
    title: "",
    categories: [],
    subCategories: [],
    description: "",
    address: "",
    tags: "",
    coordinates: null,
    websiteUrl: "",
    contact: "",
    mapUrl: "",
    minExpense: "",
    maxExpense: "",
    opensAt: "",
    closesAt: "",
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
    
    const { data: dbCategories = [] } = useQuery({
        queryKey: ["categories"],
        queryFn: () => categoryService.getCategories(),
        staleTime: 5 * 60_000,
    });
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const mediaFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingTtd, setUploadingTtd] = useState(false);
    const ttdFileInputRef = useRef<HTMLInputElement>(null);

    // ── Media upload (S3 presigned uploads) ──
    const handleMediaUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingMedia(true);
        try {
            const results = await Promise.allSettled(
                Array.from(files).map(async (file) => {
                    const result = await mediaService.uploadImage(file, { category: "marker" });
                    return result.secure_url;
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
            const result = await mediaService.uploadImage(file, { category: "marker" });
            setForm((f) => ({ ...f, thingsToDoImageUrl: result.secure_url }));
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
            toast.success("Place created");
            onClose();
            setForm(EMPTY_FORM);
        },
        onError: (e: Error) => {
            // Surface the backend message (e.g. "A marker already exists within 20m of this location").
            toast.error(e.message || "Failed to create place");
        },
    });

    // A picked search result drops the pin (via form.coordinates), recenters the map, and prefills
    // Title/Address if blank.
    const handlePlaceSelect = (place: ResolvedPlace) => {
        setForm((f) => ({
            ...f,
            coordinates: place.center,
            title: f.title.trim() ? f.title : place.name,
            address: f.address.trim() ? f.address : place.fullAddress,
        }));
    };

    // Reset transient form state when the modal is dismissed, so reopening starts clean.
    const handleClose = () => {
        setForm(EMPTY_FORM);
        onClose();
    };

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
            categories: form.categories.length > 0 ? form.categories : undefined,
            sub_categories: form.subCategories.length > 0 ? form.subCategories : undefined,
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
            opens_at: form.opensAt || undefined,
            closes_at: form.closesAt || undefined,
        };
        createMutation.mutate(payload);
    };

    const toggleCategory = (name: string, on: boolean) => {
        if (on) {
            if (form.categories.length >= 3) {
                toast.error("Select up to 3 categories");
                return;
            }
            setForm({ ...form, categories: [...form.categories, name] });
        } else {
            setForm({ ...form, categories: form.categories.filter((cat) => cat !== name) });
        }
    };

    const subOptions = dbCategories
        .filter((c) => form.categories.includes(c.name))
        .flatMap((c) => c.sub_categories)
        .filter((sub, index, self) => self.indexOf(sub) === index);

    return (
        <Modal
            open={open}
            onClose={handleClose}
            dismissible={!createMutation.isPending}
            title="New place"
            icon={MapPin}
            size="2xl"
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose} disabled={createMutation.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleCreate} loading={createMutation.isPending}>
                        Create place
                    </Button>
                </>
            }
        >
            <Field label="Title" required>
                <TextInput type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>

            <Field label="Categories" hint="Up to 3." htmlFor="new-place-categories">
                <div id="new-place-categories" className="flex max-h-36 flex-wrap gap-x-4 gap-y-2 overflow-y-auto rounded-control border border-line-strong p-3">
                    {dbCategories.length === 0 && <span className="text-sm text-ink-faint">No categories yet.</span>}
                    {dbCategories.map((c) => (
                        <Checkbox key={c.id} checked={form.categories.includes(c.name)} onChange={(on) => toggleCategory(c.name, on)} label={c.name} />
                    ))}
                </div>
            </Field>

            {form.categories.length > 0 && subOptions.length > 0 && (
                <Field label="Subcategories" htmlFor="new-place-subcategories">
                    <div id="new-place-subcategories" className="flex max-h-36 flex-wrap gap-x-4 gap-y-2 overflow-y-auto rounded-control border border-line-strong p-3">
                        {subOptions.map((sub) => (
                            <Checkbox
                                key={sub}
                                checked={form.subCategories.includes(sub)}
                                onChange={(on) =>
                                    setForm({
                                        ...form,
                                        subCategories: on ? [...form.subCategories, sub] : form.subCategories.filter((x) => x !== sub),
                                    })
                                }
                                label={sub}
                            />
                        ))}
                    </div>
                </Field>
            )}

            <Field label="Tags" hint="Separate with commas.">
                <TextInput type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </Field>

            <Field label="Address">
                <TextInput type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Website">
                    <TextInput type="url" placeholder="https://…" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
                </Field>
                <Field label="Contact">
                    <TextInput type="text" placeholder="Phone or email" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                </Field>
            </div>

            <Field label="Map link">
                <TextInput type="url" placeholder="https://maps…" value={form.mapUrl} onChange={(e) => setForm({ ...form, mapUrl: e.target.value })} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
                <Field label="Min expense (₹)">
                    <TextInput type="number" inputMode="numeric" value={form.minExpense} onChange={(e) => setForm({ ...form, minExpense: e.target.value })} />
                </Field>
                <Field label="Max expense (₹)">
                    <TextInput type="number" inputMode="numeric" value={form.maxExpense} onChange={(e) => setForm({ ...form, maxExpense: e.target.value })} />
                </Field>
                <Field label="Opens at">
                    <TextInput type="time" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} />
                </Field>
                <Field label="Closes at">
                    <TextInput type="time" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} />
                </Field>
            </div>

            <Field label="Region" htmlFor="new-place-region">
                <div id="new-place-region">
                    <RegionPicker value={form.regionId} onChange={(id) => setForm({ ...form, regionId: id })} />
                </div>
            </Field>

            <Field label="Photos" htmlFor="new-place-media">
                <div id="new-place-media" className="flex flex-wrap gap-3">
                    {form.media.map((url) => (
                        <ImageTile key={url} src={url} alt="Place photo" onRemove={() => removeMedia(url)} />
                    ))}
                    <UploadTile inputRef={mediaFileInputRef} uploading={uploadingMedia} multiple onChange={handleMediaUpload} />
                </div>
            </Field>

            <fieldset className="space-y-4 rounded-card border border-line p-4">
                <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-ink">
                    <ListChecks className="h-4 w-4 text-accent-600" aria-hidden />
                    Things to do
                </legend>
                <Field label="Things to do (text)">
                    <TextArea
                        rows={3}
                        placeholder="Suggested activities at this place…"
                        value={form.thingsToDoText}
                        onChange={(e) => setForm({ ...form, thingsToDoText: e.target.value })}
                    />
                </Field>
                <Field label="Things to do image" htmlFor="new-place-ttd">
                    <div id="new-place-ttd" className="flex flex-wrap gap-3">
                        {form.thingsToDoImageUrl ? (
                            <ImageTile src={form.thingsToDoImageUrl} alt="Things to do" onRemove={() => setForm({ ...form, thingsToDoImageUrl: "" })} large />
                        ) : (
                            <UploadTile inputRef={ttdFileInputRef} uploading={uploadingTtd} onChange={handleTtdImageUpload} large />
                        )}
                    </div>
                </Field>
            </fieldset>

            <Field label="Description">
                <TextArea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>

            <Field label="Location" required hint="Search a place, then drag the pin or click the map to fine-tune." htmlFor="new-place-location">
                <div id="new-place-location" className="space-y-3">
                    <PlaceSearchInput
                        mode="forward"
                        searchTypes={MARKER_SEARCH_TYPES}
                        proximity={INDIA_PROXIMITY}
                        placeholder="Search a place… e.g. Bir Billing, Gateway of India"
                        onSelect={handlePlaceSelect}
                        onError={(msg) => toast.error(msg)}
                    />
                    <div className="overflow-hidden rounded-control border border-line">
                        <GeoMap
                            height="280px"
                            draggable
                            pinColor="#00a49e"
                            markerPosition={form.coordinates}
                            onPick={(coords) => setForm((f) => ({ ...f, coordinates: coords }))}
                            onMarkerDragEnd={(coords) => setForm((f) => ({ ...f, coordinates: coords }))}
                        />
                    </div>
                    <p className="text-xs text-ink-muted">
                        {form.coordinates
                            ? `Selected: ${form.coordinates[1]}, ${form.coordinates[0]} (lat, lon)`
                            : "Search, click the map, or drag the pin to choose the spot."}
                    </p>
                </div>
            </Field>
        </Modal>
    );
}

function ImageTile({ src, alt, onRemove, large }: { src: string; alt: string; onRemove: () => void; large?: boolean }) {
    return (
        <div className={cx("group relative overflow-hidden rounded-control border border-line bg-surface-muted", large ? "h-24 w-24" : "h-20 w-20")}>
            <img src={src} alt={alt} className="h-full w-full object-cover" />
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${alt.toLowerCase()}`}
                className="absolute right-1 top-1 rounded-full bg-brand-950/70 p-1 text-white transition-opacity hover:bg-brand-950 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
                <X className="h-3.5 w-3.5" aria-hidden />
            </button>
        </div>
    );
}

function UploadTile({
    inputRef,
    uploading,
    multiple,
    onChange,
    large,
}: {
    inputRef: RefObject<HTMLInputElement>;
    uploading: boolean;
    multiple?: boolean;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    large?: boolean;
}) {
    return (
        <label
            className={cx(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-dashed border-line-strong text-ink-faint transition-colors hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700 focus-within:ring-2 focus-within:ring-accent-500",
                large ? "h-24 w-24" : "h-20 w-20",
                uploading && "pointer-events-none opacity-60"
            )}
        >
            {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
                <>
                    <Upload className="h-5 w-5" aria-hidden />
                    <span className="text-[11px] font-medium">Upload</span>
                </>
            )}
            <input ref={inputRef} type="file" accept="image/*" multiple={multiple} className="sr-only" onChange={onChange} disabled={uploading} />
        </label>
    );
}
