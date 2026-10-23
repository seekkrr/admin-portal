import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Compass, Eye, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/StatusPill";
import { Checkbox } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { Menu } from "@/components/ui/Menu";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDate } from "@/utils/date";
import { questsService } from "../services/quests.service";
import { formatDuration } from "../utils/formatters";
import { QuestDetailModal } from "../components/QuestDetailModal";
import { QuestActionModal, type QuestActionType } from "../components/QuestActionModal";
import { QuestStatusPill } from "../components/QuestStatusPill";
import type { QuestListEntry } from "@/types";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];
const PER_PAGE = 10;

// Admin-relevant statuses — Draft (creator-only) and Approved (not used in the admin flow) are left out.
const ADMIN_STATUSES = "Under Review,Changes Requested,Published,Paused,Rejected,Archived";

const STATUS_OPTIONS: FilterOption[] = [
    { value: "Under Review", label: "Under review" },
    { value: "Changes Requested", label: "Changes requested" },
    { value: "Published", label: "Published" },
    { value: "Paused", label: "Paused" },
    { value: "Rejected", label: "Rejected" },
    { value: "Archived", label: "Archived" },
];

// Values MUST be lowercase to match the backend `difficulty` enum (easy | moderate | hard | expert).
const DIFFICULTY_OPTIONS: FilterOption[] = [
    { value: "easy", label: "Easy" },
    { value: "moderate", label: "Moderate" },
    { value: "hard", label: "Hard" },
    { value: "expert", label: "Expert" },
];

// Theme is a free-form lowercase tag array on the backend; these are the tags actually used across seeded quests.
const THEME_OPTIONS: FilterOption[] = [
    "heritage",
    "history",
    "architecture",
    "culture",
    "food",
    "nature",
    "wellness",
    "photography",
    "art",
    "urban",
    "nightlife",
    "science",
    "adventure",
].map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));

type Tab = "all" | "review-queue";

type ActionTarget = { action: QuestActionType; questId: string; questTitle: string };

function priceText(q: QuestListEntry): string {
    return q.price > 0 ? `₹${q.price.toLocaleString("en-IN")}` : "Free";
}

// ---- Main Component ----
export function QuestsPage() {
    const { user: currentUser } = useAuthStore();
    const hasAccess = !!currentUser && currentUser.role?.some((r) => ALLOWED_ROLES.includes(r));
    if (!hasAccess) {
        return <AccessDenied message="Only admins and moderators can manage quests." />;
    }
    return <QuestsList canDelete={!!currentUser?.role?.some((r) => CAN_DELETE_ROLES.includes(r))} />;
}

function QuestsList({ canDelete }: { canDelete: boolean }) {
    const queryClient = useQueryClient();

    // Filters, search, tab and page live in the address (?tab=review-queue comes from Today).
    const { state, set, reset } = useUrlState({ tab: "all", q: "", status: "", difficulty: "", theme: "", region: "", page: 1 });
    const tab: Tab = state.tab === "review-queue" ? "review-queue" : "all";
    const statusFilter = STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "";
    const difficultyFilter = DIFFICULTY_OPTIONS.some((o) => o.value === state.difficulty) ? state.difficulty : "";
    const themeFilter = THEME_OPTIONS.some((o) => o.value === state.theme) ? state.theme : "";
    const regionFilter = state.region;
    const page = Math.max(1, state.page);
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));

    const [viewingQuest, setViewingQuest] = useState<QuestListEntry | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ questId: string; title: string } | null>(null);
    const [hardDelete, setHardDelete] = useState(false);
    const [actionModal, setActionModal] = useState<ActionTarget | null>(null);

    // ---- Review queue (only fetched on that tab; its total shows on the tab) ----
    const reviewQueue = useQuery({
        queryKey: ["admin-review-queue", tab === "review-queue" ? page : 1],
        queryFn: () => questsService.getReviewQueue({ page: tab === "review-queue" ? page : 1, per_page: PER_PAGE }),
        staleTime: 15_000,
        placeholderData: (prev) => prev,
    });

    // ---- All quests ----
    const queryParams = useMemo(
        () => ({
            q: state.q || undefined,
            // A chosen status filters to it; otherwise restrict to admin-relevant statuses.
            status: statusFilter || undefined,
            statuses: statusFilter ? undefined : ADMIN_STATUSES,
            difficulty: difficultyFilter || undefined,
            theme: themeFilter || undefined,
            region: regionFilter || undefined,
            page,
            per_page: PER_PAGE,
        }),
        [state.q, statusFilter, difficultyFilter, themeFilter, regionFilter, page]
    );

    const allQuests = useQuery({
        queryKey: ["admin-quests", queryParams],
        queryFn: () => questsService.listQuests(queryParams),
        staleTime: 30_000,
        enabled: tab === "all",
        placeholderData: (prev) => prev,
    });

    // ---- Mutations ----
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] });
        queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
    };

    const deleteMutation = useMutation({
        mutationFn: ({ questId, hard }: { questId: string; hard: boolean }) => questsService.deleteQuest(questId, hard),
        onSuccess: () => {
            toast.success("Quest deleted");
            invalidate();
            setDeleteTarget(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setDeleteTarget(null);
        },
    });

    const approveMutation = useMutation({
        mutationFn: (questId: string) => questsService.approve(questId),
        onSuccess: () => {
            toast.success("Quest approved and published");
            invalidate();
            setActionModal(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setActionModal(null);
        },
    });

    const requestChangesMutation = useMutation({
        mutationFn: ({ questId, comment }: { questId: string; comment: string }) => questsService.requestChanges(questId, comment),
        onSuccess: () => {
            toast.success("Changes requested");
            invalidate();
            setActionModal(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setActionModal(null);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ questId, reason }: { questId: string; reason: string }) => questsService.reject(questId, reason),
        onSuccess: () => {
            toast.success("Quest rejected");
            invalidate();
            setActionModal(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setActionModal(null);
        },
    });

    const handleActionConfirm = (text: string) => {
        if (!actionModal) return;
        const { action, questId } = actionModal;
        if (action === "approve") approveMutation.mutate(questId);
        else if (action === "requestChanges") requestChangesMutation.mutate({ questId, comment: text });
        else if (action === "reject") rejectMutation.mutate({ questId, reason: text });
    };

    const active = tab === "review-queue" ? reviewQueue : allQuests;
    const rows = active.data?.quests ?? [];
    const pagination = active.data?.pagination;
    const reviewTotal = reviewQueue.data?.pagination.total;

    const openDelete = (q: QuestListEntry) => {
        setHardDelete(false);
        setDeleteTarget({ questId: q.id, title: q.title || "Untitled" });
    };
    const openAction = (action: QuestActionType, q: QuestListEntry) => setActionModal({ action, questId: q.id, questTitle: q.title || "Quest" });

    const columns: DataColumn<QuestListEntry>[] = [
        {
            id: "title",
            header: "Quest",
            hideable: false,
            sortValue: (q) => q.title ?? "",
            csv: (q) => q.title ?? "",
            cell: (q) => (
                <div className="min-w-0">
                    <Link to={`/quests/${q.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                        {q.title || "Untitled quest"}
                    </Link>
                    {(q.theme?.length ?? 0) > 0 && <div className="mt-0.5 truncate text-xs capitalize text-ink-muted">{q.theme.join(", ")}</div>}
                </div>
            ),
        },
        {
            id: "region",
            header: "Region",
            sortValue: (q) => q.region_name ?? "",
            csv: (q) => q.region_name ?? q.region_id ?? "",
            cell: (q) =>
                q.region_id ? (
                    <Link to={`/regions/${q.region_id}`} className="text-accent-700 hover:underline">
                        {q.region_name || "Region"}
                    </Link>
                ) : (
                    <span className="text-ink-faint">No region</span>
                ),
        },
        { id: "status", header: "Status", sortValue: (q) => q.status, cell: (q) => <QuestStatusPill status={q.status} /> },
        {
            id: "difficulty",
            header: "Difficulty",
            sortValue: (q) => q.difficulty ?? "",
            cell: (q) => (q.difficulty ? <Tag className="capitalize">{q.difficulty}</Tag> : <span className="text-ink-faint">—</span>),
        },
        {
            id: "price",
            header: "Price",
            align: "right",
            sortValue: (q) => q.price,
            csv: (q) => q.price,
            cell: (q) => <span className={q.price > 0 ? "whitespace-nowrap tabular-nums text-ink" : "font-medium text-good"}>{priceText(q)}</span>,
        },
        {
            id: "duration",
            header: "Duration",
            sortValue: (q) => q.duration_minutes ?? 0,
            csv: (q) => q.duration_minutes ?? "",
            cell: (q) => <span className="whitespace-nowrap text-ink-muted">{formatDuration(q.duration_minutes)}</span>,
        },
        { id: "places", header: "Places", align: "right", defaultHidden: true, sortValue: (q) => q.total_markers, cell: (q) => <span className="tabular-nums text-ink-muted">{q.total_markers}</span> },
        {
            id: "created",
            header: "Created",
            sortValue: (q) => q.created_at ?? "",
            csv: (q) => formatDate(q.created_at),
            cell: (q) => <span className="whitespace-nowrap text-ink-muted">{formatDate(q.created_at)}</span>,
        },
    ];

    const rowActions = (q: QuestListEntry) => {
        const title = q.title || "quest";
        return (
            <>
                {tab === "review-queue" && (
                    <span className="hidden items-center gap-0.5 md:flex">
                        <IconButton icon={CheckCircle} size="sm" label={`Approve ${title}`} className="hover:bg-good-soft hover:text-good" onClick={() => openAction("approve", q)} />
                        <IconButton icon={AlertCircle} size="sm" label={`Request changes on ${title}`} className="hover:bg-warn-soft hover:text-warn" onClick={() => openAction("requestChanges", q)} />
                        <IconButton icon={XCircle} size="sm" label={`Reject ${title}`} className="hover:bg-bad-soft hover:text-bad" onClick={() => openAction("reject", q)} />
                    </span>
                )}
                <span className="hidden items-center gap-0.5 md:flex">
                    <IconButton icon={Eye} size="sm" label={`Quick view of ${title}`} onClick={() => setViewingQuest(q)} />
                    {canDelete && <IconButton icon={Trash2} size="sm" label={`Delete ${title}`} className="hover:bg-bad-soft hover:text-bad" onClick={() => openDelete(q)} />}
                </span>
                <span className="md:hidden">
                    <Menu
                        label={`Actions for ${title}`}
                        triggerVariant="ghost"
                        size="sm"
                        items={[
                            { label: "Approve", icon: CheckCircle, onSelect: () => openAction("approve", q), hidden: tab !== "review-queue" },
                            { label: "Request changes", icon: AlertCircle, onSelect: () => openAction("requestChanges", q), hidden: tab !== "review-queue" },
                            { label: "Reject", icon: XCircle, danger: true, onSelect: () => openAction("reject", q), hidden: tab !== "review-queue" },
                            { label: "Quick view", icon: Eye, onSelect: () => setViewingQuest(q) },
                            { label: "Delete quest", icon: Trash2, danger: true, onSelect: () => openDelete(q), hidden: !canDelete },
                        ]}
                    />
                </span>
            </>
        );
    };

    const chips: FilterChip[] = [];
    if (statusFilter) chips.push({ key: "status", label: chipLabel("Status", statusFilter, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (difficultyFilter) chips.push({ key: "difficulty", label: chipLabel("Difficulty", difficultyFilter, DIFFICULTY_OPTIONS), onRemove: () => set({ difficulty: "" }) });
    if (themeFilter) chips.push({ key: "theme", label: chipLabel("Theme", themeFilter, THEME_OPTIONS), onRemove: () => set({ theme: "" }) });
    if (regionFilter) {
        const name = rows.find((q) => q.region_id === regionFilter)?.region_name;
        chips.push({ key: "region", label: `Region: ${name ?? "selected"}`, onRemove: () => set({ region: "" }) });
    }
    const filtered = chips.length > 0 || !!state.q;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Compass}
                title="Quests"
                description={
                    <>
                        Review and manage quests
                        {allQuests.data && tab === "all" && <span className="text-ink-faint"> · {allQuests.data.pagination.total.toLocaleString("en-IN")} match</span>}
                    </>
                }
            />

            <Tabs<Tab>
                label="Quest views"
                tabs={[
                    { value: "all", label: "All quests" },
                    { value: "review-queue", label: "Review queue", count: reviewTotal },
                ]}
                value={tab}
                onChange={(v) => set({ tab: v, page: 1 })}
            />

            {tab === "all" && (
                <FilterBar
                    search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search by title…" }}
                    chips={chips}
                    onReset={() => {
                        setSearchInput("");
                        reset();
                    }}
                >
                    <EntityPicker type="region" variant="filter" label="Region" placeholder="Region…" value={regionFilter} onChange={(id) => set({ region: id })} />
                    <FilterSelect label="Status" value={statusFilter} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                    <FilterSelect label="Difficulty" value={difficultyFilter} onChange={(v) => set({ difficulty: v })} options={DIFFICULTY_OPTIONS} allLabel="All difficulties" />
                    <FilterSelect label="Theme" value={themeFilter} onChange={(v) => set({ theme: v })} options={THEME_OPTIONS} allLabel="All themes" />
                </FilterBar>
            )}

            <DataTable
                label={tab === "review-queue" ? "Quests waiting for review" : "Quests"}
                rows={rows}
                columns={columns}
                rowKey={(q) => q.id}
                isLoading={active.isLoading && !active.data}
                isFetching={active.isFetching && !!active.data}
                error={active.error}
                onRetry={() => active.refetch()}
                empty={
                    tab === "review-queue"
                        ? { icon: CheckCircle, title: "No quests waiting for review.", description: "You're up to date." }
                        : { icon: Compass, title: "No quests found.", description: filtered ? "Try adjusting or clearing the filters." : undefined }
                }
                onRowClick={(q) => setViewingQuest(q)}
                rowActions={rowActions}
                storageKey="quests"
                exportName={tab === "review-queue" ? "quest-review-queue" : "quests"}
                summary={pagination ? `${rows.length} of ${pagination.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (q) => q.title || "Untitled quest",
                    subtitle: (q) => q.region_name ?? undefined,
                    fields: ["status", "price", "duration", "created"],
                }}
                footer={
                    pagination && (
                        <Pagination page={pagination.page} totalPages={pagination.total_pages} total={pagination.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                    )
                }
            />

            {/* Quick view */}
            <QuestDetailModal
                open={!!viewingQuest}
                questId={viewingQuest?.id ?? null}
                questTitle={viewingQuest?.title ?? ""}
                questStatus={viewingQuest?.status ?? "Draft"}
                onClose={() => setViewingQuest(null)}
                canDelete={canDelete}
                onDelete={(questId) => {
                    setViewingQuest(null);
                    setHardDelete(false);
                    setDeleteTarget({ questId, title: viewingQuest?.title || "Quest" });
                }}
            />

            {/* Delete — soft delete archives; a permanent delete asks for the title */}
            <ConfirmDialog
                open={!!deleteTarget}
                title={hardDelete ? "Permanently delete quest?" : "Delete quest?"}
                description={
                    hardDelete
                        ? `All data of "${deleteTarget?.title ?? ""}" is removed for good.`
                        : `"${deleteTarget?.title ?? ""}" is archived and disappears from the app.`
                }
                confirmLabel={hardDelete ? "Delete permanently" : "Delete"}
                tone="danger"
                level={hardDelete ? "type" : "simple"}
                typeToConfirm={hardDelete ? deleteTarget?.title.trim() || "DELETE" : undefined}
                isPending={deleteMutation.isPending}
                onConfirm={() => deleteTarget && deleteMutation.mutate({ questId: deleteTarget.questId, hard: hardDelete })}
                onCancel={() => setDeleteTarget(null)}
            >
                <Checkbox checked={hardDelete} onChange={setHardDelete} label="Delete permanently" hint="Removes all data. This can't be undone." />
            </ConfirmDialog>

            {/* Review decisions */}
            <QuestActionModal
                open={!!actionModal}
                action={actionModal?.action ?? null}
                questTitle={actionModal?.questTitle ?? ""}
                isPending={approveMutation.isPending || requestChangesMutation.isPending || rejectMutation.isPending}
                onConfirm={handleActionConfirm}
                onCancel={() => setActionModal(null)}
            />
        </div>
    );
}
