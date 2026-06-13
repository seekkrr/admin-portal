import { useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    Receipt,
    CheckCircle,
    AlertTriangle,
    ShieldAlert,
    CreditCard,
    ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import { Card } from "@/components/ui";
import { PaymentEventsTimeline } from "@/features/financial/components/PaymentEventsTimeline";
import { RefundStatusBadge, TransactionStatusBadge } from "../components/TransactionStatusBadge";
import { RefundApprovalModal } from "../components/RefundApprovalModal";
import { refundsService } from "../services/refunds.service";
import { transactionsService } from "../services/transactions.service";
import { formatCurrency, formatDateTime, orDash } from "@/utils/format";

const CAN_FINANCE = ["admin", "super_admin", "finance"];
const CAN_APPROVE_REFUND = ["admin", "super_admin", "finance"];

function DetailRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="w-40 shrink-0 font-medium text-neutral-500">{label}</span>
            <span className={`text-neutral-800 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
        </div>
    );
}

export function RefundDetailPage() {
    const { refundId: param } = useParams<{ refundId: string }>();
    const refundId = param ?? "";
    const roles = useAuthStore((s) => s.user?.role);

    const canView = roles?.some((r) => CAN_FINANCE.includes(r));
    const canApprove = roles?.some((r) => CAN_APPROVE_REFUND.includes(r));

    const [showApprove, setShowApprove] = useState(false);

    const { data: refund, isLoading, error } = useQuery({
        queryKey: ["refund-detail", refundId],
        queryFn: () => refundsService.getById(refundId),
        enabled: !!refundId && !!canView,
        staleTime: 5 * 60 * 1000,
    });

    const { data: linkedTxn } = useQuery({
        queryKey: ["transaction-detail", refund?.transaction_id],
        queryFn: () => transactionsService.getById(refund?.transaction_id ?? ""),
        enabled: !!refund?.transaction_id && !!canView,
        staleTime: 5 * 60 * 1000,
    });

    if (!canView) {
        return (
            <div className="animate-fade-in max-w-md mx-auto mt-16 bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                <ShieldAlert className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-neutral-900">Access denied</h2>
                <p className="text-sm text-neutral-500 mt-1">
                    You need a finance, admin, or super-admin role to view this refund.
                </p>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading refund..." />;
    if (error || !refund) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load refund or it does not exist.</p>
                <Link to="/refunds" className="text-emerald-600 hover:underline">Back to Refunds</Link>
            </div>
        );
    }

    const canApproveThis = canApprove && refund.status === "initiated";
    const acquirerEntries = refund.acquirer_data ? Object.entries(refund.acquirer_data) : [];

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Link
                    to="/refunds"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                {canApproveThis && (
                    <button
                        onClick={() => setShowApprove(true)}
                        className="py-2.5 px-4 rounded-xl font-medium flex items-center gap-2 transition-colors text-white bg-amber-600 hover:bg-amber-700"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Approve Refund
                    </button>
                )}
            </div>

            <Card padding="md">
                <div className="flex items-start gap-4">
                    <div className="bg-emerald-100 text-emerald-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">
                            {formatCurrency(refund.amount, refund.currency)}
                        </h1>
                        <p className="text-neutral-500 mt-1 flex items-center gap-2 flex-wrap">
                            <RefundStatusBadge status={refund.status} />
                            {refund.refund_type && <span className="capitalize">· {refund.refund_type}</span>}
                        </p>
                    </div>
                </div>
            </Card>

            {linkedTxn && (
                <Card padding="none" className="overflow-hidden border-emerald-100">
                    <div className="bg-emerald-50/40 border-b border-emerald-100 p-4 sm:px-6 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Source Transaction
                        </h3>
                        <Link
                            to={`/transactions/${linkedTxn._id}`}
                            className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                        >
                            View full detail <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="p-4 sm:px-6 flex flex-wrap gap-6 text-sm">
                        <div>
                            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Amount</p>
                            <p className="font-semibold text-neutral-900">{formatCurrency(linkedTxn.amount, linkedTxn.currency)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Status</p>
                            <TransactionStatusBadge status={linkedTxn.status} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Gateway</p>
                            <p className="capitalize text-neutral-700">{orDash(linkedTxn.payment_gateway)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Type</p>
                            <p className="capitalize text-neutral-700">{(linkedTxn.payment_type ?? "—").replace(/_/g, " ")}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Created</p>
                            <p className="text-neutral-700">{formatDateTime(linkedTxn.created_at)}</p>
                        </div>
                        {linkedTxn.order_id && (
                            <div>
                                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Order ID</p>
                                <p className="font-mono text-xs text-neutral-700">{linkedTxn.order_id}</p>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Refund Details</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Refund ID" value={refund._id} mono />
                    <DetailRow
                        label="Transaction"
                        value={
                            refund.transaction_id ? (
                                <Link
                                    to={`/transactions/${refund.transaction_id}`}
                                    className="text-emerald-600 hover:underline inline-flex items-center gap-1.5 font-mono text-xs"
                                >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    {refund.transaction_id}
                                </Link>
                            ) : "—"
                        }
                    />
                    <DetailRow
                        label="User ID"
                        value={
                            refund.user_id ? (
                                <Link to={`/users/${refund.user_id}`} className="font-mono text-xs text-emerald-600 hover:underline">
                                    {refund.user_id}
                                </Link>
                            ) : "—"
                        }
                    />
                    <DetailRow label="Amount" value={formatCurrency(refund.amount, refund.currency)} />
                    <DetailRow label="Reason" value={orDash(refund.reason)} />
                    <DetailRow label="Refund type" value={<span className="capitalize">{orDash(refund.refund_type)}</span>} />
                    <DetailRow label="Speed" value={<span className="capitalize">{orDash(refund.razorpay_speed)}</span>} />
                    <DetailRow label="Gateway refund ID" value={orDash(refund.gateway_refund_id)} mono />
                    <DetailRow label="Initiated by" value={orDash(refund.initiated_by)} mono />
                    <DetailRow label="Reviewed by" value={orDash(refund.reviewed_by)} mono />
                    <DetailRow label="Created" value={formatDateTime(refund.created_at)} />
                    <DetailRow label="Updated" value={formatDateTime(refund.updated_at)} />
                </div>
            </Card>

            {refund.failure_reason && (
                <Card padding="none" className="overflow-hidden border-red-200">
                    <div className="bg-red-50/60 border-b border-red-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Failure Reason
                        </h3>
                    </div>
                    <div className="p-6 text-sm text-neutral-800 whitespace-pre-wrap">
                        {refund.failure_reason}
                    </div>
                </Card>
            )}

            {acquirerEntries.length > 0 && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold">Acquirer Data</h3>
                    </div>
                    <div className="p-6 flex flex-wrap gap-2 text-sm">
                        {acquirerEntries.map(([k, v]) => (
                            <span key={k} className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                                <span className="font-medium text-neutral-500">{k}:</span>
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                        ))}
                    </div>
                </Card>
            )}

            <PaymentEventsTimeline refundId={refundId} title="Refund Audit Log" />

            <RefundApprovalModal
                open={showApprove}
                refund={refund}
                onClose={() => setShowApprove(false)}
            />
        </div>
    );
}
