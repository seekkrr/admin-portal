import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Banknote, Plus, Search, Lock } from "lucide-react";
import { payoutsService } from "../services/payouts.service";
import { PayoutStatusBadge } from "../components/PayoutAccountStatusBadge";
import { InitiatePayoutModal } from "../components/InitiatePayoutModal";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@/store/auth.store";
import { shortId, formatCurrency, formatDateTime } from "@/utils/format";
import type { PayoutStatus } from "@/types";

const CAN_FINANCE = ["admin", "super_admin", "finance"];
const CAN_MANAGE = ["admin", "super_admin"];

const STATUS_OPTIONS: { value: "" | PayoutStatus; label: string }[] = [
    { value: "", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
];

const PER_PAGE = 20;

export function PayoutsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const canView = roles?.some((r) => CAN_FINANCE.includes(r));
    const canManage = roles?.some((r) => CAN_MANAGE.includes(r));

    const [status, setStatus] = useState<"" | PayoutStatus>("");
    const [creatorId, setCreatorId] = useState("");
    const [debouncedCreatorId, setDebouncedCreatorId] = useState("");
    const [page, setPage] = useState(1);
    const [showInitiate, setShowInitiate] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCreatorId(creatorId.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [creatorId]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-payouts", { creator_id: debouncedCreatorId, status, page }],
        queryFn: () =>
            payoutsService.list({
                creator_id: debouncedCreatorId || undefined,
                status: status || undefined,
                page,
                page_size: PER_PAGE,
            }),
        enabled: !!canView,
        staleTime: 5 * 60 * 1000,
    });

    if (!canView) {
        return (
            <div className="animate-fade-in max-w-md mx-auto mt-16">
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                    <Lock className="w-10 h-10 text-neutral-300 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-neutral-900">Access denied</h2>
                    <p className="text-sm text-neutral-500 mt-1">
                        You need a finance, admin, or super-admin role to view payouts.
                    </p>
                </div>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading payouts..." />;
    if (error) {
        return <div className="p-6 text-center text-red-500">Failed to load payouts.</div>;
    }

    const payouts = data?.payouts ?? [];

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                        <Banknote className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Payouts</h1>
                        <p className="text-sm text-neutral-500">
                            Admin-initiated creator disbursements
                            {data && (
                                <span className="ml-2 text-neutral-400">· {data.total} total</span>
                            )}
                        </p>
                    </div>
                </div>
                {canManage && (
                    <button
                        onClick={() => setShowInitiate(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Initiate Payout
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Filter by creator ID..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            value={creatorId}
                            onChange={(e) => setCreatorId(e.target.value)}
                        />
                    </div>
                    <FilterDropdown
                        value={status}
                        onChange={(val) => {
                            setStatus(val as "" | PayoutStatus);
                            setPage(1);
                        }}
                        options={STATUS_OPTIONS}
                        theme="emerald"
                        placeholder="All Statuses"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                <th className="px-4 py-4 text-left">Reference</th>
                                <th className="px-4 py-4 text-left">Creator</th>
                                <th className="px-4 py-4 text-right">Amount</th>
                                <th className="px-4 py-4 text-left">Status</th>
                                <th className="px-4 py-4 text-left">Method</th>
                                <th className="px-4 py-4 text-left">Created</th>
                                <th className="px-4 py-4 text-left">Processed</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                            {payouts.map((p) => (
                                <tr
                                    key={p._id}
                                    className="group hover:bg-neutral-50/80 transition-all duration-200"
                                >
                                    <td className="px-4 py-4">
                                        <Link
                                            to={`/payouts/${p._id}`}
                                            className="font-medium text-neutral-900 hover:text-emerald-600 font-mono text-xs"
                                        >
                                            {shortId(p.payout_reference || p._id)}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4 font-mono text-xs text-neutral-500">
                                        {shortId(p.creator_id)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-medium text-neutral-800 whitespace-nowrap">
                                        {formatCurrency(p.amount, p.currency)}
                                    </td>
                                    <td className="px-4 py-4">
                                        <PayoutStatusBadge status={p.status} />
                                    </td>
                                    <td className="px-4 py-4 text-neutral-700 capitalize">
                                        {(p.payout_method || "—").toString().replace(/_/g, " ")}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                        {formatDateTime(p.created_at)}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                        {formatDateTime(p.processed_at)}
                                    </td>
                                </tr>
                            ))}
                            {payouts.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-12 text-center text-neutral-500"
                                    >
                                        <div className="flex flex-col items-center justify-center">
                                            <Banknote className="w-12 h-12 text-neutral-300 mb-4" />
                                            <p>No payouts found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    page={data?.page ?? page}
                    totalPages={data?.total_pages ?? 1}
                    total={data?.total ?? 0}
                    onPageChange={setPage}
                />
            </div>

            <InitiatePayoutModal open={showInitiate} onClose={() => setShowInitiate(false)} />
        </div>
    );
}
