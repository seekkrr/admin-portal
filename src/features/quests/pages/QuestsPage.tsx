import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Search, Compass, Trash2,
    RefreshCw, X, Filter, Eye, MapPin, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { questsService } from "../services/quests.service";
import { formatDuration } from "../utils/formatters";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { QuestDetailModal } from "../components/QuestDetailModal";
import { QuestActionModal, type QuestActionType } from "../components/QuestActionModal";
import { regionsService } from "@/features/regions/services/regions.service";
import type { DropdownOption } from "@/components/FilterDropdown";
import type { QuestListEntry } from "@/types";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];
const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

// ---- Badge Styles ----
const questStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    Draft: { label: "Draft", dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" },
    'Under Review': { label: "Under Review", dot: "bg-blue-500", bg: "bg-blue-50 text-blue-700 border-blue-200" },
    'Changes Requested': { label: "Changes Requested", dot: "bg-orange-500", bg: "bg-orange-50 text-orange-700 border-orange-200" },
    Approved: { label: "Approved", dot: "bg-indigo-500", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    Published: { label: "Published", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    Paused: { label: "Paused", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    Rejected: { label: "Rejected", dot: "bg-rose-500", bg: "bg-rose-50 text-rose-700 border-rose-200" },
    Archived: { label: "Archived", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
};



// ---- Discriminated Union for Confirm Actions ----
type ConfirmAction =
    | { type: "delete"; payload: { questId: string; title: string } };

// ---- Filter Dropdown Options ----
const STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Statuses" },
    { value: "Under Review", label: "Under Review", dot: "bg-blue-500" },
    { value: "Changes Requested", label: "Changes Requested", dot: "bg-orange-500" },
    { value: "Published", label: "Published", dot: "bg-emerald-500" },
    { value: "Paused", label: "Paused", dot: "bg-amber-500" },
    { value: "Rejected", label: "Rejected", dot: "bg-rose-500" },
    { value: "Archived", label: "Archived", dot: "bg-red-500" },
];

// Values MUST be lowercase to match the backend `difficulty` enum
// (easy | moderate | hard | expert).
const DIFFICULTY_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Difficulties" },
    { value: "easy", label: "Easy", dot: "bg-emerald-400" },
    { value: "moderate", label: "Moderate", dot: "bg-amber-400" },
    { value: "hard", label: "Hard", dot: "bg-orange-500" },
    { value: "expert", label: "Expert", dot: "bg-red-500" },
];

// Theme is a free-form lowercase tag array on the backend; these are the
// tags actually used across seeded quests.
const THEME_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Themes" },
    { value: "heritage", label: "Heritage" },
    { value: "history", label: "History" },
    { value: "architecture", label: "Architecture" },
    { value: "culture", label: "Culture" },
    { value: "food", label: "Food" },
    { value: "nature", label: "Nature" },
    { value: "wellness", label: "Wellness" },
    { value: "photography", label: "Photography" },
    { value: "art", label: "Art" },
    { value: "urban", label: "Urban" },
    { value: "nightlife", label: "Nightlife" },
    { value: "science", label: "Science" },
    { value: "adventure", label: "Adventure" },
];

const DIFFICULTY_BADGE: Record<string, string> = {
    easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    moderate: "bg-amber-50 text-amber-700 border-amber-200",
    hard: "bg-orange-50 text-orange-700 border-orange-200",
    expert: "bg-red-50 text-red-700 border-red-200",
};

// ---- Main Component ----
export function QuestsPage() {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();
    const hasAccess = !!currentUser && currentUser.role?.some(r => ALLOWED_ROLES.includes(r));
    const canDelete = !!currentUser && currentUser.role?.some(r => CAN_DELETE_ROLES.includes(r));

    // ---- State ----
    const [searchInput, setSearchInput] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [difficultyFilter, setDifficultyFilter] = useState("");
    const [themeFilter, setThemeFilter] = useState("");
    const [regionFilter, setRegionFilter] = useState(""); // selected region id
    const [page, setPage] = useState(1);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [hardDelete, setHardDelete] = useState(false);

    const [activeTab, setActiveTab] = useState<"all" | "review-queue">("all");
    const [actionModal, setActionModal] = useState<{
        action: QuestActionType;
        questId: string;
        questTitle: string;
    } | null>(null);

    // Review queue query — only enabled when on that tab
    const { data: reviewQueueData, isLoading: reviewQueueLoading } = useQuery({
        queryKey: ["admin-review-queue", page],
        queryFn: () => questsService.getReviewQueue({ page, per_page: PER_PAGE }),
        enabled: activeTab === "review-queue",
        staleTime: 15_000,
    });

    // Modal state
    const [viewingQuest, setViewingQuest] = useState<QuestListEntry | null>(null);

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

    // Admin-relevant statuses — exclude Draft (creator-only) and Approved (not used in admin flow)
    const ADMIN_STATUSES = "Under Review,Changes Requested,Published,Paused,Rejected,Archived";

    // ---- Fetch Quests ----
    const queryParams = useMemo(() => ({
        q: debouncedQuery || undefined,
        // When a specific status is selected use single status param; otherwise restrict to admin-relevant statuses
        status: statusFilter || undefined,
        statuses: statusFilter ? undefined : ADMIN_STATUSES,
        difficulty: difficultyFilter || undefined,
        theme: themeFilter || undefined,
        region: regionFilter || undefined,
        page,
        per_page: PER_PAGE,
    }), [debouncedQuery, statusFilter, difficultyFilter, themeFilter, regionFilter, page]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-quests", queryParams],
        queryFn: () => questsService.listQuests(queryParams),
        staleTime: 30_000,
    });

    const quests = useMemo(() => data?.quests ?? [], [data]);
    const pagination = data?.pagination;

    // ---- Regions (for id → name resolution + filter dropdown) ----
    const { data: allRegions } = useQuery({
        queryKey: ["admin-regions-lookup"],
        queryFn: () => regionsService.listAll(),
        staleTime: 5 * 60_000,
    });

    const REGION_OPTIONS = useMemo<DropdownOption[]>(() => [
        { value: "", label: "All Regions" },
        ...(allRegions ?? []).map((r) => ({ value: r.id, label: r.name })),
    ], [allRegions]);

    // ---- Client-side instant filter ----
    const filteredQuests = useMemo(() => {
        let result = quests;
        // Client-side instant title filter for responsiveness while debounce is pending
        if (searchInput.trim() && searchInput.trim() !== debouncedQuery) {
            const q = searchInput.trim().toLowerCase();
            result = result.filter((quest) =>
                (quest.title ?? "").toLowerCase().includes(q)
            );
        }
        return result;
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

    const approveMutation = useMutation({
        mutationFn: (questId: string) => questsService.approve(questId),
        onSuccess: () => {
            toast.success("Quest approved and published");
            queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] });
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            setActionModal(null);
        },
        onError: (err: Error) => { toast.error(err.message); setActionModal(null); },
    });

    const requestChangesMutation = useMutation({
        mutationFn: ({ questId, comment }: { questId: string; comment: string }) =>
            questsService.requestChanges(questId, comment),
        onSuccess: () => {
            toast.success("Changes requested");
            queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] });
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            setActionModal(null);
        },
        onError: (err: Error) => { toast.error(err.message); setActionModal(null); },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ questId, reason }: { questId: string; reason: string }) =>
            questsService.reject(questId, reason),
        onSuccess: () => {
            toast.success("Quest rejected");
            queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] });
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            setActionModal(null);
        },
        onError: (err: Error) => { toast.error(err.message); setActionModal(null); },
    });

    // ---- Handlers ----
    const clearFilters = useCallback(() => {
        setSearchInput("");
        setDebouncedQuery("");
        setStatusFilter("");
        setDifficultyFilter("");
        setThemeFilter("");
        setRegionFilter("");
        setPage(1);
    }, []);

    const handleActionConfirm = useCallback((text: string) => {
        if (!actionModal) return;
        const { action, questId } = actionModal;
        if (action === "approve") approveMutation.mutate(questId);
        else if (action === "requestChanges") requestChangesMutation.mutate({ questId, comment: text });
        else if (action === "reject") rejectMutation.mutate({ questId, reason: text });
    }, [actionModal, approveMutation, requestChangesMutation, rejectMutation]);

    const isBusy = deleteMutation.isPending || approveMutation.isPending || requestChangesMutation.isPending || rejectMutation.isPending;
    const hasActiveFilters = searchInput || statusFilter || difficultyFilter || themeFilter || regionFilter;

    // Tab-aware display data
    const displayQuests = activeTab === "review-queue" ? (reviewQueueData?.quests ?? []) : filteredQuests;
    const displayLoading = activeTab === "review-queue" ? reviewQueueLoading : isLoading;
    const displayPagination = activeTab === "review-queue" ? reviewQueueData?.pagination : pagination;

    // ---- Confirm handler ----
    const executeConfirmedAction = useCallback(() => {
        if (!confirmAction) return;
        if (confirmAction.type === "delete") {
            deleteMutation.mutate({ questId: confirmAction.payload.questId, hard: hardDelete });
        }
    }, [confirmAction, deleteMutation, hardDelete]);

    // ---- Pagination ----


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

            {/* Tab bar */}
            <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => { setActiveTab("all"); setPage(1); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === "all"
                            ? "bg-white shadow-sm text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-700"
                    }`}
                >
                    All Quests
                    {pagination && (
                        <span className="ml-2 text-xs text-neutral-400">({pagination.total})</span>
                    )}
                </button>
                <button
                    onClick={() => { setActiveTab("review-queue"); setPage(1); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === "review-queue"
                            ? "bg-white shadow-sm text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-700"
                    }`}
                >
                    Review Queue
                    {reviewQueueData && reviewQueueData.pagination.total > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                            {reviewQueueData.pagination.total}
                        </span>
                    )}
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                {/* Search + Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search by title..."
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

                    {/* Region filter (server-side by region_id) */}
                    <FilterDropdown
                        options={REGION_OPTIONS}
                        value={regionFilter}
                        onChange={(v) => { setRegionFilter(v); setPage(1); }}
                        icon={<MapPin className="w-3.5 h-3.5" />}
                        placeholder="Region"
                    />

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
                {displayLoading ? (
                    <LoadingFallback />
                ) : error || displayQuests.length === 0 ? (
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
                                {displayQuests.map((quest) => {
                                    const sc = questStatusConfig[quest.status] || { label: quest.status, dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" };
                                    return (
                                        <tr
                                            key={quest.id}
                                            className="transition-colors group hover:bg-neutral-50/80 cursor-pointer"
                                            onClick={() => setViewingQuest(quest)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-neutral-900">
                                                        {quest.title || "Untitled Quest"}
                                                    </span>
                                                    {quest.difficulty && (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize ${DIFFICULTY_BADGE[quest.difficulty] ?? "bg-neutral-50 text-neutral-600 border-neutral-200"}`}>
                                                            {quest.difficulty}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-neutral-400 mt-0.5">
                                                    {quest.region_name || "No region"}
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
                                                {formatDuration(quest.duration_minutes)}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                                                {quest.created_at ? new Date(quest.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                            </td>
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    {activeTab === "review-queue" && (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActionModal({ action: "approve", questId: quest.id, questTitle: quest.title || "Quest" });
                                                                }}
                                                                title="Approve"
                                                                className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActionModal({ action: "requestChanges", questId: quest.id, questTitle: quest.title || "Quest" });
                                                                }}
                                                                title="Request Changes"
                                                                className="p-1.5 rounded-lg text-neutral-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                                                            >
                                                                <AlertCircle className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActionModal({ action: "reject", questId: quest.id, questTitle: quest.title || "Quest" });
                                                                }}
                                                                title="Reject"
                                                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => setViewingQuest(quest)}
                                                        title="View details"
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => setConfirmAction({ type: "delete", payload: { questId: quest.id, title: quest.title || "Untitled" } })}
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
                {displayPagination && (
                    <Pagination
                        page={displayPagination.page}
                        totalPages={displayPagination.total_pages}
                        total={displayPagination.total}
                        onPageChange={setPage}
                        theme="violet"
                    />
                )}
            </div>

            {/* Quest Detail Modal (read-only quick view) */}
            <QuestDetailModal
                open={!!viewingQuest}
                questId={viewingQuest?.id ?? null}
                questTitle={viewingQuest?.title ?? ""}
                questStatus={viewingQuest?.status ?? "Draft"}
                onClose={() => setViewingQuest(null)}
                onStatusChange={(_questId, _status) => {
                    setViewingQuest(null);
                }}
                canDelete={canDelete}
                onDelete={(questId) => {
                    setViewingQuest(null);
                    setConfirmAction({ type: "delete", payload: { questId, title: viewingQuest?.title || "Quest" } });
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

            {/* Review action modal */}
            <QuestActionModal
                open={!!actionModal}
                action={actionModal?.action ?? null}
                questTitle={actionModal?.questTitle ?? ""}
                isPending={approveMutation.isPending || requestChangesMutation.isPending || rejectMutation.isPending}
                onConfirm={handleActionConfirm}
                onCancel={() => setActionModal(null)}
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

