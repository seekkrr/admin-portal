import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, ShieldCheck, Store } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Checkbox, Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { SaveBar } from "@/components/detail/SaveBar";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { RegionPicker } from "@/features/regions/components/RegionPicker";
import { businessesService } from "../../services/businesses.service";
import { BusinessCategoryPicker } from "../BusinessCategoryPicker";
import { diffBusinessDraft, draftFromBusiness, slugError, type BusinessDraft } from "../../businessDraft";
import type { AdminBusiness, BusinessStatus } from "../../types";

const STATUSES: { value: BusinessStatus; label: string }[] = [
    { value: "pending_claim", label: "No owner yet" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
];

/** Profile & website listing (name, tagline, categories, contact, region, slug, status, verified). */
export function BusinessProfileTab({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const base = useMemo(() => draftFromBusiness(business), [business]);
    const [draft, setDraft, resetDraft] = useSyncedDraft<BusinessDraft>(base);
    const set = <K extends keyof BusinessDraft>(key: K, value: BusinessDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
    // Places are linked and unlinked on the Places tab, so they never travel with this form.
    const { marker_ids: _places, ...changes } = diffBusinessDraft(draft, business);
    const dirty = Object.keys(changes).length > 0;
    const slugMsg = slugError(draft.public_slug);
    const invalid = !draft.name.trim() || !!slugMsg;
    const disabled = !canEdit;

    const save = useMutation({
        mutationFn: () => businessesService.update(business.id, changes),
        onSuccess: (updated) => {
            toast.success("Business saved");
            queryClient.setQueryData(["collabs-business", business.id], updated);
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
            queryClient.invalidateQueries({ queryKey: ["admin-audit", "business", business.id] });
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't save the business"),
    });

    return (
        <div className="space-y-5">
            <Panel title="Profile" icon={Store} description={canEdit ? undefined : "View only"}>
                <div className="space-y-4">
                    <Field label="Name" required error={!draft.name.trim() ? "A name is required." : undefined}>
                        <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={150} disabled={disabled} />
                    </Field>
                    <Field label="Tagline">
                        <TextInput value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={150} disabled={disabled} />
                    </Field>
                    <Field label="Description">
                        <TextArea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={3000} disabled={disabled} />
                    </Field>
                    <Field label="Categories" hint="Up to 3 place categories, then the type.">
                        <BusinessCategoryPicker
                            categories={draft.categories}
                            subCategories={draft.sub_categories}
                            disabled={disabled}
                            onChange={(categories, sub_categories) => setDraft((d) => ({ ...d, categories, sub_categories }))}
                        />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Contact phone" hint="For SeekKrr to reach them. Not shown publicly.">
                            <TextInput type="tel" value={draft.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} maxLength={20} disabled={disabled} />
                        </Field>
                        <Field label="Contact email">
                            <TextInput type="email" value={draft.contact_email} onChange={(e) => set("contact_email", e.target.value)} maxLength={255} disabled={disabled} />
                        </Field>
                    </div>
                    <Field label="Region">
                        <RegionPicker value={draft.region_id} onChange={(id) => set("region_id", id)} ringClass="focus:ring-accent-500" />
                    </Field>
                </div>
            </Panel>

            <Panel title="Website listing" icon={Globe}>
                <div className="space-y-4">
                    <Field label="Public slug" error={slugMsg ?? undefined} hint="seekkrr.com/places/<slug>. A suffix is added if it's taken.">
                        <TextInput value={draft.public_slug} onChange={(e) => set("public_slug", e.target.value)} maxLength={80} disabled={disabled} className="font-mono" />
                    </Field>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Checkbox
                            checked={draft.show_on_website}
                            onChange={(v) => set("show_on_website", v)}
                            disabled={disabled}
                            label="Show on website"
                            hint="Needs verified + active. The owner can opt out too."
                        />
                        <Checkbox
                            checked={draft.website_featured}
                            onChange={(v) => set("website_featured", v)}
                            disabled={disabled}
                            label="Feature on website"
                            hint="Top band of the /places directory."
                        />
                    </div>
                </div>
            </Panel>

            <Panel title="Status" icon={ShieldCheck}>
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                    <Field label="Status" hint="Active needs an owner.">
                        <SelectInput value={draft.status} onChange={(e) => set("status", e.target.value as BusinessStatus)} options={STATUSES} disabled={disabled} />
                    </Field>
                    <div className="sm:pt-8">
                        <Checkbox checked={draft.verified} onChange={(v) => set("verified", v)} disabled={disabled} label="Verified business" />
                    </div>
                </div>
            </Panel>

            <SaveBar
                dirty={dirty && canEdit}
                saving={save.isPending}
                invalid={invalid}
                onSave={() => save.mutate()}
                onDiscard={resetDraft}
            />
        </div>
    );
}
