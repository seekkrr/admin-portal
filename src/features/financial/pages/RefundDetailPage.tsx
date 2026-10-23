import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle, CreditCard, ExternalLink, RotateCcw } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PaymentEventsTimeline } from "@/features/financial/components/PaymentEventsTimeline";
import { KeyValueTags, RefundStatusBadge, TransactionStatusBadge } from "../components/TransactionStatusBadge";
import { RefundApprovalModal } from "../components/RefundApprovalModal";
import { FINANCE_VIEW_ROLES, hasAnyRole } from "../components/paymentEvents";
import { refundsService } from "../services/refunds.service";
import { transactionsService } from "../services/transactions.service";
import { formatCurrency, orDash, shortId } from "@/utils/format";
import { formatDateTime } from "@/utils/date";

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
            <div className="mt-0.5 text-sm text-ink">{children}</div>
        </div>
    );
}

export function RefundDetailPage() {
    const { refundId: param } = useParams<{ refundId: string }>();
    const refundId = param ?? "";
    const roles = useAuthStore((s) => s.user?.role);

    const canView = hasAnyRole(roles, FINANCE_VIEW_ROLES);
    const canApprove = canView;

    const [showApprove, setShowApprove] = useState(false);

    const { data: refund, isLoading, error, refetch } = useQuery({
        queryKey: ["refund-detail", refundId],
        queryFn: () => refundsService.getById(refundId),
        enabled: !!refundId && canView,
        staleTime: 5 * 60 * 1000,
    });

    const { data: linkedTxn } = useQuery({
        queryKey: ["transaction-detail", refund?.transaction_id],
        queryFn: () => transactionsService.getById(refund?.transaction_id ?? ""),
        enabled: !!refund?.transaction_id && canView,
        staleTime: 5 * 60 * 1000,
    });

    usePageTitle(refund ? `Refund ${shortId(refund._id, 8, 4)}` : null);

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view this refund." />;
    if (isLoading) return <LoadingState label="Loading refund…" />;
    if (error || !refund) {
        return (
            <Panel>
                <ErrorState title="Couldn't load this refund" error={error ?? new Error("It may have been removed.")} onRetry={error ? () => refetch() : undefined} />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/refunds" icon={ArrowLeft} variant="ghost">
                        Back to refunds
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    const canApproveThis = canApprove && refund.status === "initiated";
    const acquirerEntries = refund.acquirer_data ? Object.entries(refund.acquirer_data) : [];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={RotateCcw}
                title={formatCurrency(refund.amount, refund.currency)}
                badge={<RefundStatusBadge status={refund.status} />}
                description={
                    <span className="capitalize">
                        {refund.refund_type ? `${refund.refund_type} refund` : "Refund"} · {formatDateTime(refund.created_at)}
                    </span>
                }
                primaryAction={
                    canApproveThis && (
                        <Button variant="primary" icon={CheckCircle} onClick={() => setShowApprove(true)}>
                            Approve refund
                        </Button>
                    )
                }
            />

            {linkedTxn && (
                <Panel
                    title="Source transaction"
                    icon={CreditCard}
                    actions={
                        <ButtonLink to={`/transactions/${linkedTxn._id}`} size="sm" variant="ghost" icon={ExternalLink}>
                            Open
                        </ButtonLink>
                    }
                >
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                        <Fact label="Amount">
                            <span className="font-semibold">{formatCurrency(linkedTxn.amount, linkedTxn.currency)}</span>
                        </Fact>
                        <Fact label="Status">
                            <TransactionStatusBadge status={linkedTxn.status} />
                        </Fact>
                        <Fact label="Gateway">
                            <span className="capitalize">{orDash(linkedTxn.payment_gateway)}</span>
                        </Fact>
                        <Fact label="Type">
                            <span className="capitalize">{(linkedTxn.payment_type ?? "—").replace(/_/g, " ")}</span>
                        </Fact>
                        <Fact label="Created">{formatDateTime(linkedTxn.created_at)}</Fact>
                        {linkedTxn.order_id && (
                            <Fact label="Order ID">
                                <CopyText value={linkedTxn.order_id} mono />
                            </Fact>
                        )}
                    </div>
                </Panel>
            )}

            <Panel title="Refund details">
                <DetailList>
                    <DetailRow label="Refund ID" value={<CopyText value={refund._id} mono truncate={false} />} />
                    <DetailRow label="Transaction" value={<IdLink kind="transaction" id={refund.transaction_id} short={false} />} />
                    <DetailRow label="User" value={<IdLink kind="user" id={refund.user_id} short={false} />} />
                    <DetailRow label="Amount" value={formatCurrency(refund.amount, refund.currency)} />
                    <DetailRow label="Reason" value={orDash(refund.reason)} />
                    <DetailRow label="Refund type" value={<span className="capitalize">{orDash(refund.refund_type)}</span>} />
                    <DetailRow label="Speed" value={<span className="capitalize">{orDash(refund.razorpay_speed)}</span>} />
                    <DetailRow label="Gateway refund ID" value={refund.gateway_refund_id ? <CopyText value={refund.gateway_refund_id} mono /> : "—"} />
                    <DetailRow label="Initiated by" value={<IdLink kind="user" id={refund.initiated_by} />} />
                    <DetailRow label="Reviewed by" value={<IdLink kind="user" id={refund.reviewed_by} />} />
                    <DetailRow label="Created" value={formatDateTime(refund.created_at)} />
                    <DetailRow label="Updated" value={formatDateTime(refund.updated_at)} />
                </DetailList>
            </Panel>

            {refund.failure_reason && (
                <Panel title="Failure reason" icon={AlertTriangle} className="border-bad-line">
                    <p className="whitespace-pre-wrap text-sm text-ink">{refund.failure_reason}</p>
                </Panel>
            )}

            {acquirerEntries.length > 0 && (
                <Panel title="Acquirer data">
                    <KeyValueTags entries={acquirerEntries} />
                </Panel>
            )}

            <PaymentEventsTimeline refundId={refundId} title="Refund audit log" />

            <RefundApprovalModal open={showApprove} refund={refund} onClose={() => setShowApprove(false)} />
        </div>
    );
}
