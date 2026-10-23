import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CreditCard, Lock, RotateCcw } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PaymentEventsTimeline } from "@/features/financial/components/PaymentEventsTimeline";
import { KeyValueTags, TransactionStatusBadge } from "../components/TransactionStatusBadge";
import { InitiateRefundModal } from "../components/InitiateRefundModal";
import { FINANCE_VIEW_ROLES, hasAnyRole } from "../components/paymentEvents";
import { transactionsService } from "../services/transactions.service";
import { formatCurrency, formatPaise, orDash, shortId } from "@/utils/format";
import { formatDateTime } from "@/utils/date";
import type { CapturePaymentPayload } from "@/types";

const IS_SUPER = ["super_admin"];
const EMPTY_CAPTURE: CapturePaymentPayload = { razorpay_order_id: "", razorpay_payment_id: "", razorpay_signature: "" };

export function TransactionDetailPage() {
    const { transactionId: param } = useParams<{ transactionId: string }>();
    const transactionId = param ?? "";
    const queryClient = useQueryClient();
    const roles = useAuthStore((s) => s.user?.role);

    const canView = hasAnyRole(roles, FINANCE_VIEW_ROLES);
    const canInitiateRefund = canView;
    const isSuper = hasAnyRole(roles, IS_SUPER);

    const [showRefund, setShowRefund] = useState(false);
    const [showCapture, setShowCapture] = useState(false);
    const [capture, setCapture] = useState<CapturePaymentPayload>(EMPTY_CAPTURE);

    const { data: txn, isLoading, error, refetch } = useQuery({
        queryKey: ["transaction-detail", transactionId],
        queryFn: () => transactionsService.getById(transactionId),
        enabled: !!transactionId && canView,
        staleTime: 5 * 60 * 1000,
    });

    usePageTitle(txn ? `Transaction ${shortId(txn.order_id || txn._id, 8, 4)}` : null);

    const captureMutation = useMutation({
        mutationFn: (payload: CapturePaymentPayload) => transactionsService.capture(transactionId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["transaction-detail", transactionId] });
            queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["payment-events"] });
            toast.success("Payment captured");
            setShowCapture(false);
            setCapture(EMPTY_CAPTURE);
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m?.trim() ? m : "Failed to capture payment");
        },
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view this transaction." />;
    if (isLoading) return <LoadingState label="Loading transaction…" />;
    if (error || !txn) {
        return (
            <Panel>
                <ErrorState title="Couldn't load this transaction" error={error ?? new Error("It may have been removed.")} onRetry={error ? () => refetch() : undefined} />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/transactions" icon={ArrowLeft} variant="ghost">
                        Back to transactions
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    const captureReady = !!capture.razorpay_order_id.trim() && !!capture.razorpay_payment_id.trim() && !!capture.razorpay_signature.trim();
    const submitCapture = () => {
        if (!captureReady) return;
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
    const copyable = (v: string | null) => (v ? <CopyText value={v} mono truncate={false} /> : "—");

    return (
        <div className="space-y-5">
            <PageHeader
                icon={CreditCard}
                title={formatCurrency(txn.amount, txn.currency)}
                badge={<TransactionStatusBadge status={txn.status} />}
                description={
                    <span className="capitalize">
                        {orDash(txn.payment_gateway)}
                        {txn.payment_type && ` · ${txn.payment_type.replace(/_/g, " ")}`} · {formatDateTime(txn.created_at)}
                    </span>
                }
                actions={
                    canCapture && (
                        <Button icon={Lock} onClick={() => setShowCapture(true)}>
                            Manual capture
                        </Button>
                    )
                }
                primaryAction={
                    canRefund && (
                        <Button variant="primary" icon={RotateCcw} onClick={() => setShowRefund(true)}>
                            Initiate refund
                        </Button>
                    )
                }
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Identifiers">
                    <DetailList>
                        <DetailRow label="Order ID" value={copyable(txn.order_id)} />
                        <DetailRow label="Gateway order ID" value={copyable(txn.gateway_order_id)} />
                        <DetailRow label="Gateway payment ID" value={copyable(txn.gateway_payment_id)} />
                        <DetailRow label="Idempotency key" value={copyable(txn.idempotency_key)} />
                        <DetailRow label="User" value={<IdLink kind="user" id={txn.user_id} short={false} />} />
                        <DetailRow label="Quest" value={<IdLink kind="quest" id={txn.quest_id} short={false} />} />
                    </DetailList>
                </Panel>

                <Panel title="Amounts and fees">
                    <DetailList>
                        <DetailRow label="Amount" value={formatCurrency(txn.amount, txn.currency)} />
                        <DetailRow label="Currency" value={orDash(txn.currency)} />
                        <DetailRow label="Razorpay fee" value={txn.razorpay_fee !== null ? formatPaise(txn.razorpay_fee, txn.currency) : "—"} />
                        <DetailRow label="Razorpay tax" value={txn.razorpay_tax !== null ? formatPaise(txn.razorpay_tax, txn.currency) : "—"} />
                    </DetailList>
                    <p className="mt-3 text-xs text-ink-faint">Fees and tax are reported by the gateway in paise.</p>
                </Panel>

                {pm && (
                    <Panel title="Payment method">
                        <DetailList>
                            <DetailRow label="Type" value={<span className="capitalize">{orDash(pm.type)}</span>} />
                            <DetailRow label="Card (last 4)" value={pm.card_last4 ? `•••• ${pm.card_last4}` : "—"} />
                            <DetailRow label="Card network" value={orDash(pm.card_network)} />
                            <DetailRow label="Card issuer" value={orDash(pm.card_issuer)} />
                            <DetailRow label="UPI VPA" value={orDash(pm.upi_vpa)} />
                            <DetailRow label="Bank" value={orDash(pm.bank_name)} />
                        </DetailList>
                    </Panel>
                )}

                <Panel title="Customer and details">
                    <DetailList>
                        <DetailRow label="Email (masked)" value={orDash(txn.customer_email)} />
                        <DetailRow label="Phone (masked)" value={orDash(txn.customer_phone)} />
                        <DetailRow label="Description" value={orDash(txn.description)} />
                        <DetailRow label="Created" value={formatDateTime(txn.created_at)} />
                        <DetailRow label="Updated" value={formatDateTime(txn.updated_at)} />
                        {metadataEntries.length > 0 && <DetailRow label="Metadata" value={<KeyValueTags entries={metadataEntries} />} />}
                    </DetailList>
                </Panel>
            </div>

            {hasError && (
                <Panel title="Gateway error" icon={AlertTriangle} className="border-bad-line">
                    <DetailList>
                        <DetailRow label="Code" value={<span className="font-mono text-xs">{orDash(txn.error_code)}</span>} />
                        <DetailRow label="Description" value={orDash(txn.error_description)} />
                        <DetailRow label="Reason" value={orDash(txn.error_reason)} />
                        <DetailRow label="Source" value={orDash(txn.error_source)} />
                        <DetailRow label="Step" value={orDash(txn.error_step)} />
                    </DetailList>
                </Panel>
            )}

            <PaymentEventsTimeline transactionId={transactionId} title="Transaction audit log" />

            <InitiateRefundModal open={showRefund} transaction={txn} onClose={() => setShowRefund(false)} />

            {/* Manual gateway capture (super_admin only) */}
            <Modal
                open={showCapture}
                onClose={() => setShowCapture(false)}
                dismissible={!captureMutation.isPending}
                icon={Lock}
                title="Manual gateway capture"
                description="For reconciliation only. Needs the Razorpay order, payment and signature, and the order must belong to your account."
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowCapture(false)} disabled={captureMutation.isPending}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={submitCapture} disabled={!captureReady} loading={captureMutation.isPending}>
                            Capture
                        </Button>
                    </>
                }
            >
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submitCapture();
                    }}
                >
                    {(
                        [
                            ["razorpay_order_id", "Razorpay order ID"],
                            ["razorpay_payment_id", "Razorpay payment ID"],
                            ["razorpay_signature", "Razorpay signature"],
                        ] as const
                    ).map(([key, label]) => (
                        <Field key={key} label={label} required>
                            <TextInput
                                value={capture[key]}
                                onChange={(e) => setCapture({ ...capture, [key]: e.target.value })}
                                className="font-mono"
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </Field>
                    ))}
                    <button type="submit" hidden aria-hidden tabIndex={-1} />
                </form>
            </Modal>
        </div>
    );
}
