import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Ban, Banknote, CheckCircle2, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextInput } from "@/components/ui/Field";
import { StatTile } from "@/components/ui/Stat";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PaymentEventsTimeline } from "@/features/financial/components/PaymentEventsTimeline";
import { payoutsService } from "../services/payouts.service";
import { PayoutStatusBadge } from "../components/PayoutAccountStatusBadge";
import { FINANCE_ROLES, MANAGE_ROLES, hasRole, methodLabel } from "../components/accountDisplay";
import { formatCurrency, orDash, shortId } from "@/utils/format";
import { formatDate, formatDateTime } from "@/utils/date";

export function PayoutDetailPage() {
    const { payoutId: payoutIdParam } = useParams<{ payoutId: string }>();
    const payoutId = payoutIdParam ?? "";
    const queryClient = useQueryClient();
    const roles = useAuthStore((s) => s.user?.role);

    const canView = hasRole(roles, FINANCE_ROLES);
    const canManage = hasRole(roles, MANAGE_ROLES);

    const [showProcess, setShowProcess] = useState(false);
    const [reference, setReference] = useState("");
    const [showFail, setShowFail] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

    const { data: payout, isLoading, error, refetch } = useQuery({
        queryKey: ["payout-detail", payoutId],
        queryFn: () => payoutsService.getById(payoutId),
        enabled: !!payoutId && canView,
        staleTime: 5 * 60 * 1000,
    });

    const creatorId = payout?.creator_id ?? "";
    const { data: summary } = useQuery({
        queryKey: ["payout-creator-summary", creatorId],
        queryFn: () => payoutsService.creatorSummary(creatorId),
        enabled: !!creatorId && canView,
        staleTime: 5 * 60 * 1000,
    });

    usePageTitle(payout ? `Payout ${payout.payout_reference || shortId(payout._id)}` : null);

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
        queryClient.invalidateQueries({ queryKey: ["payout-detail", payoutId] });
        queryClient.invalidateQueries({ queryKey: ["payment-events"] });
        if (creatorId) queryClient.invalidateQueries({ queryKey: ["payout-creator-summary", creatorId] });
    };

    const errMsg = (err: unknown, fallback: string) => {
        // The api interceptor rejects with a plain Error carrying the backend's message.
        const m = (err as { message?: string })?.message;
        return m && m.trim() ? m : fallback;
    };

    const processMutation = useMutation({
        mutationFn: () => payoutsService.process(payoutId, { reference_number: reference.trim() }),
        onSuccess: () => {
            invalidateAll();
            toast.success("Payout processed");
            setShowProcess(false);
            setReference("");
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to process payout")),
    });

    const failMutation = useMutation({
        mutationFn: (reason: string) => payoutsService.fail(payoutId, { reason }),
        onSuccess: () => {
            invalidateAll();
            toast.success("Payout marked as failed");
            setShowFail(false);
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to mark payout as failed")),
    });

    const cancelMutation = useMutation({
        mutationFn: () => payoutsService.cancel(payoutId),
        onSuccess: () => {
            invalidateAll();
            toast.success("Payout cancelled");
            setConfirmCancel(false);
        },
        onError: (err: unknown) => {
            toast.error(errMsg(err, "Failed to cancel payout"));
            setConfirmCancel(false);
        },
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view payouts." />;
    if (isLoading) return <LoadingState label="Loading payout…" />;
    if (error || !payout) {
        return (
            <Panel>
                <ErrorState title="Couldn't load this payout" error={error ?? new Error("It may have been removed.")} onRetry={error ? () => refetch() : undefined} />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/payouts" icon={ArrowLeft} variant="ghost">
                        Back to payouts
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    const open = payout.status === "pending" || payout.status === "processing";
    const canProcess = canManage && open;
    const canFail = canManage && open;
    const canCancel = canManage && payout.status === "pending";
    const referenceOk = reference.trim().length >= 3;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Banknote}
                title={formatCurrency(payout.amount, payout.currency)}
                badge={<PayoutStatusBadge status={payout.status} />}
                description={
                    <>
                        <span className="font-mono text-xs">{orDash(payout.payout_reference)}</span> · {methodLabel(payout.payout_method)} · {formatDateTime(payout.created_at)}
                    </>
                }
                actions={
                    <>
                        {canFail && (
                            <Button icon={XCircle} onClick={() => setShowFail(true)}>
                                Mark failed
                            </Button>
                        )}
                        {canCancel && (
                            <Button icon={Ban} onClick={() => setConfirmCancel(true)}>
                                Cancel payout
                            </Button>
                        )}
                    </>
                }
                primaryAction={
                    canProcess && (
                        <Button
                            variant="primary"
                            icon={CheckCircle2}
                            onClick={() => {
                                setReference(payout.reference_number ?? "");
                                setShowProcess(true);
                            }}
                        >
                            Process
                        </Button>
                    )
                }
            />

            {summary && (
                <Panel title="Creator payout summary" icon={Wallet}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <StatTile label="Total earnings" value={formatCurrency(summary.total_earnings, payout.currency)} />
                        <StatTile label="Total paid" value={formatCurrency(summary.total_paid, payout.currency)} hint="Completed payouts" hintTone="good" />
                        <StatTile label="Pending balance" value={formatCurrency(summary.pending_balance, payout.currency)} hint="Not paid yet" hintTone="warn" />
                    </div>
                </Panel>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Payout details">
                    <DetailList>
                        <DetailRow label="Creator" value={<IdLink kind="creator" id={payout.creator_id} short={false} />} />
                        <DetailRow label="Initiated by" value={<IdLink kind="user" id={payout.initiated_by} />} />
                        <DetailRow label="Amount" value={formatCurrency(payout.amount, payout.currency)} />
                        <DetailRow label="Method" value={methodLabel(payout.payout_method)} />
                        <DetailRow label="Reference (UTR / NEFT)" value={payout.reference_number ? <CopyText value={payout.reference_number} mono /> : "—"} />
                        <DetailRow label="UPI ID (masked)" value={<span className="font-mono">{orDash(payout.upi_id)}</span>} />
                        <DetailRow
                            label="Bank account (masked)"
                            value={payout.bank_account ? <span className="break-all font-mono text-xs">{JSON.stringify(payout.bank_account)}</span> : "—"}
                        />
                        <DetailRow label="Period" value={payout.period_start || payout.period_end ? `${formatDate(payout.period_start)} – ${formatDate(payout.period_end)}` : "—"} />
                        <DetailRow label="Created" value={formatDateTime(payout.created_at)} />
                        <DetailRow label="Processed" value={formatDateTime(payout.processed_at)} />
                        {payout.notes && <DetailRow label="Notes" value={<span className="whitespace-pre-wrap">{payout.notes}</span>} />}
                    </DetailList>
                </Panel>

                <Panel title="Gateway">
                    <DetailList>
                        <DetailRow label="Razorpay payout ID" value={payout.razorpay_payout_id ? <CopyText value={payout.razorpay_payout_id} mono /> : "—"} />
                        <DetailRow label="Fund account" value={payout.razorpay_fund_account_id ? <CopyText value={payout.razorpay_fund_account_id} mono /> : "—"} />
                        <DetailRow label="Contact" value={payout.razorpay_contact_id ? <CopyText value={payout.razorpay_contact_id} mono /> : "—"} />
                    </DetailList>
                    {payout.earnings_snapshot && (
                        <div className="mt-4">
                            <p className="mb-1.5 text-sm font-medium text-ink-muted">Earnings snapshot</p>
                            <pre className="overflow-x-auto rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-ink-muted">
                                {JSON.stringify(payout.earnings_snapshot, null, 2)}
                            </pre>
                        </div>
                    )}
                </Panel>
            </div>

            {payout.failure_reason && (
                <Panel title="Failure reason" icon={AlertTriangle} className="border-bad-line">
                    <p className="whitespace-pre-wrap text-sm text-ink">{payout.failure_reason}</p>
                </Panel>
            )}

            <PaymentEventsTimeline payoutId={payoutId} title="Payout events" />

            {/* Process: record the bank reference */}
            <ConfirmDialog
                open={showProcess}
                title="Mark payout as processed?"
                description={`Enter the bank reference (UTR / NEFT) for this ${formatCurrency(payout.amount, payout.currency)} disbursement.`}
                confirmLabel="Confirm and process"
                confirmDisabled={!referenceOk}
                onConfirm={() => referenceOk && processMutation.mutate()}
                onCancel={() => setShowProcess(false)}
                isPending={processMutation.isPending}
            >
                <Field label="Reference number" required hint="At least 3 characters.">
                    <TextInput value={reference} placeholder="UTR / NEFT reference" autoComplete="off" onChange={(e) => setReference(e.target.value)} autoFocus />
                </Field>
            </ConfirmDialog>

            {/* Fail: the reason is stored on the payout and in the audit trail */}
            <ConfirmDialog
                open={showFail}
                tone="danger"
                level="reason"
                title="Mark payout as failed?"
                description="This can't be reversed and is recorded in the audit trail."
                reasonLabel="Failure reason"
                reasonPlaceholder="Why did this payout fail?"
                reasonMinLength={3}
                confirmLabel="Mark failed"
                onConfirm={(reason) => failMutation.mutate((reason ?? "").trim())}
                onCancel={() => setShowFail(false)}
                isPending={failMutation.isPending}
            />

            <ConfirmDialog
                open={confirmCancel}
                tone="danger"
                title="Cancel this payout?"
                description="The pending payout is cancelled and no money is sent. This can't be undone."
                confirmLabel="Cancel payout"
                cancelLabel="Keep it"
                onConfirm={() => cancelMutation.mutate()}
                onCancel={() => setConfirmCancel(false)}
                isPending={cancelMutation.isPending}
            />
        </div>
    );
}
