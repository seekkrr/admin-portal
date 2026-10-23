import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { mediaService } from "@/services/media.service";
import { categoryService } from "@/services/category.service";
import { Drawer } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { cx } from "@/utils/cx";
import { exploreMapService, replaceRegionInCache } from "../services/explore-map.service";
import { RegionPreviewCard } from "./RegionPreviewCard";
import { BADGE_PRESETS, EXPLORE_LIMITS, SPECIAL_FILTERS, type ExploreRegion, type ExploreRegionSettingsPayload } from "../types";

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Field label with a live "12/120" counter on the right. */
function CountedLabel({ label, count, max }: { label: string; count: number; max: number }) {
    const near = count >= max * 0.9;
    return (
        <span className="flex items-baseline justify-between gap-2">
            {label}
            <span className={cx("text-xs font-normal tabular-nums", near ? "font-medium text-warn" : "text-ink-faint")} aria-live="polite">
                {count}/{max}
            </span>
        </span>
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
            className={cx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-40",
                selected ? "border-brand-900 bg-brand-900 text-white" : "border-line-strong bg-surface text-ink hover:border-accent-300 hover:bg-accent-50"
            )}
        >
            {selected && <Check className="h-3 w-3" aria-hidden />}
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
            onClose={onClose}
            dismissible={!busy}
            title={`Edit ${region.name}`}
            subtitle={
                <>
                    {region.slug && <span className="font-mono">{region.slug}</span>}
                    {region.slug && " · "}The app picks up changes within about a minute.
                </>
            }
            footer={
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" icon={Save} onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty || coverInvalid || uploading}>
                        Save changes
                    </Button>
                </div>
            }
        >
            <section className="rounded-card border border-line bg-surface-muted p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">App preview · region picker</p>
                <RegionPreviewCard name={region.name} coverImage={cover} tagline={tagline} badge={badge} banner={banner} counts={region.counts} />
            </section>

            <Field
                label="Cover image"
                htmlFor="explore-cover-url"
                error={coverInvalid ? "The cover image must be an https:// URL." : undefined}
                hint="Upload a photo or paste an https:// image URL. Landscape works best."
            >
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" icon={ImagePlus} loading={uploading} onClick={() => fileRef.current?.click()} disabled={busy}>
                            {uploading ? `Uploading ${uploadPct}%` : "Upload image"}
                        </Button>
                        {cover && (
                            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setCoverImage("")} disabled={busy}>
                                Remove
                            </Button>
                        )}
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" tabIndex={-1} aria-hidden onChange={handleFile} />
                    </div>
                    <TextInput
                        id="explore-cover-url"
                        type="url"
                        inputMode="url"
                        maxLength={1000}
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        disabled={uploading}
                        invalid={coverInvalid}
                        placeholder="https://img.seekkrr.com/…"
                    />
                </div>
            </Field>

            <Field label={<CountedLabel label="Tagline" count={tagline.length} max={EXPLORE_LIMITS.tagline} />} hint="One line under the region name in the picker.">
                <TextInput
                    type="text"
                    maxLength={EXPLORE_LIMITS.tagline}
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Hills, tea gardens and the Hornbill Festival"
                />
            </Field>

            <Field label={<CountedLabel label="Badge" count={badge.length} max={EXPLORE_LIMITS.badge} />} hint="Short label on the cover. Leave empty for none." htmlFor="explore-badge">
                <div className="space-y-2">
                    <TextInput id="explore-badge" type="text" maxLength={EXPLORE_LIMITS.badge} value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="e.g. Festival live" />
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink-muted">Quick picks:</span>
                        {BADGE_PRESETS.map((preset) => (
                            <FilterPill key={preset} label={preset} selected={badge.trim() === preset} onToggle={() => setBadge(badge.trim() === preset ? "" : preset)} />
                        ))}
                    </div>
                </div>
            </Field>

            <Field
                label={<CountedLabel label="Banner message" count={banner.length} max={EXPLORE_LIMITS.banner} />}
                hint="Shown on the map when this region is open, e.g. an event notice. Leave empty for none."
            >
                <TextArea
                    rows={3}
                    maxLength={EXPLORE_LIMITS.banner}
                    value={banner}
                    onChange={(e) => setBanner(e.target.value)}
                    placeholder="e.g. Hornbill Festival is on, 1–10 Dec. Tap Collabs to see festival offers."
                    className="resize-none"
                />
            </Field>

            <Field
                label={<CountedLabel label="Default filters" count={filters.length} max={EXPLORE_LIMITS.filters} />}
                hint={atFilterLimit ? "Up to 10 filters. Remove one to add another." : "Filters already on when someone opens this region. None = show everything."}
                htmlFor="explore-filters"
            >
                <div id="explore-filters" className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {SPECIAL_FILTERS.map((name) => (
                            <FilterPill key={name} label={name} selected={filters.includes(name)} disabled={atFilterLimit} onToggle={() => toggleFilter(name)} />
                        ))}
                    </div>
                    <div>
                        <p className="mb-2 text-xs font-medium text-ink-muted">Place categories</p>
                        {unresolvedSelected.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                                {unresolvedSelected.map((name) => (
                                    <FilterPill key={name} label={name} selected onToggle={() => toggleFilter(name)} />
                                ))}
                            </div>
                        )}
                        {categoriesQuery.isLoading ? (
                            <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading categories…
                            </p>
                        ) : categoriesQuery.error ? (
                            <p className="text-xs text-bad">
                                Couldn&apos;t load categories.{" "}
                                <button type="button" onClick={() => categoriesQuery.refetch()} className="font-medium text-accent-700 hover:underline">
                                    Retry
                                </button>
                            </p>
                        ) : categoryNames.length === 0 ? (
                            <p className="text-xs text-ink-faint">No active categories.</p>
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
                            <p className="mb-2 text-xs font-medium text-warn">Saved filters that no longer match a category (tap to remove)</p>
                            <div className="flex flex-wrap gap-2">
                                {unknownSelected.map((name) => (
                                    <FilterPill key={name} label={name} selected onToggle={() => toggleFilter(name)} title="Not a current category or app filter" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Field>
        </Drawer>
    );
}
