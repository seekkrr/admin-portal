import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, Pencil, Play, Save, Store } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, SelectInput, Switch, TextArea, TextInput } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { isRouteMissing } from "@/services/optional";
import { errorMessage } from "@/utils/errors";
import { formatDate, formatDateTime, toDate } from "@/utils/date";
import { isoToLocalInput, localInputToIso } from "@/features/collabs/utils";
import { businessOffersService, rewardText, ruleText, type AdminOfferPatch, type BusinessOffer } from "../services/business-offers.service";

const PAGE_SIZE = 20;

const idOf = (o: BusinessOffer) => o.id ?? o._id;
const isExpired = (o: BusinessOffer) => {
    const d = toDate(o.expires_at);
    return !!d && d.getTime() < Date.now();
};

function saveError(e: unknown): string {
    return isRouteMissing(e) ? "Editing offers isn't available on this server yet." : errorMessage(e, "Couldn't save the offer");
}

function OfferStatus({ offer }: { offer: BusinessOffer }) {
    if (!offer.is_active) return <StatusPill status="paused" />;
    if (isExpired(offer)) return <StatusPill status="expired" />;
    return <StatusPill status="active" />;
}

function EditOfferModal({ offer, onClose }: { offer: BusinessOffer; onClose: () => void }) {
    const queryClient = useQueryClient();
    const isProduct = offer.reward_type === "product";
    const initialTitle = (isProduct ? offer.product_details?.title || offer.product_name : offer.title) ?? "";
    const initialDescription = (isProduct ? offer.product_details?.description : offer.description) ?? "";
    const [rewardType, setRewardType] = useState<"flat" | "product">(isProduct ? "product" : "flat");
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [ruleType, setRuleType] = useState<"quantitative" | "qualitative">(offer.rule_type === "qualitative" ? "qualitative" : "quantitative");
    const [triggerN, setTriggerN] = useState(String(offer.trigger_n || 1));
    const [discount, setDiscount] = useState(offer.flat_discount_value?.toString() ?? "");
    const [active, setActive] = useState(offer.is_active);
    const [expiresAt, setExpiresAt] = useState(isoToLocalInput(offer.expires_at ?? null));

    const n = Number.parseInt(triggerN, 10);
    const nInvalid = !Number.isFinite(n) || n < 1 || n > 1000;
    const d = Number(discount);
    const discountInvalid = rewardType === "flat" && (discount.trim() === "" || !Number.isFinite(d) || d <= 0 || d > 100000);
    const titleInvalid = rewardType === "product" && !title.trim();

    const patch: AdminOfferPatch = {};
    if (rewardType !== (isProduct ? "product" : "flat")) patch.reward_type = rewardType;
    if (title.trim() !== initialTitle.trim()) patch.title = title.trim() || null;
    if (description.trim() !== initialDescription.trim()) patch.description = description.trim() || null;
    if (ruleType !== (offer.rule_type === "qualitative" ? "qualitative" : "quantitative")) patch.rule_type = ruleType;
    if (!nInvalid && n !== offer.trigger_n) patch.trigger_n = n;
    if (rewardType === "flat" && !discountInvalid && d !== offer.flat_discount_value) patch.flat_discount_value = d;
    if (active !== offer.is_active) patch.active = active;
    const newExpiry = localInputToIso(expiresAt);
    if (expiresAt !== isoToLocalInput(offer.expires_at ?? null)) patch.expires_at = newExpiry;
    const dirty = Object.keys(patch).length > 0;

    const save = useMutation({
        mutationFn: () => businessOffersService.update(idOf(offer), patch),
        onSuccess: () => {
            toast.success("Offer saved");
            queryClient.invalidateQueries({ queryKey: ["admin-business-offers"] });
            onClose();
        },
        onError: (e) => toast.error(saveError(e)),
    });

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!save.isPending}
            title="Edit check-in offer"
            description={rewardText(offer)}
            icon={Pencil}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" icon={Save} onClick={() => save.mutate()} disabled={!dirty || nInvalid || discountInvalid || titleInvalid} loading={save.isPending}>
                        Save offer
                    </Button>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Reward">
                    <SelectInput value={rewardType} onChange={(e) => setRewardType(e.target.value as "flat" | "product")}>
                        <option value="flat">Money off (₹)</option>
                        <option value="product">Free product</option>
                    </SelectInput>
                </Field>
                {rewardType === "flat" ? (
                    <Field label="Discount (₹)" required error={discount.trim() && discountInvalid ? "₹1 – ₹1,00,000." : undefined}>
                        <TextInput type="number" min={1} max={100000} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                    </Field>
                ) : (
                    <div className="hidden sm:block" />
                )}
                <Field label="Unlocks on">
                    <SelectInput value={ruleType} onChange={(e) => setRuleType(e.target.value as "quantitative" | "qualitative")}>
                        <option value="quantitative">Every Nth check-in</option>
                        <option value="qualitative">Every Nth new visitor</option>
                    </SelectInput>
                </Field>
                <Field label="N" required error={nInvalid ? "1–1000." : undefined} hint={nInvalid ? undefined : ruleText({ rule_type: ruleType, trigger_n: n })}>
                    <TextInput type="number" min={1} max={1000} inputMode="numeric" value={triggerN} onChange={(e) => setTriggerN(e.target.value)} />
                </Field>
            </div>
            <Field
                label={rewardType === "product" ? "Product" : "Title"}
                required={rewardType === "product"}
                hint={rewardType === "product" ? "Shown as “Free <product>”." : "Optional. Shown on the reward instead of “₹… off”."}
                error={titleInvalid ? "Name the product." : undefined}
            >
                <TextInput type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Description" hint="Optional.">
                <TextArea maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Expires" hint="Blank = never. After this the offer stops unlocking rewards.">
                    <TextInput type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </Field>
                <div className="sm:pt-7">
                    <Switch checked={active} onChange={setActive} label="Active" description="Switched off, nobody can unlock it." />
                </div>
            </div>
        </Modal>
    );
}

export function BusinessOffersPage() {
    const queryClient = useQueryClient();
    const { state, set } = useUrlState({ page: 1 });
    const page = Math.max(1, state.page);
    const [editing, setEditing] = useState<BusinessOffer | null>(null);
    const [pausing, setPausing] = useState<BusinessOffer | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-business-offers", page],
        queryFn: () => businessOffersService.list(page, PAGE_SIZE),
        placeholderData: (prev) => prev,
    });

    const toggle = useMutation({
        mutationFn: (o: BusinessOffer) => businessOffersService.update(idOf(o), { active: !o.is_active }),
        onSuccess: (_r, o) => {
            toast.success(o.is_active ? "Offer switched off" : "Offer switched on");
            setPausing(null);
            queryClient.invalidateQueries({ queryKey: ["admin-business-offers"] });
        },
        onError: (e) => {
            toast.error(saveError(e));
            setPausing(null);
        },
    });

    const offers = data?.offers ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

    const onToggle = (o: BusinessOffer) => (o.is_active ? setPausing(o) : toggle.mutate(o));

    const columns: DataColumn<BusinessOffer>[] = [
        {
            id: "reward",
            header: "Reward",
            hideable: false,
            sortValue: (o) => rewardText(o),
            cell: (o) => (
                <div className="min-w-0">
                    <div className="font-medium text-ink">{rewardText(o)}</div>
                    {(o.product_details?.description || o.description) && (
                        <div className="max-w-[280px] truncate text-xs text-ink-faint">{o.product_details?.description || o.description}</div>
                    )}
                </div>
            ),
        },
        { id: "rule", header: "Unlocks on", sortValue: (o) => o.trigger_n, csv: (o) => ruleText(o), cell: (o) => <span className="text-ink-muted">{ruleText(o)}</span> },
        { id: "place", header: "Place", csv: (o) => o.marker_id, cell: (o) => <IdLink kind="place" id={o.marker_id} /> },
        {
            id: "status",
            header: "Status",
            sortValue: (o) => (o.is_active ? (isExpired(o) ? 1 : 0) : 2),
            csv: (o) => (!o.is_active ? "Paused" : isExpired(o) ? "Expired" : "Active"),
            cell: (o) => <OfferStatus offer={o} />,
        },
        {
            id: "expires",
            header: "Expires",
            sortValue: (o) => o.expires_at ?? "",
            csv: (o) => (o.expires_at ? formatDateTime(o.expires_at) : "Never"),
            cell: (o) => <span className="whitespace-nowrap text-ink-muted">{o.expires_at ? formatDateTime(o.expires_at) : "Never"}</span>,
        },
        {
            id: "created",
            header: "Created",
            sortValue: (o) => o.created_at ?? "",
            csv: (o) => formatDate(o.created_at),
            cell: (o) => <span className="whitespace-nowrap text-ink-muted">{formatDate(o.created_at)}</span>,
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Store}
                title="Check-in offers"
                description={
                    <>
                        Rewards businesses give explorers who check in at their places
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
            />

            <DataTable
                label="Check-in offers"
                rows={offers}
                columns={columns}
                rowKey={idOf}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Store, title: "No check-in offers yet", description: "Businesses add them from the Partner Portal." }}
                onRowClick={setEditing}
                rowActions={(o) => (
                    <>
                        <div className="hidden items-center gap-0.5 md:flex">
                            <IconButton icon={Pencil} size="sm" label={`Edit ${rewardText(o)}`} onClick={() => setEditing(o)} />
                            <IconButton
                                icon={o.is_active ? Pause : Play}
                                size="sm"
                                label={o.is_active ? `Switch off ${rewardText(o)}` : `Switch on ${rewardText(o)}`}
                                loading={toggle.isPending && toggle.variables === o}
                                onClick={() => onToggle(o)}
                            />
                        </div>
                        <div className="md:hidden">
                            <Menu
                                label={`Actions for ${rewardText(o)}`}
                                triggerVariant="ghost"
                                size="sm"
                                items={[
                                    { label: "Edit", icon: Pencil, onSelect: () => setEditing(o) },
                                    { label: o.is_active ? "Switch off" : "Switch on", icon: o.is_active ? Pause : Play, danger: o.is_active, onSelect: () => onToggle(o) },
                                ]}
                            />
                        </div>
                    </>
                )}
                storageKey="check-in-offers"
                exportName="check-in-offers"
                summary={data ? `${offers.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{ title: (o) => rewardText(o), subtitle: (o) => ruleText(o), fields: ["status", "place", "expires", "created"] }}
                footer={data && <Pagination page={page} totalPages={totalPages} total={data.total} pageSize={PAGE_SIZE} onPageChange={(p) => set({ page: p })} />}
            />

            {editing && <EditOfferModal key={idOf(editing)} offer={editing} onClose={() => setEditing(null)} />}

            <ConfirmDialog
                open={!!pausing}
                title="Switch off this offer?"
                description={pausing ? `“${rewardText(pausing)}” stops unlocking for explorers. You can switch it back on any time.` : undefined}
                confirmLabel="Switch off"
                tone="warning"
                isPending={toggle.isPending}
                onConfirm={() => pausing && toggle.mutate(pausing)}
                onCancel={() => setPausing(null)}
            />
        </div>
    );
}
