import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Pencil } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Button, IconButton } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";
import { Field, SelectInput, Switch, TextArea, TextInput } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { SectionState } from "@/components/detail/DetailStates";
import { markersService } from "@/features/markers/services/markers.service";
import { businessDetailApi } from "@/services/admin-detail.service";
import { formatDate } from "@/utils/date";
import type { BusinessOffer, OfferPatch } from "@/types/admin-detail";
import type { AdminBusiness } from "../../types";

interface OfferRow extends BusinessOffer {
    placeName: string;
}

function ruleText(o: BusinessOffer): string {
    const n = o.trigger_n ?? 1;
    return o.rule_type === "qualitative" ? `On a qualifying visit` : n <= 1 ? "Every check-in" : `Every ${n} check-ins`;
}

function rewardText(o: BusinessOffer): string {
    if (o.reward_type === "product") return o.product_details?.title || "Free item";
    return o.flat_discount_value ? `₹${o.flat_discount_value} off` : "Discount";
}

interface OfferForm {
    rule_type: "quantitative" | "qualitative";
    trigger_n: string;
    reward_type: "flat" | "product";
    flat_discount_value: string;
    product_title: string;
    product_description: string;
}

function formOf(o: BusinessOffer): OfferForm {
    return {
        rule_type: o.rule_type === "qualitative" ? "qualitative" : "quantitative",
        trigger_n: String(o.trigger_n ?? 1),
        reward_type: o.reward_type === "product" ? "product" : "flat",
        flat_discount_value: o.flat_discount_value ? String(o.flat_discount_value) : "",
        product_title: o.product_details?.title ?? "",
        product_description: o.product_details?.description ?? "",
    };
}

/** Check-in offers at the business's places; edit or turn them off. */
export function BusinessOffersTab({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const ids = business.marker_ids;
    const [editing, setEditing] = useState<OfferRow | null>(null);
    const [form, setForm] = useState<OfferForm | null>(null);

    const places = useQueries({
        queries: ids.map((id) => ({ queryKey: ["marker-detail", id], queryFn: () => markersService.getById(id), staleTime: 5 * 60_000, retry: false })),
    });
    const offers = useQueries({
        queries: ids.map((id) => ({ queryKey: ["place-offers", id], queryFn: () => businessDetailApi.offersForPlace(id), staleTime: 30_000, retry: false })),
    });

    const rows: OfferRow[] = ids.flatMap((id, i) =>
        (offers[i]?.data ?? []).map((o) => ({ ...o, placeName: places[i]?.data?.title ?? id }))
    );
    const isLoading = offers.some((q) => q.isLoading);
    const error = offers.find((q) => q.error)?.error ?? null;

    const save = useMutation({
        mutationFn: ({ offer, patch }: { offer: BusinessOffer; patch: OfferPatch }) => businessDetailApi.patchOffer(offer._id, patch),
        onSuccess: (_, { offer, patch }) => {
            toast.success(patch.is_active === undefined ? "Offer saved" : patch.is_active ? "Offer turned on" : "Offer turned off");
            queryClient.invalidateQueries({ queryKey: ["place-offers", offer.marker_id] });
            queryClient.invalidateQueries({ queryKey: ["admin-business-offers"] });
            setEditing(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const openEdit = (o: OfferRow) => {
        setEditing(o);
        setForm(formOf(o));
    };

    const formPatch = (): OfferPatch | null => {
        if (!form) return null;
        const n = Number.parseInt(form.trigger_n, 10);
        if (!Number.isFinite(n) || n < 1) return null;
        const patch: OfferPatch = { rule_type: form.rule_type, trigger_n: n, reward_type: form.reward_type };
        if (form.reward_type === "flat") {
            const v = Number(form.flat_discount_value);
            if (!Number.isFinite(v) || v <= 0) return null;
            patch.flat_discount_value = v;
        } else {
            if (!form.product_title.trim()) return null;
            patch.product_details = { title: form.product_title.trim(), description: form.product_description.trim() || null };
        }
        return patch;
    };
    const patch = formPatch();

    const columns: DataColumn<OfferRow>[] = [
        { id: "reward", header: "Reward", hideable: false, sortValue: (o) => rewardText(o), cell: (o) => <span className="font-medium text-ink">{rewardText(o)}</span> },
        { id: "rule", header: "When", sortValue: (o) => o.trigger_n, cell: (o) => <span className="text-ink-muted">{ruleText(o)}</span> },
        {
            id: "place",
            header: "Place",
            sortValue: (o) => o.placeName,
            cell: (o) => (
                <Link to={`/markers/${o.marker_id}`} className="text-accent-700 hover:underline">
                    {o.placeName}
                </Link>
            ),
        },
        {
            id: "active",
            header: "On",
            cell: (o) => (
                <Switch
                    size="sm"
                    hideLabel
                    checked={o.is_active}
                    label={`${rewardText(o)} at ${o.placeName}`}
                    disabled={!canEdit || save.isPending}
                    onChange={(on) => save.mutate({ offer: o, patch: { is_active: on } })}
                />
            ),
        },
        { id: "created", header: "Created", sortValue: (o) => o.created_at ?? "", cell: (o) => <span className="text-ink-muted">{formatDate(o.created_at)}</span> },
    ];

    return (
        <>
            <Panel title="Check-in offers" icon={Gift} description="Rewards travellers unlock by checking in at this business's places." bodyClassName="p-0">
                <SectionState isLoading={isLoading} error={error} what="Check-in offers" onRetry={() => offers.forEach((q) => q.refetch())}>
                    <DataTable
                        label="Check-in offers"
                        rows={rows}
                        columns={columns}
                        rowKey={(o) => o._id}
                        toolbar={false}
                        frame="bare"
                        empty={{ icon: Gift, title: ids.length ? "No check-in offers yet" : "Link a place first" }}
                        card={{ title: rewardText, subtitle: (o) => o.placeName, fields: ["rule", "active", "created"] }}
                        rowActions={canEdit ? (o) => <IconButton icon={Pencil} size="sm" label={`Edit ${rewardText(o)}`} onClick={() => openEdit(o)} /> : undefined}
                    />
                </SectionState>
            </Panel>

            <Drawer
                open={!!editing && !!form}
                onClose={() => setEditing(null)}
                dismissible={!save.isPending}
                title="Edit offer"
                subtitle={editing?.placeName}
                width="md"
                footer={
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={() => setEditing(null)} disabled={save.isPending}>
                            Cancel
                        </Button>
                        <Button variant="primary" disabled={!patch} loading={save.isPending} onClick={() => editing && patch && save.mutate({ offer: editing, patch })}>
                            Save offer
                        </Button>
                    </div>
                }
            >
                {form && (
                    <div className="space-y-4">
                        <Field label="When it unlocks">
                            <SelectInput
                                value={form.rule_type}
                                onChange={(e) => setForm({ ...form, rule_type: e.target.value as OfferForm["rule_type"] })}
                                options={[
                                    { value: "quantitative", label: "After a number of check-ins" },
                                    { value: "qualitative", label: "On a qualifying visit" },
                                ]}
                            />
                        </Field>
                        <Field label="Check-ins needed" hint="1 = every check-in.">
                            <TextInput type="number" min={1} inputMode="numeric" value={form.trigger_n} onChange={(e) => setForm({ ...form, trigger_n: e.target.value })} />
                        </Field>
                        <Field label="Reward">
                            <SelectInput
                                value={form.reward_type}
                                onChange={(e) => setForm({ ...form, reward_type: e.target.value as OfferForm["reward_type"] })}
                                options={[
                                    { value: "flat", label: "Money off (₹)" },
                                    { value: "product", label: "A free item" },
                                ]}
                            />
                        </Field>
                        {form.reward_type === "flat" ? (
                            <Field label="Amount off (₹)" required>
                                <TextInput
                                    type="number"
                                    min={1}
                                    inputMode="decimal"
                                    value={form.flat_discount_value}
                                    onChange={(e) => setForm({ ...form, flat_discount_value: e.target.value })}
                                />
                            </Field>
                        ) : (
                            <>
                                <Field label="Item" required>
                                    <TextInput value={form.product_title} onChange={(e) => setForm({ ...form, product_title: e.target.value })} maxLength={120} placeholder="e.g. A free masala chai" />
                                </Field>
                                <Field label="Details">
                                    <TextArea value={form.product_description} onChange={(e) => setForm({ ...form, product_description: e.target.value })} rows={3} maxLength={500} />
                                </Field>
                            </>
                        )}
                        {editing && (
                            <p className="text-xs text-ink-faint">
                                Currently {editing.is_active ? <Tag tone="good">On</Tag> : <Tag>Off</Tag>} — use the switch in the list to turn it on or off.
                            </p>
                        )}
                    </div>
                )}
            </Drawer>
        </>
    );
}
