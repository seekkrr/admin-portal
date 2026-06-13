import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    Receipt,
    Search,
    Eye,
    Plus,
    ShieldAlert,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { refundsService } from "../services/refunds.service";
import { RefundStatusBadge } from "../components/TransactionStatusBadge";
import { formatCurrency, formatDateTime, shortId, orDash } from "@/utils/format";
import type { RefundStatus, InitiateRefundPayload } from "@/types";

const CAN_FINANCE = ["admin", "super_admin", "finance"];
const CAN_INITIATE_REFUND = ["admin", "super_admin", "finance"];

const STATUS_OPTIONS: { value: string; label: string; dot?: string }[] = [
    { value: "", label: "All statuses" },
    { value: "initiated", label: "Initiated", dot: "bg-amber-400" },
    { value: "processing", label: "Processing", dot: "bg-blue-400" },
    { value: "completed", label: "Completed", dot: "bg-emerald-500" },
    { value: "failed", label: "Failed", dot: "bg-red-400" },
];

export function RefundsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const canView = roles?.some((r) => CAN_FINANCE.includes(r));
    const canInitiate = roles?.some((r) => CAN_INITIATE_REFUND.includes(r));

    const [page, setPage] = useState(1);
    const [perPage] = useState(20);
    const [status, setStatus] = useState<"" | RefundStatus>("");
    const [userId, setUserId] = useState("");
    const [debouncedUserId, setDebouncedUserId] = useState("");

    const [showInitiate, setShowInitiate] = useState(false);
    const [txnId, setTxnId] = useState("");
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedUserId(userId.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [userId]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-refunds", { status, user_id: debouncedUserId, page }],
        queryFn: () =>
            refundsService.list({
                status: status || undefined,
                user_id: debouncedUserId || undefined,
                page,
                page_size: perPage,
            }),
        enabled: !!canView,
        staleTime: 5 * 60 * 1000,
    });

    const initiateMutation = useMutation({
        mutationFn: (payload: InitiateRefundPayload) => refundsService.initiate(payload),
        onSuccess: (refund) => {
            queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
            queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["payment-events"] });
            toast.success("Refund initiated");
            setShowInitiate(false);
            setTxnId("");
            setAmount("");
            setReason("");
            navigate(`/refunds/${refund._id}`);
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m?.trim() ? m : "Failed to initiate refund");
        },
    });

    if (!canView) {
        return (
            <div className="animate-fade-in max-w-md mx-auto mt-16 bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                <ShieldAlert className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-neutral-900">Access denied</h2>
                <p className="text-sm text-neutral-500 mt-1">
                    You need a finance, admin, or super-admin role to view refunds.
                </p>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading refunds..." />;
    if (error) return <div className="p-6 text-center text-red-500">Failed to load refunds.</div>;

    const refunds = data?.refunds ?? [];

    const handleInitiate = () => {
        const r = reason.trim();
        if (!txnId.trim()) {
            toast.error("Transaction ID is required");
            return;
        }
        if (r.length < 3) {
            toast.error("Reason must be at least 3 characters");
            return;
        }
        const payload: InitiateRefundPayload = { transaction_id: txnId.trim(), reason: r };
        const a = amount.trim();
        if (a !== "") {
            const n = Number(a);
            if (Number.isNaN(n) || n <= 0) {
                toast.error("Amount must be a positive number");
                return;
            }
            payload.amount = n;
        }
        initiateMutation.mutate(payload);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                        <Receipt className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Refunds</h1>
                        <p className="text-sm text-neutral-500">
                            Refund requests and approvals
                            {data && <span className="ml-2 text-neutral-400">· {data.total} total</span>}
                        </p>
                    </div>
                </div>
                {canInitiate && (
                    <button
                        onClick={() => setShowInitiate(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors self-start"
                    >
                        <Plus className="w-4 h-4" />
                        Initiate Refund
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Filter by user ID..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") setPage(1); }}
                        />
                    </div>
                    <FilterDropdown
                        value={status}
                        onChange={(val) => { setStatus(val as "" | RefundStatus); setPage(1); }}
                        options={STATUS_OPTIONS}
                        theme="emerald"
                        placeholder="All statuses"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                <th className="px-4 py-4 text-left">Refund ID</th>
                                <th className="px-4 py-4 text-left">Transaction</th>
                                <th className="px-4 py-4 text-right">Amount</th>
                                <th className="px-4 py-4 text-left">Status</th>
                                <th className="px-4 py-4 text-left">Type</th>
                                <th className="px-4 py-4 text-left">Created</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                            {refunds.map((r) => (
                                <tr key={r._id} className="group hover:bg-neutral-50/80 transition-colors">
                                    <td className="px-4 py-4">
                                        <Link
                                            to={`/refunds/${r._id}`}
                                            className="font-mono text-xs font-medium text-neutral-900 hover:text-emerald-600"
                                            title={r._id}
                                        >
                                            {shortId(r._id, 8, 6)}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4">
                                        {r.transaction_id ? (
                                            <Link
                                                to={`/transactions/${r.transaction_id}`}
                                                className="font-mono text-xs text-emerald-600 hover:underline"
                                                title={r.transaction_id}
                                            >
                                                {shortId(r.transaction_id, 8, 6)}
                                            </Link>
                                        ) : (
                                            <span className="text-neutral-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right font-medium text-neutral-900 whitespace-nowrap">
                                        {formatCurrency(r.amount, r.currency)}
                                    </td>
                                    <td className="px-4 py-4">
                                        <RefundStatusBadge status={r.status} />
                                    </td>
                                    <td className="px-4 py-4 text-neutral-600 capitalize">{orDash(r.refund_type)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                        {formatDateTime(r.created_at)}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button
                                            onClick={() => navigate(`/refunds/${r._id}`)}
                                            title="View details"
                                            className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {refunds.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Receipt className="w-12 h-12 text-neutral-300 mb-4" />
                                            <p>No refunds found matching your criteria.</p>
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
                    />
                )}
            </div>

            {/* Initiate Refund modal (type-CONFIRM, money movement) */}
            <ConfirmModal
                open={showInitiate}
                theme="warning"
                title="Initiate Refund"
                message="Create a refund request against a captured transaction. Leave the amount blank for a full refund."
                confirmLabel="Initiate Refund"
                confirmStyle="bg-emerald-600 hover:bg-emerald-700"
                onConfirm={handleInitiate}
                onCancel={() => setShowInitiate(false)}
                isPending={initiateMutation.isPending}
                disabledConfirm={!txnId.trim() || reason.trim().length < 3}
            >
                <div className="space-y-3 mb-1">
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Transaction ID</label>
                        <input
                            type="text"
                            placeholder="ObjectId of a captured transaction"
                            value={txnId}
                            onChange={(e) => setTxnId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                            Amount — optional, blank = full
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            placeholder="Full amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Reason (min 3 chars)</label>
                        <textarea
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent"
                        />
                    </div>
                </div>
            </ConfirmModal>
        </div>
    );
}
