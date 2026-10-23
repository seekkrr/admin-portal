import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Pencil, RefreshCcw, Plus, Ticket, Receipt, Save, Filter, Layers } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { FilterDropdown, type DropdownOption } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/Card";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import {
    Checkbox, Chip, Field, LoadingButtonIcon, Modal, PageHeader, PanelState, SegmentedTabs, StatusPill, Toolbar,
    btnPrimary, btnSecondary, btnSmNeutral, inputClass, thClass,
} from "../components/CollabsUi";
import { EntitlementsSummary, PlanEntitlementsEditor } from "../components/EntitlementsEditor";
import { OverridePanel } from "../components/OverridePanel";
import { fmtDate, fmtDateTime, formatInr, humanize, isoToLocalInput, localInputToIso, totalPagesOf } from "../utils";
import type { AdminPlan, AdminSubscription, BillingCoupon, Entitlements, UpdatePlanPayload, UpsertBillingCouponPayload } from "../types";

type Tab = "plans" | "coupons" | "subscriptions";

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
            onClose={() => !save.isPending && onClose()}
            title={`Edit plan · ${plan.code}`}
            icon={Layers}
            size="2xl"
            footer={
                <>
                    <button type="button" onClick={onClose} disabled={save.isPending} className={btnSecondary}>
                        Cancel
                    </button>
                    <button type="button" onClick={() => save.mutate()} disabled={save.isPending || trialInvalid} className={btnPrimary}>
                        <LoadingButtonIcon loading={save.isPending} icon={Save} /> Save plan
                    </button>
                </>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Display name" htmlFor="plan-name">
                    <input id="plan-name" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Sort order" htmlFor="plan-sort" hint="Optional; lower shows first.">
                    <input id="plan-sort" type="number" value={sort} onChange={(e) => setSort(e.target.value)} className={inputClass} placeholder="Keep" />
                </Field>
                <Field label="Monthly price (₹, ex-GST)" htmlFor="plan-monthly" hint={plan.custom ? "Custom plan — shown as “Contact us”." : undefined}>
                    <input id="plan-monthly" type="number" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Annual price (₹, ex-GST)" htmlFor="plan-annual" hint="Annual = 2 months free by convention.">
                    <input id="plan-annual" type="number" min={0} value={annual} onChange={(e) => setAnnual(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Trial days" htmlFor="plan-trial" hint={trialInvalid ? "0–90 days." : undefined}>
                    <input id="plan-trial" type="number" min={0} max={90} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className={inputClass} />
                </Field>
                <div className="pt-7">
                    <Checkbox checked={active} onChange={setActive} label="Active" hint="Inactive plans are hidden from pricing and checkout." />
                </div>
            </div>
            {priceChanged && !plan.custom && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    Price changed — run “Sync to Razorpay” after saving so checkout uses the new amount.
                </p>
            )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {plans.map((p) => (
                        <Card key={p.code} padding="none" className="overflow-hidden flex flex-col">
                            <div className="p-5 space-y-3 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="text-lg font-bold text-neutral-900">{p.name ?? p.code}</h3>
                                        <p className="text-[11px] font-mono text-neutral-400">{p.code}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <StatusPill status={p.active ? "active" : "paused"} label={p.active ? "Active" : "Inactive"} />
                                        {p.custom && <Chip tone="violet">Custom</Chip>}
                                    </div>
                                </div>
                                <div>
                                    {p.custom || p.price_monthly_inr === null ? (
                                        <p className="text-2xl font-extrabold text-neutral-900">Contact us</p>
                                    ) : (
                                        <>
                                            <p className="text-2xl font-extrabold text-neutral-900">
                                                {formatInr(p.price_monthly_inr)}
                                                <span className="text-sm font-medium text-neutral-500"> /mo + GST</span>
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {formatInr(p.price_annual_inr)}/yr · incl. GST {formatInr(p.price_monthly_inr_incl_gst)}/mo
                                            </p>
                                        </>
                                    )}
                                    {p.trial_days > 0 && <p className="text-xs text-teal-700 mt-1">{p.trial_days}-day free trial</p>}
                                </div>
                                <EntitlementsSummary value={p.entitlements} />
                                <div className="text-[11px] text-neutral-500 space-y-0.5 pt-2 border-t border-neutral-100">
                                    <p>Razorpay monthly: <span className="font-mono">{p.razorpay_plan_ids?.monthly ?? "not synced"}</span></p>
                                    <p>Razorpay annual: <span className="font-mono">{p.razorpay_plan_ids?.annual ?? "not synced"}</span></p>
                                </div>
                            </div>
                            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex justify-end gap-2">
                                <button type="button" onClick={() => setSyncing(p)} disabled={p.custom} className={btnSmNeutral} title={p.custom ? "Custom plans aren't sold via Razorpay" : undefined}>
                                    <RefreshCcw className="w-3.5 h-3.5" /> Sync to Razorpay
                                </button>
                                <button type="button" onClick={() => setEditing(p)} className={btnSmNeutral}>
                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            </PanelState>
            {editing && <PlanEditModal key={editing.code} plan={editing} onClose={() => setEditing(null)} />}
            <ConfirmModal
                open={!!syncing}
                theme="warning"
                title="Sync to Razorpay"
                message={
                    syncing
                        ? `Create/refresh the Razorpay plans for “${syncing.name ?? syncing.code}” at ${formatInr(syncing.price_monthly_inr)}/mo and ${formatInr(
                              syncing.price_annual_inr
                          )}/yr (+GST). New checkouts use the new plan ids; existing subscriptions keep theirs.`
                        : ""
                }
                confirmLabel="Sync"
                confirmStyle="bg-amber-600 hover:bg-amber-700"
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
            onClose={() => !save.isPending && onClose()}
            title={isNew ? "New plan coupon" : `Edit coupon · ${coupon.code}`}
            icon={Ticket}
            size="lg"
            footer={
                <>
                    <button type="button" onClick={onClose} disabled={save.isPending} className={btnSecondary}>
                        Cancel
                    </button>
                    <button type="button" onClick={() => save.mutate()} disabled={save.isPending || codeInvalid || maxInvalid} className={btnPrimary}>
                        <LoadingButtonIcon loading={save.isPending} icon={Save} /> Save coupon
                    </button>
                </>
            }
        >
            <Field label="Code" htmlFor="bc-code" required hint={isNew ? "2–30 characters; stored uppercase." : "Codes can't be renamed."}>
                <input
                    id="bc-code"
                    type="text"
                    value={code}
                    disabled={!isNew}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={`${inputClass} font-mono uppercase tracking-wider`}
                    placeholder="BIRPILOT"
                />
            </Field>
            <Field label="Description" htmlFor="bc-desc">
                <input id="bc-desc" type="text" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Razorpay offer id" htmlFor="bc-offer" hint="Create the offer in the Razorpay dashboard, then paste its id.">
                <input id="bc-offer" type="text" maxLength={60} value={offerId} onChange={(e) => setOfferId(e.target.value)} className={`${inputClass} font-mono`} placeholder="offer_…" />
            </Field>
            <Field label="Valid for plans" hint="None selected = any paid plan.">
                <div className="flex flex-wrap gap-3">
                    {plans
                        .filter((p) => !p.custom)
                        .map((p) => (
                            <Checkbox key={p.code} checked={planCodes.includes(p.code)} onChange={() => togglePlan(p.code)} label={p.name ?? p.code} />
                        ))}
                </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Max redemptions" htmlFor="bc-max" hint={maxInvalid ? "Must be at least 1." : "Blank = unlimited."}>
                    <input id="bc-max" type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Expires at" htmlFor="bc-exp" hint="Blank = never.">
                    <input id="bc-exp" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
                </Field>
            </div>
            <Checkbox checked={active} onChange={setActive} label="Active" />
        </Modal>
    );
}

function CouponsTab() {
    const [editing, setEditing] = useState<BillingCoupon | null | "new">(null);
    const { data, isLoading, error, refetch } = useQuery({ queryKey: ["collabs-billing-coupons"], queryFn: collabsAdminService.listCoupons });
    const plansQuery = useQuery({ queryKey: ["collabs-plans"], queryFn: collabsAdminService.listPlans, staleTime: 5 * 60 * 1000 });
    const coupons = data ?? [];
    return (
        <>
            <div className="flex justify-end">
                <button type="button" onClick={() => setEditing("new")} className={btnPrimary}>
                    <Plus className="w-4 h-4" /> New coupon
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <PanelState isLoading={isLoading} error={error} isEmpty={coupons.length === 0} emptyIcon={Ticket} emptyText="No plan coupons yet" onRetry={() => refetch()}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Code</th>
                                    <th className={thClass}>Plans</th>
                                    <th className={thClass}>Redemptions</th>
                                    <th className={thClass}>Expires</th>
                                    <th className={thClass}>Razorpay offer</th>
                                    <th className={thClass}>Status</th>
                                    <th className={`${thClass} text-right`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {coupons.map((c) => (
                                    <tr key={c.code} className="hover:bg-neutral-50/60">
                                        <td className="px-4 py-3">
                                            <div className="font-mono font-semibold text-neutral-900">{c.code}</div>
                                            {c.description && <div className="text-[11px] text-neutral-400">{c.description}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">{c.plans.length ? c.plans.map((p) => <Chip key={p}>{humanize(p)}</Chip>) : <span className="text-neutral-400 text-xs">Any</span>}</div>
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">
                                            {c.redemptions}
                                            {c.max_redemptions !== null ? ` / ${c.max_redemptions}` : ""}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{c.expires_at ? fmtDateTime(c.expires_at) : "Never"}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-neutral-500">{c.razorpay_offer_id ?? "—"}</td>
                                        <td className="px-4 py-3">
                                            <StatusPill status={c.active ? "active" : "paused"} label={c.active ? "Active" : "Inactive"} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button type="button" onClick={() => setEditing(c)} className={btnSmNeutral}>
                                                <Pencil className="w-3.5 h-3.5" /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
            </div>
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

const SUB_STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All statuses" },
    { value: "trialing", label: "Trialing", dot: "bg-blue-500" },
    { value: "active", label: "Active", dot: "bg-emerald-500" },
    { value: "pending", label: "Pending", dot: "bg-amber-500" },
    { value: "halted", label: "Halted", dot: "bg-red-500" },
    { value: "cancelled", label: "Cancelled", dot: "bg-red-500" },
    { value: "free", label: "Free", dot: "bg-neutral-400" },
];

function SubscriptionsTab() {
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [overriding, setOverriding] = useState<AdminSubscription | null>(null);
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["collabs-subscriptions", status, page],
        queryFn: () => collabsAdminService.listSubscriptions({ status: status || undefined, page }),
        placeholderData: (prev) => prev,
    });
    const subs = data?.subscriptions ?? [];
    // Keep the open modal in sync with refreshed rows (after an override save).
    const current = overriding ? subs.find((s) => s.business_id === overriding.business_id) ?? overriding : null;

    return (
        <>
            <Toolbar>
                <FilterDropdown
                    options={SUB_STATUS_OPTIONS}
                    value={status}
                    onChange={(v) => {
                        setStatus(v);
                        setPage(1);
                    }}
                    icon={<Filter className="w-3.5 h-3.5" />}
                    placeholder="Status"
                    theme="teal"
                />
                {data && <span className="text-sm text-neutral-500">{data.total} subscriptions</span>}
            </Toolbar>
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <PanelState isLoading={isLoading && !data} error={error} isEmpty={subs.length === 0} emptyIcon={Receipt} emptyText="No subscriptions found" onRetry={() => refetch()}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Business</th>
                                    <th className={thClass}>Plan</th>
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Period</th>
                                    <th className={thClass}>Renews / trial ends</th>
                                    <th className={thClass}>Coupon</th>
                                    <th className={thClass}>Override</th>
                                    <th className={`${thClass} text-right`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {subs.map((s) => (
                                    <tr key={s.business_id} className="hover:bg-neutral-50/60 align-top">
                                        <td className="px-4 py-3">
                                            <Link to={`/collabs/businesses/${s.business_id}`} className="font-medium text-neutral-900 hover:underline">
                                                {s.business_name ?? s.business_id}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-neutral-700">{humanize(s.plan_code ?? "free")}</td>
                                        <td className="px-4 py-3">
                                            <StatusPill status={s.status ?? "free"} />
                                            {s.cancel_at_period_end && <div className="text-[11px] text-red-600 mt-1">Cancels at period end</div>}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">{s.period ? humanize(s.period) : "—"}</td>
                                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                                            {s.status === "trialing" ? `Trial → ${fmtDate(s.trial_ends_at)}` : fmtDate(s.current_period_end)}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">{s.coupon_code ?? "—"}</td>
                                        <td className="px-4 py-3 max-w-[260px]">
                                            {s.override ? (
                                                <div className="space-y-1">
                                                    {s.override.plan_code && <Chip tone="amber">Plan → {humanize(s.override.plan_code)}</Chip>}
                                                    <EntitlementsSummary value={s.override.entitlements ?? {}} />
                                                    <div className="text-[11px] text-neutral-400">{s.override.until ? `until ${fmtDate(s.override.until)}` : "no expiry"}</div>
                                                </div>
                                            ) : (
                                                <span className="text-neutral-400 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button type="button" onClick={() => setOverriding(s)} className={btnSmNeutral}>
                                                <Pencil className="w-3.5 h-3.5" /> Override
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
                {data && <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} onPageChange={setPage} theme="teal" />}
            </div>
            <Modal open={!!current} onClose={() => setOverriding(null)} title={`Plan override · ${current?.business_name ?? ""}`} icon={Receipt} size="2xl">
                {current && <OverridePanel businessId={current.business_id} current={current.override} currentPlanCode={current.plan_code} />}
            </Modal>
        </>
    );
}

export function PlansBillingPage() {
    const { isAdmin } = useCollabAccess();
    const [tab, setTab] = useState<Tab>("plans");

    if (!isAdmin) return <AccessDenied message="Only admins can manage plans and billing." />;

    return (
        <div className="space-y-5 animate-fade-in">
            <PageHeader icon={CreditCard} title="Plans & Billing" gradient="from-emerald-500 to-emerald-600" subtitle="Business plans (INR + GST via Razorpay), plan coupons and subscriptions" />
            <SegmentedTabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: "plans", label: "Plans" },
                    { value: "coupons", label: "Coupons" },
                    { value: "subscriptions", label: "Subscriptions" },
                ]}
            />
            {tab === "plans" && <PlansTab />}
            {tab === "coupons" && <CouponsTab />}
            {tab === "subscriptions" && <SubscriptionsTab />}
        </div>
    );
}
