import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { mediaService } from "@/services/media.service";
import { categoryService } from "@/services/category.service";
import { Drawer, LoadingButtonIcon, btnPrimary, btnSecondary, btnSmNeutral, inputClass } from "@/features/collabs/components/CollabsUi";
import { exploreMapService, replaceRegionInCache } from "../services/explore-map.service";
import { RegionPreviewCard } from "./RegionPreviewCard";
import { BADGE_PRESETS, EXPLORE_LIMITS, SPECIAL_FILTERS, type ExploreRegion, type ExploreRegionSettingsPayload } from "../types";

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function LabelRow({ htmlFor, label, count, max, hint, children }: { htmlFor?: string; label: string; count?: number; max?: number; hint?: ReactNode; children: ReactNode }) {
    const near = count !== undefined && max !== undefined && count >= max * 0.9;
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
                <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700">{label}</label>
                {count !== undefined && max !== undefined && (
                    <span className={`text-xs tabular-nums ${near ? "text-amber-600 font-medium" : "text-neutral-400"}`} aria-live="polite">
                        {count}/{max}
                    </span>
                )}
            </div>
            {children}
            {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
        </div>
    );
}

function FilterPill({ label, selected, disabled, onToggle, title }: { label: string; selected: boolean; disabled?: boolean; onToggle: () => void; title?: string }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            title={title}
            disabled={disabled && !selected}
            onClick={onToggle}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                selected ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-neutral-200 text-neutral-700 hover:border-teal-300 hover:bg-teal-50"
            }`}
        >
            {selected && <Check className="w-3 h-3" />}
            {label}
        </button>
    );
}

/** Edit a region's explore-map presentation: cover, tagline, badge, banner and starting filters. */
export function RegionSettingsDrawer({ region, onClose }: { region: ExploreRegion; onClose: () => void }) {
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [coverImage, setCoverImage] = useState(region.cover_image ?? "");
    const [tagline, setTagline] = useState(region.tagline ?? "");
    const [badge, setBadge] = useState(region.badge ?? "");
    const [banner, setBanner] = useState(region.banner ?? "");
    const [filters, setFilters] = useState<string[]>(region.default_filters ?? []);
    const [uploadPct, setUploadPct] = useState<number | null>(null);

    const categoriesQuery = useQuery({
        queryKey: ["categories"],
        queryFn: () => categoryService.getCategories(),
        staleTime: 5 * 60 * 1000,
    });
    const categoryNames = (categoriesQuery.data ?? []).filter((c) => c.is_active !== false).map((c) => c.name);
    const known = new Set<string>([...SPECIAL_FILTERS, ...categoryNames]);
    const special = new Set<string>(SPECIAL_FILTERS);
    // Until categories load we can't tell stale names apart, so just list the selected ones.
    const unknownSelected = categoriesQuery.isSuccess ? filters.filter((f) => !known.has(f)) : [];
    const unresolvedSelected = categoriesQuery.isSuccess ? [] : filters.filter((f) => !special.has(f));

    const cover = coverImage.trim();
    const coverInvalid = cover !== "" && !cover.startsWith("https://");
    const uploading = uploadPct !== null;

    const payload: ExploreRegionSettingsPayload = {};
    if (cover !== (region.cover_image ?? "")) payload.cover_image = cover || null;
    if (tagline.trim() !== (region.tagline ?? "")) payload.tagline = tagline.trim() || null;
    if (badge.trim() !== (region.badge ?? "")) payload.badge = badge.trim() || null;
    if (banner.trim() !== (region.banner ?? "")) payload.banner = banner.trim() || null;
    if (!sameList(filters, region.default_filters ?? [])) payload.default_filters = filters;
    const dirty = Object.keys(payload).length > 0;

    const save = useMutation({
        mutationFn: () => exploreMapService.updateRegion(region.id, payload),
        onSuccess: (fresh) => {
            replaceRegionInCache(queryClient, fresh);
            toast.success(`${fresh.name} updated`);
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || `Couldn't update ${region.name}`),
    });

    const toggleFilter = (name: string) =>
        setFilters((prev) => (prev.includes(name) ? prev.filter((f) => f !== name) : prev.length >= EXPLORE_LIMITS.filters ? prev : [...prev, name]));

    const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadPct(0);
        try {
            const result = await mediaService.uploadImage(file, {
                category: "region",
                entity_id: region.id,
                onProgress: (p) => setUploadPct(p.percentage),
            });
            setCoverImage(result.secure_url);
            toast.success("Cover uploaded. Save to apply it.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadPct(null);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const atFilterLimit = filters.length >= EXPLORE_LIMITS.filters;
    const busy = save.isPending || uploading;

    return (
        <Drawer
            open
            onClose={busy ? () => undefined : onClose}
            title={`Edit ${region.name}`}
            subtitle={<>{region.slug && <span className="font-mono">{region.slug}</span>}{region.slug && " · "}The app picks up changes within about a minute.</>}
            footer={
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>Cancel</button>
                    <button type="button" onClick={() => save.mutate()} disabled={!dirty || coverInvalid || busy} className={btnPrimary}>
                        <LoadingButtonIcon loading={save.isPending} icon={Save} /> Save changes
                    </button>
                </div>
            }
        >
            <section className="rounded-2xl bg-neutral-50 border border-neutral-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">App preview · region picker</p>
                <RegionPreviewCard name={region.name} coverImage={cover} tagline={tagline} badge={badge} banner={banner} counts={region.counts} />
            </section>

            <LabelRow
                htmlFor="explore-cover-url"
                label="Cover image"
                hint={coverInvalid ? <span className="text-red-600">The cover image must be an https:// URL.</span> : "Upload a photo or paste an https:// image URL. Landscape works best."}
            >
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={btnSmNeutral}>
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                            {uploading ? `Uploading ${uploadPct}%` : "Upload image"}
                        </button>
                        {cover && (
                            <button type="button" onClick={() => setCoverImage("")} disabled={busy} className={btnSmNeutral}>
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                        )}
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
                    </div>
                    <input
                        id="explore-cover-url"
                        type="url"
                        inputMode="url"
                        maxLength={1000}
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        disabled={uploading}
                        placeholder="https://img.seekkrr.com/…"
                        className={`${inputClass} ${coverInvalid ? "border-red-300 focus:ring-red-400" : ""}`}
                    />
                </div>
            </LabelRow>

            <LabelRow htmlFor="explore-tagline" label="Tagline" count={tagline.length} max={EXPLORE_LIMITS.tagline} hint="One line under the region name in the picker.">
                <input
                    id="explore-tagline"
                    type="text"
                    maxLength={EXPLORE_LIMITS.tagline}
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Hills, tea gardens and the Hornbill Festival"
                    className={inputClass}
                />
            </LabelRow>

            <LabelRow htmlFor="explore-badge" label="Badge" count={badge.length} max={EXPLORE_LIMITS.badge} hint="Short label on the cover. Leave empty for none.">
                <div className="space-y-2">
                    <input
                        id="explore-badge"
                        type="text"
                        maxLength={EXPLORE_LIMITS.badge}
                        value={badge}
                        onChange={(e) => setBadge(e.target.value)}
                        placeholder="e.g. Festival live"
                        className={inputClass}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-neutral-500">Quick picks:</span>
                        {BADGE_PRESETS.map((preset) => (
                            <FilterPill key={preset} label={preset} selected={badge.trim() === preset} onToggle={() => setBadge(badge.trim() === preset ? "" : preset)} />
                        ))}
                    </div>
                </div>
            </LabelRow>

            <LabelRow htmlFor="explore-banner" label="Banner message" count={banner.length} max={EXPLORE_LIMITS.banner} hint="Shown on the map when this region is open, e.g. an event notice. Leave empty for none.">
                <textarea
                    id="explore-banner"
                    rows={3}
                    maxLength={EXPLORE_LIMITS.banner}
                    value={banner}
                    onChange={(e) => setBanner(e.target.value)}
                    placeholder="e.g. Hornbill Festival is on, 1–10 Dec. Tap Collabs to see festival offers."
                    className={`${inputClass} resize-none`}
                />
            </LabelRow>

            <LabelRow
                label="Default filters"
                count={filters.length}
                max={EXPLORE_LIMITS.filters}
                hint={atFilterLimit ? "Up to 10 filters. Remove one to add another." : "Filters already on when someone opens this region. None = show everything."}
            >
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {SPECIAL_FILTERS.map((name) => (
                            <FilterPill key={name} label={name} selected={filters.includes(name)} disabled={atFilterLimit} onToggle={() => toggleFilter(name)} />
                        ))}
                    </div>
                    <div>
                        <p className="text-xs font-medium text-neutral-500 mb-2">Place categories</p>
                        {unresolvedSelected.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {unresolvedSelected.map((name) => (
                                    <FilterPill key={name} label={name} selected onToggle={() => toggleFilter(name)} />
                                ))}
                            </div>
                        )}
                        {categoriesQuery.isLoading ? (
                            <p className="text-xs text-neutral-400 inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading categories…</p>
                        ) : categoriesQuery.error ? (
                            <p className="text-xs text-red-600">
                                Couldn't load categories.{" "}
                                <button type="button" onClick={() => categoriesQuery.refetch()} className="text-teal-700 font-medium hover:underline">Retry</button>
                            </p>
                        ) : categoryNames.length === 0 ? (
                            <p className="text-xs text-neutral-400">No active categories.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {categoryNames.map((name) => (
                                    <FilterPill key={name} label={name} selected={filters.includes(name)} disabled={atFilterLimit} onToggle={() => toggleFilter(name)} />
                                ))}
                            </div>
                        )}
                    </div>
                    {unknownSelected.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-amber-700 mb-2">Saved filters that no longer match a category (tap to remove)</p>
                            <div className="flex flex-wrap gap-2">
                                {unknownSelected.map((name) => (
                                    <FilterPill key={name} label={name} selected onToggle={() => toggleFilter(name)} title="Not a current category or app filter" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </LabelRow>
        </Drawer>
    );
}
