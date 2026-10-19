import { RegionPicker } from "@/features/regions/components/RegionPicker";
import { Checkbox, Field, inputClass } from "./CollabsUi";
import { MarkerIdsInput, RegionName } from "./CollabPickers";
import { slugError, type BusinessDraft } from "../businessDraft";
import type { BusinessStatus } from "../types";

const STATUSES: { value: BusinessStatus; label: string }[] = [
    { value: "pending_claim", label: "Pending claim" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
];

/**
 * Business profile fields shared by "Create on behalf" and the admin edit
 * form. Status/verified only exist in edit mode (create always starts as
 * pending_claim + verified).
 */
export function BusinessFormFields({
    draft,
    onChange,
    mode,
    disabled,
    idPrefix,
}: {
    draft: BusinessDraft;
    onChange: (next: BusinessDraft) => void;
    mode: "create" | "edit";
    disabled?: boolean;
    idPrefix: string;
}) {
    const set = <K extends keyof BusinessDraft>(key: K, value: BusinessDraft[K]) => onChange({ ...draft, [key]: value });
    const slugMsg = slugError(draft.public_slug);

    return (
        <div className="space-y-4">
            <Field label="Name" htmlFor={`${idPrefix}-name`} required>
                <input
                    id={`${idPrefix}-name`}
                    type="text"
                    maxLength={150}
                    value={draft.name}
                    disabled={disabled}
                    onChange={(e) => set("name", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Garden Café Bir"
                />
            </Field>
            <Field label="Tagline" htmlFor={`${idPrefix}-tagline`}>
                <input
                    id={`${idPrefix}-tagline`}
                    type="text"
                    maxLength={150}
                    value={draft.tagline}
                    disabled={disabled}
                    onChange={(e) => set("tagline", e.target.value)}
                    className={inputClass}
                />
            </Field>
            <Field label="Description" htmlFor={`${idPrefix}-description`}>
                <textarea
                    id={`${idPrefix}-description`}
                    maxLength={3000}
                    value={draft.description}
                    disabled={disabled}
                    onChange={(e) => set("description", e.target.value)}
                    className={`${inputClass} min-h-[96px] resize-y`}
                />
            </Field>
            <Field label="Categories" htmlFor={`${idPrefix}-categories`} hint="Comma separated, up to 10 (e.g. Cafe, Stays).">
                <input
                    id={`${idPrefix}-categories`}
                    type="text"
                    value={draft.categories}
                    disabled={disabled}
                    onChange={(e) => set("categories", e.target.value)}
                    className={inputClass}
                />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Contact phone" htmlFor={`${idPrefix}-phone`} hint="Used for claim-link OTP verification.">
                    <input
                        id={`${idPrefix}-phone`}
                        type="tel"
                        maxLength={20}
                        value={draft.contact_phone}
                        disabled={disabled}
                        onChange={(e) => set("contact_phone", e.target.value)}
                        className={inputClass}
                        placeholder="+91…"
                    />
                </Field>
                <Field label="Contact email" htmlFor={`${idPrefix}-email`}>
                    <input
                        id={`${idPrefix}-email`}
                        type="email"
                        maxLength={255}
                        value={draft.contact_email}
                        disabled={disabled}
                        onChange={(e) => set("contact_email", e.target.value)}
                        className={inputClass}
                    />
                </Field>
            </div>
            <Field label="Region">
                {disabled ? (
                    <div className={`${inputClass} bg-neutral-50 text-neutral-600`}>
                        <RegionName id={draft.region_id || null} />
                    </div>
                ) : (
                    <RegionPicker value={draft.region_id} onChange={(id) => set("region_id", id)} ringClass="focus:ring-teal-500" />
                )}
            </Field>
            <Field label="Places (markers)" hint="SeekKrr markers this business operates. Collabs are posted per place.">
                <MarkerIdsInput value={draft.marker_ids} onChange={(ids) => set("marker_ids", ids)} disabled={disabled} />
            </Field>

            <div className="pt-2 border-t border-neutral-100 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Website listing</p>
                <Field
                    label="Public slug"
                    htmlFor={`${idPrefix}-slug`}
                    hint={slugMsg ?? "seekkrr.com/places/<slug>. Slugified by the server; a suffix is added if taken."}
                >
                    <input
                        id={`${idPrefix}-slug`}
                        type="text"
                        maxLength={80}
                        value={draft.public_slug}
                        disabled={disabled}
                        onChange={(e) => set("public_slug", e.target.value)}
                        className={`${inputClass} font-mono ${slugMsg ? "ring-2 ring-red-300" : ""}`}
                        placeholder={mode === "create" ? "Auto-generated from name" : ""}
                    />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Checkbox
                        checked={draft.show_on_website}
                        onChange={(v) => set("show_on_website", v)}
                        disabled={disabled}
                        label="Show on website"
                        hint="Owner can also opt out. Needs verified + active."
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

            {mode === "edit" && (
                <div className="pt-2 border-t border-neutral-100 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                        <Field label="Status" htmlFor={`${idPrefix}-status`} hint="Active requires a claimed owner.">
                            <select
                                id={`${idPrefix}-status`}
                                value={draft.status}
                                disabled={disabled}
                                onChange={(e) => set("status", e.target.value as BusinessStatus)}
                                className={inputClass}
                            >
                                {STATUSES.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className="pt-7">
                            <Checkbox checked={draft.verified} onChange={(v) => set("verified", v)} disabled={disabled} label="Verified business" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
