import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Search,
    RefreshCw,
    ListOrdered,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { leaderboardsService } from "../services/leaderboards.service";
import { useAuthStore } from "@store/auth.store";
import type { LeaderboardEntry, LeaderboardResponse } from "@/types";

type Tab = "global" | "quest" | "region";

function initials(name: string | null): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + second).toUpperCase() || "?";
}

function fmtDate(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function LeaderboardsPage() {
    const { user } = useAuthStore();
    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const IS_SUPER = !!user?.role?.includes("super_admin");

    const [tab, setTab] = useState<Tab>("global");

    const [globalPage, setGlobalPage] = useState(1);

    const [questIdInput, setQuestIdInput] = useState("");
    const [questId, setQuestId] = useState("");
    const [questPage, setQuestPage] = useState(1);

    const [regionIdInput, setRegionIdInput] = useState("");
    const [regionId, setRegionId] = useState("");
    const [regionPage, setRegionPage] = useState(1);

    const [confirmRecompute, setConfirmRecompute] = useState<null | "global" | "region">(null);

    const globalQuery = useQuery({
        queryKey: ["admin-leaderboard-global", { page: globalPage }],
        queryFn: () => leaderboardsService.global(globalPage),
        enabled: tab === "global",
        staleTime: 60 * 1000,
    });

    const questQuery = useQuery({
        queryKey: ["admin-leaderboard-quest", questId, { page: questPage }],
        queryFn: () => leaderboardsService.quest(questId, questPage),
        enabled: tab === "quest" && !!questId,
        staleTime: 60 * 1000,
    });

    const regionQuery = useQuery({
        queryKey: ["admin-leaderboard-region", regionId, { page: regionPage }],
        queryFn: () => leaderboardsService.region(regionId, regionPage),
        enabled: tab === "region" && !!regionId,
        staleTime: 60 * 1000,
    });

    const recomputeRegionMutation = useMutation({
        mutationFn: () => leaderboardsService.recomputeRegion(regionId),
        onSuccess: () => {
            toast.success("Region leaderboard recompute queued");
            setConfirmRecompute(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to queue region recompute");
            setConfirmRecompute(null);
        },
    });

    const recomputeGlobalMutation = useMutation({
        mutationFn: () => leaderboardsService.recomputeGlobal(),
        onSuccess: () => {
            toast.success("Global leaderboard recompute queued");
            setConfirmRecompute(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to queue global recompute");
            setConfirmRecompute(null);
        },
    });

    const activeData: LeaderboardResponse | undefined =
        tab === "global" ? globalQuery.data : tab === "quest" ? questQuery.data : regionQuery.data;
    const activeLoading =
        tab === "global"
            ? globalQuery.isLoading
            : tab === "quest"
              ? questQuery.isFetching && !!questId
              : regionQuery.isFetching && !!regionId;
    const activeError =
        tab === "global" ? globalQuery.error : tab === "quest" ? questQuery.error : regionQuery.error;

    const page = tab === "global" ? globalPage : tab === "quest" ? questPage : regionPage;
    const setPage = tab === "global" ? setGlobalPage : tab === "quest" ? setQuestPage : setRegionPage;
    const showRegionExtra = tab === "region";

    const entries: LeaderboardEntry[] = activeData?.entries ?? [];
    const totalPages = activeData?.total_pages ?? 1;

    const idSet = tab === "quest" ? questId : tab === "region" ? regionId : "";
    const needsId = (tab === "quest" || tab === "region") && !idSet;

    const handleLoadQuest = () => {
        setQuestId(questIdInput.trim());
        setQuestPage(1);
    };

    const handleLoadRegion = () => {
        setRegionId(regionIdInput.trim());
        setRegionPage(1);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                    <ListOrdered className="w-6 h-6 text-yellow-600" />
                    Leaderboards
                </h1>
                <p className="text-neutral-500 mt-1">Rankings across global, quest, and region boards</p>
            </div>

            {/* Tabs */}
            <div className="bg-neutral-100/70 p-1.5 rounded-xl inline-flex max-w-full scrollbar-hide ring-1 ring-neutral-200/50 shadow-inner">
                {(["global", "quest", "region"] as Tab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => {
                            setTab(t);
                            setPage(1);
                        }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap ${
                            tab === t
                                ? "bg-white text-indigo-700 shadow-md font-bold ring-1 ring-neutral-200/50"
                                : "text-neutral-500 hover:text-neutral-800 font-bold"
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Controls — hidden on global tab for non-super-admins */}
            {(tab !== "global" || IS_SUPER) && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    {tab === "quest" && (
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                            <div className="relative flex-1 min-w-[260px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Enter a Quest ID to load its leaderboard..."
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    value={questIdInput}
                                    onChange={(e) => setQuestIdInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleLoadQuest();
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleLoadQuest}
                                disabled={!questIdInput.trim()}
                                className="px-4 py-2.5 bg-yellow-600 text-white rounded-xl text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50"
                            >
                                Load
                            </button>
                        </div>
                    )}

                    {tab === "region" && (
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                            <div className="relative flex-1 min-w-[260px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Enter a Region ID to load its leaderboard..."
                                    value={regionIdInput}
                                    onChange={(e) => setRegionIdInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleLoadRegion();
                                    }}
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <button
                                onClick={handleLoadRegion}
                                disabled={!regionIdInput.trim()}
                                className="px-4 py-2.5 bg-yellow-600 text-white rounded-xl text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50"
                            >
                                Load
                            </button>
                            {CAN_MANAGE && (
                                <button
                                    onClick={() => setConfirmRecompute("region")}
                                    disabled={!regionId || recomputeRegionMutation.isPending}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-yellow-300 text-yellow-700 rounded-xl text-sm font-medium hover:bg-yellow-50 transition-colors disabled:opacity-50"
                                >
                                    {recomputeRegionMutation.isPending ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
                                    Recompute region
                                </button>
                            )}
                        </div>
                    )}

                    {tab === "global" && IS_SUPER && (
                        <button
                            onClick={() => setConfirmRecompute("global")}
                            disabled={recomputeGlobalMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-yellow-300 text-yellow-700 rounded-xl text-sm font-medium hover:bg-yellow-50 transition-colors disabled:opacity-50"
                        >
                            {recomputeGlobalMutation.isPending ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            Recompute global
                        </button>
                    )}
                </div>
            </div>
            )}

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="bg-neutral-50/60 border-b border-neutral-100">
                                <tr className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    <th className="px-4 py-3">Rank</th>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3 text-right">Points</th>
                                    {showRegionExtra && (
                                        <th className="px-4 py-3 text-right">Markers Visited</th>
                                    )}
                                    <th className="px-4 py-3">Recorded</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-200">
                                {needsId ? (
                                    <tr>
                                        <td colSpan={showRegionExtra ? 5 : 4} className="px-4 py-12 text-center text-neutral-500">
                                            Enter a {tab === "quest" ? "quest" : "region"} ID and click Load.
                                        </td>
                                    </tr>
                                ) : activeLoading ? (
                                    <tr>
                                        <td colSpan={showRegionExtra ? 5 : 4} className="px-4 py-12 text-center text-neutral-500">
                                            Loading leaderboard...
                                        </td>
                                    </tr>
                                ) : activeError ? (
                                    <tr>
                                        <td colSpan={showRegionExtra ? 5 : 4} className="px-4 py-12 text-center text-red-500">
                                            Failed to load leaderboard.
                                        </td>
                                    </tr>
                                ) : entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={showRegionExtra ? 5 : 4} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <ListOrdered className="w-12 h-12 text-neutral-300 mb-4" />
                                                <p>No leaderboard entries yet.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    entries.map((entry, idx) => (
                                        <tr
                                            key={entry.id ?? `${entry.user_id}-${idx}`}
                                            className="divide-y divide-neutral-50 hover:bg-neutral-50/80 transition-colors group"
                                        >
                                            <td className="px-4 py-3 align-middle font-semibold text-neutral-700">
                                                {entry.rank !== null ? `#${entry.rank}` : "—"}
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <div className="flex items-center gap-3">
                                                    {entry.avatar_url ? (
                                                        <img
                                                            src={entry.avatar_url}
                                                            alt={entry.display_name ?? "User"}
                                                            className="w-9 h-9 rounded-full object-cover bg-neutral-100 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                                            {initials(entry.display_name)}
                                                        </div>
                                                    )}
                                                    <span className="font-medium text-neutral-900">
                                                        {entry.display_name ?? "Anonymous"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-middle text-right text-neutral-700">
                                                {entry.points_scored}
                                            </td>
                                            {showRegionExtra && (
                                                <td className="px-4 py-3 align-middle text-right text-neutral-600">
                                                    {entry.markers_visited ?? "—"}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 align-middle text-neutral-500">
                                                {fmtDate(entry.recorded_at)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={activeData?.total ?? 0}
                            onPageChange={setPage}
                        />
                    )}
                </div>

            {/* Recompute Confirmation Modal */}
            <ConfirmModal
                open={!!confirmRecompute}
                title={
                    confirmRecompute === "global"
                        ? "Recompute Global Leaderboard"
                        : "Recompute Region Leaderboard"
                }
                message={
                    confirmRecompute === "global"
                        ? "This queues a background job to recompute the global leaderboard. Continue?"
                        : "This queues a background job to recompute this region's leaderboard. Continue?"
                }
                confirmLabel="Recompute"
                confirmStyle="bg-yellow-600 hover:bg-yellow-700"
                disabledConfirm={false}
                isPending={recomputeGlobalMutation.isPending || recomputeRegionMutation.isPending}
                onConfirm={() => {
                    if (confirmRecompute === "global") {
                        recomputeGlobalMutation.mutate();
                    } else {
                        recomputeRegionMutation.mutate();
                    }
                }}
                onCancel={() => setConfirmRecompute(null)}
                theme="warning"
            />
        </div>
    );
}
