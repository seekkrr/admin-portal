import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, MessageSquare, Star, Trash2 } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { reviewsService } from "../services/reviews.service";
import { ReviewStars } from "../components/ReviewStars";
import { IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { runBulk } from "@/hooks/useBulkSelection";
import { formatDate } from "@/utils/date";
import type { AdminReview } from "@/types";

const PAGE_SIZE = 20;
const CAN_MODERATE_ROLES = ["admin", "super_admin", "moderator"];

const VISIBILITY_OPTIONS: FilterOption[] = [
    { value: "visible", label: "Visible" },
    { value: "hidden", label: "Hidden" },
];

const RATING_OPTIONS: FilterOption[] = ["5", "4", "3", "2", "1"].map((r) => ({ value: r, label: `${r} star${r === "1" ? "" : "s"}` }));

type Pending = { kind: "hide" | "delete"; ids: string[] } | null;

export function ReviewsPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const canModerate = !!user?.role?.some((r) => CAN_MODERATE_ROLES.includes(r as string));

    // Visibility, rating and page live in the address.
    const { state, set, reset } = useUrlState({ visibility: "", rating: "", page: 1 });
    const visibility = state.visibility === "visible" || state.visibility === "hidden" ? state.visibility : "";
    const rating = RATING_OPTIONS.some((o) => o.value === state.rating) ? state.rating : "";
    const page = Math.max(1, state.page);
    const isVisible = visibility === "" ? undefined : visibility === "visible";

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [pending, setPending] = useState<Pending>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-reviews", { is_visible: isVisible, page }],
        queryFn: () => reviewsService.list({ page, limit: PAGE_SIZE, is_visible: isVisible }),
        staleTime: 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });

    const moderateMut = useMutation({
        mutationFn: ({ id, isVisible: v }: { id: string; isVisible: boolean }) => reviewsService.moderate(id, v),
        onSuccess: (updated) => {
            invalidate();
            queryClient.invalidateQueries({ queryKey: ["review-detail", updated._id] });
            toast.success(updated.is_visible ? "Review is now visible" : "Review hidden");
            setPending(null);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to update visibility");
            setPending(null);
        },
    });

    const bulkVisibility = useMutation({
        mutationFn: ({ ids, visible }: { ids: string[]; visible: boolean }) => runBulk(ids, (id) => reviewsService.moderate(id, visible)),
        onSuccess: ({ ok, failed }, { visible }) => {
            invalidate();
            if (ok > 0) toast.success(`${visible ? "Showed" : "Hid"} ${ok} review${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} couldn't be updated`);
            setSelected(new Set());
            setPending(null);
        },
        onError: () => {
            toast.error("Bulk visibility update failed");
            setPending(null);
        },
    });

    const deleteMut = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => reviewsService.remove(id)),
        onSuccess: ({ ok, failed }) => {
            invalidate();
            if (ok > 0) toast.success(`Deleted ${ok} review${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} couldn't be deleted`);
            setSelected(new Set());
            setPending(null);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Delete failed");
            setPending(null);
        },
    });

    // The rating filter applies to the page on screen (the API has no rating filter).
    const reviews = useMemo(() => {
        const all = data?.reviews ?? [];
        return rating ? all.filter((r) => r.rating === Number(rating)) : all;
    }, [data, rating]);

    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const busy = moderateMut.isPending || bulkVisibility.isPending || deleteMut.isPending;

    const columns: DataColumn<AdminReview>[] = [
        {
            id: "rating",
            header: "Rating",
            hideable: false,
            sortValue: (r) => r.rating,
            cell: (r) => <ReviewStars rating={r.rating} />,
        },
        {
            id: "comment",
            header: "Comment",
            sortValue: (r) => r.comment ?? "",
            className: "max-w-xs",
            cell: (r) => (
                <Link to={`/reviews/${r._id}`} className="block truncate text-ink hover:text-accent-700 hover:underline">
                    {r.comment || <span className="italic text-ink-faint">No comment</span>}
                </Link>
            ),
        },
        { id: "quest", header: "Quest", csv: (r) => r.quest_id, cell: (r) => <IdLink kind="quest" id={r.quest_id} /> },
        { id: "user", header: "Reviewer", csv: (r) => r.user_id, cell: (r) => <IdLink kind="user" id={r.user_id} /> },
        {
            id: "visible",
            header: "Visibility",
            sortValue: (r) => r.is_visible,
            csv: (r) => (r.is_visible ? "visible" : "hidden"),
            cell: (r) => <StatusPill status={r.is_visible ? "visible" : "hidden"} />,
        },
        {
            id: "created",
            header: "Posted",
            sortValue: (r) => r.created_at ?? "",
            csv: (r) => formatDate(r.created_at),
            cell: (r) => <span className="whitespace-nowrap text-ink-muted">{formatDate(r.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (visibility) chips.push({ key: "visibility", label: chipLabel("Visibility", visibility, VISIBILITY_OPTIONS), onRemove: () => set({ visibility: "" }) });
    if (rating) chips.push({ key: "rating", label: chipLabel("Rating", rating, RATING_OPTIONS), onRemove: () => set({ rating: "" }, { replace: true }) });

    const count = pending?.ids.length ?? 0;
    const plural = count === 1 ? "review" : `${count} reviews`;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Star}
                title="Reviews"
                description={
                    <>
                        Moderate quest reviews and creator responses
                        {data && <span className="text-ink-faint"> · {total.toLocaleString("en-IN")} total</span>}
                    </>
                }
            />

            <FilterBar chips={chips} onReset={reset}>
                <FilterSelect label="Visibility" value={visibility} onChange={(v) => set({ visibility: v })} options={VISIBILITY_OPTIONS} allLabel="All reviews" />
                <FilterSelect label="Rating" value={rating} onChange={(v) => set({ rating: v }, { replace: true })} options={RATING_OPTIONS} allLabel="Any rating" />
            </FilterBar>

            <DataTable
                label="Reviews"
                rows={reviews}
                columns={columns}
                rowKey={(r) => r._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: MessageSquare,
                    title: "No reviews found.",
                    description: rating ? "The rating filter only looks at this page of reviews." : chips.length ? "Try clearing a filter." : undefined,
                }}
                onRowClick={(r) => navigate(`/reviews/${r._id}`)}
                selectedIds={canModerate ? selected : undefined}
                onSelectionChange={canModerate ? setSelected : undefined}
                bulkActions={[
                    { label: "Show", icon: Eye, onClick: (ids) => bulkVisibility.mutate({ ids, visible: true }) },
                    { label: "Hide", icon: EyeOff, onClick: (ids) => setPending({ kind: "hide", ids }) },
                    { label: "Delete", icon: Trash2, tone: "danger", onClick: (ids) => setPending({ kind: "delete", ids }) },
                ]}
                bulkBusy={busy}
                rowActions={(r) => (
                    <>
                        <IconButton icon={Eye} size="sm" label="Open review" onClick={() => navigate(`/reviews/${r._id}`)} />
                        {canModerate && (
                            <>
                                <IconButton
                                    icon={r.is_visible ? EyeOff : Eye}
                                    size="sm"
                                    label={r.is_visible ? "Hide review" : "Show review"}
                                    disabled={busy}
                                    onClick={() => (r.is_visible ? setPending({ kind: "hide", ids: [r._id] }) : moderateMut.mutate({ id: r._id, isVisible: true }))}
                                />
                                <IconButton
                                    icon={Trash2}
                                    size="sm"
                                    label="Delete review"
                                    className="hover:bg-bad-soft hover:text-bad"
                                    onClick={() => setPending({ kind: "delete", ids: [r._id] })}
                                />
                            </>
                        )}
                    </>
                )}
                storageKey="reviews"
                exportName="reviews"
                summary={data ? `${reviews.length} of ${total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (r) => <ReviewStars rating={r.rating} />,
                    subtitle: (r) => r.comment || "No comment",
                    fields: ["quest", "visible", "created"],
                }}
                footer={<Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={(p) => set({ page: p })} />}
            />

            <ConfirmDialog
                open={pending?.kind === "hide"}
                title={count === 1 ? "Hide review?" : `Hide ${count} reviews?`}
                description={`The ${plural} disappear${count === 1 ? "s" : ""} from the app. You can show ${count === 1 ? "it" : "them"} again later.`}
                confirmLabel={count === 1 ? "Hide" : `Hide ${count}`}
                tone="warning"
                onConfirm={() => {
                    if (!pending) return;
                    const [only] = pending.ids;
                    if (pending.ids.length === 1 && only) moderateMut.mutate({ id: only, isVisible: false });
                    else bulkVisibility.mutate({ ids: pending.ids, visible: false });
                }}
                onCancel={() => setPending(null)}
                isPending={moderateMut.isPending || bulkVisibility.isPending}
            />

            <ConfirmDialog
                open={pending?.kind === "delete"}
                title={count === 1 ? "Delete review?" : `Delete ${count} reviews?`}
                description={`The ${plural} ${count === 1 ? "is" : "are"} removed from the app and the admin lists.`}
                confirmLabel={count === 1 ? "Delete" : `Delete ${count}`}
                tone="danger"
                onConfirm={() => pending && deleteMut.mutate(pending.ids)}
                onCancel={() => setPending(null)}
                isPending={deleteMut.isPending}
            />
        </div>
    );
}
