import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { IndianRupee, Landmark } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Field, SelectInput, Switch, TextInput } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { Notice } from "@/components/detail/DetailStates";
import { SaveBar } from "@/components/detail/SaveBar";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { experienceDetailApi, isNotAvailable } from "@/services/admin-detail.service";
import { GST_DEFAULTS, GST_RATES, type ExperienceDetail, type ExperienceGst, type ExperiencePricingPatch } from "@/types/admin-detail";
import { gstExample, gstTag, inr } from "@/features/experience-payments/money";

interface PricingForm {
    price: string;
    /** option id → price text */
    options: Record<string, string>;
    gst: ExperienceGst;
}

const text = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const money = (v: string): number | null => (v.trim() === "" ? null : Number(v));
const badMoney = (v: string) => v.trim() !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0);

function formFrom(e: ExperienceDetail): PricingForm {
    const gst = e.gst ?? GST_DEFAULTS;
    return {
        price: text(e.price_per_person),
        options: Object.fromEntries((e.options ?? []).map((o) => [o.id, text(o.price)])),
        gst: {
            enabled: !!gst.enabled,
            rate_pct: (GST_RATES as readonly number[]).includes(gst.rate_pct) ? gst.rate_pct : GST_DEFAULTS.rate_pct,
            inclusive: !!gst.inclusive,
        },
    };
}

/** Only what changed. Options go as a full list when any of them changed. */
function changesOf(form: PricingForm, base: PricingForm, e: ExperienceDetail): ExperiencePricingPatch {
    const out: ExperiencePricingPatch = {};
    if (money(form.price) !== money(base.price)) out.price_per_person = money(form.price);
    const options = (e.options ?? []).map((o) => ({ id: o.id, price: money(form.options[o.id] ?? "") }));
    if (options.some((o) => o.price !== money(base.options[o.id] ?? ""))) out.options = options;
    if (JSON.stringify(form.gst) !== JSON.stringify(base.gst)) out.gst = form.gst;
    return out;
}

/**
 * Prices are set by SeekKrr only: a price per person, optionally a price per
 * option (session type), and GST. A slot's price is its option's price, else
 * the price per person, else free. Saved with PATCH /admin/experiences/{id}/pricing.
 */
export function ExperiencePricingTab({
    experience,
    canEdit,
    onSaved,
}: {
    experience: ExperienceDetail;
    canEdit: boolean;
    onSaved: (next: ExperienceDetail) => void;
}) {
    const base = useMemo(() => formFrom(experience), [experience]);
    const [form, setForm, reset] = useSyncedDraft<PricingForm>(base);
    const [notLive, setNotLive] = useState(false);
    const options = experience.options ?? [];
    const changes = changesOf(form, base, experience);
    const dirty = Object.keys(changes).length > 0;
    const disabled = !canEdit;

    const errors: string[] = [];
    if (badMoney(form.price)) errors.push("The price per person must be 0 or more.");
    if (options.some((o) => badMoney(form.options[o.id] ?? ""))) errors.push("Option prices must be 0 or more.");

    const perPerson = money(form.price);
    const examplePrice =
        (perPerson && perPerson > 0 ? perPerson : null) ??
        options.map((o) => money(form.options[o.id] ?? "")).find((p): p is number => p !== null && p > 0) ??
        1000;

    const save = useMutation({
        mutationFn: () => experienceDetailApi.setPricing(experience.id, changes),
        onSuccess: (next) => {
            setNotLive(false);
            toast.success("Prices saved");
            onSaved(next);
        },
        onError: (e: Error) => {
            setNotLive(isNotAvailable(e));
            toast.error(e.message || "Couldn't save the prices");
        },
    });

    const setGst = (patch: Partial<ExperienceGst>) => setForm((f) => ({ ...f, gst: { ...f.gst, ...patch } }));

    return (
        <div className="space-y-5">
            {notLive && <Notice tone="warn" title="This isn't available on the server yet">Prices can be saved once the server update is live.</Notice>}

            <Panel
                title="Price"
                icon={IndianRupee}
                description="Per person, in rupees."
                actions={
                    <span className="flex flex-wrap gap-1.5">
                        <Tag tone="brand">App shows: {experience.price_from === null ? "no price yet" : `From ${inr(experience.price_from)}`}</Tag>
                        <Tag>{gstTag(base.gst)}</Tag>
                    </span>
                }
            >
                <div className="space-y-5">
                    <Notice>Businesses can't change prices. They see them read-only in the Partner Portal.</Notice>
                    <Field
                        label="Price per person (₹)"
                        hint={options.length ? "Used by every option without its own price. Empty = free." : "Empty = free."}
                        error={badMoney(form.price) ? "0 or more." : undefined}
                        className="sm:max-w-xs"
                    >
                        <TextInput
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={form.price}
                            placeholder="Not set"
                            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                            disabled={disabled}
                        />
                    </Field>

                    {options.length > 0 && (
                        <fieldset className="space-y-3">
                            <legend className="text-sm font-medium text-ink">Price per option</legend>
                            <p className="-mt-1 text-xs text-ink-faint">A slot's price is its option's price, else the price per person, else free.</p>
                            <ul className="divide-y divide-line rounded-control border border-line">
                                {options.map((o) => {
                                    const v = form.options[o.id] ?? "";
                                    return (
                                        <li key={o.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-ink">{o.name || "Unnamed option"}</p>
                                                {o.duration_minutes ? <p className="text-xs text-ink-faint">{o.duration_minutes} min</p> : null}
                                            </div>
                                            <Field label={`Price for ${o.name || "this option"} (₹)`} hideLabel className="sm:w-44" error={badMoney(v) ? "0 or more." : undefined}>
                                                <TextInput
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    inputMode="decimal"
                                                    value={v}
                                                    placeholder={perPerson !== null ? `Uses ${inr(perPerson)}` : "Uses price per person"}
                                                    onChange={(e) => setForm((f) => ({ ...f, options: { ...f.options, [o.id]: e.target.value } }))}
                                                    disabled={disabled}
                                                />
                                            </Field>
                                        </li>
                                    );
                                })}
                            </ul>
                        </fieldset>
                    )}
                </div>
            </Panel>

            <Panel title="GST" icon={Landmark} description="Whether travelers pay GST on this experience.">
                <div className="space-y-4">
                    <Switch
                        checked={form.gst.enabled}
                        onChange={(on) => setGst({ enabled: on })}
                        label="Charge GST"
                        description="Travelers see a GST line before they pay and on their receipt."
                        disabled={disabled}
                    />
                    {form.gst.enabled && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
                            <Field label="GST rate">
                                <SelectInput
                                    value={String(form.gst.rate_pct)}
                                    onChange={(e) => setGst({ rate_pct: Number(e.target.value) })}
                                    options={GST_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
                                    disabled={disabled}
                                />
                            </Field>
                            <Switch
                                checked={form.gst.inclusive}
                                onChange={(on) => setGst({ inclusive: on })}
                                label="Price includes GST"
                                description={form.gst.inclusive ? "The price above already includes GST." : "GST is added on top of the price."}
                                disabled={disabled}
                                className="sm:pt-7"
                            />
                        </div>
                    )}
                    <p className="rounded-control border border-line bg-surface-muted px-3.5 py-2.5 text-sm font-medium tabular-nums text-ink" aria-live="polite">
                        {gstExample(examplePrice, form.gst)}
                    </p>
                    <p className="text-xs text-ink-muted">SeekKrr's commission is on the price before GST, with or without GST. GST is never commissioned or paid to the business.</p>
                </div>
            </Panel>

            {dirty && errors.length > 0 && (
                <Notice tone="warn" title="Fix these before saving">
                    <ul className="list-disc pl-4">
                        {errors.map((e) => (
                            <li key={e}>{e}</li>
                        ))}
                    </ul>
                </Notice>
            )}
            <SaveBar dirty={dirty && canEdit} saving={save.isPending} invalid={errors.length > 0} onSave={() => save.mutate()} onDiscard={reset} saveLabel="Save prices" />
        </div>
    );
}
