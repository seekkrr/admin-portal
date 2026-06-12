import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { markersService } from "../services/markers.service";
import { FilterDropdown } from "@/components/FilterDropdown";
import { usePaginationRange } from "@/hooks/usePagination";
import {
    MapPin,
    Search,
    Plus,
    ChevronLeft,
    ChevronRight,
    Folder,
    Hash,
    Eye,
    Trash2,
    Inbox,
} from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LoadingFallback } from "@components/LoadingFallback";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Badge } from "@/components/ui/Badge";
import { useBulkSelection, runBulk } from "@/hooks/useBulkSelection";
import { MarkerCreateModal } from "../components/MarkerCreateModal";
import type { MarkerStatus } from "@/types";

const STATUS_OPTIONS: { value: "" | MarkerStatus; label: string }[] = [
    { value: "", label: "All statuses" },
    { value: "approved", label: "Approved" },
    { value: "pending", label: "Pending" },
    { value: "hidden", label: "Hidden" },
    { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<MarkerStatus, string> = {
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    hidden: "bg-neutral-100 text-neutral-600 border-neutral-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
};


export function MarkersPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const CAN_MANAGE = user?.role?.some((r) => ["admin", "super_admin"].includes(r));

    const [page, setPage] = useState(1);
    const [perPage] = useState(20);
    const [status, setStatus] = useState<"" | MarkerStatus>("");
    const [category, setCategory] = useState("");
    const [tags, setTags] = useState("");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [showCreate, setShowCreate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-markers", { status, category, tags, q: debouncedSearch, page }],
        queryFn: () =>
            markersService.list({
                status: status || undefined,
                category: category || undefined,
                tags: tags || undefined,
                search: debouncedSearch || undefined,
                page,
                page_size: perPage,
            }),
        staleTime: 5 * 60 * 1000,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => markersService.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            setConfirmDelete(null);
            toast.success("Marker deleted successfully");
        },
        onError: () => {
            toast.error("Failed to delete marker");
            setConfirmDelete(null);
        }
    });

    const paginationRange = usePaginationRange(data?.total_pages ?? 1, page);
    const markers = data?.markers ?? [];

    const sel = useBulkSelection(markers.map((m) => m.id));
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const bulkDelete = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => markersService.remove(id)),
        onSuccess: ({ ok, failed }) => {
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            toast.success(`Deleted ${ok} marker${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be deleted`);
            sel.clear();
            setConfirmBulkDelete(false);
        },
        onError: () => { toast.error("Bulk delete failed"); setConfirmBulkDelete(false); },
    });

    const hasPrev = (data?.page || 1) > 1;
    const hasNext = (data?.page || 1) < (data?.total_pages || 1);

    if (isLoading) return <LoadingFallback message="Loading markers..." />;

    if (error) {
        return <div className="p-6 text-center text-red-500">Failed to load markers.</div>;
    }

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-sm">
                        <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Markers</h1>
                        <p className="text-sm text-neutral-500">
                            Moderate points of interest across regions
                            {data && <span className="ml-2 text-neutral-400">· {data.total} total</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/markers/applications"
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors border border-orange-200"
                    >
                        <Inbox className="w-4 h-4" />
                        Applications
                    </Link>
                    {CAN_MANAGE && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Marker
                        </button>
                    )}
                </div>
            </div>

            {/* Table and Filters */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search markers..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") setPage(1);
                            }}
                        />
                    </div>
                    <FilterDropdown
                        value={status}
                        onChange={(val) => {
                            setStatus(val as "" | MarkerStatus);
                            setPage(1);
                        }}
                        options={STATUS_OPTIONS}
                        theme="orange"
                        placeholder="All Statuses"
                    />
                    <div className="relative">
                        <Folder className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Category..."
                            className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:max-w-[180px] transition-shadow"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") setPage(1);
                            }}
                        />
                    </div>
                    <div className="relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Tags..."
                            className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:max-w-[180px] transition-shadow"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") setPage(1);
                            }}
                        />
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {sel.count > 0 && CAN_MANAGE && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-50 rounded-xl border border-orange-100 animate-slide-up">
                        <span className="text-sm font-semibold text-orange-700">
                            {sel.count} selected
                        </span>
                        <div className="h-4 w-px bg-orange-200" />
                        <button
                            onClick={() => setConfirmBulkDelete(true)}
                            disabled={bulkDelete.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <button
                            onClick={sel.clear}
                            className="ml-auto text-xs text-neutral-500 hover:text-neutral-700"
                        >
                            Deselect all
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80 backdrop-blur-sm">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                {CAN_MANAGE && (
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
                                <th className="px-4 py-4 text-left">Category</th>
                                <th className="px-4 py-4 text-left">Status</th>
                                <th className="px-4 py-4 text-left">Region</th>
                                <th className="px-4 py-4 text-right">Usage</th>
                                <th className="px-4 py-4 text-left">Created</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                            <tbody className="bg-white divide-y divide-neutral-200">
                                {markers.map((m) => (
                                    <tr key={m.id} className="group hover:bg-neutral-50/80 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200">
                                        {CAN_MANAGE && (
                                            <td className="px-4 py-4">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                                                    checked={sel.selected.has(m.id)}
                                                    onChange={(e) => sel.toggle(m.id, e.target.checked)}
                                                />
                                            </td>
                                        )}
                                        <td className="px-4 py-4">
                                            <Link to={`/markers/${m.id}`} className="font-medium text-neutral-900 hover:text-orange-600">
                                                {m.title}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4">
                                            {m.category ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 capitalize border border-neutral-200">
                                                    {m.category}
                                                </span>
                                            ) : (
                                                <span className="text-neutral-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge label={m.status} styles={STATUS_BADGE[m.status]} />
                                        </td>
                                        <td className="px-4 py-4">
                                            {m.region_id ? (
                                                <Link
                                                    to={`/regions/${m.region_id}`}
                                                    className="text-xs font-mono text-cyan-600 hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {m.region_id.slice(0, 8)}…
                                                </Link>
                                            ) : (
                                                <span className="text-neutral-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right text-neutral-600">{m.usage_count}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                            {m.created_at ? new Date(m.created_at).toLocaleDateString() : "N/A"}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => navigate(`/markers/${m.id}`)}
                                                    title="View details"
                                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-orange-600 hover:bg-orange-50 transition-all active:scale-95"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {CAN_MANAGE && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmDelete({ id: m.id, name: m.title });
                                                        }}
                                                        title="Delete marker"
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {markers.length === 0 && (
                                    <tr>
                                        <td colSpan={CAN_MANAGE ? 8 : 7} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <MapPin className="w-12 h-12 text-neutral-300 mb-4" />
                                                <p>No markers found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data && data.total_pages > 1 && (
                        <div className="p-4 border-t border-neutral-200 flex items-center justify-between bg-white">
                            <span className="text-sm text-neutral-500">
                                Showing page {data.page} of {data.total_pages} ({data.total} total)
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={!hasPrev}
                                    className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {paginationRange.map((pageNumber, i) =>
                                    pageNumber === "..." ? (
                                        <span key={`ellipsis-${i}`} className="px-3 py-2 text-neutral-400">
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={pageNumber}
                                            onClick={() => setPage(pageNumber as number)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                page === pageNumber
                                                    ? "bg-orange-50 text-orange-600 font-semibold"
                                                    : "text-neutral-600 hover:bg-neutral-100"
                                            }`}
                                        >
                                            {pageNumber}
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={() => setPage((p) => p + 1)}
                                    disabled={!hasNext}
                                    className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            {/* Removed BulkActionBar */}

            {/* Create Modal */}
            <MarkerCreateModal open={showCreate} onClose={() => setShowCreate(false)} />

            <ConfirmModal
                open={!!confirmDelete}
                title="Delete Marker"
                message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />

            <ConfirmModal
                open={confirmBulkDelete}
                title="Delete Markers"
                message={`Delete ${sel.count} marker${sel.count === 1 ? "" : "s"}? This cannot be undone.`}
                confirmLabel={`Delete ${sel.count}`}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => bulkDelete.mutate(sel.ids)}
                onCancel={() => setConfirmBulkDelete(false)}
                isPending={bulkDelete.isPending}
            />
        </div>
    );
}

