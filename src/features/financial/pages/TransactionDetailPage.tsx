import { useState, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft,
    CreditCard,
    Copy,
    Receipt,
    AlertTriangle,
    ShieldAlert,
    Lock,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import { Card } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PaymentEventsTimeline } from "@/features/financial/components/PaymentEventsTimeline";
import { TransactionStatusBadge } from "../components/TransactionStatusBadge";
import { transactionsService } from "../services/transactions.service";
import { refundsService } from "../services/refunds.service";
import { formatCurrency, formatPaise, formatDateTime, orDash } from "@/utils/format";
import type { CapturePaymentPayload, InitiateRefundPayload } from "@/types";

const CAN_FINANCE = ["admin", "super_admin", "finance"];
const CAN_INITIATE_REFUND = ["admin", "super_admin", "finance"];
const IS_SUPER = ["super_admin"];

function copyToClipboard(value: string) {
    navigator.clipboard?.writeText(value).then(
        () => toast.success("Copied to clipboard"),
        () => toast.error("Failed to copy")
    );
}

function DetailRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="w-40 shrink-0 font-medium text-neutral-500">{label}</span>
            <span className={`text-neutral-800 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
        </div>
    );
}

function CopyableId({ value }: { value: string | null }) {
    if (!value) return <span className="text-neutral-400">—</span>;
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-xs">{value}</span>
            <button
                onClick={() => copyToClipboard(value)}
                title="Copy"
                className="p-1 rounded text-neutral-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
            >
                <Copy className="w-3.5 h-3.5" />
            </button>
        </span>
    );
}

export function TransactionDetailPage() {
    const { transactionId: param } = useParams<{ transactionId: string }>();
    const transactionId = param ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const roles = useAuthStore((s) => s.user?.role);

    const canView = roles?.some((r) => CAN_FINANCE.includes(r));
    const canInitiateRefund = roles?.some((r) => CAN_INITIATE_REFUND.includes(r));
    const isSuper = roles?.some((r) => IS_SUPER.includes(r));

    const [showRefund, setShowRefund] = useState(false);
    const [refundAmount, setRefundAmount] = useState("");
    const [refundReason, setRefundReason] = useState("");

    const [showCapture, setShowCapture] = useState(false);
    const [capture, setCapture] = useState<CapturePaymentPayload>({
        razorpay_order_id: "",
        razorpay_payment_id: "",
        razorpay_signature: "",
    });

    const { data: txn, isLoading, error } = useQuery({
        queryKey: ["transaction-detail", transactionId],
        queryFn: () => transactionsService.getById(transactionId),
        enabled: !!transactionId && !!canView,
        staleTime: 5 * 60 * 1000,
    });

    const refundMutation = useMutation({
        mutationFn: (payload: InitiateRefundPayload) => refundsService.initiate(payload),
        onSuccess: (refund) => {
            queryClient.invalidateQueries({ queryKey: ["transaction-detail", transactionId] });
            queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
            queryClient.invalidateQueries({ queryKey: ["payment-events"] });
            toast.success("Refund initiated");
            setShowRefund(false);
            setRefundAmount("");
            setRefundReason("");
            navigate(`/refunds/${refund._id}`);
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m?.trim() ? m : "Failed to initiate refund");
        },
    });

    const captureMutation = useMutation({
        mutationFn: (payload: CapturePaymentPayload) => transactionsService.capture(transactionId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["transaction-detail", transactionId] });
            queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["payment-events"] });
            toast.success("Payment captured");
            setShowCapture(false);
            setCapture({ razorpay_order_id: "", razorpay_payment_id: "", razorpay_signature: "" });
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m?.trim() ? m : "Failed to capture payment");
        },
    });

    if (!canView) {
        return (
            <div className="animate-fade-in max-w-md mx-auto mt-16 bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                <ShieldAlert className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-neutral-900">Access denied</h2>
                <p className="text-sm text-neutral-500 mt-1">
                    You need a finance, admin, or super-admin role to view this transaction.
                </p>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading transaction..." />;
    if (error || !txn) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load transaction or it does not exist.</p>
                <Link to="/transactions" className="text-emerald-600 hover:underline">Back to Transactions</Link>
            </div>
        );
    }

    const handleRefund = () => {
        const reason = refundReason.trim();
        if (reason.length < 3) {
            toast.error("Reason must be at least 3 characters");
            return;
        }
        const payload: InitiateRefundPayload = { transaction_id: txn._id, reason };
        const trimmedAmount = refundAmount.trim();
        if (trimmedAmount !== "") {
            const n = Number(trimmedAmount);
            if (Number.isNaN(n) || n <= 0) {
                toast.error("Amount must be a positive number");
                return;
            }
            if (n > txn.amount) {
                toast.error("Amount cannot exceed the transaction total");
                return;
            }
            payload.amount = n;
        }
        refundMutation.mutate(payload);
    };

    const handleCapture = () => {
        if (!capture.razorpay_order_id.trim() || !capture.razorpay_payment_id.trim() || !capture.razorpay_signature.trim()) {
            toast.error("All three gateway fields are required");
            return;
        }
        captureMutation.mutate({
            razorpay_order_id: capture.razorpay_order_id.trim(),
            razorpay_payment_id: capture.razorpay_payment_id.trim(),
            razorpay_signature: capture.razorpay_signature.trim(),
        });
    };

    const pm = txn.payment_method;
    const hasError = txn.error_code || txn.error_description || txn.error_reason || txn.error_source || txn.error_step;
    const canRefund = canInitiateRefund && txn.status === "captured";
    const canCapture = isSuper && (txn.status === "pending" || txn.status === "authorized");
    const metadataEntries = txn.metadata ? Object.entries(txn.metadata) : [];

    const fieldClass =
        "w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:bg-white focus:border-transparent";

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Link
                    to="/transactions"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                <div className="flex items-center gap-3">
                    {canRefund && (
                        <button
                            onClick={() => setShowRefund(true)}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center gap-2 transition-colors text-white bg-emerald-600 hover:bg-emerald-700"
                        >
                            <Receipt className="w-4 h-4" />
                            Initiate Refund
                        </button>
                    )}
                    {canCapture && (
                        <button
                            onClick={() => setShowCapture(true)}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                        >
                            <Lock className="w-4 h-4" />
                            Manual Capture
                        </button>
                    )}
                </div>
            </div>

            <Card padding="md">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                        <div className="bg-emerald-100 text-emerald-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-neutral-900">
                                {formatCurrency(txn.amount, txn.currency)}
                            </h1>
                            <p className="text-neutral-500 mt-1 flex items-center gap-2 flex-wrap">
                                <TransactionStatusBadge status={txn.status} />
                                <span className="capitalize">{orDash(txn.payment_gateway)}</span>
                                {txn.payment_type && <span>· {txn.payment_type.replace(/_/g, " ")}</span>}
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Identifiers</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Order ID" value={<CopyableId value={txn.order_id} />} />
                    <DetailRow label="Gateway order ID" value={<CopyableId value={txn.gateway_order_id} />} />
                    <DetailRow label="Gateway payment ID" value={<CopyableId value={txn.gateway_payment_id} />} />
                    <DetailRow label="Idempotency key" value={<CopyableId value={txn.idempotency_key} />} />
                    <DetailRow
                        label="User ID"
                        value={
                            txn.user_id ? (
                                <Link to={`/users/${txn.user_id}`} className="font-mono text-xs text-emerald-600 hover:underline">
                                    {txn.user_id}
                                </Link>
                            ) : "—"
                        }
                    />
                    <DetailRow
                        label="Quest ID"
                        value={
                            txn.quest_id ? (
                                <Link to={`/quests/${txn.quest_id}`} className="font-mono text-xs text-emerald-600 hover:underline">
                                    {txn.quest_id}
                                </Link>
                            ) : "—"
                        }
                    />
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Amounts & Fees</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Amount" value={formatCurrency(txn.amount, txn.currency)} />
                    <DetailRow label="Currency" value={orDash(txn.currency)} />
                    <DetailRow
                        label="Razorpay fee"
                        value={txn.razorpay_fee !== null ? formatPaise(txn.razorpay_fee, txn.currency) : "—"}
                    />
                    <DetailRow
                        label="Razorpay tax"
                        value={txn.razorpay_tax !== null ? formatPaise(txn.razorpay_tax, txn.currency) : "—"}
                    />
                    <p className="text-xs text-neutral-400 pt-1">Fees/tax are reported by the gateway in paise.</p>
                </div>
            </Card>

            {pm && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold">Payment Method</h3>
                    </div>
                    <div className="p-6 space-y-4 text-sm">
                        <DetailRow label="Type" value={<span className="capitalize">{orDash(pm.type)}</span>} />
                        <DetailRow label="Card (last 4)" value={pm.card_last4 ? `•••• ${pm.card_last4}` : "—"} />
                        <DetailRow label="Card network" value={orDash(pm.card_network)} />
                        <DetailRow label="Card issuer" value={orDash(pm.card_issuer)} />
                        <DetailRow label="UPI VPA" value={orDash(pm.upi_vpa)} />
                        <DetailRow label="Bank" value={orDash(pm.bank_name)} />
                    </div>
                </Card>
            )}

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Customer & Details</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Email (masked)" value={orDash(txn.customer_email)} />
                    <DetailRow label="Phone (masked)" value={orDash(txn.customer_phone)} />
                    <DetailRow label="Description" value={orDash(txn.description)} />
                    <DetailRow label="Created" value={formatDateTime(txn.created_at)} />
                    <DetailRow label="Updated" value={formatDateTime(txn.updated_at)} />
                    {metadataEntries.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                            <span className="w-40 shrink-0 font-medium text-neutral-500">Metadata</span>
                            <div className="flex flex-wrap gap-2">
                                {metadataEntries.map(([k, v]) => (
                                    <span key={k} className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                                        <span className="font-medium text-neutral-500">{k}:</span>
                                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {hasError && (
                <Card padding="none" className="overflow-hidden border-red-200">
                    <div className="bg-red-50/60 border-b border-red-100 p-4 sm:px-6">
                        <h3 className="text-base font-semibold text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Gateway Error
                        </h3>
                    </div>
                    <div className="p-6 space-y-4 text-sm">
                        <DetailRow label="Code" value={orDash(txn.error_code)} mono />
                        <DetailRow label="Description" value={orDash(txn.error_description)} />
                        <DetailRow label="Reason" value={orDash(txn.error_reason)} />
                        <DetailRow label="Source" value={orDash(txn.error_source)} />
                        <DetailRow label="Step" value={orDash(txn.error_step)} />
                    </div>
                </Card>
            )}

            <PaymentEventsTimeline transactionId={transactionId} title="Transaction Audit Log" />

            {/* Initiate Refund modal (type-CONFIRM, money movement) */}
            <ConfirmModal
                open={showRefund}
                theme="warning"
                title="Initiate Refund"
                message={
                    <>
                        Initiate a refund against this captured transaction of{" "}
                        <span className="font-semibold text-neutral-900">{formatCurrency(txn.amount, txn.currency)}</span>.
                        Leave the amount blank for a full refund.
                    </>
                }
                confirmLabel="Initiate Refund"
                confirmStyle="bg-emerald-600 hover:bg-emerald-700"
                onConfirm={handleRefund}
                onCancel={() => setShowRefund(false)}
                isPending={refundMutation.isPending}
                disabledConfirm={refundReason.trim().length < 3}
            >
                <div className="space-y-3 mb-1">
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                            Amount ({txn.currency}) — optional, blank = full
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            placeholder={`Full: ${txn.amount}`}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                            Reason (min 3 chars)
                        </label>
                        <textarea
                            rows={2}
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent"
                        />
                    </div>
                </div>
            </ConfirmModal>

            {/* Manual gateway capture (super_admin only) */}
            <ConfirmModal
                open={showCapture}
                theme="info"
                title="Manual Gateway Capture"
                message="Manual gateway capture — requires Razorpay order/payment/signature and that the order belongs to your account. For reconciliation only."
                confirmLabel="Capture"
                confirmStyle="bg-emerald-600 hover:bg-emerald-700"
                onConfirm={handleCapture}
                onCancel={() => setShowCapture(false)}
                isPending={captureMutation.isPending}
                disabledConfirm={
                    !capture.razorpay_order_id.trim() ||
                    !capture.razorpay_payment_id.trim() ||
                    !capture.razorpay_signature.trim()
                }
            >
                <div className="space-y-3 mb-1">
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Razorpay order ID</label>
                        <input
                            type="text"
                            value={capture.razorpay_order_id}
                            onChange={(e) => setCapture({ ...capture, razorpay_order_id: e.target.value })}
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Razorpay payment ID</label>
                        <input
                            type="text"
                            value={capture.razorpay_payment_id}
                            onChange={(e) => setCapture({ ...capture, razorpay_payment_id: e.target.value })}
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Razorpay signature</label>
                        <input
                            type="text"
                            value={capture.razorpay_signature}
                            onChange={(e) => setCapture({ ...capture, razorpay_signature: e.target.value })}
                            className={fieldClass}
                        />
                    </div>
                </div>
            </ConfirmModal>
        </div>
    );
}
