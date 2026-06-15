import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { markersService } from "../services/markers.service";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { Inbox, ArrowLeft, Filter, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingFallback } from "@components/LoadingFallback";
import { Badge } from "@/components/ui/Badge";
import type { MarkerApplicationStatus } from "@/types";

const STATUS_OPTIONS: { value: "" | MarkerApplicationStatus; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "under_review", label: "Under review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "", label: "All" },
];

const STATUS_BADGE: Record<MarkerApplicationStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    under_review: "bg-blue-50 text-blue-700 border-blue-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
};

export function MarkerApplicationsPage() {
    const [page, setPage] = useState(1);
    const [perPage] = useState(20);
    const [status, setStatus] = useState<"" | MarkerApplicationStatus>("pending");
    const queryClient = useQueryClient();

    const approveMutation = useMutation({
        mutationFn: (id: string) => markersService.approveApplication(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-marker-applications"] });
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            toast.success("Application approved");
        },
        onError: () => toast.error("Failed to approve application"),
    });

    const rejectMutation = useMutation({
        mutationFn: (id: string) => markersService.rejectApplication(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-marker-applications"] });
            toast.success("Application rejected");
        },
        onError: () => toast.error("Failed to reject application"),
    });

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-marker-applications", { status, page }],
        queryFn: () =>
            markersService.listApplications({
                status: status || undefined,
                page,
                page_size: perPage,
            }),
        staleTime: 5 * 60 * 1000,
    });

    const applications = data?.applications ?? [];



    if (isLoading) return <LoadingFallback message="Loading applications..." />;

    if (error) {
        return <div className="p-6 text-center text-red-500">Failed to load marker applications.</div>;
    }

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <Link
                    to="/markers"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors mb-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Markers
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                        <Inbox className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Marker Applications</h1>
                    </div>
                </div>
                <p className="text-neutral-500 mt-1">
                    Review community-submitted marker proposals
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-4">
                    <FilterDropdown
                        value={status}
                        onChange={(val) => {
                            setStatus(val as "" | MarkerApplicationStatus);
                            setPage(1);
                        }}
                        options={STATUS_OPTIONS}
                        theme="orange"
                        placeholder="All Statuses"
                        icon={<Filter className="w-4 h-4 text-orange-500" />}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-100 bg-neutral-50/60">
                            <tr>
                                <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs w-[25%]">Proposed Title</th>
                                <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs w-[15%]">Category</th>
                                <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs w-[15%]">Submitter</th>
                                <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs w-[15%]">Status</th>
                                <th className="px-4 py-3.5 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs w-[15%]">Submitted</th>
                                <th className="px-4 py-3.5 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs w-[15%]">Actions</th>
                            </tr>
                        </thead>
                            <tbody className="bg-white divide-y divide-neutral-200">
                                {applications.map((app) => (
                                    <tr key={app.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <Link
                                                to={`/markers/applications/${app.id}`}
                                                className="font-medium text-neutral-900 hover:text-orange-600"
                                            >
                                                {app.proposed_title}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4">
                                            {app.proposed_category ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 capitalize border border-neutral-200">
                                                    {app.proposed_category}
                                                </span>
                                            ) : (
                                                <span className="text-neutral-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            {app.user_id ? (
                                                <span
                                                    className="text-xs font-mono text-neutral-500"
                                                    title={app.user_id}
                                                >
                                                    {app.user_id.slice(0, 8)}…
                                                </span>
                                            ) : (
                                                <span className="text-neutral-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge label={app.status.replace("_", " ")} styles={STATUS_BADGE[app.status]} />
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                            {app.created_at ? new Date(app.created_at).toLocaleDateString() : "N/A"}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                {(app.status === "pending" || app.status === "under_review") && (
                                                    <>
                                                        <button
                                                            onClick={() => approveMutation.mutate(app.id)}
                                                            title="Approve"
                                                            className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => rejectMutation.mutate(app.id)}
                                                            title="Reject"
                                                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                <Link
                                                    to={`/markers/applications/${app.id}`}
                                                    title="View application"
                                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {applications.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <Inbox className="w-12 h-12 text-neutral-300 mb-4" />
                                                <p>No marker applications found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data && (
                        <Pagination
                            page={data.page}
                            totalPages={data.total_pages}
                            total={data.total}
                            onPageChange={setPage}
                            theme="orange"
                        />
                    )}
                </div>
        </div>
    );
}
