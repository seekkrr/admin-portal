import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Handshake, Store, Inbox, UserCheck, Sparkles, ShieldCheck, Flag, Siren, Building2,
    MousePointerClick, Smartphone, MapPin, IndianRupee, TrendingUp, Timer, XCircle, RefreshCw,
} from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { AnalyticsCard } from "@/features/analytics/components/AnalyticsCard";
import { SimpleBarChart, SimpleDoughnutChart } from "@/features/analytics/components/SimpleChart";
import { RegionPicker } from "@/features/regions/components/RegionPicker";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { PageHeader, PanelState, SectionCard, thClass } from "../components/CollabsUi";
import { formatInr, formatPercent, humanize } from "../utils";
import type { CollabFunnel } from "../types";

const DAY_OPTIONS = [7, 30, 90, 180, 365] as const;

const FUNNEL_STAGES: { key: keyof CollabFunnel; label: string; color: string }[] = [
    { key: "requested", label: "Requested", color: "#f59e0b" },
    { key: "approved", label: "Approved", color: "#14b8a6" },
    { key: "redeemed", label: "Redeemed", color: "#0d9488" },
    { key: "delivered", label: "Delivered", color: "#3b82f6" },
    { key: "completed", label: "Completed", color: "#10b981" },
];

const OUTCOME_STAGES: (keyof CollabFunnel)[] = ["invited", "declined", "expired", "no_show"];

const PLAN_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#3b82f6", "#84cc16"];

export function CollabsOverviewPage() {
    const { isStaff } = useCollabAccess();
    const [days, setDays] = useState<number>(30);
    const [regionId, setRegionId] = useState("");

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ["collabs-analytics", days, regionId],
        queryFn: () => collabsAdminService.analytics({ days, region_id: regionId || undefined }),
        enabled: isStaff,
        placeholderData: (prev) => prev,
        staleTime: 60 * 1000,
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view collab analytics." />;

    const funnel = data?.funnel;
    const attribution = data?.attribution;
    const revenue = data?.revenue;
    const payingByPlan = Object.entries(revenue?.paying_by_plan ?? {});

    return (
        <div className="space-y-5 animate-fade-in">
            <PageHeader
                icon={Handshake}
                title="Collabs Overview"
                subtitle="Creator × business collaborations across the platform"
                actions={
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="p-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                        aria-label="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
                    </button>
                }
            />

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-wrap items-center gap-4">
                <div className="flex gap-1 bg-neutral-100/80 p-1 rounded-xl ring-1 ring-neutral-200/50 shadow-inner w-fit">
                    {DAY_OPTIONS.map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setDays(d)}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                                days === d
                                    ? "bg-white text-teal-600 shadow-sm ring-1 ring-neutral-200/50"
                                    : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50"
                            }`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
                <div className="flex-1 min-w-[260px] max-w-md">
                    <RegionPicker value={regionId} onChange={setRegionId} placeholder="All regions — search to filter…" ringClass="focus:ring-teal-500" />
                </div>
                {regionId && (
                    <p className="text-xs text-neutral-500 basis-full">
                        The region filter applies to the funnel and active collabs; other counts are platform-wide.
                    </p>
                )}
            </div>

            <PanelState isLoading={isLoading && !data} error={error} isEmpty={!data} emptyIcon={Handshake} emptyText="No analytics yet" onRetry={() => refetch()}>
                {data && funnel && attribution && revenue && (
                    <>
                        {/* KPI cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <Link to="/collabs/businesses?status=active">
                                <AnalyticsCard title="Active businesses" value={data.businesses.active} icon={Store} colorClass="ring-teal-100 text-teal-600" />
                            </Link>
                            <Link to="/collabs/businesses?status=pending_claim">
                                <AnalyticsCard title="No owner yet" value={data.businesses.pending_claim} icon={Building2} colorClass="ring-amber-100 text-amber-600" subtitle="Created by an admin, owner not assigned" />
                            </Link>
                            <Link to="/collabs/business-applications">
                                <AnalyticsCard title="Pending applications" value={data.businesses.pending_applications} icon={Inbox} colorClass="ring-indigo-100 text-indigo-600" />
                            </Link>
                            <AnalyticsCard title="Open creators" value={data.creators_open} icon={UserCheck} colorClass="ring-violet-100 text-violet-600" subtitle="Opted in to collabs" />
                            <AnalyticsCard title="Active collabs" value={data.collabs_active} icon={Sparkles} colorClass="ring-emerald-100 text-emerald-600" />
                            <Link to="/collabs/moderation">
                                <AnalyticsCard title="Moderation pending" value={data.moderation_pending} icon={ShieldCheck} colorClass="ring-orange-100 text-orange-600" />
                            </Link>
                            <Link to="/collabs/reports">
                                <AnalyticsCard title="Open reports" value={data.open_reports} icon={Flag} colorClass="ring-rose-100 text-rose-600" />
                            </Link>
                            <Link to="/collabs/fraud-flags">
                                <AnalyticsCard title="Open fraud flags" value={data.open_fraud_flags} icon={Siren} colorClass="ring-red-100 text-red-600" />
                            </Link>
                        </div>

                        {/* Funnel */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            <div className="lg:col-span-3">
                                <SectionCard title={`Application funnel · last ${data.days} days`} icon={TrendingUp}>
                                    <SimpleBarChart data={FUNNEL_STAGES.map((s) => ({ label: s.label, value: funnel[s.key] ?? 0, color: s.color }))} height={260} />
                                </SectionCard>
                            </div>
                            <div className="lg:col-span-2">
                                <SectionCard title="Stage conversion" bodyClassName="p-0">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                                <th className={thClass}>Stage</th>
                                                <th className={`${thClass} text-right`}>Count</th>
                                                <th className={`${thClass} text-right`}>From previous</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-50">
                                            {FUNNEL_STAGES.map((s, i) => {
                                                const prev = i > 0 ? funnel[FUNNEL_STAGES[i - 1]?.key ?? s.key] : null;
                                                const value = funnel[s.key] ?? 0;
                                                return (
                                                    <tr key={s.key}>
                                                        <td className="px-4 py-2.5 flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                            {s.label}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-semibold text-neutral-900">{value}</td>
                                                        <td className="px-4 py-2.5 text-right text-neutral-500">
                                                            {prev === null ? "—" : prev ? formatPercent(value / prev) : "—"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {OUTCOME_STAGES.map((k) => (
                                                <tr key={k} className="bg-neutral-50/40">
                                                    <td className="px-4 py-2.5 text-neutral-500 flex items-center gap-2">
                                                        {k === "invited" ? <Timer className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                        {humanize(k)}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-medium text-neutral-700">{funnel[k] ?? 0}</td>
                                                    <td className="px-4 py-2.5 text-right text-neutral-400">
                                                        {k !== "invited" && funnel.requested ? formatPercent((funnel[k] ?? 0) / funnel.requested) + " of req." : ""}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </SectionCard>
                            </div>
                        </div>

                        {/* Attribution */}
                        <SectionCard title="Attribution (tracking links)" icon={MousePointerClick}>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <AnalyticsCard title="Link clicks" value={attribution.click} icon={MousePointerClick} colorClass="ring-blue-100 text-blue-600" />
                                <AnalyticsCard
                                    title="App opens"
                                    value={attribution.app_open}
                                    icon={Smartphone}
                                    colorClass="ring-indigo-100 text-indigo-600"
                                    subtitle={attribution.click ? `${formatPercent(attribution.app_open / attribution.click)} of clicks` : undefined}
                                />
                                <AnalyticsCard
                                    title="Attributed check-ins"
                                    value={attribution.checkin}
                                    icon={MapPin}
                                    colorClass="ring-emerald-100 text-emerald-600"
                                    subtitle={attribution.app_open ? `${formatPercent(attribution.checkin / attribution.app_open)} of app opens` : undefined}
                                />
                            </div>
                        </SectionCard>

                        {/* Revenue */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                                <AnalyticsCard title="MRR" value={formatInr(revenue.mrr_inr)} icon={IndianRupee} colorClass="ring-teal-100 text-teal-600" subtitle="Monthly recurring revenue (ex-GST)" />
                                <AnalyticsCard title="ARR" value={formatInr(revenue.arr_inr)} icon={TrendingUp} colorClass="ring-emerald-100 text-emerald-600" />
                                <AnalyticsCard title="Trialing" value={revenue.trialing} icon={Timer} colorClass="ring-blue-100 text-blue-600" />
                                <AnalyticsCard title="Cancelled" value={revenue.cancelled} icon={XCircle} colorClass="ring-rose-100 text-rose-600" />
                            </div>
                            <div className="lg:col-span-2">
                                <SectionCard title="Paying businesses by plan" icon={IndianRupee}>
                                    {payingByPlan.length === 0 ? (
                                        <p className="text-sm text-neutral-400 text-center py-8">No paying businesses yet.</p>
                                    ) : (
                                        <SimpleDoughnutChart
                                            data={payingByPlan.map(([plan, count], i) => ({
                                                label: humanize(plan),
                                                value: count,
                                                color: PLAN_COLORS[i % PLAN_COLORS.length] ?? "#0d9488",
                                            }))}
                                            height={180}
                                        />
                                    )}
                                </SectionCard>
                            </div>
                        </div>
                    </>
                )}
            </PanelState>
        </div>
    );
}
