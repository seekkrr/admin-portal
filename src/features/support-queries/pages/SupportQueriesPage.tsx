import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportQueriesService } from "../services/support-queries.service";
import { Card, CardContent } from "@components/ui";
import { MessageSquare, Search, Trash2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LoadingFallback } from "@components/LoadingFallback";

export function SupportQueriesPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const CAN_DELETE = user?.role?.some(r => ["admin", "super_admin"].includes(r));

    const [page, setPage] = useState(1);
    const [perPage] = useState(20);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmAction, setConfirmAction] = useState<null | { type: "delete"; id: string } | { type: "bulk-delete" }>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-support-queries", { page, page_size: perPage, email_filter: searchQuery }],
        queryFn: () => supportQueriesService.list({
            page,
            page_size: perPage,
            email_filter: searchQuery || undefined
        }),
        staleTime: 5 * 60 * 1000,
    });

    const deleteMutation = useMutation({
        mutationFn: supportQueriesService.deleteQuery,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-support-queries"] });
            toast.success("Support query deleted");
            setConfirmAction(null);
        },
        onError: () => {
            toast.error("Failed to delete support query");
            setConfirmAction(null);
        }
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: supportQueriesService.bulkDelete,
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ["admin-support-queries"] });
            toast.success(`Deleted ${res.deleted} support queries`);
            setSelectedIds(new Set());
            setConfirmAction(null);
        },
        onError: () => {
            toast.error("Failed to delete support queries");
            setConfirmAction(null);
        }
    });

    const handleSelectAll = (checked: boolean) => {
        if (!data) return;
        if (checked) {
            setSelectedIds(new Set(data.queries.map(q => q.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) newSelected.add(id);
        else newSelected.delete(id);
        setSelectedIds(newSelected);
    };

    const handleDelete = () => {
        if (!confirmAction) return;
        if (confirmAction.type === "delete") {
            deleteMutation.mutate(confirmAction.id);
        } else {
            bulkDeleteMutation.mutate(Array.from(selectedIds));
        }
    };

    if (isLoading) return <LoadingFallback message="Loading support queries..." />;

    if (error) {
        return (
            <div className="p-6 text-center text-red-500">
                Failed to load support queries.
            </div>
        );
    }

    const queries = data?.queries || [];
    const allSelected = queries.length > 0 && selectedIds.size === queries.length;
    const hasPrev = (data?.page || 1) > 1;
    const hasNext = (data?.page || 1) < (data?.total_pages || 1);

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-rose-600" />
                        Support Queries
                    </h1>
                    <p className="text-neutral-500 mt-1">Manage and resolve user support tickets</p>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="p-4 border-b border-neutral-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-neutral-50 rounded-t-xl">
                        <div className="flex flex-1 items-center gap-4 w-full md:w-auto">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Search by email..."
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') setPage(1);
                                    }}
                                />
                            </div>
                        </div>

                        {CAN_DELETE && (
                            <button
                                disabled={selectedIds.size === 0}
                                onClick={() => setConfirmAction({ type: "bulk-delete" })}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Selected ({selectedIds.size})
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-neutral-200 text-sm">
                            <thead className="bg-neutral-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                                            checked={allSelected}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">User</th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">Created</th>
                                    <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-200">
                                {queries.map(query => (
                                    <tr key={query.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                                                checked={selectedIds.has(query.id)}
                                                onChange={(e) => handleSelectOne(query.id, e.target.checked)}
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <Link to={`/support-queries/${query.id}`} className="block">
                                                <div className="font-medium text-neutral-900">{query.name || "Anonymous"}</div>
                                                <div className="text-neutral-500 text-xs mt-0.5">{query.email || query.phone || "No contact info"}</div>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                            {query.created_at ? new Date(query.created_at).toLocaleDateString() : "N/A"}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    to={`/support-queries/${query.id}`}
                                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                                >
                                                    View
                                                </Link>
                                                {CAN_DELETE && (
                                                    <button
                                                        onClick={() => setConfirmAction({ type: "delete", id: query.id })}
                                                        className="text-neutral-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {queries.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <MessageSquare className="w-12 h-12 text-neutral-300 mb-4" />
                                                <p>No support queries found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data && data.total_pages > 1 && (
                        <div className="p-4 border-t border-neutral-200 flex items-center justify-between bg-neutral-50 rounded-b-xl">
                            <span className="text-sm text-neutral-500">
                                Showing page {data.page} of {data.total_pages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={!hasPrev}
                                    className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={!hasNext}
                                    className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Inline Confirm Modal for deletion */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 text-rose-600 mb-4">
                                <AlertCircle className="w-6 h-6" />
                                <h3 className="text-lg font-bold text-neutral-900">Confirm Deletion</h3>
                            </div>
                            <p className="text-neutral-600">
                                {confirmAction.type === "bulk-delete" 
                                    ? `Are you sure you want to delete ${selectedIds.size} support queries? This action cannot be undone.`
                                    : "Are you sure you want to delete this support query? This action cannot be undone."}
                            </p>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                    disabled={deleteMutation.isPending || bulkDeleteMutation.isPending}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleteMutation.isPending || bulkDeleteMutation.isPending}
                                    className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {(deleteMutation.isPending || bulkDeleteMutation.isPending) && (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
