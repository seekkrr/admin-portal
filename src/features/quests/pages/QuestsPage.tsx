import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Search, Compass, Trash2, ChevronLeft, ChevronRight,
    RefreshCw, X, Filter, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { questsService } from "../services/quests.service";
import { formatDuration } from "../utils/formatters";
import { ConfirmModal } from "@/features/users/components/ConfirmModal";
import { FilterDropdown } from "@/features/users/components/FilterDropdown";
import { usePaginationRange } from "@/features/users/hooks/usePagination";
import { QuestDetailModal } from "../components/QuestDetailModal";
import type { DropdownOption } from "@/features/users/components/FilterDropdown";
import type { QuestListItem, QuestStatus } from "@/types";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];
const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

// ---- Badge Styles ----
const questStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    Draft: { label: "Draft", dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" },
    Published: { label: "Published", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    Paused: { label: "Paused", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    Archived: { label: "Archived", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
};



// ---- Discriminated Union for Confirm Actions ----
type ConfirmAction =
    | { type: "delete"; payload: { questId: string; title: string } }
    | { type: "status-change"; payload: { questId: string; title: string; status: QuestStatus } };

// ---- Filter Dropdown Options ----
const STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Statuses" },
    { value: "Draft", label: "Draft", dot: "bg-neutral-400" },
    { value: "Published", label: "Published", dot: "bg-emerald-500" },
    { value: "Paused", label: "Paused", dot: "bg-amber-500" },
    { value: "Archived", label: "Archived", dot: "bg-red-500" },
];

const DIFFICULTY_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Difficulties" },
    { value: "Easy", label: "Easy", dot: "bg-emerald-400" },
    { value: "Medium", label: "Medium", dot: "bg-amber-400" },
    { value: "Hard", label: "Hard", dot: "bg-orange-500" },
    { value: "Expert", label: "Expert", dot: "bg-red-500" },
];

const THEME_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Themes" },
    { value: "Adventure", label: "Adventure" },
    { value: "Romance", label: "Romance" },
    { value: "Culture", label: "Culture" },
    { value: "Food", label: "Food" },
    { value: "History", label: "History" },
    { value: "Nature", label: "Nature" },
    { value: "Custom", label: "Custom" },
];

// ---- Main Component ----
export function QuestsPage() {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();
    const hasAccess = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);
    const canDelete = !!currentUser && CAN_DELETE_ROLES.includes(currentUser.role);

    // ---- State ----
    const [searchInput, setSearchInput] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [difficultyFilter, setDifficultyFilter] = useState("");
    const [themeFilter, setThemeFilter] = useState("");
    const [page, setPage] = useState(1);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [hardDelete, setHardDelete] = useState(false);

    // Modal state
    const [viewingQuest, setViewingQuest] = useState<QuestListItem | null>(null);

    // ---- Debounced search ----
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Reset hard delete toggle when modal closes
    useEffect(() => { if (!confirmAction) setHardDelete(false); }, [confirmAction]);

    // ---- Fetch Quests ----
    const queryParams = useMemo(() => ({
        q: debouncedQuery || undefined,
        status: statusFilter || undefined,
        difficulty: difficultyFilter || undefined,
        theme: themeFilter || undefined,
        page,
        per_page: PER_PAGE,
    }), [debouncedQuery, statusFilter, difficultyFilter, themeFilter, page]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-quests", queryParams],
        queryFn: () => questsService.listQuests(queryParams),
        staleTime: 30_000,
    });

    const quests = useMemo(() => data?.quests ?? [], [data]);
    const pagination = data?.pagination;

    // ---- Client-side instant filter ----
    const filteredQuests = useMemo(() => {
        if (!searchInput.trim() || searchInput.trim() === debouncedQuery) return quests;
        const q = searchInput.trim().toLowerCase();
        return quests.filter((quest) =>
            (quest.quest_title ?? "").toLowerCase().includes(q) ||
            (quest.quest_region ?? "").toLowerCase().includes(q) ||
            quest._id.toLowerCase().includes(q)
        );
    }, [quests, searchInput, debouncedQuery]);

    // ---- Mutations ----
    const deleteMutation = useMutation({
        mutationFn: ({ questId, hard }: { questId: string; hard: boolean }) =>
            questsService.deleteQuest(questId, hard),
        onSuccess: () => {
            toast.success("Quest deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            setConfirmAction(null);
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    const statusMutation = useMutation({
        mutationFn: ({ questId, status }: { questId: string; status: QuestStatus }) =>
            questsService.updateQuestStatus(questId, status),
        onSuccess: () => {
            toast.success("Quest status updated");
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            setConfirmAction(null);
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    // ---- Handlers ----
    const clearFilters = useCallback(() => {
        setSearchInput("");
        setDebouncedQuery("");
        setStatusFilter("");
        setDifficultyFilter("");
        setThemeFilter("");
        setPage(1);
    }, []);

    const isBusy = deleteMutation.isPending || statusMutation.isPending;
    const hasActiveFilters = searchInput || statusFilter || difficultyFilter || themeFilter;

    // ---- Confirm handler ----
    const executeConfirmedAction = useCallback(() => {
        if (!confirmAction) return;
        switch (confirmAction.type) {
            case "delete":
                deleteMutation.mutate({ questId: confirmAction.payload.questId, hard: hardDelete });
                break;
            case "status-change":
                statusMutation.mutate({ questId: confirmAction.payload.questId, status: confirmAction.payload.status });
                break;
        }
    }, [confirmAction, deleteMutation, statusMutation, hardDelete]);

    // ---- Pagination ----
    const totalPages = pagination?.total_pages ?? 1;
    const paginationRange = usePaginationRange(totalPages, page);

    // ---- Render ----
    if (!hasAccess) {
        return <AccessDenied message="Only admins and moderators can manage quests." />;
    }

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm">
                        <Compass className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Manage Quests</h1>
                        <p className="text-sm text-neutral-500">
                            {pagination ? `${pagination.total} total quests` : "Loading..."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                {/* Search + Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search by title, region, or ID..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                        />
                        {searchInput && (
                            <button
                                onClick={() => { setSearchInput(""); setDebouncedQuery(""); setPage(1); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <FilterDropdown
                        options={STATUS_OPTIONS}
                        value={statusFilter}
                        onChange={(v) => { setStatusFilter(v); setPage(1); }}
                        icon={<Filter className="w-3.5 h-3.5" />}
                        placeholder="Status"
                    />

                    <FilterDropdown
                        options={DIFFICULTY_OPTIONS}
                        value={difficultyFilter}
                        onChange={(v) => { setDifficultyFilter(v); setPage(1); }}
                        icon={<Filter className="w-3.5 h-3.5" />}
                        placeholder="Difficulty"
                    />

                    <FilterDropdown
                        options={THEME_OPTIONS}
                        value={themeFilter}
                        onChange={(v) => { setThemeFilter(v); setPage(1); }}
                        icon={<Filter className="w-3.5 h-3.5" />}
                        placeholder="Theme"
                    />

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <LoadingFallback />
                ) : error || filteredQuests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-2">
                        <Compass className="w-8 h-8" />
                        <p className="text-sm font-medium text-neutral-500">No quests found</p>
                        {hasActiveFilters && (
                            <p className="text-xs text-neutral-400">No quests matched your current filter criteria. Try adjusting or resetting filters.</p>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Quest</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Price</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Duration</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Created</th>
                                    <th className="text-right px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {filteredQuests.map((quest) => {
                                    const sc = questStatusConfig[quest.status] || { label: quest.status, dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" };
                                    return (
                                        <tr
                                            key={quest._id}
                                            className="transition-colors group hover:bg-neutral-50/80 cursor-pointer"
                                            onClick={() => setViewingQuest(quest)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900">
                                                    {quest.quest_title || "Untitled Quest"}
                                                </div>
                                                <div className="text-[11px] text-neutral-400 mt-0.5">
                                                    {quest.quest_region || "No region"}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                    {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">
                                                {quest.price > 0 ? `₹${quest.price.toLocaleString("en-IN")}` : (
                                                    <span className="text-emerald-600 font-medium">Free</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                                                {formatDuration(quest.quest_duration_minutes)}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                                                {new Date(quest.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setViewingQuest(quest)}
                                                        title="View details"
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => setConfirmAction({ type: "delete", payload: { questId: quest._id, title: quest.quest_title || "Untitled" } })}
                                                            title="Delete quest"
                                                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50/30">
                        <span className="text-sm text-neutral-500">
                            Page <span className="font-medium text-neutral-700">{pagination.page}</span> of <span className="font-medium text-neutral-700">{pagination.total_pages}</span>
                            <span className="ml-2 text-neutral-400">({pagination.total} total)</span>
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {paginationRange.map((p, idx) =>
                                p === "..." ? (
                                    <span key={`ellipsis-${idx}`} className="px-1 text-neutral-400 text-sm">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${p === page
                                            ? "bg-violet-600 text-white shadow-sm"
                                            : "text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                                disabled={page >= pagination.total_pages}
                                className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Quest Detail Modal (read-only quick view) */}
            <QuestDetailModal
                open={!!viewingQuest}
                questId={viewingQuest?._id ?? null}
                questTitle={viewingQuest?.quest_title ?? ""}
                questStatus={viewingQuest?.status ?? "Draft"}
                onClose={() => setViewingQuest(null)}
                onStatusChange={(questId, status) => {
                    setViewingQuest(null);
                    setConfirmAction({ type: "status-change", payload: { questId, title: viewingQuest?.quest_title || "Quest", status } });
                }}
                canDelete={canDelete}
                onDelete={(questId) => {
                    setViewingQuest(null);
                    setConfirmAction({ type: "delete", payload: { questId, title: viewingQuest?.quest_title || "Quest" } });
                }}
            />

            {/* Delete Confirmation */}
            <ConfirmModal
                open={confirmAction?.type === "delete"}
                title="Delete Quest"
                message={
                    `This will ${hardDelete ? "PERMANENTLY" : "soft"}-delete "${confirmAction?.type === "delete" ? confirmAction.payload.title : ""}". ${hardDelete ? "All data will be permanently removed." : "The quest will be archived."}`
                }
                confirmLabel={hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={deleteMutation.isPending}
            >
                <label className="flex items-center gap-2 mt-3 mb-1 px-1 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={hardDelete}
                        onChange={(e) => setHardDelete(e.target.checked)}
                        className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 accent-red-600"
                    />
                    <span className="text-xs text-red-600 font-medium">Hard delete (permanent, irreversible)</span>
                </label>
            </ConfirmModal>

            {/* Status Change Confirmation */}
            <ConfirmModal
                open={confirmAction?.type === "status-change"}
                title="Change Quest Status"
                message={`You are about to change "${confirmAction?.type === "status-change" ? confirmAction.payload.title : ""}" to "${confirmAction?.type === "status-change" ? confirmAction.payload.status : ""}". This will take effect immediately.`}
                confirmLabel="Change Status"
                confirmStyle="bg-violet-600 hover:bg-violet-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={statusMutation.isPending}
                theme="warning"
            />

            {/* Loading overlay for mutations */}
            {isBusy && !confirmAction && (
                <div className="fixed inset-0 z-40 bg-white/60 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-violet-600 animate-spin" />
                </div>
            )}
        </div>
    );
}
