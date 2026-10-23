import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Handshake, Store, Inbox, UserCheck, Sparkles, ShieldCheck, Flag, Siren, Building2, MousePointerClick, Smartphone, MapPin,
    IndianRupee, TrendingUp, Timer, XCircle, RefreshCw, Hourglass,
} from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { Tabs } from "@/components/ui/Tabs";
import { Panel } from "@/components/ui/Panel";
import { PanelState, EmptyState } from "@/components/ui/States";
import { StatGrid, StatTile } from "@/components/ui/Stat";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { useUrlState } from "@/hooks/useUrlState";
import { isRouteMissing } from "@/services/optional";
import { errorMessage } from "@/utils/errors";
import { SimpleBarChart, SimpleDoughnutChart } from "@/features/analytics/components/SimpleChart";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { formatInr, formatPercent, humanize } from "../utils";
import type { CollabFunnel } from "../types";

const DAY_OPTIONS = ["7", "30", "90", "180", "365"] as const;
type Days = (typeof DAY_OPTIONS)[number];

// Brand palette (styles/index.css): amber, teal, deep teal, blue, green.
const FUNNEL_STAGES: { key: keyof CollabFunnel; label: string; color: string }[] = [
    { key: "requested", label: "Requested", color: "#b45309" },
    { key: "approved", label: "Approved", color: "#00a49e" },
    { key: "redeemed", label: "Redeemed", color: "#00716d" },
    { key: "delivered", label: "Delivered", color: "#1d5fa8" },
    { key: "completed", label: "Completed", color: "#15803d" },
];

const OUTCOME_STAGES: (keyof CollabFunnel)[] = ["invited", "declined", "expired", "no_show"];

const PLAN_COLORS = ["#003634", "#00a49e", "#fecd36", "#1d5fa8", "#b45309", "#5f9f9b"];

interface StageRow {
    key: keyof CollabFunnel;
    label: string;
    color?: string;
    value: number;
    conversion: string;
    outcome: boolean;
}

function sweepSummary(counts: Record<string, number>): string {
    const parts = Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${humanize(k).toLowerCase()}: ${n}`);
    return parts.length ? `Sweep done — ${parts.join(", ")}.` : "Sweep done — nothing needed changing.";
}

export function CollabsOverviewPage() {
    const { isStaff, isAdmin } = useCollabAccess();
    const queryClient = useQueryClient();
    const { state, set } = useUrlState({ days: "30", region: "" });
    const days = Number((DAY_OPTIONS as readonly string[]).includes(state.days) ? state.days : "30");
    const regionId = state.region;
    const [confirmSweep, setConfirmSweep] = useState(false);

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ["collabs-analytics", days, regionId],
        queryFn: () => collabsAdminService.analytics({ days, region_id: regionId || undefined }),
        enabled: isStaff,
        placeholderData: (prev) => prev,
        staleTime: 60 * 1000,
    });

    const sweep = useMutation({
        mutationFn: () => collabsAdminService.lifecycleSweep(),
        onSuccess: (counts) => {
            toast.success(sweepSummary(counts));
            setConfirmSweep(false);
            queryClient.invalidateQueries({ queryKey: ["collabs-analytics"] });
            queryClient.invalidateQueries({ queryKey: ["collabs-applications"] });
        },
        onError: (e: Error) => {
            toast.error(isRouteMissing(e) ? "The lifecycle sweep isn't available on this server yet." : errorMessage(e, "Couldn't run the sweep"));
            setConfirmSweep(false);
        },
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view collab analytics." />;

    const funnel = data?.funnel;
    const attribution = data?.attribution;
    const revenue = data?.revenue;
    const payingByPlan = Object.entries(revenue?.paying_by_plan ?? {});
    const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-IN");

    const stageRows: StageRow[] = funnel
        ? [
              ...FUNNEL_STAGES.map((s, i) => {
                  const value = funnel[s.key] ?? 0;
                  const prevKey = i > 0 ? FUNNEL_STAGES[i - 1]?.key : undefined;
                  const prev = prevKey ? funnel[prevKey] : null;
                  return { key: s.key, label: s.label, color: s.color, value, conversion: prev ? formatPercent(value / prev) : "—", outcome: false };
              }),
              ...OUTCOME_STAGES.map((k) => ({
                  key: k,
                  label: humanize(k),
                  value: funnel[k] ?? 0,
                  conversion: k !== "invited" && funnel.requested ? `${formatPercent((funnel[k] ?? 0) / funnel.requested)} of requests` : "",
                  outcome: true,
              })),
          ]
        : [];

    const stageColumns: DataColumn<StageRow>[] = [
        {
            id: "stage",
            header: "Stage",
            cell: (r) => (
                <span className={r.outcome ? "flex items-center gap-2 text-ink-muted" : "flex items-center gap-2"}>
                    {r.outcome ? (
                        r.key === "invited" ? <Timer className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                    )}
                    {r.label}
                </span>
            ),
        },
        { id: "count", header: "Count", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{r.value.toLocaleString("en-IN")}</span> },
        { id: "conversion", header: "From previous", align: "right", cell: (r) => <span className="text-ink-muted">{r.conversion || "—"}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Handshake}
                title="Collabs overview"
                description="Creator × business collaborations across the platform"
                actions={
                    <>
                        <Button variant="secondary" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                            Refresh
                        </Button>
                        {isAdmin && (
                            <Button variant="secondary" icon={Hourglass} onClick={() => setConfirmSweep(true)}>
                                Run lifecycle sweep
                            </Button>
                        )}
                    </>
                }
            />

            <FilterBar>
                <Tabs<Days>
                    label="Period"
                    variant="pill"
                    className="shrink-0"
                    value={String(days) as Days}
                    onChange={(v) => set({ days: v })}
                    tabs={DAY_OPTIONS.map((d) => ({ value: d, label: `${d}d` }))}
                />
                <EntityPicker type="region" variant="filter" label="Region" value={regionId} onChange={(id) => set({ region: id })} placeholder="All regions…" />
            </FilterBar>
            {regionId && <p className="text-xs text-ink-muted">The region filter applies to the funnel and active collabs; other counts are platform-wide.</p>}

            <PanelState isLoading={isLoading && !data} error={error} isEmpty={!data} emptyIcon={Handshake} emptyText="No analytics yet" onRetry={() => refetch()}>
                {data && funnel && attribution && revenue && (
                    <>
                        <StatGrid>
                            <StatTile to="/collabs/businesses?status=active" icon={Store} label="Active businesses" value={n(data.businesses.active)} />
                            <StatTile
                                to="/collabs/businesses?status=pending_claim"
                                icon={Building2}
                                label="No owner yet"
                                value={n(data.businesses.pending_claim)}
                                hint="Created by an admin, owner not assigned"
                            />
                            <StatTile to="/collabs/business-applications" icon={Inbox} label="Pending applications" value={n(data.businesses.pending_applications)} />
                            <StatTile icon={UserCheck} label="Open creators" value={n(data.creators_open)} hint="Opted in to collabs" />
                            <StatTile icon={Sparkles} label="Active collabs" value={n(data.collabs_active)} />
                            <StatTile to="/collabs/moderation" icon={ShieldCheck} label="Moderation pending" value={n(data.moderation_pending)} hintTone="warn" />
                            <StatTile to="/collabs/reports" icon={Flag} label="Open reports" value={n(data.open_reports)} />
                            <StatTile to="/collabs/fraud-flags" icon={Siren} label="Open fraud flags" value={n(data.open_fraud_flags)} />
                        </StatGrid>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                            <Panel className="lg:col-span-3" title={`Application funnel · last ${data.days} days`} icon={TrendingUp}>
                                <SimpleBarChart data={FUNNEL_STAGES.map((s) => ({ label: s.label, value: funnel[s.key] ?? 0, color: s.color }))} height={260} />
                            </Panel>
                            <Panel className="lg:col-span-2" title="Stage conversion" bodyClassName="p-0">
                                <DataTable
                                    label="Stage conversion"
                                    rows={stageRows}
                                    columns={stageColumns}
                                    rowKey={(r) => r.key}
                                    rowClassName={(r) => (r.outcome ? "bg-surface-muted/60" : undefined)}
                                    toolbar={false}
                                    frame="bare"
                                    card={{ title: (r) => r.label, fields: ["count", "conversion"] }}
                                />
                            </Panel>
                        </div>

                        <Panel title="Attribution (tracking links)" icon={MousePointerClick}>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <StatTile icon={MousePointerClick} label="Link clicks" value={n(attribution.click)} />
                                <StatTile
                                    icon={Smartphone}
                                    label="App opens"
                                    value={n(attribution.app_open)}
                                    hint={attribution.click ? `${formatPercent(attribution.app_open / attribution.click)} of clicks` : undefined}
                                />
                                <StatTile
                                    icon={MapPin}
                                    label="Attributed check-ins"
                                    value={n(attribution.checkin)}
                                    hint={attribution.app_open ? `${formatPercent(attribution.checkin / attribution.app_open)} of app opens` : undefined}
                                />
                            </div>
                        </Panel>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                            <div className="grid grid-cols-2 content-start gap-3 lg:col-span-3">
                                <StatTile icon={IndianRupee} label="MRR" value={formatInr(revenue.mrr_inr)} hint="Monthly recurring revenue (ex-GST)" />
                                <StatTile icon={TrendingUp} label="ARR" value={formatInr(revenue.arr_inr)} />
                                <StatTile icon={Timer} label="Trialing" value={n(revenue.trialing)} />
                                <StatTile icon={XCircle} label="Cancelled" value={n(revenue.cancelled)} />
                            </div>
                            <Panel className="lg:col-span-2" title="Paying businesses by plan" icon={IndianRupee}>
                                {payingByPlan.length === 0 ? (
                                    <EmptyState compact icon={IndianRupee} title="No paying businesses yet." />
                                ) : (
                                    <SimpleDoughnutChart
                                        data={payingByPlan.map(([plan, count], i) => ({
                                            label: humanize(plan),
                                            value: count,
                                            color: PLAN_COLORS[i % PLAN_COLORS.length] ?? "#00a49e",
                                        }))}
                                        height={180}
                                    />
                                )}
                            </Panel>
                        </div>
                    </>
                )}
            </PanelState>

            <ConfirmDialog
                open={confirmSweep}
                title="Run the lifecycle sweep now?"
                description="It also runs on a schedule. Running it now expires requests, invites and approvals that have gone stale, marks collabs whose content is overdue (and no-shows after the grace period), and sends due reminders. Each change is posted in the pair's chat."
                confirmLabel="Run sweep"
                isPending={sweep.isPending}
                onConfirm={() => sweep.mutate()}
                onCancel={() => setConfirmSweep(false)}
            />
        </div>
    );
}
