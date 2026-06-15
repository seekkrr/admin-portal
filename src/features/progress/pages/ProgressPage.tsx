import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    Activity,
    Search,
    ChevronDown,
    ChevronRight as ChevronRightSmall,
    MapPin,
} from "lucide-react";
import { Card, CardContent } from "@components/ui";
import { LoadingFallback } from "@components/LoadingFallback";
import { Pagination } from "@/components/ui/Pagination";
import { progressService } from "../services/progress.service";
import type { ExplorationProgress } from "@/types";
import { shortId } from "@/utils/format";

function formatDate(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function formatNumber(value: number | null): string {
    if (value === null || value === undefined) return "—";
    return String(value);
}

/** Format metres as km (2 dp) if ≥ 1000, otherwise show metres. */
function formatDistance(metres: number | null | undefined): string {
    if (metres === null || metres === undefined) return "—";
    if (metres >= 1000) return `${(metres / 1000).toFixed(2)} km`;
    return `${Math.round(metres)} m`;
}

/** Render a marker id as a link to /markers/:id with shortId display. */
function MarkerLink({ markerId }: { markerId: string | null | undefined }) {
    if (!markerId) return <span className="text-neutral-400">—</span>;
    return (
        <Link
            to={`/markers/${markerId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs text-indigo-600 hover:text-indigo-900 hover:underline"
            title={markerId}
        >
            {shortId(markerId)}
        </Link>
    );
}

export function ProgressPage() {
    const [questIdInput, setQuestIdInput] = useState("");
    const [submittedQuestId, setSubmittedQuestId] = useState("");
    const [userFilter, setUserFilter] = useState("");
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["admin-progress-quest-users", submittedQuestId, { page }],
        queryFn: () => progressService.questUsers(submittedQuestId, page, 20),
        enabled: !!submittedQuestId,
        staleTime: 60 * 1000,
    });

    const loadQuest = () => {
        const trimmed = questIdInput.trim();
        if (!trimmed) return;
        setPage(1);
        setExpandedId(null);
        setSubmittedQuestId(trimmed);
    };

    const rows = useMemo<ExplorationProgress[]>(() => {
        const all = data?.progress ?? [];
        const filter = userFilter.trim().toLowerCase();
        if (!filter) return all;
        return all.filter((p) =>
            (p.user_id ?? "").toLowerCase().includes(filter),
        );
    }, [data?.progress, userFilter]);

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-purple-600" />
                    Progress Tracking
                </h1>
                <p className="text-neutral-500 mt-1">
                    Read-only oversight — inspect any user&apos;s progress on a
                    quest for support &amp; abuse investigation.
                </p>
            </div>

            {/* Search Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Enter a quest ID to load progress..."
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            value={questIdInput}
                            onChange={(e) => setQuestIdInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") loadQuest();
                            }}
                        />
                    </div>
                    <button
                        onClick={loadQuest}
                        disabled={!questIdInput.trim()}
                        className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Load progress
                    </button>
                    {submittedQuestId && (
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Filter loaded rows by user ID..."
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {!submittedQuestId ? (
                <Card>
                    <CardContent className="p-12">
                        <div className="flex flex-col items-center justify-center text-center text-neutral-500">
                            <Activity className="w-12 h-12 text-neutral-300 mb-4" />
                            <p className="font-medium text-neutral-700">
                                Enter a quest ID to begin
                            </p>
                            <p className="text-sm mt-1">
                                Load all users&apos; progress on a specific
                                quest for oversight.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : isLoading ? (
                <LoadingFallback message="Loading progress records..." />
            ) : isError ? (
                <div className="p-6 text-center text-red-500">
                    Failed to load progress records for this quest.
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-neutral-200 text-sm">
                            <thead>
                                <tr className="bg-neutral-50/60 border-b border-neutral-100">
                                    <th className="px-4 py-3.5 w-8 font-semibold text-neutral-500 text-xs uppercase tracking-wider text-left" />
                                    <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        User
                                    </th>
                                    <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Completion
                                    </th>
                                    <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Status
                                    </th>
                                    <th className="px-4 py-3.5 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Points
                                    </th>
                                    <th className="px-4 py-3.5 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Markers
                                    </th>
                                    <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Started
                                    </th>
                                    <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Last activity
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-50">
                                {rows.map((p, idx) => {
                                    const rowKey =
                                        p.id ?? `${p.user_id ?? "row"}-${idx}`;
                                    const isExpanded =
                                        expandedId !== null &&
                                        expandedId === rowKey;
                                    return (
                                        <Fragment key={rowKey}>
                                            <tr
                                                onClick={() =>
                                                    setExpandedId(
                                                        isExpanded
                                                            ? null
                                                            : rowKey,
                                                    )
                                                }
                                                className={`hover:bg-neutral-50/80 transition-colors group cursor-pointer ${
                                                    isExpanded ? "bg-neutral-50" : ""
                                                }`}
                                            >
                                                <td className="px-4 py-3 align-middle text-neutral-400">
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronRightSmall className="w-4 h-4" />
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    {p.user_id ? (
                                                        <Link
                                                            to={`/users/${p.user_id}`}
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            className="font-mono text-xs text-indigo-600 hover:text-indigo-900 truncate inline-block max-w-[14rem]"
                                                            title={p.user_id}
                                                        >
                                                            {p.user_id}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-neutral-400">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden max-w-[8rem]">
                                                            <div
                                                                className="h-full bg-purple-500 rounded-full"
                                                                style={{
                                                                    width: `${Math.min(
                                                                        100,
                                                                        Math.max(
                                                                            0,
                                                                            p.completion_percentage,
                                                                        ),
                                                                    )}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-neutral-600 tabular-nums">
                                                            {Math.round(
                                                                p.completion_percentage,
                                                            )}
                                                            %
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-middle whitespace-nowrap">
                                                    {p.is_completed ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                            Completed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                                                            In progress
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-right tabular-nums font-medium text-neutral-900">
                                                    {p.points_earned ?? 0}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-right tabular-nums text-neutral-600">
                                                    {p.markers_visited?.length ?? 0}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                                    {formatDate(p.started_at)}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                                    {formatDate(
                                                        p.last_activity_at,
                                                    )}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-neutral-50">
                                                    <td
                                                        colSpan={8}
                                                        className="px-6 py-5"
                                                    >
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
                                                            <div>
                                                                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                                                    Completed at
                                                                </div>
                                                                <div className="text-sm text-neutral-800 mt-0.5">
                                                                    {formatDate(
                                                                        p.completed_at,
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                                                    Total time
                                                                    taken
                                                                </div>
                                                                <div className="text-sm text-neutral-800 mt-0.5">
                                                                    {formatNumber(
                                                                        p.total_time_taken,
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                                                    Hints used
                                                                </div>
                                                                <div className="text-sm text-neutral-800 mt-0.5">
                                                                    {
                                                                        p.hints_used
                                                                    }
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                                                    Current
                                                                    destination
                                                                    marker
                                                                </div>
                                                                <div className="text-sm text-neutral-800 mt-0.5">
                                                                    <MarkerLink markerId={p.current_destination_marker_id} />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                                                    Total
                                                                    distance
                                                                    covered
                                                                </div>
                                                                <div className="text-sm text-neutral-800 mt-0.5">
                                                                    {formatDistance(
                                                                        p.total_distance_covered,
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                <MapPin className="w-3.5 h-3.5" />
                                                                Markers visited
                                                                (
                                                                {
                                                                    p
                                                                        .markers_visited
                                                                        .length
                                                                }
                                                                )
                                                            </div>
                                                            {p.markers_visited
                                                                .length ===
                                                            0 ? (
                                                                <p className="text-sm text-neutral-400">
                                                                    No markers
                                                                    visited.
                                                                </p>
                                                            ) : (
                                                                <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                                                                    <table className="min-w-full divide-y divide-neutral-200 text-xs">
                                                                        <thead className="bg-neutral-50">
                                                                            <tr>
                                                                                <th className="px-3 py-2 text-left font-semibold text-neutral-500 uppercase tracking-wider">
                                                                                    Marker
                                                                                    ID
                                                                                </th>
                                                                                <th className="px-3 py-2 text-left font-semibold text-neutral-500 uppercase tracking-wider">
                                                                                    Visited
                                                                                    at
                                                                                </th>
                                                                                <th className="px-3 py-2 text-left font-semibold text-neutral-500 uppercase tracking-wider">
                                                                                    Quest
                                                                                    marker
                                                                                </th>
                                                                                <th className="px-3 py-2 text-right font-semibold text-neutral-500 uppercase tracking-wider">
                                                                                    Points
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-neutral-100">
                                                                            {p.markers_visited.map(
                                                                                (
                                                                                    m,
                                                                                    mIdx,
                                                                                ) => (
                                                                                    <tr
                                                                                        key={`${
                                                                                            m.marker_id ??
                                                                                            "marker"
                                                                                        }-${mIdx}`}
                                                                                    >
                                                                                        <td className="px-3 py-2">
                                                                                            <MarkerLink markerId={m.marker_id} />
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                                                                                            {formatDate(
                                                                                                m.visited_at,
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-3 py-2">
                                                                                            {m.is_quest_marker ? (
                                                                                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700">
                                                                                                    Yes
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600">
                                                                                                    No
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                                                                                            {
                                                                                                m.points_earned
                                                                                            }
                                                                                        </td>
                                                                                    </tr>
                                                                                ),
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                                {rows.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="px-4 py-12 text-center text-neutral-500"
                                        >
                                            <div className="flex flex-col items-center justify-center">
                                                <Activity className="w-12 h-12 text-neutral-300 mb-4" />
                                                <p>
                                                    {userFilter.trim()
                                                        ? "No progress records match this user ID filter."
                                                        : "No progress records for this quest."}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data && data.total_pages > 1 && (
                        <Pagination
                            page={data.page}
                            totalPages={data.total_pages}
                            total={data.total}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
