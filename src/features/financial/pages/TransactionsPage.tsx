import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    CreditCard,
    Search,
    Eye,
    Copy,
    Receipt,
    ShieldAlert,
    RotateCcw,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { transactionsService } from "../services/transactions.service";
import { refundsService } from "../services/refunds.service";
import { TransactionStatusBadge } from "../components/TransactionStatusBadge";
import { formatCurrency, formatDateTime, shortId, orDash } from "@/utils/format";
import type { Transaction, TransactionStatus, InitiateRefundPayload } from "@/types";

const CAN_FINANCE = ["admin", "super_admin", "finance"];

const STATUS_OPTIONS: { value: string; label: string; dot?: string }[] = [
    { value: "", label: "All statuses" },
    { value: "pending", label: "Pending", dot: "bg-amber-400" },
    { value: "authorized", label: "Authorized", dot: "bg-emerald-400" },
    { value: "captured", label: "Captured", dot: "bg-emerald-500" },
    { value: "failed", label: "Failed", dot: "bg-red-400" },
    { value: "expired", label: "Expired", dot: "bg-red-300" },
    { value: "refunded", label: "Refunded", dot: "bg-violet-400" },
];

const PAYMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "All types" },
    { value: "quest_booking", label: "Quest booking" },
    { value: "premium_addon", label: "Premium add-on" },
    { value: "top_up", label: "Top-up" },
    { value: "subscription", label: "Subscription" },
];

function copyToClipboard(value: string) {
    navigator.clipboard?.writeText(value).then(
        () => toast.success("Copied to clipboard"),
        () => toast.error("Failed to copy")
    );
}

export function TransactionsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const canView = roles?.some((r) => CAN_FINANCE.includes(r));
    const canRefund = roles?.some((r) => CAN_FINANCE.includes(r));

    const [page, setPage] = useState(1);
    const [perPage] = useState(20);
    const [status, setStatus] = useState<"" | TransactionStatus>("");
    const [paymentType, setPaymentType] = useState("");
    const [userId, setUserId] = useState("");
    const [debouncedUserId, setDebouncedUserId] = useState("");

    const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
    const [refundAmount, setRefundAmount] = useState("");
    const [refundReason, setRefundReason] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedUserId(userId.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [userId]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-transactions", { status, payment_type: paymentType, user_id: debouncedUserId, page }],
        queryFn: () =>
            transactionsService.list({
                status: status || undefined,
                payment_type: paymentType || undefined,
                user_id: debouncedUserId || undefined,
                page,
                page_size: perPage,
            }),
        enabled: !!canView,
        staleTime: 5 * 60 * 1000,
    });

    const refundMutation = useMutation({
        mutationFn: (payload: InitiateRefundPayload) => refundsService.initiate(payload),
        onSuccess: (refund) => {
            queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
            queryClient.invalidateQueries({ queryKey: ["payment-events"] });
            toast.success("Refund initiated");
            setRefundTarget(null);
            setRefundAmount("");
            setRefundReason("");
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
                    You need a finance, admin, or super-admin role to view transactions.
                </p>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading transactions..." />;
    if (error) return <div className="p-6 text-center text-red-500">Failed to load transactions.</div>;

    const transactions = data?.transactions ?? [];

    const openRefund = (txn: Transaction) => {
        setRefundTarget(txn);
        setRefundAmount("");
        setRefundReason("");
    };

    const handleRefundSubmit = () => {
        if (!refundTarget) return;
        const reason = refundReason.trim();
        if (reason.length < 3) {
            toast.error("Reason must be at least 3 characters");
            return;
        }
        const payload: InitiateRefundPayload = { transaction_id: refundTarget._id, reason };
        const trimmed = refundAmount.trim();
        if (trimmed !== "") {
            const n = Number(trimmed);
            if (Number.isNaN(n) || n <= 0) { toast.error("Amount must be positive"); return; }
            if (n > refundTarget.amount) { toast.error("Amount exceeds transaction total"); return; }
            payload.amount = n;
        }
        refundMutation.mutate(payload);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                        <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Transactions</h1>
                        <p className="text-sm text-neutral-500">
                            Payment records across the platform
                            {data && <span className="ml-2 text-neutral-400">· {data.total} total</span>}
                        </p>
                    </div>
                </div>
                <Link
                    to="/refunds"
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-colors border border-emerald-200 self-start"
                >
                    <Receipt className="w-4 h-4" />
                    Refunds
                </Link>
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
                        onChange={(val) => { setStatus(val as "" | TransactionStatus); setPage(1); }}
                        options={STATUS_OPTIONS}
                        theme="emerald"
                        placeholder="All statuses"
                    />
                    <FilterDropdown
                        value={paymentType}
                        onChange={(val) => { setPaymentType(val); setPage(1); }}
                        options={PAYMENT_TYPE_OPTIONS}
                        theme="emerald"
                        placeholder="All types"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                <th className="px-4 py-4 text-left">Order ID</th>
                                <th className="px-4 py-4 text-right">Amount</th>
                                <th className="px-4 py-4 text-left">Status</th>
                                <th className="px-4 py-4 text-left">Gateway</th>
                                <th className="px-4 py-4 text-left">Type</th>
                                <th className="px-4 py-4 text-left">Created</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                            {transactions.map((t) => (
                                <tr key={t._id} className="group hover:bg-neutral-50/80 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <Link
                                                to={`/transactions/${t._id}`}
                                                className="font-mono text-xs font-medium text-neutral-900 hover:text-emerald-600"
                                                title={t.order_id}
                                            >
                                                {shortId(t.order_id, 10, 6)}
                                            </Link>
                                            {t.order_id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(t.order_id); }}
                                                    title="Copy order ID"
                                                    className="p-1 rounded text-neutral-300 hover:text-emerald-600 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-medium text-neutral-900 whitespace-nowrap">
                                        {formatCurrency(t.amount, t.currency)}
                                    </td>
                                    <td className="px-4 py-4">
                                        <TransactionStatusBadge status={t.status} />
                                    </td>
                                    <td className="px-4 py-4 text-neutral-600 capitalize">{orDash(t.payment_gateway)}</td>
                                    <td className="px-4 py-4 text-neutral-600">
                                        {t.payment_type ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                                                {t.payment_type.replace(/_/g, " ")}
                                            </span>
                                        ) : (
                                            <span className="text-neutral-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                        {formatDateTime(t.created_at)}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {canRefund && t.status === "captured" && (
                                                <button
                                                    onClick={() => openRefund(t)}
                                                    title="Initiate refund"
                                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-all active:scale-95 opacity-0 group-hover:opacity-100"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => navigate(`/transactions/${t._id}`)}
                                                title="View details"
                                                className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <CreditCard className="w-12 h-12 text-neutral-300 mb-4" />
                                            <p>No transactions found matching your criteria.</p>
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

            {/* Quick refund from list — pre-filled with captured transaction */}
            <ConfirmModal
                open={!!refundTarget}
                theme="warning"
                title="Initiate Refund"
                message={
                    refundTarget ? (
                        <>
                            Refund against captured transaction of{" "}
                            <span className="font-semibold text-neutral-900">
                                {formatCurrency(refundTarget.amount, refundTarget.currency)}
                            </span>
                            {refundTarget.order_id && (
                                <span className="ml-1 font-mono text-xs text-neutral-500">
                                    ({shortId(refundTarget.order_id, 10, 6)})
                                </span>
                            )}
                            . Leave amount blank for a full refund.
                        </>
                    ) : ""
                }
                confirmLabel="Initiate Refund"
                confirmStyle="bg-emerald-600 hover:bg-emerald-700"
                onConfirm={handleRefundSubmit}
                onCancel={() => setRefundTarget(null)}
                isPending={refundMutation.isPending}
                disabledConfirm={refundReason.trim().length < 3}
            >
                <div className="space-y-3 mb-1">
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                            Amount ({refundTarget?.currency ?? "INR"}) — optional, blank = full
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            placeholder={`Full: ${refundTarget?.amount ?? ""}`}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Reason (min 3 chars)</label>
                        <textarea
                            rows={2}
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent"
                        />
                    </div>
                </div>
            </ConfirmModal>
        </div>
    );
}
