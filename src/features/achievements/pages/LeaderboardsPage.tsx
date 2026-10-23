import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, ListOrdered, Medal } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Field } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { isRouteMissing } from "@/services/optional";
import { formatDateTime } from "@/utils/date";
import { leaderboardsService, type CompetitionEntry, type CompetitionKind } from "../services/leaderboards.service";

type Tab = "global" | "quest" | "region" | "competitions";
type Recompute = "global" | "region" | "competitions";

const PER_PAGE = 20;

const EXPLORER = { value: "explorer" as CompetitionKind, label: "Ultimate explorer", score: "Check-ins", help: "Most check-ins" };

const COMPETITIONS: { value: CompetitionKind; label: string; score: string; help: string }[] = [
    EXPLORER,
    { value: "creator", label: "Top creator", score: "Places created", help: "Most places created" },
    { value: "crowd-favorite", label: "Crowd favourite", score: "Check-ins", help: "Most check-ins on the places they added" },
];

function initials(name: string | null): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + second).toUpperCase() || "?";
}

/** Avatar + name, linking to the person's page. */
function Person({ entry }: { entry: Pick<CompetitionEntry, "user_id" | "display_name" | "avatar_url"> }) {
    const name = entry.display_name ?? "Anonymous";
    return (
        <span className="flex min-w-0 items-center gap-2.5">
            {entry.avatar_url ? (
                <img src={entry.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full bg-surface-muted object-cover" />
            ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700" aria-hidden>
                    {initials(entry.display_name)}
                </span>
            )}
            {entry.user_id ? <IdLink kind="user" id={entry.user_id} label={name} className="truncate" /> : <span className="truncate font-medium text-ink">{name}</span>}
        </span>
    );
}

/** Rankings: global, per quest, per region, and the competition boards. */
export function LeaderboardsPage() {
    const { user } = useAuthStore();
    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const IS_SUPER = !!user?.role?.includes("super_admin");

    const { state, set } = useUrlState({ tab: "global", quest: "", region: "", board: "explorer", page: 1 });
    const tab: Tab = (["global", "quest", "region", "competitions"] as const).find((t) => t === state.tab) ?? "global";
    const board: CompetitionKind = COMPETITIONS.find((c) => c.value === state.board)?.value ?? "explorer";
    const page = Math.max(1, state.page);
    const [confirm, setConfirm] = useState<Recompute | null>(null);

    const boardQuery = useQuery({
        queryKey: ["admin-leaderboard", tab, tab === "quest" ? state.quest : tab === "region" ? state.region : tab === "competitions" ? board : "", { page }],
        queryFn: (): Promise<{ entries: CompetitionEntry[]; total: number; page: number; total_pages: number }> => {
            if (tab === "quest") return leaderboardsService.quest(state.quest, page, PER_PAGE);
            if (tab === "region") return leaderboardsService.region(state.region, page, PER_PAGE);
            if (tab === "competitions") return leaderboardsService.competition(board, page, PER_PAGE);
            return leaderboardsService.global(page, PER_PAGE);
        },
        enabled: tab === "global" || tab === "competitions" || (tab === "quest" && !!state.quest) || (tab === "region" && !!state.region),
        staleTime: 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const onRecomputeError = (what: string) => (e: Error) => {
        toast.error(isRouteMissing(e) ? `Recomputing ${what} isn't available on this server yet.` : e.message || `Failed to queue the ${what} recompute`);
        setConfirm(null);
    };

    const recomputeRegion = useMutation({
        mutationFn: () => leaderboardsService.recomputeRegion(state.region),
        onSuccess: () => {
            toast.success("Region leaderboard recompute queued");
            setConfirm(null);
        },
        onError: onRecomputeError("region leaderboard"),
    });

    const recomputeGlobal = useMutation({
        mutationFn: () => leaderboardsService.recomputeGlobal(),
        onSuccess: () => {
            toast.success("Global leaderboard recompute queued");
            setConfirm(null);
        },
        onError: onRecomputeError("global leaderboard"),
    });

    const recomputeCompetitions = useMutation({
        mutationFn: () => leaderboardsService.recomputeCompetitions(),
        onSuccess: (res) => {
            toast.success(res?.message || "Competition leaderboards are being recomputed");
            setConfirm(null);
        },
        onError: onRecomputeError("competition leaderboards"),
    });

    const recomputePending = recomputeRegion.isPending || recomputeGlobal.isPending || recomputeCompetitions.isPending;

    const competition = COMPETITIONS.find((c) => c.value === board) ?? EXPLORER;
    const isCompetition = tab === "competitions";
    const isRegion = tab === "region";
    const data = boardQuery.data;
    const entries = data?.entries ?? [];
    const dataPage = data?.page ?? page;

    const columns: DataColumn<CompetitionEntry>[] = [
        {
            id: "rank",
            header: "Rank",
            hideable: false,
            sortValue: (e) => e.rank,
            csv: (e) => e.rank,
            cell: (e) => <span className="font-semibold tabular-nums text-ink">{e.rank !== null ? `#${e.rank}` : "—"}</span>,
        },
        { id: "person", header: "Person", hideable: false, sortValue: (e) => e.display_name ?? "", csv: (e) => e.display_name ?? "", cell: (e) => <Person entry={e} /> },
        {
            id: "points",
            header: isCompetition ? competition.score : "Points",
            align: "right",
            sortValue: (e) => e.points_scored,
            cell: (e) => <span className="tabular-nums">{e.points_scored.toLocaleString("en-IN")}</span>,
        },
        ...(isRegion
            ? [
                  {
                      id: "visited",
                      header: "Places visited",
                      align: "right" as const,
                      sortValue: (e: CompetitionEntry) => e.markers_visited ?? 0,
                      cell: (e: CompetitionEntry) => <span className="tabular-nums text-ink-muted">{e.markers_visited ?? "—"}</span>,
                  },
              ]
            : []),
        ...(isCompetition && board === "crowd-favorite"
            ? [
                  {
                      id: "place",
                      header: "Place",
                      csv: (e: CompetitionEntry) => e.marker_name ?? e.marker_id ?? "",
                      cell: (e: CompetitionEntry) => <IdLink kind="place" id={e.marker_id} label={e.marker_name ?? undefined} />,
                  },
              ]
            : []),
        {
            id: "recorded",
            header: "Recorded",
            sortValue: (e) => e.recorded_at ?? "",
            csv: (e) => formatDateTime(e.recorded_at),
            cell: (e) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(e.recorded_at)}</span>,
        },
    ];

    const needsPick = (tab === "quest" && !state.quest) || (tab === "region" && !state.region);

    return (
        <div className="space-y-5">
            <PageHeader
                icon={ListOrdered}
                title="Leaderboards"
                description="Rankings across global, quest and region boards, and the competitions"
                actions={
                    <>
                        {tab === "global" && IS_SUPER && (
                            <Button variant="secondary" icon={RefreshCw} onClick={() => setConfirm("global")} loading={recomputeGlobal.isPending}>
                                Recompute global
                            </Button>
                        )}
                        {tab === "region" && CAN_MANAGE && (
                            <Button variant="secondary" icon={RefreshCw} onClick={() => setConfirm("region")} disabled={!state.region} loading={recomputeRegion.isPending}>
                                Recompute region
                            </Button>
                        )}
                        {CAN_MANAGE && (
                            <Button variant="secondary" icon={Medal} onClick={() => setConfirm("competitions")} loading={recomputeCompetitions.isPending}>
                                Recompute competitions
                            </Button>
                        )}
                    </>
                }
            />

            <Tabs<Tab>
                label="Leaderboards"
                value={tab}
                onChange={(t) => set({ tab: t })}
                tabs={[
                    { value: "global", label: "Global" },
                    { value: "quest", label: "Quest" },
                    { value: "region", label: "Region" },
                    { value: "competitions", label: "Competitions" },
                ]}
            />

            {tab === "quest" && (
                <Panel>
                    <Field label="Quest" htmlFor="leaderboard-quest" className="max-w-xl">
                        <EntityPicker id="leaderboard-quest" type="quest" label="Quest" value={state.quest} onChange={(id) => set({ quest: id })} />
                    </Field>
                </Panel>
            )}
            {tab === "region" && (
                <Panel>
                    <Field label="Region" htmlFor="leaderboard-region" className="max-w-xl">
                        <EntityPicker id="leaderboard-region" type="region" label="Region" value={state.region} onChange={(id) => set({ region: id })} />
                    </Field>
                </Panel>
            )}
            {isCompetition && (
                <div className="space-y-1.5">
                    <Tabs<CompetitionKind> label="Competition" variant="pill" value={board} onChange={(b) => set({ board: b })} tabs={COMPETITIONS.map((c) => ({ value: c.value, label: c.label }))} />
                    <p className="text-sm text-ink-muted">{competition.help}.</p>
                </div>
            )}

            {needsPick ? (
                <Panel>
                    <EmptyState icon={ListOrdered} title={`Pick a ${tab === "quest" ? "quest" : "region"} to see its leaderboard.`} />
                </Panel>
            ) : (
                <DataTable
                    label={isCompetition ? competition.label : `${tab} leaderboard`}
                    rows={entries}
                    columns={columns}
                    rowKey={(e) => e.id ?? `${e.user_id ?? "row"}-${e.rank ?? ""}-${e.marker_id ?? ""}`}
                    isLoading={boardQuery.isLoading && !data}
                    isFetching={boardQuery.isFetching && !!data}
                    error={boardQuery.error}
                    onRetry={() => boardQuery.refetch()}
                    empty={{ icon: ListOrdered, title: "No leaderboard entries yet." }}
                    exportName={`leaderboard-${isCompetition ? board : tab}`}
                    summary={data ? `${data.total.toLocaleString("en-IN")} ranked` : undefined}
                    card={{
                        title: (e) => <Person entry={e} />,
                        subtitle: (e) => (e.rank !== null ? `#${e.rank}` : undefined),
                        fields: ["points", isRegion ? "visited" : board === "crowd-favorite" && isCompetition ? "place" : "recorded"],
                    }}
                    footer={
                        data && (
                            <Pagination page={dataPage} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                        )
                    }
                />
            )}

            <ConfirmDialog
                open={!!confirm}
                title={confirm === "global" ? "Recompute the global leaderboard?" : confirm === "region" ? "Recompute this region's leaderboard?" : "Recompute the competition leaderboards?"}
                description={
                    confirm === "competitions"
                        ? "This rebuilds the explorer, creator and crowd favourite boards in the background. The boards update in a few minutes."
                        : "This queues a background job; the board updates in a few minutes."
                }
                confirmLabel="Recompute"
                tone="warning"
                isPending={recomputePending}
                onConfirm={() => {
                    if (confirm === "global") recomputeGlobal.mutate();
                    else if (confirm === "region") recomputeRegion.mutate();
                    else recomputeCompetitions.mutate();
                }}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}
