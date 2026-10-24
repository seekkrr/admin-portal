import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Pencil, RefreshCcw, Plus, Ticket, Receipt, Save, Layers } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, TextInput } from "@/components/ui/Field";
import { PanelState } from "@/components/ui/States";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDate, formatDateTime } from "@/utils/date";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { EntitlementsSummary, PlanEntitlementsEditor } from "../components/EntitlementsEditor";
import { OverridePanel } from "../components/OverridePanel";
import { Notice } from "../components/AdminBits";
import { formatInr, humanize, isoToLocalInput, localInputToIso, totalPagesOf } from "../utils";
import type { AdminPlan, AdminSubscription, BillingCoupon, Entitlements, UpdatePlanPayload, UpsertBillingCouponPayload } from "../types";

type Tab = "plans" | "coupons" | "subscriptions";
const TABS: Tab[] = ["plans", "coupons", "subscriptions"];

// ── Plans ──────────────────────────────────────────────────

function intOrUndefined(v: string): number | undefined {
    if (v.trim() === "") return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function PlanEditModal({ plan, onClose }: { plan: AdminPlan; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState(plan.name ?? "");
    const [monthly, setMonthly] = useState(plan.price_monthly_inr?.toString() ?? "");
    const [annual, setAnnual] = useState(plan.price_annual_inr?.toString() ?? "");
    const [trialDays, setTrialDays] = useState(String(plan.trial_days ?? 0));
    const [sort, setSort] = useState("");
    const [active, setActive] = useState(plan.active);
    const [entitlements, setEntitlements] = useState<Entitlements>(plan.entitlements);

    const trial = intOrUndefined(trialDays);
    const trialInvalid = trial === undefined || trial > 90;

    const save = useMutation({
        mutationFn: () => {
            const payload: UpdatePlanPayload = { active, entitlements };
            if (name.trim()) payload.name = name.trim();
            const m = intOrUndefined(monthly);
            const a = intOrUndefined(annual);
            if (m !== undefined) payload.price_monthly_inr = m;
            if (a !== undefined) payload.price_annual_inr = a;
            if (trial !== undefined) payload.trial_days = trial;
            const s = sort.trim() === "" ? undefined : Number.parseInt(sort, 10);
            if (s !== undefined && Number.isFinite(s)) payload.sort = s;
            return collabsAdminService.updatePlan(plan.code, payload);
        },
        onSuccess: () => {
            toast.success(`${plan.name ?? plan.code} saved`);
            queryClient.invalidateQueries({ queryKey: ["collabs-plans"] });
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to save plan"),
    });

    const priceChanged = monthly !== (plan.price_monthly_inr?.toString() ?? "") || annual !== (plan.price_annual_inr?.toString() ?? "");

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!save.isPending}
            title={`Edit plan · ${plan.code}`}
            icon={Layers}
            size="2xl"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" icon={Save} onClick={() => save.mutate()} disabled={trialInvalid} loading={save.isPending}>
                        Save plan
                    </Button>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Display name">
                    <TextInput type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Sort order" hint="Optional; lower shows first.">
                    <TextInput type="number" value={sort} onChange={(e) => setSort(e.target.value)} placeholder="Keep" />
                </Field>
                <Field label="Monthly price (₹, ex-GST)" hint={plan.custom ? "Custom plan — shown as “Contact us”." : undefined}>
                    <TextInput type="number" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} />
                </Field>
                <Field label="Annual price (₹, ex-GST)" hint="Annual = 2 months free by convention.">
                    <TextInput type="number" min={0} value={annual} onChange={(e) => setAnnual(e.target.value)} />
                </Field>
                <Field label="Trial days" error={trialInvalid ? "0–90 days." : undefined}>
                    <TextInput type="number" min={0} max={90} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
                </Field>
                <div className="sm:pt-7">
                    <Checkbox checked={active} onChange={setActive} label="Active" hint="Inactive plans are hidden from pricing and checkout." />
                </div>
            </div>
            {priceChanged && !plan.custom && <Notice tone="warn">Price changed — run “Sync to Razorpay” after saving so checkout uses the new amount.</Notice>}
            <Field label="Entitlements" hint="Unlimited = no cap. Limits apply per business per month where relevant.">
                <PlanEntitlementsEditor value={entitlements} onChange={setEntitlements} />
            </Field>
        </Modal>
    );
}

function PlansTab() {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState<AdminPlan | null>(null);
    const [syncing, setSyncing] = useState<AdminPlan | null>(null);
    const { data, isLoading, error, refetch } = useQuery({ queryKey: ["collabs-plans"], queryFn: collabsAdminService.listPlans });

    const sync = useMutation({
        mutationFn: (code: string) => collabsAdminService.syncPlanToRazorpay(code),
        onSuccess: (plan) => {
            toast.success(`${plan.name ?? plan.code} synced to Razorpay`);
            setSyncing(null);
            queryClient.invalidateQueries({ queryKey: ["collabs-plans"] });
        },
        onError: (e: Error) => toast.error(e.message || "Razorpay sync failed"),
    });

    const plans = data ?? [];
    return (
        <>
            <PanelState isLoading={isLoading} error={error} isEmpty={plans.length === 0} emptyIcon={Layers} emptyText="No plans configured" onRetry={() => refetch()}>
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {plans.map((p) => (
                        <li key={p.code} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
                            <div className="flex-1 space-y-3 p-5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold text-ink">{p.name ?? p.code}</h2>
                                        <p className="font-mono text-xs text-ink-faint">{p.code}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <StatusPill status={p.active ? "active" : "paused"} label={p.active ? "Active" : "Inactive"} />
                                        {p.custom && <Tag tone="info">Custom</Tag>}
                                    </div>
                                </div>
                                <div>
                                    {p.custom || p.price_monthly_inr === null ? (
                                        <p className="text-2xl font-semibold text-ink">Contact us</p>
                                    ) : (
                                        <>
                                            <p className="text-2xl font-semibold tabular-nums text-ink">
                                                {formatInr(p.price_monthly_inr)}
                                                <span className="text-sm font-medium text-ink-muted"> /mo + GST</span>
                                            </p>
                                            <p className="text-xs text-ink-muted">
                                                {formatInr(p.price_annual_inr)}/yr · incl. GST {formatInr(p.price_monthly_inr_incl_gst)}/mo
                                            </p>
                                        </>
                                    )}
                                    {p.trial_days > 0 && <p className="mt-1 text-xs text-accent-700">{p.trial_days}-day free trial</p>}
                                </div>
                                <EntitlementsSummary value={p.entitlements} />
                                <div className="space-y-0.5 border-t border-line pt-2 text-xs text-ink-muted">
                                    <p>
                                        Razorpay monthly: <span className="font-mono">{p.razorpay_plan_ids?.monthly ?? "not synced"}</span>
                                    </p>
                                    <p>
                                        Razorpay annual: <span className="font-mono">{p.razorpay_plan_ids?.annual ?? "not synced"}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={RefreshCcw}
                                    onClick={() => setSyncing(p)}
                                    disabled={p.custom}
                                    title={p.custom ? "Custom plans aren't sold via Razorpay" : undefined}
                                >
                                    Sync to Razorpay
                                </Button>
                                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(p)}>
                                    Edit
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            </PanelState>
            {editing && <PlanEditModal key={editing.code} plan={editing} onClose={() => setEditing(null)} />}
            <ConfirmDialog
                open={!!syncing}
                tone="warning"
                title="Sync to Razorpay?"
                description={
                    syncing
                        ? `Create/refresh the Razorpay plans for “${syncing.name ?? syncing.code}” at ${formatInr(syncing.price_monthly_inr)}/mo and ${formatInr(
                              syncing.price_annual_inr
                          )}/yr (+GST). New checkouts use the new plan ids; existing subscriptions keep theirs.`
                        : ""
                }
                confirmLabel="Sync"
                onConfirm={() => syncing && sync.mutate(syncing.code)}
                onCancel={() => setSyncing(null)}
                isPending={sync.isPending}
            />
        </>
    );
}

// ── Coupons ────────────────────────────────────────────────

function CouponModal({ coupon, plans, onClose }: { coupon: BillingCoupon | null; plans: AdminPlan[]; onClose: () => void }) {
    const queryClient = useQueryClient();
    const isNew = !coupon;
    const [code, setCode] = useState(coupon?.code ?? "");
    const [description, setDescription] = useState(coupon?.description ?? "");
    const [offerId, setOfferId] = useState(coupon?.razorpay_offer_id ?? "");
    const [planCodes, setPlanCodes] = useState<string[]>(coupon?.plans ?? []);
    const [maxRedemptions, setMaxRedemptions] = useState(coupon?.max_redemptions?.toString() ?? "");
    const [expiresAt, setExpiresAt] = useState(isoToLocalInput(coupon?.expires_at));
    const [active, setActive] = useState(coupon?.active ?? true);

    const codeInvalid = code.trim().length < 2 || code.trim().length > 30;
    const maxN = maxRedemptions.trim() === "" ? null : Number.parseInt(maxRedemptions, 10);
    const maxInvalid = maxN !== null && (!Number.isFinite(maxN) || maxN < 1);

    const save = useMutation({
        mutationFn: () => {
            const payload: UpsertBillingCouponPayload = {
                code: code.trim().toUpperCase(),
                description: description.trim() || null,
                razorpay_offer_id: offerId.trim() || null,
                plans: planCodes,
                max_redemptions: maxN,
                expires_at: localInputToIso(expiresAt),
                active,
            };
            return collabsAdminService.upsertCoupon(payload);
        },
        onSuccess: (c) => {
            toast.success(`Coupon ${c.code} saved`);
            queryClient.invalidateQueries({ queryKey: ["collabs-billing-coupons"] });
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to save coupon"),
    });

    const togglePlan = (c: string) => setPlanCodes((prev) => (prev.includes(c) ? prev.filter((p) => p !== c) : [...prev, c]));

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!save.isPending}
            title={isNew ? "New plan coupon" : `Edit coupon · ${coupon.code}`}
            icon={Ticket}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" icon={Save} onClick={() => save.mutate()} disabled={codeInvalid || maxInvalid} loading={save.isPending}>
                        Save coupon
                    </Button>
                </>
            }
        >
            <Field label="Code" required hint={isNew ? "2–30 characters; stored uppercase." : "Codes can't be renamed."}>
                <TextInput
                    type="text"
                    value={code}
                    disabled={!isNew}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase tracking-wider"
                    placeholder="BIRPILOT"
                />
            </Field>
            <Field label="Description">
                <TextInput type="text" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Razorpay offer id" hint="Create the offer in the Razorpay dashboard, then paste its id.">
                <TextInput type="text" maxLength={60} value={offerId} onChange={(e) => setOfferId(e.target.value)} className="font-mono" placeholder="offer_…" />
            </Field>
            <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Valid for plans</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {plans
                        .filter((p) => !p.custom)
                        .map((p) => (
                            <Checkbox key={p.code} checked={planCodes.includes(p.code)} onChange={() => togglePlan(p.code)} label={p.name ?? p.code} />
                        ))}
                </div>
                <p className="mt-1 text-xs text-ink-faint">None selected = any paid plan.</p>
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Max redemptions" error={maxInvalid ? "Must be at least 1." : undefined} hint="Blank = unlimited.">
                    <TextInput type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
                </Field>
                <Field label="Expires at" hint="Blank = never.">
                    <TextInput type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </Field>
            </div>
            <Checkbox checked={active} onChange={setActive} label="Active" />
        </Modal>
    );
}

function CouponsTab() {
    const [editing, setEditing] = useState<BillingCoupon | null | "new">(null);
    const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["collabs-billing-coupons"], queryFn: collabsAdminService.listCoupons });
    const plansQuery = useQuery({ queryKey: ["collabs-plans"], queryFn: collabsAdminService.listPlans, staleTime: 5 * 60 * 1000 });
    const coupons = data ?? [];

    const columns: DataColumn<BillingCoupon>[] = [
        {
            id: "code",
            header: "Code",
            hideable: false,
            sortValue: (c) => c.code,
            cell: (c) => (
                <div className="min-w-0">
                    <div className="font-mono font-semibold text-ink">{c.code}</div>
                    {c.description && <div className="text-xs text-ink-faint">{c.description}</div>}
                </div>
            ),
        },
        {
            id: "plans",
            header: "Plans",
            csv: (c) => (c.plans.length ? c.plans.join(", ") : "Any"),
            cell: (c) => (
                <div className="flex flex-wrap gap-1">
                    {c.plans.length ? c.plans.map((p) => <Tag key={p}>{humanize(p)}</Tag>) : <span className="text-xs text-ink-faint">Any</span>}
                </div>
            ),
        },
        {
            id: "redemptions",
            header: "Redemptions",
            align: "right",
            sortValue: (c) => c.redemptions,
            csv: (c) => `${c.redemptions}${c.max_redemptions !== null ? ` / ${c.max_redemptions}` : ""}`,
            cell: (c) => (
                <span className="tabular-nums text-ink-muted">
                    {c.redemptions}
                    {c.max_redemptions !== null ? ` / ${c.max_redemptions}` : ""}
                </span>
            ),
        },
        {
            id: "expires",
            header: "Expires",
            sortValue: (c) => c.expires_at ?? "",
            csv: (c) => (c.expires_at ? formatDateTime(c.expires_at) : "Never"),
            cell: (c) => <span className="whitespace-nowrap text-ink-muted">{c.expires_at ? formatDateTime(c.expires_at) : "Never"}</span>,
        },
        { id: "offer", header: "Razorpay offer", csv: (c) => c.razorpay_offer_id ?? "", cell: (c) => <span className="font-mono text-xs text-ink-muted">{c.razorpay_offer_id ?? "—"}</span> },
        {
            id: "status",
            header: "Status",
            sortValue: (c) => c.active,
            csv: (c) => (c.active ? "Active" : "Inactive"),
            cell: (c) => <StatusPill status={c.active ? "active" : "paused"} label={c.active ? "Active" : "Inactive"} />,
        },
    ];

    return (
        <>
            <div className="flex justify-end">
                <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
                    New coupon
                </Button>
            </div>
            <DataTable
                label="Plan coupons"
                rows={coupons}
                columns={columns}
                rowKey={(c) => c.code}
                isLoading={isLoading}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Ticket, title: "No plan coupons yet" }}
                onRowClick={setEditing}
                rowActions={(c) => (
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(c)}>
                        Edit
                    </Button>
                )}
                storageKey="plan-coupons"
                exportName="plan-coupons"
                summary={data ? `${coupons.length} coupons` : undefined}
                card={{ title: (c) => c.code, subtitle: (c) => c.description ?? undefined, fields: ["status", "redemptions", "expires", "plans"] }}
            />
            {editing && (
                <CouponModal
                    key={editing === "new" ? "new" : editing.code}
                    coupon={editing === "new" ? null : editing}
                    plans={plansQuery.data ?? []}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}

// ── Subscriptions ──────────────────────────────────────────

const SUB_STATUS_OPTIONS: FilterOption[] = [
    { value: "trialing", label: "Trialing" },
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
    { value: "halted", label: "Halted" },
    { value: "cancelled", label: "Cancelled" },
    { value: "free", label: "Free" },
];

function SubscriptionsTab({ status, page, onStatus, onPage }: { status: string; page: number; onStatus: (v: string) => void; onPage: (p: number) => void }) {
    const [overriding, setOverriding] = useState<AdminSubscription | null>(null);
    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["collabs-subscriptions", status, page],
        queryFn: () => collabsAdminService.listSubscriptions({ status: status || undefined, page }),
        placeholderData: (prev) => prev,
    });
    const subs = data?.subscriptions ?? [];
    // Keep the open modal in sync with refreshed rows (after an override save).
    const current = overriding ? (subs.find((s) => s.business_id === overriding.business_id) ?? overriding) : null;

    const columns: DataColumn<AdminSubscription>[] = [
        {
            id: "business",
            header: "Business",
            hideable: false,
            sortValue: (s) => s.business_name ?? s.business_id,
            csv: (s) => s.business_name ?? s.business_id,
            cell: (s) => <IdLink kind="business" id={s.business_id} label={s.business_name ?? s.business_id} />,
        },
        { id: "plan", header: "Plan", sortValue: (s) => s.plan_code ?? "free", csv: (s) => humanize(s.plan_code ?? "free"), cell: (s) => humanize(s.plan_code ?? "free") },
        {
            id: "status",
            header: "Status",
            sortValue: (s) => s.status ?? "free",
            csv: (s) => `${s.status ?? "free"}${s.cancel_at_period_end ? " (cancels at period end)" : ""}`,
            cell: (s) => (
                <div className="flex flex-col items-start gap-1">
                    <StatusPill status={s.status ?? "free"} />
                    {s.cancel_at_period_end && <span className="text-xs text-bad">Cancels at period end</span>}
                </div>
            ),
        },
        { id: "period", header: "Period", sortValue: (s) => s.period ?? "", csv: (s) => s.period ?? "", cell: (s) => <span className="text-ink-muted">{s.period ? humanize(s.period) : "—"}</span> },
        {
            id: "renews",
            header: "Renews / trial ends",
            sortValue: (s) => (s.status === "trialing" ? s.trial_ends_at : s.current_period_end) ?? "",
            csv: (s) => (s.status === "trialing" ? `Trial → ${formatDate(s.trial_ends_at)}` : formatDate(s.current_period_end)),
            cell: (s) => (
                <span className="whitespace-nowrap text-ink-muted">{s.status === "trialing" ? `Trial → ${formatDate(s.trial_ends_at)}` : formatDate(s.current_period_end)}</span>
            ),
        },
        { id: "coupon", header: "Coupon", csv: (s) => s.coupon_code ?? "", cell: (s) => <span className="font-mono text-xs">{s.coupon_code ?? "—"}</span> },
        {
            id: "override",
            header: "Override",
            className: "max-w-[260px]",
            csv: (s) => (s.override ? `${s.override.plan_code ?? ""}${s.override.until ? ` until ${formatDate(s.override.until)}` : ""}` : ""),
            cell: (s) =>
                s.override ? (
                    <div className="space-y-1">
                        {s.override.plan_code && <Tag tone="warn">Plan → {humanize(s.override.plan_code)}</Tag>}
                        <EntitlementsSummary value={s.override.entitlements ?? {}} />
                        <div className="text-xs text-ink-faint">{s.override.until ? `until ${formatDate(s.override.until)}` : "no expiry"}</div>
                    </div>
                ) : (
                    <span className="text-xs text-ink-faint">—</span>
                ),
        },
    ];

    const chips: FilterChip[] = [];
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, SUB_STATUS_OPTIONS), onRemove: () => onStatus("") });

    return (
        <>
            <FilterBar chips={chips} onReset={() => onStatus("")}>
                <FilterSelect label="Status" value={status} onChange={onStatus} options={SUB_STATUS_OPTIONS} allLabel="All statuses" />
            </FilterBar>
            <DataTable
                label="Subscriptions"
                rows={subs}
                columns={columns}
                rowKey={(s) => s.business_id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Receipt, title: "No subscriptions found", description: status ? "Try clearing the filter." : undefined }}
                rowActions={(s) => (
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setOverriding(s)}>
                        Override
                    </Button>
                )}
                storageKey="subscriptions"
                exportName="subscriptions"
                summary={data ? `${subs.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{ title: (s) => s.business_name ?? s.business_id, subtitle: (s) => humanize(s.plan_code ?? "free"), fields: ["status", "renews", "coupon", "override"] }}
                footer={data && <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} pageSize={data.page_size} onPageChange={onPage} />}
            />
            <Modal open={!!current} onClose={() => setOverriding(null)} title={`Plan override · ${current?.business_name ?? ""}`} icon={Receipt} size="2xl">
                {current && <OverridePanel businessId={current.business_id} current={current.override} currentPlanCode={current.plan_code} />}
            </Modal>
        </>
    );
}

export function PlansBillingPage() {
    const { isAdmin } = useCollabAccess();
    const { state, set } = useUrlState({ tab: "plans", status: "", page: 1 });
    const tab: Tab = TABS.includes(state.tab as Tab) ? (state.tab as Tab) : "plans";
    const subStatus = SUB_STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "";

    if (!isAdmin) return <AccessDenied message="Only admins can manage plans and billing." />;

    return (
        <div className="space-y-5">
            <PageHeader icon={CreditCard} title="Plans and billing" description="Business plans (INR + GST via Razorpay), plan coupons and subscriptions" />
            <Tabs<Tab>
                label="Billing sections"
                value={tab}
                onChange={(v) => set({ tab: v, status: "", page: 1 })}
                tabs={[
                    { value: "plans", label: "Plans" },
                    { value: "coupons", label: "Coupons" },
                    { value: "subscriptions", label: "Subscriptions" },
                ]}
            />
            {tab === "plans" && <PlansTab />}
            {tab === "coupons" && <CouponsTab />}
            {tab === "subscriptions" && (
                <SubscriptionsTab status={subStatus} page={Math.max(1, state.page)} onStatus={(v) => set({ status: v })} onPage={(p) => set({ page: p })} />
            )}
        </div>
    );
}
