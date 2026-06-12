import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
    BookOpen,
    Search,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Paperclip,
    Activity,
    Eye,
    Trash2,
    X,
    AudioLines,
    Play,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@store/auth.store";
import { narrativesService } from "../services/narratives.service";
import type { AdminNarrative, NarrativeStatus, NarrativeAttachType, VoicePersona } from "@/types";
import { usePaginationRange } from "@/hooks/usePagination";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Badge } from "@/components/ui/Badge";
import { playVoicePreview, PERSONAS } from "../components/voicePersonas";
import { useBulkSelection, runBulk } from "@/hooks/useBulkSelection";

const CAN_MODERATE_ROLES = ["admin", "super_admin", "moderator"];
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_OPTIONS: { value: NarrativeStatus | ""; label: string }[] = [
    { value: "", label: "All statuses" },
    { value: "draft", label: "Draft" },
    { value: "under_review", label: "Under review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "archived", label: "Archived" },
];



type TabKey = "queue" | "all";

export function NarrativesPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const canModerate = user?.role?.some((r) => CAN_MODERATE_ROLES.includes(r as string));

    const [tab, setTab] = useState<TabKey>("queue");
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

    const deleteMutation = useMutation({
        mutationFn: (id: string) => narrativesService.remove(id),
        onSuccess: () => {
            toast.success("Narrative deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-narratives-queue"] });
            queryClient.invalidateQueries({ queryKey: ["admin-narratives"] });
            setConfirmDelete(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    return (
        <div className="p-6 max-w-[1400px] mx-auto animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm text-white">
                        <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
                            Narratives
                        </h1>
                        <p className="mt-1 text-sm text-neutral-500">Review, moderate and publish quest narratives</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-1 border-b border-neutral-200">
                <button
                    onClick={() => setTab("queue")}
                    className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                        tab === "queue"
                            ? "border-orange-600 text-orange-600"
                            : "border-transparent text-neutral-500 hover:text-neutral-800"
                    }`}
                >
                    Review Queue
                </button>
                <button
                    onClick={() => setTab("all")}
                    className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                        tab === "all"
                            ? "border-orange-600 text-orange-600"
                            : "border-transparent text-neutral-500 hover:text-neutral-800"
                    }`}
                >
                    All Narratives
                </button>
            </div>

            {tab === "queue" ? (
                <ReviewQueueTab
                    canModerate={!!canModerate}
                    queryClient={queryClient}
                    onDelete={(id, name) => setConfirmDelete({ id, name })}
                />
            ) : (
                <AllNarrativesTab
                    canModerate={!!canModerate}
                    onDelete={(id, name) => setConfirmDelete({ id, name })}
                />
            )}

            <ConfirmModal
                open={!!confirmDelete}
                title="Delete Narrative"
                message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />
        </div>
    );
}

function NarrativeRow({
    n,
    selectable,
    checked,
    onCheck,
    canModerate,
    onDelete,
}: {
    n: AdminNarrative;
    selectable?: boolean;
    checked?: boolean;
    onCheck?: (id: string, checked: boolean) => void;
    canModerate?: boolean;
    onDelete?: (id: string, name: string) => void;
}) {
    return (
        <tr className="group hover:bg-neutral-50/80 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200">
            {selectable && (
                <td className="whitespace-nowrap px-4 py-4">
                    <input
                        type="checkbox"
                        className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                        checked={checked}
                        onChange={(e) => onCheck?.(n._id, e.target.checked)}
                    />
                </td>
            )}
            <td className="px-4 py-4">
                <Link to={`/narratives/${n._id}`} className="block">
                    <div className="font-medium text-neutral-900">{n.title || "Untitled"}</div>
                    {n.subtitle && <div className="mt-0.5 text-xs text-neutral-500">{n.subtitle}</div>}
                </Link>
            </td>
            <td className="whitespace-nowrap px-4 py-4">
                <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium capitalize text-orange-700">
                    {n.attach_type}
                </span>
            </td>
            <td className="whitespace-nowrap px-4 py-4">
                <Badge
                    label={n.status.replace(/_/g, " ")}
                    styles={
                        n.status === "draft" ? "bg-neutral-50 text-neutral-700 border-neutral-200" :
                        n.status === "under_review" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        n.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        n.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-neutral-100 text-neutral-600 border-neutral-300"
                    }
                />
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-neutral-600">
                {n.voice_persona ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            playVoicePreview(n.voice_persona as VoicePersona);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-orange-100 hover:text-orange-700 transition-colors group"
                        title="Play voice sample"
                    >
                        <Play className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                        {PERSONAS.find(p => p.id === n.voice_persona)?.label || n.voice_persona.replace(/_/g, " ")}
                    </button>
                ) : (
                    "—"
                )}
            </td>
            <td className="whitespace-nowrap px-4 py-4">
                <Badge
                    label={n.audio_status.replace(/_/g, " ")}
                    styles={
                        n.audio_status === "pending" ? "bg-neutral-50 text-neutral-600 border-neutral-200" :
                        n.audio_status === "generating" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        n.audio_status === "ready" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        n.audio_status === "failed" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                    }
                />
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-neutral-600">{n.view_count}</td>
            <td className="whitespace-nowrap px-4 py-4 text-neutral-500">
                {n.created_at ? new Date(n.created_at).toLocaleDateString() : "N/A"}
            </td>
            {canModerate && (
                <td className="whitespace-nowrap px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Link
                            to={`/narratives/${n._id}`}
                            title="View details"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-orange-600 hover:bg-orange-50 transition-all active:scale-95 inline-flex"
                        >
                            <Eye className="w-4 h-4" />
                        </Link>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.(n._id, n.title || "this narrative");
                            }}
                            title="Delete narrative"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </td>
            )}
        </tr>
    );
}


function ReviewQueueTab({
    canModerate,
    queryClient,
    onDelete,
}: {
    canModerate: boolean;
    queryClient: ReturnType<typeof useQueryClient>;
    onDelete: (id: string, name: string) => void;
}) {
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-narratives-queue", { page }],
        queryFn: () => narrativesService.reviewQueue(page, PAGE_SIZE),
        staleTime: 60 * 1000,
    });

    const narratives = data?.narratives ?? [];
    const totalPages = data?.total_pages ?? 1;
    const paginationRange = usePaginationRange(totalPages, page);

    const sel = useBulkSelection(narratives.map((n) => n._id));
    const [confirmBulk, setConfirmBulk] = useState<null | "approve" | "delete">(null);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-narratives-queue"] });
        queryClient.invalidateQueries({ queryKey: ["admin-narratives"] });
    };

    const bulkApprove = useMutation({
        mutationFn: (ids: string[]) => narrativesService.bulkApprove(ids),
        onSuccess: (res) => {
            invalidate();
            toast.success(`Approved ${res.approved ?? sel.count} narratives`);
            if (res.failed && res.failed.length > 0) {
                toast.error(`${res.failed.length} could not be approved`);
            }
            sel.clear();
            setConfirmBulk(null);
        },
        onError: () => {
            toast.error("Bulk approve failed");
            setConfirmBulk(null);
        },
    });

    const bulkAudio = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => narrativesService.generateAudio(id)),
        onSuccess: ({ ok, failed }) => {
            invalidate();
            toast.success(`Queued audio generation for ${ok} narrative${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be queued`);
            sel.clear();
        },
        onError: () => toast.error("Bulk audio generation failed"),
    });

    const bulkDelete = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => narrativesService.remove(id)),
        onSuccess: ({ ok, failed }) => {
            invalidate();
            toast.success(`Deleted ${ok} narrative${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be deleted`);
            sel.clear();
            setConfirmBulk(null);
        },
        onError: () => {
            toast.error("Bulk delete failed");
            setConfirmBulk(null);
        },
    });

    const busy = bulkApprove.isPending || bulkAudio.isPending || bulkDelete.isPending;

    if (isLoading) return <LoadingFallback message="Loading review queue..." />;
    if (error) return <div className="p-6 text-center text-red-500">Failed to load review queue.</div>;

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-600">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                            <strong>{data?.total ?? 0}</strong> narratives awaiting review
                        </span>
                    </p>
                </div>
                {/* Bulk Actions Bar */}
                {sel.count > 0 && canModerate && (
                    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-orange-50 rounded-xl border border-orange-100 animate-slide-up">
                        <span className="text-sm font-semibold text-orange-700">
                            {sel.count} selected
                        </span>
                        <div className="h-4 w-px bg-orange-200" />
                        <button onClick={() => setConfirmBulk("approve")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                        <button onClick={() => bulkAudio.mutate(sel.ids)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"><AudioLines className="w-3.5 h-3.5" /> Generate audio</button>
                        <button onClick={() => setConfirmBulk("delete")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                        <button onClick={sel.clear} className="ml-auto text-xs text-neutral-500 hover:text-neutral-700">Deselect all</button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80 backdrop-blur-sm">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                {canModerate && (
                                    <th className="px-4 py-4 text-left">
                                        <input
                                            type="checkbox"
                                            className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                                            checked={sel.allSelected}
                                            ref={(el) => { if (el) el.indeterminate = sel.someSelected; }}
                                            onChange={(e) => sel.toggleAll(e.target.checked)}
                                        />
                                    </th>
                                )}
                                <th className="px-4 py-4 text-left">Title</th>
                                <th className="px-4 py-4 text-left">Attach</th>
                                <th className="px-4 py-4 text-left">Status</th>
                                <th className="px-4 py-4 text-left">Voice</th>
                                <th className="px-4 py-4 text-left">Audio</th>
                                <th className="px-4 py-4 text-left">Views</th>
                                <th className="px-4 py-4 text-left">Created</th>
                                {canModerate && (
                                    <th className="px-4 py-4 text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                            {narratives.map((n) => (
                                <NarrativeRow
                                    key={n._id}
                                    n={n}
                                    selectable={canModerate}
                                    checked={sel.selected.has(n._id)}
                                    onCheck={sel.toggle}
                                    canModerate={canModerate}
                                    onDelete={onDelete}
                                />
                            ))}
                            {narratives.length === 0 && (
                                <tr>
                                    <td colSpan={canModerate ? 9 : 7} className="px-4 py-12 text-center text-neutral-500">
                                        <div className="flex flex-col items-center">
                                            <BookOpen className="mb-4 h-12 w-12 text-neutral-300" />
                                            <p>The review queue is empty.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-neutral-100 flex items-center justify-between bg-white">
                        <span className="text-sm text-neutral-500">
                            Showing page {page} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-2 border border-neutral-200 rounded-xl hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {paginationRange.map((pageNumber, idx) => {
                                if (pageNumber === "...") {
                                    return (
                                        <span key={`ellipsis-${idx}`} className="px-2 py-1 text-neutral-500">
                                            ...
                                        </span>
                                    );
                                }
                                return (
                                    <button
                                        key={pageNumber}
                                        onClick={() => setPage(pageNumber as number)}
                                        className={`px-3 py-1 border rounded-xl text-sm transition-colors ${
                                            pageNumber === page
                                                ? "bg-orange-600 border-orange-600 text-white"
                                                : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                                        }`}
                                    >
                                        {pageNumber}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-2 border border-neutral-200 rounded-xl hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Removed BulkActionBar */}

            <ConfirmModal
                open={confirmBulk === "approve"}
                title="Bulk Approve Narratives"
                message={`Approve ${sel.count} pending ${sel.count === 1 ? "narrative" : "narratives"}? Approved narratives become publicly visible immediately.`}
                confirmLabel={`Approve ${sel.count}`}
                confirmStyle="bg-emerald-600 hover:bg-emerald-700"
                onConfirm={() => bulkApprove.mutate(sel.ids)}
                onCancel={() => setConfirmBulk(null)}
                isPending={bulkApprove.isPending}
            />
            <ConfirmModal
                open={confirmBulk === "delete"}
                title="Bulk Delete Narratives"
                message={`Delete ${sel.count} ${sel.count === 1 ? "narrative" : "narratives"}? This cannot be undone.`}
                confirmLabel={`Delete ${sel.count}`}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => bulkDelete.mutate(sel.ids)}
                onCancel={() => setConfirmBulk(null)}
                isPending={bulkDelete.isPending}
            />
        </div>
    );
}

const ATTACH_OPTIONS: { value: NarrativeAttachType | ""; label: string }[] = [
    { value: "", label: "All types" },
    { value: "marker", label: "Marker" },
    { value: "quest", label: "Quest" },
    { value: "region", label: "Region" },
];

function AllNarrativesTab({
    canModerate,
    onDelete,
}: {
    canModerate: boolean;
    onDelete: (id: string, name: string) => void;
}) {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<NarrativeStatus | "">("");
    const [attachType, setAttachType] = useState<NarrativeAttachType | "">("");
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [confirmBulk, setConfirmBulk] = useState<null | "approve" | "delete">(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-narratives", { status, attachType, page, search: debouncedSearch }],
        queryFn: () =>
            narrativesService.list({
                page,
                page_size: PAGE_SIZE,
                status: status || undefined,
                attach_type: attachType || undefined,
                search: debouncedSearch || undefined,
            }),
        staleTime: 60 * 1000,
    });

    const narratives = data?.narratives ?? [];
    const totalPages = data?.total_pages ?? 1;
    const paginationRange = usePaginationRange(totalPages, page);

    const sel = useBulkSelection(narratives.map((n) => n._id));
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-narratives"] });
        queryClient.invalidateQueries({ queryKey: ["admin-narratives-queue"] });
    };
    const bulkApprove = useMutation({
        mutationFn: (ids: string[]) => narrativesService.bulkApprove(ids),
        onSuccess: (res) => {
            invalidate();
            toast.success(`Approved ${res.approved ?? sel.count} narratives`);
            if (res.failed && res.failed.length > 0) toast.error(`${res.failed.length} could not be approved`);
            sel.clear();
            setConfirmBulk(null);
        },
        onError: () => { toast.error("Bulk approve failed"); setConfirmBulk(null); },
    });
    const bulkAudio = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => narrativesService.generateAudio(id)),
        onSuccess: ({ ok, failed }) => {
            invalidate();
            toast.success(`Queued audio generation for ${ok} narrative${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be queued`);
            sel.clear();
        },
        onError: () => toast.error("Bulk audio generation failed"),
    });
    const bulkDelete = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => narrativesService.remove(id)),
        onSuccess: ({ ok, failed }) => {
            invalidate();
            toast.success(`Deleted ${ok} narrative${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be deleted`);
            sel.clear();
            setConfirmBulk(null);
        },
        onError: () => { toast.error("Bulk delete failed"); setConfirmBulk(null); },
    });
    const busy = bulkApprove.isPending || bulkAudio.isPending || bulkDelete.isPending;

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search narratives..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full rounded-xl py-2.5 px-4 pl-10 border border-neutral-200 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        {searchInput && (
                            <button
                                onClick={() => { setSearchInput(""); setDebouncedSearch(""); setPage(1); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <FilterDropdown
                        options={ATTACH_OPTIONS}
                        value={attachType}
                        onChange={(val) => {
                            setAttachType(val as NarrativeAttachType | "");
                            setPage(1);
                        }}
                        theme="orange"
                        placeholder="All types"
                        icon={<Paperclip className="w-4 h-4 text-orange-500" />}
                    />
                    <FilterDropdown
                        options={STATUS_OPTIONS}
                        value={status}
                        onChange={(val) => {
                            setStatus(val as NarrativeStatus | "");
                            setPage(1);
                        }}
                        theme="orange"
                        placeholder="All statuses"
                        icon={<Activity className="w-4 h-4 text-orange-500" />}
                    />
                </div>
                {/* Bulk Actions Bar */}
                {sel.count > 0 && canModerate && (
                    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-orange-50 rounded-xl border border-orange-100 animate-slide-up">
                        <span className="text-sm font-semibold text-orange-700">
                            {sel.count} selected
                        </span>
                        <div className="h-4 w-px bg-orange-200" />
                        <button onClick={() => setConfirmBulk("approve")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                        <button onClick={() => bulkAudio.mutate(sel.ids)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"><AudioLines className="w-3.5 h-3.5" /> Generate audio</button>
                        <button onClick={() => setConfirmBulk("delete")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                        <button onClick={sel.clear} className="ml-auto text-xs text-neutral-500 hover:text-neutral-700">Deselect all</button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <LoadingFallback message="Loading narratives..." />
                ) : error ? (
                    <div className="p-6 text-center text-red-500">Failed to load narratives.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-neutral-200 text-sm">
                            <thead className="border-b border-neutral-200/60 bg-neutral-50/80 backdrop-blur-sm">
                                <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                    {canModerate && (
                                        <th className="px-4 py-4 text-left">
                                            <input
                                                type="checkbox"
                                                className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                                                checked={sel.allSelected}
                                                ref={(el) => { if (el) el.indeterminate = sel.someSelected; }}
                                                onChange={(e) => sel.toggleAll(e.target.checked)}
                                            />
                                        </th>
                                    )}
                                    <th className="px-4 py-4 text-left">Title</th>
                                    <th className="px-4 py-4 text-left">Attach</th>
                                    <th className="px-4 py-4 text-left">Status</th>
                                    <th className="px-4 py-4 text-left">Voice</th>
                                    <th className="px-4 py-4 text-left">Audio</th>
                                    <th className="px-4 py-4 text-left">Views</th>
                                    <th className="px-4 py-4 text-left">Created</th>
                                    {canModerate && (
                                        <th className="px-4 py-4 text-right">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 bg-white">
                                {narratives.map((n) => (
                                    <NarrativeRow
                                        key={n._id}
                                        n={n}
                                        selectable={canModerate}
                                        checked={sel.selected.has(n._id)}
                                        onCheck={sel.toggle}
                                        canModerate={canModerate}
                                        onDelete={onDelete}
                                    />
                                ))}
                                {narratives.length === 0 && (
                                    <tr>
                                        <td colSpan={canModerate ? 9 : 7} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center">
                                                <BookOpen className="mb-4 h-12 w-12 text-neutral-300" />
                                                <p>No narratives found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="p-4 border-t border-neutral-100 flex items-center justify-between bg-white">
                        <span className="text-sm text-neutral-500">
                            Showing page {page} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-2 border border-neutral-200 rounded-xl hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {paginationRange.map((pageNumber, idx) => {
                                if (pageNumber === "...") {
                                    return (
                                        <span key={`ellipsis-${idx}`} className="px-2 py-1 text-neutral-500">
                                            ...
                                        </span>
                                    );
                                }
                                return (
                                    <button
                                        key={pageNumber}
                                        onClick={() => setPage(pageNumber as number)}
                                        className={`px-3 py-1 border rounded-xl text-sm transition-colors ${
                                            pageNumber === page
                                                ? "bg-orange-600 border-orange-600 text-white"
                                                : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                                        }`}
                                    >
                                        {pageNumber}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-2 border border-neutral-200 rounded-xl hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Removed BulkActionBar */}

            <ConfirmModal
                open={confirmBulk === "approve"}
                title="Bulk Approve Narratives"
                message={`Approve ${sel.count} ${sel.count === 1 ? "narrative" : "narratives"}? Only those under review will change; approved narratives become publicly visible.`}
                confirmLabel={`Approve ${sel.count}`}
                confirmStyle="bg-emerald-600 hover:bg-emerald-700"
                onConfirm={() => bulkApprove.mutate(sel.ids)}
                onCancel={() => setConfirmBulk(null)}
                isPending={bulkApprove.isPending}
            />
            <ConfirmModal
                open={confirmBulk === "delete"}
                title="Bulk Delete Narratives"
                message={`Delete ${sel.count} ${sel.count === 1 ? "narrative" : "narratives"}? This cannot be undone.`}
                confirmLabel={`Delete ${sel.count}`}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => bulkDelete.mutate(sel.ids)}
                onCancel={() => setConfirmBulk(null)}
                isPending={bulkDelete.isPending}
            />
        </div>
    );
}

