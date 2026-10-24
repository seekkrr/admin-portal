import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Field } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { FilterBar } from "@/components/ui/FilterBar";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Drawer } from "@/components/ui/Modal";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/States";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDateTime } from "@/utils/date";
import { progressService } from "../services/progress.service";
import type { ExplorationProgress, MarkerVisit } from "@/types";

const PER_PAGE = 20;

/** Metres as km (2 dp) from 1,000 m, otherwise metres. */
function formatDistance(metres: number | null | undefined): string {
    if (metres === null || metres === undefined) return "—";
    if (metres >= 1000) return `${(metres / 1000).toFixed(2)} km`;
    return `${Math.round(metres)} m`;
}

function Completion({ value }: { value: number }) {
    const pct = Math.min(100, Math.max(0, value));
    return (
        <span className="flex items-center gap-2">
            <span className="h-2 w-24 overflow-hidden rounded-full bg-brand-50" aria-hidden>
                <span className="block h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-xs tabular-nums text-ink-muted">{Math.round(value)}%</span>
        </span>
    );
}

function rowKeyOf(p: ExplorationProgress): string {
    return p.id ?? `${p.user_id ?? "row"}-${p.quest_id ?? ""}-${p.started_at ?? ""}`;
}

const VISIT_COLUMNS: DataColumn<MarkerVisit>[] = [
    { id: "place", header: "Place", hideable: false, csv: (m) => m.marker_id ?? "", cell: (m) => <IdLink kind="place" id={m.marker_id} /> },
    { id: "visited", header: "Visited", sortValue: (m) => m.visited_at ?? "", csv: (m) => formatDateTime(m.visited_at), cell: (m) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(m.visited_at)}</span> },
    {
        id: "quest",
        header: "Quest stop",
        sortValue: (m) => m.is_quest_marker,
        csv: (m) => (m.is_quest_marker ? "yes" : "no"),
        cell: (m) => <Tag tone={m.is_quest_marker ? "brand" : "neutral"}>{m.is_quest_marker ? "Yes" : "No"}</Tag>,
    },
    { id: "points", header: "Points", align: "right", sortValue: (m) => m.points_earned, cell: (m) => <span className="tabular-nums">{m.points_earned}</span> },
];

/** One person's progress on the quest: timings, distance and the places they checked in at. */
function ProgressDrawer({ progress, onClose }: { progress: ExplorationProgress | null; onClose: () => void }) {
    return (
        <Drawer open={!!progress} onClose={onClose} title="Quest progress" subtitle={progress?.user_id ? <IdLink kind="user" id={progress.user_id} short={false} /> : undefined} width="lg">
            {progress && (
                <>
                    <DetailList>
                        <DetailRow label="Status" value={<StatusPill status={progress.is_completed ? "completed" : "in_progress"} label={progress.is_completed ? "Completed" : "In progress"} tone={progress.is_completed ? "good" : "neutral"} />} />
                        <DetailRow label="Completion" value={<Completion value={progress.completion_percentage} />} />
                        <DetailRow label="Points" value={(progress.points_earned ?? 0).toLocaleString("en-IN")} />
                        <DetailRow label="Started" value={formatDateTime(progress.started_at)} />
                        <DetailRow label="Completed" value={formatDateTime(progress.completed_at)} />
                        <DetailRow label="Last activity" value={formatDateTime(progress.last_activity_at)} />
                        <DetailRow label="Total time taken" value={progress.total_time_taken ?? "—"} />
                        <DetailRow label="Hints used" value={progress.hints_used} />
                        <DetailRow label="Heading to" value={<IdLink kind="place" id={progress.current_destination_marker_id} />} />
                        <DetailRow label="Distance covered" value={formatDistance(progress.total_distance_covered)} />
                    </DetailList>
                    <div className="space-y-2">
                        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            <MapPin className="h-4 w-4 text-accent-600" aria-hidden />
                            Places visited ({progress.markers_visited.length})
                        </h3>
                        <DataTable
                            label="Places visited"
                            rows={progress.markers_visited}
                            columns={VISIT_COLUMNS}
                            rowKey={(m) => `${m.marker_id ?? "place"}-${m.visited_at ?? ""}`}
                            empty={{ icon: MapPin, title: "No places visited yet." }}
                            toolbar={false}
                            card={{ title: (m) => <IdLink kind="place" id={m.marker_id} />, fields: ["visited", "quest", "points"] }}
                        />
                    </div>
                </>
            )}
        </Drawer>
    );
}

/** Read-only oversight: everyone's progress on one quest, for support and abuse checks. */
export function ProgressPage() {
    const { state, set } = useUrlState({ quest: "", q: "", page: 1 });
    const page = Math.max(1, state.page);
    const [openId, setOpenId] = useState<string | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-progress-quest-users", state.quest, { page }],
        queryFn: () => progressService.questUsers(state.quest, page, PER_PAGE),
        enabled: !!state.quest,
        staleTime: 60 * 1000,
        placeholderData: (prev) => prev,
    });

    // The user filter narrows the rows already loaded (the endpoint has no user filter).
    const rows = useMemo<ExplorationProgress[]>(() => {
        const all = data?.progress ?? [];
        const filter = state.q.trim().toLowerCase();
        if (!filter) return all;
        return all.filter((p) => (p.user_id ?? "").toLowerCase().includes(filter));
    }, [data?.progress, state.q]);

    const open = rows.find((p) => rowKeyOf(p) === openId) ?? null;

    const columns: DataColumn<ExplorationProgress>[] = [
        { id: "user", header: "Person", hideable: false, csv: (p) => p.user_id ?? "", cell: (p) => <IdLink kind="user" id={p.user_id} /> },
        {
            id: "completion",
            header: "Completion",
            sortValue: (p) => p.completion_percentage,
            csv: (p) => Math.round(p.completion_percentage),
            cell: (p) => <Completion value={p.completion_percentage} />,
        },
        {
            id: "status",
            header: "Status",
            sortValue: (p) => p.is_completed,
            csv: (p) => (p.is_completed ? "completed" : "in progress"),
            cell: (p) => <StatusPill status={p.is_completed ? "completed" : "in_progress"} label={p.is_completed ? "Completed" : "In progress"} tone={p.is_completed ? "good" : "neutral"} />,
        },
        { id: "points", header: "Points", align: "right", sortValue: (p) => p.points_earned ?? 0, cell: (p) => <span className="font-medium tabular-nums">{p.points_earned ?? 0}</span> },
        {
            id: "places",
            header: "Places",
            align: "right",
            sortValue: (p) => p.markers_visited?.length ?? 0,
            cell: (p) => <span className="tabular-nums text-ink-muted">{p.markers_visited?.length ?? 0}</span>,
        },
        {
            id: "started",
            header: "Started",
            sortValue: (p) => p.started_at ?? "",
            csv: (p) => formatDateTime(p.started_at),
            cell: (p) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(p.started_at)}</span>,
        },
        {
            id: "last",
            header: "Last activity",
            sortValue: (p) => p.last_activity_at ?? "",
            csv: (p) => formatDateTime(p.last_activity_at),
            cell: (p) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(p.last_activity_at)}</span>,
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeader icon={Activity} title="Progress" description="Read-only: everyone's progress on a quest, for support and abuse checks" />

            <Panel>
                <Field label="Quest" htmlFor="progress-quest" className="max-w-xl">
                    <EntityPicker id="progress-quest" type="quest" label="Quest" value={state.quest} onChange={(id) => set({ quest: id, q: "" })} />
                </Field>
            </Panel>

            {!state.quest ? (
                <Panel>
                    <EmptyState icon={Activity} title="Pick a quest to begin." description="You'll see every person's progress on it." />
                </Panel>
            ) : (
                <>
                    <FilterBar
                        search={{ value: state.q, onChange: (q) => set({ q, page }, { replace: true }), placeholder: "Filter these rows by user ID…" }}
                        onReset={() => set({ q: "", page })}
                    />
                    <DataTable
                        label="Quest progress"
                        rows={rows}
                        columns={columns}
                        rowKey={rowKeyOf}
                        isLoading={isLoading && !data}
                        isFetching={isFetching && !!data}
                        error={error}
                        onRetry={() => refetch()}
                        empty={{ icon: Activity, title: state.q.trim() ? "No rows match this user ID." : "No one has started this quest yet." }}
                        onRowClick={(p) => setOpenId(rowKeyOf(p))}
                        storageKey="progress"
                        exportName="quest-progress"
                        summary={data ? `${rows.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                        card={{
                            title: (p) => <IdLink kind="user" id={p.user_id} />,
                            fields: ["completion", "status", "points", "last"],
                        }}
                        footer={data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />}
                    />
                </>
            )}

            <ProgressDrawer progress={open} onClose={() => setOpenId(null)} />
        </div>
    );
}
