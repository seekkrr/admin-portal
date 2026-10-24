import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, IndianRupee, Info, ListChecks, Tags } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Checkbox, Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { SaveBar } from "@/components/detail/SaveBar";
import { ChipsInput } from "@/components/detail/ChipsInput";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { RegionPicker } from "@/features/regions/components/RegionPicker";
import { SingleImageField } from "@/components/detail/SingleImageField";
import { categoryService } from "@/services/category.service";
import { placeDetailApi } from "@/services/admin-detail.service";
import { cx } from "@/utils/cx";
import type { Marker, MarkerStatus } from "@/types";
import { detailsChanges, detailsErrors, detailsFormOf, type MarkerDetailsForm, type SubscriptionFlag } from "./markerForm";

const STATUS_OPTIONS: { value: MarkerStatus; label: string }[] = [
    { value: "approved", label: "Approved" },
    { value: "pending", label: "Pending" },
    { value: "rejected", label: "Rejected" },
];
const FLAG_OPTIONS: { value: SubscriptionFlag; label: string }[] = [
    { value: "NA", label: "Not a business" },
    { value: "Virtual", label: "Virtual redemptions" },
    { value: "Physical", label: "Physical redemptions" },
    { value: "Both", label: "Both" },
];
const MAX_CATEGORIES = 3;

function ChoiceChips({
    label,
    options,
    selected,
    onToggle,
    max,
    disabled,
}: {
    label: string;
    options: string[];
    selected: string[];
    onToggle: (v: string) => void;
    max?: number;
    disabled?: boolean;
}) {
    return (
        <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
            {options.map((o) => {
                const on = selected.includes(o);
                const blocked = !on && max !== undefined && selected.length >= max;
                return (
                    <button
                        key={o}
                        type="button"
                        aria-pressed={on}
                        disabled={disabled || blocked}
                        onClick={() => onToggle(o)}
                        className={cx(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                            on ? "border-brand-900 bg-brand-900 text-white" : "border-line-strong bg-surface text-ink hover:border-accent-300"
                        )}
                    >
                        {o}
                    </button>
                );
            })}
        </div>
    );
}

/** Every editable field of a place except its location and photos. */
export function MarkerDetailsTab({ marker, canEdit, onSaved }: { marker: Marker; canEdit: boolean; onSaved: () => void }) {
    const base = useMemo(() => detailsFormOf(marker), [marker]);
    const [form, setForm, reset] = useSyncedDraft<MarkerDetailsForm>(base);
    const set = <K extends keyof MarkerDetailsForm>(k: K, v: MarkerDetailsForm[K]) => setForm((f) => ({ ...f, [k]: v }));
    const changes = detailsChanges(form, base);
    const errors = detailsErrors(form);
    const dirty = Object.keys(changes).length > 0;
    const disabled = !canEdit;

    const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.getCategories(), staleTime: 5 * 60_000 });
    const catNames = (categories.data ?? []).map((c) => c.name);
    const subOptions = Array.from(new Set((categories.data ?? []).filter((c) => form.categories.includes(c.name)).flatMap((c) => c.sub_categories)));

    const save = useMutation({
        mutationFn: () => placeDetailApi.update(marker.id, changes),
        onSuccess: () => {
            toast.success("Place saved");
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

    return (
        <div className="space-y-5">
            <Panel title="About" icon={Info}>
                <div className="space-y-4">
                    <Field label="Name" required error={errors.title}>
                        <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={300} disabled={disabled} />
                    </Field>
                    <Field label="Description">
                        <TextArea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={2000} disabled={disabled} />
                    </Field>
                    <Field label="Address" hint="Move the pin on the Location tab.">
                        <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={500} disabled={disabled} />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Status">
                            <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as MarkerStatus)} options={STATUS_OPTIONS} disabled={disabled} />
                        </Field>
                        <Field label="Region" hint="Usually set from the pin.">
                            <RegionPicker value={form.region_id} onChange={(id) => set("region_id", id)} ringClass="focus:ring-accent-500" />
                        </Field>
                    </div>
                    <Checkbox checked={form.hidden} onChange={(v) => set("hidden", v)} disabled={disabled} label="Hidden" hint="Left out of maps, search and recommendations." />
                </div>
            </Panel>

            <Panel title="Category and tags" icon={Tags}>
                <div className="space-y-4">
                    <Field label={`Categories (up to ${MAX_CATEGORIES})`}>
                        {categories.isLoading ? (
                            <p className="text-sm text-ink-faint">Loading categories…</p>
                        ) : (
                            <ChoiceChips
                                label="Categories"
                                options={Array.from(new Set([...catNames, ...form.categories]))}
                                selected={form.categories}
                                max={MAX_CATEGORIES}
                                disabled={disabled}
                                onToggle={(v) => {
                                    const next = toggle(form.categories, v);
                                    const allowedSubs = new Set((categories.data ?? []).filter((c) => next.includes(c.name)).flatMap((c) => c.sub_categories));
                                    setForm((f) => ({ ...f, categories: next, sub_categories: f.sub_categories.filter((s) => allowedSubs.has(s)) }));
                                }}
                            />
                        )}
                    </Field>
                    {subOptions.length > 0 && (
                        <Field label="Types">
                            <ChoiceChips
                                label="Types"
                                options={subOptions}
                                selected={form.sub_categories}
                                disabled={disabled}
                                onToggle={(v) => set("sub_categories", toggle(form.sub_categories, v))}
                            />
                        </Field>
                    )}
                    <Field label="Tags" hint="Press Enter after each tag.">
                        <ChipsInput value={form.tags} onChange={(v) => set("tags", v)} maxLength={100} disabled={disabled} />
                    </Field>
                </div>
            </Panel>

            <Panel title="Hours, prices and links" icon={Clock}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Opens at">
                        <TextInput type="time" value={form.opens_at} onChange={(e) => set("opens_at", e.target.value)} disabled={disabled} />
                    </Field>
                    <Field label="Closes at">
                        <TextInput type="time" value={form.closes_at} onChange={(e) => set("closes_at", e.target.value)} disabled={disabled} />
                    </Field>
                    <Field label="Min spend (₹)" error={errors.min_expense}>
                        <TextInput type="number" min={0} inputMode="decimal" value={form.min_expense} onChange={(e) => set("min_expense", e.target.value)} disabled={disabled} />
                    </Field>
                    <Field label="Max spend (₹)" error={errors.max_expense}>
                        <TextInput type="number" min={0} inputMode="decimal" value={form.max_expense} onChange={(e) => set("max_expense", e.target.value)} disabled={disabled} />
                    </Field>
                    <Field label="Website" error={errors.website_url}>
                        <TextInput value={form.website_url} onChange={(e) => set("website_url", e.target.value)} maxLength={500} placeholder="https://…" disabled={disabled} />
                    </Field>
                    <Field label="Contact" hint="Phone or email.">
                        <TextInput value={form.contact} onChange={(e) => set("contact", e.target.value)} maxLength={100} disabled={disabled} />
                    </Field>
                    <Field label="Map link" error={errors.map_url} className="sm:col-span-2">
                        <TextInput value={form.map_url} onChange={(e) => set("map_url", e.target.value)} maxLength={500} placeholder="https://maps.google.com/…" disabled={disabled} />
                    </Field>
                    <Field label="Business redemptions" hint="How creators redeem collabs here.">
                        <SelectInput value={form.subscription_flag} onChange={(e) => set("subscription_flag", e.target.value as SubscriptionFlag)} options={FLAG_OPTIONS} disabled={disabled} />
                    </Field>
                </div>
            </Panel>

            <Panel title="Things to do" icon={ListChecks}>
                <div className="space-y-4">
                    <Field label="Suggestions">
                        <TextArea value={form.things_to_do_text} onChange={(e) => set("things_to_do_text", e.target.value)} rows={3} maxLength={2000} disabled={disabled} />
                    </Field>
                    <Field label="Photo">
                        <SingleImageField
                            value={form.things_to_do_image_url}
                            onChange={(url) => set("things_to_do_image_url", url)}
                            category="marker"
                            entityId={marker.id}
                            disabled={disabled}
                            label="Things to do photo"
                        />
                    </Field>
                </div>
            </Panel>

            <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                <IndianRupee className="h-3.5 w-3.5" aria-hidden /> Spend range shows in the app as a price guide.
            </p>
            <SaveBar dirty={dirty && canEdit} saving={save.isPending} invalid={Object.keys(errors).length > 0} onSave={() => save.mutate()} onDiscard={reset} />
        </div>
    );
}
