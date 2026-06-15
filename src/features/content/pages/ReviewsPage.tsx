import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Star, MessageSquare, Eye, EyeOff, Trash2 } from "lucide-react";
import { LoadingFallback } from "@components/LoadingFallback";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { useAuthStore } from "@store/auth.store";
import { reviewsService } from "../services/reviews.service";
import { FilterDropdown } from "@/components/FilterDropdown";
import { useBulkSelection, runBulk } from "@/hooks/useBulkSelection";

const PAGE_SIZE = 20;
const CAN_MODERATE_ROLES = ["admin", "super_admin", "moderator"];

type VisibilityFilter = "all" | "visible" | "hidden";
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

function Stars({ rating }: { rating: number }) {
    return (
        <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    className={`h-4 w-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`}
                />
            ))}
        </span>
    );
}

export function ReviewsPage() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const canModerate = user?.role?.some((r) => CAN_MODERATE_ROLES.includes(r as string));

    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState<VisibilityFilter>("all");
    const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

    const isVisible = filter === "all" ? undefined : filter === "visible";

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-reviews", { is_visible: isVisible, page }],
        queryFn: () =>
            reviewsService.list({
                page,
                limit: PAGE_SIZE,
                is_visible: isVisible,
            }),
        staleTime: 60 * 1000,
    });



    const moderateMut = useMutation({
        mutationFn: ({ id, isVisible: v }: { id: string; isVisible: boolean }) =>
            reviewsService.moderate(id, v),
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
            queryClient.invalidateQueries({ queryKey: ["review-detail", updated._id] });
            toast.success(updated.is_visible ? "Review is now visible" : "Review hidden");
        },
        onError: () => toast.error("Failed to update visibility"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => reviewsService.remove(id),
        onSuccess: () => {
            toast.success("Review deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
            setConfirmDelete(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const reviews = useMemo(() => {
        if (!data?.reviews) return [];
        if (ratingFilter === "all") return data.reviews;
        const r = Number(ratingFilter);
        return data.reviews.filter((x) => x.rating === r);
    }, [data, ratingFilter]);

    const sel = useBulkSelection(reviews.map((r) => r._id));
    const [confirmBulk, setConfirmBulk] = useState<null | "delete">(null);
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    const bulkVisibility = useMutation({
        mutationFn: ({ ids, visible }: { ids: string[]; visible: boolean }) =>
            runBulk(ids, (id) => reviewsService.moderate(id, visible)),
        onSuccess: ({ ok, failed }, { visible }) => {
            invalidate();
            toast.success(`${visible ? "Showed" : "Hid"} ${ok} review${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be updated`);
            sel.clear();
        },
        onError: () => toast.error("Bulk visibility update failed"),
    });
    const bulkDelete = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => reviewsService.remove(id)),
        onSuccess: ({ ok, failed }) => {
            invalidate();
            toast.success(`Deleted ${ok} review${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be deleted`);
            sel.clear();
            setConfirmBulk(null);
        },
        onError: () => { toast.error("Bulk delete failed"); setConfirmBulk(null); },
    });
    const busy = bulkVisibility.isPending || bulkDelete.isPending;

    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (isLoading) return <LoadingFallback message="Loading reviews..." />;
    if (error) return <div className="p-6 text-center text-red-500">Failed to load reviews.</div>;

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold text-neutral-900">
                    <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
                        <Star className="h-5 w-5" />
                    </span>
                    Reviews
                </h1>
                <p className="mt-1 text-neutral-500">
                    Moderate quest reviews and creator responses
                </p>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {(["all", "5", "4", "3", "2", "1"] as RatingFilter[]).map((rf) => (
                            <button
                                key={rf}
                                onClick={() => setRatingFilter(rf)}
                                className={`flex items-center gap-1 py-2.5 rounded-xl px-4 text-sm font-medium transition-colors ${
                                    ratingFilter === rf
                                        ? "bg-amber-600 text-white"
                                        : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                                }`}
                            >
                                {rf === "all" ? (
                                    "All"
                                ) : (
                                    <>
                                        {rf}
                                        <Star
                                            className={`h-3.5 w-3.5 ${ratingFilter === rf ? "fill-white" : "fill-amber-400 text-amber-400"}`}
                                        />
                                    </>
                                )}
                            </button>
                        ))}
                    </div>
                    <FilterDropdown
                        options={[
                            { value: "all", label: "All reviews" },
                            { value: "visible", label: "Visible" },
                            { value: "hidden", label: "Hidden" },
                        ]}
                        value={filter}
                        onChange={(val) => {
                            setFilter(val as VisibilityFilter);
                            setPage(1);
                        }}
                        theme="amber"
                        placeholder="All Reviews"
                        icon={<Eye className="w-4 h-4 text-amber-500" />}
                    />
                </div>

                {sel.count > 0 && canModerate && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 rounded-xl border border-amber-100 animate-slide-up">
                        <span className="text-sm font-semibold text-amber-700">
                            {sel.count} selected
                        </span>
                        <div className="h-4 w-px bg-amber-200" />
                        <button
                            onClick={() => bulkVisibility.mutate({ ids: sel.ids, visible: true })}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50"
                        >
                            <Eye className="w-3.5 h-3.5" /> Show
                        </button>
                        <button
                            onClick={() => bulkVisibility.mutate({ ids: sel.ids, visible: false })}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-200 text-neutral-700 text-sm font-medium hover:bg-neutral-300 transition-colors disabled:opacity-50"
                        >
                            <EyeOff className="w-3.5 h-3.5" /> Hide
                        </button>
                        <button
                            onClick={() => setConfirmBulk("delete")}
                            disabled={busy}
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
                                                className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                                                checked={sel.allSelected}
                                                ref={(el) => { if (el) el.indeterminate = sel.someSelected; }}
                                                onChange={(e) => sel.toggleAll(e.target.checked)}
                                            />
                                        </th>
                                    )}
                                    <th className="px-4 py-4 text-left">Rating</th>
                                    <th className="px-4 py-4 text-left">Comment</th>
                                    <th className="px-4 py-4 text-left">Quest</th>
                                    <th className="px-4 py-4 text-left">Visible</th>
                                    <th className="px-4 py-4 text-left">Created</th>
                                    <th className="px-4 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 bg-white">
                                {reviews.map((r) => (
                                    <tr key={r._id} className="group hover:bg-neutral-50/80 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200">
                                        {canModerate && (
                                            <td className="px-4 py-4">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                                                    checked={sel.selected.has(r._id)}
                                                    onChange={(e) => sel.toggle(r._id, e.target.checked)}
                                                />
                                            </td>
                                        )}
                                        <td className="whitespace-nowrap px-4 py-4">
                                            <Link to={`/reviews/${r._id}`}>
                                                <Stars rating={r.rating} />
                                            </Link>
                                        </td>
                                        <td className="max-w-xs px-4 py-4">
                                            <Link to={`/reviews/${r._id}`} className="block truncate text-neutral-700">
                                                {r.comment || <span className="italic text-neutral-400">No comment</span>}
                                            </Link>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4">
                                            {r.quest_id ? (
                                                <Link
                                                    to={`/quests/${r.quest_id}`}
                                                    className="inline-flex items-center gap-1 text-xs font-mono text-orange-600 hover:text-orange-700 hover:underline"
                                                    title={r.quest_id}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {r.quest_id.slice(0, 8)}…
                                                </Link>
                                            ) : (
                                                <span className="text-neutral-400">—</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4">
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                    r.is_visible
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-neutral-200 text-neutral-600"
                                                }`}
                                            >
                                                {r.is_visible ? "Visible" : "Hidden"}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 text-neutral-500">
                                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : "N/A"}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    to={`/reviews/${r._id}`}
                                                    title="View details"
                                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-all active:scale-95 inline-flex"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                                {canModerate && (
                                                    <>
                                                        <button
                                                            onClick={() =>
                                                                moderateMut.mutate({ id: r._id, isVisible: !r.is_visible })
                                                            }
                                                            disabled={moderateMut.isPending}
                                                            title={r.is_visible ? "Hide review" : "Show review"}
                                                            className={`p-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 ${
                                                                r.is_visible
                                                                    ? "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                                                                    : "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                                                            }`}
                                                        >
                                                            {r.is_visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmDelete({ id: r._id, name: "this review" });
                                                            }}
                                                            title="Delete review"
                                                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {reviews.length === 0 && (
                                    <tr>
                                        <td colSpan={canModerate ? 7 : 6} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center">
                                                <MessageSquare className="mb-4 h-12 w-12 text-neutral-300" />
                                                <p>No reviews found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={total}
                            onPageChange={setPage}
                        />
                    )}
            </div>
            
            <ConfirmModal
                open={!!confirmDelete}
                title="Delete Review"
                message={`Are you sure you want to delete ${confirmDelete?.name}? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />

            <ConfirmModal
                open={confirmBulk === "delete"}
                title="Delete Reviews"
                message={`Delete ${sel.count} review${sel.count === 1 ? "" : "s"}? This cannot be undone.`}
                confirmLabel={`Delete ${sel.count}`}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => bulkDelete.mutate(sel.ids)}
                onCancel={() => setConfirmBulk(null)}
                isPending={bulkDelete.isPending}
            />
        </div>
    );
}



