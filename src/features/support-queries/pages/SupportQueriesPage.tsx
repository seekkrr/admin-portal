import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, MessageSquare, Trash2 } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { supportQueriesService } from "../services/support-queries.service";
import { IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDate, formatRelative } from "@/utils/date";
import type { SupportQuery } from "@/types";

const PER_PAGE = 20;

type ConfirmAction = { type: "delete"; id: string; name: string } | { type: "bulk-delete"; ids: string[] };

function preview(message: string | undefined, max = 90): string {
    const text = (message ?? "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function SupportQueriesPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const CAN_DELETE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));

    // Search (by email) and page live in the address.
    const { state, set, reset } = useUrlState({ q: "", page: 1 });
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
    const page = Math.max(1, state.page);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-support-queries", { page, page_size: PER_PAGE, email_filter: state.q }],
        queryFn: () => supportQueriesService.list({ page, page_size: PER_PAGE, email_filter: state.q || undefined }),
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const deleteMutation = useMutation({
        mutationFn: supportQueriesService.deleteQuery,
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ["admin-support-queries"] });
            toast.success("Support query deleted");
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setConfirmAction(null);
        },
        onError: () => {
            toast.error("Failed to delete support query");
            setConfirmAction(null);
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: supportQueriesService.bulkDelete,
        onSuccess: (res, ids) => {
            queryClient.invalidateQueries({ queryKey: ["admin-support-queries"] });
            // The backend answers `deleted_count`; older builds used `deleted`.
            const r = res as { deleted?: number; deleted_count?: number };
            const n = r.deleted_count ?? r.deleted ?? ids.length;
            toast.success(`Deleted ${n} support quer${n === 1 ? "y" : "ies"}`);
            setSelectedIds(new Set());
            setConfirmAction(null);
        },
        onError: () => {
            toast.error("Failed to delete support queries");
            setConfirmAction(null);
        },
    });

    const queries = data?.queries ?? [];
    const isPending = deleteMutation.isPending || bulkDeleteMutation.isPending;

    const columns: DataColumn<SupportQuery>[] = [
        {
            id: "from",
            header: "From",
            hideable: false,
            sortValue: (q) => q.name ?? "",
            csv: (q) => q.name ?? "",
            cell: (q) => (
                <Link to={`/support-queries/${q.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {q.name || "Anonymous"}
                </Link>
            ),
        },
        {
            id: "contact",
            header: "Contact",
            sortValue: (q) => q.email ?? q.phone ?? "",
            csv: (q) => q.email ?? q.phone ?? "",
            cell: (q) => <span className="text-ink-muted">{q.email || q.phone || "No contact info"}</span>,
        },
        {
            id: "message",
            header: "Message",
            csv: (q) => q.message ?? "",
            className: "max-w-[360px]",
            cell: (q) => <span className="block truncate text-ink-muted">{preview(q.message) || "—"}</span>,
        },
        {
            id: "created",
            header: "Received",
            sortValue: (q) => q.created_at ?? "",
            csv: (q) => formatDate(q.created_at),
            cell: (q) => (
                <span className="whitespace-nowrap text-ink-muted" title={formatDate(q.created_at)}>
                    {formatRelative(q.created_at)}
                </span>
            ),
        },
    ];

    const confirmCount = confirmAction?.type === "bulk-delete" ? confirmAction.ids.length : 1;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={MessageSquare}
                title="Support queries"
                description={data ? `${data.total.toLocaleString("en-IN")} messages from the contact form` : "Messages people sent from the contact form"}
            />

            <FilterBar
                search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search by email…" }}
                onReset={() => {
                    setSearchInput("");
                    reset();
                }}
            />

            <DataTable
                label="Support queries"
                rows={queries}
                columns={columns}
                rowKey={(q) => q.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: MessageSquare, title: "No support queries found", description: state.q ? "Try a different email." : undefined }}
                onRowClick={(q) => navigate(`/support-queries/${q.id}`)}
                selectedIds={CAN_DELETE ? selectedIds : undefined}
                onSelectionChange={CAN_DELETE ? setSelectedIds : undefined}
                bulkActions={[{ label: "Delete", icon: Trash2, tone: "danger", onClick: (ids) => setConfirmAction({ type: "bulk-delete", ids }) }]}
                bulkBusy={bulkDeleteMutation.isPending}
                rowActions={(q) => (
                    <>
                        <IconButton icon={Eye} size="sm" label={`Open message from ${q.name || "Anonymous"}`} onClick={() => navigate(`/support-queries/${q.id}`)} />
                        {CAN_DELETE && (
                            <IconButton
                                icon={Trash2}
                                size="sm"
                                label={`Delete message from ${q.name || "Anonymous"}`}
                                className="hover:bg-bad-soft hover:text-bad"
                                onClick={() => setConfirmAction({ type: "delete", id: q.id, name: q.name || q.email || "Anonymous" })}
                            />
                        )}
                    </>
                )}
                storageKey="support-queries"
                exportName="support-queries"
                summary={data ? `${queries.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (q) => q.name || "Anonymous",
                    subtitle: (q) => q.email || q.phone || undefined,
                    fields: ["message", "created"],
                }}
                footer={data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />}
            />

            {/* Support queries are hard-deleted, so the admin types DELETE to confirm. */}
            <ConfirmDialog
                open={!!confirmAction}
                title={confirmCount === 1 ? "Delete support query?" : `Delete ${confirmCount} support queries?`}
                description={
                    confirmAction?.type === "delete"
                        ? `The message from ${confirmAction.name} is removed for good.`
                        : `${confirmCount} messages are removed for good.`
                }
                confirmLabel={confirmCount === 1 ? "Delete" : `Delete ${confirmCount}`}
                tone="danger"
                level="type"
                typeToConfirm="DELETE"
                isPending={isPending}
                onConfirm={() => {
                    if (!confirmAction) return;
                    if (confirmAction.type === "delete") deleteMutation.mutate(confirmAction.id);
                    else bulkDeleteMutation.mutate(confirmAction.ids);
                }}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
}
